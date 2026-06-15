import { useEffect, useState } from 'react';

import { poolProjectApi, poolNoteApi } from '../../api';
import { PoolProject, ProjectPhase, PoolNote } from '../../types';
import PhaseProgressBar from '../../components/PhaseProgressBar';
import { AlertCircle, CheckCircle, Circle, Clock, Send, User } from 'lucide-react';

export default function MyProject() {
  const [project, setProject] = useState<PoolProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [newNote, setNewNote] = useState('');
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);

  useEffect(() => {
    loadProject();
  }, []);

  const loadProject = async () => {
    try {
      const res = await poolProjectApi.getMyProject();
      setProject(res.data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('No pool project found. Please contact your project manager.');
      } else {
        setError('Failed to load project data.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !newNote.trim()) return;

    try {
      await poolNoteApi.create(project.clientId, { content: newNote });
      setNewNote('');
      loadProject();
    } catch (err) {
      console.error(err);
    }
  };

  const togglePhase = (phaseId: string) => {
    setExpandedPhase(expandedPhase === phaseId ? null : phaseId);
  };

  const getStatusIcon = (status: string) => {
    if (status === 'COMPLETED') return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (status === 'IN_PROGRESS') return <Clock className="h-5 w-5 text-blue-500" />;
    return <Circle className="h-5 w-5 text-gray-300" />;
  };

  const getStatusColor = (status: string) => {
    if (status === 'COMPLETED') return 'bg-green-100 text-green-800';
    if (status === 'IN_PROGRESS') return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
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

  if (!project) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Project Details</h1>

      {/* Progress Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        {project.phases && (
          <PhaseProgressBar currentPhase={project.currentPhase} phases={project.phases} />
        )}
      </div>

      {/* Phases */}
      <div className="space-y-4 mb-6">
        {project.phases?.map((phase: ProjectPhase) => (
          <div key={phase.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <button
              onClick={() => togglePhase(phase.id)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(phase.status)}
                <div className="text-left">
                  <h3 className="font-medium text-gray-900">
                    Phase {phase.order}: {phase.displayName}
                  </h3>
                  {phase.description && (
                    <p className="text-sm text-gray-500">{phase.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(phase.status)}`}>
                  {phase.status.replace('_', ' ')}
                </span>
              </div>
            </button>

            {expandedPhase === phase.id && (
              <div className="px-6 pb-4 border-t border-gray-100">
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Checklist</h4>
                  {phase.checklistItems?.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 py-2">
                      <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center ${
                        item.isCompleted ? 'bg-green-500 border-green-500' : 'border-gray-300'
                      }`}>
                        {item.isCompleted && <CheckCircle className="h-3 w-3 text-white" />}
                      </div>
                      <span className={`text-sm ${item.isCompleted ? 'text-gray-500 line-through' : 'text-gray-700'}`}>
                        {item.description}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Notes Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Notes</h2>

        <form onSubmit={handleAddNote} className="mb-4">
          <div className="flex items-center gap-3">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note..."
              rows={2}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
            <button
              type="submit"
              disabled={!newNote.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              Add
            </button>
          </div>
        </form>

        <div className="space-y-3">
          {project.poolNotes?.map((note: PoolNote) => (
            <div key={note.id} className="border border-gray-100 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                  <User className="h-3 w-3" />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-900">{note.user?.name}</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-500">{new Date(note.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
            </div>
          ))}
          {(!project.poolNotes || project.poolNotes.length === 0) && (
            <div className="text-center py-6 text-gray-500 text-sm">
              No notes yet. Add one above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
