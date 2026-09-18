import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileSpreadsheet, FileText, RefreshCw, ShieldAlert } from 'lucide-react';
import { clientStatusReportApi, getApiErrorMessage } from '../api';
import { ClientStatusReport } from '../types';

const human = (value: string | null | undefined) => value ? value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not recorded';
const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const stateStyle: Record<string, string> = { ON_TRACK: 'border-emerald-200 bg-emerald-50 text-emerald-900', ATTENTION_REQUIRED: 'border-amber-200 bg-amber-50 text-amber-950', BLOCKED: 'border-red-200 bg-red-50 text-red-950', NO_ACTIVE_WORK: 'border-slate-200 bg-slate-50 text-slate-800' };
const responsibilityStyle: Record<string, string> = { CLIENT: 'bg-blue-100 text-blue-800', INTERNAL: 'bg-slate-100 text-slate-800', EXTERNAL: 'bg-violet-100 text-violet-800', LEADERSHIP: 'bg-amber-100 text-amber-900' };

export default function ClientStatusReportPage() {
  const { id: clientId } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const projectId = params.get('projectId');
  const inquiryId = params.get('inquiryId');
  const [asOfDate] = useState(today());
  const [report, setReport] = useState<ClientStatusReport | null>(null);
  const [history, setHistory] = useState<ClientStatusReport[]>([]);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!clientId) return;
    clientStatusReportApi.list(clientId).then((result) => { setHistory(result.data.data); if (!projectId && !inquiryId && result.data.data[0]) setReport(result.data.data[0]); }).catch(() => undefined);
  }, [clientId, inquiryId, projectId]);

  const generate = async (forceRefresh = false) => {
    if (!clientId || (!projectId && !inquiryId)) { setError('Open this report from an inquiry or project so the correct records can be included.'); return; }
    try {
      setBusy(true); setError('');
      const result = await clientStatusReportApi.generate(clientId, { projectId, inquiryId, asOfDate, forceRefresh });
      setReport(result.data);
      setHistory((current) => [result.data, ...current.filter((item) => item.id !== result.data.id)]);
    } catch (err) { setError(getApiErrorMessage(err, 'The report could not be generated.')); }
    finally { setBusy(false); }
  };

  const download = async (format: 'pdf' | 'xlsx') => {
    if (!report || !clientId) return;
    try { setExporting(format); setError(''); await clientStatusReportApi.download(clientId, report.id, format, report.snapshot.client.name, report.asOfDate); }
    catch { setError(`The ${format === 'pdf' ? 'PDF' : 'Excel'} export could not be downloaded.`); }
    finally { setExporting(null); }
  };

  const openPrevious = async (item: ClientStatusReport) => {
    if (!clientId) return;
    try { setBusy(true); setError(''); setReport((await clientStatusReportApi.get(clientId, item.id)).data); }
    catch (err) { setError(getApiErrorMessage(err, 'The saved report could not be opened.')); }
    finally { setBusy(false); }
  };

  const snapshot = report?.snapshot;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link to={clientId ? `/clients/${clientId}` : '/clients'} className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900"><ArrowLeft className="h-4 w-4" />Back to client</Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Daily client status report</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">A saved, traceable operational snapshot for internal review. Exports always use the snapshot shown here.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Business date<input type="date" value={asOfDate} readOnly aria-readonly="true" className="mt-1 block rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-normal text-slate-700" /></label>
          <button onClick={() => generate(false)} disabled={busy || (!projectId && !inquiryId)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />{busy ? 'Generating…' : 'Generate report'}</button>
        </div>
      </header>

      {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />{error}</div>}
      {!snapshot && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><FileText className="mx-auto h-10 w-10 text-slate-400" /><h2 className="mt-3 text-lg font-semibold text-slate-900">Generate the first status snapshot</h2><p className="mt-1 text-sm text-slate-600">The report is built from the selected inquiry or project and does not change the underlying client records.</p></div>}

      {snapshot && <>
        {report?.stale && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><span className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" />Source records changed after this snapshot was saved.</span><button onClick={() => generate(true)} className="font-semibold underline">Generate a fresh report</button></div>}
        <section className={`rounded-2xl border p-6 ${stateStyle[snapshot.executiveStatus.state]}`}>
          <div className="flex flex-wrap items-center justify-between gap-3"><span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-wider">{human(snapshot.executiveStatus.state)}</span><span className="text-xs font-medium">As of {snapshot.report.asOfDate} · {snapshot.report.displayTimeZone}</span></div>
          <p className="mt-4 text-lg font-semibold leading-relaxed">{snapshot.executiveStatus.summary}</p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[['Current stage', human(snapshot.currentStage.stage)], ['Stage status', human(snapshot.currentStage.status)], ['Responsible owner', snapshot.currentStage.owner || 'Unassigned'], ['Next milestone', snapshot.executiveStatus.nextMilestone ? human(snapshot.executiveStatus.nextMilestone) : 'Not recorded']].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 font-semibold text-slate-950">{value}</p></div>)}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-950">Open requirements and actions</h2><p className="text-sm text-slate-500">Current work appears first, followed by future-stage requirements.</p></div><span className="text-sm font-semibold text-slate-700">{snapshot.actions.length} open · {snapshot.nextActions.length} current</span></div>
          <div className="mt-4 space-y-3">{snapshot.actions.length ? snapshot.actions.map((action) => <Link key={`${action.sourceType}-${action.id}`} to={action.sourcePath} className="block rounded-xl border border-slate-200 p-4 transition hover:border-blue-300 hover:bg-blue-50/30"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-slate-950">{action.title}</p><p className="mt-1 text-sm text-slate-600">{action.description || human(action.status)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${responsibilityStyle[action.responsibility]}`}>{human(action.responsibility)}</span></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>Owner: {action.owner || 'Unassigned'}</span><span>Due: {action.dueAt ? new Date(action.dueAt).toLocaleDateString() : 'Not set'}</span>{action.overdueDays && <span className="font-bold text-red-700">{action.overdueDays} day{action.overdueDays === 1 ? '' : 's'} overdue</span>}<span>{human(action.stage)}</span></div></Link>) : <Empty text="No open actions are recorded." />}</div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold text-slate-950">Risks and blockers</h2><div className="mt-4 space-y-3">{snapshot.risks.length ? snapshot.risks.map((risk) => <Link key={`${risk.sourceType}-${risk.id}`} to={risk.sourcePath} className="block rounded-xl border border-slate-200 p-4 hover:border-red-300"><div className="flex items-center gap-2"><AlertTriangle className={`h-4 w-4 ${risk.severity === 'HIGH' ? 'text-red-600' : 'text-amber-600'}`} /><span className="text-xs font-bold uppercase tracking-wide text-slate-600">{human(risk.severity)} · {risk.category}</span></div><p className="mt-2 text-sm font-medium text-slate-900">{risk.reason}</p>{risk.mitigation && <p className="mt-2 text-xs text-slate-600">Mitigation: {risk.mitigation}</p>}</Link>) : <Empty text="No current risks or blockers are recorded." />}</div></section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold text-slate-950">Completed today</h2><div className="mt-4 space-y-3">{snapshot.completedRecently.length ? snapshot.completedRecently.map((item) => <Link key={`${item.sourceType}-${item.id}`} to={item.sourcePath} className="flex gap-3 rounded-xl border border-slate-200 p-4 hover:border-emerald-300"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><div><p className="text-sm font-semibold text-slate-900">{item.description}</p><p className="mt-1 text-xs text-slate-500">{new Date(item.occurredAt).toLocaleString()} · {human(item.eventType)}{item.actor ? ` · ${item.actor}` : ''}</p></div></Link>) : <Empty text="No completed activity is recorded for this day." />}</div></section>
        </div>

        {snapshot.warnings.length > 0 && <section className="rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-bold text-amber-950">Data-quality notes</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">{snapshot.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section>}

        <section className="flex flex-col gap-4 rounded-2xl bg-slate-950 p-5 text-white sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold">Export this saved snapshot</h2><p className="mt-1 text-xs text-slate-300">{snapshot.sourceSummary.total} source records · Generated {new Date(snapshot.report.generatedAt).toLocaleString()}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => download('pdf')} disabled={Boolean(exporting)} className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"><Download className="h-4 w-4" />{exporting === 'pdf' ? 'Preparing…' : 'PDF'}</button><button onClick={() => download('xlsx')} disabled={Boolean(exporting)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><FileSpreadsheet className="h-4 w-4" />{exporting === 'xlsx' ? 'Preparing…' : 'Excel'}</button></div></section>

        {history.length > 1 && <details className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer font-semibold text-slate-900">Previous snapshots ({history.length})</summary><div className="mt-3 divide-y divide-slate-100">{history.map((item) => <button key={item.id} onClick={() => openPrevious(item)} className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm hover:text-blue-700"><span>{item.asOfDate} · {human(item.overallState)}</span><span className="text-xs text-slate-500">{new Date(item.generatedAt).toLocaleString()}</span></button>)}</div></details>}
      </>}
    </div>
  );
}

function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{text}</div>; }
