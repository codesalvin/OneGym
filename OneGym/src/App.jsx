import { Navigate, Route, Routes } from 'react-router';
import { HomePage } from './pages/HomePage';
import { MemberDashboardPage } from './pages/MemberDashboard';
import { SignInPage } from './pages/SignInPage';
import { BookingPage } from './pages/Booking';
import { LogWorkoutPage } from './pages/LogWorkout';
import { AiAssistantPage } from './pages/AiAssistant';
import { MealHistoryPage } from './pages/MealHistory';
import { JoinTrainerPage } from './pages/JoinTrainerPage';
import { TrainerDashboardPage } from './pages/TrainerDashboard';
import { TrainerChatPage } from './pages/TrainerChat';

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

  if (user.role === 'trainer') {
    return <Navigate replace to="/trainer-dashboard" />;
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

  if (!['trainer', 'admin', 'owner'].includes(user.role)) {
    return <Navigate replace to="/member-dashboard" />;
  }

  return children;
}

function App() {
  return (
    <Routes>
      <Route index element={<HomePage />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/member-dashboard" element={<MemberOnly><MemberDashboardPage /></MemberOnly>} />
      <Route path="/booking" element={<MemberOnly><BookingPage /></MemberOnly>} />
      <Route path="/log-workout" element={<MemberOnly><LogWorkoutPage /></MemberOnly>} />
      <Route path="/ai-assistant" element={<MemberOnly><AiAssistantPage /></MemberOnly>} />
      <Route path="/trainer-chat" element={<AuthOnly><TrainerChatPage /></AuthOnly>} />
      <Route path="/meal-history" element={<MemberOnly><MealHistoryPage /></MemberOnly>} />
      <Route path="/join-trainer" element={<JoinTrainerPage />} />
      <Route path="/trainer-dashboard" element={<TrainerOnly><TrainerDashboardPage /></TrainerOnly>} />
    </Routes>
  )
}

export default App
