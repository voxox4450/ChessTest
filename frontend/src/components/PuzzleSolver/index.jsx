import { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import styles from './PuzzleSolver.module.css';

// Import smaller components
import PuzzleBoard from './PuzzleBoard';
import PuzzleStatus from './PuzzleStatus';
import PuzzleControls from './PuzzleControls';
import PuzzleProgress from './PuzzleProgress';
import PuzzleHeader from './PuzzleHeader';
import Timer from '../Timer';

// Import logic functions
import {
  parsePuzzleMoves,
  makeChessMove,
  makeComputerMove,
  createReplayPosition
} from './PuzzleLogic';

// Import API functions
import { recordPuzzleResult, completeSessionLog } from '../../api/database';

const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function PuzzleSolver({ exercises, onComplete, onProgressUpdate, userId, sessionLogId, initialPuzzleIndex = 0, updateSessionIndex}) {
  // State declarations
  const [game, setGame] = useState(new Chess(initialFen));
  const [currentPuzzle, setCurrentPuzzle] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(initialPuzzleIndex);
  const [completedExercises, setCompletedExercises] = useState(0);
  const [isSolved, setIsSolved] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [moveIndex, setMoveIndex] = useState(0);
  const [selectedMotive, setSelectedMotive] = useState(null);
  const [replayIndex, setReplayIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [animateError, setAnimateError] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [nextClicked, setNextCliced] = useState(false);
  
  // New state for tracking metrics
  const [startTime, setStartTime] = useState(null);
  const [totalCorrectMoves, setTotalCorrectMoves] = useState(0);
  const [totalIncorrectMoves, setTotalIncorrectMoves] = useState(0);
  const [puzzleStartTime, setPuzzleStartTime] = useState(null);
  const [elapsedPuzzleTime, setElapsedPuzzleTime] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState(Date.now());
  const [movesHistory, setMovesHistory] = useState([]);
  const [moveTimestamps, setMoveTimestamps] = useState([]);
  const [puzzleInitialized, setPuzzleInitialized] = useState(false);
  const [attemptedExercises, setAttemptedExercises] = useState(0);

  // Function to load a puzzle
  const loadPuzzle = (index) => {
    if (!exercises || index >= exercises.length) {
      console.log('No exercises available or index out of bounds');
      return;
    }

    // Clear previous puzzle data
    setMovesHistory([]);
    setMoveTimestamps([]);
    localStorage.removeItem('current_puzzle_moves');
    localStorage.removeItem('current_puzzle_move_timestamps');

    const puzzle = exercises[index];
    if (!puzzle) {
      console.error('Puzzle is undefined or null');
      return;
    }

    // Generate a unique key for this puzzle to use in localStorage
    const puzzleIdentifier = `puzzle_${puzzle.id || index}`;

    // Clear timer data for all previous puzzles
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('puzzle_timer_end_')) {
        localStorage.removeItem(key);
      }
    }
    const awaitingMotive = localStorage.getItem(`awaiting_motive_${puzzle.id}`) === 'true';

    // Parse the puzzle moves
    const { fen, moves, newChess, starting_color } = parsePuzzleMoves(puzzle, initialFen);

    // Set puzzle data
    setGame(newChess);
    setCurrentPuzzle({
      ...puzzle,
      initial_fen: fen,
      moves: moves,
      starting_color: starting_color
    });

    if (awaitingMotive) {
    console.log('Puzzle is awaiting motive, loading in failed state');
    setIsSolved(false);
    setIsFailed(true);
    setMoveIndex(0);
    setReplayIndex(0);
    setErrorMessage('');
    setAnimateError(false);
    setSelectedMotive(null);

    return;
  }

    // Reset state for new puzzle
    setIsSolved(false);
    setIsFailed(false);
    setMoveIndex(0);
    setReplayIndex(0);
    setErrorMessage('');
    setAnimateError(false);
    setSelectedMotive(null);

    // Reset metrics for new puzzle
    const now = Date.now();
    setPuzzleStartTime(now);
    setElapsedPuzzleTime(0);
    setMovesHistory([]);
    setMoveTimestamps([]);

    // Store current puzzle state in localStorage for refresh resilience
    localStorage.setItem('current_puzzle_data', JSON.stringify({
      index: index,
      puzzleId: puzzle.id,
      startTime: now,
      isSolved: false,
      isFailed: false,
      moveIndex: 0,
      selectedMotive: null
    }));

    // Clear any previous puzzle FEN and moves data
    localStorage.removeItem('current_puzzle_fen');
    localStorage.removeItem('current_puzzle_moves');
    localStorage.removeItem('current_puzzle_move_timestamps');

    // Update parent component with current progress
    updateProgress(index);
  };

  // Update the parent component with progress information
  const updateProgress = (puzzleIndex) => {
    if (onProgressUpdate) {
      onProgressUpdate({
        puzzlesCompleted: completedExercises,
        totalPuzzles: exercises.length,
        currentPuzzleIndex: puzzleIndex,
        attemptedExercises: attemptedExercises
      });
    }
  };

  const handleNextPuzzle = async() => {
    console.log("handling the next puzzle");
    setNextCliced(true);
    setSelectedMotive(null);

    if (currentPuzzle?.id) {
      localStorage.removeItem(`solution_end_${currentPuzzle.id}`);
      localStorage.removeItem(`awaiting_motive_${currentPuzzle.id}`);

    }    
    const nextIndex = currentIndex + 1;
    if (nextIndex < exercises.length) {
      await updateSessionIndex(nextIndex); 
      setCurrentIndex(nextIndex);
      loadPuzzle(nextIndex);
    } else {
      setSessionCompleted(true);
      if (onComplete) {
        onComplete({
          puzzlesCompleted: completedExercises,
          totalPuzzles: exercises.length,
          attemptedExercises: attemptedExercises
        });
      }
    }
  };

  // Handle user moves
  const handleMove = (sourceSquare, targetSquare) => {
    if (isSolved /*|| showSolution*/ || !currentPuzzle) return false;

    // Clear any previous error
    setErrorMessage('');
    setAnimateError(false);

    const now = Date.now();

    try {
      // Try to make the move
      const moveResult = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q', // Default to queen promotion
      });

      // If move is invalid or null
      if (!moveResult) {
        setErrorMessage('That move is illegal.');
        triggerErrorAnimation();
        return false;
      }

      // Check if move matches expected solution
      const uciMove = `${sourceSquare}${targetSquare}`;
      const expectedMove = currentPuzzle.moves[moveIndex];

      // Calculate time spent on this move
      let timeSpentMs = 0;
      if (moveTimestamps.length > 0) {
        // Time since last move
        timeSpentMs = now - moveTimestamps[moveTimestamps.length - 1];
      } else {
        // Time since puzzle start
        timeSpentMs = now - puzzleStartTime;
      }

      // Record the move timestamp
      const updatedMoveTimestamps = [...moveTimestamps, now];
      setMoveTimestamps(updatedMoveTimestamps);
      localStorage.setItem('current_puzzle_move_timestamps', JSON.stringify(updatedMoveTimestamps));

      // Record the move
      const moveData = {
        uci: uciMove,
        expected: expectedMove,
        isCorrect: uciMove === expectedMove,
        timestamp: now,
        timeSpentMs: timeSpentMs
      };

      const updatedMovesHistory = [...movesHistory, moveData];
      setMovesHistory(updatedMovesHistory);

      // Store move in localStorage for refresh resilience
      localStorage.setItem('current_puzzle_moves', JSON.stringify(updatedMovesHistory));

      // Compare move against expected
      if (uciMove === expectedMove) {
        setTotalCorrectMoves(prev => prev + 1);
        let newMoveIndex = moveIndex + 1;

        // Update localStorage with current state
        localStorage.setItem('current_puzzle_data', JSON.stringify({
          index: currentIndex,
          puzzleId: currentPuzzle.id,
          startTime: puzzleStartTime,
          isSolved: newMoveIndex >= currentPuzzle.moves.length,
          isFailed: false,
          moveIndex: newMoveIndex,
          selectedMotive: selectedMotive
        }));

        // Make computer's response move if needed
        if (newMoveIndex < currentPuzzle.moves.length) {
          const computerMoveString = currentPuzzle.moves[newMoveIndex];
          const fromSquare = computerMoveString.substring(0, 2);
          const toSquare = computerMoveString.substring(2, 4);

          setTimeout(() => {
            try {
              const computerResult = game.move({
                from: fromSquare,
                to: toSquare,
                promotion: 'q',
              });

              if (computerResult) {
                const newGameFen = game.fen();
                setGame(new Chess(newGameFen)); // This ensures the UI updates
                newMoveIndex++;
                setMoveIndex(newMoveIndex);

                // Store the game state after computer move
                localStorage.setItem('current_puzzle_fen', newGameFen);
                localStorage.setItem('current_puzzle_data', JSON.stringify({
                  index: currentIndex,
                  puzzleId: currentPuzzle.id,
                  startTime: puzzleStartTime,
                  isSolved: newMoveIndex >= currentPuzzle.moves.length,
                  isFailed: false,
                  moveIndex: newMoveIndex,
                  selectedMotive: selectedMotive
                }));

                // Check if puzzle is solved after computer's move
                if (newMoveIndex >= currentPuzzle.moves.length) {
                  setIsSolved(true);
                  localStorage.setItem(`puzzle-status-${currentPuzzle.id}`, 'solved');
                  localStorage.setItem(`awaiting_motive_${currentPuzzle.id}`, 'true');
                  setCompletedExercises(prev => prev + 1);

                  // Count as attempted if not already counted
                  if (!isFailed && !isSolved) {
                    setAttemptedExercises(prev => prev + 1);
                  }

                  setReplayIndex(0);
                  // Update progress with new completion count
                  updateProgress(currentIndex);
                }
              }
            } catch (error) {
              console.error("Computer move error:", error);
            }
          }, 300); // Small delay before computer move
        } else {
          // Puzzle is solved if no more computer moves
          setIsSolved(true);
            localStorage.setItem(`awaiting_motive_${currentPuzzle.id}`, 'true');
          localStorage.setItem(`puzzle-status-${currentPuzzle.id}`, 'solved');

          setCompletedExercises(prev => prev + 1);

          // Count as attempted if not already counted
          if (!isFailed && !isSolved) {
            setAttemptedExercises(prev => prev + 1);
          }

          setMoveIndex(newMoveIndex);

          setReplayIndex(0);

          // Update progress with new completion count
          updateProgress(currentIndex);
        }
      } else {
        // It's a legal move but not the correct solution
        setTotalIncorrectMoves(prev => prev + 1);
        triggerErrorAnimation();
        setIsFailed(true);
        localStorage.setItem(`awaiting_motive_${currentPuzzle.id}`, 'true');

        // Store failed state in localStorage
        localStorage.setItem('current_puzzle_data', JSON.stringify({
          index: currentIndex,
          puzzleId: currentPuzzle.id,
          startTime: puzzleStartTime,
          isSolved: false,
          isFailed: true,
          moveIndex: moveIndex,
          selectedMotive: selectedMotive
        }));

        // Count as attempted if not already
        if (!isFailed && !isSolved) {
          setAttemptedExercises(prev => prev + 1);
        }

        // Reset the game to the previous state
        game.undo();
        setGame(new Chess(game.fen()));

        // Record the elapsed time when puzzle is failed
        const timeSpent = Math.floor((Date.now() - puzzleStartTime) / 1000);
        setElapsedPuzzleTime(timeSpent);

        // Submit puzzle result to backend
        submitPuzzleResult(false);

        // Update progress
        updateProgress(currentIndex);

        return false;
      }

      // Update the game state to reflect the move
      setGame(new Chess(game.fen()));
      return true;
    } catch (error) {
      console.error("Move error:", error);
      setErrorMessage('That move is illegal.');
      triggerErrorAnimation();
      return false;
    }
  };

  // Function to handle timeup (time runs out)
  const handleTimeUp = () => {
    if (isSolved) return;

    console.log('Time up for puzzle');
    setIsFailed(true);
    localStorage.setItem(`awaiting_motive_${currentPuzzle.id}`, 'true');
    submitPuzzleResult(false)

    // Record the elapsed time
    const timeSpent = Math.floor((Date.now() - puzzleStartTime) / 1000);
    setElapsedPuzzleTime(timeSpent);

    // Count as attempted if not already
    if (!isFailed && !isSolved) {
      setAttemptedExercises(prev => prev + 1);
    }

    // Mark puzzle state as failed due to timeout
    localStorage.setItem('current_puzzle_data', JSON.stringify({
      index: currentIndex,
      puzzleId: currentPuzzle?.id,
      startTime: puzzleStartTime,
      isSolved: false,
      isFailed: true,
      failReason: 'timeout',
      moveIndex: moveIndex,
      selectedMotive: selectedMotive
    }));

    // Submit puzzle result to backend
    submitPuzzleResult(false);

    // Update progress
    updateProgress(currentIndex);
  };

  // Error animation trigger
  const triggerErrorAnimation = () => {
    setAnimateError(true);
    setTimeout(() => setAnimateError(false), 500);
  };

  // Function to submit puzzle result to backend
  const submitPuzzleResult = async (isSolved) => {
    if (!currentPuzzle || !userId || selectedMotive == null) return;

    const timeSpent = elapsedPuzzleTime || Math.floor((Date.now() - puzzleStartTime) / 1000);
    const correctMoves = movesHistory.filter(move => move.isCorrect).length;
    const incorrectMoves = movesHistory.filter(move => !move.isCorrect).length;
    const attempts = correctMoves + incorrectMoves;

    // Prepare move times data
    const moveTimes = movesHistory.map(move => ({
      uci: move.uci,
      isCorrect: move.isCorrect,
      timeSpentMs: move.timeSpentMs
    }));

    try {
      await recordPuzzleResult(
        currentPuzzle.id,
        isSolved,
        attempts,
        correctMoves,
        incorrectMoves,
        timeSpent,
        moveTimes,
        selectedMotive
      );
      console.log('Puzzle result submitted successfully');
    } catch (error) {
      console.error('Error submitting puzzle result:', error);
    }
  };

  // Function to complete the session
  const completeSession = async () => {
    if (!userId || !sessionLogId) return;

    const totalTimeSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);

    try {
      const data = await completeSessionLog(
        sessionLogId,
        totalTimeSeconds,
        completedExercises,
        totalCorrectMoves
      );
      console.log('Session completed successfully, next available at:', data.next_available_at);
    } catch (error) {
      console.error('Error completing session:', error);
    }
  };

  // Load first puzzle when exercises are loaded, or start from remembered index
  useEffect(() => {
    if (exercises.length > 0 && !puzzleInitialized) {
      setCurrentIndex(initialPuzzleIndex)
      loadPuzzle(initialPuzzleIndex);
      setPuzzleInitialized(true);
    }
  }, [exercises, puzzleInitialized, initialPuzzleIndex]);

  // Check if all exercises are completed
  useEffect(() => {
    if (completedExercises >= exercises.length && exercises.length > 0) {
      setSessionCompleted(true);
      if (onComplete) {
        onComplete({
          puzzlesCompleted: completedExercises,
          totalPuzzles: exercises.length,
        });
      }
    }
  }, [completedExercises, exercises.length, onComplete]);

  // Auto-load next puzzle when solved
  useEffect(() => {
    if (isSolved && !nextClicked && selectedMotive != null) {
      const timer = setTimeout(() => {
        handleNextPuzzle();
      });
      return () => clearTimeout(timer);
    }
  }, [isSolved, nextClicked,selectedMotive]);

  // Update when a puzzle is solved to submit the result
  useEffect(() => {
    if ((isFailed || isSolved) && currentPuzzle && selectedMotive!= null) {
      const timeSpent = Math.floor((Date.now() - puzzleStartTime) / 1000);
      setElapsedPuzzleTime(timeSpent);
      submitPuzzleResult(isSolved);
    }
  }, [selectedMotive]);


  // Submit session results when all exercises are completed
  useEffect(() => {
    if (sessionCompleted) {
      completeSession();
      if (currentPuzzle?.id) {
        localStorage.removeItem(`solution_end_${currentPuzzle.id}`);
      }
      // Clean up any timers
      const timerKey = `puzzle_timer_end_${window.location.pathname}-${120}`; // assuming 120 seconds is default
      localStorage.removeItem(timerKey);

      // Pass the final progress information to the parent component
      onComplete?.({
        puzzlesCompleted: completedExercises,
        totalPuzzles: exercises.length,
        attemptedExercises: attemptedExercises
      });
    }
  }, [sessionCompleted]);

  // Update completed puzzles tracking
  useEffect(() => {
    if (exercises && exercises.length > 0) {
      // Report progress to parent component
      updateProgress(currentIndex);
    }
  }, [completedExercises, exercises, currentIndex]);

  // Effect to handle initialization, resuming from localStorage
  useEffect(() => {
    // Set session start time
    setSessionStartTime(Date.now());

    // Check localStorage for saved state
    const savedPuzzleMoves = localStorage.getItem('current_puzzle_moves');
    const savedPuzzleData = localStorage.getItem('current_puzzle_data');
    const savedPuzzleFen = localStorage.getItem('current_puzzle_fen');
    const savedMoveTimestamps = localStorage.getItem('current_puzzle_move_timestamps');

    // Restore move timestamps if available
    if (savedMoveTimestamps) {
      try {
        const parsedTimestamps = JSON.parse(savedMoveTimestamps);
        if (Array.isArray(parsedTimestamps)) {
          setMoveTimestamps(parsedTimestamps);
        }
      } catch (error) {
        console.error('Error parsing saved move timestamps:', error);
      }
    }

    // Restore moves history if available
    if (savedPuzzleMoves) {
      try {
        const parsedMoves = JSON.parse(savedPuzzleMoves);
        if (Array.isArray(parsedMoves)) {
          setMovesHistory(parsedMoves);
        }
      } catch (error) {
        console.error('Error parsing saved moves:', error);
      }
    }

    if (savedPuzzleData && exercises && exercises.length > 0) {
      try {
        const puzzleData = JSON.parse(savedPuzzleData);

        // If the saved puzzle index is valid and within the exercises range
        if (puzzleData.index >= 0 && puzzleData.index < exercises.length) {
          setCurrentIndex(puzzleData.index);
          // First load the puzzle normally
          if (puzzleData.index !== currentIndex) {
            loadPuzzle(puzzleData.index);
          }

          const awaitingMotiveKey = `awaiting_motive_${exercises[puzzleData.index]?.id}`;
          const isAwaitingMotive = localStorage.getItem(awaitingMotiveKey) === 'true';

          if (isAwaitingMotive) {
            if (puzzleData.isSolved) {
              setIsSolved(true);
            } else if (puzzleData.isFailed) {
              setIsFailed(true);
            }
            setReplayIndex(0);
          } else {
            if (persistedStatus === 'solved') {
              setIsSolved(true);
              setReplayIndex(0);
            }
            if (persistedStatus === 'failed') {
              setIsFailed(true);
              setReplayIndex(0);
            }
          }

          if (puzzleData.moveIndex > 0) {
            setMoveIndex(puzzleData.moveIndex);
          }

          if (puzzleData.startTime) {
            setPuzzleStartTime(puzzleData.startTime);
          }

          // Restore the chess position if available
          if (savedPuzzleFen) {
            try {
              const restoredGame = new Chess(savedPuzzleFen);
              setGame(restoredGame);
            } catch (error) {
              console.error("Error restoring game position:", error);
            }
          }
        }
      } catch (error) {
        console.error("Error restoring puzzle state:", error);
      }
    }
  }, [exercises, currentIndex]);

  // Clear all timer-related localStorage when component unmounts
  useEffect(() => {
    return () => {
      // Clear all puzzle timers and state from localStorage when component unmounts
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key === 'current_puzzle_data' ||
          key === 'current_puzzle_moves' ||
          key === 'current_puzzle_fen' ||
          key === 'current_puzzle_move_timestamps'
        )) {
          localStorage.removeItem(key);
        }
      }
    };
  }, []);

  // Effect to clear timer and update localStorage when moving to a new puzzle
  useEffect(() => {
    // When puzzle index changes, clear old timer data
    if (currentPuzzle && currentPuzzle.id) {
      const timerKey = `puzzle_timer_end_${window.location.pathname}-120`; // 120 seconds is default timer
      const currentId = currentPuzzle.id;

      // Store the current puzzle ID to track puzzle changes
      const lastPuzzleId = localStorage.getItem('last_active_puzzle_id');

      if (lastPuzzleId && lastPuzzleId !== currentId.toString()) {
        // We've moved to a new puzzle, clear the old timer
        localStorage.removeItem(timerKey);
      }

      // Update the last active puzzle ID
      localStorage.setItem('last_active_puzzle_id', currentId.toString());
    }
  }, [currentPuzzle]);


  // Render completion state
  if (sessionCompleted) {
    return (
      <div className={styles.PuzzleSolver}>
        <div className={styles.sessionComplete}>
          <h1>Test Complete!</h1>
          <p>Thank you for joining our team.</p>
          <p>Your consistent approach has been invaluable to us.</p>
          <p>If you have any questions please contact us at: chesspoject.research@gmail.com</p>
        </div>
      </div>
    );
  }

    // Render loading state
  if (!exercises || exercises.length === 0) {
    return (
      <div className={styles.PuzzleSolver}>
        <div className={styles.welcome}>
          <h1>Welcome to Chess Puzzles!</h1>
          <p>Loading puzzles...</p>
        </div>
      </div>
    );
  }

return (
  <div className={styles.PuzzleSolver}>
    <PuzzleHeader currentPuzzle={currentPuzzle} isSolved={isSolved} isFailed={isFailed} />
    <div className={styles.boardContainer}>
      <PuzzleBoard
        game={game}
        orientation={currentPuzzle?.starting_color || 'white'}
        onMove={handleMove}
      />

      <div className={styles.sidePanel}>
        {/* {showSolution ? (
          <div className={styles.solutionTimer}>
            <strong>Next puzzle in: </strong>
            <span>{solutionTimer}s</span>
          </div>
        ) : ( */}
          <Timer
            key={currentPuzzle?.id || currentIndex}
            initialTime={120}
            onTimeUp={handleTimeUp}
            isRunning={!isSolved && !isFailed}
            puzzleId={currentPuzzle?.id || `puzzle_${currentIndex}`}
          />
        {/* )} */}

        <div className={styles.puzzleDetails}>
          <div className={styles.startingColor}>
            <strong>Starting color</strong>
            <span className={styles.colorText}>
              {currentPuzzle?.starting_color === 'black' ? 'Black' : 'White'}
            </span>
            <div className={styles.colorIcon}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                <path d="M2 12h20"></path>
              </svg>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div>
            <div className={`${styles.errorMessage} ${animateError ? styles.shake : ''}`}>
              {errorMessage}
            </div>
          </div>
        )}

        <div className={styles.header}>
          <div className={styles.puzzleInfo}>
            <h2>
              Puzzle {currentIndex + 1} of {exercises.length}
            </h2>
          </div>
        </div>
      </div>
    </div>

    <PuzzleStatus
      handleNextPuzzle={handleNextPuzzle}
      animateError={animateError}
      isSolved={isSolved}
      isFailed={isFailed}
      currentPuzzle={currentPuzzle}
      selectedMotive = {selectedMotive}
      setSelectedMotive = {setSelectedMotive}
    />

    <PuzzleProgress
      totalExercises={exercises.length}
      attemptedExercises={currentIndex + 1}
    />
  </div>
);
}

export default PuzzleSolver;