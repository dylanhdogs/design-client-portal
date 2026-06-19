import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import ClientLayout from './components/ClientLayout';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import ClientForm from './pages/ClientForm';
import ClientDashboard from './pages/client/ClientDashboard';
import MyProject from './pages/client/MyProject';
import ClientDocuments from './pages/client/ClientDocuments';
import ClientCommunications from './pages/client/ClientCommunications';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function RoleBasedLayout() {
  const { user } = useAuth();
  
  if (user?.role === 'CLIENT') {
    return <ClientLayout />;
  }
  return <Layout />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <RoleBasedLayout />
              </PrivateRoute>
            }
          >
            {/* Admin/Staff Routes */}
            <Route index element={<Dashboard />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/new" element={<ClientForm />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="clients/:id/edit" element={<ClientForm />} />
            
            {/* Client Routes */}
            <Route path="my-project" element={<ClientDashboard />} />
            <Route path="my-project/phase/:id" element={<MyProject />} />
            <Route path="my-documents" element={<ClientDocuments />} />
            <Route path="my-communications" element={<ClientCommunications />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
