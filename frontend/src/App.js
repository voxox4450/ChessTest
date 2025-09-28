import styles from './App.module.css';
import stylesPuzzle from './components/PuzzleSolver/PuzzleSolver.module.css';
import Login from './components/Login';
import PuzzleSolver from './components/PuzzleSolver';
import LogoutModal from './components/LogoutModal';
import StudyCompleted from './components/StudyCompleted';
import ThemeToggle from './components/ThemeToggle';
import LogoFooter from './components/LogoFooter';

import { logout } from './api/users';
import { useState, useEffect } from 'react';
import { getExercisesForSession, createSessionLog, getCurrentSessionIndex, updateSessionIndex, getUserGroupFromDb} from './api/database';


function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState({
    userId: null,
    username: '',
  });
  const [headerMenu, setHeadermenu] = useState(true);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [lastSessionTime, setLastSessionTime] = useState(null);
  const [sessionLogId, setSessionLogId] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [sessionProgress, setSessionProgress] = useState({
    puzzlesCompleted: 0,
    totalPuzzles: 0,
    currentPuzzleIndex: 0
  });
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [surveyLink, setSurveyLink] = useState(null);


  const toggleMenu = () => {
    setHeadermenu(!headerMenu);
  };

  // Restore user session from localStorage on initial load
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      restoreUserSession();
    }
  }, []);

  // Load exercises when user starts a session
  useEffect(() => {
    if (sessionActive) {
      loadExercisesForCurrentSession();
    }
  }, [sessionActive]);

  useEffect(() => {
  const fetchGroupId = async () => {
    try {
      const groupId = await getUserGroupFromDb();

      const links = {
        1: "https://ipsuj.qualtrics.com/jfe/form/SV_8x0kpMpDdQBowxU",
        2: "https://ipsuj.qualtrics.com/jfe/form/SV_bekMqRvrqNPf3wy",
        3: "https://ipsuj.qualtrics.com/jfe/form/SV_77NqMTqwt0lpwCa",
        4: "https://ipsuj.qualtrics.com/jfe/form/SV_d5VkCieSsD8yBGS"
      };

      setSurveyLink(links[groupId]);
    } catch (error) {
      console.error("Failed to fetch group ID:", error);
    }
  };

  if (!sessionActive) {
    fetchGroupId();
  }
}, [sessionActive]);

  // Restore user session from localStorage
  const restoreUserSession = () => {
    const userId = localStorage.getItem('user_id');
    const username = localStorage.getItem('username');
    const lastSessionCompleted = localStorage.getItem('last_session_time');
    const savedPuzzleIndex = localStorage.getItem('current_puzzle_index');
    const savedPuzzlesCompleted = localStorage.getItem('puzzles_completed');

    setUserInfo({
      userId,
      username
        });

    if (lastSessionCompleted) {
      setLastSessionTime(new Date(lastSessionCompleted));
    }

    if (savedPuzzleIndex || savedPuzzlesCompleted) {
      setSessionProgress({
        puzzlesCompleted: savedPuzzlesCompleted ? Number(savedPuzzlesCompleted) : 0,
        totalPuzzles: 0, 
        currentPuzzleIndex: savedPuzzleIndex ? Number(savedPuzzleIndex) : 0
      });
    }

    const wasSessionActive = localStorage.getItem('session_active') === 'true';

    if (wasSessionActive) {
      const savedSessionLogId = localStorage.getItem('session_log_id');
      if (savedSessionLogId) {
        setSessionLogId(savedSessionLogId);
      }

      setSessionActive(true);
      setShowInstructions(false);
      const savedStartTime = localStorage.getItem('session_start_time');
      if (savedStartTime) {
        setSessionStartTime(Number(savedStartTime));
      } else {
        setSessionStartTime(Date.now());
      }
    } else if (wasSessionActive) {
      localStorage.removeItem('session_active');
    }

    setIsLoggedIn(true);
    console.log(`User session restored: ${username}`);
  }

  const loadExercisesForCurrentSession = async () => {
    setLoading(true);
    try {
            const exerciseData = await getExercisesForSession(
        userInfo.userId,
        userInfo.username
      );
            const currentIndex = await getCurrentSessionIndex();
      console.log('Exercises data received from API:', exerciseData);
      console.log('Current session index:', currentIndex);
      setExercises(exerciseData);
      setCurrentIndex(currentIndex);

      // Update total puzzles in session progress
      setSessionProgress(prev => ({
        ...prev,
        totalPuzzles: exerciseData.length
      }));

      console.log(`Loaded ${exerciseData.length} exercises`);
    } catch (error) {
      console.error('Error loading exercises:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    // If session is active, show the confirmation modal
    if (sessionActive) {
      setShowLogoutModal(true);
    } else {
      // If no active session, proceed with logout immediately
      performLogout();
    }
  };

  // Function to actually perform the logout
  const performLogout = async () => {
    // If there's an active session, complete it before logging out
    if (sessionActive && sessionLogId) {
      try {
        await completeAndAdvanceSession();
      } catch (error) {
        console.error('Error completing session during logout:', error);
      }
    }

    // Proceed with logout
    logout();
    resetAppState();

    // Clear session-related localStorage items
    localStorage.removeItem('current_puzzle_index');
    localStorage.removeItem('puzzles_completed');
    localStorage.removeItem('session_active');
    localStorage.removeItem('session_log_id');
    localStorage.removeItem('session_start_time');
  };

  // Reset the application state after logout
  const resetAppState = () => {
    setIsLoggedIn(false);
    setSessionActive(false);
    setShowInstructions(true);
    setUserInfo({
      userId: null,
      username: '',
    });
    setExercises([]);
    localStorage.removeItem('last_session_time');
    setLastSessionTime(null);
    setSessionLogId(null);
    setShowLogoutModal(false);
  }

  // Function to cancel logout
  const cancelLogout = () => {
    setShowLogoutModal(false);
  };

  const handleLoginSuccess = () => {
    restoreUserSession();
  };

  // When user finishes a session, update to the next one
  const handleSessionComplete = async (progress = {}) => {
    if (!userInfo.userId) return;

    // Update session progress with the final values
    setSessionProgress(progress);

    try {

      const now = new Date();
      localStorage.setItem('last_session_time', now.toISOString());
      setLastSessionTime(now);

      setUserInfo(prev => ({
        ...prev,
      }));
      localStorage.removeItem('current_puzzle_index');
      localStorage.removeItem('puzzles_completed');
      localStorage.removeItem('session_active');
      localStorage.removeItem('session_log_id');
      localStorage.removeItem('session_start_time');

      console.log(`Session completed. Advanced to session`);

      setSessionActive(false);
      setShowInstructions(false);

    } catch (error) {
      console.error('Error updating session:', error);

      setSessionActive(false);
      setShowInstructions(false);
    }
  };



  // Add handler to update progress during session
  const handleProgressUpdate = (progress) => {
    // Store current progress in localStorage
    if (progress.currentPuzzleIndex !== undefined) {
      localStorage.setItem('current_puzzle_index', progress.currentPuzzleIndex);
    }

    if (progress.puzzlesCompleted !== undefined) {
      localStorage.setItem('puzzles_completed', progress.puzzlesCompleted);
    }

    setSessionProgress(progress);
  };

  const startSession = async () => {
    if (!userInfo.userId) return;

  
    try {
      const sessionLog = await createSessionLog(userInfo.userId);
      setSessionLogId(sessionLog.session_log_id);
  
      localStorage.setItem('session_log_id', sessionLog.session_log_id);
  
      const startTime = Date.now();
      setSessionStartTime(startTime);
  
      localStorage.setItem('session_start_time', startTime);
      localStorage.setItem('session_active', 'true');
  
      setShowInstructions(false);
      setSessionActive(true);
    } catch (error) {
      console.error('Error creating session log:', error);
      
      if (error.response && error.response.data && error.response.data.error) {
        alert(`Session error: ${error.response.data.error}`);
        return;
      }
      
      setShowInstructions(false);
      setSessionActive(true);
  
      localStorage.setItem('session_active', 'true');
      localStorage.setItem('session_start_time', Date.now());
    }
  };

  // Check if 24 hours have passed since the last session
  const canStartNextSession = () => {
    if (!lastSessionTime) return true;

    const now = new Date();
    const hoursSinceLastSession = (now - lastSessionTime) / (1000 * 60 * 60);
    return hoursSinceLastSession >= 24;
  };


  // Common session info for LogoutModal
  const getSessionInfo = () => ({
    puzzlesCompleted: sessionProgress.puzzlesCompleted,
    totalPuzzles: sessionProgress.totalPuzzles || exercises.length
  });

  // Render the logout modal
  const renderLogoutModal = (sessionInfo = null) => (
    <LogoutModal
      isOpen={showLogoutModal}
      onConfirm={performLogout}
      onCancel={cancelLogout}
    />
  );

  // Get user initials for profile icon
  const getUserInitials = () => {
    if (!userInfo.username) return '?';
    return userInfo.username.charAt(0).toUpperCase();
  };

  // Render user info panel
  const renderUserInfoPanel = () => (
    <div className={styles.userInfoPanel}>
      <div className={styles.profileIcon}>{getUserInitials()}</div>
      <h3>Welcome, {userInfo.username}!</h3>
      <button onClick={handleLogout} className={styles.logoutButton}>Logout</button>
    </div>
  );

  // Render header with theme toggle and user info
  const renderHeader = () => (
    <div className={styles.headerBar}>
      <div className={styles.userProfile}>
        <div className={styles.profileIcon}>{getUserInitials()}</div>
        <div className={styles.userInfo}>
          <span>User: {userInfo.username}</span>
        </div>
      </div>
      <div className={styles.appTitle}>Chess Research Project Test</div>
      <div className={styles.headerActions}>
        <ThemeToggle />
        <button onClick={handleLogout} className={styles.logoutButton}>Logout</button>
      </div>
    </div>
  );

  // User is not logged in
  if (!isLoggedIn) {
    return (
      <div className={styles.appWrapper}>
        {renderLogoutModal()}
        <Login onLoginSuccess={handleLoginSuccess} />
        <LogoFooter />
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className={styles.appWrapper}>
        {renderLogoutModal(getSessionInfo())}
        <div className={styles.headerBar}>
          <div className={styles.userProfile}>
            <div className={styles.profileIcon}>{getUserInitials()}</div>
            <div className={styles.userInfo}>
              <span>User: {userInfo.username}</span>
            </div>
          </div>
          <div className={styles.appTitle}>Chess Research Project Test</div>
          <div className={styles.headerActions}>
            <ThemeToggle />
            <button onClick={handleLogout} className={styles.logoutButton}>Logout</button>
          </div>
        </div>
        <div className={styles.loadingContainer}>
          <div className={styles.loader}></div>
          <h2>Loading puzzle exercises...</h2>
        </div>
        <LogoFooter />
      </div>
    );
  }

  // Show instructions screen
  if (!sessionActive && showInstructions) {
    const waitTimeLeft = lastSessionTime && !canStartNextSession() ?
      Math.ceil(24 - ((new Date() - lastSessionTime) / (1000 * 60 * 60))) : 0;

    return (
      <div className={styles.appWrapper}>
        {renderLogoutModal(getSessionInfo())}
        <div className={styles.headerBar}>
          <div className={styles.userProfile}>
            <div className={styles.profileIcon}>{getUserInitials()}</div>
            <div className={styles.userInfo}>
              <span>User: {userInfo.username}</span>
            </div>
          </div>
          <div className={styles.headerActions}>
            <ThemeToggle />
            <button onClick={handleLogout} className={styles.logoutButton}>Logout</button>
          </div>
        </div>
        <div className={styles.instructionsContainer}>
          <div className={styles.instructions}>
            <h2>Instructions</h2>
            <div className={`${styles.instructionsContent} dark-mode-card`}>
              <h3>Test Overview</h3>
                <p>
                  You will <strong>complete the final test.</strong> Your task is to solve chess puzzles, just like in the training sessions. 
                  <strong>Try to solve as many puzzles correctly as possible.</strong>
                </p>
              <h3>Solving Rules</h3>
                <p>Every puzzle has only one correct solution. You have <strong>2 minutes to solve each puzzle</strong> – during this time, depending on the task, <strong>you will need to make between one and three moves.</strong> You have only one attempt to find the correct solution, so think carefully before making a move.</p>

              <h3>Feedback</h3>
                <p>This time,<strong> you will not receive feedback </strong> on whether your solution is correct or not. The test may include <strong>puzzles you solved during training sessions and new ones.</strong></p>

              <h3>Test Duration</h3>
                <p>The test will take you a <strong> maximum of 60 minutes. There are no scheduled breaks during the final test.</strong> Please complete the test at one time.</p>

              <h3>Contact</h3>
                <p>For questions about the study, please contact the researchers at: <strong>chessproject.research@gmail.com</strong></p>
              {/* <p><strong><span>After completing 5 training sessions, you will be asked via email to participate in the final test.</span></strong><span>&nbsp;</span></p> */}
              {/* {isLastSession && (
                <div className={styles.finalSessionNote}>
                  <p><strong>Note:</strong> This is your final session in the study. Thank you for your participation!</p>
                </div>
              )} */}

            </div>

            { lastSessionTime ? (
              <div>

              </div>
            ) : (
              <div className={styles.startPrompt}>
                <h3>Are you ready to begin?</h3>
                <button
                  onClick={startSession}
                  className={styles.startSessionButton}
                >
                  Yes, I'm ready
                </button>
              </div>
            )}
          </div>
        </div>
        <LogoFooter />
      </div>
    );
  }

// Display user info and session start button
if (!sessionActive) {
  return (
    <div className={styles.appWrapper}>
      {renderLogoutModal(getSessionInfo())}
      <div className={styles.headerBar}>
        <div className={styles.userProfile}>
          <div className={styles.profileIcon}>{getUserInitials()}</div>
          <div className={styles.userInfo}>
            <span>User: {userInfo.username}</span>
          </div>
        </div>
        <div className={styles.appTitle}>Chess Research Project Test</div>
        <div className={styles.headerActions}>
          <ThemeToggle />
          <button onClick={handleLogout} className={styles.logoutButton}>Logout</button>
        </div>
      </div>
      <div>
        <div className={stylesPuzzle.PuzzleSolver}>
          <div className={stylesPuzzle.sessionComplete}>
            <h1>Test Complete!</h1>
            <p>Thank you for completing the test. As the final step, please complete a short survey by clicking the following link:</p>
            {surveyLink ? (
            <p>
              <a href={surveyLink} target="_blank" rel="noopener noreferrer">
                → Click here to take the survey ←
              </a>
            </p>
          ) : (
            <p>Loading your personalized survey link...</p>
          )}
            <p>If you have any questions please contact us at: chessproject.research@gmail.com</p>
          </div>
        </div>
        <LogoFooter />
      </div>
    </div>
  );
}


  // Render the PuzzleSolver with the loaded exercises
  return (
    <div className={styles.appWrapper}>
      {renderLogoutModal(getSessionInfo())}
      <div className={styles.appContainer}>
        {/* <button onClick={toggleMenu}>Toggle Menu</button> */}
        {headerMenu && (
          <div className={styles.headerBar} style={{ position: 'relative' }}>
            <>
              <div className={styles.userProfile}>
                <div className={styles.profileIcon}>{getUserInitials()}</div>
                <div className={styles.userInfo}>
                  <span>User: {userInfo.username}</span>
                </div>
              </div>
              <div className={styles.appTitle}>Chess Research Project Test</div>
              <div className={styles.headerActions}>
                <ThemeToggle />
                <button onClick={handleLogout} className={styles.logoutButton}>Logout</button>
              </div>
            </>
          </div>
        )}
        <div className={styles.puzzleSolverContainer}>
          <PuzzleSolver
            exercises={exercises}
            onComplete={handleSessionComplete}
            onProgressUpdate={handleProgressUpdate}
            userId={userInfo.userId}
            sessionLogId={sessionLogId}
            initialPuzzleIndex={sessionProgress.currentPuzzleIndex}
            updateSessionIndex={updateSessionIndex}
          />
        </div>
      </div>
      <LogoFooter />
    </div>
  );
}

export default App;