import { useCallback, useEffect, useMemo, useState } from 'react';
import './MemberDashboard.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
const API_ROOT = API_BASE_URL.replace(/\/api\/?$/, '');
const CALORIE_GOAL = 2500;
const PROTEIN_GOAL = 180;
const CARBS_GOAL = 300;
const FATS_GOAL = 65;

const navItems = [
  { icon: 'grid_view', label: 'Overview', tab: 'overview' },
  { icon: 'event_available', label: 'Classes', tab: 'classes' },
  { icon: 'fitness_center', label: 'Training', tab: 'training' },
  { icon: 'restaurant', label: 'Food Log', href: '/meal-history' },
  { icon: 'smart_toy', label: 'AI Assistant', href: '/ai-assistant' },
  { icon: 'account_circle', label: 'Profile', href: '/profile' },
];

const emptyMealForm = {
  mealType: 'breakfast',
  description: '',
  calories: '',
  protein: '',
  carbs: '',
  fats: '',
};

const emptyExercise = {
  name: '',
  sets: '',
  reps: '',
  weight: '',
};

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('onegymUser') || 'null');
  } catch {
    return null;
  }
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    if (text.trim().startsWith('<!DOCTYPE')) {
      return { detail: 'API returned an HTML page. Restart Django and try again.' };
    }
    return { detail: text };
  }
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function pct(value, goal) {
  if (!goal) return 0;
  return Math.max(0, Math.min(100, Math.round((value / goal) * 100)));
}

function dateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function formatDateLabel(value = new Date()) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(value).toUpperCase();
}

function formatClassTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatClassDay(value) {
  const key = dateKey(value);
  if (key === dateKey()) return 'Today';
  if (key === dateKey(addDays(new Date(), 1))) return 'Tomorrow';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function formatClassDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
}

function formatTimeRange(value) {
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return '--:--';
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const formatter = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function formatActivityDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function toDateInputValue(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatHistoryDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
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

function resolveMediaUrl(value) {
  if (!value || value === 'camera-capture') return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_ROOT}${value.startsWith('/') ? value : `/${value}`}`;
}

function initialsFor(user) {
  const name = user?.username || user?.name || user?.email || 'Member';
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'M';
}

function displayNameFor(user) {
  return user?.username || user?.name || user?.email?.split('@')[0] || 'Member';
}

function classIdFor(item) {
  return Number(item?.id || item?.class_id || 0);
}

function classSlots(item) {
  return Number(item?.slots ?? item?.available_slots ?? item?.remaining_slots ?? 0);
}

function normalizeMealType(value) {
  const type = String(value || 'snacks').toLowerCase();
  return ['breakfast', 'lunch', 'dinner', 'snacks'].includes(type) ? type : 'snacks';
}

function formatMealType(value) {
  return normalizeMealType(value).replace(/^\w/, (letter) => letter.toUpperCase());
}

function workoutDate(workout) {
  return workout?.workout_date || workout?.created_at || workout?.date || '';
}

function workoutStats(workouts) {
  const today = new Date();
  const todayKey = dateKey(today);
  const uniqueDays = new Set(workouts.map((workout) => dateKey(workoutDate(workout))).filter(Boolean));

  let streak = 0;
  for (let cursor = new Date(today); uniqueDays.has(dateKey(cursor)); cursor = addDays(cursor, -1)) {
    streak += 1;
  }

  const last30Start = addDays(today, -30);
  const previous30Start = addDays(today, -60);
  const recent = workouts.filter((workout) => {
    const date = new Date(workoutDate(workout));
    return !Number.isNaN(date.getTime()) && date >= last30Start && date <= today;
  });
  const previous = workouts.filter((workout) => {
    const date = new Date(workoutDate(workout));
    return !Number.isNaN(date.getTime()) && date >= previous30Start && date < last30Start;
  });

  const minutes = workouts
    .filter((workout) => dateKey(workoutDate(workout)) >= todayKey.slice(0, 7))
    .reduce((sum, workout) => sum + toNumber(workout.duration_minutes || workout.duration || workout.minutes), 0);

  const trend = previous.length ? Math.round(((recent.length - previous.length) / previous.length) * 100) : recent.length ? 100 : 0;

  return {
    streak,
    workouts30: recent.length,
    trend,
    hours: (minutes / 60).toFixed(1),
  };
}

export function MemberDashboardPage() {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [upcomingClasses, setUpcomingClasses] = useState([]);
  const [classesMessage, setClassesMessage] = useState('');
  const [bookedClassIds, setBookedClassIds] = useState(new Set());
  const [bookings, setBookings] = useState([]);
  const [classAction, setClassAction] = useState(null);
  const [classNotice, setClassNotice] = useState(null);
  const [isClassSubmitting, setIsClassSubmitting] = useState(false);
  const [workouts, setWorkouts] = useState([]);
  const [activityMessage, setActivityMessage] = useState('');
  const [meals, setMeals] = useState([]);
  const [mealForm, setMealForm] = useState(emptyMealForm);
  const [mealPhoto, setMealPhoto] = useState(null);
  const [mealPhotoPreview, setMealPhotoPreview] = useState('');
  const [mealMessage, setMealMessage] = useState('');
  const [isMealError, setIsMealError] = useState(false);
  const [isSavingMeal, setIsSavingMeal] = useState(false);
  const [isAnalyzingMeal, setIsAnalyzingMeal] = useState(false);
  const user = useMemo(getStoredUser, []);
  const displayName = displayNameFor(user);
  const initials = initialsFor(user);
  const profilePhotoUrl = resolveMediaUrl(user?.profile_photo_url || user?.profile_picture || user?.avatar_url);
  const todayDate = toDateInputValue();
  const registrationDate = toDateInputValue(user?.created_at) || todayDate;
  const [trainingView, setTrainingView] = useState('log');
  const [workoutForm, setWorkoutForm] = useState({
    name: '',
    workoutDate: todayDate,
    durationMinutes: '',
    intensity: 'low',
    caloriesBurned: '',
  });
  const [exercises, setExercises] = useState([{ ...emptyExercise, id: crypto.randomUUID() }]);
  const [trainingMessage, setTrainingMessage] = useState('');
  const [isTrainingError, setIsTrainingError] = useState(false);
  const [isSavingWorkout, setIsSavingWorkout] = useState(false);
  const [pendingWorkoutDelete, setPendingWorkoutDelete] = useState(null);
  const [trainingNotice, setTrainingNotice] = useState(null);
  const [isDeletingWorkout, setIsDeletingWorkout] = useState(false);

  const loadMeals = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await fetch(`${API_BASE_URL}/users/${user.id}/meals/`);
      const data = await parseResponse(response);
      if (!response.ok) throw new Error(data.detail || 'Unable to load meals.');
      setMeals(Array.isArray(data) ? data : data.meals || []);
    } catch (error) {
      setMeals([]);
      setMealMessage(error instanceof Error ? error.message : 'Unable to load meals.');
      setIsMealError(true);
    }
  }, [user?.id]);

  const loadClasses = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/classes/`);
    const data = await parseResponse(response);
    if (!response.ok) throw new Error(data.detail || 'Unable to load classes.');
    const now = Date.now();
    return (Array.isArray(data) ? data : data.classes || [])
      .filter((item) => new Date(item.schedule_time || item.starts_at || item.date).getTime() >= now)
      .sort((a, b) => new Date(a.schedule_time || a.starts_at || a.date) - new Date(b.schedule_time || b.starts_at || b.date));
  }, []);

  const loadBookings = useCallback(async () => {
    if (!user?.id) {
      setBookings([]);
      setBookedClassIds(new Set());
      return;
    }

    const response = await fetch(`${API_BASE_URL}/users/${user.id}/bookings/`);
    const data = await parseResponse(response);
    if (!response.ok) throw new Error(data.detail || 'Unable to load bookings.');
    const rows = Array.isArray(data) ? data : data.bookings || [];
    setBookings(rows);
    setBookedClassIds(new Set(rows.map((booking) => Number(booking.class_id || booking.class?.id || booking.id)).filter(Boolean)));
  }, [user?.id]);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      try {
        const rows = await loadClasses();
        if (isMounted) {
          setUpcomingClasses(rows);
          setClassesMessage('');
        }
      } catch (error) {
        if (isMounted) {
          setUpcomingClasses([]);
          setClassesMessage(error instanceof Error ? error.message : 'Failed to fetch');
        }
      }

      if (!user?.id) return;

      try {
        await loadBookings();
      } catch {
        if (isMounted) {
          setBookings([]);
          setBookedClassIds(new Set());
        }
      }

      try {
        const response = await fetch(`${API_BASE_URL}/users/${user.id}/workouts/?limit=all`);
        const data = await parseResponse(response);
        if (!response.ok) throw new Error(data.detail || 'Unable to load workouts.');
        if (isMounted) {
          setWorkouts(Array.isArray(data) ? data : data.workouts || []);
          setActivityMessage('');
        }
      } catch (error) {
        if (isMounted) {
          setWorkouts([]);
          setActivityMessage(error instanceof Error ? error.message : 'Failed to fetch');
        }
      }
    }

    loadDashboardData();
    return () => {
      isMounted = false;
    };
  }, [loadBookings, loadClasses, user?.id]);

  useEffect(() => {
    loadMeals();
  }, [loadMeals]);

  useEffect(() => () => {
    if (mealPhotoPreview) URL.revokeObjectURL(mealPhotoPreview);
  }, [mealPhotoPreview]);

  const stats = useMemo(() => workoutStats(workouts), [workouts]);
  const visibleClasses = upcomingClasses.slice(0, 3);
  const visibleWorkouts = [...workouts]
    .sort((a, b) => new Date(workoutDate(b)) - new Date(workoutDate(a)))
    .slice(0, 3);

  const nutrition = useMemo(() => {
    const todaysMeals = meals.filter((meal) => dateKey(meal.logged_at || meal.created_at || meal.meal_date || new Date()) === dateKey());
    const totals = todaysMeals.reduce(
      (sum, meal) => ({
        calories: sum.calories + toNumber(meal.calories || meal.kcal),
        protein: sum.protein + toNumber(meal.protein_g || meal.protein),
        carbs: sum.carbs + toNumber(meal.carbs_g || meal.carbs || meal.carbohydrates_g),
        fats: sum.fats + toNumber(meal.fats_g || meal.fats || meal.fat_g),
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 },
    );
    return {
      todaysMeals,
      ...totals,
      remaining: Math.max(0, CALORIE_GOAL - totals.calories),
      fuelPercent: pct(totals.calories, CALORIE_GOAL),
    };
  }, [meals]);

  function updateMealField(field, value) {
    setMealForm((current) => ({ ...current, [field]: value }));
  }

  function openDashboardTab(tab) {
    setActiveTab(tab);
    setIsNavOpen(false);
  }

  function askToBook(item) {
    if (!user?.id) {
      setClassesMessage('Please sign in before booking a class.');
      return;
    }

    setClassAction({
      type: 'book',
      item,
      title: 'Confirm booking',
      body: `${item.title} on ${formatClassDate(item.schedule_time || item.starts_at || item.date)} at ${formatTimeRange(item.schedule_time || item.starts_at || item.date)}.`,
    });
  }

  function askToCancel(item) {
    setClassAction({
      type: 'cancel',
      item,
      title: 'Cancel booking',
      body: `${item.title} on ${formatClassDate(item.schedule_time || item.starts_at || item.date)} at ${formatTimeRange(item.schedule_time || item.starts_at || item.date)}.`,
    });
  }

  async function confirmClassAction() {
    if (!classAction || !user?.id) return;

    setIsClassSubmitting(true);
    setClassesMessage('');
    try {
      const endpoint =
        classAction.type === 'book'
          ? `${API_BASE_URL}/classes/${classAction.item.id}/book/`
          : `${API_BASE_URL}/bookings/${classAction.item.booking_id || classAction.item.id}/cancel/?user_id=${user.id}`;
      const response = await fetch(endpoint, {
        method: classAction.type === 'book' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await parseResponse(response);
      if (!response.ok) throw new Error(data.detail || 'Unable to update this booking.');

      setUpcomingClasses(await loadClasses());
      await loadBookings();
      setClassNotice({
        title: classAction.type === 'book' ? 'Booking confirmed' : 'Booking cancelled',
        body: data.detail || 'Your booking has been updated.',
      });
      setClassAction(null);
    } catch (error) {
      setClassesMessage(error instanceof Error ? error.message : 'Unable to update this booking.');
      setClassAction(null);
    } finally {
      setIsClassSubmitting(false);
    }
  }

  function handleMealPhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (mealPhotoPreview) URL.revokeObjectURL(mealPhotoPreview);
    setMealPhoto(file);
    setMealPhotoPreview(URL.createObjectURL(file));
    setMealMessage('');
  }

  async function analyzeMealPhoto() {
    if (!mealPhoto || !user?.id) {
      setMealMessage('Choose a food photo first.');
      setIsMealError(true);
      return;
    }

    setIsAnalyzingMeal(true);
    setMealMessage('');
    try {
      const formData = new FormData();
      formData.append('user_id', user.id);
      formData.append('meal_photo', mealPhoto);

      const response = await fetch(`${API_BASE_URL}/meals/analyze/`, { method: 'POST', body: formData });
      const data = await parseResponse(response);
      if (!response.ok) throw new Error(data.detail || 'Food analysis service is unavailable.');

      setMealForm((current) => ({
        ...current,
        description: data.description || current.description || 'Estimated meal',
        calories: String(Math.round(toNumber(data.calories || data.kcal))),
        protein: String(Math.round(toNumber(data.protein_g || data.protein))),
        carbs: String(Math.round(toNumber(data.carbs_g || data.carbs || data.carbohydrates_g))),
        fats: String(Math.round(toNumber(data.fats_g || data.fats || data.fat_g))),
      }));
      setMealMessage('Nutrition estimate generated from photo.');
      setIsMealError(false);
    } catch (error) {
      setMealMessage(error instanceof Error ? error.message : 'Food analysis service is unavailable.');
      setIsMealError(true);
    } finally {
      setIsAnalyzingMeal(false);
    }
  }

  async function saveMealLog() {
    if (!user?.id) {
      setMealMessage('Sign in again before adding meals.');
      setIsMealError(true);
      return;
    }
    if (!mealForm.description.trim() || !mealForm.calories) {
      setMealMessage('Meal description and calories are required.');
      setIsMealError(true);
      return;
    }

    setIsSavingMeal(true);
    setMealMessage('');
    try {
      const formData = new FormData();
      formData.append('user_id', user.id);
      formData.append('meal_type', normalizeMealType(mealForm.mealType));
      formData.append('description', mealForm.description.trim());
      formData.append('calories', mealForm.calories);
      formData.append('protein_g', mealForm.protein || 0);
      formData.append('carbs_g', mealForm.carbs || 0);
      formData.append('fats_g', mealForm.fats || 0);
      if (mealPhoto) formData.append('meal_photo', mealPhoto);

      const response = await fetch(`${API_BASE_URL}/meals/`, { method: 'POST', body: formData });
      const data = await parseResponse(response);
      if (!response.ok) throw new Error(data.detail || 'Unable to save meal.');

      setMealForm(emptyMealForm);
      setMealPhoto(null);
      if (mealPhotoPreview) URL.revokeObjectURL(mealPhotoPreview);
      setMealPhotoPreview('');
      setMealMessage('Meal added.');
      setIsMealError(false);
      await loadMeals();
    } catch (error) {
      setMealMessage(error instanceof Error ? error.message : 'Unable to save meal.');
      setIsMealError(true);
    } finally {
      setIsSavingMeal(false);
    }
  }

  function updateWorkoutField(event) {
    const { name, value } = event.target;
    setWorkoutForm((current) => ({ ...current, [name]: value }));
  }

  function addExercise() {
    setExercises((current) => [...current, { ...emptyExercise, id: crypto.randomUUID() }]);
  }

  function updateExercise(id, field, value) {
    setExercises((current) => current.map((exercise) => (exercise.id === id ? { ...exercise, [field]: value } : exercise)));
  }

  function removeExercise(id) {
    setExercises((current) => (current.length > 1 ? current.filter((exercise) => exercise.id !== id) : current));
  }

  async function reloadWorkouts() {
    if (!user?.id) return;
    const response = await fetch(`${API_BASE_URL}/users/${user.id}/workouts/?limit=all`);
    const data = await parseResponse(response);
    if (!response.ok) throw new Error(data.detail || 'Unable to load workouts.');
    setWorkouts(Array.isArray(data) ? data : data.workouts || []);
    setActivityMessage('');
  }

  async function saveWorkout() {
    const validExercises = exercises
      .map((exercise) => ({ ...exercise, name: exercise.name.trim() }))
      .filter((exercise) => exercise.name)
      .map((exercise) => ({
        exercise_name: exercise.name,
        sets: Number(exercise.sets) || 0,
        reps: Number(exercise.reps) || 0,
        weight: Number(exercise.weight) || 0,
      }));

    if (!user?.id) {
      setIsTrainingError(true);
      setTrainingMessage('Please sign in before saving a workout.');
      return;
    }

    if (!workoutForm.name.trim() || !workoutForm.workoutDate || !workoutForm.durationMinutes || !workoutForm.caloriesBurned) {
      setIsTrainingError(true);
      setTrainingMessage('Workout name, date, duration, and calories are required.');
      return;
    }

    if (workoutForm.workoutDate < registrationDate) {
      setIsTrainingError(true);
      setTrainingMessage('Workout date cannot be before your registration date.');
      return;
    }

    if (workoutForm.workoutDate > todayDate) {
      setIsTrainingError(true);
      setTrainingMessage('Workout date cannot be in the future.');
      return;
    }

    if (!validExercises.length) {
      setIsTrainingError(true);
      setTrainingMessage('Add at least one exercise name before saving.');
      return;
    }

    setIsSavingWorkout(true);
    setTrainingMessage('');
    setIsTrainingError(false);

    try {
      const response = await fetch(`${API_BASE_URL}/workouts/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const data = await parseResponse(response);
      if (!response.ok) throw new Error(data.detail || 'Unable to save workout.');

      setTrainingMessage(data.detail || 'Workout saved successfully.');
      setWorkoutForm({
        name: '',
        workoutDate: todayDate < registrationDate ? registrationDate : todayDate,
        durationMinutes: '',
        intensity: 'low',
        caloriesBurned: '',
      });
      setExercises([{ ...emptyExercise, id: crypto.randomUUID() }]);
      await reloadWorkouts();
      setTrainingView('history');
    } catch (error) {
      setIsTrainingError(true);
      setTrainingMessage(error instanceof Error ? error.message : 'Unable to save workout.');
    } finally {
      setIsSavingWorkout(false);
    }
  }

  function askToDeleteWorkout(workout) {
    const workoutId = getWorkoutId(workout);
    if (!workoutId) {
      setTrainingMessage('This workout is missing its database id, so it cannot be deleted yet.');
      setIsTrainingError(true);
      return;
    }

    setPendingWorkoutDelete({
      id: workoutId,
      item: workout,
      title: 'Delete workout',
      body: `Remove "${workout.name}" from your training history? This cannot be undone.`,
    });
  }

  async function confirmDeleteWorkout() {
    if (!pendingWorkoutDelete || !user?.id) return;

    setIsDeletingWorkout(true);
    try {
      const endpoint = `${API_BASE_URL}/workouts/delete/`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, workout_id: pendingWorkoutDelete.id }),
      });
      const data = await parseResponse(response);
      if (!response.ok) throw new Error(data.detail || 'Unable to delete workout.');

      setWorkouts((current) => current.filter((item) => getWorkoutId(item) !== pendingWorkoutDelete.id));
      setPendingWorkoutDelete(null);
      setTrainingNotice({
        title: 'Workout deleted',
        body: data.detail || 'That workout was removed from your training history.',
      });
    } catch (error) {
      setTrainingMessage(error instanceof Error ? error.message : 'Unable to delete workout.');
      setIsTrainingError(true);
      setPendingWorkoutDelete(null);
    } finally {
      setIsDeletingWorkout(false);
    }
  }

  return (
    <div className={`member-dashboard-page ${isNavOpen ? 'nav-open' : ''}`}>
      <aside className="sidebar">
        <a className="brand" href="/">
          <div className="brand-mark">OG</div>
          <div className="brand-text">
            <strong>OneGym</strong>
            <span>Member space</span>
          </div>
        </a>

        <nav className="side-nav">
          {navItems.map(({ icon, label, href, tab }) => (
            <a
              className={tab === activeTab ? 'active' : ''}
              href={href || '#'}
              key={label}
              onClick={(event) => {
                if (tab) {
                  event.preventDefault();
                  openDashboardTab(tab);
                }
              }}
            >
              <span className="material-symbols-outlined">{icon}</span>
              {label}
            </a>
          ))}
        </nav>

        <a className="profile-section" href="/profile">
          {profilePhotoUrl ? <img alt="" className="av avatar-img" src={profilePhotoUrl} /> : <div className="av">{initials}</div>}
          <div className="profile-info">
            <strong>{displayName}</strong>
            <small>Member</small>
          </div>
          <span className="material-symbols-outlined expand-icon">expand_more</span>
        </a>
      </aside>

      <button aria-label="Close sidebar" className="backdrop" onClick={() => setIsNavOpen(false)} type="button" />

      <main className="main-content">
        <div className="content-wrap">
          <header className="topbar fade">
            <div className="topbar-left">
              <div className="topbar-title-row">
                <button className="menu-btn" onClick={() => setIsNavOpen(true)} type="button">
                  <span className="material-symbols-outlined">menu</span>
                </button>
                <div>
                  <h1>Dashboard</h1>
                  <p>Welcome back, {displayName}. Here is your fitness overview.</p>
                </div>
              </div>
            </div>
            <div className="topbar-tools">
              <div className="search-wrapper">
                <span className="material-symbols-outlined search-icon">search</span>
                <input className="search-input" placeholder="Search classes, meals..." type="text" />
              </div>
              <button className="btn btn-secondary icon-button" type="button">
                <span className="material-symbols-outlined">notifications</span>
              </button>
              <a className="top-avatar-link" href="/profile">
                {profilePhotoUrl ? <img alt="" className="av top-avatar avatar-img" src={profilePhotoUrl} /> : <div className="av top-avatar">{initials}</div>}
              </a>
            </div>
          </header>

          {activeTab === 'overview' ? (
            <>
          <div className="hero-layout">
            <section className="card hero-card fade delay-1">
              <div className="hero-text">
                <p className="hero-kicker">Today's Overview</p>
                <h2>Train smarter with <span>OneGym</span></h2>
                <p>Track your classes, workouts, meals, and weekly progress from one focused dashboard.</p>
                <div className="hero-actions">
                  <button className="btn btn-primary" onClick={() => openDashboardTab('classes')} type="button">View Schedule</button>
                  <button className="btn btn-secondary" onClick={() => document.getElementById('dashboard-quick-log')?.scrollIntoView({ behavior: 'smooth' })} type="button">
                    Log Meal
                  </button>
                </div>
              </div>
              <div className="hero-visual">
                <p className="fuel-label">Daily Fuel</p>
                <div className="daily-fuel-ring" style={{ '--ring-percent': `${nutrition.fuelPercent}%` }}>
                  <span>{nutrition.fuelPercent}%</span>
                </div>
                <p className="fuel-footnote">Goal completed</p>
              </div>
            </section>

            <div className="stats-stack fade delay-1">
              <div className="card stat-card">
                <div className="stat-meta">
                  <span className="label">Current Streak</span>
                  <div className="val">{stats.streak} <small>Days</small></div>
                </div>
                <span className="material-symbols-outlined stat-icon">local_fire_department</span>
              </div>
              <div className="card stat-card">
                <div className="stat-meta">
                  <span className="label">Workouts (30D)</span>
                  <div className="val">{stats.workouts30}</div>
                  <div className="trend pos">
                    <span className="material-symbols-outlined trend-icon">trending_up</span>
                    {stats.trend >= 0 ? '+' : ''}{stats.trend}% vs last month
                  </div>
                </div>
                <span className="material-symbols-outlined stat-icon teal-icon">vital_signs</span>
              </div>
              <div className="card stat-card">
                <div className="stat-meta">
                  <span className="label">Hours Trained</span>
                  <div className="val">{stats.hours}</div>
                  <div className="trend">
                    <span className="material-symbols-outlined trend-icon">schedule</span>
                    This month
                  </div>
                </div>
                <span className="material-symbols-outlined stat-icon yellow-icon">timer</span>
              </div>
            </div>
          </div>

          <div className="middle-grid">
            <section className="fade delay-2 stack-section">
              <div className="section-header">
                <h2 className="section-title">Upcoming Classes</h2>
                <button className="view-all as-button" onClick={() => openDashboardTab('classes')} type="button">View all</button>
              </div>
              <div className="card fill-card">
                {classesMessage ? (
                  <div className="empty-state">{classesMessage}</div>
                ) : visibleClasses.length ? (
                  visibleClasses.map((item) => {
                    const id = classIdFor(item);
                    const booked = bookedClassIds.has(id);
                    return (
                      <div className="class-item" key={id || item.title}>
                        <div className="class-info-wrap">
                          <div className="class-time">
                            <strong>{formatClassTime(item.schedule_time || item.starts_at || item.date)}</strong>
                            <span>{formatClassDay(item.schedule_time || item.starts_at || item.date)}</span>
                          </div>
                          <div className="class-details">
                            <h4>{item.title}</h4>
                            <p>{item.room || 'Studio'} • {item.instructor_name || item.trainer_name || 'Trainer'}</p>
                            <div className="class-slots">
                              <span className="material-symbols-outlined slots-icon">{booked ? 'check_circle' : 'group'}</span>
                              {booked ? 'Booked' : `${classSlots(item)} spots left`}
                            </div>
                          </div>
                        </div>
                        <div className="class-actions">
                          {!booked ? (
                            <button className="btn btn-primary small-action" disabled={classSlots(item) <= 0} onClick={() => askToBook(item)} type="button">
                              {classSlots(item) <= 0 ? 'Full' : 'Book'}
                            </button>
                          ) : null}
                          <a className="btn btn-secondary small-action" href={item.trainer_id ? `/trainer-chat?trainerId=${item.trainer_id}` : '/trainer-chat'}>
                            Chat
                          </a>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-state">No upcoming classes available.</div>
                )}
              </div>
            </section>

            <section className="fade delay-2 stack-section">
              <div className="section-header">
                <h2 className="section-title">Recent Activity</h2>
                <button className="view-all as-button" onClick={() => { setActiveTab('training'); setTrainingView('history'); }} type="button">View all</button>
              </div>
              <div className="card activity-feed fill-card">
                {activityMessage ? (
                  <div className="empty-state">{activityMessage}</div>
                ) : visibleWorkouts.length ? (
                  visibleWorkouts.map((workout) => (
                    <button className="activity-item" onClick={() => { setActiveTab('training'); setTrainingView('history'); }} key={workout.id || `${workoutDate(workout)}-${workout.description}`} type="button">
                      <div className="activity-icon-bg">
                        <span className="material-symbols-outlined">fitness_center</span>
                      </div>
                      <div className="activity-content">
                        <h5>{workout.title || workout.name || 'Workout'}</h5>
                        <p className="stats">
                          {toNumber(workout.duration_minutes || workout.duration || workout.minutes)} mins • {toNumber(workout.calories || workout.calories_burned)} kcal • {toNumber(workout.exercise_count || workout.exercises_count || workout.exercises?.length)} exercises
                        </p>
                        <p className="time">{workout.intensity || 'Moderate'} • {formatActivityDate(workoutDate(workout))}</p>
                      </div>
                      <span className="material-symbols-outlined chevron-icon">chevron_right</span>
                    </button>
                  ))
                ) : (
                  <div className="empty-state">No workouts logged yet.</div>
                )}
              </div>
            </section>
          </div>

          <section className="fade delay-3 nutrition-shell">
            <div className="section-header">
              <h2 className="section-title">Today's Nutrition</h2>
              <span className="date-label">{formatDateLabel()}</span>
            </div>
            <div className="card nutrition-grid">
              <div className="nutrition-main">
                <div className="nutrition-summary">
                  <div>
                    <p className="summary-label fire-label">
                      <span className="material-symbols-outlined">local_fire_department</span>
                      Daily Goal
                    </p>
                    <p className="summary-value">{CALORIE_GOAL.toLocaleString()} <small>kcal</small></p>
                  </div>
                  <div>
                    <p className="summary-label">Consumed</p>
                    <p className="summary-value">{Math.round(nutrition.calories).toLocaleString()} <small>kcal</small></p>
                  </div>
                  <div className="remaining-summary">
                    <div>
                      <p className="summary-label">Remaining</p>
                      <p className="summary-value">{Math.round(nutrition.remaining).toLocaleString()} <small>kcal</small></p>
                    </div>
                  </div>
                </div>

                <div className="macro-bars">
                  <div className="macro-item">
                    <div className="macro-label"><span>PROTEIN</span> <span>{Math.round(nutrition.protein)}g / {PROTEIN_GOAL}g</span></div>
                    <div className="bar-bg"><div className="bar-fill protein-fill" style={{ width: `${pct(nutrition.protein, PROTEIN_GOAL)}%` }} /></div>
                  </div>
                  <div className="macro-item">
                    <div className="macro-label"><span>CARBS</span> <span>{Math.round(nutrition.carbs)}g / {CARBS_GOAL}g</span></div>
                    <div className="bar-bg"><div className="bar-fill carbs-fill" style={{ width: `${pct(nutrition.carbs, CARBS_GOAL)}%` }} /></div>
                  </div>
                  <div className="macro-item">
                    <div className="macro-label"><span>FATS</span> <span>{Math.round(nutrition.fats)}g / {FATS_GOAL}g</span></div>
                    <div className="bar-bg"><div className="bar-fill fats-fill" style={{ width: `${pct(nutrition.fats, FATS_GOAL)}%` }} /></div>
                  </div>
                </div>

                <div className="meal-log">
                  {nutrition.todaysMeals.length ? (
                    nutrition.todaysMeals.slice(0, 3).map((meal) => (
                      <div className="meal-item" key={meal.id || `${meal.description}-${meal.created_at}`}>
                        <div className="meal-info">
                          {resolveMediaUrl(meal.photo_url || meal.meal_photo) ? (
                            <img alt="" className="meal-thumb" src={resolveMediaUrl(meal.photo_url || meal.meal_photo)} />
                          ) : (
                            <span className="material-symbols-outlined meal-icon">restaurant</span>
                          )}
                          <div className="meal-name">
                            <strong>{formatMealType(meal.meal_type)}</strong>
                            <span>{meal.description || 'Meal'}</span>
                            <div className="meal-macros">
                              P {Math.round(toNumber(meal.protein_g || meal.protein))}g • C {Math.round(toNumber(meal.carbs_g || meal.carbs))}g • F {Math.round(toNumber(meal.fats_g || meal.fats))}g
                            </div>
                          </div>
                        </div>
                        <div className="meal-kcal">{Math.round(toNumber(meal.calories || meal.kcal)).toLocaleString()} kcal</div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state meal-empty">No meals logged today.</div>
                  )}
                </div>
                <div className="full-log-link">
                  <a href="/meal-history">View full log</a>
                </div>
              </div>

              <div className="quick-log" id="dashboard-quick-log">
                <h3>Quick Log</h3>
                <div className="form-group">
                  <label>Meal Type</label>
                  <select className="form-control" value={mealForm.mealType} onChange={(event) => updateMealField('mealType', event.target.value)}>
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                    <option value="snacks">Snacks</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Meal Description</label>
                  <input className="form-control" onChange={(event) => updateMealField('description', event.target.value)} placeholder="e.g. Chicken Salad" type="text" value={mealForm.description} />
                </div>
                <div className="form-row-3">
                  <div className="form-group">
                    <label>kcal</label>
                    <input className="form-control" onChange={(event) => updateMealField('calories', event.target.value)} placeholder="350" type="number" value={mealForm.calories} />
                  </div>
                  <div className="form-group">
                    <label>Prot (g)</label>
                    <input className="form-control" onChange={(event) => updateMealField('protein', event.target.value)} placeholder="25" type="number" value={mealForm.protein} />
                  </div>
                  <div className="form-group">
                    <label>Carb (g)</label>
                    <input className="form-control" onChange={(event) => updateMealField('carbs', event.target.value)} placeholder="40" type="number" value={mealForm.carbs} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Fat (g)</label>
                  <input className="form-control" onChange={(event) => updateMealField('fats', event.target.value)} placeholder="10" type="number" value={mealForm.fats} />
                </div>
                <label className="upload-zone">
                  <input accept="image/*" className="hidden-input" onChange={handleMealPhotoChange} type="file" />
                  {mealPhotoPreview ? (
                    <img alt="" className="meal-photo-preview" src={mealPhotoPreview} />
                  ) : (
                    <>
                      <span className="material-symbols-outlined">add_a_photo</span>
                      <span>Take or upload food photo</span>
                    </>
                  )}
                </label>
                <button className="btn btn-secondary btn-full" disabled={isAnalyzingMeal} onClick={analyzeMealPhoto} type="button">
                  <span className="material-symbols-outlined enhance-icon">camera_enhance</span>
                  {isAnalyzingMeal ? 'Estimating...' : 'Estimate from Photo'}
                </button>
                <button className="btn btn-primary btn-full" disabled={isSavingMeal} onClick={saveMealLog} type="button">
                  <span className="material-symbols-outlined enhance-icon">add_circle</span>
                  {isSavingMeal ? 'Adding...' : 'Add to Log'}
                </button>
                {mealMessage ? <p className={`meal-log-message ${isMealError ? 'error' : 'success'}`}>{mealMessage}</p> : null}
              </div>
            </div>
          </section>
            </>
          ) : activeTab === 'classes' ? (
            <section className="classes-tab fade">
              <div className="section-header">
                <div>
                  <h2 className="section-title">Classes</h2>
                  <p className="section-subtitle">Book, review, or cancel your upcoming sessions from the dashboard.</p>
                </div>
              </div>

              {classesMessage ? <p className="dashboard-message error">{classesMessage}</p> : null}

              <div className="dashboard-classes-grid">
                <div className="card dashboard-class-list">
                  <div className="class-panel-title">
                    <span>Schedule</span>
                    <small>{upcomingClasses.length} upcoming</small>
                  </div>
                  {upcomingClasses.length ? (
                    upcomingClasses.map((item) => {
                      const id = classIdFor(item);
                      const booked = bookedClassIds.has(id);
                      return (
                        <div className="class-item class-tab-item" key={id || item.title}>
                          <div className="class-info-wrap">
                            <div className="class-time">
                              <strong>{formatClassTime(item.schedule_time || item.starts_at || item.date)}</strong>
                              <span>{formatClassDay(item.schedule_time || item.starts_at || item.date)}</span>
                            </div>
                            <div className="class-details">
                              <h4>{item.title}</h4>
                              <p>{item.room || 'Studio'} • {item.instructor_name || item.trainer_name || 'Trainer'}</p>
                              <div className="class-slots">
                                <span className="material-symbols-outlined slots-icon">{booked ? 'check_circle' : 'group'}</span>
                                {booked ? 'Booked' : `${classSlots(item)} spots left`}
                              </div>
                            </div>
                          </div>
                          <div className="class-actions">
                            {!booked ? (
                              <button className="btn btn-primary small-action" disabled={classSlots(item) <= 0} onClick={() => askToBook(item)} type="button">
                                {classSlots(item) <= 0 ? 'Full' : 'Book'}
                              </button>
                            ) : null}
                            <a className="btn btn-secondary small-action" href={item.trainer_id ? `/trainer-chat?trainerId=${item.trainer_id}` : '/trainer-chat'}>Chat</a>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="empty-state">No upcoming classes available.</div>
                  )}
                </div>

                <div className="card dashboard-class-list my-bookings-panel">
                  <div className="class-panel-title">
                    <span>My Bookings</span>
                    <small>{bookings.length} active</small>
                  </div>
                  {bookings.length ? (
                    bookings.map((item) => (
                      <div className="class-item class-tab-item" key={item.booking_id || item.id}>
                        <div className="class-info-wrap">
                          <div className="class-time">
                            <strong>{formatClassTime(item.schedule_time)}</strong>
                            <span>{formatClassDay(item.schedule_time)}</span>
                          </div>
                          <div className="class-details">
                            <h4>{item.title}</h4>
                            <p>{item.room || 'Studio'} • {item.instructor_name || 'Trainer'}</p>
                            <div className="class-slots">
                              <span className="material-symbols-outlined slots-icon">check_circle</span>
                              Booked
                            </div>
                          </div>
                        </div>
                        <button className="btn btn-secondary small-action cancel-action" onClick={() => askToCancel(item)} type="button">Cancel</button>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">No bookings yet.</div>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <section className="training-tab fade">
              <div className="section-header">
                <div>
                  <h2 className="section-title">Training</h2>
                  <p className="section-subtitle">Log workouts and review your full training history.</p>
                </div>
                <div className="dashboard-tab-switch">
                  <button className={trainingView === 'log' ? 'active' : ''} onClick={() => setTrainingView('log')} type="button">Log Workout</button>
                  <button className={trainingView === 'history' ? 'active' : ''} onClick={() => setTrainingView('history')} type="button">Training History</button>
                </div>
              </div>

              {trainingMessage ? <p className={`dashboard-message ${isTrainingError ? 'error' : 'success'}`}>{trainingMessage}</p> : null}

              {trainingView === 'log' ? (
                <div className="card training-log-panel">
                  <div className="training-form-grid">
                    <label className="dashboard-field wide">
                      <span>Workout Name</span>
                      <input name="name" onChange={updateWorkoutField} placeholder="e.g. Push Day, Yoga Flow" type="text" value={workoutForm.name} />
                    </label>
                    <label className="dashboard-field">
                      <span>Workout Date</span>
                      <input max={todayDate} min={registrationDate} name="workoutDate" onChange={updateWorkoutField} type="date" value={workoutForm.workoutDate} />
                    </label>
                    <label className="dashboard-field">
                      <span>Duration (Min)</span>
                      <input name="durationMinutes" onChange={updateWorkoutField} placeholder="45" type="number" value={workoutForm.durationMinutes} />
                    </label>
                    <label className="dashboard-field">
                      <span>Intensity</span>
                      <select name="intensity" onChange={updateWorkoutField} value={workoutForm.intensity}>
                        <option value="low">Gentle</option>
                        <option value="moderate">Moderate</option>
                        <option value="high">High</option>
                      </select>
                    </label>
                    <label className="dashboard-field">
                      <span>Calories Burned</span>
                      <input name="caloriesBurned" onChange={updateWorkoutField} placeholder="320" type="number" value={workoutForm.caloriesBurned} />
                    </label>
                  </div>

                  <div className="training-section-head">
                    <h3>Exercises</h3>
                    <button className="btn btn-secondary" onClick={addExercise} type="button">
                      <span className="material-symbols-outlined">add</span>
                      Add Exercise
                    </button>
                  </div>

                  <div className="exercise-list">
                    {exercises.map((exercise) => (
                      <article className="exercise-row" key={exercise.id}>
                        <label className="dashboard-field exercise-name">
                          <span>Exercise Name</span>
                          <input onChange={(event) => updateExercise(exercise.id, 'name', event.target.value)} placeholder="Barbell Squat" type="text" value={exercise.name} />
                        </label>
                        <label className="dashboard-field">
                          <span>Sets</span>
                          <input onChange={(event) => updateExercise(exercise.id, 'sets', event.target.value)} placeholder="3" type="number" value={exercise.sets} />
                        </label>
                        <label className="dashboard-field">
                          <span>Reps</span>
                          <input onChange={(event) => updateExercise(exercise.id, 'reps', event.target.value)} placeholder="12" type="number" value={exercise.reps} />
                        </label>
                        <label className="dashboard-field">
                          <span>Weight</span>
                          <input onChange={(event) => updateExercise(exercise.id, 'weight', event.target.value)} placeholder="135" type="number" value={exercise.weight} />
                        </label>
                        <button className="exercise-delete" onClick={() => removeExercise(exercise.id)} type="button" aria-label="Remove exercise">
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </article>
                    ))}
                  </div>

                  <div className="training-actions">
                    <button className="btn btn-primary" disabled={isSavingWorkout} onClick={saveWorkout} type="button">
                      {isSavingWorkout ? 'Saving Workout' : 'Save Workout'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="card training-history-panel">
                  {visibleWorkouts.length ? (
                    [...workouts]
                      .sort((a, b) => new Date(workoutDate(b)) - new Date(workoutDate(a)))
                      .map((workout) => (
                        <article className="history-row" key={getWorkoutId(workout) || `${workoutDate(workout)}-${workout.name}`}>
                          <div>
                            <p className="history-date">{formatHistoryDate(workoutDate(workout))}</p>
                            <h3>{workout.name || workout.title || 'Workout'}</h3>
                            <p>{formatIntensity(workout.intensity)} intensity</p>
                          </div>
                          <div className="history-stats">
                            <span>{toNumber(workout.duration_minutes || workout.duration || workout.minutes)} min</span>
                            <span>{toNumber(workout.calories_burned || workout.calories)} kcal</span>
                            <span>{toNumber(workout.exercise_count || workout.exercises_count || workout.exercises?.length)} exercises</span>
                          </div>
                          <button className="history-delete" onClick={() => askToDeleteWorkout(workout)} type="button" aria-label={`Delete ${workout.name || 'workout'}`}>
                            <span className="material-symbols-outlined">delete</span>
                          </button>
                        </article>
                      ))
                  ) : (
                    <div className="empty-state">No workouts logged yet.</div>
                  )}
                </div>
              )}
            </section>
          )}

          {(classAction || classNotice || pendingWorkoutDelete || trainingNotice) ? (
            <div className="dashboard-modal-backdrop" role="presentation">
              <div className="dashboard-modal" role="dialog" aria-modal="true">
                <p className="hero-kicker">{classAction || pendingWorkoutDelete ? 'Confirmation' : 'Status'}</p>
                <h2>{classAction?.title || pendingWorkoutDelete?.title || classNotice?.title || trainingNotice?.title}</h2>
                <p>{classAction?.body || pendingWorkoutDelete?.body || classNotice?.body || trainingNotice?.body}</p>
                <div className="dashboard-modal-actions">
                  {classAction ? (
                    <>
                      <button className="btn btn-secondary" disabled={isClassSubmitting} onClick={() => setClassAction(null)} type="button">Back</button>
                      <button className={`btn ${classAction.type === 'cancel' ? 'cancel-action' : 'btn-primary'}`} disabled={isClassSubmitting} onClick={confirmClassAction} type="button">
                        {isClassSubmitting ? 'Saving' : classAction.type === 'book' ? 'Confirm Booking' : 'Cancel Booking'}
                      </button>
                    </>
                  ) : (
                    pendingWorkoutDelete ? (
                      <>
                        <button className="btn btn-secondary" disabled={isDeletingWorkout} onClick={() => setPendingWorkoutDelete(null)} type="button">Back</button>
                        <button className="btn cancel-action" disabled={isDeletingWorkout} onClick={confirmDeleteWorkout} type="button">
                          {isDeletingWorkout ? 'Deleting' : 'Delete Workout'}
                        </button>
                      </>
                    ) : (
                      <button className="btn btn-primary" onClick={() => { setClassNotice(null); setTrainingNotice(null); }} type="button">Done</button>
                    )
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
