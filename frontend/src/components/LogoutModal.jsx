import React from 'react';
import styles from './LogoutModal.module.css';

const LogoutModal = ({ isOpen, onConfirm, onCancel, sessionInfo}) => {
  if (!isOpen) return null;

  const {
    puzzlesCompleted = 0,
    totalPuzzles = 0
  } = sessionInfo || {};


  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h2>Confirm Logout</h2>
        <div className={styles.modalContent}>
          <p>
            <strong>Warning:</strong> If you logout now, you cannot return to this test.
          </p>
          <p>Any unsaved progress will be lost.</p>
          <p className={styles.confirmQuestion}>Are you sure you want to logout?</p>
        </div>
        <div className={styles.modalButtons}>
          <button
            className={`${styles.modalButton} ${styles.cancelButton}`}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className={`${styles.modalButton} ${styles.confirmButton}`}
            onClick={onConfirm}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogoutModal;