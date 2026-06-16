import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { clientApi } from '../api';
import { Client } from '../types';
import { Plus, Search, Users, Trash2, Edit } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    loadClients();
  }, [status, search]);

  const loadClients = async () => {
    try {
      setIsLoading(true);
      const res = await clientApi.getAll({
        status: status || undefined,
        search: search || undefined
      });
      setClients(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client? This action cannot be undone.')) return;
    try {
      await clientApi.delete(id);
      setClients(clients.filter(c => c.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const getPhaseColor = (status?: string) => {
    if (status === 'COMPLETED') return 'bg-green-100 text-green-800';
    if (status === 'IN_PROGRESS') return 'bg-blue-100 text-blue-800';
    if (status === 'NOT_STARTED') return 'bg-gray-100 text-gray-700';
    return 'bg-amber-100 text-amber-800';
  };

  const getCurrentPhase = (client: Client) => {
    const phases = client.poolProject?.phases || [];
    const currentPhase = phases.find((phase) => phase.order === client.poolProject?.currentPhase)
      || phases.find((phase) => phase.status === 'IN_PROGRESS');

    if (!client.poolProject) {
      return { label: 'No project', status: undefined };
    }

    if (!currentPhase) {
      return { label: client.poolProject.status || 'Project created', status: undefined };
    }

    return { label: currentPhase.displayName, status: currentPhase.status };
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 mt-1">Manage your client relationships</p>
        </div>
        <Link
          to="/clients/new"
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add Client</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
          >
            <option value="">All Client Statuses</option>
            <option value="LEAD">Lead</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
          <div className="md:hidden divide-y divide-gray-200">
            {clients.map((client) => {
              const currentPhase = getCurrentPhase(client);

              return (
              <div key={client.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-sm">
                      {client.name[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <Link
                        to={`/clients/${client.id}`}
                        className="font-medium text-gray-900 hover:text-blue-600 break-words"
                      >
                        {client.name}
                      </Link>
                      <p className="text-sm text-gray-500 break-words">{client.company || 'No company'}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-sm text-gray-500 space-y-1">
                  <p className="break-words"><span className="font-medium text-gray-700">Project Address:</span> {client.address || 'No address'}</p>
                  <p><span className="font-medium text-gray-700">Phase:</span> <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getPhaseColor(currentPhase.status)}`}>{currentPhase.label}</span></p>
                  <p className="break-all">{client.email || 'No email'}</p>
                  <p>{client.phone || 'No phone'}</p>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span title="Consultations">📋 {client._count?.consultations || 0}</span>
                    <span title="Documents">📄 {client._count?.documents || 0}</span>
                    <span title="Communications">💬 {client._count?.communications || 0}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      to={`/clients/${client.id}/edit`}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                      aria-label={`Edit ${client.name}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Link>
                    {user?.role === 'ADMIN' && (
                      <button
                        onClick={() => handleDelete(client.id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        aria-label={`Delete ${client.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
            {clients.length === 0 && (
              <div className="text-center py-10 px-4 text-gray-500">
                <Users className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p>No clients found</p>
                <p className="text-sm mt-1">Try adjusting your search or filters</p>
              </div>
            )}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phase</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activities</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {clients.map((client) => {
                  const currentPhase = getCurrentPhase(client);

                  return (
                  <tr key={client.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-sm">
                          {client.name[0].toUpperCase()}
                        </div>
                        <div>
                          <Link
                            to={`/clients/${client.id}`}
                            className="font-medium text-gray-900 hover:text-blue-600"
                          >
                            {client.name}
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{client.company || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                      <span className="line-clamp-2">{client.address || '-'}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div>{client.email || '-'}</div>
                      <div>{client.phone || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPhaseColor(currentPhase.status)}`}>
                        {currentPhase.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="flex items-center gap-3">
                        <span title="Consultations">📋 {client._count?.consultations || 0}</span>
                        <span title="Documents">📄 {client._count?.documents || 0}</span>
                        <span title="Communications">💬 {client._count?.communications || 0}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/clients/${client.id}/edit`}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                        {user?.role === 'ADMIN' && (
                          <button
                            onClick={() => handleDelete(client.id)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {clients.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <Users className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p>No clients found</p>
                      <p className="text-sm mt-1">Try adjusting your search or filters</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
