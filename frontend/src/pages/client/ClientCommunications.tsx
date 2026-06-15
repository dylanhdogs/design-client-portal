import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { communicationApi } from '../../api';
import { Communication } from '../../types';
import { MessageSquare, Mail, Phone, User, Send } from 'lucide-react';

export default function ClientCommunications() {
  const { user } = useAuth();
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState({
    type: 'EMAIL' as string,
    subject: '',
    body: '',
    direction: 'OUTBOUND' as string
  });
  const [clientId, setClientId] = useState('');

  useEffect(() => {
    if (user?.clientId) {
      setClientId(user.clientId);
      loadCommunications(user.clientId);
    }
  }, [user]);

  const loadCommunications = async (cid: string) => {
    try {
      const res = await communicationApi.getAll(cid);
      setCommunications(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !form.body.trim()) return;

    try {
      await communicationApi.create(clientId, form);
      setForm({ type: 'EMAIL', subject: '', body: '', direction: 'OUTBOUND' });
      loadCommunications(clientId);
    } catch (err) {
      console.error(err);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'EMAIL': return <Mail className="h-4 w-4" />;
      case 'PHONE': return <Phone className="h-4 w-4" />;
      case 'IN_PERSON': return <User className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Communications</h1>

      {/* Add Communication Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="EMAIL">Email</option>
              <option value="PHONE">Phone</option>
              <option value="IN_PERSON">In Person</option>
              <option value="SMS">SMS</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Direction</label>
            <select
              value={form.direction}
              onChange={(e) => setForm({ ...form, direction: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="OUTBOUND">Outbound</option>
              <option value="INBOUND">Inbound</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            required
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!form.body.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Log Communication
          </button>
        </div>
      </form>

      {/* Communications List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          communications.map((comm) => (
            <div key={comm.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getTypeIcon(comm.type)}
                  <span className="text-sm font-medium text-gray-900">{comm.type}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    comm.direction === 'OUTBOUND' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {comm.direction}
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  {new Date(comm.date).toLocaleString()}
                </span>
              </div>
              {comm.subject && (
                <p className="text-sm font-medium text-gray-800 mb-1">{comm.subject}</p>
              )}
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{comm.body}</p>
              <div className="text-xs text-gray-400 mt-2">
                By {comm.user?.name}
              </div>
            </div>
          ))
        )}
        {!isLoading && communications.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p>No communications yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
