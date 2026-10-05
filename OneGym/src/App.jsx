import { Navigate, Route, Routes } from 'react-router';
import { HomePage } from './pages/HomePage';
import { MemberDashboardPage } from './pages/MemberDashboard';
import { MemberDashboardSamplePage } from './pages/MemberDashboardSample';
import { SignInPage } from './pages/SignInPage';
import { JoinTrainerPage } from './pages/JoinTrainerPage';
import { TrainerDashboardPage } from './pages/TrainerDashboard';
import { TrainerChatPage } from './pages/TrainerChat';
import { SupportPage } from './pages/SupportPage';
import { PricingPage } from './pages/PricingPage';
import { AdminDashboardPage } from './pages/AdminDashboard';

const MEMBER_ROLES = new Set(['member', 'pro', 'studio']);
const ADMIN_ROLES = new Set(['admin', 'owner']);

function getStoredUser() {
  try {
    const storedUser = localStorage.getItem('onegymUser');
    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    return null;
  }
}

function MemberOnly({ children }) {
  const user = getStoredUser();

  if (!user) {
    return <Navigate replace to="/signin" />;
  }

  const role = String(user.role || '').toLowerCase();

  if (!MEMBER_ROLES.has(role)) {
    return <Navigate replace to={ADMIN_ROLES.has(role) ? '/admin' : '/trainer-dashboard'} />;
  }

  return children;
}

function AuthOnly({ children }) {
  const user = getStoredUser();

  if (!user) {
    return <Navigate replace to="/signin" />;
  }

  return children;
}

function TrainerOnly({ children }) {
  const user = getStoredUser();

  if (!user) {
    return <Navigate replace to="/signin" />;
  }

  const role = String(user.role || '').toLowerCase();

  if (role !== 'trainer') {
    return <Navigate replace to={ADMIN_ROLES.has(role) ? '/admin' : '/member-dashboard'} />;
  }

  return children;
}

function AdminOnly({ children }) {
  const user = getStoredUser();
  const role = String(user?.role || '').toLowerCase();

  if (!user) {
    return <Navigate replace to="/signin" />;
  }

  if (!ADMIN_ROLES.has(role)) {
    return <Navigate replace to={role === 'trainer' ? '/trainer-dashboard' : '/member-dashboard'} />;
  }

  return children;
}

function App() {
  return (
    <Routes>
      <Route index element={<HomePage />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/member-dashboard" element={<MemberOnly><MemberDashboardPage /></MemberOnly>} />
      <Route path="/member-dashboard-sample" element={<MemberOnly><MemberDashboardSamplePage /></MemberOnly>} />
      <Route path="/trainer-chat" element={<AuthOnly><TrainerChatPage /></AuthOnly>} />
      <Route path="/join-trainer" element={<JoinTrainerPage />} />
      <Route path="/trainer-dashboard" element={<TrainerOnly><TrainerDashboardPage /></TrainerOnly>} />
      <Route path="/admin" element={<AdminOnly><AdminDashboardPage /></AdminOnly>} />
    </Routes>
  )
}

export default App
