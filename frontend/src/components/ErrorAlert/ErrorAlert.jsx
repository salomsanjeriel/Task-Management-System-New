import styles from './ErrorAlert.module.css';

export default function ErrorAlert({ message, onClose }) {
  if (!message) return null;
  return (
    <div className={styles.alert} role="alert" id="error-alert">
      <span className={styles.icon}>⚠️</span>
      <span className={styles.message}>{message}</span>
      {onClose && (
        <button className={styles.closeBtn} onClick={onClose}>
          ✕
        </button>
      )}
    </div>
  );
}
