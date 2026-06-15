import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { poolProjectApi } from '../../api';
import { PoolProject } from '../../types';
import PhaseProgressBar from '../../components/PhaseProgressBar';
import { Briefcase, FileText, MessageSquare, Clock, AlertCircle } from 'lucide-react';

export default function ClientDashboard() {
  const [project, setProject] = useState<PoolProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadProject();
  }, []);

  const loadProject = async () => {
    try {
      const res = await poolProjectApi.getMyProject();
      setProject(res.data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('No pool project found for your account. Please contact your project manager.');
      } else {
        setError('Failed to load project data.');
      }
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

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
        <p className="text-gray-500">{error}</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <Briefcase className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p className="text-gray-500">No project data available.</p>
      </div>
    );
  }

  const completedPhases = project.phases?.filter((p: { status: string }) => p.status === 'COMPLETED').length || 0;
  const totalPhases = project.phases?.length || 6;
  const currentPhase = project.phases?.find((p: { status: string }) => p.status === 'IN_PROGRESS');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Pool Project</h1>
        <p className="text-gray-500 mt-1">Track your pool construction progress</p>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        {project.phases && (
          <PhaseProgressBar
            currentPhase={project.currentPhase}
            phases={project.phases}
            interactive
            onPhaseClick={(order: number) => {
              const phase = project.phases?.find((p: { order: number }) => p.order === order);
              if (phase) navigate(`/my-project/phase/${phase.id}`);
            }}
          />
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Progress</p>
              <p className="text-3xl font-bold text-gray-900">
                {completedPhases}/{totalPhases}
              </p>
              <p className="text-sm text-gray-500">Phases completed</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <Clock className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Current Phase</p>
              <p className="text-lg font-bold text-blue-600">
                {currentPhase?.displayName || project.status}
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Briefcase className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Project Type</p>
              <p className="text-lg font-bold text-gray-900">
                {project.poolType || 'Not specified'}
              </p>
            </div>
            <div className="p-3 bg-gray-100 rounded-lg">
              <FileText className="h-6 w-6 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Project Details */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Pool Specifications</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Type</span>
                <span className="text-gray-900">{project.poolType || 'Not specified'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Shape</span>
                <span className="text-gray-900">{project.poolShape || 'Not specified'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Dimensions</span>
                <span className="text-gray-900">{project.dimensions || 'Not specified'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Budget</span>
                <span className="text-gray-900">{project.estimatedBudget || 'Not specified'}</span>
              </div>
            </div>
          </div>
          {project.notes && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Project Notes</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{project.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/my-documents')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <FileText className="h-4 w-4" />
            Upload Document
          </button>
          <button
            onClick={() => navigate('/my-communications')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <MessageSquare className="h-4 w-4" />
            Log Communication
          </button>
        </div>
      </div>
    </div>
  );
}
