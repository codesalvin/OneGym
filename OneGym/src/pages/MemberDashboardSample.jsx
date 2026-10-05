import './MemberDashboardSample.css';

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('onegymUser') || 'null');
  } catch {
    return null;
  }
}

const navItems = [
  ['grid_view', 'Overview'],
  ['event_available', 'Classes'],
  ['fitness_center', 'Training'],
  ['restaurant', 'Food Log'],
  ['smart_toy', 'AI Assistant'],
  ['forum', 'Trainer Chat'],
  ['leaderboard', 'Leaderboards'],
  ['account_circle', 'Profile'],
];

const classes = [
  ['17:30', 'HIIT Training', 'Studio A • Sarah Jenkins', '4 spots left'],
  ['06:00', 'Power Flow Yoga', 'Studio B • Marcus Wei', '8 spots left'],
  ['19:00', 'Spin Class', 'Cycle Room • Daniel Lim', 'Booked'],
];

const activities = [
  ['Push Day', '52 mins • 410 kcal • 6 exercises', 'Moderate • Jun 11, 9:42 PM'],
  ['Leg Day', '64 mins • 530 kcal • 7 exercises', 'High • Jun 10, 6:15 PM'],
  ['Morning Run', '31 mins • 280 kcal • 1 exercise', 'Gentle • Jun 9, 6:58 AM'],
];

const meals = [
  ['Breakfast', 'Oats, banana & whey', 'P 30g • C 62g • F 8g', '520 kcal'],
  ['Lunch', 'Chicken rice bowl', 'P 52g • C 84g • F 18g', '740 kcal'],
  ['Dinner', 'Salmon, potatoes & greens', 'P 52g • C 60g • F 21g', '690 kcal'],
];

export function MemberDashboardSamplePage() {
  const user = getStoredUser() || {};
  const displayName = user.username || user.name || 'Alvin';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="sample-dashboard">
      <aside className="sample-sidebar">
        <a className="sample-brand" href="/member-dashboard">
          <span>OG</span>
          <div>
            <strong>OneGym</strong>
            <small>Member Space</small>
          </div>
        </a>
        <nav>
          {navItems.map(([icon, label], index) => (
            <a className={index === 0 ? 'active' : ''} href="/member-dashboard" key={label}>
              <span className="material-symbols-outlined">{icon}</span>
              {label}
            </a>
          ))}
        </nav>
      </aside>

      <main className="sample-main">
        <header className="sample-topbar">
          <div>
            <h1>Dashboard</h1>
            <p>Welcome back, {displayName}. Here is your fitness overview.</p>
          </div>
          <div className="sample-tools">
            <label>
              <span className="material-symbols-outlined">search</span>
              <input placeholder="Search classes, meals..." />
            </label>
            <button type="button"><span className="material-symbols-outlined">notifications</span></button>
            <a className="sample-avatar" href="/member-dashboard?tab=profile">{initials}</a>
          </div>
        </header>

        <section className="sample-grid">
          <article className="sample-hero card-large">
            <div>
              <p className="eyebrow">Today's Overview</p>
              <h2>Train smarter with<br />OneGym</h2>
              <p>Track your classes, workouts, meals, and weekly progress from one focused dashboard.</p>
              <div className="hero-buttons">
                <button type="button">View Schedule</button>
                <button type="button">Log Meal</button>
              </div>
            </div>
            <div className="fuel-card">
              <small>Daily Fuel</small>
              <div className="fuel-ring"><span>78%</span></div>
              <small>Goal completed</small>
            </div>
          </article>

          <aside className="sample-stat-stack">
            <article className="sample-stat red">
              <span>Current Streak</span>
              <strong>5 <small>Days</small></strong>
              <i className="material-symbols-outlined">local_fire_department</i>
            </article>
            <article className="sample-stat">
              <span>Workouts (30D)</span>
              <strong>14</strong>
              <small>↗ 12% vs last month</small>
            </article>
            <article className="sample-stat yellow">
              <span>Hours Trained</span>
              <strong>11.5</strong>
              <small>This month</small>
            </article>
          </aside>

          <section className="sample-panel classes">
            <div className="panel-head">
              <h3>Upcoming Classes</h3>
              <a href="/member-dashboard?tab=classes">View all</a>
            </div>
            <div className="sample-list">
              {classes.map(([time, title, meta, slots]) => (
                <article className="class-row" key={title}>
                  <time>{time}<small>Today</small></time>
                  <div>
                    <strong>{title}</strong>
                    <span>{meta}</span>
                    <small>{slots}</small>
                  </div>
                  <button className={slots === 'Booked' ? 'ghost' : ''} type="button">{slots === 'Booked' ? 'Booked' : 'Book'}</button>
                  <button className="chat" type="button">Chat</button>
                </article>
              ))}
            </div>
          </section>

          <section className="sample-panel activity">
            <div className="panel-head">
              <h3>Recent Activity</h3>
              <a href="/member-dashboard?tab=training">View all</a>
            </div>
            <div className="sample-list">
              {activities.map(([title, meta, time]) => (
                <article className="activity-row" key={title}>
                  <span className="round-icon material-symbols-outlined">fitness_center</span>
                  <div>
                    <strong>{title}</strong>
                    <span>{meta}</span>
                    <small>{time}</small>
                  </div>
                  <span className="material-symbols-outlined arrow">chevron_right</span>
                </article>
              ))}
            </div>
          </section>

          <section className="sample-panel analytics">
            <div className="panel-head">
              <h3>Progress Analytics</h3>
              <small>Last 7 days</small>
            </div>
            <div className="analytics-strip">
              <article>
                <span>Weight</span>
                <strong>55.0kg</strong>
                <div className="line"><i style={{ width: '58%' }} /></div>
              </article>
              <article>
                <span>Workout Rhythm</span>
                <strong>4 sessions</strong>
                <div className="mini-bars"><i /><i /><i /><i /><i /></div>
              </article>
              <article>
                <span>Calories</span>
                <strong>1,950 kcal</strong>
                <div className="line yellow"><i style={{ width: '78%' }} /></div>
              </article>
              <article>
                <span>Records</span>
                <strong>3 verified</strong>
                <div className="line pink"><i style={{ width: '42%' }} /></div>
              </article>
            </div>
          </section>

          <section className="sample-panel nutrition">
            <div className="panel-head">
              <h3>Today's Nutrition</h3>
              <small>Jun 26, 2026</small>
            </div>
            <div className="nutrition-top">
              <article><span>Daily Goal</span><strong>2,500 <small>kcal</small></strong></article>
              <article><span>Consumed</span><strong>1,950 <small>kcal</small></strong></article>
              <article><span>Remaining</span><strong>550 <small>kcal</small></strong></article>
            </div>
            <div className="macro-row">
              <div><span>Protein <b>142g / 180g</b></span><i style={{ width: '79%' }} /></div>
              <div><span>Carbs <b>210g / 300g</b></span><i style={{ width: '70%' }} /></div>
              <div><span>Fats <b>48g / 65g</b></span><i style={{ width: '74%' }} /></div>
            </div>
            <div className="meal-preview">
              {meals.map(([type, name, macros, kcal]) => (
                <article key={type}>
                  <span className="material-symbols-outlined">restaurant</span>
                  <div>
                    <strong>{type}</strong>
                    <p>{name}</p>
                    <small>{macros}</small>
                  </div>
                  <b>{kcal}</b>
                </article>
              ))}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
