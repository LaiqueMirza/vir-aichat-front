import React, { useState, useRef } from 'react';
import { PaperClipIcon, XMarkIcon } from '@heroicons/react/24/outline';

const FileUpload = ({ onFileSelect, onFileRemove, selectedFiles = [] }) => {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (files) => {
    Array.from(files).forEach(file => {
      if (onFileSelect) {
        onFileSelect(file);
      }
    });
  };

  const openFileSelector = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (index) => {
    if (onFileRemove) {
      onFileRemove(index);
    }
  };

  return (
    <div className="space-y-2">
      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleChange}
        className="hidden"
        accept="image/*,.pdf,.doc,.docx,.txt"
      />

      {/* Upload Button */}
      <button
        type="button"
        onClick={openFileSelector}
        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
      >
        <PaperClipIcon className="h-4 w-4 mr-2" />
        Attach File
      </button>

      {/* Drag and Drop Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          dragActive 
            ? 'border-primary-500 bg-primary-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <p className="text-sm text-gray-500">
          Drag and drop files here, or click "Attach File" to select
        </p>
      </div>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Selected Files:</h4>
          {selectedFiles.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
              <span className="text-sm text-gray-600 truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="ml-2 text-gray-400 hover:text-red-500"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUpload;