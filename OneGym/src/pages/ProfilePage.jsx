import { useEffect, useMemo, useState } from 'react';
import { NavBar } from '../components/NavBar';
import './ProfilePage.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
const emptyPrForm = {
  exercise_name: '',
  category: 'Strength',
  record_type: 'weight',
  value: '',
  unit: 'kg',
  recorded_at: new Date().toISOString().slice(0, 10),
  notes: '',
};

async function readApiResponse(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('onegymUser') || '{}');
  } catch {
    return {};
  }
}

function getInitials(user) {
  const name = user?.username || user?.email || 'Member';
  return name
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function resolveMediaUrl(url) {
  if (!url) {
    return '';
  }

  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) {
    return url;
  }

  const apiRoot = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${apiRoot}${url.startsWith('/') ? url : `/${url}`}`;
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function suggestDailyFuel(form) {
  const currentWeight = numberValue(form.current_weight);
  const goalWeight = numberValue(form.goal_weight);
  const weeklyGoal = numberValue(form.weekly_goal);
  const weeklySessions = numberValue(form.weekly_target);
  const style = form.training_style;

  if (!currentWeight) {
    return null;
  }

  const direction = goalWeight
    ? Math.sign(goalWeight - currentWeight)
    : form.weight_goal === 'Lose weight' ? -1 : form.weight_goal === 'Gain weight' ? 1 : 0;
  const styleMultiplier = {
    Strength: 34,
    Hypertrophy: 36,
    'Fat loss': 30,
    Mobility: 29,
    'Athletic conditioning': 37,
  }[style] || 32;
  const sessionAdjustment = weeklySessions >= 5 ? 2 : weeklySessions >= 3 ? 1 : weeklySessions <= 1 ? -1 : 0;
  const maintenance = Math.round(currentWeight * (styleMultiplier + sessionAdjustment));
  const weeklyAdjustment = weeklyGoal ? Math.round((7700 * Math.abs(weeklyGoal)) / 7) * direction : 0;
  const calories = Math.max(1200, maintenance + weeklyAdjustment);
  const proteinMultiplier = {
    Strength: 1.9,
    Hypertrophy: 2,
    'Fat loss': 2.2,
    Mobility: 1.6,
    'Athletic conditioning': 1.8,
  }[style] || (direction < 0 ? 2.1 : 1.8);
  const fatMultiplier = {
    Strength: 0.8,
    Hypertrophy: 0.75,
    'Fat loss': 0.7,
    Mobility: 0.85,
    'Athletic conditioning': 0.75,
  }[style] || 0.8;
  const protein = Math.round(currentWeight * proteinMultiplier);
  const fats = Math.round(currentWeight * fatMultiplier);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fats * 9) / 4));

  return {
    calorie_goal: calories,
    protein_goal: protein,
    carbs_goal: carbs,
    fats_goal: fats,
  };
}

export function ProfilePage() {
  const storedUser = useMemo(() => getStoredUser(), []);
  const [profile, setProfile] = useState(storedUser);
  const [form, setForm] = useState({
    username: storedUser.username || '',
    fitness_goal: storedUser.fitness_goal || '',
    training_style: storedUser.training_style || '',
    weekly_target: storedUser.weekly_target || 3,
    weight_goal: storedUser.weight_goal || '',
    starting_weight: storedUser.starting_weight || '',
    current_weight: storedUser.current_weight || '',
    goal_weight: storedUser.goal_weight || '',
    weekly_goal: storedUser.weekly_goal || '',
    calorie_goal: storedUser.calorie_goal || 2500,
    protein_goal: storedUser.protein_goal || 180,
    carbs_goal: storedUser.carbs_goal || 300,
    fats_goal: storedUser.fats_goal || 65,
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(resolveMediaUrl(storedUser.profile_photo_url));
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [manualFuelEdit, setManualFuelEdit] = useState(false);
  const [personalRecords, setPersonalRecords] = useState([]);
  const [prForm, setPrForm] = useState(emptyPrForm);
  const [isSavingPr, setIsSavingPr] = useState(false);
  const [prMessage, setPrMessage] = useState('');

  async function loadPersonalRecords() {
    if (!storedUser?.id) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/users/${storedUser.id}/personal-records/`, {
        credentials: 'include',
      });
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data.detail || 'Unable to load personal records.');
      }

      setPersonalRecords(Array.isArray(data) ? data : []);
    } catch (error) {
      setPrMessage(error.message);
    }
  }

  useEffect(() => {
    if (!storedUser?.id) {
      return;
    }

    fetch(`${API_BASE_URL}/users/${storedUser.id}/`)
      .then(async (response) => {
        const data = await readApiResponse(response);
        if (!response.ok) {
          throw new Error(data.detail || 'Unable to load profile.');
        }

        return data;
      })
      .then((data) => {
        const merged = { ...storedUser, ...data, profile_photo_url: resolveMediaUrl(data.profile_photo_url) };
        setProfile(merged);
        setForm({
          username: data.username || '',
          fitness_goal: data.fitness_goal || '',
          training_style: data.training_style || '',
          weekly_target: data.weekly_target || 3,
          weight_goal: data.weight_goal || '',
          starting_weight: data.starting_weight || '',
          current_weight: data.current_weight || '',
          goal_weight: data.goal_weight || '',
          weekly_goal: data.weekly_goal || '',
          calorie_goal: data.calorie_goal || 2500,
          protein_goal: data.protein_goal || 180,
          carbs_goal: data.carbs_goal || 300,
          fats_goal: data.fats_goal || 65,
        });
        setPhotoPreview(resolveMediaUrl(data.profile_photo_url));
        localStorage.setItem('onegymUser', JSON.stringify(merged));
        window.dispatchEvent(new Event('onegym-auth-change'));
      })
      .catch((error) => {
        setIsError(true);
        setMessage(error.message);
      });
  }, [storedUser?.id]);

  useEffect(() => {
    loadPersonalRecords();
  }, [storedUser?.id]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function updateFuelField(event) {
    setManualFuelEdit(true);
    updateField(event);
  }

  function updatePrField(event) {
    const { name, value } = event.target;
    setPrForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function applySuggestedFuel() {
    const suggested = suggestDailyFuel(form);
    if (!suggested) {
      return;
    }

    setForm((current) => ({
      ...current,
      ...suggested,
    }));
    setManualFuelEdit(false);
  }

  useEffect(() => {
    if (manualFuelEdit) {
      return;
    }

    const suggested = suggestDailyFuel(form);
    if (!suggested) {
      return;
    }

    setForm((current) => ({
      ...current,
      ...suggested,
    }));
  }, [form.current_weight, form.goal_weight, form.weekly_goal, form.weekly_target, form.weight_goal, manualFuelEdit]);

  function updatePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function saveProfile(event) {
    event.preventDefault();

    setIsSaving(true);
    setIsError(false);
    setMessage('');

    try {
      const payload = new FormData();
      payload.append('username', form.username.trim());
      payload.append('fitness_goal', form.fitness_goal.trim());
      payload.append('training_style', form.training_style.trim());
      payload.append('weekly_target', form.weekly_target || 0);
      payload.append('weight_goal', form.weight_goal);
      payload.append('starting_weight', form.starting_weight || '');
      payload.append('current_weight', form.current_weight || '');
      payload.append('goal_weight', form.goal_weight || '');
      payload.append('weekly_goal', form.weekly_goal || '');
      payload.append('calorie_goal', form.calorie_goal || '');
      payload.append('protein_goal', form.protein_goal || '');
      payload.append('carbs_goal', form.carbs_goal || '');
      payload.append('fats_goal', form.fats_goal || '');
      if (photoFile) {
        payload.append('profile_photo', photoFile);
      }

      const response = await fetch(`${API_BASE_URL}/users/${storedUser.id}/`, {
        method: 'PATCH',
        credentials: 'include',
        body: payload,
      });
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data.detail || 'Unable to save profile.');
      }

      const updated = { ...storedUser, ...data, profile_photo_url: resolveMediaUrl(data.profile_photo_url) };
      setProfile(updated);
      setPhotoPreview(updated.profile_photo_url);
      localStorage.setItem('onegymUser', JSON.stringify(updated));
      window.dispatchEvent(new Event('onegym-auth-change'));
      setMessage('Profile saved.');
    } catch (error) {
      setIsError(true);
      setMessage(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function savePersonalRecord(event) {
    event.preventDefault();

    setIsSavingPr(true);
    setPrMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/personal-records/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: storedUser.id,
          exercise_name: prForm.exercise_name.trim(),
          category: prForm.category,
          record_type: prForm.record_type,
          value: Number(prForm.value),
          unit: prForm.unit.trim(),
          recorded_at: prForm.recorded_at ? `${prForm.recorded_at}T12:00:00` : undefined,
          notes: prForm.notes.trim(),
        }),
      });
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data.detail || 'Unable to save PR.');
      }

      setPersonalRecords((current) => [data, ...current]);
      setPrForm(emptyPrForm);
      setPrMessage('PR saved.');
    } catch (error) {
      setPrMessage(error.message);
    } finally {
      setIsSavingPr(false);
    }
  }

  async function deletePersonalRecord(record) {
    try {
      const response = await fetch(`${API_BASE_URL}/personal-records/${record.id}/?user_id=${storedUser.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data.detail || 'Unable to delete PR.');
      }

      setPersonalRecords((current) => current.filter((item) => item.id !== record.id));
      setPrMessage('PR deleted.');
    } catch (error) {
      setPrMessage(error.message);
    }
  }

  return (
    <>
      <NavBar />
      <main className="profile-page">
        <section className="profile-hero">
          <div className="profile-photo-wrap">
            {photoPreview ? (
              <img alt={profile.username || 'Profile'} src={photoPreview} />
            ) : (
              <span>{getInitials(profile)}</span>
            )}
            <label>
              <input accept="image/*" onChange={updatePhoto} type="file" />
              Change photo
            </label>
          </div>
          <div>
            <p className="profile-kicker">Your space</p>
            <h1>{profile.username || 'Member'}</h1>
            <p>Keep your training goal honest, your weekly rhythm visible, and your profile feeling like you.</p>
          </div>
        </section>

        <form className="profile-form" onSubmit={saveProfile}>
          <section className="profile-panel profile-main-panel">
            <div className="profile-section-title">
              <p className="profile-kicker">Details</p>
              <h2>About you</h2>
            </div>
            <label>
              Display name
              <input name="username" onChange={updateField} required type="text" value={form.username} />
            </label>
            <label>
              Fitness goal
              <textarea
                name="fitness_goal"
                onChange={updateField}
                placeholder="Build stronger legs, feel better running stairs, stay consistent for 12 weeks..."
                rows="5"
                value={form.fitness_goal}
              />
            </label>
            <div className="profile-grid-fields">
              <label>
                Weight goal
                <select name="weight_goal" onChange={updateField} value={form.weight_goal}>
                  <option value="">Pick one</option>
                  <option value="Lose weight">Lose weight</option>
                  <option value="Maintain weight">Maintain weight</option>
                  <option value="Gain weight">Gain weight</option>
                  <option value="Recomposition">Recomposition</option>
                </select>
              </label>
              <label>
                Weekly goal (kg)
                <input name="weekly_goal" onChange={updateField} step="0.1" type="number" value={form.weekly_goal} />
              </label>
              <label>
                Starting weight (kg)
                <input min="0" name="starting_weight" onChange={updateField} step="0.1" type="number" value={form.starting_weight} />
              </label>
              <label>
                Current weight (kg)
                <input min="0" name="current_weight" onChange={updateField} step="0.1" type="number" value={form.current_weight} />
              </label>
              <label>
                Goal weight (kg)
                <input min="0" name="goal_weight" onChange={updateField} step="0.1" type="number" value={form.goal_weight} />
              </label>
            </div>
          </section>

          <aside className="profile-panel profile-vibe-panel">
            <div className="profile-section-title">
              <p className="profile-kicker">Training feel</p>
              <h2>What are we chasing?</h2>
            </div>
            <label>
              Training style
              <select name="training_style" onChange={updateField} value={form.training_style}>
                <option value="">Pick a vibe</option>
                <option value="Strength">Strength</option>
                <option value="Hypertrophy">Hypertrophy</option>
                <option value="Fat loss">Fat loss</option>
                <option value="Mobility">Mobility</option>
                <option value="Athletic conditioning">Athletic conditioning</option>
              </select>
            </label>
            <label>
              Weekly sessions
              <input max="21" min="0" name="weekly_target" onChange={updateField} type="number" value={form.weekly_target} />
            </label>
            <div className="profile-section-title compact">
              <p className="profile-kicker">Nutrition targets</p>
              <h2>Daily fuel</h2>
            </div>
            <p className="profile-fuel-note">
              Suggested from current weight, training style, weekly sessions, goal weight, and weekly weight change. Edit anytime.
            </p>
            <div className="profile-grid-fields profile-macro-grid">
              <label>
                Calories
                <input min="0" name="calorie_goal" onChange={updateFuelField} type="number" value={form.calorie_goal} />
              </label>
              <label>
                Protein (g)
                <input min="0" name="protein_goal" onChange={updateFuelField} type="number" value={form.protein_goal} />
              </label>
              <label>
                Carbs (g)
                <input min="0" name="carbs_goal" onChange={updateFuelField} type="number" value={form.carbs_goal} />
              </label>
              <label>
                Fat (g)
                <input min="0" name="fats_goal" onChange={updateFuelField} type="number" value={form.fats_goal} />
              </label>
            </div>
            <button className="profile-secondary-button" onClick={applySuggestedFuel} type="button">
              Recalculate fuel
            </button>
            <div className="profile-goal-card">
              <span className="material-symbols-outlined">flag</span>
              <strong>{form.weight_goal || form.training_style || 'Your next chapter'}</strong>
              <p>
                {form.current_weight && form.goal_weight
                  ? `${form.current_weight}kg now, aiming for ${form.goal_weight}kg.`
                  : form.fitness_goal || 'Add a goal so your dashboard and trainers know what you are working toward.'}
              </p>
            </div>
            <button disabled={isSaving} type="submit">
              {isSaving ? 'Saving...' : 'Save profile'}
            </button>
            {message && <p className={`profile-message ${isError ? 'error' : ''}`}>{message}</p>}
          </aside>
        </form>

        <section className="profile-pr-section">
          <div className="profile-section-title">
            <p className="profile-kicker">Personal records</p>
            <h2>Lift receipts</h2>
          </div>
          <form className="profile-pr-form" onSubmit={savePersonalRecord}>
            <label>
              Exercise
              <input name="exercise_name" onChange={updatePrField} placeholder="Bench press" required type="text" value={prForm.exercise_name} />
            </label>
            <label>
              Category
              <select name="category" onChange={updatePrField} value={prForm.category}>
                <option value="Strength">Strength</option>
                <option value="Cardio">Cardio</option>
                <option value="Mobility">Mobility</option>
                <option value="Bodyweight">Bodyweight</option>
              </select>
            </label>
            <label>
              Type
              <select name="record_type" onChange={updatePrField} value={prForm.record_type}>
                <option value="weight">Weight</option>
                <option value="reps">Reps</option>
                <option value="time">Time</option>
                <option value="distance">Distance</option>
                <option value="volume">Volume</option>
              </select>
            </label>
            <label>
              Value
              <input min="0" name="value" onChange={updatePrField} required step="0.01" type="number" value={prForm.value} />
            </label>
            <label>
              Unit
              <input name="unit" onChange={updatePrField} required type="text" value={prForm.unit} />
            </label>
            <label>
              Date
              <input name="recorded_at" onChange={updatePrField} type="date" value={prForm.recorded_at} />
            </label>
            <label className="profile-pr-notes">
              Notes
              <input name="notes" onChange={updatePrField} placeholder="Felt clean, no spotter" type="text" value={prForm.notes} />
            </label>
            <button disabled={isSavingPr} type="submit">{isSavingPr ? 'Saving...' : 'Save PR'}</button>
          </form>
          {prMessage && <p className="profile-message">{prMessage}</p>}
          <div className="profile-pr-list">
            {personalRecords.length ? personalRecords.map((record) => (
              <article key={record.id}>
                <div>
                  <span>{record.category || 'PR'}</span>
                  <h3>{record.exercise_name}</h3>
                  <p>{record.record_type} · {new Date(record.recorded_at).toLocaleDateString()}</p>
                </div>
                <strong>{Number(record.value).toLocaleString()} {record.unit}</strong>
                <button aria-label={`Delete ${record.exercise_name} PR`} onClick={() => deletePersonalRecord(record)} type="button">
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </article>
            )) : (
              <div className="profile-pr-empty">No PRs saved yet.</div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
