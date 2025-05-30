import React, { useEffect, useState } from 'react';
import styles from './PuzzleSolver.module.css';

const PuzzleStatus = ({
  handleNextPuzzle,
  isSolved,
  isFailed,
  showSolution,
  solutionTimer,
  currentPuzzle
}) => {
  const [showModalWrapper, setShowModalWrapper] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [showInitialMessage, setShowInitialMessage] = useState(true);

  useEffect(() => {
    let initialTimeoutId;

    // Reset states when puzzle status changes
    if (!isSolved && !isFailed) {
      setShowModalWrapper(false);
      setShowButton(false);
      setShowInitialMessage(true);
      return;
    }

    // Handle failed puzzles - show modal, then hide, then show button
    if (isFailed || isSolved) {
      // Show modal immediately for 4 seconds
      setShowModalWrapper(true);
      setShowInitialMessage(true);
      
      initialTimeoutId = setTimeout(() => {
        // Hide modal after 4 seconds
        setShowModalWrapper(false);
      }, 4000);
    }
    
    // Handle solved puzzles - only show button without initial modal hide/show
   /* if (isSolved) {
      setShowModalWrapper(true);
      setShowButton(true);
      setShowInitialMessage(true);
    } */

    return () => {
      clearTimeout(initialTimeoutId);
    };
  }, [isSolved, isFailed]);

  // Handle showing button when solution timer is near completion
  useEffect(() => {
    // For failed puzzles, when the solution timer is done,
    // show the button-only modal
    if ((isFailed || isSolved) && solutionTimer === 0 && !showButton) {
      setShowButton(true);
      setShowModalWrapper(true);
      setShowInitialMessage(false); // Don't show text in the second modal appearance
    }
  }, [solutionTimer, isFailed, showButton]);

  const statusMessage = (
    <>
      {isSolved && (
        <div className={`${styles.statusMessage} ${styles.success}`}>
          {showSolution && showInitialMessage ? (
            <>
              {`Correct!`}
              {showButton && (
                <button
                  className={styles.nextPuzzleButton}
                  onClick={handleNextPuzzle}
                  disabled={solutionTimer > 0}
                >
                  {solutionTimer > 0 ? `Next puzzle in ${solutionTimer}s` : 'Next puzzle'}
                </button>
              )}
            </>
          ) : (
            <>
              {showInitialMessage ? "Correct! Loading next puzzle..." : ""}
              {showButton && (
                <button
                  className={styles.nextPuzzleButton}
                  onClick={handleNextPuzzle}
                >
                  Next puzzle
                </button>
              )}
            </>
          )}
        </div>
      )}
      {isFailed && (
        <div className={`${styles.statusMessage} ${styles.failure}`}>
          {showSolution && showInitialMessage ? (
            <>
              {`Incorrect. Review the solution `}
              {showButton && (
                <button
                  className={styles.nextPuzzleButton}
                  onClick={handleNextPuzzle}
                  disabled={solutionTimer > 0}
                >
                  {solutionTimer > 0 ? `Next puzzle in ${solutionTimer}s` : 'Next puzzle'}
                </button>
              )}
            </>
          ) : (
            <>
              {showInitialMessage ? "Incorrect. The correct solution will be shown." : ""}
              {showButton && !showInitialMessage && (
                <button
                  className={styles.nextPuzzleButton}
                  onClick={handleNextPuzzle}
                >
                  Next puzzle
                </button>
              )}
            </>
          )}
        </div>
      )}
    </>
  );

  return (
    <>
      {showModalWrapper && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            {statusMessage}
          </div>
        </div>
      )}
      {!showModalWrapper && statusMessage}
    </>
  );
};

export default PuzzleStatus;