import { useEffect, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authApi, getApiErrorMessage, publicApi, PublicPortalConfig } from '../api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetLink, setResetLink] = useState('');
  const [publicConfig, setPublicConfig] = useState<PublicPortalConfig>({ privacyNoticeUrl: null, supportEmail: null, passwordResetMode: 'administrator' });

  useEffect(() => {
    publicApi.getConfig().then((response) => setPublicConfig(response.data)).catch(() => undefined);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setIsSubmitting(true);

    try {
      const res = await authApi.forgotPassword(email);
      setMessage(res.data.message);
      setResetLink(res.data.resetLink || '');
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Something went wrong.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">Forgot Password</h1>

        {message && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
            {error}
          </div>
        )}

        {publicConfig.passwordResetMode === 'administrator' ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <p>Password reset email is not enabled. Contact the portal administrator to recover your account.</p>
            {publicConfig.supportEmail && <a className="mt-2 inline-block font-medium underline" href={`mailto:${publicConfig.supportEmail}`}>{publicConfig.supportEmail}</a>}
          </div>
        ) : <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Development Reset Link'}
          </button>
        </form>}

        {resetLink && <a className="mt-4 block break-all rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 underline" href={resetLink}>Open the development reset link</a>}

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link to="/login" className="text-blue-600 hover:underline">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}
