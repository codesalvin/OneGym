import { Route, Routes } from 'react-router';
import { HomePage } from './pages/HomePage';
import { MemberDashboardPage } from './pages/MemberDashboard';
import { SignInPage } from './pages/SignInPage';
import { BookingPage } from './pages/Booking';
import { LogWorkoutPage } from './pages/LogWorkout';

function App() {

  return (
    <Routes>
      <Route index element={<HomePage />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/member-dashboard" element={<MemberDashboardPage />} />
      <Route path="/booking" element={<BookingPage />} />
      <Route path="/log-workout" element={<LogWorkoutPage />} />
    </Routes>
  )
}

export default App
