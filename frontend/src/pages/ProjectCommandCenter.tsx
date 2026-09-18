import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Circle, Clock3, Plus, ShieldCheck, Users } from 'lucide-react';
import { authApi, getApiErrorMessage, toIsoDateTime, workflowApi } from '../api';
import { CommandCenter, Decision, User, WorkItem } from '../types';
import { useAuth } from '../context/AuthContext';

const stageLabels: Record<string, string> = {
  INQUIRY: 'Inquiry', DESIGN: 'Design', COMPLIANCE: 'Compliance',
  PRE_CONSTRUCTION: 'Pre-Construction', PROCUREMENT: 'Procurement',
};

const legacyStageMap: Record<string, string[]> = {
  INQUIRY: ['INTAKE'], DESIGN: ['SITE_EVALUATION', 'DESIGN'],
  COMPLIANCE: ['CONTRACT'], PRE_CONSTRUCTION: ['PROPOSAL', 'PRE_CONSTRUCTION'], PROCUREMENT: [],
};

const terminalWorkStatuses = ['VERIFIED', 'CLOSED', 'CANCELLED'];

export default function ProjectCommandCenter() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user: currentUser } = useAuth();
  const [data, setData] = useState<CommandCenter | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [showActionForm, setShowActionForm] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [actionForm, setActionForm] = useState({ title: '', stage: 'INQUIRY', priority: 'NORMAL', dueAt: '', clientVisible: false });
  const [assignmentForm, setAssignmentForm] = useState({ userId: '', scope: 'PROJECT_OWNER' });
  const [overrideForm, setOverrideForm] = useState({ reason: '', risk: '', mitigation: '', ownerId: '', dueAt: '' });

  const load = async () => {
    if (!projectId) return;
    try {
      setLoading(true); setError(''); setPermissionDenied(false);
      const [center, userResult] = await Promise.all([
        workflowApi.getCommandCenter(projectId),
        authApi.getUsers().catch(() => ({ data: [] })),
      ]);
      setData(center.data);
      setUsers((userResult.data.data || userResult.data || []).filter((user: User) => user.active));
      setActionForm((current) => ({ ...current, stage: center.data.project.currentLifecycleStage || 'INQUIRY' }));
    } catch (err: any) {
      setPermissionDenied(err?.response?.status === 403);
      setError(getApiErrorMessage(err, 'The project command center could not be loaded.'));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [projectId]);

  const openActions = useMemo(() => data?.openWorkItems.filter((item) => !terminalWorkStatuses.includes(item.status)) || [], [data]);
  const pendingDecisions = useMemo(() => data?.pendingDecisions.filter((item) => !['APPROVED', 'REJECTED', 'CANCELLED'].includes(item.status)) || [], [data]);

  const mutate = async (operation: () => Promise<unknown>) => {
    try { setSaving(true); setError(''); await operation(); await load(); }
    catch (err) { setError(getApiErrorMessage(err, 'The requested change could not be saved.')); }
    finally { setSaving(false); }
  };

  const createAction = (event: FormEvent) => {
    event.preventDefault();
    mutate(async () => {
      await workflowApi.createWorkItem(projectId!, { ...actionForm, dueAt: toIsoDateTime(actionForm.dueAt) });
      setShowActionForm(false);
      setActionForm((current) => ({ ...current, title: '', dueAt: '', clientVisible: false }));
    });
  };

  const createAssignment = (event: FormEvent) => {
    event.preventDefault();
    mutate(async () => { await workflowApi.createAssignment(projectId!, assignmentForm); setShowAssignmentForm(false); });
  };

  const submitOverride = (event: FormEvent) => {
    event.preventDefault();
    if (!data?.currentGate) return;
    mutate(async () => {
      await workflowApi.overrideStage(projectId!, data.currentGate!.fromStage, {
        ...overrideForm,
        dueAt: toIsoDateTime(overrideForm.dueAt),
        expectedVersion: data.project.workflowVersion || 0,
      });
      setShowOverrideForm(false);
    });
  };

  const decide = (decision: Decision, approved: boolean) => {
    if (approved) {
      const options = JSON.parse(decision.optionsJson || '[]') as string[];
      const selectedOption = window.prompt(`Select an option:\n${options.join('\n')}`, options[0] || '');
      if (!selectedOption) return;
      mutate(() => workflowApi.approveDecision(decision.id, { selectedOption }));
    } else {
      const comment = window.prompt('Rejection reason');
      if (!comment) return;
      mutate(() => workflowApi.rejectDecision(decision.id, { comment }));
    }
  };

  if (loading) return <div className="min-h-[50vh] flex items-center justify-center" aria-live="polite"><div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" /><span className="sr-only">Loading project command center</span></div>;
  if (permissionDenied) return <StatePanel title="Permission denied" message={error} />;
  if (!data) return <StatePanel title="Project unavailable" message={error || 'No workflow data is available for this project.'} />;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link to={`/clients/${data.client.id}?tab=poolProject`} className="inline-flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900"><ArrowLeft className="h-4 w-4" />Back to client</Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-950">{data.client.name} · Project command center</h1>
          <p className="mt-1 text-sm text-gray-600">Lifecycle work, project phases, approvals, blockers, and accountable ownership in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.receptionInquiry && <Link to={`/inquiries?inquiryId=${data.receptionInquiry.id}`} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:border-blue-400 hover:text-blue-700">Reception record</Link>}
          <Link to={`/clients/${data.client.id}/status-report?projectId=${projectId}`} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Daily status report</Link>
          <Link to={`/projects/${projectId}/design`} className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-900">Design workspace</Link>
          <Link to={`/projects/${projectId}/compliance`} className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900">Compliance register</Link>
          <Link to={`/projects/${projectId}/preconstruction`} className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900">Readiness review</Link>
          <Link to={`/projects/${projectId}/procurement`} className="rounded-lg border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-900">Procurement</Link>
          <button onClick={() => setShowAssignmentForm(!showAssignmentForm)} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"><Users className="mr-2 inline h-4 w-4" />Assign team</button>
          <button onClick={() => setShowActionForm(!showActionForm)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"><Plus className="mr-2 inline h-4 w-4" />New action</button>
        </div>
      </header>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

      <section aria-label="Lifecycle stages" className="grid gap-3 md:grid-cols-5">
        {data.lifecycle.map((stage) => {
          const current = stage.stage === data.project.currentLifecycleStage;
          const phaseItems = data.legacyPhases.filter((phase) => legacyStageMap[stage.stage]?.includes(phase.name));
          return <div key={stage.id} className={`rounded-xl border p-4 ${current ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center justify-between gap-2"><h2 className="font-semibold text-gray-950">{stageLabels[stage.stage]}</h2>{stage.status === 'APPROVED' ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : current ? <Clock3 className="h-5 w-5 text-blue-600" /> : <Circle className="h-5 w-5 text-gray-300" />}</div>
            <p className="mt-2 text-xs font-medium uppercase tracking-wide text-gray-500">{stage.status.replace(/_/g, ' ')}</p>
            <div className="mt-3 space-y-1">{phaseItems.length ? phaseItems.map((phase) => <p key={phase.id} className="text-xs text-gray-600">{phase.displayName} · {phase.status.replace(/_/g, ' ')}</p>) : <p className="text-xs text-gray-400">No phase detail</p>}</div>
          </div>;
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Open actions" value={openActions.length} tone={openActions.length ? 'amber' : 'green'} />
        <Metric label="Pending decisions" value={pendingDecisions.length} tone={pendingDecisions.length ? 'amber' : 'green'} />
        <Metric label="Gate blockers" value={data.blockers.length} tone={data.blockers.length ? 'red' : 'green'} />
        <Metric label="Team assignments" value={data.assignments.length} tone="blue" />
      </section>

      {showActionForm && <form onSubmit={createAction} className="grid gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 md:grid-cols-5">
        <label className="md:col-span-2 text-sm font-medium">Action title<input required value={actionForm.title} onChange={(e) => setActionForm({ ...actionForm, title: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2" /></label>
        <label className="text-sm font-medium">Priority<select value={actionForm.priority} onChange={(e) => setActionForm({ ...actionForm, priority: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"><option>NORMAL</option><option>HIGH</option><option>URGENT</option><option>LOW</option></select></label>
        <label className="text-sm font-medium">Due date<input type="datetime-local" value={actionForm.dueAt} onChange={(e) => setActionForm({ ...actionForm, dueAt: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2" /></label>
        <div className="flex items-end gap-3"><label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={actionForm.clientVisible} onChange={(e) => setActionForm({ ...actionForm, clientVisible: e.target.checked })} />Client visible</label><button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">Save</button></div>
      </form>}

      {showAssignmentForm && <form onSubmit={createAssignment} className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-3">
        <label className="text-sm font-medium">Team member<select required value={assignmentForm.userId} onChange={(e) => setAssignmentForm({ ...assignmentForm, userId: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"><option value="">Select a team member</option>{users.filter((u) => u.role !== 'CLIENT').map((u) => <option key={u.id} value={u.id}>{u.name} · {u.role}</option>)}</select></label>
        <label className="text-sm font-medium">Responsibility<select value={assignmentForm.scope} onChange={(e) => setAssignmentForm({ ...assignmentForm, scope: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">{['PROJECT_OWNER','DESIGN_REVIEWER','COMPLIANCE_REVIEWER','READINESS_REVIEWER','PROCUREMENT_OWNER','LEADERSHIP_APPROVER'].map((scope) => <option key={scope}>{scope}</option>)}</select></label>
        <div className="flex items-end"><button disabled={saving || !assignmentForm.userId} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50">Add assignment</button></div>
      </form>}

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="xl:col-span-2 rounded-xl border border-gray-200 bg-white p-5"><h2 className="text-lg font-semibold text-gray-950">Actions and deadlines</h2><div className="mt-4 space-y-3">{openActions.length ? openActions.map((item) => <ActionRow key={item.id} item={item} saving={saving} onComplete={() => mutate(() => workflowApi.completeWorkItem(item.id))} onVerify={() => mutate(() => workflowApi.verifyWorkItem(item.id))} />) : <Empty message="No open actions. This stage has no unresolved work items." />}</div></section>
        <section className="rounded-xl border border-gray-200 bg-white p-5"><h2 className="text-lg font-semibold text-gray-950">Current gate</h2>{data.currentGate ? <div className="mt-4"><p className="text-sm font-medium">{stageLabels[data.currentGate.fromStage]} → {stageLabels[data.currentGate.toStage]}</p><p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${data.blockers.length ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{data.blockers.length ? 'BLOCKED' : 'READY'}</p><div className="mt-4 space-y-2">{data.blockers.map((blocker) => <div key={`${blocker.type}-${blocker.id}`} className="rounded-lg bg-red-50 p-3 text-sm text-red-900"><AlertTriangle className="mr-2 inline h-4 w-4" />{blocker.title}<span className="block pl-6 text-xs text-red-700">{blocker.type} · {blocker.status}</span></div>)}</div><button disabled={saving || data.blockers.length > 0} onClick={() => mutate(() => workflowApi.advanceStage(projectId!, data.currentGate!.fromStage, data.project.workflowVersion || 0))} className="mt-4 w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"><ShieldCheck className="mr-2 inline h-4 w-4" />Advance stage</button>{data.blockers.length > 0 && currentUser?.role === 'ADMIN' && <button type="button" onClick={() => setShowOverrideForm(!showOverrideForm)} className="mt-2 w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900">Controlled override</button>}{showOverrideForm && <form onSubmit={submitOverride} className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-xs text-amber-900">Overrides are audited and require explicit risk ownership.</p><textarea required minLength={10} placeholder="Business reason" value={overrideForm.reason} onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })} className="w-full rounded border border-amber-300 px-2 py-1.5 text-sm" /><textarea required placeholder="Accepted risk" value={overrideForm.risk} onChange={(e) => setOverrideForm({ ...overrideForm, risk: e.target.value })} className="w-full rounded border border-amber-300 px-2 py-1.5 text-sm" /><textarea required placeholder="Mitigation" value={overrideForm.mitigation} onChange={(e) => setOverrideForm({ ...overrideForm, mitigation: e.target.value })} className="w-full rounded border border-amber-300 px-2 py-1.5 text-sm" /><select required value={overrideForm.ownerId} onChange={(e) => setOverrideForm({ ...overrideForm, ownerId: e.target.value })} className="w-full rounded border border-amber-300 px-2 py-1.5 text-sm"><option value="">Risk owner</option>{users.filter((u) => u.role !== 'CLIENT').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select><input required type="datetime-local" value={overrideForm.dueAt} onChange={(e) => setOverrideForm({ ...overrideForm, dueAt: e.target.value })} className="w-full rounded border border-amber-300 px-2 py-1.5 text-sm" /><button disabled={saving} className="w-full rounded bg-amber-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Record override and advance</button></form>}</div> : <Empty message="This is the final configured lifecycle stage." />}</section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5"><h2 className="text-lg font-semibold text-gray-950">Pending decisions</h2><div className="mt-4 space-y-3">{pendingDecisions.length ? pendingDecisions.map((decision) => <div key={decision.id} className="rounded-lg border border-gray-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-gray-950">{decision.title}</p><p className="mt-1 text-xs text-gray-500">{decision.stage} · {decision.status}</p></div><div className="flex gap-2"><button onClick={() => decide(decision, true)} className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800">Approve</button><button onClick={() => decide(decision, false)} className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-800">Reject</button></div></div></div>) : <Empty message="No decisions are awaiting action." />}</div></section>
        <section className="rounded-xl border border-gray-200 bg-white p-5"><h2 className="text-lg font-semibold text-gray-950">Team ownership</h2><div className="mt-4 space-y-2">{data.assignments.length ? data.assignments.map((assignment) => <div key={assignment.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3"><div><p className="text-sm font-medium text-gray-950">{assignment.user.name}</p><p className="text-xs text-gray-500">{assignment.scope.replace(/_/g, ' ')}</p></div><button onClick={() => mutate(() => workflowApi.removeAssignment(assignment.id))} className="text-xs font-medium text-red-700 hover:text-red-900">Remove</button></div>) : <Empty message="No accountable team assignments have been made." />}</div></section>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5"><h2 className="text-lg font-semibold text-gray-950">Audit timeline</h2><div className="mt-4 space-y-4">{data.recentActivity.length ? data.recentActivity.map((event) => <div key={event.id} className="flex gap-3"><div className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-500" /><div><p className="text-sm text-gray-900"><span className="font-medium">{event.user.name}</span> {event.action.toLowerCase()} · {event.entityType}</p><p className="text-xs text-gray-500">{new Date(event.createdAt).toLocaleString()}</p></div></div>) : <Empty message="No workflow audit events have been recorded yet." />}</div></section>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: 'amber' | 'green' | 'red' | 'blue' }) {
  const colors = { amber: 'bg-amber-50 text-amber-900 border-amber-200', green: 'bg-green-50 text-green-900 border-green-200', red: 'bg-red-50 text-red-900 border-red-200', blue: 'bg-blue-50 text-blue-900 border-blue-200' };
  return <div className={`rounded-xl border p-4 ${colors[tone]}`}><p className="text-sm font-medium">{label}</p><p className="mt-1 text-3xl font-bold">{value}</p></div>;
}

function ActionRow({ item, saving, onComplete, onVerify }: { item: WorkItem; saving: boolean; onComplete: () => void; onVerify: () => void }) {
  return <div className="flex flex-col justify-between gap-3 rounded-lg border border-gray-200 p-4 sm:flex-row sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-gray-950">{item.title}</p><span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{item.priority}</span></div><p className="mt-1 text-xs text-gray-500">{stageLabels[item.stage]} · {item.status.replace(/_/g, ' ')}{item.dueAt ? ` · Due ${new Date(item.dueAt).toLocaleString()}` : ''}</p></div><div>{['READY_FOR_REVIEW', 'COMPLETED'].includes(item.status) ? <button disabled={saving} onClick={onVerify} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">Verify</button> : <button disabled={saving} onClick={onComplete} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">Complete</button>}</div></div>;
}

function Empty({ message }: { message: string }) { return <div className="rounded-lg border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">{message}</div>; }
function StatePanel({ title, message }: { title: string; message: string }) { return <div className="mx-auto mt-16 max-w-lg rounded-xl border border-gray-200 bg-white p-8 text-center"><AlertTriangle className="mx-auto h-10 w-10 text-amber-500" /><h1 className="mt-4 text-xl font-semibold text-gray-950">{title}</h1><p className="mt-2 text-sm text-gray-600">{message}</p><Link to="/clients" className="mt-5 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Return to clients</Link></div>; }
