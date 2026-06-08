import { useMemo } from 'react';
import './TrainerDashboard.css';

const clients = [
  { initials: 'ER', name: 'Elena Rodriguez', goal: 'Functional Strength', progress: 88, next: 'Today, 08:00' },
  { initials: 'MC', name: 'Marcus Chen', goal: 'Mobility Flow', progress: 74, next: 'Today, 10:30' },
  { initials: 'SL', name: 'Sophia Laurent', goal: 'HIIT Circuit', progress: 91, next: 'Today, 13:00' },
  { initials: 'JT', name: 'Julianne Thorne', goal: 'Hypertrophy', progress: 96, next: 'Today, 16:00' },
];

const schedule = [
  { time: '08:00', client: 'Elena Rodriguez', session: 'Functional Strength', state: 'Complete' },
  { time: '10:30', client: 'Marcus Chen', session: 'Mobility Flow', state: 'Start' },
  { time: '13:00', client: 'Sophia Laurent', session: 'HIIT Circuit', state: 'Queued' },
  { time: '16:00', client: 'Julianne Thorne', session: 'Leg Day A', state: 'Queued' },
];

const programs = [
  { icon: 'bolt', title: 'Metabolic Prime', clients: 12, description: 'High-intensity conditioning for advanced athletes.' },
  { icon: 'balance', title: 'Foundations 101', clients: 8, description: 'Movement fundamentals with corrective exercise focus.' },
  { icon: 'fitness_center', title: 'Power & Load', clients: 15, description: 'Progressive overload cycles for compound strength.' },
  { icon: 'self_improvement', title: 'Resilience Flow', clients: 32, description: 'Mobility and recovery sessions for rest days.' },
];

export function TrainerDashboardPage() {
  const trainerName = useMemo(() => {
    const storedUser = localStorage.getItem('onegymUser');
    if (!storedUser) {
      return 'Trainer';
    }

    const user = JSON.parse(storedUser);
    return user.username || user.email?.split('@')[0] || 'Trainer';
  }, []);

  return (
    <div className="trainer-dashboard-page">
      <aside className="trainer-sidebar">
        <a className="trainer-brand" href="/">OneGym</a>
        <p>Trainer Portal</p>
        <nav>
          <a className="active" href="/trainer-dashboard"><span className="material-symbols-outlined">dashboard</span>Overview</a>
          <a href="#clients"><span className="material-symbols-outlined">group</span>Clients</a>
          <a href="#schedule"><span className="material-symbols-outlined">calendar_today</span>Schedule</a>
          <a href="#programs"><span className="material-symbols-outlined">fitness_center</span>Programs</a>
          <a href="#messages"><span className="material-symbols-outlined">chat_bubble</span>Messages</a>
        </nav>
        <button type="button">
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
            <button aria-label="Notifications" type="button"><span className="material-symbols-outlined">notifications</span></button>
            <button aria-label="Settings" type="button"><span className="material-symbols-outlined">settings</span></button>
            <div className="trainer-avatar">TR</div>
          </div>
        </header>

        <section className="trainer-kpi-grid">
          <article>
            <p>Total Clients</p>
            <strong>24</strong>
            <span><i className="material-symbols-outlined">trending_up</i>+2 this month</span>
          </article>
          <article>
            <p>Sessions This Week</p>
            <strong>42</strong>
            <span>85% capacity reached</span>
          </article>
          <article>
            <p>Avg Client Progress</p>
            <strong>92%</strong>
            <div className="trainer-progress-track"><i style={{ width: '92%' }}></i></div>
          </article>
        </section>

        <section className="trainer-work-grid">
          <article className="trainer-spotlight-card">
            <div className="trainer-spotlight-image">
              <img alt="Featured client training" src="https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1100&q=85" />
              <div>
                <p>Featured Client</p>
                <h2>Julianne Thorne</h2>
              </div>
            </div>
            <footer>
              <span><small>Goal</small><strong>Hypertrophy</strong></span>
              <span><small>Streak</small><strong>14 Weeks</strong></span>
              <span><small>Next Session</small><strong>Today, 4PM</strong></span>
            </footer>
          </article>

          <article className="trainer-schedule-panel" id="schedule">
            <div className="trainer-panel-heading">
              <h2>Today's Schedule</h2>
              <button aria-label="More schedule options" type="button"><span className="material-symbols-outlined">more_horiz</span></button>
            </div>
            <div className="trainer-schedule-list-real">
              {schedule.map((item) => (
                <div className="trainer-session-row" key={`${item.time}-${item.client}`}>
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
              ))}
            </div>
            <a href="#schedule">View Full Calendar</a>
          </article>
        </section>

        <section className="trainer-clients-section" id="clients">
          <div className="trainer-section-title">
            <div>
              <p className="trainer-eyebrow">Client Management</p>
              <h2>Active Clients</h2>
            </div>
            <button type="button">Add Client</button>
          </div>
          <div className="trainer-client-grid">
            {clients.map((client) => (
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
            ))}
          </div>
        </section>

        <section className="trainer-programs-section" id="programs">
          <div className="trainer-section-title">
            <div>
              <p className="trainer-eyebrow">Module Management</p>
              <h2>Active Programs</h2>
            </div>
            <a href="#programs">Browse Library</a>
          </div>
          <div className="trainer-program-grid-real">
            {programs.map((program) => (
              <article key={program.title}>
                <span className="material-symbols-outlined">{program.icon}</span>
                <h3>{program.title}</h3>
                <p>{program.description}</p>
                <footer>
                  <small>{program.clients} Clients</small>
                  <button type="button">Assign</button>
                </footer>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
