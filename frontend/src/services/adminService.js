import api from './api';

export const adminService = {
    getUsers: async () => {
        const response = await api.get('/admin/users');
        return response.data;
    },

    updateUserPermissions: async (userId, permissions) => {
        const response = await api.patch(`/admin/users/${userId}/permissions`, permissions);
        return response.data;
    },

    toggleParsePermission: async (userId) => {
        const response = await api.patch(`/admin/users/${userId}/toggle-parse-permission`);
        return response.data;
    },

    deleteUser: async (userId) => {
        const response = await api.delete(`/admin/users/${userId}`);
        return response.data;
    }
}; 