import React, { useEffect, useState } from 'react';
import styles from './PuzzleSolver.module.css';

const PuzzleStatus = ({
  handleNextPuzzle,
  isSolved,
  isFailed,
  selectedMotive,
  setSelectedMotive,
  showSolution,
  solutionTimer,
  currentPuzzle
}) => {
  const [showModalWrapper, setShowModalWrapper] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [showInitialMessage, setShowInitialMessage] = useState(true);
  const motives = ["Fork", "Pin", "Undermining", "New motive"];
  useEffect(() => {

    // Reset states when puzzle status changes
    if (!isSolved && !isFailed) {
      setShowModalWrapper(false);
      setShowButton(false);
      setShowInitialMessage(true);
      return;
    }

    
    // Handle solved puzzles - only show button without initial modal hide/show
   if (isSolved) {
      setShowModalWrapper(true);
      setShowButton(true);
      setShowInitialMessage(true);

    } 

  }, [isSolved, isFailed]);

  // Handle showing button when solution timer is near completion
  useEffect(() => {
    // For failed puzzles, when the solution timer is done,
    // show the button-only modal
    if ((isFailed || isSolved) && !showButton) {
      setShowButton(true);
      setShowModalWrapper(true);
      setShowInitialMessage(false); // Don't show text in the second modal appearance
    }
  }, [isFailed, showButton]);


    const MotiveSelector = () => (
    <div className={styles.motiveSelector}>
      <p>Select the motive:</p>
      <div className={styles.motiveButtons}>
        {motives.map(motive => (
          <button
            key={motive}
            className={`${styles.motiveButton} ${selectedMotive === motive ? styles.selected : ''}`}
            onClick={() => {
              setSelectedMotive(motive);
              if (currentPuzzle?.id) {
                localStorage.removeItem(`awaiting_motive_${currentPuzzle.id}`);
                }                    
            }}
          >
            {motive}
          </button>
        ))}
      </div>
    </div>
  );

  const statusMessage = (
    <div className={styles.statusMessage}>
      {(isSolved || isFailed) && selectedMotive=== null && <MotiveSelector />}

      {(isSolved || isFailed) && selectedMotive != null  && showButton && (
        <button
          className={styles.nextPuzzleButton}
          onClick={handleNextPuzzle()}
        >
          Next Puzzle
        </button>
      )}
    </div>
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