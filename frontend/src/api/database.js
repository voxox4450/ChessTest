// Database API functions for users and sessions
import axios from 'axios';
import { API_URL, getAuthConfig } from './config';

// User related database operations
export const registerUserInDb = async (username, password) => {
  try {
    const response = await axios.post(`${API_URL}/users/register`, {
      username,
      password
    });

    return response.data;
  } catch (error) {
    console.error('Error registering user:', error);
    throw error;
  }
};

export const loginUserFromDb = async (username, password) => {
  try {
    const response = await axios.post(
      `${API_URL}/users/login`,
      {
        username,
        password
      },
      {
        validateStatus: status => {
          // Accept all status codes so we can properly handle 403 errors
          return true;
        }
      }
    );

    // If we get a 403 error (time restriction), throw the entire response
    if (response.status === 403) {
      const error = new Error('Login time restriction');
      error.response = response;
      throw error;
    }

    // If we get any other error status
    if (response.status >= 400) {
      const error = new Error(response.data.error || 'Login failed');
      error.response = response;
      throw error;
    }

    return response.data;
  } catch (error) {
    console.error('Error logging in:', error);
    throw error;
  }
};

export const updateUserSession = async (userId) => {
};


export const getExercisesForSession = async () => {
  try {
    const response = await axios.get(
      `${API_URL}/exercises_test`,
      getAuthConfig()
    );

    return response.data;
  } catch (error) {
    console.error('Error fetching exercises:', error);
    throw error;
  }
};

export const updateSessionIndex = async (currentIndex) => {
  try {
    const response = await axios.post(
      `${API_URL}/update_session_index`,
      { currentIndex },
      getAuthConfig()
    );

    return response.data;
  } catch (error) {
    console.error('Error updating session index:', error);
    throw error;
  }
};

export const getCurrentSessionIndex = async () => {
  try {
    const response = await axios.get(
      `${API_URL}/session_progress`,
      getAuthConfig()
    );
    return response.data.currentIndex || 0;
  } catch (error) {
    console.error('Error fetching session index:', error);
    return 0;
  }
};

// Session and puzzle results functions
export const createSessionLog = async (userId) => {
  try {
    const response = await axios.post(
      `${API_URL}/sessions_Log`,
      getAuthConfig()
    );

    return response.data;
  } catch (error) {
    console.error('Error creating session log:', error);
    throw error;
  }
};

export const completeSessionLog = async (sessionLogId, totalTimeSeconds, puzzlesCompleted, puzzlesSolved) => {
  try {
    const response = await axios.post(
      `${API_URL}/sessions/${sessionLogId}/complete`,
      {
        total_time_seconds: totalTimeSeconds,
        puzzles_completed: puzzlesCompleted,
        puzzles_solved: puzzlesSolved
      },
      getAuthConfig()
    );

    return response.data;
  } catch (error) {
    console.error('Error completing session log:', error);
    throw error;
  }
};

export const recordPuzzleResult = async (
  exerciseId,
  isSolved,
  attempts,
  correctMoves,
  incorrectMoves,
  timeSpentSeconds,
  moveTimes = [],
  selectedMotive = null
) => {
  try {
    const response = await axios.post(
      `${API_URL}/puzzles/results`,
      {
        exercise_id: exerciseId,
        is_solved: isSolved,
        attempts,
        correct_moves: correctMoves,
        incorrect_moves: incorrectMoves,
        time_spent_seconds: timeSpentSeconds,
        move_times: moveTimes,
        selected_motive: selectedMotive
      },
      getAuthConfig()
    );

    return response.data;
  } catch (error) {
    console.error('Error recording puzzle result:', error);
    throw error;
  }
};

export const getPuzzleMoveTimes = async (resultId) => {
  try {
    const response = await axios.get(
      `${API_URL}/puzzles/move-times/${resultId}`,
      getAuthConfig()
    );

    return response.data;
  } catch (error) {
    console.error('Error fetching puzzle move times:', error);
    throw error;
  }
};

export const getPuzzleHistory = async () => {
  try {
    const response = await axios.get(
      `${API_URL}/users/puzzle-history`,
      getAuthConfig()
    );

    return response.data;
  } catch (error) {
    console.error('Error fetching puzzle history:', error);
    throw error;
  }
};

export const getSessionHistory = async () => {
  try {
    const response = await axios.get(
      `${API_URL}/users/session-history`,
      getAuthConfig()
    );

    return response.data;
  } catch (error) {
    console.error('Error fetching session history:', error);
    throw error;
  }
};

export async function checkIfPuzzleSolved(userId, exerciseId) {
  const response = await fetch(`/api/check-puzzle-result?userId=${userId}&exerciseId=${exerciseId}`);
  if (!response.ok) {
    console.error('Failed to check puzzle result');
    return false;
  }
  const result = await response.json();
  return result.already_solved;
}
 