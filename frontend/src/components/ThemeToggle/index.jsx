import React, { useEffect, useState } from 'react';
import styles from './ThemeToggle.module.css';

const ThemeToggle = () => {
  // Check if user previously selected a theme
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  // Initialize state based on saved preference or system preference
  const [isDark, setIsDark] = useState(savedTheme === 'dark' || (!savedTheme && prefersDark));

  // Apply theme immediately on component mount
  useEffect(() => {
    applyTheme(isDark);
    // Also set up a listener for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      // Only apply if user hasn't set a preference
      if (!localStorage.getItem('theme')) {
        setIsDark(e.matches);
      }
    };

    // Add the listener
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else if (typeof mediaQuery.addListener === 'function') {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  // Set theme when state changes
  useEffect(() => {
    applyTheme(isDark);
  }, [isDark]);

  // Function to apply theme to document and save preference
  const applyTheme = (dark) => {
    if (dark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.classList.add('dark-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.body.classList.remove('dark-theme');
      localStorage.setItem('theme', 'light');
    }
  };

  // Toggle between light and dark themes
  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  return (
    <div className={styles.toggleContainer}>
      <button
        className={styles.themeToggle}
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <div className={`${styles.toggleTrack} ${isDark ? styles.dark : ''}`}>
          <div className={styles.icons}>
            <svg className={styles.sunIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
              <path d="M12 2V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M12 20V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M4 12L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M22 12L20 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M19.7778 4.22266L17.5558 6.25424" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M4.22217 4.22266L6.44418 6.25424" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M6.44434 17.5557L4.22211 19.7779" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M19.7778 19.7773L17.5558 17.5551" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <svg className={styles.moonIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21.0672 11.8568C20.1503 11.9507 19.2159 12.0002 18.2654 12.0002C11.5716 12.0002 6.14062 7.37634 6.14062 1.7147C6.14062 1.48343 6.14956 1.25451 6.16708 1.02832C3.80333 2.18919 2.14062 4.71302 2.14062 7.7147C2.14062 12.1334 5.7219 15.7147 10.1406 15.7147C14.1422 15.7147 17.5023 14.0775 21.0672 11.8568Z" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <div className={`${styles.toggleThumb} ${isDark ? styles.dark : ''}`}></div>
        </div>
      </button>
    </div>
  );
};

export default ThemeToggle;