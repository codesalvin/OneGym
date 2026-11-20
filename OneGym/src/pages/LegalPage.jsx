import { Footer } from '../components/Footer';
import { NavBar } from '../components/NavBar';
import './LegalPage.css';

const content = {
  privacy: {
    eyebrow: 'Privacy',
    title: 'Privacy Policy',
    intro: 'OneGym uses account, fitness, booking, and nutrition information to provide the services you choose to use.',
    sections: [
      ['Information we collect', 'We collect account details and the fitness information you submit, including workouts, meals, bookings, goals, messages, and profile photos.'],
      ['How we use it', 'We use this information to operate your dashboard, calculate progress, support trainer communication, secure accounts, and improve the service.'],
      ['Who can access it', 'You can access your own information. Approved trainers receive only the member information needed for coaching, while administrators access operational information when required.'],
      ['Your choices', 'You may update your profile information in OneGym and contact support to request account or data deletion.'],
    ],
  },
  terms: {
    eyebrow: 'Terms',
    title: 'Terms of Service',
    intro: 'These terms describe the basic rules for using OneGym.',
    sections: [
      ['Your account', 'Keep your login details private and provide accurate information. You are responsible for activity performed through your account.'],
      ['Fitness information', 'OneGym provides tracking and general recommendations, not medical diagnosis or treatment. Consult a qualified professional before making significant health decisions.'],
      ['Acceptable use', 'Do not attempt to access another user’s information, disrupt the service, upload harmful content, or misuse communication features.'],
      ['Availability', 'Features may change while OneGym is developed. We aim to protect saved data and communicate material service changes.'],
    ],
  },
};

export function LegalPage({ type }) {
  const page = content[type] || content.privacy;

  return (
    <>
      <NavBar />
      <main className="legal-page">
        <header>
          <p>{page.eyebrow}</p>
          <h1>{page.title}</h1>
          <span>{page.intro}</span>
        </header>
        <section>
          {page.sections.map(([title, body]) => (
            <article key={title}>
              <h2>{title}</h2>
              <p>{body}</p>
            </article>
          ))}
          <small>Last updated: 19 November 2026</small>
        </section>
      </main>
      <Footer />
    </>
  );
}
