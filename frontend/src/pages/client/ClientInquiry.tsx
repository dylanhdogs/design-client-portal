import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Upload } from 'lucide-react';
import { documentApi, getApiErrorMessage, inquiryApi, workflowApi } from '../../api';
import { Inquiry } from '../../types';
import { useAuth } from '../../context/AuthContext';

type InquiryForm = {
  source: string; referralName: string; description: string; objectives: string;
  preliminaryScope: string; budgetExpectation: string; desiredTiming: string;
  address: string; city: string; state: string; postalCode: string; jurisdiction: string; hoaName: string;
};

const emptyForm: InquiryForm = {
  source: '', referralName: '', description: '', objectives: '', preliminaryScope: '',
  budgetExpectation: '', desiredTiming: '', address: '', city: '', state: '', postalCode: '',
  jurisdiction: '', hoaName: '',
};

const toForm = (inquiry: Inquiry): InquiryForm => ({
  source: inquiry.source || '', referralName: inquiry.referralName || '',
  description: inquiry.description || '', objectives: inquiry.objectives || '',
  preliminaryScope: inquiry.preliminaryScope || '', budgetExpectation: inquiry.budgetExpectation || '',
  desiredTiming: inquiry.desiredTiming || '', address: inquiry.property?.address || '',
  city: inquiry.property?.city || '', state: inquiry.property?.state || '',
  postalCode: inquiry.property?.postalCode || '', jurisdiction: inquiry.property?.jurisdiction || '',
  hoaName: inquiry.property?.hoaName || '',
});

const terminalWorkStatuses = ['VERIFIED', 'CLOSED', 'CANCELLED'];

export default function ClientInquiry() {
  const { user } = useAuth();
  const [items, setItems] = useState<Inquiry[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startDifferentProject, setStartDifferentProject] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState<InquiryForm>(emptyForm);

  const current = useMemo(
    () => items.find((item) => item.qualificationStatus !== 'DECLINED') || null,
    [items],
  );
  const editable = !!current && current.qualificationStatus !== 'CONVERTED';
  const openRequests = useMemo(
    () => current?.workItems?.filter((work) => !terminalWorkStatuses.includes(work.status)) || [],
    [current],
  );

  const load = async () => {
    try {
      const inquiries = (await inquiryApi.list()).data.data as Inquiry[];
      setItems(inquiries);
      const active = inquiries.find((item) => item.qualificationStatus !== 'DECLINED');
      if (active && active.qualificationStatus !== 'CONVERTED') setForm(toForm(active));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Your project inquiry could not be loaded.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const payload = () => ({
    source: form.source, referralName: form.referralName, description: form.description,
    objectives: form.objectives, preliminaryScope: form.preliminaryScope,
    budgetExpectation: form.budgetExpectation, desiredTiming: form.desiredTiming,
    property: {
      address: form.address, city: form.city, state: form.state, postalCode: form.postalCode,
      jurisdiction: form.jurisdiction, hoaName: form.hoaName,
    },
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true); setError(''); setSuccess('');
      const inquiry = editable
        ? (await inquiryApi.update(current!.id, payload())).data as Inquiry
        : (await inquiryApi.create(payload())).data as Inquiry;

      if (file && user?.clientId) {
        const upload = new FormData();
        upload.append('file', file); upload.append('inquiryId', inquiry.id);
        upload.append('description', openRequests.length ? 'Provided in response to an information request.' : 'Client inquiry update.');
        await documentApi.create(user.clientId, upload);
      }

      if (editable && openRequests.length) {
        await Promise.all(openRequests
          .filter((work) => !['COMPLETED', 'READY_FOR_REVIEW'].includes(work.status))
          .map((work) => workflowApi.completeWorkItem(work.id)));
      }

      setSuccess(editable
        ? openRequests.length ? 'Your updates were saved and sent to our team for review.' : 'Your project inquiry was updated.'
        : 'Your project inquiry was received. Our team has been notified.');
      setFile(null); setStartDifferentProject(false);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, editable ? 'Your updates could not be saved.' : 'Your inquiry could not be submitted.'));
    } finally { setSaving(false); }
  };

  const showForm = !loading && (editable || items.length === 0 || startDifferentProject);

  return <div className="mx-auto max-w-4xl space-y-6">
    <header><h1 className="text-2xl font-bold text-gray-950">Your project inquiry</h1><p className="mt-1 text-sm text-gray-600">Your original inquiry stays with the project. Add details and documents here whenever our team requests more information.</p></header>
    {success && <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-800"><CheckCircle2 className="mr-2 inline h-5 w-5" />{success}</div>}
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}

    {current && <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Project record</h2><p className="mt-1 text-sm text-gray-700">{current.objectives || current.description}</p><p className="mt-1 text-xs text-gray-500">Started {new Date(current.createdAt).toLocaleDateString()}</p></div><span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">{current.qualificationStatus.replace(/_/g, ' ')}</span></div>
      {openRequests.length > 0 && <div className="mt-4 space-y-3"><h3 className="text-sm font-semibold text-amber-950">Information our team needs</h3>{openRequests.map((work) => <div key={work.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-medium text-amber-950">{work.title}</p>{work.description && <p className="mt-1 text-sm text-amber-900">{work.description}</p>}<p className="mt-1 text-xs text-amber-800"><Clock3 className="mr-1 inline h-3.5 w-3.5" />Due {work.dueAt ? new Date(work.dueAt).toLocaleDateString() : 'soon'}</p></div><span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">{work.status === 'READY_FOR_REVIEW' ? 'Sent for review' : 'Action needed'}</span></div>{!['COMPLETED', 'READY_FOR_REVIEW'].includes(work.status) && <p className="mt-2 text-xs font-medium text-amber-950">Update the project details below, attach any requested file, then select “Save updates and send for review.”</p>}</div>)}</div>}
      {current.qualificationStatus === 'CONVERTED' && <div className="mt-4 rounded-lg bg-green-50 p-4 text-sm text-green-900">This inquiry is now your active project. <a href="/my-project" className="font-semibold text-blue-700 underline">View your project</a>.</div>}
    </section>}

    {!current && items.length > 0 && !startDifferentProject && <section className="rounded-xl border border-gray-200 bg-white p-5"><h2 className="font-semibold">Previous inquiry closed</h2><p className="mt-1 text-sm text-gray-600">Only start another inquiry if this is for a different project.</p><button type="button" onClick={() => { setForm(emptyForm); setStartDifferentProject(true); }} className="mt-4 rounded-lg border border-blue-600 px-4 py-2 text-sm font-medium text-blue-700">Start a different project</button></section>}

    {showForm && <form onSubmit={submit} className="space-y-6 rounded-xl border border-gray-200 bg-white p-5">
      <div><h2 className="font-semibold">{editable ? 'Update your project details' : 'Start your project inquiry'}</h2>{editable && <p className="mt-1 text-sm text-gray-600">Changes are added to your existing inquiry; a new inquiry will not be created.</p>}</div>
      <section><h3 className="font-semibold">Project goals</h3><div className="mt-4 grid gap-4 md:grid-cols-2"><Field label="How did you hear about us?" value={form.source} set={(value) => setForm({...form, source: value})} /><Field label="Referral name" value={form.referralName} set={(value) => setForm({...form, referralName: value})} /><Area label="What would you like to create?" value={form.description} set={(value) => setForm({...form, description: value})} required /><Area label="What should the finished project accomplish?" value={form.objectives} set={(value) => setForm({...form, objectives: value})} required /><Area label="Preliminary features or scope" value={form.preliminaryScope} set={(value) => setForm({...form, preliminaryScope: value})} /><Field label="Budget expectation" value={form.budgetExpectation} set={(value) => setForm({...form, budgetExpectation: value})} /><Field label="Desired timing" value={form.desiredTiming} set={(value) => setForm({...form, desiredTiming: value})} /></div></section>
      <section><h3 className="font-semibold">Property and site</h3><div className="mt-4 grid gap-4 md:grid-cols-2"><Field label="Street address" value={form.address} set={(value) => setForm({...form, address: value})} required /><Field label="City" value={form.city} set={(value) => setForm({...form, city: value})} /><Field label="State" value={form.state} set={(value) => setForm({...form, state: value})} /><Field label="Postal code" value={form.postalCode} set={(value) => setForm({...form, postalCode: value})} /><Field label="Municipality / jurisdiction" value={form.jurisdiction} set={(value) => setForm({...form, jurisdiction: value})} /><Field label="HOA name" value={form.hoaName} set={(value) => setForm({...form, hoaName: value})} /></div></section>
      <section><label className="block rounded-lg border-2 border-dashed border-gray-300 p-5 text-center text-sm text-gray-600 hover:border-blue-400"><Upload className="mx-auto mb-2 h-6 w-6" />Attach a photo or document<input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={(event) => setFile(event.target.files?.[0] || null)} className="mt-3 block w-full text-sm" /></label>{file && <p className="mt-2 text-xs text-gray-500">Selected: {file.name}</p>}</section>
      <button disabled={saving} className="w-full rounded-lg bg-blue-600 px-5 py-3 font-medium text-white disabled:opacity-50">{saving ? 'Saving…' : editable && openRequests.some((work) => !['COMPLETED', 'READY_FOR_REVIEW'].includes(work.status)) ? 'Save updates and send for review' : editable ? 'Save inquiry updates' : 'Submit project inquiry'}</button>
    </form>}
  </div>;
}

function Field({label, value, set, required}:{label:string; value:string; set:(value:string)=>void; required?:boolean}) { return <label className="text-sm font-medium text-gray-800">{label}<input required={required} value={value} onChange={(event) => set(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>; }
function Area({label, value, set, required}:{label:string; value:string; set:(value:string)=>void; required?:boolean}) { return <label className="text-sm font-medium text-gray-800">{label}<textarea required={required} rows={4} value={value} onChange={(event) => set(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>; }
