import React from 'react';
import styles from './LogoFooter.module.css';

const LogoFooter = () => {
  return (
    <div className={styles.logoFooter}>
      <div className={styles.logoContainer}>
        <a href="https://uj.edu.pl" target="_blank" rel="noopener noreferrer">
          <div className={styles.logoWrapper}>
            <img src="/uj.png" alt="Uniwersytet Jagielloński" className={styles.logo} />
          </div>
        </a>
        <a href="https://bratniak.uj.edu.pl" target="_blank" rel="noopener noreferrer">
          <div className={styles.logoWrapper}>
            <img src="/bratniak.png" alt="Bratniak UJ" className={styles.logo} />
          </div>
        </a>
        <a href="https://pragma.org.pl" target="_blank" rel="noopener noreferrer">
          <div className={styles.logoWrapper}>
            <img src="/pragma.png" alt="Pragma" className={styles.logo} />
          </div>
        </a>
      </div>
      <div className={styles.credits}>
        <p>© 2025 Research Project</p>
      </div>
    </div>
  );
};

export default LogoFooter;