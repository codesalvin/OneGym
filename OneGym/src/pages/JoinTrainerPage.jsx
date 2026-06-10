import { useState } from 'react';
import { NavBar } from '../components/NavBar';
import { Footer } from '../components/Footer';
import './JoinTrainerPage.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const trainerStats = [
  { label: 'Active Clients', value: '24', detail: '+2 this month' },
  { label: 'Sessions This Week', value: '42', detail: '85% capacity' },
  { label: 'Avg Client Progress', value: '92%', detail: 'Across active plans' },
];

const programCards = [
  {
    icon: 'bolt',
    title: 'Metabolic Prime',
    text: 'Build high-intensity blocks and assign them to advanced clients.',
  },
  {
    icon: 'balance',
    title: 'Foundations 101',
    text: 'Guide newer members through movement basics and corrective work.',
  },
  {
    icon: 'fitness_center',
    title: 'Power & Load',
    text: 'Track progressive overload cycles for strength-focused athletes.',
  },
  {
    icon: 'self_improvement',
    title: 'Resilience Flow',
    text: 'Plan mobility and recovery sessions for off-day training.',
  },
];

const scheduleItems = [
  { time: '08:00', client: 'Elena Rodriguez', session: 'Functional Strength', status: 'Done' },
  { time: '10:30', client: 'Marcus Chen', session: 'Mobility Flow', status: 'Start' },
  { time: '13:00', client: 'Sophia Laurent', session: 'HIIT Circuit', status: 'Queued' },
  { time: '16:00', client: 'Julianne Thorne', session: 'Leg Day A', status: 'Queued' },
];

export function JoinTrainerPage() {
  const [applicationMessage, setApplicationMessage] = useState('');
  const [isApplicationError, setIsApplicationError] = useState(false);
  const [isSubmittingApplication, setIsSubmittingApplication] = useState(false);

  async function submitTrainerApplication(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const storedUser = localStorage.getItem('onegymUser');

    if (storedUser) {
      const user = JSON.parse(storedUser);
      if (user?.id) {
        formData.append('user_id', user.id);
      }
    }

    setIsSubmittingApplication(true);
    setApplicationMessage('');
    setIsApplicationError(false);

    try {
      const response = await fetch(`${API_BASE_URL}/trainer-applications/`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Unable to submit trainer application.');
      }

      form.reset();
      setApplicationMessage(data.detail || 'Trainer application submitted for review.');
    } catch (error) {
      setIsApplicationError(true);
      setApplicationMessage(error.message);
    } finally {
      setIsSubmittingApplication(false);
    }
  }

  return (
    <div className="trainer-join-page">
      <NavBar />

      <main>
        <section className="trainer-hero">
          <div className="trainer-hero-copy">
            <p className="trainer-eyebrow">Trainer Portal</p>
            <h1>Coach inside the OneGym ecosystem.</h1>
            <p>
              Apply to become an approved OneGym trainer, manage clients, schedule
              sessions, and build programs from one focused workspace.
            </p>
            <div className="trainer-hero-actions">
              <a className="trainer-primary-link" href="#trainer-application">
                Join as Trainer
                <span className="material-symbols-outlined">arrow_forward</span>
              </a>
              <a className="trainer-secondary-link" href="#portal-preview">View Portal</a>
            </div>
          </div>

          <div className="trainer-hero-card" aria-label="Trainer portal preview">
            <div className="trainer-portal-top">
              <div>
                <span>Welcome back</span>
                <strong>Marcus</strong>
              </div>
              <img
                alt="Trainer profile"
                src="https://images.unsplash.com/photo-1567013127542-490d757e51fc?auto=format&fit=crop&w=180&q=80"
              />
            </div>
            <div className="trainer-mini-stats">
              {trainerStats.map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.detail}</small>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="trainer-preview" id="portal-preview">
          <aside className="trainer-side-preview" aria-label="Trainer navigation preview">
            <h2>OneGym</h2>
            <p>Trainer Portal</p>
            <nav>
              <span className="active"><i className="material-symbols-outlined">dashboard</i>Overview</span>
              <span><i className="material-symbols-outlined">group</i>Clients</span>
              <span><i className="material-symbols-outlined">calendar_today</i>Schedule</span>
              <span><i className="material-symbols-outlined">fitness_center</i>Programs</span>
              <span><i className="material-symbols-outlined">chat_bubble</i>Messages</span>
            </nav>
          </aside>

          <div className="trainer-preview-content">
            <div className="trainer-section-heading">
              <p className="trainer-eyebrow">Portal Preview</p>
              <h2>Everything a trainer needs after approval.</h2>
            </div>

            <div className="trainer-dashboard-grid">
              <article className="trainer-client-spotlight">
                <img
                  alt="Client training"
                  src="https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1000&q=85"
                />
                <div>
                  <p>Featured Client</p>
                  <h3>Julianne Thorne</h3>
                </div>
                <footer>
                  <span><small>Goal</small><strong>Hypertrophy</strong></span>
                  <span><small>Streak</small><strong>14 Weeks</strong></span>
                  <span><small>Next</small><strong>Today, 4PM</strong></span>
                </footer>
              </article>

              <article className="trainer-schedule-card">
                <div className="trainer-card-title">
                  <h3>Today's Schedule</h3>
                  <span className="material-symbols-outlined">more_horiz</span>
                </div>
                <div className="trainer-schedule-list">
                  {scheduleItems.map((item) => (
                    <div className="trainer-schedule-item" key={`${item.time}-${item.client}`}>
                      <time>{item.time}</time>
                      <div>
                        <strong>{item.client}</strong>
                        <small>{item.session}</small>
                      </div>
                      <span className={item.status === 'Start' ? 'ready' : ''}>{item.status}</span>
                    </div>
                  ))}
                </div>
              </article>
            </div>

            <section className="trainer-programs">
              <div className="trainer-card-title">
                <div>
                  <p className="trainer-eyebrow">Program Management</p>
                  <h3>Active Programs</h3>
                </div>
              </div>
              <div className="trainer-program-grid">
                {programCards.map((program) => (
                  <article key={program.title}>
                    <span className="material-symbols-outlined">{program.icon}</span>
                    <h4>{program.title}</h4>
                    <p>{program.text}</p>
                    <small>Assign</small>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="trainer-application-section" id="trainer-application">
          <div className="trainer-application-copy">
            <p className="trainer-eyebrow">Apply for Approval</p>
            <h2>Tell us why you should coach here.</h2>
            <p>
              Trainer accounts should be approved before they can manage clients or
              sessions. This form is the first step in that approval workflow.
            </p>
            <div className="trainer-approval-steps">
              <span>1. Submit profile</span>
              <span>2. Owner reviews</span>
              <span>3. Trainer access unlocked</span>
            </div>
          </div>

          <form className="trainer-application-form" onSubmit={submitTrainerApplication}>
            <div className="trainer-form-row">
              <label>
                Full Name
                <input name="full_name" placeholder="Marcus Reid" required type="text" />
              </label>
              <label>
                Email
                <input name="email" placeholder="trainer@example.com" required type="email" />
              </label>
            </div>
            <div className="trainer-form-row">
              <label>
                Phone
                <input name="phone" placeholder="+60 12 345 6789" type="tel" />
              </label>
              <label>
                Years of Experience
                <input min="0" name="experience_years" placeholder="5" type="number" />
              </label>
            </div>
            <label>
              Specialties
              <input name="specialties" placeholder="Strength, HIIT, mobility" required type="text" />
            </label>
            <label>
              Certification Document
              <input
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp"
                name="certification_file"
                required
                type="file"
              />
            </label>
            <label>
              Short Bio
              <textarea name="bio" placeholder="Briefly describe your coaching style and who you help." rows="5"></textarea>
            </label>
            <button disabled={isSubmittingApplication} type="submit">
              {isSubmittingApplication ? 'Submitting...' : 'Submit Application'}
              <span className="material-symbols-outlined">send</span>
            </button>
            <p className={`trainer-form-note ${isApplicationError ? 'error' : applicationMessage ? 'success' : ''}`}>
              {applicationMessage || 'PDF, DOC, DOCX, JPG, PNG, or WEBP files are accepted up to 10MB.'}
            </p>
          </form>
        </section>
      </main>

      <Footer />
    </div>
  );
}
