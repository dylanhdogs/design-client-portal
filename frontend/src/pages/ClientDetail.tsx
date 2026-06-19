import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { clientApi, consultationApi, documentApi, communicationApi, poolProjectApi, clientUserApi, phaseApi } from '../api';
import { Client, Consultation, Communication, ProjectPhase, ChecklistItem } from '../types';
import { useAuth } from '../context/AuthContext';
import CreateLoginForm from '../components/CreateLoginForm';
import InviteClientForm from '../components/InviteClientForm';
import PhaseProgressBar from '../components/PhaseProgressBar';
import DocumentUpload from '../components/DocumentUpload';
import PhaseCompletionCircle from '../components/PhaseCompletionCircle';
import {
  ArrowLeft, Edit, Trash2, Calendar, FileText, MessageSquare,
  Plus, Phone, Mail, User,
  AlertCircle, CheckCircle, Clock, XCircle, Briefcase, UserPlus
} from 'lucide-react';

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'consultations' | 'documents' | 'communications' | 'poolProject'>('consultations');
  const [error, setError] = useState('');
  const [showCreateLogin, setShowCreateLogin] = useState(false);
  const [showInviteClient, setShowInviteClient] = useState(false);
  const [hasLogin, setHasLogin] = useState(false);

  // Consultation form
  const [showConsultationForm, setShowConsultationForm] = useState(false);
  const [consultationForm, setConsultationForm] = useState({
    title: '',
    date: '',
    notes: '',
    status: 'SCHEDULED' as string
  });

  // Communication form
  const [showCommunicationForm, setShowCommunicationForm] = useState(false);
  const [communicationForm, setCommunicationForm] = useState({
    type: 'EMAIL' as string,
    subject: '',
    body: '',
    direction: 'OUTBOUND' as string
  });

  useEffect(() => {
    if (id) {
      loadClient();
    }
  }, [id]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'consultations' || tab === 'documents' || tab === 'communications' || tab === 'poolProject') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    const itemId = searchParams.get('item');

    if (itemId && activeTab === 'poolProject') {
      window.setTimeout(() => {
        document.getElementById(`admin-checklist-item-${itemId}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }, 100);
    }
  }, [searchParams, activeTab, client]);

  const loadClient = async () => {
    try {
      setIsLoading(true);
      const res = await clientApi.getById(id!);
      setClient(res.data);
      
      // Check if client has a login account
      try {
        const loginRes = await clientUserApi.getLoginInfo(id!);
        setHasLogin(!!loginRes.data);
      } catch {
        setHasLogin(false);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load client details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this client? This action cannot be undone.')) return;
    try {
      await clientApi.delete(id!);
      navigate('/clients');
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await consultationApi.create(id!, {
        ...consultationForm,
        date: new Date(consultationForm.date).toISOString()
      });
      setShowConsultationForm(false);
      setConsultationForm({ title: '', date: '', notes: '', status: 'SCHEDULED' });
      loadClient();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddCommunication = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await communicationApi.create(id!, communicationForm);
      setShowCommunicationForm(false);
      setCommunicationForm({ type: 'EMAIL', subject: '', body: '', direction: 'OUTBOUND' });
      loadClient();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreatePoolProject = async () => {
    try {
      await poolProjectApi.create(id!, {
        poolType: 'In-Ground',
        notes: 'New pool project created'
      });
      loadClient();
    } catch (err) {
      console.error(err);
    }
  };

  const handleVerifyChecklistItem = async (phaseId: string, itemId: string, approved: boolean) => {
    if (!client) return;

    const rejectionReason = approved ? undefined : prompt('Why is this checklist item not approved?') || 'Not approved. Please revisit and resubmit.';

    try {
      await phaseApi.verifyChecklist(client.id, phaseId, itemId, { approved, rejectionReason });
      loadClient();
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'LEAD': return 'bg-yellow-100 text-yellow-800';
      case 'INACTIVE': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConsultationStatusIcon = (status: string) => {
    switch (status) {
      case 'SCHEDULED': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'COMPLETED': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'CANCELLED': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getCommunicationTypeIcon = (type: string) => {
    switch (type) {
      case 'EMAIL': return <Mail className="h-4 w-4" />;
      case 'PHONE': return <Phone className="h-4 w-4" />;
      case 'IN_PERSON': return <User className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const countBusinessDays = (startDate: string, endDate: Date = new Date()) => {
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) return 0;

    const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    let count = 0;

    while (current <= end) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) {
        count += 1;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  };

  const getInProgressBusinessDays = (phase: ProjectPhase) => {
    if (phase.status !== 'IN_PROGRESS') return null;
    const startedAt = phase.startDate || phase.createdAt;
    return countBusinessDays(startedAt);
  };

  const getChecklistStatus = (item: ChecklistItem) => {
    if (item.isCompleted || item.verificationStatus === 'APPROVED') {
      return { label: 'Approved', color: 'bg-green-100 text-green-800' };
    }
    if (item.verificationStatus === 'SUBMITTED') {
      return { label: 'Submitted', color: 'bg-blue-100 text-blue-800' };
    }
    if (item.verificationStatus === 'REJECTED') {
      return { label: 'Rejected', color: 'bg-red-100 text-red-800' };
    }
    return { label: 'Not submitted', color: 'bg-gray-100 text-gray-700' };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
        <p className="text-gray-500">Client not found</p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
          <button
            onClick={() => navigate('/clients')}
            className="self-start p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 break-words">{client.name}</h1>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(client.status)}`}>
                {client.status}
              </span>
            </div>
            <p className="text-gray-500 mt-1">
              {client.company && <span className="mr-3">{client.company}</span>}
              {client.email && <span className="mr-3">{client.email}</span>}
              {client.phone && <span>{client.phone}</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {!client.poolProject && (
              <button
                onClick={handleCreatePoolProject}
                className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Briefcase className="h-4 w-4" />
                <span>Create Pool Project</span>
              </button>
            )}
            {!hasLogin && (
              <button
                onClick={() => setShowCreateLogin(true)}
                className="flex items-center gap-2 px-3 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                <span>Create Client Login</span>
              </button>
            )}
            {!hasLogin && (
              <button
                onClick={() => setShowInviteClient(true)}
                className="flex items-center gap-2 px-3 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                <span>Invite Client</span>
              </button>
            )}
            <Link
              to={`/clients/${client.id}/edit`}
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Edit className="h-4 w-4" />
              <span>Edit</span>
            </Link>
            {user?.role === 'ADMIN' && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Client Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Contact Information</h3>
            <div className="space-y-2">
              {client.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span>{client.email}</span>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span>{client.phone}</span>
                </div>
              )}
              {client.address && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-gray-400" />
                  <span>{client.address}</span>
                </div>
              )}
            </div>
          </div>
          {client.notes && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Notes</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 overflow-x-auto">
          <div className="flex min-w-max">
            <button
              onClick={() => setActiveTab('consultations')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'consultations'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Consultations ({client.consultations?.length || 0})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'documents'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documents ({client.documents?.length || 0})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('communications')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'communications'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Communications ({client.communications?.length || 0})
              </div>
            </button>
            {client.poolProject && (
              <button
                onClick={() => setActiveTab('poolProject')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'poolProject'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Pool Project
                </div>
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          {/* Consultations Tab */}
          {activeTab === 'consultations' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Consultations</h3>
                <button
                  onClick={() => setShowConsultationForm(!showConsultationForm)}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Consultation
                </button>
              </div>

              {showConsultationForm && (
                <form onSubmit={handleAddConsultation} className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                      <input
                        type="text"
                        value={consultationForm.title}
                        onChange={(e) => setConsultationForm({ ...consultationForm, title: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                      <input
                        type="datetime-local"
                        value={consultationForm.date}
                        onChange={(e) => setConsultationForm({ ...consultationForm, date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={consultationForm.notes}
                      onChange={(e) => setConsultationForm({ ...consultationForm, notes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowConsultationForm(false)}
                      className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Save
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                {client.consultations?.map((consultation: Consultation) => (
                  <div key={consultation.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getConsultationStatusIcon(consultation.status)}
                        <h4 className="font-medium text-gray-900">{consultation.title}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          consultation.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700' :
                          consultation.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {consultation.status}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(consultation.date).toLocaleString()}
                      </span>
                    </div>
                    {consultation.notes && (
                      <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{consultation.notes}</p>
                    )}
                    <div className="text-xs text-gray-400 mt-2">
                      By {consultation.user?.name}
                    </div>
                  </div>
                ))}
                {(!client.consultations || client.consultations.length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p>No consultations yet</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && client && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Documents</h3>
              </div>
              <DocumentUpload
                clientId={client.id}
                documents={client.documents || []}
                onUploadComplete={() => loadClient()}
                onDelete={async (docId) => {
                  if (confirm('Delete this document?')) {
                    await documentApi.delete(client.id, docId);
                    loadClient();
                  }
                }}
              />
            </div>
          )}

          {/* Communications Tab */}
          {activeTab === 'communications' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Communications</h3>
                <button
                  onClick={() => setShowCommunicationForm(!showCommunicationForm)}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Log Communication
                </button>
              </div>

              {showCommunicationForm && (
                <form onSubmit={handleAddCommunication} className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                      <select
                        value={communicationForm.type}
                        onChange={(e) => setCommunicationForm({ ...communicationForm, type: e.target.value })}
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
                        value={communicationForm.direction}
                        onChange={(e) => setCommunicationForm({ ...communicationForm, direction: e.target.value })}
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
                        value={communicationForm.subject}
                        onChange={(e) => setCommunicationForm({ ...communicationForm, subject: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
                    <textarea
                      value={communicationForm.body}
                      onChange={(e) => setCommunicationForm({ ...communicationForm, body: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      required
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCommunicationForm(false)}
                      className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Save
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                {client.communications?.map((comm: Communication) => (
                  <div key={comm.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getCommunicationTypeIcon(comm.type)}
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
                ))}
                {(!client.communications || client.communications.length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p>No communications yet</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pool Project Tab */}
          {activeTab === 'poolProject' && client.poolProject && (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Pool Project</h3>
                
                {/* Progress Bar */}
                <div className="mb-6">
                  <PhaseProgressBar
                    currentPhase={client.poolProject.currentPhase}
                    phases={client.poolProject.phases || []}
                  />
                </div>
                
                {/* Project Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Project Details</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Type</span>
                        <span className="text-gray-900">{client.poolProject.poolType || 'Not specified'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Shape</span>
                        <span className="text-gray-900">{client.poolProject.poolShape || 'Not specified'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Dimensions</span>
                        <span className="text-gray-900">{client.poolProject.dimensions || 'Not specified'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Budget</span>
                        <span className="text-gray-900">{client.poolProject.estimatedBudget || 'Not specified'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Phase Status</h4>
                    <div className="space-y-2">
                      {client.poolProject.phases?.map((phase) => {
                        const businessDays = getInProgressBusinessDays(phase);

                        return (
                          <div key={phase.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <PhaseCompletionCircle items={phase.checklistItems} size="sm" />
                              <span className="text-sm text-gray-700">{phase.displayName}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {businessDays !== null && (
                                <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800">
                                  {businessDays} business {businessDays === 1 ? 'day' : 'days'}
                                </span>
                              )}
                              <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
                                phase.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                phase.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {phase.status}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                
                {/* Phases with Checklist */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-700">Phase Checklists</h4>
                  {client.poolProject.phases?.map((phase) => {
                    const businessDays = getInProgressBusinessDays(phase);

                    return (
                    <div key={phase.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <PhaseCompletionCircle items={phase.checklistItems} size="sm" />
                          <h5 className="font-medium text-gray-900">{phase.displayName}</h5>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {businessDays !== null && (
                            <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800">
                              {businessDays} business {businessDays === 1 ? 'day' : 'days'} in progress
                            </span>
                          )}
                          <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
                            phase.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                            phase.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {phase.status}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {phase.checklistItems?.map((item) => {
                          const itemStatus = getChecklistStatus(item);

                          return (
                          <div
                            id={`admin-checklist-item-${item.id}`}
                            key={item.id}
                            className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 rounded-lg p-2 scroll-mt-24 ${searchParams.get('item') === item.id ? 'bg-amber-50 ring-1 ring-amber-200' : ''}`}
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center ${
                                item.isCompleted ? 'bg-green-500 border-green-500' : 'border-gray-300'
                              }`}>
                                {item.isCompleted && <CheckCircle className="h-3 w-3 text-white" />}
                              </div>
                              <div className="min-w-0">
                                <span className={`text-sm ${item.isCompleted ? 'text-gray-500 line-through' : 'text-gray-700'}`}>
                                  {item.description}
                                </span>
                                {item.rejectionReason && (
                                  <p className="mt-1 text-xs text-red-600">Rejection note: {item.rejectionReason}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                              <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${itemStatus.color}`}>
                                {itemStatus.label}
                              </span>
                              {item.verificationStatus === 'SUBMITTED' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleVerifyChecklistItem(phase.id, item.id, true)}
                                    className="px-3 py-1 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleVerifyChecklistItem(phase.id, item.id, false)}
                                    className="px-3 py-1 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Create Login Modal */}
      {showCreateLogin && (
        <CreateLoginForm
          clientId={client.id}
          clientName={client.name}
          onSuccess={() => {
            setShowCreateLogin(false);
            setHasLogin(true);
            loadClient();
          }}
          onCancel={() => setShowCreateLogin(false)}
        />
      )}

      {/* Invite Client Modal */}
      {showInviteClient && (
        <InviteClientForm
          clientId={client.id}
          onCancel={() => setShowInviteClient(false)}
        />
      )}
    </div>
  );
}
