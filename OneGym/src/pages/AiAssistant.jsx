import { useEffect, useMemo, useState } from 'react';
import { NavBar } from '../components/NavBar';
import './AiAssistant.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
const CALORIE_GOAL = 2500;
const PROTEIN_GOAL = 180;
const CARBS_GOAL = 300;
const FATS_GOAL = 65;
const RING_CIRCUMFERENCE = 540;
const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snacks', label: 'Snacks' },
];

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

function numericValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clampPercent(value) {
  return Math.min(100, Math.max(0, value));
}

function formatWholeNumber(value) {
  return Math.round(value).toLocaleString('en-US');
}

function normalizeMealType(value) {
  const normalized = String(value || '').toLowerCase();
  return MEAL_TYPES.some((type) => type.value === normalized) ? normalized : 'dinner';
}

function formatMealType(value) {
  return MEAL_TYPES.find((type) => type.value === normalizeMealType(value))?.label || 'Dinner';
}

function buildIntroMessage(displayName, totals, mealCount) {
  const remainingCalories = Math.max(0, CALORIE_GOAL - totals.calories);
  const remainingProtein = Math.max(0, PROTEIN_GOAL - totals.protein);

  if (mealCount === 0) {
    return `Good afternoon, ${displayName}. No meals are logged yet today. Once you add a meal, I can tailor suggestions around your calories, protein, carbs, and fats.`;
  }

  if (remainingProtein > 0) {
    return `Good afternoon, ${displayName}. You have logged ${formatWholeNumber(totals.calories)} kcal today with ${formatWholeNumber(totals.protein)}g protein. You still have about ${formatWholeNumber(remainingCalories)} kcal and ${formatWholeNumber(remainingProtein)}g protein available, so your next meal can help close that gap.`;
  }

  return `Good afternoon, ${displayName}. You have logged ${formatWholeNumber(totals.calories)} kcal today and already reached your protein target. You still have about ${formatWholeNumber(remainingCalories)} kcal available, so I can help keep the rest of your meals balanced.`;
}

function formatMealTime(value) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
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

function isMacroCard(card) {
  return Array.isArray(card?.macros) && card.macros.length > 0;
}

function getMacroValue(cards, label) {
  const macroCard = cards.find((card) => isMacroCard(card));
  const macro = macroCard?.macros?.find((item) => item.label === label);
  return numericValue(String(macro?.value || '').replace(/[^\d.]/g, ''));
}

function buildMealFromRecommendation(message) {
  const cards = Array.isArray(message.cards) ? message.cards : [];
  const recipeCard = cards.find((card) => !isMacroCard(card));
  const protein = getMacroValue(cards, 'PRO');
  const fats = getMacroValue(cards, 'FAT');
  const carbs = getMacroValue(cards, 'CHO');
  const calories = Math.round(protein * 4 + carbs * 4 + fats * 9);

  return {
    mealType: 'dinner',
    description: recipeCard?.title || 'AI recommended meal',
    calories,
    protein,
    carbs,
    fats,
  };
}

function getRecommendationDescription(message) {
  return buildMealFromRecommendation(message).description;
}

export function AiAssistantPage() {
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('onegymUser') || '{}');
    } catch {
      return {};
    }
  }, []);
  const displayName = user?.username || user?.email?.split('@')[0] || 'Member';
  const [input, setInput] = useState('');
  const [loggedMeals, setLoggedMeals] = useState([]);
  const [mealMessage, setMealMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [pendingMeal, setPendingMeal] = useState(null);
  const [pendingDeleteMeal, setPendingDeleteMeal] = useState(null);
  const [editingMeal, setEditingMeal] = useState(null);
  const [notice, setNotice] = useState(null);
  const [isAddingMeal, setIsAddingMeal] = useState(false);
  const [isDeletingMeal, setIsDeletingMeal] = useState(false);
  const [isSavingMealEdit, setIsSavingMealEdit] = useState(false);
  const [messages, setMessages] = useState([]);

  async function loadMeals() {
    if (!user?.id) {
      setLoggedMeals([]);
      setMealMessage('Sign in to load today\'s meals.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/users/${user.id}/meals/`);
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data.detail || 'Unable to load today\'s meals.');
      }

      setLoggedMeals(Array.isArray(data) ? data : []);
      setMealMessage('');
    } catch (error) {
      setLoggedMeals([]);
      setMealMessage(error.message);
    }
  }

  useEffect(() => {
    loadMeals();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setMessages([]);
      return;
    }

    fetch(`${API_BASE_URL}/users/${user.id}/ai-messages/`)
      .then(async (response) => {
        const data = await readApiResponse(response);
        if (!response.ok) {
          throw new Error(data.detail || 'Unable to load AI messages.');
        }

        return data;
      })
      .then((data) => {
        const savedMessages = Array.isArray(data) ? data.map((message) => ({
          id: message.id,
          role: message.role,
          title: message.title || undefined,
          body: message.body,
          cards: Array.isArray(message.cards) ? message.cards : [],
          quote: message.note || '',
          time: message.role === 'user' ? formatMealTime(message.created_at) : undefined,
        })) : [];
        setMessages(savedMessages);
      })
      .catch(() => {
        setMessages([]);
      });
  }, [user?.id]);

  const nutritionTotals = useMemo(() => {
    const consumed = loggedMeals.reduce(
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

    const caloriePercent = clampPercent((consumed.calories / CALORIE_GOAL) * 100);

    return {
      ...consumed,
      caloriePercent,
      ringOffset: RING_CIRCUMFERENCE * (1 - caloriePercent / 100),
      proteinPercent: clampPercent((consumed.protein / PROTEIN_GOAL) * 100),
      carbsPercent: clampPercent((consumed.carbs / CARBS_GOAL) * 100),
      fatsPercent: clampPercent((consumed.fats / FATS_GOAL) * 100),
    };
  }, [loggedMeals]);

  const recentMeals = useMemo(() => {
    return loggedMeals.slice(0, 5).map((meal) => ({
      id: meal.id,
      name: meal.description,
      time: formatMealTime(meal.meal_date || meal.created_at),
      macros: `${formatWholeNumber(numericValue(meal.protein_g))}g Protein - ${formatWholeNumber(numericValue(meal.fats_g))}g Fat - ${formatWholeNumber(numericValue(meal.carbs_g))}g Carbs`,
      photoUrl: resolveMediaUrl(meal.photo_url),
      calories: numericValue(meal.calories),
      protein: numericValue(meal.protein_g),
      carbs: numericValue(meal.carbs_g),
      fats: numericValue(meal.fats_g),
      mealType: meal.meal_type,
    }));
  }, [loggedMeals]);

  function isRecommendationAdded(message) {
    const description = getRecommendationDescription(message);
    return loggedMeals.some((meal) => meal.description === description);
  }

  const introMessage = useMemo(() => {
    return {
      id: 'intro',
      role: 'assistant',
      title: `Good afternoon, ${displayName}.`,
      body: buildIntroMessage(displayName, nutritionTotals, loggedMeals.length),
    };
  }, [displayName, loggedMeals.length, nutritionTotals]);
  const visibleMessages = [introMessage, ...messages];

  async function sendMessage(event) {
    event.preventDefault();

    const text = input.trim();
    if (!text || isSending) {
      return;
    }

    const now = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date());

    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      body: text,
      time: now,
    };

    setMessages((current) => [
      ...current,
      userMessage,
    ]);
    setInput('');
    setIsSending(true);

    try {
      if (!user?.id) {
        throw new Error('Please sign in before using the AI Assistant.');
      }

      const endpoint = `${API_BASE_URL}/ai-assistant/chat/`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          message: text,
        }),
      });
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data.detail || 'AI Assistant is unavailable.');
      }

      setMessages((current) => [
        ...current,
        {
          id: data.id || crypto.randomUUID(),
          role: 'assistant',
          title: 'Assistant Recommendation',
          body: data.reply,
          cards: Array.isArray(data.cards) ? data.cards : [],
          quote: data.note || '',
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          title: 'Assistant Unavailable',
          body: error.message,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function askToAddRecommendation(message) {
    if (isRecommendationAdded(message)) {
      return;
    }

    if (!user?.id) {
      setNotice({
        title: 'Sign in required',
        body: 'Please sign in before adding AI recommendations to your meals.',
      });
      return;
    }

    setPendingMeal(buildMealFromRecommendation(message));
  }

  function startMealEdit(meal) {
    setEditingMeal({
      id: meal.id,
      description: meal.name,
      mealType: normalizeMealType(meal.mealType),
      calories: String(meal.calories),
      protein: String(meal.protein),
      carbs: String(meal.carbs),
      fats: String(meal.fats),
    });
  }

  function updateMealEditField(event) {
    const { name, value } = event.target;
    setEditingMeal((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function updatePendingMealType(event) {
    setPendingMeal((current) => ({
      ...current,
      mealType: event.target.value,
    }));
  }

  async function confirmAddRecommendation() {
    if (!pendingMeal || !user?.id) {
      return;
    }

    setIsAddingMeal(true);

    try {
      const endpoint = `${API_BASE_URL}/meals/`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          meal_type: pendingMeal.mealType,
          description: pendingMeal.description,
          calories: pendingMeal.calories,
          protein_g: pendingMeal.protein,
          carbs_g: pendingMeal.carbs,
          fats_g: pendingMeal.fats,
        }),
      });
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data.detail || 'Unable to add recommendation to meals.');
      }

      await loadMeals();
      setPendingMeal(null);
      setNotice({
        title: 'Meal added',
        body: `${pendingMeal.description} was added to today's meals.`,
      });
    } catch (error) {
      setPendingMeal(null);
      setNotice({
        title: 'Could not add meal',
        body: error.message,
      });
    } finally {
      setIsAddingMeal(false);
    }
  }

  async function saveMealEdit(event) {
    event.preventDefault();

    if (!editingMeal || !user?.id) {
      return;
    }

    if (!editingMeal.description.trim()) {
      setNotice({
        title: 'Meal name required',
        body: 'This meal needs a description before it can be updated.',
      });
      return;
    }

    setIsSavingMealEdit(true);

    try {
      const endpoint = `${API_BASE_URL}/meals/update/`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data.detail || 'Unable to update meal.');
      }

      await loadMeals();
      setEditingMeal(null);
      setNotice({
        title: 'Meal updated',
        body: data.detail || 'Meal nutrition was updated.',
      });
    } catch (error) {
      setEditingMeal(null);
      setNotice({
        title: 'Could not update meal',
        body: error.message,
      });
    } finally {
      setIsSavingMealEdit(false);
    }
  }

  async function confirmDeleteMeal() {
    if (!pendingDeleteMeal || !user?.id) {
      return;
    }

    setIsDeletingMeal(true);

    try {
      const endpoint = `${API_BASE_URL}/meals/delete/`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          meal_id: pendingDeleteMeal.id,
        }),
      });
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data.detail || 'Unable to delete meal.');
      }

      await loadMeals();
      setPendingDeleteMeal(null);
      setNotice({
        title: 'Meal deleted',
        body: data.detail || 'Meal removed from today.',
      });
    } catch (error) {
      setPendingDeleteMeal(null);
      setNotice({
        title: 'Could not delete meal',
        body: error.message,
      });
    } finally {
      setIsDeletingMeal(false);
    }
  }

  return (
    <>
      <NavBar />
      <main className="ai-page">
        <aside className="ai-stats-panel">
          <section>
            <p className="ai-kicker">Vital Stats</p>
            <div className="ai-calorie-ring" aria-label={`Calories consumed ${formatWholeNumber(nutritionTotals.calories)} of ${formatWholeNumber(CALORIE_GOAL)}`}>
              <svg viewBox="0 0 200 200" role="img">
                <circle className="ai-ring-track" cx="100" cy="100" r="86" />
                <circle className="ai-ring-fill" cx="100" cy="100" r="86" style={{ strokeDashoffset: nutritionTotals.ringOffset }} />
              </svg>
              <div className="ai-ring-copy">
                <strong>{formatWholeNumber(nutritionTotals.calories)}</strong>
                <span>of {formatWholeNumber(CALORIE_GOAL)} kcal</span>
              </div>
            </div>

            <div className="ai-macro-list">
              <div className="ai-macro-row">
                <div><span>Protein</span><strong>{formatWholeNumber(nutritionTotals.protein)}g / {PROTEIN_GOAL}g</strong></div>
                <div className="ai-macro-bar"><span style={{ width: `${nutritionTotals.proteinPercent}%` }} /></div>
              </div>
              <div className="ai-macro-row amber">
                <div><span>Carbs</span><strong>{formatWholeNumber(nutritionTotals.carbs)}g / {CARBS_GOAL}g</strong></div>
                <div className="ai-macro-bar"><span style={{ width: `${nutritionTotals.carbsPercent}%` }} /></div>
              </div>
              <div className="ai-macro-row clay">
                <div><span>Fats</span><strong>{formatWholeNumber(nutritionTotals.fats)}g / {FATS_GOAL}g</strong></div>
                <div className="ai-macro-bar"><span style={{ width: `${nutritionTotals.fatsPercent}%` }} /></div>
              </div>
            </div>
          </section>

          <section className="ai-recent-meals">
            <p className="ai-kicker">Recent Meals</p>
            {mealMessage && <p className="ai-meal-empty">{mealMessage}</p>}
            {!mealMessage && recentMeals.length === 0 && <p className="ai-meal-empty">No meals logged today.</p>}
            {recentMeals.map((meal) => (
              <article className="ai-meal-card" key={meal.id}>
                <div className="ai-meal-card-main">
                  {meal.photoUrl ? (
                    <img alt={meal.name} className="ai-meal-thumb" src={meal.photoUrl} />
                  ) : (
                    <div className="ai-meal-placeholder">
                      <span className="material-symbols-outlined">restaurant</span>
                    </div>
                  )}
                  <div>
                    <h3>{meal.name}</h3>
                    <span className="ai-meal-type">{formatMealType(meal.mealType)}</span>
                    <p>{meal.macros}</p>
                  </div>
                </div>
                <div className="ai-meal-card-side">
                  <time>{meal.time}</time>
                  <div className="ai-meal-actions">
                    <button aria-label={`Edit ${meal.name}`} onClick={() => startMealEdit(meal)} type="button">
                      <span className="material-symbols-outlined">edit</span>
                    </button>
                    <button aria-label={`Delete ${meal.name}`} className="danger" onClick={() => setPendingDeleteMeal(meal)} type="button">
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        </aside>

        <section className="ai-chat-panel">
          <div className="ai-chat-scroll">
            {visibleMessages.map((message) => (
              <article className={`ai-message ${message.role}`} key={message.id}>
                {message.role === 'assistant' && (
                  <div className="ai-message-label">
                    <span className="material-symbols-outlined">smart_toy</span>
                    <strong>OneGym AI Assistant</strong>
                  </div>
                )}

                <div className="ai-bubble">
                  {message.title && <h1>{message.title}</h1>}
                  <p>{message.body}</p>

                  {message.cards && (
                    <div className="ai-response-grid">
                      {message.cards.map((card) => (
                        <div className="ai-response-card" key={card.title || card.label}>
                          <span>{card.label || card.title}</span>
                          {isMacroCard(card) ? (
                            <div className="ai-macro-estimate">
                              {card.macros.map((macro) => (
                                <div key={`${macro.label}-${macro.value}`}>
                                  <strong>{macro.value}</strong>
                                  <small>{macro.label}</small>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <>
                              <strong>{card.title || card.body}</strong>
                              <p>{card.detail}</p>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {message.quote && <em>{message.quote}</em>}
                  {message.role === 'assistant' && message.cards?.length > 0 && (
                    <div className="ai-card-actions">
                      <button
                        className={isRecommendationAdded(message) ? 'added' : ''}
                        disabled={isRecommendationAdded(message)}
                        onClick={() => askToAddRecommendation(message)}
                        type="button"
                      >
                        {isRecommendationAdded(message) ? 'Added' : 'Add to meals'}
                      </button>
                    </div>
                  )}
                </div>
                {message.role === 'user' && <time>{message.time}</time>}
              </article>
            ))}
          </div>

          <form className="ai-input-bar" onSubmit={sendMessage}>
            <input
              aria-label="Ask your wellness assistant"
              disabled={isSending}
              onChange={(event) => setInput(event.target.value)}
              placeholder={isSending ? 'Thinking...' : 'Ask your wellness assistant...'}
              type="text"
              value={input}
            />
            <button aria-label="Send message" className="ai-send" disabled={isSending} type="submit">
              <span className="material-symbols-outlined">arrow_upward</span>
            </button>
          </form>
        </section>

        <aside className="ai-insight-panel">
          <p className="ai-kicker">Nutrition Insight</p>
          <div className="ai-insight-image">
            <img
              alt="Lean fish and herbs prepared for a high protein meal"
              src="https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=700&q=80"
            />
          </div>
          <p>
            Tip: white fish is an excellent lean protein source for evening recovery without pushing fat intake too high.
          </p>
        </aside>
      </main>
      <footer className="ai-footer">
        <span>© 2024 OneGym. Encrypted AI session.</span>
        <div>
          <a href="/member-dashboard">Journal</a>
          <a href="/member-dashboard">Data Privacy</a>
        </div>
      </footer>

      {(pendingMeal || pendingDeleteMeal || editingMeal || notice) && (
        <div className="ai-modal-backdrop" role="presentation">
          <div className="ai-modal" role="dialog" aria-modal="true">
            <p className="ai-modal-eyebrow">
              {editingMeal ? 'Edit Meal' : pendingMeal || pendingDeleteMeal ? 'Confirmation' : 'Status'}
            </p>
            <h2>
              {editingMeal && 'Edit nutrition'}
              {pendingMeal && 'Add to meals?'}
              {pendingDeleteMeal && 'Delete meal?'}
              {notice && !pendingMeal && !pendingDeleteMeal && !editingMeal && notice.title}
            </h2>
            {editingMeal ? (
              <form className="ai-edit-form" onSubmit={saveMealEdit}>
                <p>
                  Adjust the nutrition values for <strong>{editingMeal.description}</strong>.
                </p>
                <div className="ai-edit-grid">
                  <label>
                    Meal Type
                    <select name="mealType" onChange={updateMealEditField} value={editingMeal.mealType}>
                      {MEAL_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Calories
                    <input min="0" name="calories" onChange={updateMealEditField} required type="number" value={editingMeal.calories} />
                  </label>
                  <label>
                    Protein (g)
                    <input min="0" name="protein" onChange={updateMealEditField} required type="number" value={editingMeal.protein} />
                  </label>
                  <label>
                    Carbs (g)
                    <input min="0" name="carbs" onChange={updateMealEditField} required type="number" value={editingMeal.carbs} />
                  </label>
                  <label>
                    Fats (g)
                    <input min="0" name="fats" onChange={updateMealEditField} required type="number" value={editingMeal.fats} />
                  </label>
                </div>
                <div className="ai-modal-actions">
                  <button className="ghost" disabled={isSavingMealEdit} onClick={() => setEditingMeal(null)} type="button">
                    Back
                  </button>
                  <button disabled={isSavingMealEdit} type="submit">
                    {isSavingMealEdit ? 'Saving' : 'Save Meal'}
                  </button>
                </div>
              </form>
            ) : pendingMeal ? (
              <>
                <p>
                  Add <strong>{pendingMeal.description}</strong> as {formatWholeNumber(pendingMeal.calories)} kcal,
                  {' '}{formatWholeNumber(pendingMeal.protein)}g protein,
                  {' '}{formatWholeNumber(pendingMeal.carbs)}g carbs, and {formatWholeNumber(pendingMeal.fats)}g fats?
                </p>
                <label className="ai-modal-select-label">
                  Meal Type
                  <select onChange={updatePendingMealType} value={pendingMeal.mealType}>
                    {MEAL_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </label>
              </>
            ) : pendingDeleteMeal ? (
              <p>
                Delete <strong>{pendingDeleteMeal.name}</strong> from today's meals? This will also update your calories and macros.
              </p>
            ) : (
              <p>{notice.body}</p>
            )}
            {!editingMeal && (
              <div className="ai-modal-actions">
                {pendingMeal ? (
                  <>
                    <button className="ghost" disabled={isAddingMeal} onClick={() => setPendingMeal(null)} type="button">
                      Back
                    </button>
                    <button disabled={isAddingMeal} onClick={confirmAddRecommendation} type="button">
                      {isAddingMeal ? 'Adding' : 'Add Meal'}
                    </button>
                  </>
                ) : pendingDeleteMeal ? (
                  <>
                    <button className="ghost" disabled={isDeletingMeal} onClick={() => setPendingDeleteMeal(null)} type="button">
                      Back
                    </button>
                    <button className="danger" disabled={isDeletingMeal} onClick={confirmDeleteMeal} type="button">
                      {isDeletingMeal ? 'Deleting' : 'Delete Meal'}
                    </button>
                  </>
                ) : (
                  <button onClick={() => setNotice(null)} type="button">
                    Done
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
