import { useState } from 'react';
import { clientUserApi, getApiErrorMessage } from '../api';
import { AlertCircle, Check, CheckCircle, Copy, X } from 'lucide-react';

interface InviteClientFormProps {
  clientId: string;
  onCancel: () => void;
}

export default function InviteClientForm({ clientId, onCancel }: InviteClientFormProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setInviteLink('');
    setCopied(false);
    setCopyError('');
    setIsLoading(true);

    try {
      const res = await clientUserApi.invite(clientId, { email });
      setSuccess(res.data.message);
      setInviteLink(res.data.inviteLink);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to send invitation.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setCopyError('');
    } catch {
      setCopied(false);
      setCopyError('Copy failed. Select the link and copy it manually.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-client-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-lg"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="invite-client-title" className="text-lg font-semibold text-gray-900">Invite Client</h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close invite client window"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Create a secure invitation link. Email delivery depends on the configured notification service.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4" aria-live="polite">
            <div className="mb-3 flex min-w-0 items-start gap-2 text-sm text-green-800">
              <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p className="min-w-0">{success}</p>
            </div>

            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-green-900">Secure invitation link</p>
            <div className="rounded-md border border-green-200 bg-white p-3">
              <p className="break-all font-mono text-xs leading-5 text-gray-700" tabIndex={0}>
                {inviteLink}
              </p>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-h-5 text-xs">
                {copied && <span className="text-green-800">Link copied to clipboard.</span>}
                {copyError && <span className="text-red-700">{copyError}</span>}
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-2 rounded-lg border border-green-300 bg-white px-3 py-2 text-sm font-medium text-green-800 transition-colors hover:bg-green-100"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>

            <div className="mt-4 flex justify-end border-t border-green-200 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Creating...' : 'Create Invite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
