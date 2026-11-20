import { useState } from 'react';
import { NavBar } from '../components/NavBar';
import { Footer } from '../components/Footer';
import './SupportPage.css';

const faqItems = [
  {
    question: 'How do I reset a booking?',
    answer: 'Open the Classes tab in your dashboard and cancel the class you no longer want. The slot returns to the schedule immediately.',
  },
  {
    question: 'Can trainers see member messages?',
    answer: 'Yes. Trainers can read and reply from the Messages tab in the trainer dashboard or from Trainer Chat.',
  },
  {
    question: 'Where do meal and workout logs go?',
    answer: 'Meals update your dashboard nutrition totals. Workouts feed your recent activity, streak, and training history.',
  },
  {
    question: 'Who approves trainer applications?',
    answer: 'Admins or owners review uploaded certifications before an account becomes an approved trainer.',
  },
];

const socialLinks = [
  { label: 'Instagram', value: '@onegymhq' },
  { label: 'TikTok', value: '@onegym.training' },
  { label: 'Facebook', value: 'OneGym Malaysia' },
  { label: 'YouTube', value: 'OneGym Studio' },
];

const API_BASE_URL = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_BASE_URL || '/api');

function storedUser() {
  try { return JSON.parse(localStorage.getItem('onegymUser') || '{}'); } catch { return {}; }
}

export function SupportPage() {
  const user = storedUser();
  const [form, setForm] = useState({ name: user.username || '', email: user.email || '', subject: '', message: '' });
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);
  const [isSending, setIsSending] = useState(false);

  async function submitTicket(event) {
    event.preventDefault();
    setIsSending(true);
    setStatus('');
    setIsError(false);
    try {
      const response = await fetch(`${API_BASE_URL}/support-tickets/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'Unable to submit your request.');
      setStatus(`${data.detail} Reference #${data.ticket_id}.`);
      setForm((current) => ({ ...current, subject: '', message: '' }));
    } catch (error) {
      setIsError(true);
      setStatus(error.message);
    } finally {
      setIsSending(false);
    }
  }

  function updateForm(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  return (
    <>
      <NavBar />
      <main className="support-page">
        <section className="support-hero">
          <p className="support-kicker">Support</p>
          <h1>Need a spot?</h1>
          <p>Booking got weird, login acting moody, or your trainer chat went quiet? Start here and we will get you moving again.</p>
        </section>

        <section className="support-grid">
          <article className="support-panel support-ticket-panel">
            <p className="support-kicker">Send a request</p>
            <h2>How can we help?</h2>
            <form className="support-ticket-form" onSubmit={submitTicket}>
              <div>
                <label>Name<input name="name" onChange={updateForm} required value={form.name} /></label>
                <label>Email<input name="email" onChange={updateForm} required type="email" value={form.email} /></label>
              </div>
              <label>Subject<input name="subject" onChange={updateForm} required value={form.subject} /></label>
              <label>Message<textarea name="message" onChange={updateForm} required rows="5" value={form.message} /></label>
              <button disabled={isSending} type="submit">{isSending ? 'Sending…' : 'Submit request'}</button>
              {status ? <p className={`support-ticket-status ${isError ? 'error' : ''}`}>{status}</p> : null}
            </form>
          </article>

          <article className="support-panel support-contact-panel">
            <p className="support-kicker">Customer support</p>
            <h2>Talk to us</h2>
            <div className="support-contact-list">
              <a href="tel:+60123456789">
                <span className="material-symbols-outlined">call</span>
                <div>
                  <strong>+60 12 345 6789</strong>
                  <small>Member helpdesk</small>
                </div>
              </a>
              <a href="tel:+60199887766">
                <span className="material-symbols-outlined">support_agent</span>
                <div>
                  <strong>+60 19 988 7766</strong>
                  <small>Trainer support</small>
                </div>
              </a>
              <a href="mailto:support@onegym.com">
                <span className="material-symbols-outlined">mail</span>
                <div>
                  <strong>support@onegym.com</strong>
                  <small>Replies within one working day</small>
                </div>
              </a>
            </div>
          </article>

          <article className="support-panel support-hours-panel">
            <p className="support-kicker">Hours</p>
            <h2>Open lines</h2>
            <dl>
              <div><dt>Mon - Fri</dt><dd>8:00 AM - 10:00 PM</dd></div>
              <div><dt>Saturday</dt><dd>9:00 AM - 7:00 PM</dd></div>
              <div><dt>Sunday</dt><dd>10:00 AM - 5:00 PM</dd></div>
            </dl>
          </article>

          <article className="support-panel support-map-panel">
            <div>
              <p className="support-kicker">Location</p>
              <h2>OneGym HQ</h2>
              <p>Level 3, Jalan Ampang Studio Row, Kuala Lumpur, Malaysia</p>
              <a href="https://www.google.com/maps/search/Kuala+Lumpur+Malaysia" target="_blank" rel="noreferrer">
                Open in maps
              </a>
            </div>
            <div className="support-map-art" aria-hidden="true">
              <span className="material-symbols-outlined">location_on</span>
            </div>
          </article>

          <article className="support-panel support-social-panel">
            <p className="support-kicker">Socials</p>
            <h2>Find us outside the app</h2>
            <div className="support-social-list">
              {socialLinks.map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="support-faq">
          <div className="support-section-heading">
            <p className="support-kicker">FAQ</p>
            <h2>Fast answers</h2>
          </div>
          <div className="support-faq-list">
            {faqItems.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
