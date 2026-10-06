import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import ClientLayout from './components/ClientLayout';
import ErrorBoundary from './components/ErrorBoundary';
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
import AcceptInvite from './pages/AcceptInvite';
import NotFound from './pages/NotFound';
import ProjectCommandCenter from './pages/ProjectCommandCenter';
import Inquiries from './pages/Inquiries';
import ClientInquiry from './pages/client/ClientInquiry';
import DesignWorkspace from './pages/DesignWorkspace';
import ComplianceWorkspace from './pages/ComplianceWorkspace';
import PreconstructionWorkspace from './pages/PreconstructionWorkspace';
import ProcurementWorkspace from './pages/ProcurementWorkspace';
import ManagementDashboard from './pages/ManagementDashboard';
import ClientStatusReportPage from './pages/ClientStatusReport';
import UsersPage from './pages/Users';

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

function RoleRoute({
  roles,
  children,
}: {
  roles: Array<'ADMIN' | 'CLIENT'>;
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  if (!user || !roles.includes(user.role)) {
    return <Navigate to={user?.role === 'CLIENT' ? '/my-project' : '/'} replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <ErrorBoundary>
                  <RoleBasedLayout />
                </ErrorBoundary>
              </PrivateRoute>
            }
          >
            {/* Administrator routes */}
            <Route index element={<RoleRoute roles={['ADMIN']}><Dashboard /></RoleRoute>} />
            <Route path="clients" element={<RoleRoute roles={['ADMIN']}><Clients /></RoleRoute>} />
            <Route path="clients/new" element={<RoleRoute roles={['ADMIN']}><ClientForm /></RoleRoute>} />
            <Route path="clients/:id" element={<RoleRoute roles={['ADMIN']}><ClientDetail /></RoleRoute>} />
            <Route path="clients/:id/edit" element={<RoleRoute roles={['ADMIN']}><ClientForm /></RoleRoute>} />
            <Route path="clients/:id/status-report" element={<RoleRoute roles={['ADMIN']}><ClientStatusReportPage /></RoleRoute>} />
            <Route path="users" element={<RoleRoute roles={['ADMIN']}><UsersPage /></RoleRoute>} />
            <Route path="inquiries" element={<RoleRoute roles={['ADMIN']}><Inquiries /></RoleRoute>} />
            <Route path="management" element={<RoleRoute roles={['ADMIN']}><ManagementDashboard /></RoleRoute>} />
            <Route path="projects/:projectId" element={<RoleRoute roles={['ADMIN']}><ProjectCommandCenter /></RoleRoute>} />
            <Route path="projects/:projectId/design" element={<RoleRoute roles={['ADMIN', 'CLIENT']}><DesignWorkspace /></RoleRoute>} />
            <Route path="projects/:projectId/compliance" element={<RoleRoute roles={['ADMIN', 'CLIENT']}><ComplianceWorkspace /></RoleRoute>} />
            <Route path="projects/:projectId/preconstruction" element={<RoleRoute roles={['ADMIN', 'CLIENT']}><PreconstructionWorkspace /></RoleRoute>} />
            <Route path="projects/:projectId/procurement" element={<RoleRoute roles={['ADMIN', 'CLIENT']}><ProcurementWorkspace /></RoleRoute>} />
            
            {/* Client Routes */}
            <Route path="my-project" element={<RoleRoute roles={['CLIENT']}><ClientDashboard /></RoleRoute>} />
            <Route path="my-project/phase/:id" element={<RoleRoute roles={['CLIENT']}><MyProject /></RoleRoute>} />
            <Route path="my-documents" element={<RoleRoute roles={['CLIENT']}><ClientDocuments /></RoleRoute>} />
            <Route path="my-communications" element={<RoleRoute roles={['CLIENT']}><ClientCommunications /></RoleRoute>} />
            <Route path="my-inquiry" element={<RoleRoute roles={['CLIENT']}><ClientInquiry /></RoleRoute>} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
