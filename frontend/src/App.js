import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Component for individual word changes with soothing colors
const WordChange = ({ change, onToggle }) => {
  const getChangeStyle = (type) => {
    switch (type) {
      case 'grammar': 
        return 'change-type-badge grammar';
      case 'punctuation': 
        return 'change-type-badge punctuation';
      case 'style': 
        return 'change-type-badge style';
      default: 
        return 'change-type-badge grammar';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'grammar': return '📝';
      case 'punctuation': return '✏️';
      case 'style': return '🎨';
      default: return '📋';
    }
  };

  return (
    <div className="word-change-card change-item">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl">{getTypeIcon(change.change_type)}</span>
            <span className={getChangeStyle(change.change_type)}>
              {change.change_type} Fix
            </span>
          </div>
          
          {/* Error highlighting in soft red */}
          <div className="mb-3">
            <div className="text-sm font-medium mb-2" style={{color: 'var(--error-text)'}}>
              Original (Error):
            </div>
            <div className="original-text" style={{padding: '12px', background: 'var(--error-bg)', border: '1px solid var(--error-border)'}}>
              <span className="error-highlight">{change.original}</span>
            </div>
          </div>
          
          {/* Correction highlighting in soft green */}
          <div className="mb-4">
            <div className="text-sm font-medium mb-2" style={{color: 'var(--success-text)'}}>
              Suggested (Correction):
            </div>
            <div className="improved-text" style={{padding: '12px', background: 'var(--success-bg)', border: '1px solid var(--success-border)'}}>
              <span className="correction-highlight">{change.suggested}</span>
            </div>
          </div>
          
          {change.context && (
            <div className="text-xs italic p-3 rounded-lg" style={{background: 'var(--bg-secondary)', color: 'var(--text-muted)'}}>
              <span className="font-medium">Context:</span> "...{change.context}..."
            </div>
          )}
        </div>
        
        <div className="ml-6 flex flex-col gap-3">
          <button
            onClick={() => onToggle(change.id, 'accept')}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-all duration-200 ${
              change.accepted 
                ? 'text-white shadow-lg' 
                : 'border-2 hover:shadow-md'
            }`}
            style={{
              backgroundColor: change.accepted ? 'var(--success-text)' : 'transparent',
              borderColor: 'var(--success-text)',
              color: !change.accepted ? 'var(--success-text)' : 'white'
            }}
          >
            {change.accepted ? '✓ Applied' : 'Apply Fix'}
          </button>
          <button
            onClick={() => onToggle(change.id, 'reject')}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-all duration-200 ${
              !change.accepted 
                ? 'text-white shadow-lg' 
                : 'border-2 hover:shadow-md'
            }`}
            style={{
              backgroundColor: !change.accepted ? 'var(--error-text)' : 'transparent',
              borderColor: 'var(--error-text)',
              color: change.accepted ? 'var(--error-text)' : 'white'
            }}
          >
            {!change.accepted ? '✗ Ignored' : 'Ignore'}
          </button>
        </div>
      </div>
    </div>
  );
};

// File upload component
const FileUpload = ({ onFileUpload, uploading }) => {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      onFileUpload(files[0]);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div
        className={`border-3 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
          dragOver 
            ? 'border-blue-400 bg-gradient-to-br from-blue-50 to-purple-50 scale-105' 
            : 'border-gray-300 hover:border-blue-400 bg-gradient-to-br from-gray-50 to-white hover:from-blue-50 hover:to-purple-50'
        } shadow-lg hover:shadow-xl`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
      >
        <div className="mb-6">
          <div className="text-6xl mb-4">📁</div>
          <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" stroke="currentColor" fill="none" viewBox="0 0 48 48">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="mb-6">
          <p className="text-2xl font-bold text-gray-900 mb-2">Drop your resume here</p>
          <p className="text-gray-600 text-lg">or click to browse files</p>
        </div>
        <input
          type="file"
          className="hidden"
          id="file-upload"
          accept=".pdf,.docx,.doc,.txt"
          onChange={handleFileSelect}
          disabled={uploading}
        />
        <label
          htmlFor="file-upload"
          className={`inline-flex items-center px-8 py-4 border border-transparent text-lg font-semibold rounded-xl shadow-lg transition-all duration-200 ${
            uploading 
              ? 'bg-gray-400 text-white cursor-not-allowed' 
              : 'text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 cursor-pointer hover:scale-105 hover:shadow-xl'
          }`}
        >
          <span className="text-xl mr-2">📤</span>
          {uploading ? 'Uploading...' : 'Select File'}
        </label>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">📄 PDF</span>
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">📝 DOCX</span>
          <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">📋 DOC</span>
          <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">📄 TXT</span>
        </div>
        <p className="mt-4 text-sm text-gray-500">
          Maximum file size: <span className="font-semibold">10MB</span>
        </p>
      </div>
    </div>
  );
};

// Processing status component
const ProcessingStatus = ({ status, progress }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'uploading': return 'text-blue-600';
      case 'processing': return 'text-purple-600';
      case 'completed': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'uploading': return '📤';
      case 'processing': return '🤖';
      case 'completed': return '✅';
      case 'error': return '❌';
      default: return '⏳';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'uploading': return 'Uploading your resume...';
      case 'processing': return 'AI is analyzing and improving your resume...';
      case 'completed': return 'Processing completed successfully!';
      case 'error': return 'Processing failed - please try again';
      default: return 'Ready to process';
    }
  };

  return (
    <div className="max-w-2xl mx-auto mb-6">
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
        <div className={`font-bold text-lg mb-4 flex items-center gap-3 ${getStatusColor()}`}>
          <span className="text-2xl">{getStatusIcon()}</span>
          {getStatusText()}
        </div>
        {status === 'processing' && (
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {status === 'processing' && (
          <p className="text-sm text-gray-600 mt-3 text-center">
            This may take up to 2 minutes... ☕
          </p>
        )}
      </div>
    </div>
  );
};

// Main App Component
function App() {
  const [currentStep, setCurrentStep] = useState('upload'); // upload, processing, results
  const [fileData, setFileData] = useState(null);
  const [processingStatus, setProcessingStatus] = useState('ready');
  const [progress, setProgress] = useState(0);
  const [resumeData, setResumeData] = useState(null);
  const [error, setError] = useState(null);

  const handleFileUpload = async (file) => {
    setError(null);
    setProcessingStatus('uploading');
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API}/upload-resume`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        setFileData(response.data);
        setProgress(30);
        setCurrentStep('processing');
        
        // Start AI processing
        await processResume(response.data.file_id);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.response?.data?.detail || 'Upload failed');
      setProcessingStatus('error');
    }
  };

  const processResume = async (fileId) => {
    setProcessingStatus('processing');
    setProgress(40);

    try {
      const response = await axios.post(`${API}/process-resume`, {
        file_id: fileId
      });

      if (response.data.success) {
        setResumeData(response.data);
        setProgress(100);
        setProcessingStatus('completed');
        setCurrentStep('results');
      }
    } catch (error) {
      console.error('Processing error:', error);
      setError(error.response?.data?.detail || 'Processing failed');
      setProcessingStatus('error');
    }
  };

  const handleChangeToggle = async (changeId, action) => {
    try {
      await axios.post(`${API}/toggle-change`, {
        file_id: fileData.file_id,
        change_id: changeId,
        action: action
      });

      // Update local state
      setResumeData(prev => ({
        ...prev,
        changes: prev.changes.map(change => 
          change.id === changeId 
            ? { ...change, accepted: action === 'accept' }
            : change
        )
      }));
    } catch (error) {
      console.error('Toggle change error:', error);
      setError('Failed to update change');
    }
  };

  const generateFinalText = async () => {
    try {
      const response = await axios.get(`${API}/generate-final-text/${fileData.file_id}`);
      return response.data.final_text;
    } catch (error) {
      console.error('Generate final text error:', error);
      return resumeData.cleaned_text;
    }
  };

  const handleDownload = async () => {
    try {
      const finalText = await generateFinalText();
      
      // Create download blob
      const blob = new Blob([finalText], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cleaned_${fileData.filename.replace(/\.[^/.]+$/, '')}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      setError('Download failed');
    }
  };

  const resetApp = () => {
    setCurrentStep('upload');
    setFileData(null);
    setProcessingStatus('ready');
    setProgress(0);
    setResumeData(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <span className="text-4xl">🚀</span>
                Resume Cleaner
              </h1>
              <p className="text-blue-100 mt-1">AI-powered resume grammar and style enhancement</p>
            </div>
            {currentStep === 'results' && (
              <button
                onClick={resetApp}
                className="px-6 py-3 text-sm font-medium text-white bg-white/20 border border-white/30 rounded-lg hover:bg-white/30 transition-all duration-200 backdrop-blur-sm"
              >
                🔄 Clean Another Resume
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="max-w-2xl mx-auto mb-6">
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div className="text-red-800 font-medium">{error}</div>
              </div>
              <button
                onClick={() => setError(null)}
                className="mt-3 text-sm text-red-600 hover:text-red-800 font-medium"
              >
                ✕ Dismiss
              </button>
            </div>
          </div>
        )}

        {currentStep === 'upload' && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
                Upload Your Resume
              </h2>
              <p className="text-xl text-gray-600">
                Get professional grammar and style improvements with AI ✨
              </p>
            </div>
            <FileUpload 
              onFileUpload={handleFileUpload} 
              uploading={processingStatus === 'uploading'}
            />
          </div>
        )}

        {(currentStep === 'processing' || processingStatus !== 'ready') && currentStep !== 'results' && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
                Processing Your Resume
              </h2>
              <p className="text-lg text-gray-600">Our AI is working its magic... 🪄</p>
            </div>
            <ProcessingStatus status={processingStatus} progress={progress} />
          </div>
        )}

        {currentStep === 'results' && resumeData && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-4">
                Review Changes
              </h2>
              <div className="bg-gradient-to-r from-green-100 to-blue-100 rounded-xl p-4 inline-block">
                <p className="text-lg text-gray-700">
                  <span className="text-2xl mr-2">🎉</span>
                  Found <span className="font-bold text-green-600">{resumeData.changes.length}</span> improvements! 
                  Review and accept the changes you want.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Original Text */}
              <div className="bg-white rounded-2xl shadow-lg border border-red-100">
                <div className="px-6 py-4 border-b border-red-100 bg-gradient-to-r from-red-50 to-pink-50">
                  <h3 className="text-lg font-semibold text-red-800 flex items-center gap-2">
                    <span className="text-xl">📄</span>
                    Original Text
                  </h3>
                </div>
                <div className="p-6 max-h-96 overflow-y-auto custom-scrollbar">
                  <div className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                    {resumeData.original_text}
                  </div>
                </div>
              </div>

              {/* Cleaned Text Preview */}
              <div className="bg-white rounded-2xl shadow-lg border border-green-100">
                <div className="px-6 py-4 border-b border-green-100 bg-gradient-to-r from-green-50 to-emerald-50">
                  <h3 className="text-lg font-semibold text-green-800 flex items-center gap-2">
                    <span className="text-xl">✨</span>
                    Improved Text
                  </h3>
                </div>
                <div className="p-6 max-h-96 overflow-y-auto custom-scrollbar">
                  <div className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                    {resumeData.cleaned_text}
                  </div>
                </div>
              </div>
            </div>

            {/* Changes List */}
            {resumeData.changes.length > 0 && (
              <div className="mt-8">
                <div className="bg-white rounded-2xl shadow-lg">
                  <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
                    <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-3">
                      <span className="text-2xl">🔍</span>
                      Suggested Changes ({resumeData.changes.length})
                      <div className="ml-auto flex gap-2">
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                          📝 Grammar
                        </span>
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                          ✏️ Punctuation
                        </span>
                        <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                          🎨 Style
                        </span>
                      </div>
                    </h3>
                  </div>
                  <div className="p-6 max-h-96 overflow-y-auto custom-scrollbar">
                    {resumeData.changes.map((change) => (
                      <WordChange
                        key={change.id}
                        change={change}
                        onToggle={handleChangeToggle}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Download Section */}
            <div className="mt-8 text-center">
              <div className="bg-gradient-to-r from-green-400 to-blue-500 rounded-2xl p-8 shadow-lg">
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-semibold rounded-xl shadow-lg text-white bg-white/20 hover:bg-white/30 focus:outline-none focus:ring-4 focus:ring-white/50 transition-all duration-200 backdrop-blur-sm"
                >
                  <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download Cleaned Resume
                </button>
                <p className="mt-4 text-white text-lg">
                  <span className="text-xl mr-2">✅</span>
                  Applied changes: <span className="font-bold">{resumeData.changes.filter(c => c.accepted).length}</span> of {resumeData.changes.length}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;