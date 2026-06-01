import { useState } from 'react';
import { Link } from 'react-router';
import { NavBar } from '../components/NavBar';
import { Footer } from '../components/Footer';
import './LogWorkout.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

const emptyExercise = {
  name: '',
  sets: '',
  reps: '',
  weight: '',
};

export function LogWorkoutPage() {
  const [workoutForm, setWorkoutForm] = useState({
    name: '',
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
    const user = JSON.parse(localStorage.getItem('onegymUser') || '{}');
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

    if (!workoutForm.name.trim() || !workoutForm.durationMinutes || !workoutForm.caloriesBurned) {
      setIsError(true);
      setMessage('Workout name, duration, and calories are required.');
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
        durationMinutes: '',
        intensity: 'low',
        caloriesBurned: '',
      });
      setExercises([{ ...emptyExercise, id: crypto.randomUUID() }]);
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
        </div>
      </main>
      <Footer />
    </>
  );
}
