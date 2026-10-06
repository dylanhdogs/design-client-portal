import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Copy, KeyRound, Pencil, Plus, RefreshCw, Search, Shield, UserCog, UserX, X } from 'lucide-react';
import { authApi, clientApi, getApiErrorMessage } from '../api';

type Role = 'ADMIN' | 'CLIENT';
type PortalUser = {
  id: string; name: string; email: string; role: Role; active: boolean; clientId: string | null;
  client?: { id: string; name: string; company: string | null; deletedAt: string | null } | null; createdAt: string;
};
type ClientOption = { id: string; name: string; company?: string | null; deletedAt?: string | null };
type Invitation = { id: string; email: string; role: Role; clientId: string | null; status: string; expiresAt: string; createdAt: string; client?: ClientOption | null };
type AuditEvent = { id: string; action: string; entityType: string; entityId: string; actorName: string; actorRole: string; details: unknown; before: unknown; after: unknown; createdAt: string };

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const titleAction = (value: string) => value.toLowerCase().split(/[_\s]+/).map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setCopied(true); }
    catch { setCopied(false); }
  };
  return { copied, copy };
}

function OneTimeLink({ value, label, onClose }: { value: string; label: string; onClose: () => void }) {
  const { copied, copy } = useCopy();
  return <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4" role="status">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><p className="font-medium text-blue-950">{label}</p><p className="mt-1 text-sm text-blue-800">This link is shown once. Share it only through a private channel.</p></div>
      <button onClick={onClose} aria-label="Dismiss one-time link" className="rounded p-1 text-blue-700 hover:bg-blue-100"><X className="h-4 w-4" /></button>
    </div>
    <p className="mt-3 break-all rounded border border-blue-200 bg-white p-3 font-mono text-xs text-gray-800">{value}</p>
    <button onClick={() => void copy(value)} className="mt-3 inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800">
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Copied' : 'Copy link'}
    </button>
  </div>;
}

function UserDialog({ user, clients, onClose, onSaved }: { user: PortalUser; clients: ClientOption[]; onClose: () => void; onSaved: (deactivatedAssignments: number) => void }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<Role>(user.role);
  const [clientId, setClientId] = useState(user.clientId || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const profileChanged = role !== user.role || (role === 'CLIENT' ? clientId || null : null) !== user.clientId;
      if (profileChanged) {
        const nextScope = role === 'CLIENT' ? `CLIENT linked to ${clients.find((client) => client.id === clientId)?.name || 'the selected client'}` : 'ADMIN with internal access';
        if (!window.confirm(`Change ${user.name}'s access from ${user.role}${user.client?.name ? ` linked to ${user.client.name}` : ''} to ${nextScope}? This will sign the user out and deactivate current project assignments.`)) return;
      }
      const result = await authApi.updateUser(user.id, {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        clientId: role === 'CLIENT' ? clientId : null,
      });
      onSaved(result.data.deactivatedAssignments || 0); onClose();
    } catch (err) { setError(getApiErrorMessage(err, 'The account could not be updated.')); }
    finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="user-edit-title" className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl">
      <div className="flex items-center justify-between"><h2 id="user-edit-title" className="text-lg font-semibold">Edit user</h2><button onClick={onClose} aria-label="Close edit user" className="rounded p-1 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
      {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      <form onSubmit={submit} className="mt-5 space-y-4">
        <label className="block text-sm font-medium">Name<input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" /></label>
        <label className="block text-sm font-medium">Email<input required type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" /></label>
        <div className="border-t pt-4"><p className="text-sm font-semibold">Access profile</p><p className="mt-1 text-xs text-gray-500">Changing access signs the account out. Existing assignments are not restored automatically.</p></div>
        <label className="block text-sm font-medium">Role<select value={role} onChange={(e) => setRole(e.target.value as Role)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal"><option value="ADMIN">Administrator</option><option value="CLIENT">Client</option></select></label>
        {role === 'CLIENT' && <label className="block text-sm font-medium">Linked client<select required value={clientId} onChange={(e) => setClientId(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal"><option value="">Select a client</option>{clients.filter((client) => !client.deletedAt).map((client) => <option key={client.id} value={client.id}>{client.name}{client.company ? ` — ${client.company}` : ''}</option>)}</select></label>}
        <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button></div>
      </form>
    </section>
  </div>;
}

function InviteDialog({ clients, onClose, onCreated }: { clients: ClientOption[]; onClose: () => void; onCreated: (link: string) => void }) {
  const [email, setEmail] = useState(''); const [role, setRole] = useState<Role>('CLIENT'); const [clientId, setClientId] = useState(''); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError('');
    try { const result = await authApi.inviteUser({ email: email.trim().toLowerCase(), role, clientId: role === 'CLIENT' ? clientId : null }); onCreated(result.data.inviteLink); onClose(); }
    catch (err) { setError(getApiErrorMessage(err, 'The invitation could not be created.')); }
    finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><section role="dialog" aria-modal="true" aria-labelledby="invite-user-title" className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
    <div className="flex items-center justify-between"><h2 id="invite-user-title" className="text-lg font-semibold">Invite a user</h2><button onClick={onClose} aria-label="Close invitation" className="rounded p-1 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
    <p className="mt-2 text-sm text-gray-600">Create a one-time link for the recipient to set their own password. The link expires in seven days.</p>
    {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
    <form onSubmit={submit} className="mt-5 space-y-4">
      <label className="block text-sm font-medium">Email<input required type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" /></label>
      <label className="block text-sm font-medium">Role<select value={role} onChange={(e) => setRole(e.target.value as Role)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal"><option value="CLIENT">Client</option><option value="ADMIN">Administrator</option></select></label>
      {role === 'CLIENT' && <label className="block text-sm font-medium">Client<select required value={clientId} onChange={(e) => setClientId(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal"><option value="">Select a client</option>{clients.filter((client) => !client.deletedAt).map((client) => <option key={client.id} value={client.id}>{client.name}{client.company ? ` — ${client.company}` : ''}</option>)}</select></label>}
      <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Creating…' : 'Create invitation'}</button></div>
    </form>
  </section></div>;
}

function HistoryDialog({ user, onClose }: { user: PortalUser; onClose: () => void }) {
  const [events, setEvents] = useState<AuditEvent[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { authApi.getUserActivity(user.id, { page: 1, limit: 50 }).then((result) => setEvents(result.data.data)).catch((err) => setError(getApiErrorMessage(err, 'History could not be loaded.'))).finally(() => setLoading(false)); }, [user.id]);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><section role="dialog" aria-modal="true" aria-labelledby="user-history-title" className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
    <div className="flex items-center justify-between"><div><h2 id="user-history-title" className="text-lg font-semibold">Account history</h2><p className="text-sm text-gray-600">{user.name} · {user.email}</p></div><button onClick={onClose} aria-label="Close account history" className="rounded p-1 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
    {loading ? <p className="py-8 text-center text-sm text-gray-500">Loading history…</p> : error ? <p role="alert" className="mt-5 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p> : events.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">No account history has been recorded yet.</p> : <ol className="mt-5 divide-y">{events.map((event) => <li key={event.id} className="py-4"><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-medium text-gray-900">{titleAction(event.action)}</p><time className="text-xs text-gray-500">{formatDate(event.createdAt)}</time></div><p className="mt-1 text-sm text-gray-600">By {event.actorName} ({event.actorRole})</p>{event.details != null && <pre className="mt-2 whitespace-pre-wrap break-words rounded bg-gray-50 p-2 text-xs text-gray-600">{JSON.stringify(event.details, null, 2)}</pre>}</li>)}</ol>}
  </section></div>;
}

export default function Users() {
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState<PortalUser[]>([]); const [invitations, setInvitations] = useState<Invitation[]>([]); const [clients, setClients] = useState<ClientOption[]>([]);
  const [page, setPage] = useState(1); const [totalPages, setTotalPages] = useState(1); const [searchDraft, setSearchDraft] = useState(''); const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState(''); const [statusFilter, setStatusFilter] = useState(''); const [clientFilter, setClientFilter] = useState(() => searchParams.get('clientId') || '');
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [showInvite, setShowInvite] = useState(false); const [editing, setEditing] = useState<PortalUser | null>(null); const [historyUser, setHistoryUser] = useState<PortalUser | null>(null); const [oneTimeLink, setOneTimeLink] = useState<{ value: string; label: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [userResult, invitationResult, clientResult] = await Promise.all([
        authApi.getUsers({ page, limit: 20, search: search || undefined, role: roleFilter || undefined, status: statusFilter || undefined, clientId: clientFilter || undefined }),
        authApi.listInvitations(), clientApi.getAll({ archived: false }),
      ]);
      setUsers(userResult.data.data); setTotalPages(Math.max(1, userResult.data.pagination.totalPages));
      setInvitations(invitationResult.data);
      const clientData = clientResult.data.data || clientResult.data;
      setClients(Array.isArray(clientData) ? clientData : []);
    } catch (err) { setError(getApiErrorMessage(err, 'Users could not be loaded.')); }
    finally { setLoading(false); }
  }, [page, search, roleFilter, statusFilter, clientFilter]);
  useEffect(() => { void load(); }, [load]);

  const changeStatus = async (user: PortalUser) => {
    const active = !user.active;
    if (!active && !window.confirm(`Suspend ${user.name}? They will be signed out and their current project assignments will be deactivated.`)) return;
    try {
      const result = await authApi.updateUserAccess(user.id, active);
      setNotice(active ? `${user.name} can sign in again. Existing project assignments were not restored.` : `${user.name} was suspended. ${result.data.deactivatedAssignments || 0} project assignment(s) were deactivated.`);
      await load();
    } catch (err) { setError(getApiErrorMessage(err, 'Access could not be updated.')); }
  };
  const issueReset = async (user: PortalUser) => {
    try { const result = await authApi.requestUserPasswordReset(user.id); setOneTimeLink({ value: result.data.resetLink, label: `Password reset for ${user.name}` }); setNotice(''); }
    catch (err) { setError(getApiErrorMessage(err, 'A password reset link could not be created.')); }
  };
  const resend = async (invitation: Invitation) => {
    try { const result = await authApi.resendInvitation(invitation.id); setOneTimeLink({ value: result.data.inviteLink, label: `New invitation for ${invitation.email}` }); setNotice('The previous invitation link is no longer valid.'); await load(); }
    catch (err) { setError(getApiErrorMessage(err, 'Invitation could not be resent.')); }
  };
  const revoke = async (invitation: Invitation) => {
    if (!window.confirm(`Revoke the pending invitation for ${invitation.email}? Its link will stop working.`)) return;
    try { await authApi.revokeInvitation(invitation.id); setNotice(`Invitation for ${invitation.email} revoked.`); await load(); }
    catch (err) { setError(getApiErrorMessage(err, 'Invitation could not be revoked.')); }
  };
  const applySearch = (event: FormEvent) => { event.preventDefault(); setPage(1); setSearch(searchDraft.trim()); };

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-gray-500">Administration</p><h1 className="mt-1 text-2xl font-bold text-gray-900">Users</h1><p className="mt-1 text-sm text-gray-600">Manage portal access and review account activity.</p></div><button onClick={() => setShowInvite(true)} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"><Plus className="h-4 w-4" />Invite user</button></header>
    {error && <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span>{error}</span><button onClick={() => void load()} className="font-semibold underline">Retry</button></div>}
    {notice && <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notice"><X className="h-4 w-4" /></button></div>}
    {oneTimeLink && <OneTimeLink value={oneTimeLink.value} label={oneTimeLink.label} onClose={() => setOneTimeLink(null)} />}

    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <form onSubmit={applySearch} className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_170px_170px_220px_auto] md:items-end">
        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Search<input value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} placeholder="Name or email" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900" /></label>
        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Role<select value={roleFilter} onChange={(e) => { setPage(1); setRoleFilter(e.target.value); }} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900"><option value="">All roles</option><option value="ADMIN">Administrator</option><option value="CLIENT">Client</option></select></label>
        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Access<select value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900"><option value="">All accounts</option><option value="active">Active</option><option value="suspended">Suspended</option></select></label>
        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Client<select value={clientFilter} onChange={(e) => { setPage(1); setClientFilter(e.target.value); }} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900"><option value="">All clients</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
        <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"><Search className="h-4 w-4" />Search</button>
      </form>
    </section>

    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-semibold text-gray-900">Accounts</h2><p className="mt-0.5 text-xs text-gray-500">Passwords and reset tokens are never displayed.</p></div><button onClick={() => void load()} aria-label="Refresh users" className="rounded-md border p-2 text-gray-600 hover:bg-gray-50"><RefreshCw className="h-4 w-4" /></button></div>
      {loading ? <div className="p-10 text-center text-sm text-gray-500">Loading accounts…</div> : users.length === 0 ? <div className="p-10 text-center text-sm text-gray-500">No accounts match these filters.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-3">User</th><th className="px-5 py-3">Role / client</th><th className="px-5 py-3">Access</th><th className="px-5 py-3">Created</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-gray-100">{users.map((user) => <tr key={user.id} className="align-middle"><td className="px-5 py-4"><p className="font-medium text-gray-900">{user.name}</p><p className="text-xs text-gray-500">{user.email}</p></td><td className="px-5 py-4"><span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium"><Shield className="h-3 w-3" />{user.role === 'ADMIN' ? 'Administrator' : 'Client'}</span>{user.client && <p className="mt-1 text-xs text-gray-600">{user.client.name}</p>}</td><td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-xs font-medium ${user.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{user.active ? 'Active' : 'Suspended'}</span></td><td className="px-5 py-4 text-gray-600">{formatDate(user.createdAt)}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => setEditing(user)} title="Edit identity and access" className="rounded-md border p-2 text-gray-600 hover:bg-gray-50"><Pencil className="h-4 w-4" /></button><button onClick={() => setHistoryUser(user)} title="View account history" className="rounded-md border p-2 text-gray-600 hover:bg-gray-50"><UserCog className="h-4 w-4" /></button><button onClick={() => void issueReset(user)} disabled={!user.active} title="Create password reset link" className="rounded-md border p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-40"><KeyRound className="h-4 w-4" /></button><button onClick={() => void changeStatus(user)} title={user.active ? 'Suspend account' : 'Restore access'} className="rounded-md border p-2 text-gray-600 hover:bg-gray-50">{user.active ? <UserX className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}</button></div></td></tr>)}</tbody></table></div>}
      <div className="flex items-center justify-between border-t px-5 py-3 text-sm"><span className="text-gray-500">Page {page} of {totalPages}</span><div className="flex gap-2"><button disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-md border px-3 py-1.5 disabled:opacity-40">Previous</button><button disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-md border px-3 py-1.5 disabled:opacity-40">Next</button></div></div>
    </section>

    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"><div className="border-b px-5 py-4"><h2 className="font-semibold text-gray-900">Pending invitations</h2><p className="mt-0.5 text-xs text-gray-500">Invitation links are only revealed when first created or reissued.</p></div>{invitations.length === 0 ? <p className="p-6 text-sm text-gray-500">No pending invitations.</p> : <div className="divide-y">{invitations.map((invitation) => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="font-medium">{invitation.email}</p><p className="mt-1 text-xs text-gray-500">{invitation.role === 'ADMIN' ? 'Administrator' : `Client${invitation.client?.name ? ` · ${invitation.client.name}` : ''}`} · Expires {formatDate(invitation.expiresAt)}</p></div><div className="flex gap-2"><button onClick={() => void resend(invitation)} className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-xs font-medium hover:bg-gray-50"><RefreshCw className="h-3.5 w-3.5" />Reissue link</button><button onClick={() => void revoke(invitation)} className="rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50">Revoke</button></div></div>)}</div>}</section>

    {showInvite && <InviteDialog clients={clients} onClose={() => setShowInvite(false)} onCreated={(value) => { setOneTimeLink({ value, label: 'One-time invitation link' }); void load(); }} />}
    {editing && <UserDialog user={editing} clients={clients} onClose={() => setEditing(null)} onSaved={(count) => { setNotice(count ? `User account updated. ${count} project assignment(s) were deactivated and may need reassignment.` : 'User account updated.'); void load(); }} />}
    {historyUser && <HistoryDialog user={historyUser} onClose={() => setHistoryUser(null)} />}
  </div>;
}
