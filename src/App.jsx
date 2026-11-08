import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './state/AuthContext';
import { RealtimeProvider } from './state/RealtimeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Shell } from './components/Shell';
import { LoginPage } from './pages/LoginPage';
import { ChatPage } from './pages/ChatPage';
import { ROLES } from './lib/roles';

// Dashboards are role-scoped and rarely opened; keep them out of the main bundle.
const AdminPanel = lazy(() =>
  import('./pages/AdminPanel').then((m) => ({ default: m.AdminPanel })),
);
const HrPanel = lazy(() => import('./pages/HrPanel').then((m) => ({ default: m.HrPanel })));

function RouteFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <span className="sr-only">Loading</span>
      <span className="size-6 animate-spin rounded-full border-2 border-parchment border-t-accent" />
    </div>
  );
}

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return (
    <Shell>
      <Suspense fallback={<RouteFallback />}>{children}</Suspense>
    </Shell>
  );
}

/** Role-scoped route; anyone else is sent back to their chats. */
function RequireRole({ role, children }) {
  const { user } = useAuth();
  if (user?.role !== role) return <Navigate to="/chats" replace />;
  return children;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/chats" replace /> : <LoginPage />}
      />
      <Route
        path="/chats"
        element={
          <RequireAuth>
            <ChatPage />
          </RequireAuth>
        }
      />
      <Route
        path="/chats/:chatId"
        element={
          <RequireAuth>
            <ChatPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <RequireRole role={ROLES.ADMIN}>
              <AdminPanel />
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/hr"
        element={
          <RequireAuth>
            <RequireRole role={ROLES.HR}>
              <HrPanel />
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to={isAuthenticated ? '/chats' : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <RealtimeProvider>
            <AppRoutes />
          </RealtimeProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
