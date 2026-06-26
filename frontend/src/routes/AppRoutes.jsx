import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { ProtectedRoute, AdminRoute, ManagerRoute, TaskRoute } from './ProtectedRoute';

import LoginPage from '../pages/Login/LoginPage';
import DashboardPage from '../pages/Dashboard/DashboardPage';
import ProjectsPage from '../pages/Projects/ProjectsPage';
import ProjectFormPage from '../pages/ProjectForm/ProjectFormPage';
import TasksPage from '../pages/Tasks/TasksPage';
import TaskFormPage from '../pages/TaskForm/TaskFormPage';
import UserManagementPage from '../pages/UserManagement/UserManagementPage';
import NotificationsPage from '../pages/Notifications/NotificationsPage';
import SettingsPage from '../pages/Settings/SettingsPage';
import ResetPasswordPage from '../pages/ResetPassword/ResetPasswordPage';

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Force Password Reset Route */}
      <Route
        path="/reset-password"
        element={
          <ProtectedRoute allowPasswordReset={true}>
            <ResetPasswordPage />
          </ProtectedRoute>
        }
      />

      {/* Protected — inside MainLayout */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route
          path="/tasks"
          element={
            <TaskRoute>
              <TasksPage />
            </TaskRoute>
          }
        />
        <Route
          path="/tasks/create"
          element={
            <ManagerRoute>
              <TaskFormPage />
            </ManagerRoute>
          }
        />
        <Route
          path="/tasks/edit/:id"
          element={
            <ManagerRoute>
              <TaskFormPage />
            </ManagerRoute>
          }
        />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />

        {/* Admin only */}
        <Route
          path="/users"
          element={
            <AdminRoute>
              <UserManagementPage />
            </AdminRoute>
          }
        />

        {/* Manager only */}
        <Route
          path="/projects"
          element={
            <ManagerRoute>
              <ProjectsPage />
            </ManagerRoute>
          }
        />
        <Route
          path="/projects/create"
          element={
            <ManagerRoute>
              <ProjectFormPage />
            </ManagerRoute>
          }
        />
        <Route
          path="/projects/edit/:id"
          element={
            <ManagerRoute>
              <ProjectFormPage />
            </ManagerRoute>
          }
        />
      </Route>

      {/* Root Redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
