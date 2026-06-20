import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import loginIllustration from '../../assets/login-illustration.png';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Flow states
  const [showForgotInfo, setShowForgotInfo] = useState(false);

  const validate = () => {
    const errors = {};
    if (!email.trim()) errors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) errors.email = 'Enter a valid email';
    if (!password) errors.password = 'Password is required';
    else if (password.length < 4) errors.password = 'Password must be at least 4 characters';
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setShowForgotInfo(false);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      // Standard Login
      const res = await login(email, password);
      if (res.mustResetPassword) {
        navigate('/reset-password');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Left — Illustration */}
        <div className={styles.illustrationPanel}>
          <img
            src={loginIllustration}
            alt="Woman working on laptop with clock"
            className={styles.illustrationImg}
          />
        </div>

        {/* Right — Form */}
        <div className={styles.formPanel}>
          <h1 className={styles.title}>Task Manager Login</h1>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                className={`${styles.input} ${fieldErrors.email ? styles.error : ''}`}
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              {fieldErrors.email && (
                <span className={styles.fieldError}>{fieldErrors.email}</span>
              )}
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="login-password">Password</label>
              <div className={styles.inputWrapper}>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className={`${styles.input} ${fieldErrors.password ? styles.error : ''}`}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className={styles.togglePassword}
                  onClick={() => setShowPassword((p) => !p)}
                  tabIndex={-1}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {fieldErrors.password && (
                <span className={styles.fieldError}>{fieldErrors.password}</span>
              )}
            </div>

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
              id="login-submit"
            >
              {loading && <span className={styles.spinnerInline} />}
              {loading ? 'Logging in...' : 'Log in'}
            </button>

            {error && (
              <div className={styles.errorBox}>
                <span className={styles.errorIcon}>⛔</span>
                <span className={styles.errorText}>{error}</span>
              </div>
            )}

            {showForgotInfo && (
              <div style={{
                backgroundColor: '#ebf8ff',
                border: '1px solid #3182ce',
                color: '#2b6cb0',
                padding: '12px',
                borderRadius: '6px',
                marginTop: '15px',
                fontSize: '13px',
                lineHeight: '1.5'
              }}>
                ℹ️ <strong>Account Recovery:</strong> <br />
                Self-registration and password resets are disabled for security. Please contact your System Administrator (<code>admin@tms.com</code>) to register an account or request a password change.
              </div>
            )}
          </form>

          <div className={styles.links}>
            <a
              href="#"
              className={styles.link}
              onClick={(e) => { e.preventDefault(); setShowForgotInfo(!showForgotInfo); setError(''); }}
            >
              Forgot password?
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
