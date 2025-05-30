import { useEffect, useState, useRef } from 'react';
import styles from './Timer.module.css';

function Timer({ initialTime, onTimeUp, isRunning, puzzleId }) {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const endTimeRef = useRef(0);
  const requestRef = useRef(null);
  const intervalRef = useRef(null);
  const lastUpdateRef = useRef(Date.now());
  const timerKey = useRef(`puzzle_timer_${puzzleId}`);

  // Initialize timer state from localStorage
  const initializeTimer = () => {
    const savedEndTime = localStorage.getItem(timerKey.current);
    const now = Date.now();

    if (savedEndTime) {
      const endTime = parseInt(savedEndTime, 10);
      if (endTime > now) {
        endTimeRef.current = endTime;
        const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
        setTimeLeft(remaining);
        return true; // Timer was restored
      }
    }
    return false; // No timer to restore
  };

  // On component mount
  useEffect(() => {
    // Try to restore timer from localStorage
    const timerRestored = initializeTimer();

    // If no timer was restored and we're running, start a new one
    if (!timerRestored && isRunning) {
      const newEndTime = Date.now() + initialTime * 1000;
      endTimeRef.current = newEndTime;
      localStorage.setItem(timerKey.current, newEndTime.toString());
    }

    // Set up interval to save timer state periodically
    intervalRef.current = setInterval(() => {
      if (isRunning && endTimeRef.current > 0) {
        localStorage.setItem(timerKey.current, endTimeRef.current.toString());
      }
    }, 1000);

    // Cleanup
    return () => {
      clearInterval(intervalRef.current);
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [initialTime, isRunning, puzzleId]);

  // Handle timer updates
  useEffect(() => {
    if (!isRunning) {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - now) / 1000));

      setTimeLeft(remaining);

      if (remaining <= 0) {
        onTimeUp();
        localStorage.removeItem(timerKey.current);
      } else {
        requestRef.current = requestAnimationFrame(updateTimer);
      }
    };

    requestRef.current = requestAnimationFrame(updateTimer);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isRunning, onTimeUp]);

  // Handle visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        initializeTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const barScale = Math.max(0, Math.min(1, timeLeft / initialTime));
  const isLowTime = timeLeft <= 30;
  const timeString = formatTime(timeLeft);

  return (
    <div className={`${styles.timer} ${isLowTime ? styles.lowTimeContainer : ''}`}>
      <div className={styles.timerLabel}>Time Remaining</div>
      <div className={styles.timerContent}>
        <div className={styles.timerProgress}>
          <div
            className={styles.timerBar}
            style={{ transform: `scaleX(${barScale})` }}
          />
        </div>
        <div className={isLowTime ? `${styles.timerText} ${styles.lowTime}` : styles.timerText}>
          {timeString}
        </div>
      </div>
      <div className={styles.timerIcon}>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      </div>
    </div>
  );
}

export default Timer;