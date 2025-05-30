import React from 'react';
import styles from './PuzzleSolver.module.css';

const PuzzleProgress = ({totalExercises, attemptedExercises }) => {
  // Use attemptedExercises for progress if provided, otherwise fall back to completedExercises

  // Calculate percentage based on attempted puzzles
  const progressPercentage = (attemptedExercises / totalExercises) * 100;

  return (
    <div className={styles.progress}>
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${progressPercentage}%` }}
        ></div>
      </div>
      {/* <div className={styles.chance}>
      You only have one try to complete the puzzle!
      </div>
      <div className={styles.progressText}>
        Progress: {progressCount} / {totalExercises} puzzles
         {attemptedExercises !== undefined && completedExercises < attemptedExercises && (
          <span className={styles.progressDetails}>
            ({completedExercises} correct, {attemptedExercises - completedExercises} incorrect)
          </span>
        )} 
      </div> */}
    </div>
  );
};

export default PuzzleProgress;