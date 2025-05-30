import React from 'react';
import styles from './PuzzleSolver.module.css';

function PuzzleHeader({ currentPuzzle, isSolved, isFailed }) {
  return (
    <>
      {currentPuzzle?.motives && (
        <div className={styles.motiveBox}>
        <div className={styles.motives}>
          <strong>Motive</strong>
          <span className={styles.motiveText}>{currentPuzzle.motives}</span>
          <div className={styles.motiveIcon}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
              <path d="M2 17l10 5 10-5"></path>
              <path d="M2 12l10 5 10-5"></path>
            </svg>
          </div>
        </div>
        {isSolved && (
          <div className={styles.correctFeedback}><b>Correct!</b> Review the solution.</div>
        )}
        {isFailed && (
          <div className={styles.incorrectFeedback}><b>Incorrect.</b> Review the solution.</div>
        )}
        </div>
      )}</>);
}

export default PuzzleHeader;