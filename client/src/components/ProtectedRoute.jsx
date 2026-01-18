import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Preserve the full location including search params (e.g., ?roomid=xxx)
    return <Navigate to="/" state={{ from: { pathname: location.pathname, search: location.search } }} replace />;
  }

  // Check user status
  if (user?.status === 'pending') {
    return <Navigate to="/pending-approval" replace />;
  }

  if (user?.status === 'rejected') {
    return <Navigate to="/rejected" replace />;
  }

  if (user?.status === 'suspended') {
    return <Navigate to="/suspended" replace />;
  }

  // Check admin requirement
  if (requireAdmin && !user?.isAdmin) {
    return <Navigate to="/call" replace />;
  }

  // User is authenticated and approved
  return children;
};
