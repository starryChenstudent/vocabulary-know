import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import LocaleToggle from '../components/LocaleToggle';
import IcpFooter from '../components/IcpFooter';
import { useLocale } from '../components/LocaleProvider';
import './Login.css';

function LogoMark() {
  return (
    <svg className="login-logo" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="10" fill="url(#login-logo-gradient)" />
      <path
        d="M9 10.5C9 9.67 9.67 9 10.5 9H15v14H10.5A1.5 1.5 0 0 1 9 21.5v-11Z"
        fill="rgba(255,255,255,0.95)"
      />
      <path
        d="M17 9h4.5c.83 0 1.5.67 1.5 1.5v11c0 .83-.67 1.5-1.5 1.5H17V9Z"
        fill="rgba(255,255,255,0.75)"
      />
      <path d="M15 9v14" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" />
      <circle cx="22.5" cy="11.5" r="2.2" fill="#fff" />
      <path d="M22.5 14.2v5.3" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <defs>
        <linearGradient id="login-logo-gradient" x1="4" y1="4" x2="28" y2="28">
          <stop stopColor="#0f766e" />
          <stop offset="1" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function Login() {
  const { user, loading, login, register } = useAuth();
  const { t } = useLocale();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [registrationAllowed, setRegistrationAllowed] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    api.getRegistrationStatus().then((res) => setRegistrationAllowed(res.allowed)).catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="login-page">
        <LocaleToggle variant="login" />
        <div className="login-page__center">
          <div className="login-card card">
            <p className="login-muted">{t('common.loading')}</p>
          </div>
        </div>
        <IcpFooter variant="login" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(username, password);
      } else {
        await register(username, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <LocaleToggle variant="login" />
      <div className="login-page__center">
      <div className="login-card card fade-in">
        <div className="login-brand">
          <LogoMark />
          <div>
            <h1 className="login-title">Vocabulary iknow</h1>
            <p className="login-subtitle">{t('login.subtitle')}</p>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-label">
            {t('login.username')}
            <input
              className="input"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('login.usernamePlaceholder')}
              required
            />
          </label>

          <label className="login-label">
            {t('login.password')}
            <div className="login-password-wrap">
              <input
                className="input login-password-input"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('login.passwordPlaceholder')}
                required
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                title={showPassword ? t('login.hidePassword') : t('login.showPassword')}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 3l18 18" />
                    <path d="M10.58 10.58A2 2 0 0 0 12 15a2 2 0 0 0 1.42-3.42" />
                    <path d="M9.88 5.09A10.94 10.94 0 0 1 12 5c5 0 9.27 3.11 11 8-1.02 2.94-3.07 5.26-5.62 6.62M6.61 6.61A10.8 10.8 0 0 0 3 13c1.73 4.89 6 8 9 8 1.05 0 2.07-.22 3.03-.62" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </label>

          {error && <p className="error-msg">{error}</p>}

          <button className="btn btn-primary login-submit" type="submit" disabled={submitting}>
            {submitting
              ? t('login.submitting')
              : mode === 'login'
                ? t('login.submitLogin')
                : t('login.submitRegister')}
          </button>
        </form>

        {registrationAllowed ? (
          <p className="login-switch">
            {mode === 'login' ? t('login.noAccount') : t('login.hasAccount')}
            <button
              type="button"
              className="login-switch-btn"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setShowPassword(false);
                setError('');
              }}
            >
              {mode === 'login' ? t('login.registerNow') : t('login.goLogin')}
            </button>
          </p>
        ) : (
          <p className="login-muted">{t('login.registrationClosed')}</p>
        )}
      </div>
      </div>
      <IcpFooter variant="login" />
    </div>
  );
}
