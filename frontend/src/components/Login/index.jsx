import { useState, useEffect } from 'react';
import { loginUser } from '../../api/users';
import { registerUserInDb, loginUserFromDb } from '../../api/database';
import ThemeToggle from '../ThemeToggle';
import styles from './Login.module.css';
import { AgreementText, InformationText } from './texts';


const Login = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [nextAvailableTime, setNextAvailableTime] = useState(null);
    const [hoursLeft, setHoursLeft] = useState(0);
    const [minutesLeft, setMinutesLeft] = useState(0);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [isRegistering, setIsRegistering] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showConsentText, setShowConsentText] = useState(true);
    const [showResearchInfoModal, setShowResearchInfoModal] = useState(false);
    const [consentAccepted, setConsentAccepted] = useState(true);
    const [hasReadInfo, setHasReadInfo] = useState(false);
    const [checkboxAccepted, setCheckboxAccepted] = useState(false);

    useEffect(() => {
  let interval;

  if (nextAvailableTime) {
    interval = setInterval(() => {
      const now = new Date();
      const diff = nextAvailableTime - now;

      if (diff <= 0) {
        clearInterval(interval);
        setNextAvailableTime(null);
        setHoursLeft(0);
        setMinutesLeft(0);
        setSecondsLeft(0);
        setError('');
      } else {
        const totalSeconds = Math.floor(diff / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        setHoursLeft(hours);
        setMinutesLeft(minutes);
        setSecondsLeft(seconds);
      }
    }, 1000);
  }

  return () => clearInterval(interval);
}, [nextAvailableTime]);
    
    const handleSwitchToRegister = () => {
        setIsRegistering(true);
        setError('');
        setNextAvailableTime(null);
        setShowResearchInfoModal(true);
    };


    const handleCloseResearchInfoModal = () => {
        setShowResearchInfoModal(false);
        setHasReadInfo(true);
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
    
        // Email format regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
        // Check consent if registering
        if (isRegistering && !consentAccepted) {
            setError('You must read and accept the research information first');
            return;
        }
    
        // Validate email (username)
        if (!emailRegex.test(username)) {
            setError('Please enter a valid email address.');
            return;
        }
    
        setLoading(true);
        setError('');
        setNextAvailableTime(null);
        setHoursLeft(0);
    
        try {
            if (isRegistering) {
                const userData = await registerUserInDb(username, password);
                localStorage.setItem('access_token', userData.access_token);
                localStorage.setItem('user_id', userData.user_id);
                localStorage.setItem('username', userData.username);
                console.log(`User registered: ${username}`);
                onLoginSuccess();
            } else {
                try {
                    const userData = await loginUserFromDb(username, password);
                    localStorage.setItem('access_token', userData.access_token);
                    localStorage.setItem('user_id', userData.user_id);
                    localStorage.setItem('username', userData.username);
                    if (userData.next_available_at) {
                        localStorage.setItem('next_available_at', userData.next_available_at);
                    }
                    console.log(`User logged in: ${username}`);
                    onLoginSuccess();
                } catch (dbError) {
                    console.warn('Direct DB login failed:', dbError);
                    if (dbError.response && dbError.response.status === 403) {
                    const errorData = dbError.response.data;

                    if (errorData.error?.includes("24 hours")) {
                    const now = new Date();
                    const availableAt = new Date(now.getTime() + (errorData.hours_left || 0) * 60 * 60 * 1000);
                    setNextAvailableTime(availableAt);
                    setError(errorData.error);
                    return;
                    }

                    // Domyślna wiadomość błędu 403
                    setError(errorData.error || 'You are not allowed to login yet.');
                    return;
                    
                    } else {
                        console.warn('Trying API login');
                        try {
                            await loginUser(username, password);
                            onLoginSuccess();
                        } catch (apiError) {
                            console.error('API login failed:', apiError);
                            setError('Invalid username or password');
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Login/Registration error:', err);
            setError(isRegistering ? 'Registration failed' : 'Invalid username or password');
        } finally {
            setLoading(false);
        }
    };
    
    const formatNextAvailable = () => {
        if (!nextAvailableTime) return '';
        return nextAvailableTime.toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };


    return (
        <div className={styles.loginContainer}>
            <div className={styles.appTitleContainer}>
                <h1 className={styles.appTitle}>Chess Research Project Test</h1>
                <div className={styles.themeToggleWrapper}>
                    <ThemeToggle />
                </div>
            </div>


            {showResearchInfoModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalContent}>
                           <InformationText />
                            <button
                                type="button"
                                onClick={handleCloseResearchInfoModal}
                                className={styles.modalButton}
                            >
                                I Understand
                            </button>
                        </div>
                    </div>
                </div>
            )}


            <form onSubmit={handleSubmit} className={styles.loginForm}>
                <h2>{isRegistering ? 'Register' : 'Login'}</h2>


                {error && (
                <div className={styles.error}>
                    <p>{error}</p>
                    {nextAvailableTime && (
                    <p style={{ marginTop: '0.5rem', color: '#ffcc00' }}>
                        You can log in in {hoursLeft}h {minutesLeft}m {secondsLeft}s.
                    </p>
                    )}
                </div>
                )}


                <div className={styles.inputGroup}>
                    <input
                        type="text"
                        placeholder="Email Address"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={loading || showResearchInfoModal}
                        required
                    />
                </div>
                <div className={styles.inputGroup}>
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading || showResearchInfoModal}
                        required
                    />
                </div>


                {isRegistering && hasReadInfo && (
                    <div className={styles.consentGroup}>
                        <div style={{color:'red', fontSize:'1.2em'}}><b>Important Reminder: Please Save Your Password!</b></div>
                        <input
                            type="checkbox"
                            id="consent"
                            name="consent"
                            checked={checkboxAccepted}
                            onChange={() => setCheckboxAccepted(!checkboxAccepted)}
                            required
                        />
                        <div /* onClick={() => setShowConsentText(!showConsentText)} */>
                            I agree to participate in the study and give consent. <span className={styles.expandIcon}>{showConsentText /* ? '▲' : '▼' */}</span>
                        </div>
                        {showConsentText && (
                            <div className={styles.consentText}>
                                <AgreementText />
                            </div>
                        )}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading || (isRegistering && !checkboxAccepted)}
                    className={styles.submitButton}
                >
                    {loading ? 'Processing...' : (
                        <>
                            <svg className={styles.chessIcon} viewBox="0 0 24 24" width="24" height="24">
                                <path d="M19,22H5V20H19V22M17,10H12V15H7V10H2L12,0L22,10H17M7,15H17V17H7V15Z" fill="white" />
                            </svg>
                            {isRegistering ? 'Register' : 'Login'}
                        </>
                    )}
                </button>
{/* 
                <div className={styles.switchModeContainer}>

                    <button
                        type="button"
                        onClick={isRegistering ? () => setIsRegistering(false) : handleSwitchToRegister}
                        className={styles.switchModeButton}
                        disabled={loading || showResearchInfoModal}
                    >
                        {/* {isRegistering ? 'Already have an account? Login' : 'New? Register'}
                    </button>
                
                </div>
                */}
            </form>
        </div>
    );
};


export default Login;