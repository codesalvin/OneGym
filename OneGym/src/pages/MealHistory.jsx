import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { NavBar } from '../components/NavBar';
import { Footer } from '../components/Footer';
import './MealHistory.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
const MEAL_TYPES = [
  { value: 'all', label: 'All' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snacks', label: 'Snacks' },
];

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
        ? `Meal API returned HTML from ${requestUrl} (${response.status}, ${contentType}).`
        : text,
    };
  }
}

function numericValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatWholeNumber(value) {
  return Math.round(value).toLocaleString('en-US');
}

function normalizeMealType(value) {
  const normalized = String(value || '').toLowerCase();
  return MEAL_TYPES.some((type) => type.value === normalized) ? normalized : 'breakfast';
}

function formatMealType(value) {
  return MEAL_TYPES.find((type) => type.value === normalizeMealType(value))?.label || 'Breakfast';
}

function getMealDate(meal) {
  return new Date(meal.meal_date || meal.created_at);
}

function getDayKey(meal) {
  const date = getMealDate(meal);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDayTitle(key) {
  const todayKey = getDayKey({ meal_date: new Date() });
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getDayKey({ meal_date: yesterday });

  if (key === todayKey) {
    return 'Today';
  }

  if (key === yesterdayKey) {
    return 'Yesterday';
  }

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
  }).format(new Date(`${key}T12:00:00`));
}

function formatDayDate(key) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${key}T12:00:00`)).toUpperCase();
}

function formatMealTime(value) {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
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

function summarizeMeals(meals) {
  return meals.reduce(
    (total, meal) => ({
      calories: total.calories + numericValue(meal.calories),
      protein: total.protein + numericValue(meal.protein_g),
      carbs: total.carbs + numericValue(meal.carbs_g),
      fats: total.fats + numericValue(meal.fats_g),
    }),
    {
      calories: 0,
      protein: 0,
      carbs: 0,
      fats: 0,
    },
  );
}

export function MealHistoryPage() {
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('onegymUser') || '{}');
    } catch {
      return {};
    }
  }, []);
  const [meals, setMeals] = useState([]);
  const [message, setMessage] = useState('');
  const [activeType, setActiveType] = useState('all');
  const [sortMode, setSortMode] = useState('newest');

  useEffect(() => {
    if (!user?.id) {
      setMeals([]);
      setMessage('Please sign in to view meal history.');
      return;
    }

    const endpoint = `${API_BASE_URL}/users/${user.id}/meals/?limit=all`;
    fetch(endpoint)
      .then(async (response) => {
        const data = await readApiResponse(response, endpoint);
        if (!response.ok) {
          throw new Error(data.detail || 'Unable to load meal history.');
        }

        return data;
      })
      .then((data) => {
        setMeals(Array.isArray(data) ? data : []);
        setMessage('');
      })
      .catch((error) => {
        setMeals([]);
        setMessage(error.message);
      });
  }, [user?.id]);

  const filteredMeals = useMemo(() => {
    const visible = activeType === 'all'
      ? meals
      : meals.filter((meal) => normalizeMealType(meal.meal_type) === activeType);

    return [...visible].sort((first, second) => {
      if (sortMode === 'highest-protein') {
        return numericValue(second.protein_g) - numericValue(first.protein_g);
      }

      if (sortMode === 'lowest-calories') {
        return numericValue(first.calories) - numericValue(second.calories);
      }

      return getMealDate(second) - getMealDate(first);
    });
  }, [activeType, meals, sortMode]);

  const groupedDays = useMemo(() => {
    const groups = new Map();
    filteredMeals.forEach((meal) => {
      const key = getDayKey(meal);
      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key).push(meal);
    });

    return Array.from(groups.entries()).map(([key, dayMeals]) => ({
      key,
      meals: dayMeals,
      totals: summarizeMeals(dayMeals),
    }));
  }, [filteredMeals]);

  const allTotals = useMemo(() => summarizeMeals(filteredMeals), [filteredMeals]);
  const averageCalories = groupedDays.length ? allTotals.calories / groupedDays.length : 0;
  const rangeLabel = groupedDays.length
    ? `${formatDayDate(groupedDays[groupedDays.length - 1].key)} - ${formatDayDate(groupedDays[0].key)}`
    : 'No meals yet';

  return (
    <>
      <NavBar />
      <main className="meal-history-page">
        <header className="meal-history-header">
          <Link className="meal-history-back" to="/member-dashboard">
            <span className="material-symbols-outlined">arrow_back</span>
            Dashboard
          </Link>
          <div>
            <p>Wellness Sanctuary</p>
            <h1>Meal History</h1>
          </div>
          <div className="meal-history-spacer" />
        </header>

        <section className="meal-history-controls">
          <div className="meal-history-range">
            <span className="material-symbols-outlined">calendar_today</span>
            <div>
              <small>Viewing Range</small>
              <strong>{rangeLabel}</strong>
            </div>
          </div>

          <div className="meal-history-filters" aria-label="Meal type filter">
            {MEAL_TYPES.map((type) => (
              <button
                className={activeType === type.value ? 'active' : ''}
                key={type.value}
                onClick={() => setActiveType(type.value)}
                type="button"
              >
                {type.label}
              </button>
            ))}
          </div>

          <label className="meal-history-sort">
            <span>Sort By</span>
            <select onChange={(event) => setSortMode(event.target.value)} value={sortMode}>
              <option value="newest">Newest First</option>
              <option value="highest-protein">Highest Protein</option>
              <option value="lowest-calories">Lowest Calories</option>
            </select>
          </label>
        </section>

        <section className="meal-history-summary">
          <article>
            <span>Avg Calories</span>
            <strong>{formatWholeNumber(averageCalories)}</strong>
            <small>/ day</small>
          </article>
          <article>
            <span>Total Protein</span>
            <strong>{formatWholeNumber(allTotals.protein)}g</strong>
            <small>{formatWholeNumber(allTotals.carbs)}g carbs</small>
          </article>
          <article>
            <span>Total Fats</span>
            <strong>{formatWholeNumber(allTotals.fats)}g</strong>
            <small>{filteredMeals.length} meals logged</small>
          </article>
        </section>

        <section className="meal-history-log">
          {message && <p className="meal-history-message">{message}</p>}
          {!message && groupedDays.length === 0 && (
            <p className="meal-history-empty">No meals match this filter yet.</p>
          )}

          {groupedDays.map((day) => (
            <div className="meal-history-day" key={day.key}>
              <aside>
                <h2>{formatDayTitle(day.key)}</h2>
                <p>{formatDayDate(day.key)}</p>
                <div className="meal-day-total">
                  <strong>{formatWholeNumber(day.totals.calories)} kcal</strong>
                  <span>{formatWholeNumber(day.totals.protein)}g protein</span>
                  <span>{formatWholeNumber(day.totals.carbs)}g carbs</span>
                  <span>{formatWholeNumber(day.totals.fats)}g fats</span>
                </div>
              </aside>

              <div className="meal-history-items">
                {day.meals.map((meal) => {
                  const photoUrl = resolveMediaUrl(meal.photo_url);

                  return (
                    <article className="meal-history-entry" key={meal.id}>
                      {photoUrl ? (
                        <img alt={meal.description} src={photoUrl} />
                      ) : (
                        <div className="meal-history-placeholder">
                          <span className="material-symbols-outlined">restaurant</span>
                        </div>
                      )}
                      <div className="meal-history-entry-main">
                        <div className="meal-history-entry-top">
                          <span>{formatMealTime(meal.meal_date || meal.created_at)} - {formatMealType(meal.meal_type)}</span>
                          <strong>{formatWholeNumber(meal.calories)} kcal</strong>
                        </div>
                        <h3>{meal.description}</h3>
                        <div className="meal-history-macros">
                          <span className="protein">Protein {formatWholeNumber(numericValue(meal.protein_g))}g</span>
                          <span className="carbs">Carbs {formatWholeNumber(numericValue(meal.carbs_g))}g</span>
                          <span className="fats">Fats {formatWholeNumber(numericValue(meal.fats_g))}g</span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      </main>
      <Footer />
    </>
  );
}
