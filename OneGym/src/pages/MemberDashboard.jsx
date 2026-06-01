import { useMemo } from 'react';
import { NavBar } from '../components/NavBar';
import { Footer } from '../components/Footer';
import './MemberDashboard.css';

export function MemberDashboardPage() {
  const user = useMemo(() => {
    try {
      const storedUser = localStorage.getItem('onegymUser');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  }, []);
  const displayName = user?.username || user?.email?.split('@')[0] || 'Member';

  return (
    <>
      <NavBar />

      {/* Main Content Dashboard */}
      <main className="dashboard-container">
        
        {/* Welcome Block */}
        <section className="welcome-section">
          <div className="welcome-text">
            <div className="member-badge">
              <span className="dot"></span>
              <span className="badge-text">Active Member</span>
            </div>
            <h1 className="welcome-title">Welcome back, {displayName}</h1>
            <p className="welcome-subtitle">Ready to pursue excellence in today's training session?</p>
          </div>
          <div className="action-buttons">
            <button className="btn btn-outline" onClick={() => { window.location.href = '/booking'; }}>
              <span className="material-symbols-outlined">fitness_center</span>
              Book Class
            </button>
            <button className="btn btn-primary" onClick={() => { window.location.href = '/log-workout'; }}>
              <span className="material-symbols-outlined">add</span>
              Log Workout
            </button>
          </div>
        </section>

        {/* Analytics Statistics Grid */}
        <section className="stats-grid">
          <div className="stat-card">
            <h3 className="stat-card-label">Current Streak</h3>
            <div className="stat-value-group">
              <span className="stat-value">12</span>
              <span className="stat-unit">Days</span>
            </div>
            <div className="stat-progress-bar">
              <div className="progress-fill" style={{ width: '80%' }}></div>
            </div>
          </div>

          <div className="stat-card">
            <h3 className="stat-card-label">Workouts (30d)</h3>
            <div className="stat-value-group">
              <span className="stat-value">24</span>
            </div>
            <p className="stat-trend">
              <span className="material-symbols-outlined icon-inline">trending_up</span>
              +15% vs last month
            </p>
          </div>

          <div className="stat-card stat-card-chart">
            <h3 className="stat-card-label">Hours Trained</h3>
            <div className="stat-value-group val-margin">
              <span className="stat-value">36.5</span>
            </div>
            <div className="chart-wrapper">
              <svg preserveAspectRatio="none" className="chart-svg" viewBox="0 0 100 40">
                <defs>
                  <linearGradient id="chartFill" x1="0%" x2="0%" y1="0%" y2="100%">
                    <stop offset="0%" style={{ stopColor: 'rgba(26,26,26,0.1)', stopOpacity: 1 }}></stop>
                    <stop offset="100%" style={{ stopColor: 'rgba(26,26,26,0)', stopOpacity: 0 }}></stop>
                  </linearGradient>
                </defs>
                <path className="chart-gradient" d="M0,40 L0,20 Q15,10 25,25 T50,15 T75,25 T100,10 L100,40 Z"></path>
                <path d="M0,20 Q15,10 25,25 T50,15 T75,25 T100,10" fill="none" stroke="var(--color-primary)" strokeWidth="1.5"></path>
              </svg>
            </div>
          </div>
        </section>

        {/* Dashboard Split Columns */}
        <div className="content-columns">
          
          {/* Left Column: Classes */}
          <section className="classes-column">
            <div className="focus-banner">
              <img 
                alt="Focus" 
                className="focus-banner-img" 
                src="https://lh3.googleusercontent.com/aida/ADBb0uiOcNmOHrQ6iY6cOYhMhcfPwzXbvhx2e46nMHFoK4VsppI4ee_Dzah42MSYlMbohwb4ryKKK4DPLKT-N9I2lytrM3UNTSWJ5LGH7rDDtA3tNlvJatbQ_rUBW_t7aSdAwdAXH1gK-VDHgrYoU5I6BsRDkbZLiEUmcoPEtQLZbpEqtyk2RHk8bZHzaUs86S6tGRV4V1D7xiycaumKA6ZvwjD4PR89pJJLE0e4vRep_sVpmct_gpDpoLrJ1Q" 
              />
              <div className="focus-banner-overlay">
                <h3 className="focus-banner-title">Find Your Flow</h3>
              </div>
            </div>

            <div className="section-header">
              <h2 className="section-title">Upcoming Classes</h2>
              <a className="view-all-link" href="/booking">
                View Schedule <span className="material-symbols-outlined icon-inline">arrow_forward</span>
              </a>
            </div>

            <div className="classes-grid">
              <div className="class-card">
                <div className="class-card-top">
                  <span className="class-time-badge">17:30 TODAY</span>
                  <span className="material-symbols-outlined icon-muted">timer</span>
                </div>
                <div>
                  <h4 className="class-title">High-Intensity Interval Training</h4>
                  <p className="class-meta">Studio A • Sarah Jenkins</p>
                </div>
                <div className="class-card-footer">
                  <div className="attendee-stack">
                    <div className="attendee-avatar"></div>
                    <div className="attendee-avatar avatar-offset"></div>
                    <div className="attendee-count">+12</div>
                  </div>
                  <button className="btn btn-outline btn-sm">Joined</button>
                </div>
              </div>

              <div className="class-card">
                <div className="class-card-top">
                  <span className="class-time-badge class-time-outline">06:00 TOMORROW</span>
                </div>
                <div>
                  <h4 className="class-title">Power Flow Yoga</h4>
                  <p className="class-meta">Studio B • Marcus Wei</p>
                </div>
                <div className="class-card-footer">
                  <div className="spots-left">
                    <span className="material-symbols-outlined icon-sm">group</span> 8 spots left
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => { window.location.href = '/booking'; }}>Book</button>
                </div>
              </div>
            </div>
          </section>

          {/* Right Column: Activity History */}
          <section className="activity-column">
            <h2 className="section-title border-title">Recent Activity</h2>
            <div className="activity-card">
              <div className="activity-item">
                <div className="activity-icon">
                  <span className="material-symbols-outlined icon-activity">directions_run</span>
                </div>
                <div className="activity-info">
                  <h5 className="activity-name">Treadmill Sprint</h5>
                  <p className="activity-details">45 mins • 600 kcal</p>
                  <span className="activity-time">Yesterday, 18:45</span>
                </div>
                <button className="delete-action">
                  <span className="material-symbols-outlined icon-md">delete</span>
                </button>
              </div>

              <div className="activity-item">
                <div className="activity-icon">
                  <span className="material-symbols-outlined icon-activity">fitness_center</span>
                </div>
                <div className="activity-info">
                  <h5 className="activity-name">Upper Strength</h5>
                  <p className="activity-details">60 mins • 12,000 lbs</p>
                  <span className="activity-time">Oct 24, 07:00</span>
                </div>
                <button className="delete-action">
                  <span className="material-symbols-outlined icon-md">delete</span>
                </button>
              </div>

              <div className="activity-item item-noborder">
                <div className="activity-icon">
                  <span className="material-symbols-outlined icon-activity">self_improvement</span>
                </div>
                <div className="activity-info">
                  <h5 className="activity-name">Recovery Yoga</h5>
                  <p className="activity-details">30 mins • Active</p>
                  <span className="activity-time">Oct 22, 19:30</span>
                </div>
                <button className="delete-action">
                  <span className="material-symbols-outlined icon-md">delete</span>
                </button>
              </div>

              <button className="activity-footer-btn">
                Full Training History
              </button>
            </div>
          </section>
        </div>

        {/* Nutrition Log Section */}
        <section className="nutrition-section">
          <div className="section-header">
            <h2 className="section-title">Nutrition &amp; Calorie Logger</h2>
            <div className="view-all-link history-actions">
              Oct 25, 2024
              <button className="btn-history">View History</button>
              <a className="btn btn-outline btn-sm ai-btn" href="#">
                <span className="material-symbols-outlined icon-ai">smart_toy</span>
                <span>Consult AI Assistant</span>
              </a>
            </div>
          </div>

          <div className="nutrition-overview">
            <div className="nutrition-card custom-relative">
              <span className="material-symbols-outlined card-setting-icon">settings</span>
              <h3 className="nutrition-card-title">Daily Goal</h3>
              <div className="nutrition-card-value">2,500 <span className="nutrition-card-unit">kcal</span></div>
            </div>

            <div className="nutrition-card">
              <h3 className="nutrition-card-title">Consumed</h3>
              <div className="nutrition-card-value">1,850 <span className="nutrition-card-unit">kcal</span></div>
            </div>

            <div className="nutrition-card border-left-accent">
              <div className="remaining-wrapper">
                <div>
                  <h3 className="nutrition-card-title">Remaining</h3>
                  <div className="nutrition-card-value">650 <span className="nutrition-card-unit">kcal</span></div>
                </div>
                <div className="progress-ring-container">
                  <svg className="progress-ring" height="60" width="60">
                    <circle className="progress-ring__circle" cx="30" cy="30" fill="transparent" r="25" stroke="#e8e8e8" strokeWidth="4"></circle>
                    <circle className="progress-ring__circle ring-fill" cx="30" cy="30" fill="transparent" r="25" stroke="var(--color-accent-lime)" strokeWidth="4"></circle>
                  </svg>
                  <span className="progress-percentage">74%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Macro Component Displays */}
          <div className="macro-tracker">
            <div className="macro-item">
              <div className="macro-header">
                <span>Protein</span>
                <span>145g / 180g</span>
              </div>
              <div className="macro-bar">
                <div className="macro-fill" style={{ width: '80%', backgroundColor: 'var(--color-protein)' }}></div>
              </div>
            </div>

            <div className="macro-item">
              <div className="macro-header">
                <span>Carbohydrates</span>
                <span>210g / 300g</span>
              </div>
              <div className="macro-bar">
                <div className="macro-fill" style={{ width: '70%', backgroundColor: 'var(--color-carbs)' }}></div>
              </div>
            </div>

            <div className="macro-item">
              <div className="macro-header">
                <span>Fats</span>
                <span>48g / 65g</span>
              </div>
              <div className="macro-bar">
                <div className="macro-fill" style={{ width: '74%', backgroundColor: 'var(--color-fats)' }}></div>
              </div>
            </div>
          </div>

          {/* Table Meal Listings & Quick Logger inputs */}
          <div className="food-log-container">
            <div className="food-log-content">
              <h3 className="nutrition-card-title bottom-margin">Today's Meals</h3>
              <table className="food-log-table">
                <thead>
                  <tr>
                    <th>Meal</th>
                    <th className="text-right">Calories</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div className="meal-cell-layout">
                        <img 
                          alt="Breakfast" 
                          className="meal-thumb" 
                          src="https://lh3.googleusercontent.com/aida/ADBb0ugJxvBTzMxAIJ25FhWUNffMk-9r2MmrSnDCopdVzumpBuYeax7D7CTtHhMUlG8aNgFWQFzf6oGihISHri3axddCHtIHrDe3PcfnFAyme8wmETWT2Yk1D1mLqorwp3ZqNPElp8dZYe3H9l9t74zsZSHRaZc8Kvc8CJogtThHBGMZ3ElsV2Jpk_-JjBB67QT1nug2eAJyGuwulqre1FEBH8HsM0whQ6Z6pnITciZwFMdytIaUJUl2QZQuo9Q" 
                        />
                        <div>
                          <div className="meal-type">Breakfast</div>
                          <div className="meal-desc">Steel cut oats with blueberries and whey</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right table-val-cell">
                      450 kcal
                      <button className="delete-action table-delete-pos">
                        <span className="material-symbols-outlined icon-sm-md">delete</span>
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div className="meal-cell-layout">
                        <div className="meal-placeholder">
                          <span className="material-symbols-outlined">restaurant</span>
                        </div>
                        <div>
                          <div className="meal-type">Lunch</div>
                          <div className="meal-desc">Grilled chicken breast, quinoa, and avocado</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right table-val-cell">
                      680 kcal
                      <button className="delete-action table-delete-pos">
                        <span className="material-symbols-outlined icon-sm-md">delete</span>
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div className="meal-cell-layout">
                        <div className="meal-placeholder">
                          <span className="material-symbols-outlined">restaurant</span>
                        </div>
                        <div>
                          <div className="meal-type">Dinner</div>
                          <div className="meal-desc">Baked salmon with roasted asparagus</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right table-val-cell">
                      520 kcal
                      <button className="delete-action table-delete-pos">
                        <span className="material-symbols-outlined icon-sm-md">delete</span>
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td className="last-row-cell">
                      <div className="meal-cell-layout">
                        <div className="meal-placeholder">
                          <span className="material-symbols-outlined">restaurant</span>
                        </div>
                        <div>
                          <div className="meal-type">Snacks</div>
                          <div className="meal-desc">Handful of almonds &amp; Greek yogurt</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right table-val-cell last-row-cell">
                      200 kcal
                      <button className="delete-action table-delete-pos">
                        <span className="material-symbols-outlined icon-sm-md">delete</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="quick-log-card">
              <h3 className="quick-log-title">Quick Log</h3>
              <div className="input-group">
                <label htmlFor="food-name">Meal Description</label>
                <input className="text-input" id="food-name" placeholder="e.g. Chicken Salad" type="text" />
              </div>
              <div className="input-group">
                <label htmlFor="calories">Calories (kcal)</label>
                <input className="text-input" id="calories" placeholder="e.g. 350" type="number" />
              </div>
              <div className="input-group">
                <label className="label-caps">Meal Photo</label>
                <div className="photo-upload-container">
                  <input accept="image/*" id="meal-photo" onChange={() => console.log('File uploaded')} className="hidden-input" type="file" />
                  <label htmlFor="meal-photo" className="upload-label">
                    <span className="material-symbols-outlined icon-lg">add_a_photo</span>
                    <span className="italic-text">Click to upload photo</span>
                  </label>
                </div>
              </div>
              <button className="btn btn-primary full-width">
                <span className="material-symbols-outlined">add_circle</span>
                Add to Log
              </button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
