#!/usr/bin/env python3
"""
Backend API Testing for AI-Powered Resume Cleaning Application
Tests all backend endpoints with comprehensive scenarios
"""

import requests
import json
import os
import tempfile
import time
from pathlib import Path

# Configuration
BACKEND_URL = "https://cv-refiner.preview.emergentagent.com/api"
TEST_TIMEOUT = 30

# Test data - realistic resume text with intentional errors
SAMPLE_RESUME_TEXT = """John Smith
Software Developer

Contact Information:
Email: john.smith@email.com
Phone: (555) 123-4567

Professional Summary:
I was working as software developer at tech company for 3 years. I have experience in python, javascript and react. My responsibilities was managing projects and coding applications. I am passionate about creating efficient solutions and working with teams.

Work Experience:
Software Developer - Tech Solutions Inc (2021-2024)
- Developed web applications using React and Node.js
- Was responsible for database design and optimization
- Collaborated with cross-functional teams to deliver projects on time
- My achievements includes improving application performance by 40%

Education:
Bachelor of Science in Computer Science
University of Technology (2017-2021)
- Relevant coursework: Data Structures, Algorithms, Software Engineering
- GPA: 3.8/4.0

Skills:
- Programming Languages: Python, JavaScript, Java, C++
- Web Technologies: React, Node.js, HTML, CSS
- Databases: MySQL, MongoDB, PostgreSQL
- Tools: Git, Docker, AWS, Jenkins
"""

class BackendTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.test_results = []
        self.current_file_id = None
        
    def log_test(self, test_name, success, message, details=None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details or {}
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def test_health_check(self):
        """Test basic health check endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/health", timeout=TEST_TIMEOUT)
            
            if response.status_code == 200:
                data = response.json()
                ai_status = data.get('ai_integration', 'unknown')
                self.log_test(
                    "Health Check", 
                    True, 
                    f"API is healthy, AI integration: {ai_status}",
                    {"status_code": response.status_code, "response": data}
                )
                return True
            else:
                self.log_test(
                    "Health Check", 
                    False, 
                    f"Health check failed with status {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_test("Health Check", False, f"Health check error: {str(e)}")
            return False
    
    def test_file_upload_txt(self):
        """Test file upload with TXT file"""
        try:
            # Create temporary TXT file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
                f.write(SAMPLE_RESUME_TEXT)
                temp_file_path = f.name
            
            # Upload file
            with open(temp_file_path, 'rb') as f:
                files = {'file': ('test_resume.txt', f, 'text/plain')}
                response = self.session.post(
                    f"{self.base_url}/upload-resume", 
                    files=files, 
                    timeout=TEST_TIMEOUT
                )
            
            # Clean up temp file
            os.unlink(temp_file_path)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('file_id'):
                    self.current_file_id = data['file_id']
                    self.log_test(
                        "File Upload (TXT)", 
                        True, 
                        f"Successfully uploaded TXT file, file_id: {self.current_file_id}",
                        {"file_id": self.current_file_id, "filename": data.get('filename')}
                    )
                    return True
                else:
                    self.log_test(
                        "File Upload (TXT)", 
                        False, 
                        "Upload response missing required fields",
                        {"response": data}
                    )
                    return False
            else:
                self.log_test(
                    "File Upload (TXT)", 
                    False, 
                    f"Upload failed with status {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_test("File Upload (TXT)", False, f"Upload error: {str(e)}")
            return False
    
    def test_file_upload_invalid_type(self):
        """Test file upload with invalid file type"""
        try:
            # Create temporary file with invalid extension
            with tempfile.NamedTemporaryFile(mode='w', suffix='.xyz', delete=False) as f:
                f.write("Invalid file content")
                temp_file_path = f.name
            
            # Try to upload invalid file
            with open(temp_file_path, 'rb') as f:
                files = {'file': ('test_file.xyz', f, 'application/octet-stream')}
                response = self.session.post(
                    f"{self.base_url}/upload-resume", 
                    files=files, 
                    timeout=TEST_TIMEOUT
                )
            
            # Clean up temp file
            os.unlink(temp_file_path)
            
            if response.status_code == 400:
                self.log_test(
                    "File Upload (Invalid Type)", 
                    True, 
                    "Correctly rejected invalid file type",
                    {"status_code": response.status_code}
                )
                return True
            else:
                self.log_test(
                    "File Upload (Invalid Type)", 
                    False, 
                    f"Should have rejected invalid file type, got status {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_test("File Upload (Invalid Type)", False, f"Test error: {str(e)}")
            return False
    
    def test_ai_text_processing(self):
        """Test AI text cleaning functionality"""
        if not self.current_file_id:
            self.log_test("AI Text Processing", False, "No file_id available for testing")
            return False
        
        try:
            # Process resume with AI
            payload = {"file_id": self.current_file_id}
            response = self.session.post(
                f"{self.base_url}/process-resume", 
                json=payload, 
                timeout=TEST_TIMEOUT
            )
            
            if response.status_code == 200:
                data = response.json()
                if (data.get('success') and 
                    data.get('cleaned_text') and 
                    data.get('changes') is not None):
                    
                    original_text = data.get('original_text', '')
                    cleaned_text = data.get('cleaned_text', '')
                    changes = data.get('changes', [])
                    
                    # Verify text was actually processed
                    if cleaned_text != original_text:
                        self.log_test(
                            "AI Text Processing", 
                            True, 
                            f"Successfully processed text with {len(changes)} changes detected",
                            {
                                "total_changes": len(changes),
                                "original_length": len(original_text),
                                "cleaned_length": len(cleaned_text)
                            }
                        )
                        return True
                    else:
                        self.log_test(
                            "AI Text Processing", 
                            False, 
                            "AI processing returned identical text (no improvements made)",
                            {"changes_count": len(changes)}
                        )
                        return False
                else:
                    self.log_test(
                        "AI Text Processing", 
                        False, 
                        "Processing response missing required fields",
                        {"response": data}
                    )
                    return False
            else:
                self.log_test(
                    "AI Text Processing", 
                    False, 
                    f"Processing failed with status {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_test("AI Text Processing", False, f"Processing error: {str(e)}")
            return False
    
    def test_word_level_change_detection(self):
        """Test word-level change detection"""
        if not self.current_file_id:
            self.log_test("Word-level Change Detection", False, "No file_id available for testing")
            return False
        
        try:
            # Get resume data to check changes
            response = self.session.get(
                f"{self.base_url}/resume/{self.current_file_id}", 
                timeout=TEST_TIMEOUT
            )
            
            if response.status_code == 200:
                data = response.json()
                changes = data.get('changes', [])
                
                if changes:
                    # Verify change structure
                    sample_change = changes[0]
                    required_fields = ['id', 'original', 'suggested', 'start_pos', 'end_pos', 'change_type']
                    
                    if all(field in sample_change for field in required_fields):
                        # Check change types are categorized
                        change_types = set(change.get('change_type') for change in changes)
                        valid_types = {'grammar', 'punctuation', 'style'}
                        
                        if change_types.issubset(valid_types):
                            self.log_test(
                                "Word-level Change Detection", 
                                True, 
                                f"Successfully detected {len(changes)} changes with proper categorization",
                                {
                                    "total_changes": len(changes),
                                    "change_types": list(change_types),
                                    "sample_change": sample_change
                                }
                            )
                            return True
                        else:
                            self.log_test(
                                "Word-level Change Detection", 
                                False, 
                                f"Invalid change types detected: {change_types - valid_types}",
                                {"change_types": list(change_types)}
                            )
                            return False
                    else:
                        missing_fields = [f for f in required_fields if f not in sample_change]
                        self.log_test(
                            "Word-level Change Detection", 
                            False, 
                            f"Change structure missing required fields: {missing_fields}",
                            {"sample_change": sample_change}
                        )
                        return False
                else:
                    self.log_test(
                        "Word-level Change Detection", 
                        False, 
                        "No changes detected in processed text",
                        {"changes_count": 0}
                    )
                    return False
            else:
                self.log_test(
                    "Word-level Change Detection", 
                    False, 
                    f"Failed to retrieve resume data, status {response.status_code}",
                    {"status_code": response.status_code}
                )
                return False
                
        except Exception as e:
            self.log_test("Word-level Change Detection", False, f"Detection error: {str(e)}")
            return False
    
    def test_change_management(self):
        """Test accept/reject change functionality"""
        if not self.current_file_id:
            self.log_test("Change Management", False, "No file_id available for testing")
            return False
        
        try:
            # Get current changes
            response = self.session.get(
                f"{self.base_url}/resume/{self.current_file_id}", 
                timeout=TEST_TIMEOUT
            )
            
            if response.status_code != 200:
                self.log_test("Change Management", False, "Failed to get resume data")
                return False
            
            data = response.json()
            changes = data.get('changes', [])
            
            if not changes:
                self.log_test("Change Management", False, "No changes available to test")
                return False
            
            # Test accepting a change
            first_change_id = changes[0]['id']
            accept_payload = {
                "file_id": self.current_file_id,
                "change_id": first_change_id,
                "action": "accept"
            }
            
            response = self.session.post(
                f"{self.base_url}/toggle-change", 
                json=accept_payload, 
                timeout=TEST_TIMEOUT
            )
            
            if response.status_code == 200:
                # Verify change was accepted
                response = self.session.get(
                    f"{self.base_url}/resume/{self.current_file_id}", 
                    timeout=TEST_TIMEOUT
                )
                
                if response.status_code == 200:
                    updated_data = response.json()
                    updated_changes = updated_data.get('changes', [])
                    
                    # Find the change we accepted
                    accepted_change = next(
                        (c for c in updated_changes if c['id'] == first_change_id), 
                        None
                    )
                    
                    if accepted_change and accepted_change.get('accepted') == True:
                        # Test rejecting a change
                        if len(updated_changes) > 1:
                            second_change_id = updated_changes[1]['id']
                            reject_payload = {
                                "file_id": self.current_file_id,
                                "change_id": second_change_id,
                                "action": "reject"
                            }
                            
                            response = self.session.post(
                                f"{self.base_url}/toggle-change", 
                                json=reject_payload, 
                                timeout=TEST_TIMEOUT
                            )
                            
                            if response.status_code == 200:
                                self.log_test(
                                    "Change Management", 
                                    True, 
                                    "Successfully tested accept/reject functionality",
                                    {
                                        "accepted_change_id": first_change_id,
                                        "rejected_change_id": second_change_id
                                    }
                                )
                                return True
                        else:
                            self.log_test(
                                "Change Management", 
                                True, 
                                "Successfully tested accept functionality (only one change available)",
                                {"accepted_change_id": first_change_id}
                            )
                            return True
                    else:
                        self.log_test(
                            "Change Management", 
                            False, 
                            "Change was not properly marked as accepted",
                            {"change_id": first_change_id, "accepted": accepted_change.get('accepted') if accepted_change else None}
                        )
                        return False
                else:
                    self.log_test("Change Management", False, "Failed to verify change acceptance")
                    return False
            else:
                self.log_test(
                    "Change Management", 
                    False, 
                    f"Failed to accept change, status {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_test("Change Management", False, f"Change management error: {str(e)}")
            return False
    
    def test_final_text_generation(self):
        """Test final text generation with applied changes"""
        if not self.current_file_id:
            self.log_test("Final Text Generation", False, "No file_id available for testing")
            return False
        
        try:
            # Generate final text
            response = self.session.get(
                f"{self.base_url}/generate-final-text/{self.current_file_id}", 
                timeout=TEST_TIMEOUT
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('success') and data.get('final_text'):
                    final_text = data.get('final_text')
                    applied_changes = data.get('applied_changes', 0)
                    
                    # Verify final text is not empty and changes were applied
                    if final_text.strip():
                        self.log_test(
                            "Final Text Generation", 
                            True, 
                            f"Successfully generated final text with {applied_changes} changes applied",
                            {
                                "applied_changes": applied_changes,
                                "final_text_length": len(final_text)
                            }
                        )
                        return True
                    else:
                        self.log_test(
                            "Final Text Generation", 
                            False, 
                            "Generated final text is empty",
                            {"final_text": final_text}
                        )
                        return False
                else:
                    self.log_test(
                        "Final Text Generation", 
                        False, 
                        "Response missing required fields",
                        {"response": data}
                    )
                    return False
            else:
                self.log_test(
                    "Final Text Generation", 
                    False, 
                    f"Failed to generate final text, status {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_test("Final Text Generation", False, f"Final text generation error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all backend tests in sequence"""
        print(f"🚀 Starting Backend API Tests for: {self.base_url}")
        print("=" * 60)
        
        # Test sequence based on priority
        tests = [
            ("Health Check", self.test_health_check),
            ("File Upload (TXT)", self.test_file_upload_txt),
            ("File Upload (Invalid Type)", self.test_file_upload_invalid_type),
            ("AI Text Processing", self.test_ai_text_processing),
            ("Word-level Change Detection", self.test_word_level_change_detection),
            ("Change Management", self.test_change_management),
            ("Final Text Generation", self.test_final_text_generation),
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            try:
                if test_func():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                self.log_test(test_name, False, f"Test execution error: {str(e)}")
                failed += 1
            
            print()  # Add spacing between tests
        
        # Summary
        print("=" * 60)
        print(f"📊 TEST SUMMARY")
        print(f"Total Tests: {passed + failed}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"Success Rate: {(passed / (passed + failed) * 100):.1f}%" if (passed + failed) > 0 else "0%")
        
        return self.test_results

def main():
    """Main test execution"""
    tester = BackendTester()
    results = tester.run_all_tests()
    
    # Return results for further processing
    return results

if __name__ == "__main__":
    main()