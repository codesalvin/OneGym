import { useEffect, useMemo, useState } from 'react';
import { NavBar } from '../components/NavBar';
import { Footer } from '../components/Footer';
import './MemberDashboard.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

async function readApiResponse(response, requestUrl = response.url) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    const contentType = response.headers.get('content-type') || 'unknown content type';
    return {
      detail: text.trim().startsWith('<!DOCTYPE')
        ? `API returned HTML from ${requestUrl} (${response.status}, ${contentType}).`
        : text,
    };
  }
}

function formatActivityTime(value) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatIntensity(value) {
  const labels = {
    low: 'Gentle',
    moderate: 'Moderate',
    high: 'High',
  };

  return labels[value] || value || 'Workout';
}

function getWorkoutId(workout) {
  const value = workout?.id ?? workout?.workout_id;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function numberField(...values) {
  const value = values.find((item) => item !== undefined && item !== null && item !== '');
  return value === undefined ? '' : String(value);
}

function resolveMediaUrl(url) {
  if (!url || url === 'camera-capture') {
    return '';
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  const apiRoot = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${apiRoot}${url.startsWith('/') ? url : `/${url}`}`;
}

const emptyMealForm = {
  description: '',
  calories: '',
  protein: '',
  carbs: '',
  fats: '',
};

const sampleMeals = [
  {
    id: 'sample-breakfast',
    meal_type: 'Breakfast',
    description: 'Steel cut oats with blueberries and whey',
    calories: 450,
    photo_url: 'https://lh3.googleusercontent.com/aida/ADBb0ugJxvBTzMxAIJ25FhWUNffMk-9r2MmrSnDCopdVzumpBuYeax7D7CTtHhMUlG8aNgFWQFzf6oGihISHri3axddCHtIHrDe3PcfnFAyme8wmETWT2Yk1D1mLqorwp3ZqNPElpA8dZYe3H9l9t74zsZSHRaZc8Kvc8CJogtThHBGMZ3ElsV2Jpk_-JjBB67QT1nug2eAJyGuwulqre1FEBH8HsM0whQ6Z6pnITciZwFMdytIaUJUl2QZQuo9Q',
  },
  { id: 'sample-lunch', meal_type: 'Lunch', description: 'Grilled chicken breast, quinoa, and avocado', calories: 680 },
  { id: 'sample-dinner', meal_type: 'Dinner', description: 'Baked salmon with roasted asparagus', calories: 520 },
  { id: 'sample-snacks', meal_type: 'Snacks', description: 'Handful of almonds & Greek yogurt', calories: 200 },
];

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
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [activityMessage, setActivityMessage] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [notice, setNotice] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mealForm, setMealForm] = useState(emptyMealForm);
  const [mealPhoto, setMealPhoto] = useState(null);
  const [mealPhotoPreview, setMealPhotoPreview] = useState('');
  const [mealMessage, setMealMessage] = useState('');
  const [isMealError, setIsMealError] = useState(false);
  const [isAnalyzingMeal, setIsAnalyzingMeal] = useState(false);
  const [isSavingMeal, setIsSavingMeal] = useState(false);
  const [loggedMeals, setLoggedMeals] = useState([]);
  const visibleMeals = loggedMeals.length ? loggedMeals : sampleMeals;

  useEffect(() => {
    if (!user?.id) {
      setRecentWorkouts([]);
      return;
    }

    fetch(`${API_BASE_URL}/users/${user.id}/workouts/`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Unable to load recent workouts.');
        }

        return response.json();
      })
      .then((data) => {
        setRecentWorkouts(data);
        setActivityMessage('');
      })
      .catch((error) => {
        setActivityMessage(error.message);
      });
  }, [user?.id]);

  async function loadMeals() {
    if (!user?.id) {
      setLoggedMeals([]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/users/${user.id}/meals/`);
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data.detail || 'Unable to load meals.');
      }

      setLoggedMeals(data);
    } catch {
      setLoggedMeals([]);
    }
  }

  useEffect(() => {
    loadMeals();
  }, [user?.id]);

  function askToDeleteRecentWorkout(workout) {
    const workoutId = getWorkoutId(workout);
    if (!workoutId) {
      setActivityMessage('This workout is missing its database id, so it cannot be deleted yet.');
      return;
    }

    if (!user?.id) {
      setActivityMessage('Please sign in before deleting a workout.');
      return;
    }

    setPendingDelete({
      id: workoutId,
      item: workout,
      title: 'Delete workout',
      body: `Remove "${workout.name}" from your recent activity? This cannot be undone.`,
    });
  }

  async function confirmDeleteRecentWorkout() {
    if (!pendingDelete || !user?.id) {
      return;
    }

    setIsDeleting(true);

    try {
      const endpoint = `${API_BASE_URL}/workouts/delete/`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: user.id, workout_id: pendingDelete.id }),
      });
      const data = await readApiResponse(response, endpoint);

      if (!response.ok) {
        throw new Error(data.detail || 'Unable to delete workout.');
      }

      setRecentWorkouts((current) => current.filter((item) => getWorkoutId(item) !== pendingDelete.id));
      setActivityMessage('');
      setPendingDelete(null);
      setNotice({
        title: 'Workout deleted',
        body: data.detail || 'That workout was removed from your recent activity.',
      });
    } catch (error) {
      setActivityMessage(error.message);
      setPendingDelete(null);
    } finally {
      setIsDeleting(false);
    }
  }

  function updateMealField(event) {
    const { name, value } = event.target;
    setMealForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleMealPhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setMealPhoto(file);
    setMealPhotoPreview(URL.createObjectURL(file));
    setMealMessage('');
    setIsMealError(false);
  }

  async function analyzeMealPhoto() {
    if (!user?.id) {
      setIsMealError(true);
      setMealMessage('Please sign in before analyzing a meal.');
      return;
    }

    if (!mealPhoto) {
      setIsMealError(true);
      setMealMessage('Take or choose a meal photo first.');
      return;
    }

    setIsAnalyzingMeal(true);
    setMealMessage('');
    setIsMealError(false);

    try {
      const formData = new FormData();
      formData.append('user_id', user.id);
      formData.append('meal_photo', mealPhoto);

      const endpoint = `${API_BASE_URL}/meals/analyze/`;
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });
      const data = await readApiResponse(response, endpoint);

      if (!response.ok) {
        throw new Error(data.detail || 'Unable to analyze this meal photo.');
      }

      const protein = numberField(data.protein_g, data.protein, data.proteinGrams);
      const carbs = numberField(data.carbs_g, data.carbs, data.carbohydrates, data.carbohydrates_g);
      const fats = numberField(data.fats_g, data.fats, data.fat_g, data.fat);

      setMealForm({
        description: data.description || mealForm.description,
        calories: numberField(data.calories, data.kcal),
        protein,
        carbs,
        fats,
      });
      setMealMessage(data.detail || 'Meal estimate added to Quick Log.');
    } catch (error) {
      setIsMealError(true);
      setMealMessage(error.message);
    } finally {
      setIsAnalyzingMeal(false);
    }
  }

  async function saveMealLog() {
    if (!user?.id) {
      setIsMealError(true);
      setMealMessage('Please sign in before logging a meal.');
      return;
    }

    if (!mealForm.description.trim() || mealForm.calories === '') {
      setIsMealError(true);
      setMealMessage('Meal description and calories are required.');
      return;
    }

    setIsSavingMeal(true);
    setMealMessage('');
    setIsMealError(false);

    try {
      const endpoint = `${API_BASE_URL}/meals/`;
      const formData = new FormData();
      formData.append('user_id', user.id);
      formData.append('meal_type', 'Quick Log');
      formData.append('description', mealForm.description.trim());
      formData.append('calories', Number(mealForm.calories));

      if (mealForm.protein !== '') {
        formData.append('protein_g', Number(mealForm.protein));
      }

      if (mealForm.carbs !== '') {
        formData.append('carbs_g', Number(mealForm.carbs));
      }

      if (mealForm.fats !== '') {
        formData.append('fats_g', Number(mealForm.fats));
      }

      if (mealPhoto) {
        formData.append('meal_photo', mealPhoto);
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });
      const data = await readApiResponse(response, endpoint);

      if (!response.ok) {
        throw new Error(data.detail || 'Unable to save meal.');
      }

      setMealForm(emptyMealForm);
      setMealPhoto(null);
      setMealPhotoPreview('');
      await loadMeals();
      setMealMessage(data.detail || 'Meal logged successfully.');
    } catch (error) {
      setIsMealError(true);
      setMealMessage(error.message);
    } finally {
      setIsSavingMeal(false);
    }
  }

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
              {activityMessage && (
                <div className="activity-empty">{activityMessage}</div>
              )}

              {!activityMessage && recentWorkouts.length === 0 && (
                <div className="activity-empty">No workouts logged yet.</div>
              )}

              {recentWorkouts.map((workout, index) => (
                <div className={`activity-item ${index === recentWorkouts.length - 1 ? 'item-noborder' : ''}`} key={getWorkoutId(workout) || workout.name}>
                  <div className="activity-icon">
                    <span className="material-symbols-outlined icon-activity">fitness_center</span>
                  </div>
                  <div className="activity-info">
                    <h5 className="activity-name">{workout.name}</h5>
                    <p className="activity-details">
                      {workout.duration_minutes} mins • {workout.calories_burned} kcal • {workout.exercise_count} exercises
                    </p>
                    <span className="activity-time">
                      {formatIntensity(workout.intensity)} • {formatActivityTime(workout.workout_date)}
                    </span>
                  </div>
                  <button
                    aria-label={`Delete ${workout.name}`}
                    className="delete-action"
                    onClick={() => askToDeleteRecentWorkout(workout)}
                    type="button"
                  >
                    <span className="material-symbols-outlined icon-md">delete</span>
                  </button>
                </div>
              ))}

              <button className="activity-footer-btn" onClick={() => { window.location.href = '/log-workout?tab=history'; }}>
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
              <a className="btn btn-outline btn-sm ai-btn" href="/ai-assistant">
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
                  {visibleMeals.map((meal, index) => {
                    const photoUrl = resolveMediaUrl(meal.photo_url);

                    return (
                      <tr key={meal.id}>
                        <td className={index === visibleMeals.length - 1 ? 'last-row-cell' : ''}>
                          <div className="meal-cell-layout">
                            {photoUrl ? (
                              <img alt={meal.meal_type} className="meal-thumb" src={photoUrl} />
                            ) : (
                              <div className="meal-placeholder">
                                <span className="material-symbols-outlined">restaurant</span>
                              </div>
                            )}
                            <div>
                              <div className="meal-type">{meal.meal_type}</div>
                              <div className="meal-desc">{meal.description}</div>
                            </div>
                          </div>
                        </td>
                        <td className={`text-right table-val-cell ${index === visibleMeals.length - 1 ? 'last-row-cell' : ''}`}>
                          {meal.calories} kcal
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="quick-log-card">
              <h3 className="quick-log-title">Quick Log</h3>
              {mealMessage && (
                <p className={`meal-log-message ${isMealError ? 'error' : 'success'}`}>
                  {mealMessage}
                </p>
              )}
              <div className="input-group">
                <label htmlFor="food-name">Meal Description</label>
                <input
                  className="text-input"
                  id="food-name"
                  name="description"
                  onChange={updateMealField}
                  placeholder="e.g. Chicken Salad"
                  type="text"
                  value={mealForm.description}
                />
              </div>
              <div className="input-group">
                <label htmlFor="calories">Calories (kcal)</label>
                <input
                  className="text-input"
                  id="calories"
                  name="calories"
                  onChange={updateMealField}
                  placeholder="e.g. 350"
                  type="number"
                  value={mealForm.calories}
                />
              </div>
              <div className="meal-macro-grid">
                <div className="input-group">
                  <label htmlFor="protein">Protein (g)</label>
                  <input className="text-input" id="protein" name="protein" onChange={updateMealField} placeholder="25" type="number" value={mealForm.protein} />
                </div>
                <div className="input-group">
                  <label htmlFor="carbs">Carbs (g)</label>
                  <input className="text-input" id="carbs" name="carbs" onChange={updateMealField} placeholder="40" type="number" value={mealForm.carbs} />
                </div>
                <div className="input-group">
                  <label htmlFor="fats">Fats (g)</label>
                  <input className="text-input" id="fats" name="fats" onChange={updateMealField} placeholder="12" type="number" value={mealForm.fats} />
                </div>
              </div>
              <div className="input-group">
                <label className="label-caps">Meal Photo</label>
                <div className="photo-upload-container">
                  <input
                    accept="image/*"
                    capture="environment"
                    id="meal-photo"
                    onChange={handleMealPhotoChange}
                    className="hidden-input"
                    type="file"
                  />
                  <label htmlFor="meal-photo" className="upload-label">
                    {mealPhotoPreview ? (
                      <img alt="Selected meal" className="meal-photo-preview" src={mealPhotoPreview} />
                    ) : (
                      <>
                        <span className="material-symbols-outlined icon-lg">add_a_photo</span>
                        <span className="italic-text">Take or upload food photo</span>
                      </>
                    )}
                  </label>
                </div>
              </div>
              <button className="btn btn-outline full-width meal-analyze-button" disabled={isAnalyzingMeal} onClick={analyzeMealPhoto} type="button">
                <span className="material-symbols-outlined">camera</span>
                {isAnalyzingMeal ? 'Estimating' : 'Estimate from Photo'}
              </button>
              <button className="btn btn-primary full-width" disabled={isSavingMeal} onClick={saveMealLog} type="button">
                <span className="material-symbols-outlined">add_circle</span>
                {isSavingMeal ? 'Adding' : 'Add to Log'}
              </button>
            </div>
          </div>
        </section>
      </main>

      {(pendingDelete || notice) && (
        <div className="dashboard-modal-backdrop" role="presentation">
          <div className="dashboard-modal" role="dialog" aria-modal="true">
            <p className="dashboard-modal-eyebrow">{pendingDelete ? 'Confirmation' : 'Status'}</p>
            <h2>{pendingDelete?.title || notice.title}</h2>
            <p>{pendingDelete?.body || notice.body}</p>
            <div className="dashboard-modal-actions">
              {pendingDelete ? (
                <>
                  <button className="ghost" disabled={isDeleting} onClick={() => setPendingDelete(null)} type="button">
                    Back
                  </button>
                  <button disabled={isDeleting} onClick={confirmDeleteRecentWorkout} type="button">
                    {isDeleting ? 'Deleting' : 'Delete Workout'}
                  </button>
                </>
              ) : (
                <button onClick={() => setNotice(null)} type="button">
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}
