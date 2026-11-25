import { useEffect, useMemo, useState } from 'react';
import { Footer } from '../components/Footer';
import { NavBar } from '../components/NavBar';
import './PricingPage.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const stripeLinks = {
  pro: import.meta.env.VITE_STRIPE_PRO_PAYMENT_LINK,
  studio: import.meta.env.VITE_STRIPE_STUDIO_PAYMENT_LINK,
};

const tierTemplates = [
  {
    name: 'Free',
    databaseCode: 'free',
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
    databaseCode: 'pro',
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
    databaseCode: 'studio',
    planKey: 'studio',
    price: 'RM 99',
    period: 'per month',
    description: 'A paid membership plan. Trainer and administrator access are assigned separately.',
    cta: 'Choose Studio',
    href: '/signin',
    paymentKey: 'studio',
    features: [
      'Member dashboard',
      'Class booking',
      'Workout and nutrition tracking',
      'AI meal recommendations',
    ],
  },
];

const comparison = [
  { label: 'Member tracking', free: 'Basic', pro: 'Advanced', studio: 'Team-wide' },
  { label: 'AI nutrition', free: 'Limited', pro: 'Included', studio: 'Included' },
  { label: 'Trainer dashboard', free: 'Separate approval', pro: 'Separate approval', studio: 'Separate approval' },
  { label: 'Progress analytics', free: '-', pro: 'Included', studio: 'Included' },
];

function formatPlanPrice(plan) {
  const amount = Number(plan.price_cents || 0) / 100;
  try {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: String(plan.currency || 'MYR').toUpperCase(),
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `RM ${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
  }
}

function pricingTierForPlan(plan) {
  const databaseCode = String(plan.code || '').toLowerCase();
  const template = tierTemplates.find((tier) => tier.databaseCode === databaseCode);
  const genericTier = {
    databaseCode,
    planKey: databaseCode,
    description: `OneGym ${plan.name || databaseCode} membership plan.`,
    cta: `Choose ${plan.name || 'plan'}`,
    href: '/signin',
    features: ['Member dashboard', 'Class booking access', 'Workout and progress tracking'],
  };

  return {
    ...(template || genericTier),
    name: plan.name || template?.name || databaseCode,
    databaseCode,
    price: formatPlanPrice(plan),
    isPaid: Number(plan.price_cents || 0) > 0,
    period: Number(plan.price_cents || 0) === 0 ? 'forever' : 'per month',
  };
}

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
  const [activePlans, setActivePlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState('');
  const currentPlan = useMemo(() => getUserPlan(user), [user]);
  const visibleTiers = useMemo(() => activePlans.map(pricingTierForPlan), [activePlans]);

  useEffect(() => {
    let isMounted = true;
    fetch(`${API_BASE_URL}/plans/`)
      .then(async (response) => {
        const data = await response.json().catch(() => []);
        if (!response.ok || !Array.isArray(data)) throw new Error('Unable to load available plans.');
        if (isMounted) setActivePlans(data);
      })
      .catch((error) => {
        if (isMounted) setPlansError(error.message || 'Unable to load available plans.');
      })
      .finally(() => {
        if (isMounted) setPlansLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function refreshMembership() {
      const storedUser = getStoredUser();
      if (!storedUser?.id) return;
      try {
        const response = await fetch(`${API_BASE_URL}/users/${storedUser.id}/`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!isMounted || !response.ok) return;
        const data = await response.json();
        if (!isMounted || getStoredUser()?.id !== storedUser.id) return;
        const updatedUser = { ...storedUser, ...data };
        localStorage.setItem('onegymUser', JSON.stringify(updatedUser));
        setUser(updatedUser);
      } catch {
        // Keep the current membership display if the refresh fails.
      }
    }

    refreshMembership();
    window.addEventListener('focus', refreshMembership);
    return () => {
      isMounted = false;
      window.removeEventListener('focus', refreshMembership);
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

        {plansLoading ? <div className="pricing-plan-state">Loading available plans…</div> : null}
        {!plansLoading && plansError ? <div className="pricing-plan-state error">{plansError}</div> : null}
        {!plansLoading && !plansError && !visibleTiers.length ? <div className="pricing-plan-state">No membership plans are currently available.</div> : null}

        {!plansLoading && !plansError && visibleTiers.length ? <section className="pricing-grid" aria-label="OneGym pricing tiers">
          {visibleTiers.map((tier) => {
            const isCurrentPlan = currentPlan === tier.planKey;
            const checkoutUnavailable = tier.isPaid && !stripeLinks[tier.paymentKey];
            const actionLabel = isCurrentPlan ? 'Your plan'
              : checkoutUnavailable ? 'Checkout unavailable'
                : tier.isPaid ? (user?.id ? 'Pay with Stripe' : 'Sign in to subscribe') : tier.cta;
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
                aria-disabled={isCurrentPlan || checkoutUnavailable}
                className={`pricing-cta ${tier.featured ? 'primary' : ''} ${isCurrentPlan ? 'current' : ''}`}
                href={isCurrentPlan || checkoutUnavailable ? undefined : paymentHref(tier)}
                rel={isStripePayment(tier) ? 'noopener noreferrer' : undefined}
                target={isStripePayment(tier) ? '_blank' : undefined}
              >
                {actionLabel}
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
        </section> : null}

        {!plansLoading && !plansError && visibleTiers.length ? <section className="pricing-compare">
          <div className="pricing-compare-heading">
            <p className="pricing-kicker">Compare</p>
            <h2>What changes when you upgrade</h2>
          </div>
          <div className="compare-table">
            <div className="compare-row compare-head" style={{ gridTemplateColumns: `minmax(180px, 1.4fr) repeat(${visibleTiers.length}, minmax(120px, 1fr))` }}>
              <span>Feature</span>
              {visibleTiers.map((tier) => <span key={tier.databaseCode}>{tier.name}</span>)}
            </div>
            {comparison.map((row) => (
              <div className="compare-row" key={row.label} style={{ gridTemplateColumns: `minmax(180px, 1.4fr) repeat(${visibleTiers.length}, minmax(120px, 1fr))` }}>
                <span>{row.label}</span>
                {visibleTiers.map((tier) => <span key={tier.databaseCode}>{row[tier.databaseCode] || 'Included'}</span>)}
              </div>
            ))}
          </div>
        </section> : null}
      </main>
      <Footer />
    </>
  );
}
