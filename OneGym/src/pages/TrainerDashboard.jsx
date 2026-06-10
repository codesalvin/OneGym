import { useEffect, useMemo, useState } from 'react';
import './TrainerDashboard.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
const CLIENT_PROGRESS_TARGET = 12;
const REFRESH_INTERVAL_MS = 15000;
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

export function TrainerDashboardPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [applications, setApplications] = useState([]);
  const [conversations, setConversations] = useState([]);
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
  const trainerInitials = useMemo(() => getInitials(getStoredUser() || { username: trainerName }), [trainerName]);

  async function loadDashboardData() {
    try {
      const conversationRequest = fetch(`${API_BASE_URL}/trainer-chat/conversations/`, {
        credentials: 'include',
      });
      const [usersResponse, classesResponse, applicationsResponse, conversationsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/users/`),
        fetch(`${API_BASE_URL}/classes/`),
        fetch(`${API_BASE_URL}/trainer-applications/?status=pending`),
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

      const memberUsers = Array.isArray(usersData) ? usersData.filter((user) => user.role === 'member') : [];
      const workoutPairs = await Promise.all(
        memberUsers.slice(0, 12).map(async (member) => {
          try {
            const response = await fetch(`${API_BASE_URL}/users/${member.id}/workouts/?limit=all`);
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

  const memberUsers = useMemo(() => users.filter((user) => user.role === 'member'), [users]);
  const trainerUsers = useMemo(() => users.filter((user) => user.role === 'trainer'), [users]);
  const thisWeekClasses = useMemo(() => classes.filter((item) => isThisWeek(item.schedule_time)), [classes]);
  const todayClasses = useMemo(() => classes.filter((item) => isToday(item.schedule_time)).slice(0, 5), [classes]);

  const clientCards = useMemo(() => {
    return memberUsers.slice(0, 4).map((member) => {
      const workouts = clientWorkouts[member.id] || [];
      const recentWorkouts = getRecentWorkoutCount(workouts);
      const progress = Math.min(100, Math.round((recentWorkouts / CLIENT_PROGRESS_TARGET) * 100));
      const nextClass = classes[0];

      return {
        initials: getInitials(member),
        name: member.username || member.email,
        goal: recentWorkouts > 0 ? `${recentWorkouts} workouts this month` : 'No recent workouts',
        progress,
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

  const spotlightClient = clientCards[0] || {
    name: 'No clients yet',
    goal: 'Invite members to begin coaching',
    progress: 0,
    next: 'No session scheduled',
  };

  const scheduleRows = useMemo(() => {
    const source = todayClasses.length ? todayClasses : classes.slice(0, 5);
    return source.map((item, index) => ({
      id: item.id,
      time: formatTime(item.schedule_time),
      client: item.instructor_name || trainerName,
      session: item.title,
      state: index === 0 ? 'Start' : `${item.available_slots} slots`,
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

  const navItems = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'clients', label: 'Clients', icon: 'group' },
    { id: 'schedule', label: 'Schedule', icon: 'calendar_today' },
    { id: 'programs', label: 'Programs', icon: 'fitness_center' },
    { id: 'messages', label: 'Messages', icon: 'chat_bubble', badge: unreadMessageCount },
  ];

  return (
    <div className="trainer-dashboard-page">
      <aside className="trainer-sidebar">
        <a className="trainer-brand" href="/">OneGym</a>
        <p>Trainer Portal</p>
        <nav>
          {navItems.map((item) => (
            <button
              className={`${activeTab === item.id ? 'active' : ''} ${item.badge ? 'trainer-nav-with-badge' : ''}`}
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              type="button"
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              {item.label}
              {item.badge > 0 && <strong>{item.badge}</strong>}
            </button>
          ))}
        </nav>
        <button onClick={() => setActiveTab('schedule')} type="button">
          <span className="material-symbols-outlined">add</span>
          New Session
        </button>
      </aside>

      <main className="trainer-main">
        <header className="trainer-topbar">
          <a className="trainer-mobile-brand" href="/">OneGym</a>
          <div>
            <p className="trainer-eyebrow">Welcome back</p>
            <h1>{trainerName}</h1>
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

        {activeTab === 'overview' && <section className="trainer-kpi-grid">
          <article>
            <p>Total Clients</p>
            <strong>{memberUsers.length}</strong>
            <span><i className="material-symbols-outlined">group</i>{trainerUsers.length} trainers active</span>
          </article>
          <article>
            <p>Sessions This Week</p>
            <strong>{thisWeekClasses.length}</strong>
            <span>{weeklyCapacity}% capacity reached</span>
          </article>
          <article>
            <p>Avg Client Progress</p>
            <strong>{averageProgress}%</strong>
            <div className="trainer-progress-track"><i style={{ width: `${averageProgress}%` }}></i></div>
          </article>
        </section>}

        {(activeTab === 'overview' || activeTab === 'schedule') && <section className="trainer-create-class-section">
          <div className="trainer-section-title">
            <div>
              <p className="trainer-eyebrow">Schedule Builder</p>
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
          <article className="trainer-spotlight-card">
            <div className="trainer-spotlight-image">
              <img alt="Featured client training" src="https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1100&q=85" />
              <div>
                <p>Featured Client</p>
                <h2>{spotlightClient.name}</h2>
              </div>
            </div>
            <footer>
              <span><small>Goal</small><strong>{spotlightClient.goal}</strong></span>
              <span><small>Progress</small><strong>{spotlightClient.progress}%</strong></span>
              <span><small>Next Session</small><strong>{spotlightClient.next}</strong></span>
            </footer>
          </article>

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
                    <button type="button">Start</button>
                  ) : (
                    <span className={item.state === 'Complete' ? 'complete' : ''}>{item.state}</span>
                  )}
                </div>
              )) : (
                <div className="trainer-empty-state">No upcoming sessions found.</div>
              )}
            </div>
            <button className="trainer-panel-link" onClick={() => setActiveTab('schedule')} type="button">View Full Calendar</button>
          </article>
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
                      <button type="button">Start</button>
                    ) : (
                      <span className={item.state === 'Complete' ? 'complete' : ''}>{item.state}</span>
                    )}
                  </div>
                )) : (
                  <div className="trainer-empty-state">No upcoming sessions found.</div>
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
                <small>{client.next}</small>
              </article>
            )) : (
              <div className="trainer-empty-state">No member clients found yet.</div>
            )}
          </div>
        </section>}

        {activeTab === 'messages' && <section className="trainer-messages-section" id="messages">
          <div className="trainer-section-title">
            <div>
              <p className="trainer-eyebrow">Client Messages</p>
              <h2>Inbox</h2>
            </div>
            <a href="/trainer-chat">
              Open Chat
              {unreadMessageCount > 0 && <span className="trainer-message-count">{unreadMessageCount}</span>}
            </a>
          </div>
          <div className="trainer-message-list">
            {conversations.length ? conversations.slice(0, 5).map((conversation) => (
              <a className={conversation.unread_count > 0 ? 'unread' : ''} href={`/trainer-chat?memberId=${conversation.user_id}`} key={conversation.user_id}>
                <span className="trainer-message-avatar">{getInitials(conversation)}</span>
                <div>
                  <strong>{conversation.username}</strong>
                  <p>{conversation.last_message}</p>
                  <small>{formatDateTime(conversation.last_message_at)}</small>
                </div>
                {conversation.unread_count > 0 && (
                  <span className="trainer-message-count">{conversation.unread_count}</span>
                )}
              </a>
            )) : (
              <div className="trainer-empty-state">No client messages yet.</div>
            )}
          </div>
        </section>}

        {activeTab === 'programs' && <section className="trainer-programs-section" id="programs">
          <div className="trainer-section-title">
            <div>
              <p className="trainer-eyebrow">Module Management</p>
              <h2>Active Programs</h2>
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
