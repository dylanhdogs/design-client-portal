import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { clientApi } from '../api';
import { Client } from '../types';
import { Users, FileText, MessageSquare, Calendar, ArrowRight } from 'lucide-react';

export default function Dashboard() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    leads: 0,
    inactive: 0
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const res = await clientApi.getAll();
      setClients(res.data);
      const data = res.data;
      setStats({
        total: data.length,
        active: data.filter((c: Client) => c.status === 'ACTIVE').length,
        leads: data.filter((c: Client) => c.status === 'LEAD').length,
        inactive: data.filter((c: Client) => c.status === 'INACTIVE').length
      });
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Total Clients</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Active</p>
              <p className="text-3xl font-bold text-green-600">{stats.active}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <Users className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Leads</p>
              <p className="text-3xl font-bold text-yellow-600">{stats.leads}</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <Users className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Inactive</p>
              <p className="text-3xl font-bold text-gray-400">{stats.inactive}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded-lg">
              <Users className="h-6 w-6 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Clients */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Clients</h2>
          <Link
            to="/clients"
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="divide-y divide-gray-200">
          {clients.slice(0, 5).map((client) => (
            <Link
              key={client.id}
              to={`/clients/${client.id}`}
              className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold">
                  {client.name[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{client.name}</p>
                  <p className="text-sm text-gray-500">
                    {client.company || 'No company'} • {client.status}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {client._count?.consultations || 0}
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  {client._count?.documents || 0}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" />
                  {client._count?.communications || 0}
                </span>
              </div>
            </Link>
          ))}
          {clients.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-500">
              No clients yet. <Link to="/clients/new" className="text-blue-600 hover:text-blue-700">Add your first client</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
