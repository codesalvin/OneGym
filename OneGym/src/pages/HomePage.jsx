import { NavBar } from '../components/NavBar';
import { Footer } from '../components/Footer';
import './HomePage.css';
import adidasLogo from '../../images/adidas.png';
import gymsharkLogo from '../../images/gymshark.png';
import hammerStrengthLogo from '../../images/hammer-strength.png';
import lululemonLogo from '../../images/lululemon.png';
import monsterEnergyLogo from '../../images/monster-energy.png';
import nutriliteLogo from '../../images/nutrilite.png';
import technogymLogo from '../../images/technogym.png';

const partnerBrands = [
  { name: 'Adidas', image: adidasLogo },
  { name: 'Gymshark', image: gymsharkLogo },
  { name: 'Hammer Strength', image: hammerStrengthLogo },
  { name: 'Lululemon', image: lululemonLogo },
  { name: 'Monster Energy', image: monsterEnergyLogo },
  { name: 'Nutrilite', image: nutriliteLogo },
  { name: 'Technogym', image: technogymLogo },
];

export function HomePage() {
  return (
    <div className="home-page">
      <NavBar />
      
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-dumbbell-photo" aria-hidden="true"></div>
          <div className="hero-text">
            <h1>Train smarter with a gym that <span>knows you</span></h1>
            <p>OneGym gives members one place to book classes, track meals, log workouts, chat with trainers, and see real progress.</p>
            <div className="hero-ctas">
              <a className="btn btn-primary" href="/signin">Start Training</a>
              <a className="btn btn-outline" href="/pricing">View Plans</a>
            </div>
          </div>
        </div>
      </section>

      {/* Social Visual Strip */}
      <div className="social-strip">
        <div className="strip-inner" aria-label="Partner brands">
          <div className="brand-track">
            {[0, 1].map((groupIndex) => (
              <div className="brand-group" key={groupIndex} aria-hidden={groupIndex === 1}>
                {partnerBrands.map((brand) => (
                  <div className={`brand-logo-item ${brand.name === 'Gymshark' ? 'brand-gymshark' : ''}`} key={`${brand.name}-${groupIndex}`}>
                    <img src={brand.image} alt={groupIndex === 0 ? brand.name : ''} />
                    {brand.name === 'Gymshark' && <span>Gymshark</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Difference Editorial Section */}
      <section className="difference-editorial" id="features">
        <div className="difference-layout">
          <div className="difference-lead">
            <h2>Built around the member experience</h2>
            <p>Members should not need five apps to understand their training. OneGym connects bookings, nutrition, workouts, trainer chat, and progress into one calm dashboard.</p>
            <div className="difference-actions">
              <a className="btn btn-primary" href="/signin">Open Member Dashboard</a>
              <a className="difference-link" href="/pricing">See gym plans</a>
            </div>
            <img
              alt="Gym member training with coach in a modern studio"
              src="https://images.unsplash.com/photo-1571019613914-85f342c6a11e?auto=format&fit=crop&w=1300&q=85"
            />
          </div>

          <aside className="difference-story">
            <img
              alt="Personal trainer coaching a strength session"
              src="https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=900&q=85"
            />
            <div>
              <h3>Gyms adopt it. Members feel it.</h3>
              <p>Owners get the system, but the daily value lands with members: fewer missed classes, clearer goals, and trainers who can actually see their progress.</p>
              <a href="/member-dashboard">Explore member dashboard</a>
            </div>
          </aside>
        </div>
      </section>

      {/* Onboarding Bento Grid Section */}
      <section className="steps">
        <div className="container">
          <div className="bento-heading">
            <p className="label">Member-first system</p>
            <h2>Everything a member needs, connected for the gym</h2>
          </div>

          <div className="bento-grid">
            <article className="bento-card bento-large bento-setup">
              <div>
                <p className="step-num">01&nbsp;&nbsp;Set up</p>
                <h2>Give members a real home base</h2>
                <p>Every member gets a dashboard for their classes, goals, meals, workouts, and trainer conversations.</p>
              </div>
              <div className="bento-profile-panel">
                <div className="bento-profile-row">
                  <span>Progress</span>
                  <strong>Live</strong>
                </div>
                <div className="bento-profile-row">
                  <span>Meals</span>
                  <strong>Tracked</strong>
                </div>
                <div className="bento-profile-row">
                  <span>Classes</span>
                  <strong>Booked</strong>
                </div>
              </div>
            </article>

            <article className="bento-card bento-wide bento-schedule">
              <div>
                <p className="step-num">02&nbsp;&nbsp;Scheduling</p>
                <h2>Classes members can trust</h2>
                <p>Members see upcoming sessions, available slots, trainer names, and booking status without chasing the front desk.</p>
              </div>
              <div className="bento-calendar">
                <span>Mon</span>
                <strong>17:30</strong>
                <em>HIIT Studio A</em>
              </div>
            </article>

            <article className="bento-card bento-members">
              <div>
                <p className="step-num">03&nbsp;&nbsp;Members</p>
                <h2>Keep people coming back</h2>
                <p>Training history, streaks, and personal records make progress visible enough to feel worth continuing.</p>
              </div>
              <div className="bento-avatar-stack">
                <img alt="OneGym member" src="https://images.unsplash.com/photo-1531891437562-4301cf35b7e4?auto=format&fit=crop&w=160&q=80" />
                <img alt="OneGym member" src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=160&q=80" />
                <img alt="OneGym member" src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80" />
                <img alt="OneGym member" src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=160&q=80" />
              </div>
            </article>

            <article className="bento-card bento-report">
              <p className="step-num">04&nbsp;&nbsp;Reporting</p>
              <h2>Progress that is easy to read</h2>
              <p>Members see workout frequency, calories, weight changes, and records in charts that make sense.</p>
              <div className="bento-bars"><i></i><i></i><i></i><i></i></div>
            </article>

            <article className="bento-card bento-payments">
              <p className="step-num">05&nbsp;&nbsp;Gym system</p>
              <h2>Still works for owners</h2>
              <p>Behind the member experience, gyms can manage plans, classes, trainers, and activity from one system.</p>
              <div className="bento-billing-list">
                <span><strong>Pro Members</strong><em>Active</em></span>
                <span><strong>Studio Plan</strong><em>Available</em></span>
                <span><strong>Trainers</strong><em>Approved</em></span>
              </div>
            </article>

            <article className="bento-card bento-ai">
              <p className="step-num">06&nbsp;&nbsp;AI Assist</p>
              <h2>Guidance between sessions</h2>
              <p>Members can ask for meal ideas and training support based on the goals and logs already inside OneGym.</p>
              <a className="bento-start-button" href="/signin">
                Start
                <span className="material-symbols-outlined">arrow_forward</span>
              </a>
            </article>
          </div>

        </div>
      </section>

      {/* Social Proof Testimonial Block */}
      <div className="testimonial">
        <div className="testimonial-badge">
          <svg viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M4 7h6M4 4.5h6M4 9.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          OneGym
        </div>
        <blockquote>OneGym made progress feel visible. I know what I trained, what I ate, and what to book next.</blockquote>
        <div className="testimonial-avatar">MR</div>
        <cite>Alyssa Chen</cite>
        <p className="role">OneGym member</p>
      </div>

      {/* Final Call To Action Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-text">
            <h2>Make your gym feel<br />more personal</h2>
            <p>For members, OneGym is progress in one place. For gyms, it is the system that keeps that experience running.</p>
            <div className="cta-btns">
              <a className="btn btn-primary" href="/signin">Start as Member</a>
              <a className="btn btn-outline" href="/pricing">View Pricing</a>
              <a className="btn btn-outline" href="/join-trainer">Trainer Portal</a>
            </div>
          </div>
        </div>
        <div className="cta-image-wrapper">
          <div className="cta-image"></div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
