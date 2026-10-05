import { useEffect, useMemo, useRef, useState } from 'react';
import './TrainerDashboard.css';

const API_BASE_URL = import.meta.env.DEV
  ? '/api'
  : (import.meta.env.VITE_API_BASE_URL || '/api');
const CLIENT_PROGRESS_TARGET = 12;
const REFRESH_INTERVAL_MS = 15000;
const MEMBER_SIDE_ROLES = new Set(['member', 'pro', 'studio']);
const emptyClassForm = {
  title: '',
  room: '',
  scheduleTime: '',
  slots: '12',
};

const programs = [
  { icon: 'bolt', title: 'Metabolic Prime', clients: 12, description: 'High-intensity conditioning for advanced athletes.' },
  { icon: 'balance', title: 'Foundations 101', clients: 8, description: 'Movement fundamentals with corrective exercise focus.' },
  { icon: 'fitness_center', title: 'Power & Load', clients: 15, description: 'Progressive overload cycles for compound strength.' },
  { icon: 'self_improvement', title: 'Resilience Flow', clients: 32, description: 'Mobility and recovery sessions for rest days.' },
];

async function readApiResponse(response) {
  if (response.status === 401) {
    localStorage.removeItem('onegymAuthToken');
    localStorage.removeItem('onegymUser');
    window.dispatchEvent(new Event('onegym-auth-change'));
    window.location.replace('/signin?reason=session-expired');
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  return JSON.parse(text);
}

function getStoredUser() {
  const storedUser = localStorage.getItem('onegymUser');
  return storedUser ? JSON.parse(storedUser) : null;
}

function getInitials(user) {
  const name = user.username || user.email || 'Member';
  return name
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function formatTime(value) {
  if (!value) {
    return '--:--';
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) {
    return 'No session scheduled';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatMessageTime(value) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function isThisWeek(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(now.getDate() - now.getDay());

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  return date >= weekStart && date < weekEnd;
}

function isToday(value) {
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

function getWorkoutDate(workout) {
  return new Date(workout.workout_date || workout.created_at);
}

function getRecentWorkoutCount(workouts) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  cutoff.setHours(0, 0, 0, 0);

  return workouts.filter((workout) => getWorkoutDate(workout) >= cutoff).length;
}

function getWorkoutMinutes(workouts) {
  return workouts.reduce((total, workout) => total + Number(workout.duration_minutes || workout.duration || 0), 0);
}

function getLatestWorkout(workouts) {
  return [...workouts].sort((a, b) => getWorkoutDate(b) - getWorkoutDate(a))[0];
}

function formatMetric(value, suffix = '') {
  if (value === null || value === undefined || value === '') {
    return '--';
  }

  const number = Number(value);
  return Number.isNaN(number) ? `${value}${suffix}` : `${number.toLocaleString()}${suffix}`;
}

function getClassHours(item) {
  const minutes = Number(item.duration_minutes || item.duration || 0);
  return minutes > 0 ? minutes / 60 : 1;
}

export function TrainerDashboardPage() {
  const [activeTab, setActiveTab] = useState(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    return ['overview', 'schedule', 'clients', 'progress', 'programs', 'messages'].includes(tab) ? tab : 'overview';
  });
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [applications, setApplications] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [conversationMessages, setConversationMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [messageStatus, setMessageStatus] = useState('');
  const [isMessageError, setIsMessageError] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [clientWorkouts, setClientWorkouts] = useState({});
  const [dashboardMessage, setDashboardMessage] = useState('');
  const [classForm, setClassForm] = useState(emptyClassForm);
  const [classMessage, setClassMessage] = useState('');
  const [isClassError, setIsClassError] = useState(false);
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const trainerName = useMemo(() => {
    const user = getStoredUser();
    return user.username || user.email?.split('@')[0] || 'Trainer';
  }, []);
  const storedTrainer = useMemo(() => getStoredUser() || {}, []);
  const trainerInitials = useMemo(() => getInitials(getStoredUser() || { username: trainerName }), [trainerName]);
  const messageScrollRef = useRef(null);

  async function loadDashboardData() {
    try {
      const conversationRequest = fetch(`${API_BASE_URL}/trainer-chat/conversations/`, {
        credentials: 'include',
      });
      const [usersResponse, classesResponse, applicationsResponse, conversationsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/users/`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/classes/`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/trainer-applications/?status=pending`, { credentials: 'include' }),
        conversationRequest,
      ]);

      const [usersData, classesData, applicationsData, conversationsData] = await Promise.all([
        readApiResponse(usersResponse),
        readApiResponse(classesResponse),
        readApiResponse(applicationsResponse),
        readApiResponse(conversationsResponse),
      ]);

      if (!usersResponse.ok) {
        throw new Error(usersData?.detail || 'Unable to load users.');
      }
      if (!classesResponse.ok) {
        throw new Error(classesData?.detail || 'Unable to load schedule.');
      }
      if (!applicationsResponse.ok) {
        throw new Error(applicationsData?.detail || 'Unable to load trainer applications.');
      }
      if (!conversationsResponse.ok) {
        throw new Error(conversationsData?.detail || 'Unable to load trainer messages.');
      }

      const memberUsers = Array.isArray(usersData) ? usersData.filter((user) => MEMBER_SIDE_ROLES.has(user.role)) : [];
      const workoutPairs = await Promise.all(
        memberUsers.slice(0, 12).map(async (member) => {
          try {
            const response = await fetch(`${API_BASE_URL}/users/${member.id}/workouts/?limit=all`, {
              credentials: 'include',
            });
            const data = await readApiResponse(response);
            return [member.id, response.ok && Array.isArray(data) ? data : []];
          } catch {
            return [member.id, []];
          }
        }),
      );

      setUsers(Array.isArray(usersData) ? usersData : []);
      setClasses(Array.isArray(classesData) ? classesData : []);
      setApplications(Array.isArray(applicationsData) ? applicationsData : []);
      setConversations(Array.isArray(conversationsData) ? conversationsData : []);
      setClientWorkouts(Object.fromEntries(workoutPairs));
      setLastUpdatedAt(new Date());
      setDashboardMessage('');
    } catch (error) {
      setDashboardMessage(error.message);
    }
  }

  useEffect(() => {
    loadDashboardData();
    const interval = window.setInterval(loadDashboardData, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedConversationId && conversations.length) {
      setSelectedConversationId(String(conversations[0].user_id));
    }
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    if (selectedConversationId) {
      loadConversationMessages(selectedConversationId);
    } else {
      setConversationMessages([]);
    }
  }, [selectedConversationId]);

  useEffect(() => {
    messageScrollRef.current?.scrollTo({
      top: messageScrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [conversationMessages.length]);

  function openTrainerTab(tabId) {
    setActiveTab(tabId);
    setIsNavOpen(false);
  }

  async function loadConversationMessages(memberId = selectedConversationId) {
    if (!storedTrainer?.id || !memberId) {
      setConversationMessages([]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/users/${memberId}/trainer-messages/?trainer_id=${storedTrainer.id}`, {
        credentials: 'include',
      });
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data?.detail || 'Unable to load trainer chat.');
      }

      setConversationMessages(Array.isArray(data) ? data : []);
      setIsMessageError(false);
      setMessageStatus('');
    } catch (error) {
      setConversationMessages([]);
      setIsMessageError(true);
      setMessageStatus(error.message);
    }
  }

  async function sendTrainerMessage(event) {
    event.preventDefault();

    const body = messageInput.trim();
    if (!body || isSendingMessage) {
      return;
    }
    if (!selectedConversationId) {
      setIsMessageError(true);
      setMessageStatus('Choose a member before sending a message.');
      return;
    }

    setIsSendingMessage(true);
    setMessageInput('');
    setIsMessageError(false);
    setMessageStatus('');

    try {
      const response = await fetch(`${API_BASE_URL}/trainer-chat/messages/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient_id: selectedConversationId,
          body,
        }),
      });
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data?.detail || 'Unable to send message.');
      }

      setConversationMessages((current) => [...current, data]);
      await loadDashboardData();
    } catch (error) {
      setIsMessageError(true);
      setMessageStatus(error.message);
      setMessageInput(body);
    } finally {
      setIsSendingMessage(false);
    }
  }

  function updateClassField(event) {
    const { name, value } = event.target;
    setClassForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function createClass(event) {
    event.preventDefault();

    setIsCreatingClass(true);
    setIsClassError(false);
    setClassMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/classes/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: classForm.title.trim(),
          room: classForm.room.trim(),
          schedule_time: classForm.scheduleTime,
          slots: Number(classForm.slots),
        }),
      });
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data?.detail || 'Unable to create class.');
      }

      setClassForm(emptyClassForm);
      setClassMessage(data?.detail || 'Class created successfully.');
      await loadDashboardData();
    } catch (error) {
      setIsClassError(true);
      setClassMessage(error.message);
    } finally {
      setIsCreatingClass(false);
    }
  }

  const memberUsers = useMemo(() => users.filter((user) => MEMBER_SIDE_ROLES.has(user.role)), [users]);
  const trainerUsers = useMemo(() => users.filter((user) => user.role === 'trainer'), [users]);
  const thisWeekClasses = useMemo(() => classes.filter((item) => isThisWeek(item.schedule_time)), [classes]);
  const todayClasses = useMemo(() => classes.filter((item) => isToday(item.schedule_time)).slice(0, 5), [classes]);

  const clientCards = useMemo(() => {
    return memberUsers.slice(0, 12).map((member) => {
      const workouts = clientWorkouts[member.id] || [];
      const recentWorkouts = getRecentWorkoutCount(workouts);
      const progress = Math.min(100, Math.round((recentWorkouts / CLIENT_PROGRESS_TARGET) * 100));
      const nextClass = classes[0];
      const latestWorkout = getLatestWorkout(workouts);

      return {
        initials: getInitials(member),
        name: member.username || member.email,
        goal: recentWorkouts > 0 ? `${recentWorkouts} workouts this month` : 'No recent workouts',
        progress,
        recentWorkouts,
        currentWeight: member.current_weight,
        goalWeight: member.goal_weight,
        weeklyTarget: member.weekly_target,
        totalMinutes: getWorkoutMinutes(workouts),
        lastWorkout: latestWorkout?.workout_name || latestWorkout?.name || 'No workout logged',
        lastWorkoutAt: latestWorkout ? formatDateTime(latestWorkout.workout_date || latestWorkout.created_at) : 'No activity yet',
        next: nextClass ? formatDateTime(nextClass.schedule_time) : 'No session scheduled',
      };
    });
  }, [classes, clientWorkouts, memberUsers]);

  const averageProgress = useMemo(() => {
    if (!clientCards.length) {
      return 0;
    }

    return Math.round(clientCards.reduce((total, client) => total + client.progress, 0) / clientCards.length);
  }, [clientCards]);

  const scheduleRows = useMemo(() => {
    const now = new Date();
    const source = todayClasses.length ? todayClasses : classes.slice(0, 5);
    return source.map((item, index) => ({
      id: item.id,
      time: formatTime(item.schedule_time),
      client: item.instructor_name || trainerName,
      session: item.title,
      state: new Date(item.schedule_time) < now ? 'Complete' : index === 0 ? 'Start' : `${item.available_slots} slots`,
    }));
  }, [classes, todayClasses, trainerName]);

  const unreadMessageCount = useMemo(() => {
    return conversations.reduce((total, conversation) => total + Number(conversation.unread_count || 0), 0);
  }, [conversations]);

  const weeklyCapacity = useMemo(() => {
    const slots = thisWeekClasses.reduce((total, item) => total + Number(item.slots || 0), 0);
    const booked = thisWeekClasses.reduce((total, item) => total + Number(item.booked_slots || 0), 0);
    if (!slots) {
      return 0;
    }

    return Math.round((booked / slots) * 100);
  }, [thisWeekClasses]);
  const clientsNeedingAttention = useMemo(() => clientCards.filter((client) => client.progress < 35).length, [clientCards]);
  const totalClientMinutes = useMemo(() => clientCards.reduce((total, client) => total + Number(client.totalMinutes || 0), 0), [clientCards]);
  const sessionHours = useMemo(() => {
    return thisWeekClasses.reduce((total, item) => total + getClassHours(item), 0);
  }, [thisWeekClasses]);
  const completedTodaySessions = useMemo(() => {
    const now = new Date();
    return todayClasses.filter((item) => new Date(item.schedule_time) < now).length;
  }, [todayClasses]);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'schedule', label: 'Sessions', icon: 'calendar_today' },
    { id: 'clients', label: 'Clients', icon: 'group' },
    { id: 'progress', label: 'Progress', icon: 'monitoring' },
    { id: 'programs', label: 'Programs', icon: 'fitness_center' },
    { id: 'messages', label: 'Messages', icon: 'chat_bubble', badge: unreadMessageCount },
  ];
  const tabTitle = {
    overview: 'Trainer Portal',
    schedule: 'Sessions',
    clients: 'Clients',
    progress: 'Progress',
    programs: 'Programs',
    messages: 'Messages',
  }[activeTab];
  const tabDescription = {
    overview: `Welcome back, ${trainerName}. Here is your coaching overview.`,
    schedule: `Welcome back, ${trainerName}. Plan classes and prevent schedule conflicts.`,
    clients: `Welcome back, ${trainerName}. Track client progress and next sessions.`,
    progress: `Welcome back, ${trainerName}. Review client milestones and training consistency.`,
    programs: `Welcome back, ${trainerName}. Manage programs for your members.`,
    messages: `Welcome back, ${trainerName}. Reply to member messages.`,
  }[activeTab];

  const selectedConversation = useMemo(() => {
    return conversations.find((conversation) => String(conversation.user_id) === String(selectedConversationId)) || null;
  }, [conversations, selectedConversationId]);

  return (
    <div className={`trainer-dashboard-page ${isNavOpen ? 'nav-open' : ''}`}>
      <button aria-label="Close sidebar" className="trainer-backdrop" onClick={() => setIsNavOpen(false)} type="button" />
      <aside className="trainer-sidebar">
        <a className="trainer-brand" href="/">
          <span className="trainer-brand-mark">OG</span>
          <span className="trainer-brand-text">
            <strong>OneGym</strong>
            <small>Trainer Space</small>
          </span>
        </a>
        <nav>
          {navItems.map((item) => (
            <button
              className={`${activeTab === item.id ? 'active' : ''} ${item.badge ? 'trainer-nav-with-badge' : ''}`}
              key={item.id}
              onClick={() => openTrainerTab(item.id)}
              type="button"
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              {item.label}
              {item.badge > 0 && <strong>{item.badge}</strong>}
            </button>
          ))}
        </nav>
        <button onClick={() => openTrainerTab('schedule')} type="button">
          <span className="material-symbols-outlined">add</span>
          New Session
        </button>
      </aside>

      <main className="trainer-main">
        <header className="trainer-topbar">
          <div className="trainer-topbar-title-row">
            <button className="trainer-menu-btn" onClick={() => setIsNavOpen(true)} type="button">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <a className="trainer-mobile-brand" href="/">
              <span className="trainer-brand-mark">OG</span>
              <span className="trainer-brand-text">
                <strong>OneGym</strong>
                <small>Trainer Space</small>
              </span>
            </a>
          </div>
          <div>
            <h1>{tabTitle}</h1>
            <p>{tabDescription}</p>
          </div>
          <div className="trainer-top-actions">
            <label>
              <span className="material-symbols-outlined">search</span>
              <input placeholder="Search clients..." type="search" />
            </label>
            <button className="trainer-icon-with-badge" aria-label="Notifications" type="button">
              <span className="material-symbols-outlined">notifications</span>
              {unreadMessageCount > 0 && <strong>{unreadMessageCount}</strong>}
            </button>
            <button aria-label="Settings" type="button"><span className="material-symbols-outlined">settings</span></button>
            <div className="trainer-avatar">{trainerInitials}</div>
          </div>
        </header>

        {dashboardMessage && (
          <div className="trainer-dashboard-alert">{dashboardMessage}</div>
        )}

        {activeTab === 'overview' && <section className="trainer-hero-panel">
          <div className="trainer-hero-copy">
            <p className="trainer-eyebrow">Today&apos;s Coaching Hub</p>
            <h2>Coach smarter with OneGym</h2>
            <p>Track clients, sessions, progress, and messages from one focused coaching control center.</p>
            <div className="trainer-hero-actions">
              <button onClick={() => setActiveTab('schedule')} type="button">View Sessions</button>
              <button onClick={() => setActiveTab('messages')} type="button">Open Messages</button>
            </div>
          </div>
          <div className="trainer-hero-stats">
            <article>
              <span className="material-symbols-outlined">calendar_today</span>
              <small>Today&apos;s Sessions</small>
              <strong>{todayClasses.length}</strong>
            </article>
            <article>
              <span className="material-symbols-outlined">priority_high</span>
              <small>Need Attention</small>
              <strong>{clientsNeedingAttention}</strong>
            </article>
            <article>
              <span className="material-symbols-outlined">chat_bubble</span>
              <small>Unread</small>
              <strong>{unreadMessageCount}</strong>
            </article>
            <article>
              <span className="material-symbols-outlined">donut_large</span>
              <small>Capacity</small>
              <strong>{weeklyCapacity}%</strong>
            </article>
          </div>
        </section>}

        {activeTab === 'schedule' && <section className="trainer-create-class-section">
          <div className="trainer-section-title">
            <div>
              <p className="trainer-eyebrow">Session Management</p>
              <h2>Create Class</h2>
            </div>
          </div>
          <form className="trainer-create-class-form" onSubmit={createClass}>
            <label>
              Class Title
              <input name="title" onChange={updateClassField} placeholder="Power Flow Yoga" required type="text" value={classForm.title} />
            </label>
            <label>
              Room
              <input name="room" onChange={updateClassField} placeholder="Studio B" required type="text" value={classForm.room} />
            </label>
            <label>
              Date & Time
              <input name="scheduleTime" onChange={updateClassField} required type="datetime-local" value={classForm.scheduleTime} />
            </label>
            <label>
              Slots
              <input min="1" name="slots" onChange={updateClassField} required type="number" value={classForm.slots} />
            </label>
            <button disabled={isCreatingClass} type="submit">
              {isCreatingClass ? 'Creating...' : 'Create Class'}
              <span className="material-symbols-outlined">add</span>
            </button>
          </form>
          {classMessage && (
            <p className={`trainer-class-message ${isClassError ? 'error' : 'success'}`}>{classMessage}</p>
          )}
        </section>}

        {activeTab === 'overview' && <section className="trainer-work-grid">
          <article className="trainer-schedule-panel" id="schedule">
            <div className="trainer-panel-heading">
              <h2>Today's Schedule</h2>
              <button aria-label="More schedule options" type="button"><span className="material-symbols-outlined">more_horiz</span></button>
            </div>
            <div className="trainer-schedule-list-real">
              {scheduleRows.length ? scheduleRows.map((item) => (
                <div className="trainer-session-row" key={item.id}>
                  <time>{item.time}</time>
                  <div>
                    <strong>{item.client}</strong>
                    <small>{item.session}</small>
                  </div>
                    {item.state === 'Start' ? (
                      <button className="trainer-start-action" type="button">Start</button>
                    ) : (
                      <span className={`trainer-status-chip ${item.state === 'Complete' ? 'complete' : ''}`}>{item.state}</span>
                    )}
                  </div>
                )) : (
                <div className="trainer-empty-state">
                  <span className="material-symbols-outlined">event_available</span>
                  <strong>No upcoming sessions found.</strong>
                  <small>Create a class to start filling the schedule.</small>
                </div>
              )}
            </div>
            <footer className="trainer-schedule-summary">
              <span>
                <strong>{Number(sessionHours.toFixed(1)).toLocaleString()}</strong>
                <small>Total Hrs</small>
              </span>
              <span>
                <strong>{memberUsers.length}</strong>
                <small>Clients</small>
              </span>
              <span>
                <strong>{completedTodaySessions}/{todayClasses.length || 0}</strong>
                <small>Done</small>
              </span>
            </footer>
            <button className="trainer-panel-link" onClick={() => setActiveTab('schedule')} type="button">View Full Calendar</button>
          </article>
        </section>}

        {activeTab === 'overview' && <section className="trainer-progress-section">
          <div className="trainer-section-title">
            <div>
              <p className="trainer-eyebrow">Coaching Progress</p>
              <h2>Clients to watch</h2>
            </div>
            <button className="trainer-panel-link" onClick={() => setActiveTab('progress')} type="button">View Progress</button>
          </div>
          <div className="trainer-progress-grid">
            {clientCards.slice(0, 3).map((client) => (
              <article key={client.name}>
                <div className="trainer-client-head">
                  <span>{client.initials}</span>
                  <div>
                    <h3>{client.name}</h3>
                    <p>{client.lastWorkout}</p>
                  </div>
                </div>
                <div className="trainer-client-metrics">
                  <span><small>Weight</small><strong>{formatMetric(client.currentWeight, 'kg')}</strong></span>
                  <span><small>Target</small><strong>{formatMetric(client.goalWeight, 'kg')}</strong></span>
                  <span><small>Minutes</small><strong>{formatMetric(client.totalMinutes)}</strong></span>
                </div>
                <div className="trainer-client-progress">
                  <div><i style={{ width: `${client.progress}%` }}></i></div>
                  <strong>{client.progress}%</strong>
                </div>
              </article>
            ))}
            {!clientCards.length && (
              <div className="trainer-empty-state">
                <span className="material-symbols-outlined">monitoring</span>
                <strong>No client progress found yet.</strong>
                <small>Client signals appear after members log workouts.</small>
              </div>
            )}
          </div>
        </section>}

        {activeTab === 'schedule' && (
          <section className="trainer-schedule-tab">
            <article className="trainer-schedule-panel">
              <div className="trainer-panel-heading">
                <h2>Class Schedule</h2>
                <button aria-label="More schedule options" type="button"><span className="material-symbols-outlined">more_horiz</span></button>
              </div>
              <div className="trainer-schedule-list-real">
                {scheduleRows.length ? scheduleRows.map((item) => (
                  <div className="trainer-session-row" key={item.id}>
                    <time>{item.time}</time>
                    <div>
                      <strong>{item.client}</strong>
                      <small>{item.session}</small>
                    </div>
                    {item.state === 'Start' ? (
                      <button className="trainer-start-action" type="button">Start</button>
                    ) : (
                      <span className={`trainer-status-chip ${item.state === 'Complete' ? 'complete' : ''}`}>{item.state}</span>
                    )}
                  </div>
                )) : (
                  <div className="trainer-empty-state">
                    <span className="material-symbols-outlined">event_available</span>
                    <strong>No upcoming sessions found.</strong>
                    <small>Create a class to start filling the schedule.</small>
                  </div>
                )}
              </div>
            </article>
          </section>
        )}

        {activeTab === 'clients' && <section className="trainer-clients-section" id="clients">
          <div className="trainer-section-title">
            <div>
              <p className="trainer-eyebrow">Client Management</p>
              <h2>Active Clients</h2>
            </div>
            <button type="button">Add Client</button>
          </div>
          <div className="trainer-client-grid">
            {clientCards.length ? clientCards.map((client) => (
              <article key={client.name}>
                <div className="trainer-client-head">
                  <span>{client.initials}</span>
                  <div>
                    <h3>{client.name}</h3>
                    <p>{client.goal}</p>
                  </div>
                </div>
                <div className="trainer-client-progress">
                  <div><i style={{ width: `${client.progress}%` }}></i></div>
                  <strong>{client.progress}%</strong>
                </div>
                <div className="trainer-client-metrics">
                  <span><small>Weight</small><strong>{formatMetric(client.currentWeight, 'kg')}</strong></span>
                  <span><small>Goal</small><strong>{formatMetric(client.goalWeight, 'kg')}</strong></span>
                  <span><small>Weekly</small><strong>{formatMetric(client.weeklyTarget)}</strong></span>
                </div>
                <small>{client.next}</small>
              </article>
            )) : (
              <div className="trainer-empty-state">
                <span className="material-symbols-outlined">groups</span>
                <strong>No member clients found yet.</strong>
                <small>Members will appear here once they join OneGym.</small>
              </div>
            )}
          </div>
        </section>}

        {activeTab === 'progress' && <section className="trainer-progress-section" id="progress">
          <div className="trainer-section-title">
            <div>
              <p className="trainer-eyebrow">Performance Analytics</p>
              <h2>Client Progress Tracking</h2>
            </div>
          </div>
          <div className="trainer-progress-grid">
            {clientCards.length ? clientCards.map((client) => (
              <article key={client.name}>
                <div className="trainer-client-head">
                  <span>{client.initials}</span>
                  <div>
                    <h3>{client.name}</h3>
                    <p>{client.lastWorkoutAt}</p>
                  </div>
                </div>
                <div className="trainer-client-metrics">
                  <span><small>30D Workouts</small><strong>{client.recentWorkouts}</strong></span>
                  <span><small>Weight</small><strong>{formatMetric(client.currentWeight, 'kg')}</strong></span>
                  <span><small>Goal</small><strong>{formatMetric(client.goalWeight, 'kg')}</strong></span>
                  <span><small>Minutes</small><strong>{formatMetric(client.totalMinutes)}</strong></span>
                </div>
                <div className="trainer-client-progress">
                  <div><i style={{ width: `${client.progress}%` }}></i></div>
                  <strong>{client.progress}%</strong>
                </div>
                <p className="trainer-client-meta">Latest: {client.lastWorkout}</p>
              </article>
            )) : (
              <div className="trainer-empty-state">
                <span className="material-symbols-outlined">monitoring</span>
                <strong>No client milestones available yet.</strong>
                <small>Progress appears when members log workouts and goals.</small>
              </div>
            )}
          </div>
        </section>}

        {activeTab === 'messages' && <section className="trainer-messages-section" id="messages">
          <div className="trainer-section-title">
            <div>
              <p className="trainer-eyebrow">Client Messages</p>
              <h2>Inbox</h2>
            </div>
            {unreadMessageCount > 0 && <span className="trainer-message-count">{unreadMessageCount}</span>}
          </div>
          <div className="trainer-inbox-layout">
            <div className="trainer-message-list">
              {conversations.length ? conversations.map((conversation) => (
                <button
                  className={`${conversation.unread_count > 0 ? 'unread' : ''} ${String(selectedConversationId) === String(conversation.user_id) ? 'active' : ''}`}
                  key={conversation.user_id}
                  onClick={() => setSelectedConversationId(String(conversation.user_id))}
                  type="button"
                >
                  <span className="trainer-message-avatar">{getInitials(conversation)}</span>
                  <div>
                    <strong>{conversation.username}</strong>
                    <p>{conversation.last_message}</p>
                    <small>{formatDateTime(conversation.last_message_at)}</small>
                  </div>
                  {conversation.unread_count > 0 && (
                    <span className="trainer-message-count">{conversation.unread_count}</span>
                  )}
                </button>
              )) : (
                <div className="trainer-empty-state">
                  <span className="material-symbols-outlined">mark_chat_unread</span>
                  <strong>No client messages yet.</strong>
                  <small>When members message you, conversations will appear here.</small>
                </div>
              )}
            </div>

            <section className="trainer-thread-panel">
              <div className="trainer-thread-header">
                <div>
                  <p className="trainer-eyebrow">Conversation</p>
                  <h3>{selectedConversation ? selectedConversation.username : 'Choose a member'}</h3>
                </div>
                {selectedConversation && <span className="trainer-message-avatar">{getInitials(selectedConversation)}</span>}
              </div>

              {messageStatus && (
                <p className={`trainer-chat-status ${isMessageError ? 'error' : ''}`}>{messageStatus}</p>
              )}

              <div className="trainer-thread-scroll" ref={messageScrollRef}>
                {!selectedConversation && (
                  <article className="trainer-thread-empty">
                    <span className="material-symbols-outlined">forum</span>
                    <h3>Select a member</h3>
                    <p>Pick a conversation from the inbox to reply without leaving the dashboard.</p>
                  </article>
                )}

                {selectedConversation && conversationMessages.length === 0 && (
                  <article className="trainer-thread-empty">
                    <span className="material-symbols-outlined">edit_note</span>
                    <h3>Start the conversation</h3>
                    <p>Send a check-in, class prep note, or quick coaching cue.</p>
                  </article>
                )}

                {conversationMessages.map((message) => {
                  const isOwnMessage = Number(message.sender_id) === Number(storedTrainer.id);

                  return (
                    <article className={`trainer-thread-message ${isOwnMessage ? 'own' : ''}`} key={message.id}>
                      {!isOwnMessage && <strong>{message.sender_name}</strong>}
                      <p>{message.body}</p>
                      <time>{formatMessageTime(message.created_at)}</time>
                    </article>
                  );
                })}
              </div>

              <form className="trainer-thread-input" onSubmit={sendTrainerMessage}>
                <input
                  disabled={isSendingMessage || !selectedConversation}
                  onChange={(event) => setMessageInput(event.target.value)}
                  placeholder={selectedConversation ? `Message ${selectedConversation.username}...` : 'Choose a member first'}
                  type="text"
                  value={messageInput}
                />
                <button disabled={isSendingMessage || !selectedConversation} type="submit">
                  <span className="material-symbols-outlined">arrow_upward</span>
                </button>
              </form>
            </section>
          </div>
        </section>}

        {activeTab === 'programs' && <section className="trainer-programs-section" id="programs">
          <div className="trainer-section-title">
            <div>
              <p className="trainer-eyebrow">Personalized Programming</p>
              <h2>Assigned Programs</h2>
            </div>
            <button className="trainer-panel-link" type="button">Browse Library</button>
          </div>
          <div className="trainer-program-grid-real">
            {programs.map((program) => (
              <article key={program.title}>
                <span className="material-symbols-outlined">{program.icon}</span>
                <h3>{program.title}</h3>
                <p>{program.description}</p>
                <footer>
                  <small>{Math.min(program.clients, memberUsers.length)} Clients</small>
                  <button type="button">Assign</button>
                </footer>
              </article>
            ))}
          </div>
        </section>}
        <p className="trainer-live-note">
          {lastUpdatedAt ? `Live data refreshed ${lastUpdatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}. ${applications.length} pending trainer applications.` : 'Loading live trainer data...'}
        </p>
      </main>
    </div>
  );
}
