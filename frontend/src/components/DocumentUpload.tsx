import { useState, useRef, useCallback } from 'react';
import { documentApi, UPLOADS_BASE_URL } from '../api';
import { Document } from '../types';
import { FileText, Upload, X, Download, Eye, Trash2 } from 'lucide-react';

interface DocumentUploadProps {
  clientId: string;
  onUploadComplete: () => void;
  documents: Document[];
  onDelete?: (docId: string) => void;
}

export default function DocumentUpload({ clientId, onUploadComplete, documents, onDelete }: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setSelectedFile(files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    if (description) {
      formData.append('description', description);
    }

    try {
      await documentApi.create(clientId, formData);
      setSelectedFile(null);
      setDescription('');
      onUploadComplete();
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handlePreview = (doc: Document) => {
    setPreviewDoc(doc);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isImage = (mimeType: string) => mimeType.startsWith('image/');
  const isPdf = (mimeType: string) => mimeType === 'application/pdf';

  const getUploadUrl = (filename: string) => {
    const base = UPLOADS_BASE_URL.endsWith('/') ? UPLOADS_BASE_URL.slice(0, -1) : UPLOADS_BASE_URL;
    return `${base}/${filename}`;
  };

  const getPreviewContent = (doc: Document) => {
    if (isImage(doc.mimeType)) {
      return (
        <img
          src={getUploadUrl(doc.filename)}
          alt={doc.originalName}
          className="max-w-full max-h-[70vh] object-contain"
        />
      );
    } else if (isPdf(doc.mimeType)) {
      return (
        <iframe
          src={getUploadUrl(doc.filename)}
          className="w-full h-[70vh]"
          title={doc.originalName}
        />
      );
    } else {
      return (
        <div className="text-center py-12">
          <FileText className="h-16 w-16 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-900 font-medium">{doc.originalName}</p>
          <p className="text-gray-500 text-sm mt-2">
            {formatFileSize(doc.size)} • {doc.mimeType}
          </p>
          <p className="text-gray-500 mt-4">
            Preview not available for this file type.
          </p>
          <button
            onClick={() => documentApi.download(clientId, doc.id, doc.originalName)}
            className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        </div>
      );
    }
  };

  return (
    <div>
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-4 md:p-6 mb-6 transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="text-center">
          <Upload className={`h-8 w-8 mx-auto mb-2 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
          <p className="text-sm font-medium text-gray-700">
            {isDragging ? 'Drop your file here' : 'Drag & drop your file here'}
          </p>
          <p className="text-xs text-gray-500 mt-1">or click to browse</p>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>

      {/* Selected File Preview */}
      {selectedFile && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-start gap-3 min-w-0">
              <FileText className="h-5 w-5 shrink-0 text-gray-400" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 break-words">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedFile(null)}
              className="p-1 text-gray-400 hover:text-red-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              className="w-full sm:flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {isUploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      )}

      {/* Documents List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="space-y-2 p-3 md:p-6">
          {documents.map((doc) => (
            <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-start gap-3 min-w-0">
                <FileText className="h-5 w-5 shrink-0 text-gray-400" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 break-words">{doc.originalName}</p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(doc.size)} • {doc.mimeType} • {new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                  {doc.description && (
                    <p className="text-xs text-gray-600 mt-0.5">{doc.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => handlePreview(doc)}
                  className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                  title="Preview"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  onClick={() => documentApi.download(clientId, doc.id, doc.originalName)}
                  className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </button>
                {onDelete && (
                  <button
                    onClick={() => onDelete(doc.id)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {documents.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>No documents yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3 md:p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="flex items-start justify-between gap-3 p-3 md:p-4 border-b border-gray-200">
              <h3 className="text-base md:text-lg font-medium text-gray-900 break-words min-w-0">{previewDoc.originalName}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => documentApi.download(clientId, previewDoc.id, previewDoc.originalName)}
                  className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Download className="h-4 w-4" />
                  Download
                </button>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-4">
              {getPreviewContent(previewDoc)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
