import React, { useState, useEffect } from 'react';
import { X, Upload, FileText, Trash2, Save, AlertCircle, Eye } from 'lucide-react';
import { agentAPI, fileAPI } from '../services/api';
import '../styles/EditAgentModal.css';

const EditAgentModal = ({ agent, isOpen, onClose, onAgentUpdated }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [existingFiles, setExistingFiles] = useState([]);
  const [newFiles, setNewFiles] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (agent && isOpen) {
      setFormData({
        name: agent.name || '',
        description: agent.description || ''
      });
      // Use files array from agent data
      setExistingFiles(agent.files || []);
      setNewFiles([]);
      setError('');
      setSuccess('');
    }
  }, [agent, isOpen]);

  const loadAgentFiles = async () => {
    try {
      const response = await fileAPI.getByAgent(agent.id);
      setExistingFiles(response.data || []);
    } catch (error) {
      console.error('Error loading agent files:', error);
      setExistingFiles([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setNewFiles(prev => [...prev, ...files]);
  };

  const removeNewFile = (index) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index));
  };



  const handleFileView = (fileUrl) => {
    window.open(fileUrl, '_blank');
  };

  const handleFileDelete = async (fileId, fileName) => {
    if (!window.confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      await fileAPI.delete(fileId);
      
      // Remove the file from the existing files list
      setExistingFiles(prev => prev.filter(file => file.file_id !== fileId));
      
      setSuccess('File deleted successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error deleting file:', error);
      setError(error.response?.data?.message || 'Failed to delete file');
      
      // Clear error message after 5 seconds
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const updateData = {
        name: formData.name,
        description: formData.description,
        newFiles: newFiles
      };

      const response = await agentAPI.update(agent.agent_id, updateData);
      setSuccess('Agent updated successfully!');
      
      // Refresh the agent files list
      await loadAgentFiles();
      setNewFiles([]);
      
      // Notify parent component
      if (onAgentUpdated) {
        onAgentUpdated(response.data);
      }
      
      // Close modal after a short delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Error updating agent:', error);
      setError(error.response?.data?.message || 'Failed to update agent');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return 'Size unknown';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content edit-agent-modal">
        <div className="modal-header">
          <h2>Edit Agent</h2>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="edit-form">
          <div className="form-group">
            <label htmlFor="name">Agent Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              className="form-textarea"
              placeholder="Enter agent description..."
            />
          </div>

          <div className="form-group">
            <label>Files</label>
            
            {/* Existing Files */}
            {existingFiles.length > 0 && (
              <div className="files-section">
                <h4>Current Files</h4>
                <div className="files-list">
                  {existingFiles.map((file) => (
                    <div 
                      key={file.file_id} 
                      className="file-item"
                    >
                      <div className="file-info">
                        <FileText size={16} />
                        <span className="file-name">{file.file_name}</span>
                        <span className="file-size">{formatFileSize(file.file_size)}</span>
                      </div>
                      <div className="file-actions">
                        <button
                          type="button"
                          onClick={() => handleFileView(file.file_url)}
                          className="btn-view"
                          title="View file"
                          disabled={loading}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFileDelete(file.file_id, file.file_name)}
                          className="btn-delete"
                          title="Delete file"
                          disabled={loading}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New Files */}
            {newFiles.length > 0 && (
              <div className="files-section">
                <h4>New Files to Upload</h4>
                <div className="files-list">
                  {newFiles.map((file, index) => (
                    <div key={index} className="file-item new-file">
                      <div className="file-info">
                        <FileText size={16} />
                        <span className="file-name">{file.name}</span>
                        <span className="file-size">{formatFileSize(file.size)}</span>
                      </div>
                      <div className="file-actions">
                        <button
                          type="button"
                          onClick={() => removeNewFile(index)}
                          className="btn-delete"
                          title="Remove file"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* File Upload */}
            <div className="file-upload-section">
              <label htmlFor="file-upload" className="file-upload-label">
                <Upload size={20} />
                <span>Add Files</span>
                <input
                  type="file"
                  id="file-upload"
                  multiple
                  onChange={handleFileUpload}
                  className="file-upload-input"
                  accept=".txt,.pdf,.doc,.docx,.md"
                />
              </label>
            </div>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="message error-message">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="message success-message">
              <span>{success}</span>
            </div>
          )}

          {/* Form Actions */}
          <div className="form-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Save size={16} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditAgentModal;