import styles from './LoadingSpinner.module.css';

export default function LoadingSpinner({ size = 'medium', fullPage = false, label = '' }) {
  return (
    <div className={`${styles.spinnerOverlay} ${fullPage ? styles.fullPage : ''}`}>
      <div className={styles.spinnerContent}>
        <div className={`${styles.spinner} ${styles[size]}`} />
        {label && <div className={styles.label}>{label}</div>}
      </div>
    </div>
  );
}
