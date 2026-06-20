import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/api';
import { socketService } from '../services/socketService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('taskflow_token');
    const savedUser = localStorage.getItem('taskflow_user');
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        socketService.connect(savedToken); // reconnect socket on page refresh
      } catch {
        localStorage.removeItem('taskflow_token');
        localStorage.removeItem('taskflow_user');
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await authService.login(email, password);
    const { token: newToken, user: userData, must_reset_password } = response.data;
    const fullUser = { ...userData, must_reset_password };

    setToken(newToken);
    setUser(fullUser);
    localStorage.setItem('taskflow_token', newToken);
    localStorage.setItem('taskflow_user', JSON.stringify(fullUser));

    // Connect socket after login
    socketService.connect(newToken);

    return { success: true, mustResetPassword: must_reset_password };
  }, []);

  const completePasswordReset = useCallback(() => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, must_reset_password: false };
      localStorage.setItem('taskflow_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('taskflow_token');
    localStorage.removeItem('taskflow_user');
    socketService.disconnect(); // disconnect socket on logout
  }, []);

  const isAuthenticated = !!token && !!user;
  const isAdmin = user?.role === 'admin';
  const isProjectManager = user?.role === 'project_manager';
  const isCollaborator = user?.role === 'collaborator';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated,
        isAdmin,
        isProjectManager,
        isCollaborator,
        login,
        logout,
        completePasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;