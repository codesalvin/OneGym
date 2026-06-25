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
  { icon: 'restaurant', label: 'Food Log', tab: 'food' },
  { icon: 'smart_toy', label: 'AI Assistant', tab: 'ai' },
  { icon: 'forum', label: 'Trainer Chat', tab: 'trainer-chat' },
  { icon: 'leaderboard', label: 'Leaderboards', tab: 'leaderboards' },
  { icon: 'account_circle', label: 'Profile', tab: 'profile' },
];

const tabHeadings = {
  overview: {
    title: 'Dashboard',
    description: 'Here is your fitness overview.',
  },
  classes: {
    title: 'Classes',
    description: 'Book sessions, review upcoming classes, and manage your reservations.',
  },
  training: {
    title: 'Training',
    description: 'Log workouts and review your training history.',
  },
  food: {
    title: 'Food Log',
    description: 'Track meals, macros, and daily nutrition progress.',
  },
  ai: {
    title: 'AI Assistant',
    description: 'Get meal guidance based on your current nutrition progress.',
  },
  'trainer-chat': {
    title: 'Trainer Chat',
    description: 'Message trainers about classes, form, recovery, and session prep.',
  },
  leaderboards: {
    title: 'Leaderboards',
    description: 'Filter your personal records and compare your strongest lifts.',
  },
  profile: {
    title: 'Profile',
    description: 'Update your goals, profile photo, nutrition targets, and personal records.',
  },
};

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

const PR_EXERCISE_CATEGORIES = {
  Strength: [
    'Bench Press',
    'Squat',
    'Deadlift',
    'Overhead Press',
    'Barbell Row',
    'Leg Press',
    'Hip Thrust',
    'Pull-Up',
  ],
  Cardio: [
    'Running',
    'Biking',
    'Rowing',
    'Swimming',
    'Stair Climber',
    'Elliptical',
    'Skipping',
  ],
  Mobility: [
    'Front Split',
    'Side Split',
    'Shoulder Mobility',
    'Hip Mobility',
    'Deep Squat Hold',
    'Backbend',
  ],
  Bodyweight: [
    'Push-Up',
    'Pull-Up',
    'Dip',
    'Plank',
    'Burpee',
    'Pistol Squat',
    'Handstand Hold',
  ],
};

const PR_RECORD_TYPE_LABELS = {
  weight: 'Weight',
  reps: 'Reps',
  time: 'Time',
  distance: 'Distance',
  volume: 'Volume',
};

const PR_EXERCISE_TYPE_OPTIONS = {
  'Bench Press': ['weight', 'reps', 'volume'],
  Squat: ['weight', 'reps', 'volume'],
  Deadlift: ['weight', 'reps', 'volume'],
  'Overhead Press': ['weight', 'reps', 'volume'],
  'Barbell Row': ['weight', 'reps', 'volume'],
  'Leg Press': ['weight', 'reps', 'volume'],
  'Hip Thrust': ['weight', 'reps', 'volume'],
  'Pull-Up': ['reps', 'weight', 'volume'],
  Running: ['time', 'distance'],
  Biking: ['time', 'distance'],
  Rowing: ['time', 'distance'],
  Swimming: ['time', 'distance'],
  'Stair Climber': ['time'],
  Elliptical: ['time', 'distance'],
  Skipping: ['time', 'reps'],
  'Front Split': ['time'],
  'Side Split': ['time'],
  'Shoulder Mobility': ['time'],
  'Hip Mobility': ['time'],
  'Deep Squat Hold': ['time'],
  Backbend: ['time'],
  'Push-Up': ['reps', 'time'],
  Dip: ['reps', 'weight', 'volume'],
  Plank: ['time'],
  Burpee: ['reps', 'time'],
  'Pistol Squat': ['reps', 'weight'],
  'Handstand Hold': ['time'],
};

const PR_RECORD_TYPE_UNITS = {
  weight: 'kg',
  reps: 'reps',
  time: 'min',
  distance: 'km',
  volume: 'kg',
};

const emptyPrForm = {
  exercise_name: PR_EXERCISE_CATEGORIES.Strength[0],
  category: 'Strength',
  record_type: 'weight',
  value: '',
  unit: 'kg',
  recorded_at: new Date().toISOString().slice(0, 10),
  notes: '',
};

const MEAL_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snacks', label: 'Snacks' },
];

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('onegymUser') || 'null');
  } catch {
    return null;
  }
}

function getInitialTab() {
  if (typeof window === 'undefined') return 'overview';
  const tab = new URLSearchParams(window.location.search).get('tab');
  return ['overview', 'classes', 'training', 'food', 'ai', 'trainer-chat', 'leaderboards', 'profile'].includes(tab) ? tab : 'overview';
}

function isPrVerified(record) {
  return record?.status !== 'pending' && (
    record?.is_verified === true ||
    record?.is_verified === 1 ||
    record?.is_verified === '1' ||
    record?.is_verified === 'true'
  );
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

function profileFormFromUser(user = {}) {
  return {
    username: user.username || '',
    fitness_goal: user.fitness_goal || '',
    training_style: user.training_style || '',
    weekly_target: user.weekly_target || 3,
    weight_goal: user.weight_goal || '',
    starting_weight: user.starting_weight || '',
    current_weight: user.current_weight || '',
    goal_weight: user.goal_weight || '',
    weekly_goal: user.weekly_goal || '',
    calorie_goal: user.calorie_goal || CALORIE_GOAL,
    protein_goal: user.protein_goal || PROTEIN_GOAL,
    carbs_goal: user.carbs_goal || CARBS_GOAL,
    fats_goal: user.fats_goal || FATS_GOAL,
  };
}

function suggestDailyFuel(form) {
  const currentWeight = toNumber(form.current_weight);
  const goalWeight = toNumber(form.goal_weight);
  const weeklyGoal = toNumber(form.weekly_goal);
  const weeklySessions = toNumber(form.weekly_target);
  const style = form.training_style;

  if (!currentWeight) return null;

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

function shortDayLabel(value) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(value).toUpperCase();
}

function recentDayKeys(days = 7) {
  return Array.from({ length: days }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - (days - 1 - index));
    return {
      key: dateKey(day),
      label: shortDayLabel(day),
    };
  });
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

function formatMessageTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
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

function mealDate(meal) {
  return new Date(meal.meal_date || meal.logged_at || meal.created_at);
}

function formatMealTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
}

function summarizeMeals(rows) {
  return rows.reduce(
    (sum, meal) => ({
      calories: sum.calories + toNumber(meal.calories || meal.kcal),
      protein: sum.protein + toNumber(meal.protein_g || meal.protein),
      carbs: sum.carbs + toNumber(meal.carbs_g || meal.carbs || meal.carbohydrates_g),
      fats: sum.fats + toNumber(meal.fats_g || meal.fats || meal.fat_g),
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 },
  );
}

function groupMealsByDay(rows) {
  const groups = new Map();
  rows.forEach((meal) => {
    const key = dateKey(mealDate(meal));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(meal);
  });
  return [...groups.entries()].map(([key, dayMeals]) => ({ key, meals: dayMeals, totals: summarizeMeals(dayMeals) }));
}

function formatDayTitle(key) {
  if (key === dateKey()) return 'Today';
  if (key === dateKey(addDays(new Date(), -1))) return 'Yesterday';
  return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(`${key}T12:00:00`));
}

function buildAiIntro(displayName, totals, mealCount) {
  const remainingCalories = Math.max(0, CALORIE_GOAL - totals.calories);
  const remainingProtein = Math.max(0, PROTEIN_GOAL - totals.protein);
  if (!mealCount) {
    return `Good afternoon, ${displayName}. No meals are logged yet today. Add a meal and I can tailor recommendations around your calories and macros.`;
  }
  return `Good afternoon, ${displayName}. You have logged ${Math.round(totals.calories).toLocaleString()} kcal and ${Math.round(totals.protein)}g protein today. You still have about ${Math.round(remainingCalories).toLocaleString()} kcal and ${Math.round(remainingProtein)}g protein available.`;
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
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [user, setUser] = useState(() => getStoredUser());
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
  const [mealFilter, setMealFilter] = useState('all');
  const [mealSort, setMealSort] = useState('newest');
  const [mealDateFilter, setMealDateFilter] = useState('');
  const [editingMeal, setEditingMeal] = useState(null);
  const [pendingMealDelete, setPendingMealDelete] = useState(null);
  const [isSavingMealEdit, setIsSavingMealEdit] = useState(false);
  const [isDeletingMeal, setIsDeletingMeal] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiMessages, setAiMessages] = useState([]);
  const [isAiSending, setIsAiSending] = useState(false);
  const [chatTargets, setChatTargets] = useState([]);
  const [selectedTrainerId, setSelectedTrainerId] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('trainerId') || '';
  });
  const [trainerMessages, setTrainerMessages] = useState([]);
  const [trainerChatInput, setTrainerChatInput] = useState('');
  const [trainerChatStatus, setTrainerChatStatus] = useState('');
  const [isTrainerChatError, setIsTrainerChatError] = useState(false);
  const [isTrainerChatSending, setIsTrainerChatSending] = useState(false);
  const [profileForm, setProfileForm] = useState(() => profileFormFromUser(getStoredUser() || {}));
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(() => resolveMediaUrl(getStoredUser()?.profile_photo_url || ''));
  const [profileMessage, setProfileMessage] = useState('');
  const [isProfileError, setIsProfileError] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [manualFuelEdit, setManualFuelEdit] = useState(false);
  const [personalRecords, setPersonalRecords] = useState([]);
  const [leaderboardFilters, setLeaderboardFilters] = useState({
    category: 'all',
    exercise: 'all',
    recordType: 'all',
  });
  const [prForm, setPrForm] = useState(emptyPrForm);
  const [prProofFile, setPrProofFile] = useState(null);
  const [isSavingPr, setIsSavingPr] = useState(false);
  const [prMessage, setPrMessage] = useState('');
  const [isPrError, setIsPrError] = useState(false);
  const displayName = displayNameFor(user);
  const initials = initialsFor(user);
  const profilePhotoUrl = resolveMediaUrl(user?.profile_photo_url || user?.profile_picture || user?.avatar_url);
  const selectedTrainer = useMemo(
    () => chatTargets.find((target) => String(target.id) === String(selectedTrainerId)) || null,
    [chatTargets, selectedTrainerId],
  );
  const tabHeading = tabHeadings[activeTab] || tabHeadings.overview;
  const needsPrVideoProof = prForm.record_type === 'weight' && Number(prForm.value) > 250;
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
  const [mealNotice, setMealNotice] = useState(null);
  const [aiNotice, setAiNotice] = useState(null);
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

  const loadPersonalRecords = useCallback(async () => {
    if (!user?.id) {
      setPersonalRecords([]);
      return;
    }

    const response = await fetch(`${API_BASE_URL}/users/${user.id}/personal-records/`, {
      credentials: 'include',
    });
    const data = await parseResponse(response);
    if (!response.ok) throw new Error(data.detail || 'Unable to load personal records.');
    setPersonalRecords(Array.isArray(data) ? data : []);
  }, [user?.id]);

  const loadTrainerMessages = useCallback(async (trainerId = selectedTrainerId) => {
    if (!user?.id || !trainerId) {
      setTrainerMessages([]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/users/${user.id}/trainer-messages/?trainer_id=${trainerId}`, {
        credentials: 'include',
      });
      const data = await parseResponse(response);
      if (!response.ok) throw new Error(data.detail || 'Unable to load trainer chat.');

      setTrainerMessages(Array.isArray(data) ? data : []);
      setIsTrainerChatError(false);
      setTrainerChatStatus('');
    } catch (error) {
      setTrainerMessages([]);
      setIsTrainerChatError(true);
      setTrainerChatStatus(error instanceof Error ? error.message : 'Unable to load trainer chat.');
    }
  }, [selectedTrainerId, user?.id]);

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

  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;
    fetch(`${API_BASE_URL}/users/${user.id}/`, { credentials: 'include' })
      .then(async (response) => {
        const data = await parseResponse(response);
        if (!response.ok) throw new Error(data.detail || 'Unable to load profile.');
        return data;
      })
      .then((data) => {
        if (!isMounted) return;
        const updated = { ...user, ...data, profile_photo_url: resolveMediaUrl(data.profile_photo_url) };
        setUser(updated);
        setProfileForm(profileFormFromUser(updated));
        setProfilePhotoPreview(resolveMediaUrl(data.profile_photo_url));
        localStorage.setItem('onegymUser', JSON.stringify(updated));
        window.dispatchEvent(new Event('onegym-auth-change'));
      })
      .catch((error) => {
        if (!isMounted) return;
        setProfileMessage(error instanceof Error ? error.message : 'Unable to load profile.');
        setIsProfileError(true);
      });

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    loadPersonalRecords().catch((error) => {
      setIsPrError(true);
      setPrMessage(error instanceof Error ? error.message : 'Unable to load personal records.');
    });
  }, [loadPersonalRecords]);

  useEffect(() => {
    let isMounted = true;

    async function loadChatTargets() {
      try {
        const response = await fetch(`${API_BASE_URL}/users/`);
        const data = await parseResponse(response);
        if (!response.ok) throw new Error(data.detail || 'Unable to load trainers.');

        const trainers = (Array.isArray(data) ? data : []).filter((item) => item.role === 'trainer');
        if (!isMounted) return;
        setChatTargets(trainers);

        if (!selectedTrainerId && trainers.length) {
          setSelectedTrainerId(String(trainers[0].id));
        }
      } catch (error) {
        if (!isMounted) return;
        setIsTrainerChatError(true);
        setTrainerChatStatus(error instanceof Error ? error.message : 'Unable to load trainers.');
      }
    }

    loadChatTargets();
    return () => {
      isMounted = false;
    };
  }, [selectedTrainerId]);

  useEffect(() => {
    if (selectedTrainerId) {
      loadTrainerMessages(selectedTrainerId);
    }
  }, [loadTrainerMessages, selectedTrainerId]);

  useEffect(() => {
    if (!user?.id) {
      setAiMessages([]);
      return;
    }

    fetch(`${API_BASE_URL}/users/${user.id}/ai-messages/`)
      .then(async (response) => {
        const data = await parseResponse(response);
        if (!response.ok) throw new Error(data.detail || 'Unable to load AI messages.');
        return data;
      })
      .then((data) => {
        setAiMessages(Array.isArray(data) ? data.map((message) => ({
          id: message.id,
          role: message.role,
          title: message.title || undefined,
          body: message.body,
          cards: Array.isArray(message.cards) ? message.cards : [],
          quote: message.note || '',
          time: message.role === 'user' ? formatMealTime(message.created_at) : undefined,
        })) : []);
      })
      .catch(() => setAiMessages([]));
  }, [user?.id]);

  useEffect(() => () => {
    if (mealPhotoPreview) URL.revokeObjectURL(mealPhotoPreview);
  }, [mealPhotoPreview]);

  useEffect(() => () => {
    if (profilePhotoPreview?.startsWith('blob:')) URL.revokeObjectURL(profilePhotoPreview);
  }, [profilePhotoPreview]);

  useEffect(() => {
    if (manualFuelEdit) return;
    const suggested = suggestDailyFuel(profileForm);
    if (!suggested) return;
    setProfileForm((current) => ({ ...current, ...suggested }));
  }, [
    profileForm.current_weight,
    profileForm.goal_weight,
    profileForm.weekly_goal,
    profileForm.weekly_target,
    profileForm.weight_goal,
    profileForm.training_style,
    manualFuelEdit,
  ]);

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

  const filteredMeals = useMemo(() => {
    const visible = meals.filter((meal) => {
      const typeMatch = mealFilter === 'all' || normalizeMealType(meal.meal_type) === mealFilter;
      const dateMatch = !mealDateFilter || dateKey(mealDate(meal)) === mealDateFilter;
      return typeMatch && dateMatch;
    });
    return [...visible].sort((first, second) => {
      if (mealSort === 'oldest') return mealDate(first) - mealDate(second);
      if (mealSort === 'highest-protein') return toNumber(second.protein_g || second.protein) - toNumber(first.protein_g || first.protein);
      if (mealSort === 'lowest-calories') return toNumber(first.calories || first.kcal) - toNumber(second.calories || second.kcal);
      return mealDate(second) - mealDate(first);
    });
  }, [mealDateFilter, mealFilter, mealSort, meals]);

  const groupedMeals = useMemo(() => groupMealsByDay(filteredMeals), [filteredMeals]);
  const foodTotals = useMemo(() => summarizeMeals(filteredMeals), [filteredMeals]);
  const aiIntro = useMemo(() => ({
    id: 'intro',
    role: 'assistant',
    title: `Good afternoon, ${displayName}.`,
    body: buildAiIntro(displayName, nutrition, nutrition.todaysMeals.length),
  }), [displayName, nutrition]);
  const visibleAiMessages = [aiIntro, ...aiMessages];
  const leaderboardOptions = useMemo(() => {
    const categories = [...new Set(personalRecords.map((record) => record.category).filter(Boolean))].sort();
    const exercises = [...new Set(personalRecords.map((record) => record.exercise_name).filter(Boolean))].sort();
    const recordTypes = [...new Set(personalRecords.map((record) => record.record_type).filter(Boolean))].sort();
    return { categories, exercises, recordTypes };
  }, [personalRecords]);
  const leaderboardRows = useMemo(() => {
    return personalRecords
      .filter(isPrVerified)
      .filter((record) => {
        const categoryMatch = leaderboardFilters.category === 'all' || record.category === leaderboardFilters.category;
        const exerciseMatch = leaderboardFilters.exercise === 'all' || record.exercise_name === leaderboardFilters.exercise;
        const typeMatch = leaderboardFilters.recordType === 'all' || record.record_type === leaderboardFilters.recordType;
        return categoryMatch && exerciseMatch && typeMatch;
      })
      .sort((first, second) => {
        const valueDiff = toNumber(second.value) - toNumber(first.value);
        if (valueDiff !== 0) return valueDiff;
        return new Date(second.recorded_at) - new Date(first.recorded_at);
      });
  }, [leaderboardFilters, personalRecords]);
  const progressAnalytics = useMemo(() => {
    const days = recentDayKeys(7);
    const workoutCounts = days.map((day) => ({
      ...day,
      value: workouts.filter((workout) => dateKey(workoutDate(workout)) === day.key).length,
    }));
    const calorieDays = days.map((day) => ({
      ...day,
      value: meals
        .filter((meal) => dateKey(mealDate(meal)) === day.key)
        .reduce((sum, meal) => sum + toNumber(meal.calories || meal.kcal), 0),
    }));
    const startWeight = toNumber(profileForm.starting_weight || user?.starting_weight);
    const currentWeight = toNumber(profileForm.current_weight || user?.current_weight);
    const goalWeight = toNumber(profileForm.goal_weight || user?.goal_weight);
    const verifiedRecords = personalRecords.filter(isPrVerified);
    const pendingRecords = personalRecords.filter((record) => record.status === 'pending' || !isPrVerified(record));
    const latestRecord = [...personalRecords].sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))[0];

    return {
      workoutCounts,
      calorieDays,
      maxWorkoutCount: Math.max(1, ...workoutCounts.map((day) => day.value)),
      maxCalories: Math.max(1, CALORIE_GOAL, ...calorieDays.map((day) => day.value)),
      weight: {
        start: startWeight,
        current: currentWeight,
        goal: goalWeight,
        max: Math.max(1, startWeight, currentWeight, goalWeight),
      },
      records: {
        verified: verifiedRecords.length,
        pending: pendingRecords.length,
        latest: latestRecord,
      },
    };
  }, [meals, personalRecords, profileForm.current_weight, profileForm.goal_weight, profileForm.starting_weight, user?.current_weight, user?.goal_weight, user?.starting_weight, workouts]);

  function updateMealField(field, value) {
    setMealForm((current) => ({ ...current, [field]: value }));
  }

  function updateLeaderboardFilter(field, value) {
    setLeaderboardFilters((current) => ({ ...current, [field]: value }));
  }

  function openDashboardTab(tab) {
    setActiveTab(tab);
    setIsNavOpen(false);
  }

  function openTrainerChat(trainerId = '') {
    if (trainerId) {
      setSelectedTrainerId(String(trainerId));
    }
    openDashboardTab('trainer-chat');
  }

  function selectTrainerTarget(trainerId) {
    setSelectedTrainerId(String(trainerId));
    setTrainerChatStatus('');
    setIsTrainerChatError(false);
  }

  async function sendTrainerMessage(event) {
    event.preventDefault();

    const text = trainerChatInput.trim();
    if (!text || isTrainerChatSending) return;

    if (!selectedTrainerId) {
      setIsTrainerChatError(true);
      setTrainerChatStatus('Choose a trainer before sending a message.');
      return;
    }

    setIsTrainerChatSending(true);
    setTrainerChatInput('');
    setTrainerChatStatus('');
    setIsTrainerChatError(false);

    try {
      const response = await fetch(`${API_BASE_URL}/trainer-chat/messages/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_id: selectedTrainerId,
          body: text,
        }),
      });
      const data = await parseResponse(response);
      if (!response.ok) throw new Error(data.detail || 'Unable to send message.');

      setTrainerMessages((current) => [...current, data]);
    } catch (error) {
      setIsTrainerChatError(true);
      setTrainerChatStatus(error instanceof Error ? error.message : 'Unable to send message.');
      setTrainerChatInput(text);
    } finally {
      setIsTrainerChatSending(false);
    }
  }

  function updateProfileField(event) {
    const { name, value } = event.target;
    setProfileForm((current) => ({ ...current, [name]: value }));
  }

  function updateProfileFuelField(event) {
    setManualFuelEdit(true);
    updateProfileField(event);
  }

  function updatePrField(event) {
    const { name, value } = event.target;
    setPrForm((current) => {
      if (name === 'category') {
        const nextExercise = PR_EXERCISE_CATEGORIES[value]?.[0] || '';
        const nextType = PR_EXERCISE_TYPE_OPTIONS[nextExercise]?.[0] || 'weight';
        if (nextType !== 'weight') setPrProofFile(null);
        return {
          ...current,
          category: value,
          exercise_name: nextExercise,
          record_type: nextType,
          unit: PR_RECORD_TYPE_UNITS[nextType] || current.unit,
        };
      }

      if (name === 'exercise_name') {
        const nextType = PR_EXERCISE_TYPE_OPTIONS[value]?.[0] || current.record_type;
        if (nextType !== 'weight') setPrProofFile(null);
        return {
          ...current,
          exercise_name: value,
          record_type: nextType,
          unit: PR_RECORD_TYPE_UNITS[nextType] || current.unit,
        };
      }

      if (name === 'record_type') {
        if (value !== 'weight') setPrProofFile(null);
        return {
          ...current,
          record_type: value,
          unit: PR_RECORD_TYPE_UNITS[value] || current.unit,
        };
      }

      return { ...current, [name]: value };
    });
  }

  function updateProfilePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (profilePhotoPreview?.startsWith('blob:')) URL.revokeObjectURL(profilePhotoPreview);
    setProfilePhotoFile(file);
    setProfilePhotoPreview(URL.createObjectURL(file));
  }

  function applySuggestedFuel() {
    const suggested = suggestDailyFuel(profileForm);
    if (!suggested) return;
    setProfileForm((current) => ({ ...current, ...suggested }));
    setManualFuelEdit(false);
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!user?.id) return;

    setIsSavingProfile(true);
    setIsProfileError(false);
    setProfileMessage('');

    try {
      const payload = new FormData();
      payload.append('username', profileForm.username.trim());
      payload.append('fitness_goal', profileForm.fitness_goal.trim());
      payload.append('training_style', profileForm.training_style.trim());
      payload.append('weekly_target', profileForm.weekly_target || 0);
      payload.append('weight_goal', profileForm.weight_goal);
      payload.append('starting_weight', profileForm.starting_weight || '');
      payload.append('current_weight', profileForm.current_weight || '');
      payload.append('goal_weight', profileForm.goal_weight || '');
      payload.append('weekly_goal', profileForm.weekly_goal || '');
      payload.append('calorie_goal', profileForm.calorie_goal || '');
      payload.append('protein_goal', profileForm.protein_goal || '');
      payload.append('carbs_goal', profileForm.carbs_goal || '');
      payload.append('fats_goal', profileForm.fats_goal || '');
      if (profilePhotoFile) payload.append('profile_photo', profilePhotoFile);

      const response = await fetch(`${API_BASE_URL}/users/${user.id}/`, {
        method: 'PATCH',
        credentials: 'include',
        body: payload,
      });
      const data = await parseResponse(response);
      if (!response.ok) throw new Error(data.detail || 'Unable to save profile.');

      const updated = { ...user, ...data, profile_photo_url: resolveMediaUrl(data.profile_photo_url) };
      setUser(updated);
      setProfilePhotoFile(null);
      setProfilePhotoPreview(updated.profile_photo_url);
      localStorage.setItem('onegymUser', JSON.stringify(updated));
      window.dispatchEvent(new Event('onegym-auth-change'));
      setProfileMessage('Profile saved.');
    } catch (error) {
      setIsProfileError(true);
      setProfileMessage(error instanceof Error ? error.message : 'Unable to save profile.');
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function savePersonalRecord(event) {
    event.preventDefault();
    if (!user?.id) return;

    setIsSavingPr(true);
    setPrMessage('');
    setIsPrError(false);

    try {
      if (needsPrVideoProof && !prProofFile) {
        throw new Error('Video proof is required for weight PRs of 251kg and above.');
      }

      const payload = new FormData();
      payload.append('user_id', user.id);
      payload.append('exercise_name', prForm.exercise_name.trim());
      payload.append('category', prForm.category);
      payload.append('record_type', prForm.record_type);
      payload.append('value', Number(prForm.value));
      payload.append('unit', prForm.unit.trim());
      if (prForm.recorded_at) payload.append('recorded_at', `${prForm.recorded_at}T12:00:00`);
      payload.append('notes', prForm.notes.trim());
      if (prProofFile) payload.append('proof_video', prProofFile);

      const response = await fetch(`${API_BASE_URL}/personal-records/`, {
        method: 'POST',
        credentials: 'include',
        body: payload,
      });
      const data = await parseResponse(response);
      if (!response.ok) throw new Error(data.detail || 'Unable to save PR.');

      setPersonalRecords((current) => [data, ...current]);
      setPrForm(emptyPrForm);
      setPrProofFile(null);
      setIsPrError(false);
      setPrMessage(data.status === 'pending' ? data.verification_reason || 'PR saved for review.' : 'PR saved.');
    } catch (error) {
      setIsPrError(true);
      setPrMessage(error instanceof Error ? error.message : 'Unable to save PR.');
    } finally {
      setIsSavingPr(false);
    }
  }

  async function deletePersonalRecord(record) {
    if (!user?.id) return;

    try {
      const response = await fetch(`${API_BASE_URL}/personal-records/${record.id}/?user_id=${user.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await parseResponse(response);
      if (!response.ok) throw new Error(data.detail || 'Unable to delete PR.');

      setPersonalRecords((current) => current.filter((item) => item.id !== record.id));
      setIsPrError(false);
      setPrMessage('PR deleted.');
    } catch (error) {
      setIsPrError(true);
      setPrMessage(error instanceof Error ? error.message : 'Unable to delete PR.');
    }
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

  function startMealEdit(meal) {
    setEditingMeal({
      id: meal.id,
      description: meal.description || '',
      mealType: normalizeMealType(meal.meal_type),
      calories: String(Math.round(toNumber(meal.calories || meal.kcal))),
      protein: String(Math.round(toNumber(meal.protein_g || meal.protein))),
      carbs: String(Math.round(toNumber(meal.carbs_g || meal.carbs))),
      fats: String(Math.round(toNumber(meal.fats_g || meal.fats))),
    });
  }

  function updateMealEditField(event) {
    const { name, value } = event.target;
    setEditingMeal((current) => ({ ...current, [name]: value }));
  }

  async function saveMealEdit(event) {
    event.preventDefault();
    if (!editingMeal || !user?.id) return;

    setIsSavingMealEdit(true);
    try {
      const endpoint = `${API_BASE_URL}/meals/update/`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          meal_id: editingMeal.id,
          meal_type: editingMeal.mealType,
          description: editingMeal.description.trim(),
          calories: Number(editingMeal.calories),
          protein_g: Number(editingMeal.protein),
          carbs_g: Number(editingMeal.carbs),
          fats_g: Number(editingMeal.fats),
        }),
      });
      const data = await parseResponse(response);
      if (!response.ok) throw new Error(data.detail || 'Unable to update meal.');
      await loadMeals();
      setEditingMeal(null);
      setMealNotice({ title: 'Meal updated', body: data.detail || 'Meal nutrition was updated.' });
    } catch (error) {
      setEditingMeal(null);
      setMealNotice({ title: 'Could not update meal', body: error instanceof Error ? error.message : 'Unable to update meal.' });
    } finally {
      setIsSavingMealEdit(false);
    }
  }

  async function confirmDeleteMeal() {
    if (!pendingMealDelete || !user?.id) return;

    setIsDeletingMeal(true);
    try {
      const endpoint = `${API_BASE_URL}/meals/delete/`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, meal_id: pendingMealDelete.id }),
      });
      const data = await parseResponse(response);
      if (!response.ok) throw new Error(data.detail || 'Unable to delete meal.');
      await loadMeals();
      setPendingMealDelete(null);
      setMealNotice({ title: 'Meal deleted', body: data.detail || 'Meal removed.' });
    } catch (error) {
      setPendingMealDelete(null);
      setMealNotice({ title: 'Could not delete meal', body: error instanceof Error ? error.message : 'Unable to delete meal.' });
    } finally {
      setIsDeletingMeal(false);
    }
  }

  async function sendAiMessage(event) {
    event.preventDefault();
    const text = aiInput.trim();
    if (!text || isAiSending) return;

    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      body: text,
      time: formatMealTime(new Date()),
    };
    setAiMessages((current) => [...current, userMessage]);
    setAiInput('');
    setIsAiSending(true);

    try {
      if (!user?.id) throw new Error('Please sign in before using the AI Assistant.');
      const response = await fetch(`${API_BASE_URL}/ai-assistant/chat/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, message: text }),
      });
      const data = await parseResponse(response);
      if (!response.ok) throw new Error(data.detail || 'AI Assistant is unavailable.');
      setAiMessages((current) => [...current, {
        id: data.id || crypto.randomUUID(),
        role: 'assistant',
        title: 'Assistant Recommendation',
        body: data.reply,
        cards: Array.isArray(data.cards) ? data.cards : [],
        quote: data.note || '',
      }]);
    } catch (error) {
      setAiMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: 'assistant',
        title: 'Assistant Unavailable',
        body: error instanceof Error ? error.message : 'AI Assistant is unavailable.',
      }]);
    } finally {
      setIsAiSending(false);
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

  function renderTodayNutrition() {
    return (
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
                          P {Math.round(toNumber(meal.protein_g || meal.protein))}g â€¢ C {Math.round(toNumber(meal.carbs_g || meal.carbs))}g â€¢ F {Math.round(toNumber(meal.fats_g || meal.fats))}g
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
    );
  }

  return (
    <div className={`member-dashboard-page tab-${activeTab} ${isNavOpen ? 'nav-open' : ''}`}>
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
                  <h1>{tabHeading.title}</h1>
                  <p>Welcome back, {displayName}. {tabHeading.description}</p>
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
              <button className="top-avatar-link" onClick={() => openDashboardTab('profile')} type="button">
                {profilePhotoUrl ? <img alt="" className="av top-avatar avatar-img" src={profilePhotoUrl} /> : <div className="av top-avatar">{initials}</div>}
              </button>
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
                  <button className="btn btn-secondary" onClick={() => openDashboardTab('food')} type="button">
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
                          <button className="btn btn-secondary small-action" onClick={() => openTrainerChat(item.trainer_id)} type="button">
                            Chat
                          </button>
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

          <section className="fade delay-3 progress-analytics">
            <div className="section-header">
              <div>
                <h2 className="section-title">Progress Analytics</h2>
                <p className="section-subtitle">Weight, training rhythm, calories, and records in one glance.</p>
              </div>
              <span className="date-label">LAST 7 DAYS</span>
            </div>
            <div className="analytics-grid">
              <article className="card analytics-card weight-analytics">
                <div className="analytics-card-head">
                  <div>
                    <span className="label">Weight Changes</span>
                    <strong>{progressAnalytics.weight.current ? `${progressAnalytics.weight.current.toFixed(1)} kg` : '--'}</strong>
                  </div>
                  <span className="material-symbols-outlined stat-icon">monitor_weight</span>
                </div>
                <div className="weight-track">
                  {[
                    ['Start', progressAnalytics.weight.start],
                    ['Current', progressAnalytics.weight.current],
                    ['Goal', progressAnalytics.weight.goal],
                  ].map(([label, value]) => (
                    <div className="weight-row" key={label}>
                      <span>{label}</span>
                      <div className="analytics-bar-bg">
                        <div className="analytics-bar-fill weight-fill" style={{ width: `${pct(value, progressAnalytics.weight.max)}%` }} />
                      </div>
                      <strong>{value ? `${Number(value).toFixed(1)}` : '--'}</strong>
                    </div>
                  ))}
                </div>
              </article>

              <article className="card analytics-card">
                <div className="analytics-card-head">
                  <div>
                    <span className="label">Workout Frequency</span>
                    <strong>{progressAnalytics.workoutCounts.reduce((sum, day) => sum + day.value, 0)} sessions</strong>
                  </div>
                  <span className="material-symbols-outlined stat-icon teal-icon">calendar_month</span>
                </div>
                <div className="mini-bar-chart">
                  {progressAnalytics.workoutCounts.map((day) => (
                    <div className="mini-bar" key={day.key}>
                      <div style={{ height: `${Math.max(8, pct(day.value, progressAnalytics.maxWorkoutCount))}%` }} />
                      <span>{day.label}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="card analytics-card">
                <div className="analytics-card-head">
                  <div>
                    <span className="label">Calorie Trends</span>
                    <strong>{Math.round(nutrition.calories).toLocaleString()} kcal today</strong>
                  </div>
                  <span className="material-symbols-outlined stat-icon yellow-icon">show_chart</span>
                </div>
                <div className="calorie-sparkline">
                  {progressAnalytics.calorieDays.map((day) => (
                    <div className="calorie-point" key={day.key}>
                      <span>{Math.round(day.value).toLocaleString()}</span>
                      <div style={{ height: `${Math.max(6, pct(day.value, progressAnalytics.maxCalories))}%` }} />
                      <small>{day.label}</small>
                    </div>
                  ))}
                </div>
              </article>

              <article className="card analytics-card pr-analytics">
                <div className="analytics-card-head">
                  <div>
                    <span className="label">Personal Records</span>
                    <strong>{progressAnalytics.records.verified} verified</strong>
                  </div>
                  <span className="material-symbols-outlined stat-icon">emoji_events</span>
                </div>
                <div className="pr-analytics-body">
                  <div>
                    <span>Pending review</span>
                    <strong>{progressAnalytics.records.pending}</strong>
                  </div>
                  <div>
                    <span>Latest</span>
                    <strong>{progressAnalytics.records.latest ? `${progressAnalytics.records.latest.exercise_name} ${Number(progressAnalytics.records.latest.value).toLocaleString()}${progressAnalytics.records.latest.unit}` : 'No PR yet'}</strong>
                  </div>
                </div>
              </article>
            </div>
          </section>

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
                  <button className="view-all as-button" onClick={() => setActiveTab('food')} type="button">View full log</button>
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
                            <button className="btn btn-secondary small-action" onClick={() => openTrainerChat(item.trainer_id)} type="button">Chat</button>
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
          ) : activeTab === 'training' ? (
            <section className="training-tab fade">
              <div className="section-header">
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

              {trainingView === 'log' ? (
              <section className="card profile-pr-panel training-pr-panel">
                <div className="profile-panel-title">
                  <p className="hero-kicker">Personal Records</p>
                  <h3>Lift receipts</h3>
                </div>
                <form className="profile-pr-form" onSubmit={savePersonalRecord}>
                  <label className="dashboard-field">
                    <span>Category</span>
                    <select name="category" onChange={updatePrField} value={prForm.category}>
                      {Object.keys(PR_EXERCISE_CATEGORIES).map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                  <label className="dashboard-field">
                    <span>Exercise</span>
                    <select name="exercise_name" onChange={updatePrField} required value={prForm.exercise_name}>
                      {(PR_EXERCISE_CATEGORIES[prForm.category] || []).map((exercise) => (
                        <option key={exercise} value={exercise}>{exercise}</option>
                      ))}
                    </select>
                  </label>
                  <label className="dashboard-field">
                    <span>Type</span>
                    <select name="record_type" onChange={updatePrField} value={prForm.record_type}>
                      {(PR_EXERCISE_TYPE_OPTIONS[prForm.exercise_name] || ['weight']).map((type) => (
                        <option key={type} value={type}>{PR_RECORD_TYPE_LABELS[type]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="dashboard-field">
                    <span>Value</span>
                    <input min="0" name="value" onChange={updatePrField} required step="0.01" type="number" value={prForm.value} />
                  </label>
                  <label className="dashboard-field">
                    <span>Unit</span>
                    <input name="unit" onChange={updatePrField} required type="text" value={prForm.unit} />
                  </label>
                  <label className="dashboard-field">
                    <span>Date</span>
                    <input name="recorded_at" onChange={updatePrField} type="date" value={prForm.recorded_at} />
                  </label>
                  <label className="dashboard-field pr-notes">
                    <span>Notes</span>
                    <input name="notes" onChange={updatePrField} placeholder="Felt clean, no spotter" type="text" value={prForm.notes} />
                  </label>
                  {needsPrVideoProof ? (
                    <label className="dashboard-field pr-proof">
                      <span>Video Proof Required</span>
                      <input
                        accept="video/mp4,video/webm,video/quicktime"
                        onChange={(event) => setPrProofFile(event.target.files?.[0] || null)}
                        required
                        type="file"
                      />
                    </label>
                  ) : null}
                  <button className="btn btn-primary" disabled={isSavingPr} type="submit">{isSavingPr ? 'Saving...' : 'Save PR'}</button>
                </form>
                {prMessage ? <p className={`dashboard-message ${isPrError ? 'error' : 'success'}`}>{prMessage}</p> : null}
                <div className="profile-pr-list">
                  {personalRecords.length ? personalRecords.map((record) => (
                    <article key={record.id}>
                      <div>
                        <span>{record.category || 'PR'}</span>
                        <h3>{record.exercise_name}</h3>
                        <p>
                          {record.record_type} · {new Date(record.recorded_at).toLocaleDateString()}
                          {isPrVerified(record) ? <em className="pr-status verified">Verified</em> : <em className="pr-status pending">Pending review</em>}
                          {record.proof_url ? <em className="pr-status proof">Proof uploaded</em> : null}
                        </p>
                      </div>
                      <strong>{Number(record.value).toLocaleString()} {record.unit}</strong>
                      <button aria-label={`Delete ${record.exercise_name} PR`} onClick={() => deletePersonalRecord(record)} type="button">
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </article>
                  )) : (
                    <div className="empty-state">No PRs saved yet.</div>
                  )}
                </div>
              </section>
              ) : null}
            </section>
          ) : activeTab === 'food' ? (
            <section className="food-tab fade">
              {renderTodayNutrition()}

              <div className="section-header">
                <div className="dashboard-tab-switch">
                  {MEAL_FILTERS.map((type) => (
                    <button className={mealFilter === type.value ? 'active' : ''} key={type.value} onClick={() => setMealFilter(type.value)} type="button">
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <section className="food-summary-grid">
                <article className="card food-summary-card">
                  <span>Calories</span>
                  <strong>{Math.round(foodTotals.calories).toLocaleString()}</strong>
                  <small>{filteredMeals.length} meals logged</small>
                </article>
                <article className="card food-summary-card">
                  <span>Protein</span>
                  <strong>{Math.round(foodTotals.protein)}g</strong>
                  <small>{Math.round(foodTotals.carbs)}g carbs</small>
                </article>
                <article className="card food-summary-card">
                  <span>Fats</span>
                  <strong>{Math.round(foodTotals.fats)}g</strong>
                  <small>Sorted by {mealSort.replace('-', ' ')}</small>
                </article>
                <label className="card food-sort-card">
                  <span>Sort By</span>
                  <select onChange={(event) => setMealSort(event.target.value)} value={mealSort}>
                    <option value="newest">Newest Date</option>
                    <option value="oldest">Oldest Date</option>
                    <option value="highest-protein">Highest Protein</option>
                    <option value="lowest-calories">Lowest Calories</option>
                  </select>
                  <span className="food-date-label">Filter Date</span>
                  <input onChange={(event) => setMealDateFilter(event.target.value)} type="date" value={mealDateFilter} />
                  {mealDateFilter ? <button onClick={() => setMealDateFilter('')} type="button">Clear date</button> : null}
                </label>
              </section>

              <div className="card food-history-panel">
                {mealMessage && meals.length === 0 ? <div className="empty-state">{mealMessage}</div> : null}
                {!mealMessage && groupedMeals.length === 0 ? <div className="empty-state">No meals match this filter yet.</div> : null}
                {groupedMeals.map((day) => (
                  <section className="food-day" key={day.key}>
                    <aside>
                      <h3>{formatDayTitle(day.key)}</h3>
                      <p>{formatDateLabel(new Date(`${day.key}T12:00:00`))}</p>
                      <div>
                        <strong>{Math.round(day.totals.calories).toLocaleString()} kcal</strong>
                        <span>{Math.round(day.totals.protein)}g protein</span>
                        <span>{Math.round(day.totals.carbs)}g carbs</span>
                        <span>{Math.round(day.totals.fats)}g fats</span>
                      </div>
                    </aside>
                    <div className="food-day-items">
                      {day.meals.map((meal) => {
                        const photoUrl = resolveMediaUrl(meal.photo_url || meal.meal_photo);
                        return (
                          <article className="food-entry" key={meal.id}>
                            {photoUrl ? <img alt="" src={photoUrl} /> : <div className="food-placeholder"><span className="material-symbols-outlined">restaurant</span></div>}
                            <div className="food-entry-main">
                              <span>{formatMealTime(meal.meal_date || meal.created_at)} • {formatMealType(meal.meal_type)}</span>
                              <h3>{meal.description || 'Meal'}</h3>
                              <p>P {Math.round(toNumber(meal.protein_g || meal.protein))}g • C {Math.round(toNumber(meal.carbs_g || meal.carbs))}g • F {Math.round(toNumber(meal.fats_g || meal.fats))}g</p>
                            </div>
                            <strong>{Math.round(toNumber(meal.calories || meal.kcal)).toLocaleString()} kcal</strong>
                            <div className="food-actions">
                              <button onClick={() => startMealEdit(meal)} type="button" aria-label="Edit meal"><span className="material-symbols-outlined">edit</span></button>
                              <button className="danger" onClick={() => setPendingMealDelete(meal)} type="button" aria-label="Delete meal"><span className="material-symbols-outlined">delete</span></button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          ) : activeTab === 'ai' ? (
            <section className="ai-tab fade">
              <div className="ai-dashboard-grid">
                <aside className="ai-dashboard-stats">
                  <p className="hero-kicker">Vital Stats</p>
                  <div className="daily-fuel-ring ai-ring" style={{ '--ring-percent': `${nutrition.fuelPercent}%` }}>
                    <span>{nutrition.fuelPercent}%</span>
                  </div>
                  <div className="macro-bars ai-macros">
                    <div className="macro-item">
                      <div className="macro-label"><span>Protein</span><span>{Math.round(nutrition.protein)}g / {PROTEIN_GOAL}g</span></div>
                      <div className="bar-bg"><div className="bar-fill protein-fill" style={{ width: `${pct(nutrition.protein, PROTEIN_GOAL)}%` }} /></div>
                    </div>
                    <div className="macro-item">
                      <div className="macro-label"><span>Carbs</span><span>{Math.round(nutrition.carbs)}g / {CARBS_GOAL}g</span></div>
                      <div className="bar-bg"><div className="bar-fill carbs-fill" style={{ width: `${pct(nutrition.carbs, CARBS_GOAL)}%` }} /></div>
                    </div>
                    <div className="macro-item">
                      <div className="macro-label"><span>Fats</span><span>{Math.round(nutrition.fats)}g / {FATS_GOAL}g</span></div>
                      <div className="bar-bg"><div className="bar-fill fats-fill" style={{ width: `${pct(nutrition.fats, FATS_GOAL)}%` }} /></div>
                    </div>
                  </div>
                </aside>

                <div className="ai-chat-card">
                  <div className="ai-chat-list">
                    {visibleAiMessages.map((message) => (
                      <article className={`ai-dashboard-message ${message.role}`} key={message.id}>
                        {message.role === 'assistant' ? <span className="ai-label"><span className="material-symbols-outlined">smart_toy</span> OneGym AI Assistant</span> : null}
                        <div className="ai-dashboard-bubble">
                          {message.title ? <h3>{message.title}</h3> : null}
                          <p>{message.body}</p>
                          {message.cards?.length ? (
                            <div className="ai-card-grid">
                              {message.cards.map((card) => (
                                <div className="ai-mini-card" key={card.title || card.label}>
                                  <span>{card.label || card.title}</span>
                                  <strong>{card.title || card.body}</strong>
                                  {card.detail ? <p>{card.detail}</p> : null}
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {message.quote ? <em>{message.quote}</em> : null}
                        </div>
                        {message.role === 'user' ? <time>{message.time}</time> : null}
                      </article>
                    ))}
                  </div>
                  <form className="ai-dashboard-input" onSubmit={sendAiMessage}>
                    <input disabled={isAiSending} onChange={(event) => setAiInput(event.target.value)} placeholder={isAiSending ? 'Thinking...' : 'Ask your wellness assistant...'} value={aiInput} />
                    <button className="btn btn-primary" disabled={isAiSending} type="submit">
                      <span className="material-symbols-outlined">arrow_upward</span>
                    </button>
                  </form>
                </div>
              </div>
            </section>
          ) : activeTab === 'trainer-chat' ? (
            <section className="trainer-chat-tab fade">
              <div className="trainer-chat-dashboard">
                <aside className="card trainer-target-panel">
                  <div className="trainer-target-list">
                    {chatTargets.length ? chatTargets.map((target) => (
                      <button
                        className={String(target.id) === String(selectedTrainerId) ? 'active' : ''}
                        key={target.id}
                        onClick={() => selectTrainerTarget(target.id)}
                        type="button"
                      >
                        <span>{initialsFor(target)}</span>
                        <div>
                          <strong>{target.username || 'Trainer'}</strong>
                          <small>Tap to open conversation</small>
                        </div>
                      </button>
                    )) : (
                      <div className="empty-state">No trainers available yet.</div>
                    )}
                  </div>
                </aside>

                <section className="card trainer-chat-card">
                  <div className="trainer-chat-heading">
                    <div>
                      <p className="hero-kicker">Conversation</p>
                      <h3>{selectedTrainer ? selectedTrainer.username : 'Choose a trainer'}</h3>
                    </div>
                    {selectedTrainer ? <span>{initialsFor(selectedTrainer)}</span> : null}
                  </div>

                  {trainerChatStatus ? <p className={`dashboard-message ${isTrainerChatError ? 'error' : 'success'}`}>{trainerChatStatus}</p> : null}

                  <div className="trainer-message-list">
                    {!selectedTrainer ? (
                      <article className="trainer-message assistant">
                        <div className="trainer-message-bubble">
                          <h4>Select a trainer</h4>
                          <p>Choose someone from the left panel to start a saved conversation.</p>
                        </div>
                      </article>
                    ) : trainerMessages.length ? (
                      trainerMessages.map((message) => {
                        const isUserMessage = Number(message.sender_id) === Number(user?.id);
                        return (
                          <article className={`trainer-message ${isUserMessage ? 'user' : 'assistant'}`} key={message.id}>
                            {!isUserMessage ? (
                              <span className="trainer-message-label">
                                <span className="material-symbols-outlined">fitness_center</span>
                                {message.sender_name || selectedTrainer.username}
                              </span>
                            ) : null}
                            <div className="trainer-message-bubble">
                              <p>{message.body}</p>
                            </div>
                            {isUserMessage ? <time>{formatMessageTime(message.created_at)}</time> : null}
                          </article>
                        );
                      })
                    ) : (
                      <article className="trainer-message assistant">
                        <span className="trainer-message-label">
                          <span className="material-symbols-outlined">fitness_center</span>
                          {selectedTrainer.username}
                        </span>
                        <div className="trainer-message-bubble">
                          <h4>Start the conversation</h4>
                          <p>Send a question about your booked class, training form, or what to prepare before your next session.</p>
                        </div>
                      </article>
                    )}
                  </div>

                  <form className="trainer-chat-input" onSubmit={sendTrainerMessage}>
                    <input
                      disabled={isTrainerChatSending || !selectedTrainer}
                      onChange={(event) => setTrainerChatInput(event.target.value)}
                      placeholder={selectedTrainer ? `Message ${selectedTrainer.username}...` : 'Choose a trainer first'}
                      type="text"
                      value={trainerChatInput}
                    />
                    <button className="btn btn-primary" disabled={isTrainerChatSending || !selectedTrainer} type="submit">
                      <span className="material-symbols-outlined">arrow_upward</span>
                    </button>
                  </form>
                </section>
              </div>
            </section>
          ) : activeTab === 'leaderboards' ? (
            <section className="leaderboards-tab fade">
              <section className="card leaderboard-filter-panel">
                <label className="dashboard-field">
                  <span>Category</span>
                  <select onChange={(event) => updateLeaderboardFilter('category', event.target.value)} value={leaderboardFilters.category}>
                    <option value="all">All categories</option>
                    {leaderboardOptions.categories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
                <label className="dashboard-field">
                  <span>Exercise</span>
                  <select onChange={(event) => updateLeaderboardFilter('exercise', event.target.value)} value={leaderboardFilters.exercise}>
                    <option value="all">All exercises</option>
                    {leaderboardOptions.exercises.map((exercise) => <option key={exercise} value={exercise}>{exercise}</option>)}
                  </select>
                </label>
                <label className="dashboard-field">
                  <span>Record Type</span>
                  <select onChange={(event) => updateLeaderboardFilter('recordType', event.target.value)} value={leaderboardFilters.recordType}>
                    <option value="all">All types</option>
                    {leaderboardOptions.recordTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
              </section>

              <section className="card leaderboard-panel">
                <div className="leaderboard-head">
                  <span>Rank</span>
                  <span>Exercise</span>
                  <span>Type</span>
                  <span>Value</span>
                  <span>Date</span>
                </div>
                <div className="leaderboard-list">
                  {leaderboardRows.length ? leaderboardRows.map((record, index) => (
                    <article className="leaderboard-row" key={record.id || `${record.exercise_name}-${record.recorded_at}-${index}`}>
                      <div className="leaderboard-rank">{index + 1}</div>
                      <div>
                        <strong>{record.exercise_name}</strong>
                        <small>{record.category || 'Personal record'}</small>
                      </div>
                      <span>{record.record_type}</span>
                      <strong>{Number(record.value).toLocaleString()} {record.unit}</strong>
                      <time>{new Date(record.recorded_at).toLocaleDateString()}</time>
                    </article>
                  )) : (
                    <div className="empty-state">No personal records match these filters.</div>
                  )}
                </div>
              </section>
            </section>
          ) : (
            <section className="profile-tab fade">
              <section className="card dashboard-profile-hero">
                <div className="dashboard-profile-photo">
                  {profilePhotoPreview || profilePhotoUrl ? (
                    <img alt={displayName} src={profilePhotoPreview || profilePhotoUrl} />
                  ) : (
                    <span>{initials}</span>
                  )}
                  <label>
                    <input accept="image/*" onChange={updateProfilePhoto} type="file" />
                    Change photo
                  </label>
                </div>
                <div>
                  <p className="hero-kicker">Your space</p>
                  <h2>{displayName}</h2>
                  <p>Keep your weekly rhythm visible and your training goal honest.</p>
                </div>
              </section>

              <form className="dashboard-profile-grid" onSubmit={saveProfile}>
                <section className="card dashboard-profile-panel">
                  <div className="profile-panel-title">
                    <p className="hero-kicker">Details</p>
                    <h3>About you</h3>
                  </div>
                  <label className="dashboard-field">
                    <span>Display Name</span>
                    <input name="username" onChange={updateProfileField} required type="text" value={profileForm.username} />
                  </label>
                  <label className="dashboard-field">
                    <span>Fitness Goal</span>
                    <textarea
                      name="fitness_goal"
                      onChange={updateProfileField}
                      placeholder="Build stronger legs, feel better running stairs, stay consistent for 12 weeks..."
                      rows="5"
                      value={profileForm.fitness_goal}
                    />
                  </label>
                  <div className="profile-field-grid">
                    <label className="dashboard-field wide">
                      <span>Weight Goal</span>
                      <select name="weight_goal" onChange={updateProfileField} value={profileForm.weight_goal}>
                        <option value="">Pick one</option>
                        <option value="Lose weight">Lose weight</option>
                        <option value="Maintain weight">Maintain weight</option>
                        <option value="Gain weight">Gain weight</option>
                        <option value="Recomposition">Recomposition</option>
                      </select>
                    </label>
                    <label className="dashboard-field">
                      <span>Weekly Goal (kg)</span>
                      <input name="weekly_goal" onChange={updateProfileField} step="0.1" type="number" value={profileForm.weekly_goal} />
                    </label>
                    <label className="dashboard-field">
                      <span>Starting Weight (kg)</span>
                      <input min="0" name="starting_weight" onChange={updateProfileField} step="0.1" type="number" value={profileForm.starting_weight} />
                    </label>
                    <label className="dashboard-field">
                      <span>Current Weight (kg)</span>
                      <input min="0" name="current_weight" onChange={updateProfileField} step="0.1" type="number" value={profileForm.current_weight} />
                    </label>
                    <label className="dashboard-field">
                      <span>Goal Weight (kg)</span>
                      <input min="0" name="goal_weight" onChange={updateProfileField} step="0.1" type="number" value={profileForm.goal_weight} />
                    </label>
                  </div>
                </section>

                <aside className="card dashboard-profile-panel">
                  <div className="profile-panel-title">
                    <p className="hero-kicker">Training Feel</p>
                    <h3>What are we chasing?</h3>
                  </div>
                  <label className="dashboard-field">
                    <span>Training Style</span>
                    <select name="training_style" onChange={updateProfileField} value={profileForm.training_style}>
                      <option value="">Pick a vibe</option>
                      <option value="Strength">Strength</option>
                      <option value="Hypertrophy">Hypertrophy</option>
                      <option value="Fat loss">Fat loss</option>
                      <option value="Mobility">Mobility</option>
                      <option value="Athletic conditioning">Athletic conditioning</option>
                    </select>
                  </label>
                  <label className="dashboard-field">
                    <span>Weekly Sessions</span>
                    <input max="21" min="0" name="weekly_target" onChange={updateProfileField} type="number" value={profileForm.weekly_target} />
                  </label>
                  <div className="profile-panel-title compact">
                    <p className="hero-kicker">Nutrition Targets</p>
                    <h3>Daily fuel</h3>
                  </div>
                  <p className="profile-helper">Suggested from your current weight, training style, weekly sessions, and goal. Edit anytime.</p>
                  <div className="profile-macro-grid">
                    <label className="dashboard-field">
                      <span>Calories</span>
                      <input min="0" name="calorie_goal" onChange={updateProfileFuelField} type="number" value={profileForm.calorie_goal} />
                    </label>
                    <label className="dashboard-field">
                      <span>Protein (g)</span>
                      <input min="0" name="protein_goal" onChange={updateProfileFuelField} type="number" value={profileForm.protein_goal} />
                    </label>
                    <label className="dashboard-field">
                      <span>Carbs (g)</span>
                      <input min="0" name="carbs_goal" onChange={updateProfileFuelField} type="number" value={profileForm.carbs_goal} />
                    </label>
                    <label className="dashboard-field">
                      <span>Fat (g)</span>
                      <input min="0" name="fats_goal" onChange={updateProfileFuelField} type="number" value={profileForm.fats_goal} />
                    </label>
                  </div>
                  <button className="btn btn-secondary btn-full" onClick={applySuggestedFuel} type="button">Recalculate Fuel</button>
                  <div className="profile-goal-summary">
                    <span className="material-symbols-outlined">flag</span>
                    <strong>{profileForm.weight_goal || profileForm.training_style || 'Your next chapter'}</strong>
                    <p>
                      {profileForm.current_weight && profileForm.goal_weight
                        ? `${profileForm.current_weight}kg now, aiming for ${profileForm.goal_weight}kg.`
                        : profileForm.fitness_goal || 'Add a goal so the dashboard knows what you are working toward.'}
                    </p>
                  </div>
                  <button className="btn btn-primary btn-full" disabled={isSavingProfile} type="submit">
                    {isSavingProfile ? 'Saving...' : 'Save Profile'}
                  </button>
                  {profileMessage ? <p className={`dashboard-message ${isProfileError ? 'error' : 'success'}`}>{profileMessage}</p> : null}
                </aside>
              </form>


            </section>
          )}

          {(classAction || classNotice || pendingWorkoutDelete || trainingNotice || editingMeal || pendingMealDelete || mealNotice || aiNotice) ? (
            <div className="dashboard-modal-backdrop" role="presentation">
              <div className="dashboard-modal" role="dialog" aria-modal="true">
                <p className="hero-kicker">{classAction || pendingWorkoutDelete || pendingMealDelete || editingMeal ? 'Confirmation' : 'Status'}</p>
                <h2>{editingMeal ? 'Edit nutrition' : classAction?.title || pendingWorkoutDelete?.title || (pendingMealDelete ? 'Delete meal' : '') || classNotice?.title || trainingNotice?.title || mealNotice?.title || aiNotice?.title}</h2>
                {editingMeal ? (
                  <form className="dashboard-edit-form" onSubmit={saveMealEdit}>
                    <p>Adjust the nutrition values for <strong>{editingMeal.description}</strong>.</p>
                    <div className="dashboard-edit-grid">
                      <label>Meal Type<select name="mealType" onChange={updateMealEditField} value={editingMeal.mealType}>{MEAL_FILTERS.filter((type) => type.value !== 'all').map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
                      <label>Description<input name="description" onChange={updateMealEditField} required value={editingMeal.description} /></label>
                      <label>Calories<input min="0" name="calories" onChange={updateMealEditField} required type="number" value={editingMeal.calories} /></label>
                      <label>Protein<input min="0" name="protein" onChange={updateMealEditField} required type="number" value={editingMeal.protein} /></label>
                      <label>Carbs<input min="0" name="carbs" onChange={updateMealEditField} required type="number" value={editingMeal.carbs} /></label>
                      <label>Fats<input min="0" name="fats" onChange={updateMealEditField} required type="number" value={editingMeal.fats} /></label>
                    </div>
                    <div className="dashboard-modal-actions">
                      <button className="btn btn-secondary" disabled={isSavingMealEdit} onClick={() => setEditingMeal(null)} type="button">Back</button>
                      <button className="btn btn-primary" disabled={isSavingMealEdit} type="submit">{isSavingMealEdit ? 'Saving' : 'Save Meal'}</button>
                    </div>
                  </form>
                ) : (
                  <>
                <p>{classAction?.body || pendingWorkoutDelete?.body || (pendingMealDelete ? `Delete "${pendingMealDelete.description}" from your food log?` : '') || classNotice?.body || trainingNotice?.body || mealNotice?.body || aiNotice?.body}</p>
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
                    ) : pendingMealDelete ? (
                      <>
                        <button className="btn btn-secondary" disabled={isDeletingMeal} onClick={() => setPendingMealDelete(null)} type="button">Back</button>
                        <button className="btn cancel-action" disabled={isDeletingMeal} onClick={confirmDeleteMeal} type="button">{isDeletingMeal ? 'Deleting' : 'Delete Meal'}</button>
                      </>
                    ) : (
                      <button className="btn btn-primary" onClick={() => { setClassNotice(null); setTrainingNotice(null); setMealNotice(null); setAiNotice(null); }} type="button">Done</button>
                    )
                  )}
                </div>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
