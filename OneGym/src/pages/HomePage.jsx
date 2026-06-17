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
            <h1>Manage your gym like a <span>champion</span></h1>
            <p>Your gym runs itself while you build something bigger. OneGym takes the daily grind and turns it into simple numbers on a screen.</p>
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
            <h2>What makes OneGym different</h2>
            <p>OneGym keeps bookings, trainers, workouts, meals, and member progress in one live operating view.</p>
            <div className="difference-actions">
              <a className="btn btn-primary" href="/signin">Start Managing</a>
              <a className="difference-link" href="/join-trainer">Join as Trainer</a>
            </div>
            <img
              alt="Gym members training with coach in a modern studio"
              src="https://images.unsplash.com/photo-1571019613914-85f342c6a11e?auto=format&fit=crop&w=1300&q=85"
            />
          </div>

          <aside className="difference-story">
            <img
              alt="Personal trainer coaching a strength session"
              src="https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=900&q=85"
            />
            <div>
              <h3>Live class flow, not admin noise</h3>
              <p>Trainers create sessions, members reserve instantly, and every dashboard updates from the same source of truth.</p>
              <a href="/member-dashboard">Explore member dashboard</a>
            </div>
          </aside>
        </div>
      </section>

      {/* Onboarding Bento Grid Section */}
      <section className="steps">
        <div className="container">
          <div className="bento-heading">
            <p className="label">Workflow</p>
            <h2>Run the whole gym from one calm command center</h2>
          </div>

          <div className="bento-grid">
            <article className="bento-card bento-large bento-setup">
              <div>
                <p className="step-num">01&nbsp;&nbsp;Set up</p>
                <h2>Create your gym profile</h2>
                <p>Add your gym details, membership rates, room capacity, and class rules in minutes.</p>
              </div>
              <div className="bento-profile-panel">
                <div className="bento-profile-row">
                  <span>Rooms</span>
                  <strong>4 studios</strong>
                </div>
                <div className="bento-profile-row">
                  <span>Plans</span>
                  <strong>3 tiers</strong>
                </div>
                <div className="bento-profile-row">
                  <span>Capacity</span>
                  <strong>86%</strong>
                </div>
              </div>
            </article>

            <article className="bento-card bento-wide bento-schedule">
              <div>
                <p className="step-num">02&nbsp;&nbsp;Scheduling</p>
                <h2>Classes that book themselves</h2>
                <p>Publish sessions, track remaining slots, and let members reserve without front desk friction.</p>
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
                <h2>Bring members online</h2>
                <p>Give every member a dashboard for bookings, nutrition, and training history.</p>
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
              <h2>Know what changed</h2>
              <p>Watch workouts, attendance, and member activity move in real time.</p>
              <div className="bento-bars"><i></i><i></i><i></i><i></i></div>
            </article>

            <article className="bento-card bento-payments">
              <p className="step-num">05&nbsp;&nbsp;Payments</p>
              <h2>Less admin, cleaner billing</h2>
              <p>Keep renewals, plans, and membership status in one place.</p>
              <div className="bento-billing-list">
                <span><strong>Premium Plan</strong><em>Renews Jun 28</em></span>
                <span><strong>Family Add-on</strong><em>2 members</em></span>
                <span><strong>Status</strong><em>Clear</em></span>
              </div>
            </article>

            <article className="bento-card bento-ai">
              <p className="step-num">06&nbsp;&nbsp;AI Assist</p>
              <h2>Smarter meal guidance</h2>
              <p>Members get nutrition recommendations based on their logged progress.</p>
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
        <blockquote>OneGym cut our admin time in half and our members love the booking system.</blockquote>
        <div className="testimonial-avatar">MR</div>
        <cite>Marcus Reid</cite>
        <p className="role">Owner, CrossFit gym</p>
      </div>

      {/* Final Call To Action Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-text">
            <h2>Stop managing,<br />start growing</h2>
            <p>Join gym owners who have taken control of their business with OneGym today.</p>
            <div className="cta-btns">
              <a className="btn btn-primary" href="/signin">Join Now</a>
              <a className="btn btn-outline" href="/join-trainer">Join as Trainer</a>
              <a className="btn btn-outline" href="/signin">Sign In</a>
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
