import axios from 'axios';
import { API_URL } from './config';

export const registerUser = async (username, password) => {
  const response = await axios.post(`${API_URL}/users/register`, { username, password });
  return response.data;
};

export const loginUser = async (username, password) => {
  const response = await axios.post(`${API_URL}/users/login`, { username, password });
  const { access_token, user_id, username: userName } = response.data;
  localStorage.setItem('access_token', access_token);
  localStorage.setItem('user_id', user_id);
  localStorage.setItem('username', userName);
  return response.data;
};

export const logout = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user_id');
  localStorage.removeItem('username');
};