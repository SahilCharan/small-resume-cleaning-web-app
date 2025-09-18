from fastapi import FastAPI, APIRouter, File, UploadFile, HTTPException, Form
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import json
import aiofiles
import tempfile
import shutil
from emergentintegrations.llm.chat import LlmChat, UserMessage
import PyPDF2
import pdfplumber
from pdfminer.high_level import extract_text as pdfminer_extract_text
import fitz  # PyMuPDF
import docx
import difflib
import re
import unicodedata

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# AI Configuration
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# Define Models
class ResumeUpload(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    file_type: str
    file_size: int
    upload_timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    processing_status: str = "uploaded"  # uploaded, processing, completed, error
    original_text: Optional[str] = None
    cleaned_text: Optional[str] = None
    changes: Optional[List[Dict[str, Any]]] = None

class ResumeProcessingRequest(BaseModel):
    file_id: str

class ChangeAction(BaseModel):
    file_id: str
    change_id: str
    action: str  # accept, reject

class WordChange(BaseModel):
    id: str
    original: str
    suggested: str
    start_pos: int
    end_pos: int
    change_type: str  # grammar, punctuation, style
    accepted: bool = False
    context: str = ""

# Utility Functions
async def extract_text_from_file(file_path: str, file_type: str) -> str:
    """Extract text from uploaded file based on type"""
    try:
        if file_type.lower() == 'pdf':
            return await extract_text_from_pdf(file_path)
        elif file_type.lower() in ['docx', 'doc']:
            return await extract_text_from_docx(file_path)
        elif file_type.lower() == 'txt':
            return await extract_text_from_txt(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error extracting text: {str(e)}")

def clean_extracted_text(text: str) -> str:
    """Clean and normalize extracted text to handle encoding issues"""
    if not text:
        return ""
    
    try:
        # Normalize Unicode characters
        text = unicodedata.normalize('NFKD', text)
        
        # Remove control characters and fix common encoding issues
        # Keep basic punctuation and alphanumeric characters
        cleaned_chars = []
        for char in text:
            # Keep printable ASCII characters and common Unicode characters
            if (ord(char) >= 32 and ord(char) <= 126) or char in '\n\t\r' or ord(char) >= 160:
                cleaned_chars.append(char)
            elif char.isspace():
                cleaned_chars.append(' ')
        
        text = ''.join(cleaned_chars)
        
        # Clean up extra whitespace and line breaks
        text = re.sub(r'\n\s*\n\s*\n+', '\n\n', text)  # Multiple blank lines to double
        text = re.sub(r'[ \t]+', ' ', text)  # Multiple spaces/tabs to single space
        text = re.sub(r'[ \t]*\n[ \t]*', '\n', text)  # Clean line breaks
        
        return text.strip()
        
    except Exception as e:
        # If all else fails, try basic ASCII cleanup
        try:
            text = text.encode('ascii', 'ignore').decode('ascii')
            return re.sub(r'\s+', ' ', text).strip()
        except:
            return str(text)

def validate_pdf_file(file_path: str) -> tuple[bool, str]:
    """Validate PDF file before processing"""
    try:
        # Check if file exists and has content
        if not os.path.exists(file_path) or os.path.getsize(file_path) == 0:
            return False, "PDF file is empty or doesn't exist"
        
        # Check PDF header
        with open(file_path, 'rb') as f:
            header = f.read(8)
            if not header.startswith(b'%PDF'):
                return False, "File is not a valid PDF"
        
        # Try to open with PyMuPDF for basic validation
        try:
            doc = fitz.open(file_path)
            page_count = doc.page_count
            doc.close()
            
            if page_count == 0:
                return False, "PDF contains no pages"
                
            return True, f"PDF is valid with {page_count} pages"
            
        except Exception as e:
            return False, f"PDF structure validation failed: {str(e)}"
        
    except Exception as e:
        return False, f"PDF validation error: {str(e)}"

async def extract_text_from_pdf(file_path: str) -> str:
    """Multi-method PDF text extraction with fallback strategies"""
    
    # First validate the PDF
    is_valid, validation_msg = validate_pdf_file(file_path)
    if not is_valid:
        raise ValueError(f"PDF validation failed: {validation_msg}")
    
    text = ""
    extraction_method = "none"
    
    # Method 1: Try pdfplumber first (best for formatted text)
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        
        if text.strip() and len(text.strip()) > 10:
            extraction_method = "pdfplumber"
            logger.info(f"PDF extraction successful with pdfplumber: {len(text)} characters")
            return clean_extracted_text(text)
    except Exception as e:
        logger.warning(f"pdfplumber extraction failed: {e}")
    
    # Method 2: Try PyMuPDF (handles complex PDFs better)
    try:
        doc = fitz.open(file_path)
        text = ""
        for page_num in range(doc.page_count):
            page = doc.load_page(page_num)
            page_text = page.get_text()
            if page_text:
                text += page_text + "\n"
        doc.close()
        
        if text.strip() and len(text.strip()) > 10:
            extraction_method = "PyMuPDF"
            logger.info(f"PDF extraction successful with PyMuPDF: {len(text)} characters")
            return clean_extracted_text(text)
    except Exception as e:
        logger.warning(f"PyMuPDF extraction failed: {e}")
    
    # Method 3: Try pdfminer as fallback
    try:
        text = pdfminer_extract_text(file_path)
        if text and text.strip() and len(text.strip()) > 10:
            extraction_method = "pdfminer"
            logger.info(f"PDF extraction successful with pdfminer: {len(text)} characters")
            return clean_extracted_text(text)
    except Exception as e:
        logger.warning(f"pdfminer extraction failed: {e}")
    
    # Method 4: Try PyPDF2 as final fallback
    try:
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            text = ""
            for page in pdf_reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        
        if text.strip() and len(text.strip()) > 10:
            extraction_method = "PyPDF2"
            logger.info(f"PDF extraction successful with PyPDF2: {len(text)} characters")
            return clean_extracted_text(text)
    except Exception as e:
        logger.warning(f"PyPDF2 extraction failed: {e}")
    
    # If all methods fail, provide detailed error message
    error_msg = f"""PDF text extraction failed with all methods (pdfplumber, PyMuPDF, pdfminer, PyPDF2).

Possible causes:
1. PDF contains only scanned images (no extractable text)
2. PDF is password protected
3. PDF has unusual encoding or format
4. PDF is corrupted

Recommendations:
1. Try converting your resume to DOCX or TXT format
2. If it's a scanned PDF, use OCR software first
3. Recreate the PDF from the original document
4. Ensure the PDF contains selectable text (not just images)"""
    
    raise ValueError(error_msg)

async def extract_text_from_docx(file_path: str) -> str:
    """Extract text from DOCX file"""
    doc = docx.Document(file_path)
    text = ""
    for paragraph in doc.paragraphs:
        text += paragraph.text + "\n"
    return text.strip()

async def extract_text_from_txt(file_path: str) -> str:
    """Extract text from TXT file"""
    async with aiofiles.open(file_path, 'r', encoding='utf-8') as file:
        content = await file.read()
    return content.strip()

async def clean_text_with_ai(text: str) -> str:
    """Use AI to clean and improve resume text"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"resume-cleaning-{uuid.uuid4()}",
            system_message="""You are an expert resume editor and professional writing assistant. Your task is to improve resume text by:

1. Correcting grammar errors (subject-verb agreement, tense consistency, sentence structure)
2. Fixing punctuation mistakes (commas, periods, apostrophes, quotation marks)
3. Enhancing word choice and professional language
4. Maintaining the original structure, formatting, and meaning
5. Preserving all dates, names, contact information, and technical terms exactly as provided
6. Keeping the professional tone appropriate for resumes

IMPORTANT: Return ONLY the cleaned text without any explanations, comments, or additional formatting. Do not add introductory phrases like "Here's the cleaned version" or any other commentary."""
        ).with_model("openai", "gpt-4o")
        
        user_message = UserMessage(text=f"Please clean and improve this resume text:\n\n{text}")
        response = await chat.send_message(user_message)
        return response.strip()
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI processing error: {str(e)}")

def detect_word_changes(original: str, cleaned: str) -> List[WordChange]:
    """Detect word-level changes between original and cleaned text"""
    changes = []
    
    # Split text into words while preserving positions
    original_words = re.findall(r'\S+|\s+', original)
    cleaned_words = re.findall(r'\S+|\s+', cleaned)
    
    # Use difflib to find differences
    diff = difflib.SequenceMatcher(None, original_words, cleaned_words)
    
    change_id = 0
    for tag, i1, i2, j1, j2 in diff.get_opcodes():
        if tag == 'replace':
            # Calculate positions
            start_pos = len(''.join(original_words[:i1]))
            end_pos = len(''.join(original_words[:i2]))
            
            original_segment = ''.join(original_words[i1:i2]).strip()
            cleaned_segment = ''.join(cleaned_words[j1:j2]).strip()
            
            if original_segment and cleaned_segment and original_segment != cleaned_segment:
                # Determine change type based on content
                change_type = "grammar"
                if re.search(r'[.,;:!?]', original_segment) or re.search(r'[.,;:!?]', cleaned_segment):
                    change_type = "punctuation"
                
                # Get context (50 chars before and after)
                context_start = max(0, start_pos - 50)
                context_end = min(len(original), end_pos + 50)
                context = original[context_start:context_end]
                
                change = WordChange(
                    id=str(change_id),
                    original=original_segment,
                    suggested=cleaned_segment,
                    start_pos=start_pos,
                    end_pos=end_pos,
                    change_type=change_type,
                    context=context
                )
                changes.append(change)
                change_id += 1
    
    return changes

# API Routes
@api_router.post("/upload-resume", response_model=Dict[str, Any])
async def upload_resume(file: UploadFile = File(...)):
    """Upload and process resume file"""
    
    # Validate file type
    allowed_types = ['pdf', 'docx', 'doc', 'txt']
    file_ext = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
    
    if file_ext not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type. Allowed types: {', '.join(allowed_types)}"
        )
    
    # Validate file size (10MB limit)
    if file.size and file.size > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")
    
    # Create resume record
    resume = ResumeUpload(
        filename=file.filename,
        file_type=file_ext,
        file_size=file.size or 0
    )
    
    try:
        # Save file temporarily
        temp_dir = tempfile.mkdtemp()
        file_path = os.path.join(temp_dir, file.filename)
        
        with open(file_path, 'wb') as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Extract text
        original_text = await extract_text_from_file(file_path, file_ext)
        resume.original_text = original_text
        
        # Save to database
        await db.resumes.insert_one(resume.dict())
        
        # Clean up temp file
        shutil.rmtree(temp_dir)
        
        return {
            "success": True,
            "file_id": resume.id,
            "filename": resume.filename,
            "file_type": resume.file_type,
            "original_text": original_text[:500] + "..." if len(original_text) > 500 else original_text
        }
        
    except Exception as e:
        # Clean up temp directory if it exists
        if 'temp_dir' in locals():
            shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Upload processing failed: {str(e)}")

@api_router.post("/process-resume")
async def process_resume(request: ResumeProcessingRequest):
    """Process uploaded resume with AI cleaning"""
    
    # Get resume from database
    resume_data = await db.resumes.find_one({"id": request.file_id})
    if not resume_data:
        raise HTTPException(status_code=404, detail="Resume not found")
    
    try:
        # Update status to processing
        await db.resumes.update_one(
            {"id": request.file_id},
            {"$set": {"processing_status": "processing"}}
        )
        
        # Clean text with AI
        cleaned_text = await clean_text_with_ai(resume_data['original_text'])
        
        # Detect changes
        changes = detect_word_changes(resume_data['original_text'], cleaned_text)
        
        # Update database with results
        await db.resumes.update_one(
            {"id": request.file_id},
            {"$set": {
                "processing_status": "completed",
                "cleaned_text": cleaned_text,
                "changes": [change.dict() for change in changes]
            }}
        )
        
        return {
            "success": True,
            "file_id": request.file_id,
            "original_text": resume_data['original_text'],
            "cleaned_text": cleaned_text,
            "changes": [change.dict() for change in changes],
            "total_changes": len(changes)
        }
        
    except Exception as e:
        # Update status to error
        await db.resumes.update_one(
            {"id": request.file_id},
            {"$set": {"processing_status": "error"}}
        )
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

@api_router.post("/toggle-change")
async def toggle_change(request: ChangeAction):
    """Accept or reject a specific change"""
    
    # Get resume from database
    resume_data = await db.resumes.find_one({"id": request.file_id})
    if not resume_data:
        raise HTTPException(status_code=404, detail="Resume not found")
    
    # Update the specific change
    changes = resume_data.get('changes', [])
    for change in changes:
        if change['id'] == request.change_id:
            change['accepted'] = (request.action == 'accept')
            break
    
    # Update database
    await db.resumes.update_one(
        {"id": request.file_id},
        {"$set": {"changes": changes}}
    )
    
    return {"success": True, "message": f"Change {request.action}ed successfully"}

@api_router.get("/resume/{file_id}")
async def get_resume(file_id: str):
    """Get resume processing results"""
    
    resume_data = await db.resumes.find_one({"id": file_id})
    if not resume_data:
        raise HTTPException(status_code=404, detail="Resume not found")
    
    return {
        "file_id": file_id,
        "filename": resume_data['filename'],
        "file_type": resume_data['file_type'],
        "processing_status": resume_data['processing_status'],
        "original_text": resume_data.get('original_text'),
        "cleaned_text": resume_data.get('cleaned_text'),
        "changes": resume_data.get('changes', []),
        "upload_timestamp": resume_data['upload_timestamp']
    }

@api_router.get("/generate-final-text/{file_id}")
async def generate_final_text(file_id: str):
    """Generate final text with accepted changes applied"""
    
    resume_data = await db.resumes.find_one({"id": file_id})
    if not resume_data:
        raise HTTPException(status_code=404, detail="Resume not found")
    
    original_text = resume_data.get('original_text', '')
    changes = resume_data.get('changes', [])
    
    # Apply accepted changes
    final_text = original_text
    
    # Sort changes by position (descending to avoid position shifts)
    sorted_changes = sorted(
        [change for change in changes if change.get('accepted', False)],
        key=lambda x: x['start_pos'],
        reverse=True
    )
    
    for change in sorted_changes:
        start_pos = change['start_pos']
        end_pos = change['end_pos']
        suggested = change['suggested']
        
        final_text = final_text[:start_pos] + suggested + final_text[end_pos:]
    
    return {
        "success": True,
        "final_text": final_text,
        "applied_changes": len(sorted_changes)
    }

# Health check endpoints
@api_router.get("/")
async def root():
    return {"message": "Resume Cleaning API is running"}

@api_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "ai_integration": "connected" if EMERGENT_LLM_KEY else "not configured"
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()