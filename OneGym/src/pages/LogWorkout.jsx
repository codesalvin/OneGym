import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { NavBar } from '../components/NavBar';
import { Footer } from '../components/Footer';
import './LogWorkout.css';

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
        ? `Workout API returned HTML from ${requestUrl} (${response.status}, ${contentType}).`
        : text,
    };
  }
}

const emptyExercise = {
  name: '',
  sets: '',
  reps: '',
  weight: '',
};

function toDateInputValue(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatHistoryDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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

export function LogWorkoutPage() {
  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('onegymUser') || '{}');
    } catch {
      return {};
    }
  }, []);
  const [user, setUser] = useState(storedUser);
  const todayDate = toDateInputValue();
  const registrationDate = toDateInputValue(user?.created_at) || todayDate;
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') === 'history' ? 'history' : 'log';
  });
  const [history, setHistory] = useState([]);
  const [historyMessage, setHistoryMessage] = useState('');
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [workoutForm, setWorkoutForm] = useState({
    name: '',
    workoutDate: todayDate,
    durationMinutes: '',
    intensity: 'low',
    caloriesBurned: '',
  });
  const [exercises, setExercises] = useState([
    {
      ...emptyExercise,
      id: crypto.randomUUID(),
    },
  ]);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [notice, setNotice] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!storedUser?.id || storedUser.created_at) {
      return;
    }

    fetch(`${API_BASE_URL}/users/${storedUser.id}/`)
      .then((response) => response.json())
      .then((data) => {
        if (!data?.id) {
          return;
        }

        const mergedUser = {
          ...storedUser,
          ...data,
        };
        setUser(mergedUser);
        localStorage.setItem('onegymUser', JSON.stringify(mergedUser));
      })
      .catch(() => {});
  }, [storedUser]);

  useEffect(() => {
    if (workoutForm.workoutDate < registrationDate) {
      setWorkoutForm((current) => ({
        ...current,
        workoutDate: registrationDate,
      }));
    }
  }, [registrationDate, workoutForm.workoutDate]);

  async function loadHistory() {
    if (!user.id) {
      setHistory([]);
      setHistoryMessage('Please sign in to view training history.');
      setHistoryLoaded(true);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/users/${user.id}/workouts/?limit=all`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Unable to load training history.');
      }

      setHistory(data);
      setHistoryMessage('');
      setHistoryLoaded(true);
    } catch (error) {
      setHistoryMessage(error.message);
      setHistoryLoaded(true);
    }
  }

  useEffect(() => {
    if (activeTab === 'history' && !historyLoaded) {
      loadHistory();
    }
  }, [activeTab, historyLoaded]);

  function showHistory() {
    setActiveTab('history');
  }

  function askToDeleteWorkout(workout) {
    const workoutId = getWorkoutId(workout);
    if (!workoutId) {
      setHistoryMessage('This workout is missing its database id, so it cannot be deleted yet.');
      return;
    }

    if (!user.id) {
      setHistoryMessage('Please sign in before deleting a workout.');
      return;
    }

    setPendingDelete({
      id: workoutId,
      item: workout,
      title: 'Delete workout',
      body: `Remove "${workout.name}" from your training history? This cannot be undone.`,
    });
  }

  async function confirmDeleteWorkout() {
    if (!pendingDelete || !user.id) {
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

      setHistory((current) => current.filter((item) => getWorkoutId(item) !== pendingDelete.id));
      setHistoryMessage('');
      setPendingDelete(null);
      setNotice({
        title: 'Workout deleted',
        body: data.detail || 'That workout was removed from your training history.',
      });
    } catch (error) {
      setHistoryMessage(error.message);
      setPendingDelete(null);
    } finally {
      setIsDeleting(false);
    }
  }

  function updateWorkoutField(event) {
    const { name, value } = event.target;
    setWorkoutForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function addExercise() {
    setExercises((current) => [
      ...current,
      {
        ...emptyExercise,
        id: crypto.randomUUID(),
      },
    ]);
  }

  function updateExercise(id, field, value) {
    setExercises((current) =>
      current.map((exercise) =>
        exercise.id === id
          ? {
              ...exercise,
              [field]: value,
            }
          : exercise,
      ),
    );
  }

  function removeExercise(id) {
    setExercises((current) => current.filter((exercise) => exercise.id !== id));
  }

  async function handleSaveWorkout() {
    const validExercises = exercises
      .map((exercise) => ({
        ...exercise,
        name: exercise.name.trim(),
      }))
      .filter((exercise) => exercise.name)
      .map((exercise) => ({
        exercise_name: exercise.name,
        sets: Number(exercise.sets) || 0,
        reps: Number(exercise.reps) || 0,
        weight: Number(exercise.weight) || 0,
      }));

    if (!user.id) {
      setIsError(true);
      setMessage('Please sign in before saving a workout.');
      return;
    }

    if (!workoutForm.name.trim() || !workoutForm.workoutDate || !workoutForm.durationMinutes || !workoutForm.caloriesBurned) {
      setIsError(true);
      setMessage('Workout name, date, duration, and calories are required.');
      return;
    }

    if (workoutForm.workoutDate < registrationDate) {
      setIsError(true);
      setMessage('Workout date cannot be before your registration date.');
      return;
    }

    if (workoutForm.workoutDate > todayDate) {
      setIsError(true);
      setMessage('Workout date cannot be in the future.');
      return;
    }

    if (!validExercises.length) {
      setIsError(true);
      setMessage('Add at least one exercise name before saving.');
      return;
    }

    setIsSaving(true);
    setMessage('');
    setIsError(false);

    try {
      const response = await fetch(`${API_BASE_URL}/workouts/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          name: workoutForm.name.trim(),
          duration_minutes: Number(workoutForm.durationMinutes),
          intensity: workoutForm.intensity,
          calories_burned: Number(workoutForm.caloriesBurned),
          workout_date: `${workoutForm.workoutDate}T12:00:00`,
          exercises: validExercises,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Unable to save workout.');
      }

      setMessage(data.detail || 'Workout saved successfully.');
      setWorkoutForm({
        name: '',
        workoutDate: todayDate < registrationDate ? registrationDate : todayDate,
        durationMinutes: '',
        intensity: 'low',
        caloriesBurned: '',
      });
      setExercises([{ ...emptyExercise, id: crypto.randomUUID() }]);
      setHistoryLoaded(false);
      await loadHistory();
    } catch (error) {
      setIsError(true);
      setMessage(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <NavBar />
      <main className="log-workout-page">
        <header className="log-workout-header">
          <Link className="log-workout-back" to="/member-dashboard">
            <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
            Dashboard
          </Link>
          <div className="log-workout-title-wrap">
            <p className="log-workout-eyebrow">Wellness Sanctuary</p>
            <h1>Log Your Progress</h1>
          </div>
          <div className="log-workout-header-spacer" />
        </header>

        <div className="log-workout-shell">
          <p className="log-workout-intro">
            Document your journey with intentionality. Every set, every breath, and every calorie burned brings you closer to your center.
          </p>

          <div className="log-workout-tabs" aria-label="Workout views">
            <button className={activeTab === 'log' ? 'active' : ''} onClick={() => setActiveTab('log')} type="button">
              Log Workout
            </button>
            <button className={activeTab === 'history' ? 'active' : ''} onClick={showHistory} type="button">
              Training History
            </button>
          </div>

          {activeTab === 'log' ? (
            <>
              <section className="log-workout-meta" aria-label="Workout details">
                <div className="log-workout-grid">
                  <label className="log-workout-field wide">
                    <span>Workout Name</span>
                    <input
                      name="name"
                      onChange={updateWorkoutField}
                      placeholder="e.g., Heavy Lift, Yoga Flow"
                      type="text"
                      value={workoutForm.name}
                    />
                  </label>

                  <label className="log-workout-field">
                    <span>Workout Date</span>
                    <input
                      max={todayDate}
                      min={registrationDate}
                      name="workoutDate"
                      onChange={updateWorkoutField}
                      type="date"
                      value={workoutForm.workoutDate}
                    />
                  </label>

                  <label className="log-workout-field">
                    <span>Duration (Min)</span>
                    <input
                      name="durationMinutes"
                      onChange={updateWorkoutField}
                      placeholder="45"
                      type="number"
                      value={workoutForm.durationMinutes}
                    />
                  </label>

                  <label className="log-workout-field">
                    <span>Intensity</span>
                    <select name="intensity" onChange={updateWorkoutField} value={workoutForm.intensity}>
                      <option value="low">Gentle / Restorative</option>
                      <option value="moderate">Moderate / Flow</option>
                      <option value="high">High / Peak Power</option>
                    </select>
                  </label>

                  <label className="log-workout-field wide">
                    <span>Calories Burned (Est.)</span>
                    <input
                      name="caloriesBurned"
                      onChange={updateWorkoutField}
                      placeholder="320"
                      type="number"
                      value={workoutForm.caloriesBurned}
                    />
                  </label>
                </div>
              </section>

              {message && (
                <p className={`log-workout-message ${isError ? 'error' : 'success'}`}>
                  {message}
                </p>
              )}

              <section className="log-exercises" aria-label="Exercises">
                <div className="log-section-header">
                  <h2>Exercises</h2>
                  <button className="log-add-exercise" onClick={addExercise} type="button">
                    <span className="material-symbols-outlined" aria-hidden="true">add</span>
                    Add Exercise
                  </button>
                </div>

                <div className="log-exercise-list">
                  {exercises.map((exercise) => (
                    <article className="log-exercise-card" key={exercise.id}>
                      <label className="log-workout-field exercise-name">
                        <span>Exercise Name</span>
                        <input
                          onChange={(event) => updateExercise(exercise.id, 'name', event.target.value)}
                          placeholder="Barbell Squat"
                          type="text"
                          value={exercise.name}
                        />
                      </label>

                      <label className="log-workout-field compact">
                        <span>Sets</span>
                        <input
                          onChange={(event) => updateExercise(exercise.id, 'sets', event.target.value)}
                          placeholder="3"
                          type="number"
                          value={exercise.sets}
                        />
                      </label>

                      <label className="log-workout-field compact">
                        <span>Reps</span>
                        <input
                          onChange={(event) => updateExercise(exercise.id, 'reps', event.target.value)}
                          placeholder="12"
                          type="number"
                          value={exercise.reps}
                        />
                      </label>

                      <label className="log-workout-field compact weight">
                        <span>Weight (lb)</span>
                        <input
                          onChange={(event) => updateExercise(exercise.id, 'weight', event.target.value)}
                          placeholder="135"
                          type="number"
                          value={exercise.weight}
                        />
                      </label>

                      <button
                        className="log-remove-exercise"
                        onClick={() => removeExercise(exercise.id)}
                        type="button"
                        aria-label="Remove exercise"
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                      </button>
                    </article>
                  ))}
                </div>
              </section>

              <footer className="log-workout-actions">
                <button className="log-save-button" disabled={isSaving} onClick={handleSaveWorkout} type="button">
                  {isSaving ? 'Saving Workout' : 'Save Workout'}
                </button>
              </footer>
            </>
          ) : (
            <section className="training-history" aria-label="Training history">
              {historyMessage && <p className="log-workout-message error">{historyMessage}</p>}

              {!historyMessage && history.length === 0 && (
                <div className="training-history-empty">No workouts logged yet.</div>
              )}

              {history.map((workout) => (
                <article className="training-history-row" key={getWorkoutId(workout) || workout.name}>
                  <div>
                    <p className="training-history-date">{formatHistoryDate(workout.workout_date)}</p>
                    <h2>{workout.name}</h2>
                    <p>{formatIntensity(workout.intensity)} intensity</p>
                  </div>
                  <div className="training-history-stats">
                    <span>{workout.duration_minutes} min</span>
                    <span>{workout.calories_burned} kcal</span>
                    <span>{workout.exercise_count} exercises</span>
                  </div>
                  <button
                    aria-label={`Delete ${workout.name}`}
                    className="training-history-delete"
                    onClick={() => askToDeleteWorkout(workout)}
                    type="button"
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                  </button>
                </article>
              ))}
            </section>
          )}
        </div>
      </main>

      {(pendingDelete || notice) && (
        <div className="workout-modal-backdrop" role="presentation">
          <div className="workout-modal" role="dialog" aria-modal="true">
            <p className="log-workout-eyebrow">{pendingDelete ? 'Confirmation' : 'Status'}</p>
            <h2>{pendingDelete?.title || notice.title}</h2>
            <p>{pendingDelete?.body || notice.body}</p>
            <div className="workout-modal-actions">
              {pendingDelete ? (
                <>
                  <button className="ghost" disabled={isDeleting} onClick={() => setPendingDelete(null)} type="button">
                    Back
                  </button>
                  <button disabled={isDeleting} onClick={confirmDeleteWorkout} type="button">
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
