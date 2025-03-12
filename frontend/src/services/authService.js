import api from './api';

class AuthService {
    async login(username, password) {
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);
        const response = await api.post('/login/access-token', formData);
        return response.data;
    }

    async register(email, username, password) {
        const response = await api.post('/users/', {
            email,
            username,
            password
        });
        return response.data;
    }

    async getCurrentUser() {
        const response = await api.get('/users/me');
        return response.data;
    }

    async updateProfile(userData) {
        const response = await api.put('/users/me', userData);
        return response.data;
    }

    async forgotPassword(email) {
        const response = await api.post('/users/forgot-password', { email });
        return response.data;
    }

    async resetPassword(token, newPassword) {
        const response = await api.post('/users/reset-password', {
            token,
            new_password: newPassword
        });
        return response.data;
    }
}

export const authService = new AuthService(); 