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

    async toggleParsePermission(userId) {
        const response = await api.patch(`/admin/users/${userId}/toggle-parse-permission`);
        return response.data;
    }

    async deleteUser(userId) {
        const response = await api.delete(`/admin/users/${userId}`);
        return response.data;
    }
}

export const adminService = new AdminService(); 