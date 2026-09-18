import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiErrorMessage, publicApi, PublicPortalConfig } from '../api';
import { AlertCircle } from 'lucide-react';
import Logo from '../components/Logo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [publicConfig, setPublicConfig] = useState<PublicPortalConfig>({ privacyNoticeUrl: null, supportEmail: null, passwordResetMode: 'administrator' });
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    publicApi.getConfig().then((response) => setPublicConfig(response.data)).catch(() => undefined);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const user = await login(email, password);
      if (user?.role === 'CLIENT') {
        navigate('/my-project');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      if (!err.response) {
        setError('The portal is temporarily unavailable. Please try again or contact support.');
      } else if (err.response.status === 404) {
        setError('The sign-in service is unavailable. Please contact support.');
      } else if (err.response.status === 401) {
        setError('Invalid email or password.');
      } else {
        setError(getApiErrorMessage(err, 'Login failed. Please try again.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden select-none px-4 py-6"
      style={{ backgroundImage: 'url(/Signature-nighttime-luxury-phoenix.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0 bg-black/50 pointer-events-none" />
      <div className="relative z-10 w-full max-w-md bg-black rounded-xl shadow-lg p-5 sm:p-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Logo size="md" className="sm:hidden" />
            <Logo size="lg" className="hidden sm:flex" />
          </div>
          <p className="text-gray-400 mt-2">Sign in to your account</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-800 rounded-lg flex items-center gap-2 text-red-300 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-black border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors placeholder-gray-500"
              placeholder="Enter your email"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-300">
                Password
              </label>
              <a href="/forgot-password" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                Forgot Password?
              </a>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-black border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors placeholder-gray-500"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {import.meta.env.DEV && (
          <div className="mt-6 p-4 bg-black border border-gray-800 rounded-lg text-sm text-gray-400">
            <p className="font-medium mb-2 text-gray-300">Local demo credentials:</p>
            <p>Admin: <span className="font-mono">admin@example.com</span> / <span className="font-mono">admin123</span></p>
            <p>Client: <span className="font-mono">client@example.com</span> / <span className="font-mono">client123</span></p>
          </div>
        )}

        {(publicConfig.privacyNoticeUrl || publicConfig.supportEmail) && (
          <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-gray-400">
            {publicConfig.privacyNoticeUrl && (
              <a className="hover:text-white" href={publicConfig.privacyNoticeUrl} target="_blank" rel="noreferrer">
                Privacy notice
              </a>
            )}
            {publicConfig.supportEmail && (
              <a className="hover:text-white" href={`mailto:${publicConfig.supportEmail}`}>
                Contact support
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
