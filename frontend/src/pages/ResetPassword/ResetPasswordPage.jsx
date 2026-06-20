import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/api';
import ErrorAlert from '../../components/ErrorAlert/ErrorAlert';
import styles from './ResetPasswordPage.module.css';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { logout, completePasswordReset } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Password rules validation
  const meetsLength = password.length >= 8;
  const meetsUppercase = /[A-Z]/.test(password);
  const meetsNumber = /[0-9]/.test(password);
  const meetsSpecial = /[!@#$%^&*]/.test(password);
  const passwordsMatch = password && password === confirmPassword;

  const isFormValid = meetsLength && meetsUppercase && meetsNumber && meetsSpecial && passwordsMatch;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    setLoading(true);
    setError('');

    try {
      await authService.resetPassword(password);
      completePasswordReset();
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Update Your Password</h1>
        <p className={styles.subtitle}>
          This is your first login. For security purposes, please set a strong password to continue.
        </p>

        {error && <ErrorAlert message={error} onClose={() => setError('')} />}

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="new-password">New Password</label>
            <input
              id="new-password"
              type="password"
              className={styles.input}
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="confirm-password">Confirm Password</label>
            <input
              id="confirm-password"
              type="password"
              className={`${styles.input} ${confirmPassword && !passwordsMatch ? styles.error : ''}`}
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {/* Validation Checklist */}
          <div className={styles.checklist}>
            <div className={`${styles.checkItem} ${meetsLength ? styles.valid : ''}`}>
              {meetsLength ? '✅' : '❌'} At least 8 characters
            </div>
            <div className={`${styles.checkItem} ${meetsUppercase ? styles.valid : ''}`}>
              {meetsUppercase ? '✅' : '❌'} One uppercase letter (A-Z)
            </div>
            <div className={`${styles.checkItem} ${meetsNumber ? styles.valid : ''}`}>
              {meetsNumber ? '✅' : '❌'} One numeric digit (0-9)
            </div>
            <div className={`${styles.checkItem} ${meetsSpecial ? styles.valid : ''}`}>
              {meetsSpecial ? '✅' : '❌'} One special character (!@#$%^&*)
            </div>
            <div className={`${styles.checkItem} ${passwordsMatch ? styles.valid : ''}`}>
              {passwordsMatch ? '✅' : '❌'} Passwords match
            </div>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.logoutBtn}
              onClick={logout}
            >
              Sign Out
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={!isFormValid || loading}
            >
              {loading ? 'Updating...' : 'Update & Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
