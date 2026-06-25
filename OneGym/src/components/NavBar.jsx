import { useEffect, useMemo, useState } from 'react';
import './NavBar.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export function NavBar() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    function readStoredUser() {
      const storedUser = localStorage.getItem('onegymUser');
      setUser(storedUser ? JSON.parse(storedUser) : null);
    }

    readStoredUser();
    window.addEventListener('storage', readStoredUser);
    window.addEventListener('onegym-auth-change', readStoredUser);

    return () => {
      window.removeEventListener('storage', readStoredUser);
      window.removeEventListener('onegym-auth-change', readStoredUser);
    };
  }, []);

  const userInitials = useMemo(() => {
    if (!user) {
      return '';
    }

    const name = user.username || user.email || 'Member';
    return name
      .split(/[.\s_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  }, [user]);
  const dashboardHref = user?.role === 'trainer' ? '/trainer-dashboard' : '/member-dashboard';
  const dashboardLabel = user?.role === 'trainer' ? 'Trainer Portal' : 'Dashboard';
  const isTrainer = user?.role === 'trainer';
  const profilePhotoUrl = user?.profile_photo_url || '';

  async function handleLogout() {
    try {
      await fetch(`${API_BASE_URL}/auth/signout/`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Local logout still clears UI state if the server is unreachable.
    }

    localStorage.removeItem('onegymUser');
    window.dispatchEvent(new Event('onegym-auth-change'));
    setUser(null);
    window.location.href = '/signin';
  }

  return (
    <nav className="nav">
      <div className="nav-inner">
        <a className="nav-logo" href="/">OneGym</a>
        <ul className="nav-links">
          {/* Features Dropdown Item */}
          <li className="nav-dropdown">
            <a href="#" className="nav-dropdown-trigger">Features</a>
            <div className="nav-dropdown-menu">
              
              {/* Column 1: Members */}
              <div className="mega-col">
                <h4>For Members</h4>
                <p>Track your personal fitness journey in one place.</p>
                <a href="/member-dashboard" className="mega-item">
                  <span>Fitness Dashboard</span>
                  <small>Integrated workout tracking and biometric progress.</small>
                </a>
                <a href="/member-dashboard" className="mega-item">
                  <span>AI Diet Plan</span>
                  <small>Automated meal suggestions based on goals.</small>
                </a>
                <a href="/member-dashboard" className="mega-item">
                  <span>Class Bookings</span>
                  <small>Real-time class registration and PT scheduling.</small>
                </a>
              </div>

              {/* Column 2: Trainers */}
              <div className="mega-col">
                <h4>For Trainers</h4>
                <p>Digital tools to connect and manage your clients.</p>
                <a href="/trainer-dashboard" className="mega-item">
                  <span>Client Manager</span>
                  <small>CRM-style interface to monitor client progress.</small>
                </a>
                <a href="/trainer-dashboard" className="mega-item">
                  <span>Schedule Sync</span>
                  <small>Manage your professional calendar seamlessly.</small>
                </a>
                <a href="/join-trainer" className="mega-item">
                  <span>Join as Trainer</span>
                  <small>Apply for approval with your certification document.</small>
                </a>
              </div>

              {/* Column 3: Admins */}
              <div className="mega-col">
                <h4>For Admins</h4>
                <p>Streamline facility management and insights.</p>
                <a href="#" className="mega-item">
                  <span>Operations Overview</span>
                  <small>High level view of gym and business analytics.</small>
                </a>
                <a href="#" className="mega-item">
                  <span>Payment Gateway</span>
                  <small>Automated membership renewals and billing.</small>
                </a>
              </div>

            </div>
          </li>
          
          <li><a href="/support">Support</a></li>
          <li><a href="/pricing">Pricing</a></li>
        </ul>
        <a className="nav-pill" href="/pricing">View plans</a>
        {user ? (
          <div className="profile-menu">
            <button className="profile-trigger" type="button" aria-label="Open profile menu">
              {profilePhotoUrl ? <img alt="" src={profilePhotoUrl} /> : <span>{userInitials}</span>}
            </button>
            <div className="profile-dropdown">
              <div className="profile-summary">
                <div className="profile-avatar">
                  {profilePhotoUrl ? <img alt="" src={profilePhotoUrl} /> : userInitials}
                </div>
                <div>
                  <strong>{user.username || 'Member'}</strong>
                  <small>{user.email}</small>
                </div>
              </div>
              <a href={dashboardHref}>{dashboardLabel}</a>
              {!isTrainer && <a href="/member-dashboard?tab=classes">Classes</a>}
              {!isTrainer && <a href="/member-dashboard?tab=trainer-chat">Trainer Chat</a>}
              {!isTrainer && <a href="/member-dashboard?tab=ai">AI Assistant</a>}
              <a href="/member-dashboard?tab=profile">Profile</a>
              <a href="#">Settings</a>
              {!isTrainer && <a href="#">Membership</a>}
              <button type="button" onClick={handleLogout}>Logout</button>
            </div>
          </div>
        ) : (
          <a className="btn btn-primary btn-sm" href="/signin">Sign In</a>
        )}
      </div>
    </nav>
  );
}
