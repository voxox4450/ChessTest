import config from '../config';

// Force production URL in deployed environment
const API_BASE = process.env.NODE_ENV === 'production'
  ? 'https://chesskhbackend.azurewebsites.net/api'
  : `${config.apiBaseUrl}/api`;

export const API_URL = API_BASE;

export const getAuthConfig = () => {
    const token = localStorage.getItem('access_token');
    return {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };
};