import { Route, Routes } from 'react-router';
import { HomePage } from './pages/HomePage';
import { MemberDashboardPage } from './pages/MemberDashboard';
import { SignInPage } from './pages/SignInPage';
import { BookingPage } from './pages/Booking';
import { LogWorkoutPage } from './pages/LogWorkout';
import { AiAssistantPage } from './pages/AiAssistant';
import { MealHistoryPage } from './pages/MealHistory';
import { JoinTrainerPage } from './pages/JoinTrainerPage';
import { TrainerDashboardPage } from './pages/TrainerDashboard';

function App() {

  return (
    <Routes>
      <Route index element={<HomePage />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/member-dashboard" element={<MemberDashboardPage />} />
      <Route path="/booking" element={<BookingPage />} />
      <Route path="/log-workout" element={<LogWorkoutPage />} />
      <Route path="/ai-assistant" element={<AiAssistantPage />} />
      <Route path="/meal-history" element={<MealHistoryPage />} />
      <Route path="/join-trainer" element={<JoinTrainerPage />} />
      <Route path="/trainer-dashboard" element={<TrainerDashboardPage />} />
    </Routes>
  )
}

export default App
