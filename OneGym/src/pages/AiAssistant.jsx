import { useMemo, useState } from 'react';
import { NavBar } from '../components/NavBar';
import './AiAssistant.css';

const recentMeals = [
  {
    id: 'salmon',
    name: 'Grilled Salmon & Asparagus',
    time: '1:15 PM',
    macros: '42g Protein - 12g Fat - 8g Carbs',
  },
  {
    id: 'yogurt',
    name: 'Greek Yogurt with Berries',
    time: '10:30 AM',
    macros: '18g Protein - 2g Fat - 22g Carbs',
  },
  {
    id: 'coffee',
    name: 'Bulletproof Coffee',
    time: '7:45 AM',
    macros: '0g Protein - 14g Fat - 0g Carbs',
  },
];

const suggestedCards = [
  {
    title: 'Recommended Recipe',
    body: 'Miso-glazed cod',
    detail: 'Lean protein with minimal added fat.',
  },
  {
    title: 'Macro Estimate',
    body: '38g protein',
    detail: 'About 4g fat and 2g carbs.',
  },
];

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
  const [messages, setMessages] = useState([
    {
      id: 'intro',
      role: 'assistant',
      title: `Good afternoon, ${displayName}.`,
      body: "Based on your morning session and lunch, you're currently a little short on protein for your training goal today. How can I help with your evening nutrition plan?",
    },
    {
      id: 'sample-user',
      role: 'user',
      body: 'How can I increase my protein intake for dinner tonight while staying under my fat limit?',
      time: '2:45 PM',
    },
    {
      id: 'sample-ai',
      role: 'assistant',
      title: 'Strategic Nutritional Adjustment',
      body: 'To reach your remaining protein target while keeping fat controlled, choose a white fish, skinless chicken breast, egg whites, or tofu prepared with dry spices, lemon, herbs, or broth instead of oil-heavy sauces.',
      cards: suggestedCards,
      quote: 'Keep the protein source lean, then add volume with vegetables and a measured carb portion.',
    },
  ]);

  function sendMessage(event) {
    event.preventDefault();

    const text = input.trim();
    if (!text) {
      return;
    }

    const now = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date());

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: 'user',
        body: text,
        time: now,
      },
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        title: 'Assistant Recommendation',
        body: 'For today, I would keep the next meal simple: lean protein first, vegetables second, then adjust carbs based on your remaining calories. If you upload or describe the meal, I can help estimate the macros before you log it.',
        cards: [
          {
            title: 'Good Next Step',
            body: 'Chicken breast bowl',
            detail: 'High protein, easy to keep low fat.',
          },
          {
            title: 'Log Tip',
            body: 'Use meal photo scan',
            detail: 'Upload a plate photo from the dashboard quick log.',
          },
        ],
      },
    ]);
    setInput('');
  }

  return (
    <>
      <NavBar />
      <main className="ai-page">
        <aside className="ai-stats-panel">
          <section>
            <p className="ai-kicker">Vital Stats</p>
            <div className="ai-calorie-ring" aria-label="Calories consumed 1850 of 2500">
              <svg viewBox="0 0 200 200" role="img">
                <circle className="ai-ring-track" cx="100" cy="100" r="86" />
                <circle className="ai-ring-fill" cx="100" cy="100" r="86" />
              </svg>
              <div className="ai-ring-copy">
                <strong>1,850</strong>
                <span>of 2,500 kcal</span>
              </div>
            </div>

            <div className="ai-macro-list">
              <div className="ai-macro-row">
                <div><span>Protein</span><strong>145g / 180g</strong></div>
                <div className="ai-macro-bar"><span style={{ width: '80%' }} /></div>
              </div>
              <div className="ai-macro-row amber">
                <div><span>Carbs</span><strong>210g / 250g</strong></div>
                <div className="ai-macro-bar"><span style={{ width: '84%' }} /></div>
              </div>
              <div className="ai-macro-row clay">
                <div><span>Fats</span><strong>52g / 65g</strong></div>
                <div className="ai-macro-bar"><span style={{ width: '75%' }} /></div>
              </div>
            </div>
          </section>

          <section className="ai-recent-meals">
            <p className="ai-kicker">Recent Meals</p>
            {recentMeals.map((meal) => (
              <article className="ai-meal-card" key={meal.id}>
                <div>
                  <h3>{meal.name}</h3>
                  <p>{meal.macros}</p>
                </div>
                <time>{meal.time}</time>
              </article>
            ))}
          </section>
        </aside>

        <section className="ai-chat-panel">
          <div className="ai-chat-scroll">
            {messages.map((message) => (
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
                        <div className="ai-response-card" key={card.title}>
                          <span>{card.title}</span>
                          <strong>{card.body}</strong>
                          <p>{card.detail}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {message.quote && <em>{message.quote}</em>}
                </div>

                {message.role === 'user' && <time>You - {message.time}</time>}
              </article>
            ))}
          </div>

          <form className="ai-input-bar" onSubmit={sendMessage}>
            <button aria-label="Scan meal" type="button">
              <span className="material-symbols-outlined">photo_camera</span>
              <span>Scan Meal</span>
            </button>
            <input
              aria-label="Ask your wellness assistant"
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask your wellness assistant..."
              type="text"
              value={input}
            />
            <button aria-label="Send message" className="ai-send" type="submit">
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
    </>
  );
}
