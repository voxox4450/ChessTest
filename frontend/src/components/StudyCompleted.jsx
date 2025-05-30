import React from 'react';
import styles from './StudyCompleted.module.css';

const StudyCompleted = ({ username, onLogout }) => {
  return (
    <div className={styles.completedContainer}>
      <div className={styles.completedContent}>
        <div className={styles.completionIcon}>
          <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>

        <h1>Study Completed!</h1>

        <p className={styles.thankYou}>
          Thank you, <span className={styles.username}>{username}</span>, for participating in our chess puzzle study!
        </p>

        <div className={styles.messageSection}>
          <p>You have successfully completed all 5 sessions of the study.</p>
          <p>Your contributions will help us better understand the effects of different training methods on chess puzzle-solving abilities.</p>
          <p>The research team appreciates your time and dedication!</p>
        </div>

        <div className={styles.contactSection}>
          <h2>Questions or Feedback?</h2>
          <p>If you have any questions about the study or would like to receive information about the results when available, please contact the research team.</p>
        </div>

        <button
          onClick={onLogout}
          className={styles.logoutButton}
        >
          Log Out
        </button>
      </div>
    </div>
  );
};

export default StudyCompleted;