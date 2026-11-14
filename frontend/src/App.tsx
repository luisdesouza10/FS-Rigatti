import { Loader2 } from 'lucide-react';
import { Suspense, lazy, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { AppLayout } from './components/layout/AppLayout';
import { useAuth } from './context/AuthContext';
import { AcceptInvitePage } from './pages/auth/AcceptInvitePage';
import { ConfirmEmailPage } from './pages/auth/ConfirmEmailPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ProductsPage } from './pages/products/ProductsPage';

const ChatPage = lazy(() => import('./pages/chat/ChatPage').then((m) => ({ default: m.ChatPage })));
const TeamPage = lazy(() => import('./pages/team/TeamPage').then((m) => ({ default: m.TeamPage })));

function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
    </div>
  );
}

function FullScreenLoader() {
  return (
    <div className="flex h-dvh items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
    </div>
  );
}

function RequireAuth({ children }: Readonly<{ children: ReactNode }>) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function RequireAdmin({ children }: Readonly<{ children: ReactNode }>) {
  const { isAdmin } = useAuth();
  return isAdmin ? <>{children}</> : <Navigate to="/products" replace />;
}

function GuestOnly({ children }: Readonly<{ children: ReactNode }>) {
  const { status } = useAuth();
  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'authenticated') return <Navigate to="/products" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
      {/* Not guest-only: a signed-in person may open a link meant for a new account. */}
      <Route path="/convite/:token" element={<AcceptInvitePage />} />
      <Route path="/confirmar-email/:token" element={<ConfirmEmailPage />} />
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/chat" element={<Suspense fallback={<PageLoader />}><ChatPage /></Suspense>} />
        <Route path="/team" element={<RequireAdmin><Suspense fallback={<PageLoader />}><TeamPage /></Suspense></RequireAdmin>} />
      </Route>
      <Route path="*" element={<Navigate to="/products" replace />} />
    </Routes>
  );
}
