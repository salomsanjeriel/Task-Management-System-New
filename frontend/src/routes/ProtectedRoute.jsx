import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner';

export function ProtectedRoute({ children, allowPasswordReset = false }) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullPage label="Loading..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.must_reset_password && !allowPasswordReset) {
    return <Navigate to="/reset-password" replace />;
  }

  return children;
}

export function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullPage label="Loading..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
