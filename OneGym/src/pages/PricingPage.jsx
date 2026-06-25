import { useEffect, useMemo, useState } from 'react';
import { Footer } from '../components/Footer';
import { NavBar } from '../components/NavBar';
import './PricingPage.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const stripeLinks = {
  pro: import.meta.env.VITE_STRIPE_PRO_PAYMENT_LINK,
  studio: import.meta.env.VITE_STRIPE_STUDIO_PAYMENT_LINK,
};

const tiers = [
  {
    name: 'Free',
    planKey: 'member',
    price: 'RM 0',
    period: 'forever',
    description: 'For members who want the basics without committing yet.',
    cta: 'Start free',
    href: '/signin',
    features: [
      'Member dashboard',
      'Class schedule preview',
      'Basic workout history',
      'Starter meal logging',
    ],
  },
  {
    name: 'Pro',
    planKey: 'pro',
    price: 'RM 29',
    period: 'per month',
    description: 'For consistent members tracking meals, workouts, goals, and progress.',
    cta: 'Go Pro',
    href: '/signin',
    paymentKey: 'pro',
    featured: true,
    features: [
      'Full nutrition and calorie tracking',
      'AI meal recommendations',
      'Trainer chat access',
      'Personal records and leaderboards',
      'Progress analytics',
    ],
  },
  {
    name: 'Studio',
    planKey: 'studio',
    price: 'RM 99',
    period: 'per month',
    description: 'For gym teams managing trainers, classes, and member activity.',
    cta: 'Join as trainer',
    href: '/join-trainer',
    paymentKey: 'studio',
    features: [
      'Trainer dashboard',
      'Create and manage classes',
      'Member messaging',
      'Certification approval flow',
      'Operational reports',
    ],
  },
];

const comparison = [
  ['Member tracking', 'Basic', 'Advanced', 'Team-wide'],
  ['AI nutrition', 'Limited', 'Included', 'Included'],
  ['Trainer tools', '-', 'Chat access', 'Dashboard + classes'],
  ['Progress analytics', '-', 'Included', 'Included'],
];

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('onegymUser') || 'null');
  } catch {
    return null;
  }
}

function getUserPlan(user) {
  const planCode = user?.plan_code || user?.role;
  if (planCode === 'pro' || planCode === 'studio') return planCode;
  return user?.id ? 'member' : '';
}

export function PricingPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const currentPlan = useMemo(() => getUserPlan(user), [user]);

  useEffect(() => {
    let isMounted = true;
    const storedUser = getStoredUser();

    if (!storedUser?.id) return undefined;

    fetch(`${API_BASE_URL}/users/${storedUser.id}/`, { credentials: 'include' })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok || !data) return;

        const updatedUser = { ...storedUser, ...data };
        localStorage.setItem('onegymUser', JSON.stringify(updatedUser));
        if (isMounted) setUser(updatedUser);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  function paymentHref(tier) {
    const stripeLink = stripeLinks[tier.paymentKey];
    if (!stripeLink) return tier.href;

    if (!user?.id) return '/signin';

    const url = new URL(stripeLink);
    url.searchParams.set('client_reference_id', String(user.id));
    if (user.email) url.searchParams.set('prefilled_email', user.email);
    url.searchParams.set('utm_content', tier.paymentKey);
    return url.toString();
  }

  function isStripePayment(tier) {
    return Boolean(stripeLinks[tier.paymentKey] && user?.id);
  }

  return (
    <>
      <NavBar />
      <main className="pricing-page">
        <section className="pricing-hero">
          <p className="pricing-kicker">Pricing</p>
          <h1>Choose the plan that fits your training rhythm.</h1>
          <p>Start light, upgrade when your tracking gets serious, or bring the full studio workflow online.</p>
        </section>

        <section className="pricing-grid" aria-label="OneGym pricing tiers">
          {tiers.map((tier) => {
            const isCurrentPlan = currentPlan === tier.planKey;
            return (
            <article className={`pricing-card ${tier.featured ? 'featured' : ''} ${isCurrentPlan ? 'current' : ''}`} key={tier.name}>
              {tier.featured || isCurrentPlan ? (
                <span className={`pricing-badge ${isCurrentPlan ? 'current' : ''}`}>
                  {isCurrentPlan ? 'Current' : 'Popular'}
                </span>
              ) : null}
              <div>
                <h2>{tier.name}</h2>
                <p>{tier.description}</p>
              </div>
              <div className="pricing-price">
                <strong>{tier.price}</strong>
                <span>{tier.period}</span>
              </div>
              <a
                aria-disabled={isCurrentPlan}
                className={`pricing-cta ${tier.featured ? 'primary' : ''} ${isCurrentPlan ? 'current' : ''}`}
                href={isCurrentPlan ? undefined : paymentHref(tier)}
                onClick={isCurrentPlan ? (event) => event.preventDefault() : undefined}
                rel={isStripePayment(tier) ? 'noopener noreferrer' : undefined}
                target={isStripePayment(tier) ? '_blank' : undefined}
              >
                {isCurrentPlan ? 'Your plan' : stripeLinks[tier.paymentKey] ? 'Pay with Stripe' : tier.cta}
              </a>
              <ul>
                {tier.features.map((feature) => (
                  <li key={feature}>
                    <span className="material-symbols-outlined">check_circle</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </article>
          );
          })}
        </section>

        <section className="pricing-compare">
          <div className="pricing-compare-heading">
            <p className="pricing-kicker">Compare</p>
            <h2>What changes when you upgrade</h2>
          </div>
          <div className="compare-table">
            <div className="compare-row compare-head">
              <span>Feature</span>
              <span>Free</span>
              <span>Pro</span>
              <span>Studio</span>
            </div>
            {comparison.map((row) => (
              <div className="compare-row" key={row[0]}>
                {row.map((cell) => <span key={cell}>{cell}</span>)}
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
