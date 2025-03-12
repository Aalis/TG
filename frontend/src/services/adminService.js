import api from './api';

class AdminService {
    async getUsers(params = new URLSearchParams()) {
        const response = await api.get(`/admin/users?${params.toString()}`);
        return response.data;
    }

    async updateUserPermissions(userId, permissions) {
        const response = await api.patch(`/admin/users/${userId}/permissions`, permissions);
        return response.data;
    }

    async toggleParsePermission(userId, canParse, duration = null) {
        const response = await api.patch(`/admin/users/${userId}/toggle-parse-permission`, {
            can_parse: canParse,
            duration: duration
        });
        return response.data;
    }

    async deleteUser(userId) {
        const response = await api.delete(`/admin/users/${userId}`);
        return response.data;
    }

    async createClientAccount() {
        const response = await api.post('/admin/users/create-client');
        return response.data;
    }
}

export const adminService = new AdminService(); 