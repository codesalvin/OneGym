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
    <>
      <NavBar />
      
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-photos" aria-hidden="true">
            <div className="photo-placeholder p1"></div>
            <div className="photo-placeholder p2"></div>
            <div className="photo-placeholder p3"></div>
            <div className="photo-placeholder p4"></div>
            <div className="photo-placeholder p5"></div>
            <div className="photo-placeholder p6"></div>
          </div>
          <div className="hero-text">
            <h1>Manage your gym like a champion</h1>
            <p>Your gym runs itself while you build something bigger. OneGym takes the daily grind and turns it into simple numbers on a screen.</p>
            <div className="hero-ctas">
              <a className="btn btn-primary" href="/signin">Sign In</a>
              <a className="btn btn-outline" href="#features">Learn More</a>
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

      {/* Features Heading Intro */}
      <section className="features-intro" id="features">
        <div className="container">
          <p className="label">Simple</p>
          <h2>What makes OneGym different</h2>
          <p>Built for gym owners who want control without complexity. No fluff, just what works.</p>
        </div>
      </section>

      {/* Feature Cards Grid Section */}
      <section className="feature-cards">
        <div className="container">
          <div className="cards-grid">

            <div className="card">
              <div className="card-img img1">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="18" r="8" stroke="#fff" strokeWidth="2" />
                  <path d="M8 40c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="card-body">
                <h3>Member management</h3>
                <p>Keep track of every member, their progress, and their payments in one dashboard.</p>
              </div>
            </div>

            <div className="card">
              <div className="card-img img2">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <rect x="8" y="10" width="32" height="30" rx="3" stroke="#fff" strokeWidth="2" />
                  <path d="M8 18h32M16 6v8M32 6v8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="card-body">
                <h3>Class scheduling</h3>
                <p>Schedule classes, manage instructors, and let members book their spots automatically.</p>
              </div>
            </div>

            <div className="card">
              <div className="card-img img3">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <polyline points="8,34 18,22 26,28 40,12" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="40" cy="12" r="3" fill="#fff" />
                </svg>
              </div>
              <div className="card-body">
                <h3>Real-time reporting</h3>
                <p>See your revenue, attendance, and member trends whenever you need them.</p>
              </div>
            </div>

          </div>
          <div className="cards-actions">
            <a className="btn btn-outline btn-sm" href="/signin">Explore</a>
            <a className="arrow-link" href="#">
              Arrow
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* Onboarding Sequential Steps Section */}
      <section className="steps">
        <div className="container">

          <div className="step-item">
            <div className="step-text">
              <p className="step-num">01&nbsp;&nbsp;Set up</p>
              <p className="step-label">Getting started</p>
              <h2>Create your gym profile</h2>
              <p>Add your gym details, set your rates, and configure your class schedule in minutes.</p>
              <div className="step-actions">
                <a className="btn btn-outline btn-sm" href="/signin">Begin</a>
                <a className="arrow-link" href="#">
                  Arrow
                  <svg viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </a>
              </div>
            </div>
            <div className="step-image img-tone-1"></div>
          </div>

          <div className="step-item">
            <div className="step-text">
              <p className="step-num">02&nbsp;&nbsp;Invite members</p>
              <p className="step-label">Building community</p>
              <h2>Bring your members online</h2>
              <p>Send invitations to your existing members and let them manage their own accounts and bookings.</p>
              <div className="step-actions">
                <a className="btn btn-outline btn-sm" href="/signin">Invite</a>
                <a className="arrow-link" href="#">
                  Arrow
                  <svg viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </a>
              </div>
            </div>
            <div className="step-image img-tone-2"></div>
          </div>

          <div className="step-item">
            <div className="step-text">
              <p className="step-num">03&nbsp;&nbsp;Run it</p>
              <p className="step-label">Daily operations</p>
              <h2>Manage everything from here</h2>
              <p>Handle bookings, track attendance, process payments, and watch your business grow without the paperwork.</p>
              <div className="step-actions">
                <a className="btn btn-outline btn-sm" href="/signin">Manage</a>
                <a className="arrow-link" href="#">
                  Arrow
                  <svg viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </a>
              </div>
            </div>
            <div className="step-image img-tone-3"></div>
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
              <a className="btn btn-outline" href="/signin">Sign In</a>
            </div>
          </div>
        </div>
        <div className="cta-image-wrapper">
          <div className="cta-image"></div>
        </div>
      </section>

      <Footer />
    </>
  );
}
