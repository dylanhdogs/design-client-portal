import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { documentApi } from '../../api';
import { Document } from '../../types';
import DocumentUpload from '../../components/DocumentUpload';

export default function ClientDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clientId, setClientId] = useState('');

  useEffect(() => {
    if (user?.clientId) {
      setClientId(user.clientId);
      loadDocuments(user.clientId);
    }
  }, [user]);

  const loadDocuments = async (cid: string) => {
    try {
      const res = await documentApi.getAll(cid);
      setDocuments(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Documents</h1>
      {clientId && (
        <DocumentUpload
          clientId={clientId}
          documents={documents}
          onUploadComplete={() => loadDocuments(clientId)}
          onDelete={async (docId) => {
            if (confirm('Delete this document?')) {
              await documentApi.delete(clientId, docId);
              loadDocuments(clientId);
            }
          }}
        />
      )}
    </div>
  );
}
