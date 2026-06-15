import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle } from 'lucide-react';
import Logo from '../components/Logo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      // Check if user is CLIENT and redirect accordingly
      const storedUser = localStorage.getItem('user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      if (user?.role === 'CLIENT') {
        navigate('/my-project');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      if (!err.response) {
        setError('Cannot reach the backend API. Check that the backend is running and VITE_API_URL is set correctly.');
      } else if (err.response.status === 404) {
        setError('Login API was not found. Cloudflare Pages needs VITE_API_URL set to your deployed backend.');
      } else if (err.response.status === 401) {
        setError('Invalid email or password.');
      } else {
        setError(err.response?.data?.error || 'Login failed. Please try again.');
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
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
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

        <div className="mt-6 p-4 bg-black border border-gray-800 rounded-lg text-sm text-gray-400">
          <p className="font-medium mb-2 text-gray-300">Demo credentials:</p>
          <p>Admin: <span className="font-mono">admin@example.com</span> / <span className="font-mono">admin123</span></p>
          <p>Staff: <span className="font-mono">staff@example.com</span> / <span className="font-mono">staff123</span></p>
          <p>Client: <span className="font-mono">client@example.com</span> / <span className="font-mono">client123</span></p>
        </div>
      </div>
    </div>
  );
}
