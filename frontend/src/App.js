import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Component for individual word changes
const WordChange = ({ change, onToggle }) => {
  const getChangeColor = (type) => {
    switch (type) {
      case 'grammar': return 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 hover:border-green-300';
      case 'punctuation': return 'bg-gradient-to-r from-blue-50 to-sky-50 border-blue-200 hover:border-blue-300';
      case 'style': return 'bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200 hover:border-purple-300';
      default: return 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200 hover:border-gray-300';
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
    <div className={`p-4 border-2 rounded-xl mb-3 transition-all duration-200 ${getChangeColor(change.change_type)} hover:shadow-md`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{getTypeIcon(change.change_type)}</span>
            <span className="text-sm font-semibold text-gray-700">
              {change.change_type.charAt(0).toUpperCase() + change.change_type.slice(1)} Improvement
            </span>
          </div>
          <div className="text-sm mb-3">
            <div className="bg-red-100 border border-red-200 rounded-lg px-3 py-2 mb-2">
              <span className="text-red-700 font-medium">Original: </span>
              <span className="text-red-800 bg-red-200 px-2 py-1 rounded">{change.original}</span>
            </div>
            <div className="bg-green-100 border border-green-200 rounded-lg px-3 py-2">
              <span className="text-green-700 font-medium">Suggested: </span>
              <span className="text-green-800 bg-green-200 px-2 py-1 rounded font-medium">{change.suggested}</span>
            </div>
          </div>
          {change.context && (
            <div className="text-xs text-gray-600 italic bg-gray-50 rounded-lg px-3 py-2">
              <span className="font-medium">Context:</span> "...{change.context}..."
            </div>
          )}
        </div>
        <div className="ml-4 flex flex-col gap-2">
          <button
            onClick={() => onToggle(change.id, 'accept')}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-all duration-200 ${
              change.accepted 
                ? 'bg-green-600 text-white shadow-lg' 
                : 'bg-white text-green-600 border-2 border-green-600 hover:bg-green-50 hover:shadow-md'
            }`}
          >
            {change.accepted ? '✓ Accepted' : 'Accept'}
          </button>
          <button
            onClick={() => onToggle(change.id, 'reject')}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-all duration-200 ${
              !change.accepted 
                ? 'bg-red-600 text-white shadow-lg' 
                : 'bg-white text-red-600 border-2 border-red-600 hover:bg-red-50 hover:shadow-md'
            }`}
          >
            {!change.accepted ? '✗ Rejected' : 'Reject'}
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
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragOver 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
      >
        <div className="mb-4">
          <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="mb-4">
          <p className="text-lg font-medium text-gray-900">Drop your resume here</p>
          <p className="text-gray-500">or click to browse files</p>
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
          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer ${
            uploading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {uploading ? 'Uploading...' : 'Select File'}
        </label>
        <p className="mt-2 text-xs text-gray-500">
          Supports PDF, DOCX, DOC, and TXT files (max 10MB)
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
      case 'processing': return 'text-yellow-600';
      case 'completed': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'uploading': return 'Uploading file...';
      case 'processing': return 'AI is cleaning your resume...';
      case 'completed': return 'Processing completed!';
      case 'error': return 'Processing failed';
      default: return 'Ready';
    }
  };

  return (
    <div className="max-w-2xl mx-auto mb-6">
      <div className="bg-white rounded-lg shadow p-4">
        <div className={`font-medium mb-2 ${getStatusColor()}`}>
          {getStatusText()}
        </div>
        {status === 'processing' && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
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