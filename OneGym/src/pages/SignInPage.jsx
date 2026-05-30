import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import './SignInPage.css';

const heroImage = '../images/login.jpg';
  
const logoImage = '../images/logo.png';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

function loadScript(src, id) {
  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById(id);
    if (existingScript) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export function SignInPage() {
  const navigate = useNavigate();
  const googleTokenClientRef = useRef(null);
  const [activeForm, setActiveForm] = useState('login');
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  });
  const [signupForm, setSignupForm] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [resetForm, setResetForm] = useState({
    email: '',
    code: '',
    password: '',
    confirmPassword: '',
  });
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isLogin = activeForm === 'login';
  const isReset = activeForm === 'reset';

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      return;
    }

    let isMounted = true;

    loadScript('https://accounts.google.com/gsi/client', 'google-identity-script')
      .then(() => {
        if (!isMounted || !window.google?.accounts?.id) {
          return;
        }

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => handleSocialCredential('google', response.credential),
        });
        googleTokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'openid email profile',
          callback: (response) => handleSocialCredential('google', response.access_token, 'access_token'),
        });
      })
      .catch(() => {
        setIsError(true);
        setMessage('Unable to load Google sign in.');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function updateLoginField(event) {
    const { name, value } = event.target;
    setLoginForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function updateSignupField(event) {
    const { name, value } = event.target;
    setSignupForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function updateResetField(event) {
    const { name, value } = event.target;
    setResetForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function submitAuthForm(endpoint, payload) {
    setIsSubmitting(true);
    setMessage('');
    setIsError(false);

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Something went wrong.');
      }

      localStorage.setItem('onegymUser', JSON.stringify(data.user));
      window.dispatchEvent(new Event('onegym-auth-change'));
      setMessage(isLogin ? 'Signed in successfully.' : 'Account created successfully.');
      navigate('/member-dashboard');
    } catch (error) {
      setIsError(true);
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSocialCredential(provider, token, tokenType = 'id_token') {
    if (!token) {
      setIsError(true);
      setMessage(`Unable to get ${provider} login token.`);
      return;
    }

    setIsSubmitting(true);
    setMessage('');
    setIsError(false);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/social/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          [tokenType]: token,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `Unable to sign in with ${provider}.`);
      }

      localStorage.setItem('onegymUser', JSON.stringify(data.user));
      window.dispatchEvent(new Event('onegym-auth-change'));
      navigate('/member-dashboard');
    } catch (error) {
      setIsError(true);
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleAuth() {
    if (!GOOGLE_CLIENT_ID) {
      setIsError(true);
      setMessage('Google login is not configured.');
      return;
    }

    try {
      await loadScript('https://accounts.google.com/gsi/client', 'google-identity-script');

      if (!window.google?.accounts?.id) {
        throw new Error('Google sign in is not ready yet.');
      }

      if (!googleTokenClientRef.current) {
        googleTokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'openid email profile',
          callback: (response) => handleSocialCredential('google', response.access_token, 'access_token'),
        });
      }

      googleTokenClientRef.current.requestAccessToken({
        prompt: 'select_account',
      });
    } catch (error) {
      setIsError(true);
      setMessage(error.message || 'Unable to load Google sign in.');
    }
  }

  function handleSignIn(event) {
    event.preventDefault();
    submitAuthForm('/auth/signin/', loginForm);
  }

  function handleSignUp(event) {
    event.preventDefault();
    submitAuthForm('/auth/signup/', {
      ...signupForm,
      role: 'member',
    });
  }

  async function handleResetPassword(event) {
    event.preventDefault();

    if (!resetCodeSent) {
      setIsSubmitting(true);
      setMessage('');
      setIsError(false);

      try {
        const response = await fetch(`${API_BASE_URL}/auth/request-password-reset/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: resetForm.email,
          }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || 'Unable to send confirmation code.');
        }

        setResetCodeSent(true);
        setMessage(data.detail || 'Confirmation code sent to your email.');
      } catch (error) {
        setIsError(true);
        setMessage(error.message);
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    if (resetForm.password !== resetForm.confirmPassword) {
      setIsError(true);
      setMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setMessage('');
    setIsError(false);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: resetForm.email,
          code: resetForm.code,
          password: resetForm.password,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Unable to reset password.');
      }

      setLoginForm((current) => ({
        ...current,
        email: resetForm.email,
        password: '',
      }));
      setActiveForm('login');
      setIsError(false);
      setMessage(data.detail || 'Password updated. You can sign in now.');
      setResetForm({
        email: '',
        code: '',
        password: '',
        confirmPassword: '',
      });
      setResetCodeSent(false);
    } catch (error) {
      setIsError(true);
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function switchForm(formName) {
    setActiveForm(formName);
    setMessage('');
    setIsError(false);
    if (formName !== 'reset') {
      setResetCodeSent(false);
    }
  }

  return (
    <main className="signin-page">
      <div
        aria-label="A fit male athlete performing pull-ups in a minimalist private gym"
        className="signin-image-side"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="signin-image-overlay" />
      </div>

      <section className="signin-form-side">
        <div className="signin-form-inner">
          <div className="signin-logo-container">
            <img alt="OneGym Logo" className="signin-logo" src={logoImage} />
          </div>

          <div className="signin-header-section">
            <h1 className="signin-title">
              {isReset ? 'Reset password.' : isLogin ? 'Welcome back.' : 'Begin your journey.'}
            </h1>
            <p className="signin-subtitle">
              {isReset
                ? 'Update your password and return to your training space.'
                : isLogin
                ? 'Refining the art of physical excellence.'
                : 'Step into a sanctuary designed for focused transformation.'}
            </p>
          </div>

          <div className="signin-tabs-container">
            <button
              className={`signin-tab-btn ${isLogin || isReset ? 'active' : ''}`}
              onClick={() => switchForm('login')}
              type="button"
            >
              Sign In
            </button>
            <button
              className={`signin-tab-btn ${!isLogin ? 'active' : ''}`}
              onClick={() => switchForm('signup')}
              type="button"
            >
              Join Now
            </button>
          </div>

          {message && (
            <p className={`signin-message ${isError ? 'error' : 'success'}`}>
              {message}
            </p>
          )}

          {isReset ? (
            <form className="signin-auth-form signin-fade-in" onSubmit={handleResetPassword}>
              <div className="signin-input-group">
                <label className="signin-label-caps" htmlFor="reset-email">
                  Email Address
                </label>
                <input
                  className="signin-input-underlined"
                  id="reset-email"
                  name="email"
                  onChange={updateResetField}
                  placeholder="name@example.com"
                  required
                  type="email"
                  value={resetForm.email}
                />
              </div>
              {resetCodeSent && (
                <>
                  <div className="signin-input-group">
                    <label className="signin-label-caps" htmlFor="reset-code">
                      Confirmation Code
                    </label>
                    <input
                      className="signin-input-underlined"
                      id="reset-code"
                      inputMode="numeric"
                      maxLength="6"
                      name="code"
                      onChange={updateResetField}
                      placeholder="6-digit code"
                      required
                      type="text"
                      value={resetForm.code}
                    />
                  </div>
                  <div className="signin-input-group">
                    <label className="signin-label-caps" htmlFor="reset-password">
                      New Password
                    </label>
                    <input
                      className="signin-input-underlined"
                      id="reset-password"
                      name="password"
                      onChange={updateResetField}
                      placeholder="Create a new password"
                      required
                      type="password"
                      value={resetForm.password}
                    />
                  </div>
                  <div className="signin-input-group">
                    <label className="signin-label-caps" htmlFor="reset-confirm-password">
                      Confirm Password
                    </label>
                    <input
                      className="signin-input-underlined"
                      id="reset-confirm-password"
                      name="confirmPassword"
                      onChange={updateResetField}
                      placeholder="Repeat new password"
                      required
                      type="password"
                      value={resetForm.confirmPassword}
                    />
                  </div>
                </>
              )}
              <div className="signin-form-actions">
                <button className="signin-link-text signin-text-btn" onClick={() => switchForm('login')} type="button">
                  Back to Sign In
                </button>
              </div>
              <button className="signin-primary-btn" disabled={isSubmitting} type="submit">
                {isSubmitting
                  ? resetCodeSent ? 'Updating Password...' : 'Sending Code...'
                  : resetCodeSent ? 'Update Password' : 'Send Confirmation Code'}
              </button>
            </form>
          ) : isLogin ? (
            <form className="signin-auth-form signin-fade-in" onSubmit={handleSignIn}>
              <div className="signin-input-group">
                <label className="signin-label-caps" htmlFor="signin-email">
                  Email Address
                </label>
                <input
                  className="signin-input-underlined"
                  id="signin-email"
                  name="email"
                  onChange={updateLoginField}
                  placeholder="name@example.com"
                  required
                  type="email"
                  value={loginForm.email}
                />
              </div>
              <div className="signin-input-group">
                <label className="signin-label-caps" htmlFor="signin-password">
                  Password
                </label>
                <input
                  className="signin-input-underlined"
                  id="signin-password"
                  name="password"
                  onChange={updateLoginField}
                  placeholder="Password"
                  required
                  type="password"
                  value={loginForm.password}
                />
              </div>
              <div className="signin-form-actions">
                <button className="signin-link-text signin-text-btn" onClick={() => switchForm('reset')} type="button">
                  Forgot Password?
                </button>
              </div>
              <button className="signin-primary-btn" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form className="signin-auth-form signin-fade-in" onSubmit={handleSignUp}>
              <div className="signin-input-group">
                <label className="signin-label-caps" htmlFor="signup-name">
                  Username
                </label>
                <input
                  className="signin-input-underlined"
                  id="signup-name"
                  name="username"
                  onChange={updateSignupField}
                  placeholder="Julian Sterling"
                  required
                  type="text"
                  value={signupForm.username}
                />
              </div>
              <div className="signin-input-group">
                <label className="signin-label-caps" htmlFor="signup-email">
                  Email Address
                </label>
                <input
                  className="signin-input-underlined"
                  id="signup-email"
                  name="email"
                  onChange={updateSignupField}
                  placeholder="name@example.com"
                  required
                  type="email"
                  value={signupForm.email}
                />
              </div>
              <div className="signin-input-group">
                <label className="signin-label-caps" htmlFor="signup-password">
                  Password
                </label>
                <input
                  className="signin-input-underlined"
                  id="signup-password"
                  name="password"
                  onChange={updateSignupField}
                  placeholder="Create a secure password"
                  required
                  type="password"
                  value={signupForm.password}
                />
              </div>
              <button className="signin-primary-btn signin-join-btn" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Creating Account...' : 'Join OneGym'}
              </button>
            </form>
          )}

          <div className="signin-social-auth-section">
            <p className="signin-divider-text">Or continue with</p>
            <div className="signin-social-btns-container">
              <button className="signin-social-btn" disabled={isSubmitting} onClick={handleGoogleAuth} type="button">
                <svg className="signin-social-icon" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Google
              </button>
            </div>
          </div>

          <div className="signin-legal-footer">
            <p className="signin-legal-text">
              By continuing, you agree to the OneGym{' '}
              <a href="#">Privacy Policy</a> and <a href="#">Terms of Service</a>.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
