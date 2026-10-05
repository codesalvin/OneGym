import { useEffect, useMemo, useState } from 'react';
import './NavBar.css';

const API_BASE_URL = import.meta.env.DEV
  ? '/api'
  : (import.meta.env.VITE_API_BASE_URL || '/api');

const FEATURE_GROUPS = {
  member: {
    title: 'For Members',
    description: 'Track your personal fitness journey in one place.',
    items: [
      ['Fitness Dashboard', 'Integrated workout tracking and biometric progress.', '/member-dashboard'],
      ['AI Diet Plan', 'Automated meal suggestions based on goals.', '/member-dashboard?tab=ai'],
      ['Class Bookings', 'Real-time class registration and PT scheduling.', '/member-dashboard?tab=classes'],
    ],
  },
  trainer: {
    title: 'For Trainers',
    description: 'Digital tools to connect and manage your clients.',
    items: [
      ['Trainer Dashboard', 'See your coaching work and upcoming sessions.', '/trainer-dashboard'],
      ['Client Manager', 'Monitor member activity and progress.', '/trainer-dashboard?tab=clients'],
      ['Schedule Sync', 'Manage your professional calendar seamlessly.', '/trainer-dashboard?tab=schedule'],
    ],
  },
  admin: {
    title: 'For Admins',
    description: 'Streamline facility management and insights.',
    items: [
      ['Operations Overview', 'High level view of gym and business analytics.', '/admin'],
      ['User Management', 'Manage member, trainer, and staff access.', '/admin?tab=users'],
      ['Payments', 'Review memberships, renewals, and billing.', '/admin?tab=payments'],
    ],
  },
};

export function NavBar() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    function readStoredUser() {
      try {
        const storedUser = localStorage.getItem('onegymUser');
        setUser(storedUser ? JSON.parse(storedUser) : null);
      } catch {
        localStorage.removeItem('onegymUser');
        setUser(null);
      }
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
  const normalizedRole = String(user?.role || '').toLowerCase();
  const isAdmin = ['admin', 'owner'].includes(normalizedRole);
  const isTrainer = normalizedRole === 'trainer';
  const dashboardHref = isAdmin ? '/admin' : isTrainer ? '/trainer-dashboard' : '/member-dashboard';
  const dashboardLabel = isAdmin ? 'Admin Portal' : isTrainer ? 'Trainer Portal' : 'Dashboard';
  const profilePhotoUrl = user?.profile_photo_url || '';
  const visibleFeatureGroups = !user
    ? [FEATURE_GROUPS.member, FEATURE_GROUPS.trainer, FEATURE_GROUPS.admin]
    : isAdmin
      ? [FEATURE_GROUPS.admin]
      : isTrainer
        ? [FEATURE_GROUPS.trainer]
        : [FEATURE_GROUPS.member];

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
            <div className={`nav-dropdown-menu feature-columns-${visibleFeatureGroups.length}`}>
              {visibleFeatureGroups.map((group) => (
                <div className="mega-col" key={group.title}>
                  <h4>{group.title}</h4>
                  <p>{group.description}</p>
                  {group.items.map(([label, description, href]) => (
                    <a href={href} className="mega-item" key={label}>
                      <span>{label}</span>
                      <small>{description}</small>
                    </a>
                  ))}
                </div>
              ))}
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
              {!isTrainer && !isAdmin && <a href="/member-dashboard?tab=classes">Classes</a>}
              {!isTrainer && !isAdmin && <a href="/member-dashboard?tab=trainer-chat">Trainer Chat</a>}
              {!isTrainer && !isAdmin && <a href="/member-dashboard?tab=ai">AI Assistant</a>}
              {!isAdmin && <a href="/member-dashboard?tab=profile">Profile</a>}
              {!isAdmin && <a href="#">Settings</a>}
              {!isTrainer && !isAdmin && <a href="#">Membership</a>}
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
