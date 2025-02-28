import axios from 'axios';
import { API_URL } from '../config';

const telegramSessionsAPI = {
  // Get all sessions for the current user
  getSessions: async () => {
    const response = await axios.get(`${API_URL}/telegram-sessions`);
    return response.data;
  },

  // Add a new session
  addSession: async (phoneNumber) => {
    const response = await axios.post(`${API_URL}/telegram-sessions`, { phone_number: phoneNumber });
    return response.data;
  },

  // Delete a session
  deleteSession: async (sessionId) => {
    const response = await axios.delete(`${API_URL}/telegram-sessions/${sessionId}`);
    return response.data;
  },

  // Update session status
  updateSessionStatus: async (sessionId, isActive) => {
    const response = await axios.patch(`${API_URL}/telegram-sessions/${sessionId}`, {
      is_active: isActive
    });
    return response.data;
  }
};

export default telegramSessionsAPI; 