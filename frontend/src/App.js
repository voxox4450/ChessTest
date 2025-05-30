import styles from './App.module.css';
import Login from './components/Login';
import PuzzleSolver from './components/PuzzleSolver';
import LogoutModal from './components/LogoutModal';
import StudyCompleted from './components/StudyCompleted';
import ThemeToggle from './components/ThemeToggle';
import LogoFooter from './components/LogoFooter';

import { logout } from './api/users';
import { useState, useEffect } from 'react';
import { updateUserSession, getExercisesForSession, createSessionLog, completeSessionLog } from './api/database';

// Maximum number of sessions in the study
const MAX_SESSIONS = 5;

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState({
    userId: null,
    username: '',
    groupId: null,
    currentSession: null
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
    if (sessionActive && userInfo.groupId && userInfo.currentSession) {
      loadExercisesForCurrentSession();
    }
  }, [sessionActive, userInfo.groupId, userInfo.currentSession]);


  // Restore user session from localStorage
  const restoreUserSession = () => {
    const userId = localStorage.getItem('user_id');
    const username = localStorage.getItem('username');
    const groupId = localStorage.getItem('group_id');
    const currentSession = localStorage.getItem('current_session');
    const lastSessionCompleted = localStorage.getItem('last_session_time');
    const savedPuzzleIndex = localStorage.getItem('current_puzzle_index');
    const savedPuzzlesCompleted = localStorage.getItem('puzzles_completed');

    let validatedSession = Number(currentSession);
    if (isNaN(validatedSession) || validatedSession < 1) {
      validatedSession = 1;
      localStorage.setItem('current_session', '1');
    } else if (validatedSession > MAX_SESSIONS) {
      validatedSession = MAX_SESSIONS + 1;
      localStorage.setItem('current_session', validatedSession.toString());
    }

    setUserInfo({
      userId,
      username,
      groupId: Number(groupId),
      currentSession: validatedSession
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

    if (wasSessionActive && validatedSession <= MAX_SESSIONS) {
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
    } else if (wasSessionActive && validatedSession > MAX_SESSIONS) {
      localStorage.removeItem('session_active');
    }

    setIsLoggedIn(true);
    console.log(`User session restored: ${username}, Group: ${groupId}, Session: ${validatedSession}`);
  }

  const loadExercisesForCurrentSession = async () => {
    if (!userInfo.groupId || !userInfo.currentSession) return;

    // If user has completed all sessions, don't load exercises
    if (userInfo.currentSession > MAX_SESSIONS) {
      setExercises([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const exerciseData = await getExercisesForSession(
        userInfo.groupId,
        userInfo.currentSession
      );
      console.log('Exercises data received from API:', exerciseData);
      setExercises(exerciseData);

      // Update total puzzles in session progress
      setSessionProgress(prev => ({
        ...prev,
        totalPuzzles: exerciseData.length
      }));

      console.log(`Loaded ${exerciseData.length} exercises for Group ${userInfo.groupId}, Session ${userInfo.currentSession}`);
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
      groupId: null,
      currentSession: null
    });
    setExercises([]);
    localStorage.removeItem('last_session_time');
    setLastSessionTime(null);
    setSessionLogId(null);
    setShowLogoutModal(false);
  }

  // Complete current session and advance to next
  const completeAndAdvanceSession = async () => {
    const totalTimeSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);

    try {
      await completeSessionLog(
        sessionLogId,
        totalTimeSeconds,
        sessionProgress.puzzlesCompleted,
        Math.min(sessionProgress.puzzlesCompleted, sessionProgress.totalPuzzles)
      );

      let newSession = userInfo.currentSession;
      if (userInfo.currentSession < MAX_SESSIONS) {
        newSession = await updateUserSession(userInfo.userId);
      }

      const now = new Date();
      localStorage.setItem('last_session_time', now.toISOString());
      localStorage.setItem('current_session', newSession);
      localStorage.removeItem('current_puzzle_index');
      localStorage.removeItem('puzzles_completed');
      localStorage.removeItem('session_active');
      localStorage.removeItem('session_log_id');
      localStorage.removeItem('session_start_time');

      console.log(`Session completed during logout. Advanced to session ${newSession}`);
      return newSession;
    } catch (error) {
      console.error('Error completing session:', error);
      return userInfo.currentSession;
    }
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
      let newSession = userInfo.currentSession;

      if (userInfo.currentSession < MAX_SESSIONS) {
        newSession = await updateUserSession(userInfo.userId);
      }

      const now = new Date();
      localStorage.setItem('last_session_time', now.toISOString());
      setLastSessionTime(now);

      setUserInfo(prev => ({
        ...prev,
        currentSession: newSession
      }));
      localStorage.setItem('current_session', newSession);
      localStorage.removeItem('current_puzzle_index');
      localStorage.removeItem('puzzles_completed');
      localStorage.removeItem('session_active');
      localStorage.removeItem('session_log_id');
      localStorage.removeItem('session_start_time');

      console.log(`Session completed. Advanced to session ${newSession}`);

      setSessionActive(false);
      setShowInstructions(true);
      setSessionProgress({
        puzzlesCompleted: 0,
        totalPuzzles: 0,
        currentPuzzleIndex: 0
      });
    } catch (error) {
      console.error('Error updating session:', error);
      setSessionActive(false);
      setShowInstructions(true);
      setSessionProgress({
        puzzlesCompleted: 0,
        totalPuzzles: 0,
        currentPuzzleIndex: 0
      });
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
    if (!userInfo.userId || !userInfo.currentSession) return;
    
    if (userInfo.currentSession > MAX_SESSIONS) {
      console.log("All sessions completed, cannot start a new session");
      return;
    }
  
    try {
      const sessionLog = await createSessionLog(userInfo.userId, userInfo.currentSession);
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

    // If the user has completed all sessions, they can't start a new one
    if (userInfo.currentSession > MAX_SESSIONS) return false;

    const now = new Date();
    const hoursSinceLastSession = (now - lastSessionTime) / (1000 * 60 * 60);
    return hoursSinceLastSession >= 24;
  };

  // Check if the user has completed all sessions
  const hasCompletedAllSessions = () => {
    return userInfo.currentSession > MAX_SESSIONS;
  };

  // Common session info for LogoutModal
  const getSessionInfo = () => ({
    currentSession: userInfo.currentSession,
    maxSessions: MAX_SESSIONS,
    puzzlesCompleted: sessionProgress.puzzlesCompleted,
    totalPuzzles: sessionProgress.totalPuzzles || exercises.length
  });

  // Render the logout modal
  const renderLogoutModal = (sessionInfo = null) => (
    <LogoutModal
      isOpen={showLogoutModal}
      onConfirm={performLogout}
      onCancel={cancelLogout}
      sessionInfo={sessionInfo}
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
      <p>Group: {userInfo.groupId}</p>
      <p>Session: {userInfo.currentSession} of {MAX_SESSIONS}</p>
      <button onClick={handleLogout} className={styles.logoutButton}>Logout</button>
    </div>
  );

  // Render header with theme toggle and user info
  const renderHeader = () => (
    <div className={styles.headerBar}>
      <div className={styles.userProfile}>
        <div className={styles.profileIcon}>{getUserInitials()}</div>
        <div className={styles.userInfo}>
          <span>User: {userInfo.username} | Group: {userInfo.groupId} | Session: {userInfo.currentSession}/{MAX_SESSIONS}</span>
        </div>
      </div>
      <div className={styles.appTitle}>Chess Research Project</div>
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

  // User has completed all sessions
  if (hasCompletedAllSessions()) {
    return (
      <div className={styles.appWrapper}>
        <div className={styles.headerBar}>
          <div className={styles.userProfile}>
            <div className={styles.profileIcon}>{getUserInitials()}</div>
            <div className={styles.userInfo}>
              <span>User: {userInfo.username}</span>
            </div>
          </div>
          <div className={styles.appTitle}>Chess Research Project</div>
          <div className={styles.headerActions}>
            <ThemeToggle />
            <button onClick={handleLogout} className={styles.logoutButton}>Logout</button>
          </div>
        </div>
        <StudyCompleted
          username={userInfo.username}
          onLogout={performLogout}
        />
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
              <span>User: {userInfo.username} | Group: {userInfo.groupId} | Session: {userInfo.currentSession}/{MAX_SESSIONS}</span>
            </div>
          </div>
          <div className={styles.appTitle}>Chess Research Project</div>
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

    const isLastSession = userInfo.currentSession === MAX_SESSIONS;

    return (
      <div className={styles.appWrapper}>
        {renderLogoutModal(getSessionInfo())}
        <div className={styles.headerBar}>
          <div className={styles.userProfile}>
            <div className={styles.profileIcon}>{getUserInitials()}</div>
            <div className={styles.userInfo}>
              <span>User: {userInfo.username} | Group: {userInfo.groupId} | Session: {userInfo.currentSession}/{MAX_SESSIONS}</span>
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
              <ol>
                <li><span>The training program consists of </span><strong><span>5 learning sessions</span></strong><span>, during which you will solve chess puzzles.&nbsp;</span><span>&nbsp;</span></li>
              </ol>
              <ol>
                <li><strong><span>A</span></strong><strong><span>fter completing each session, you must wait 24 hours before beginning the next one.</span></strong><span> Once it becomes </span><strong><span>available, you will have another 24 hours to complete it. </span></strong><span>You will receive a reminder via email when it is time for your next session.</span><span>&nbsp;</span></li>
              </ol>
              <ol>
                <li><span>At the top of the page, there will be a countdown timer and the motive name of the current task.</span><span>&nbsp;</span></li>
              </ol>
              <ol>
                <li><span>During each session, try to </span><strong><span>solve as many puzzles correctly as possible</span></strong><span>.</span><span>&nbsp;</span></li>
              </ol>
              <ol>
                <li><span>Every exercise has </span><strong><span>only one correct solution</span></strong><span>.</span><span>&nbsp;</span></li>
              </ol>
              <ol>
                <li><span>You have </span><strong><span>2 minutes to solve each puzzle</span></strong> <span>&ndash; in that time </span><strong><span>you will need to make </span></strong><strong><span>between one and three moves.</span></strong><span>&nbsp;</span></li>
              </ol>
              <ol>
                <li><span>You have only </span><strong><span>one attempt to solve the puzzle</span></strong><span>, so think carefully before making a move.</span><span>&nbsp;</span></li>
              </ol>
              <ol>
                <li><span>If you make a </span><strong><span>mistake</span></strong><span>, you will </span><strong><span>receive feedback</span></strong> <span>with the correct solution</span><strong><span>. You can review it by clicking the arrows next to the chessboard</span></strong><span>. You will </span><strong><span>have 45 seconds</span></strong> <span>to study the correct moves &ndash; use this time to memorize the solution.</span><span>&nbsp;</span></li>
              </ol>
              <ol>
                <li><span>Each learning session can last up to 60 minutes &ndash; </span><strong><span>there are no scheduled breaks during the session</span></strong><span>. Please complete the session at one time.&nbsp;</span><span>&nbsp;</span></li>
              </ol>
              <ol>
                <li><span>At the top of the page, you can see the number of your current session.</span><span>&nbsp;</span></li>
              </ol>
              <ol>
                <li><span>For questions about the study, please contact the researchers at: </span><span><b><span>chesspoject.research@gmail.com</span></b> </span><span>&nbsp;</span></li>
              </ol>
              <p><strong><span>After completing 5 training sessions, you will be asked via email to participate in the final test.</span></strong><span>&nbsp;</span></p>
              {isLastSession && (
                <div className={styles.finalSessionNote}>
                  <p><strong>Note:</strong> This is your final session in the study. Thank you for your participation!</p>
                </div>
              )}

            </div>

            {userInfo.currentSession > 1 && lastSessionTime && !canStartNextSession() ? (
              <div className={styles.waitMessage}>
                <h3>Please wait before starting the next session</h3>
                <p>You need to wait at least 24 hourss between sessions.</p>
                <p>Time remaining: approximately {waitTimeLeft} hour{waitTimeLeft !== 1 ? 's' : ''}</p>
              </div>
            ) : (
              <div className={styles.startPrompt}>
                <h3>Are you ready to begin?</h3>
                <button
                  onClick={startSession}
                  className={styles.startSessionButton}
                  disabled={userInfo.currentSession > 1 && !canStartNextSession()}
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
    const isLastSession = userInfo.currentSession === MAX_SESSIONS;

    return (
      <div className={styles.appWrapper}>
        {renderLogoutModal(getSessionInfo())}
        <div className={styles.headerBar}>
          <div className={styles.userProfile}>
            <div className={styles.profileIcon}>{getUserInitials()}</div>
            <div className={styles.userInfo}>
              <span>User: {userInfo.username} | Group: {userInfo.groupId} | Session: {userInfo.currentSession}/{MAX_SESSIONS}</span>
            </div>
          </div>
          <div className={styles.appTitle}>Chess Research Project</div>
          <div className={styles.headerActions}>
            <ThemeToggle />
            <button onClick={handleLogout} className={styles.logoutButton}>Logout</button>
          </div>
        </div>
        <div className={styles.sessionStart}>
          <div className={styles.startSessionContainer}>
            <h2>Chess Puzzle Training</h2>
            {isLastSession && (
              <div className={styles.finalSessionNote}>
                <p><strong>Note:</strong> This is your final session in the study. Thank you for your participation!</p>
              </div>
            )}
            <p>Ready to solve some chess puzzles?</p>
            <button
              onClick={() => setShowInstructions(true)}
              className={styles.instructionsButton}
            >
              View Instructions
            </button>
            <button
              onClick={startSession}
              className={styles.startSessionButton}
              disabled={userInfo.currentSession > 1 && !canStartNextSession()}
            >
              Start Puzzle Session
            </button>
          </div>
        </div>
        <LogoFooter />
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
                  <span>User: {userInfo.username} | Group: {userInfo.groupId} | Session: {userInfo.currentSession}/{MAX_SESSIONS}</span>
                </div>
              </div>
              <div className={styles.appTitle}>Chess Research Project</div>
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
            sessionId={userInfo.currentSession}
            sessionLogId={sessionLogId}
            initialPuzzleIndex={sessionProgress.currentPuzzleIndex}
          />
        </div>
      </div>
      <LogoFooter />
    </div>
  );
}

export default App;