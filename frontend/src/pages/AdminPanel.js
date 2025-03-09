import React, { useState, useEffect } from 'react';
import {
    Box,
    Container,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Switch,
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Button
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { adminService } from '../services/adminService';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import { format, formatDistanceToNow } from 'date-fns';

export default function AdminPanel() {
    const [users, setUsers] = useState([]);
    const [deleteDialog, setDeleteDialog] = useState({ open: false, userId: null, username: '' });
    const { enqueueSnackbar } = useSnackbar();

    const fetchUsers = async () => {
        try {
            const data = await adminService.getUsers();
            setUsers(data);
        } catch (err) {
            enqueueSnackbar('Failed to fetch users', { variant: 'error' });
            console.error('Error fetching users:', err);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleToggleParsePermission = async (userId) => {
        try {
            const updatedUser = await adminService.toggleParsePermission(userId);
            setUsers(users.map(user => 
                user.id === userId ? updatedUser : user
            ));
            enqueueSnackbar('Permission updated successfully', { variant: 'success' });
        } catch (err) {
            enqueueSnackbar('Failed to update permission', { variant: 'error' });
            console.error('Error updating permission:', err);
        }
    };

    const handleToggleActive = async (userId, isActive) => {
        try {
            const updatedUser = await adminService.updateUserPermissions(userId, {
                is_active: !isActive
            });
            setUsers(users.map(user => 
                user.id === userId ? updatedUser : user
            ));
            enqueueSnackbar('User status updated successfully', { variant: 'success' });
        } catch (err) {
            enqueueSnackbar('Failed to update user status', { variant: 'error' });
            console.error('Error updating user status:', err);
        }
    };

    const handleDeleteClick = (userId, username) => {
        setDeleteDialog({ open: true, userId, username });
    };

    const handleDeleteCancel = () => {
        setDeleteDialog({ open: false, userId: null, username: '' });
    };

    const handleDeleteConfirm = async () => {
        try {
            await adminService.deleteUser(deleteDialog.userId);
            setUsers(users.filter(user => user.id !== deleteDialog.userId));
            enqueueSnackbar('User deleted successfully', { variant: 'success' });
        } catch (err) {
            const errorMessage = err.response?.data?.detail || 'Failed to delete user';
            enqueueSnackbar(errorMessage, { variant: 'error' });
            console.error('Error deleting user:', err);
        } finally {
            handleDeleteCancel();
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Never';
        try {
            const date = new Date(dateString);
            const relativeTime = formatDistanceToNow(date, { addSuffix: true });
            return (
                <Tooltip title={format(date, 'dd.MM.yyyy HH:mm')}>
                    <span>{relativeTime}</span>
                </Tooltip>
            );
        } catch (err) {
            return 'Invalid date';
        }
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" component="h1">
                    User Management
                </Typography>
                <Tooltip title="Refresh users list">
                    <IconButton onClick={fetchUsers}>
                        <RefreshIcon />
                    </IconButton>
                </Tooltip>
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell width="50">#</TableCell>
                            <TableCell>Username</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell align="center">Active</TableCell>
                            <TableCell align="center">Can Parse</TableCell>
                            <TableCell align="center">Superuser</TableCell>
                            <TableCell align="right">Last Visit</TableCell>
                            <TableCell align="center">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {users.map((user, index) => (
                            <TableRow key={user.id}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>{user.username}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell align="center">
                                    <Switch
                                        checked={user.is_active}
                                        onChange={() => handleToggleActive(user.id, user.is_active)}
                                        disabled={user.is_superuser}
                                    />
                                </TableCell>
                                <TableCell align="center">
                                    <Switch
                                        checked={user.can_parse}
                                        onChange={() => handleToggleParsePermission(user.id)}
                                        disabled={user.is_superuser}
                                    />
                                </TableCell>
                                <TableCell align="center">
                                    <Switch
                                        checked={user.is_superuser}
                                        disabled={true}
                                    />
                                </TableCell>
                                <TableCell align="right">
                                    {formatDate(user.last_visit)}
                                </TableCell>
                                <TableCell align="center">
                                    <Tooltip title={user.is_superuser ? "Cannot delete superuser" : "Delete user"}>
                                        <span>
                                            <IconButton
                                                onClick={() => handleDeleteClick(user.id, user.username)}
                                                disabled={user.is_superuser}
                                                color="error"
                                                size="small"
                                            >
                                                <DeleteIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog
                open={deleteDialog.open}
                onClose={handleDeleteCancel}
            >
                <DialogTitle>Confirm Delete User</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete user "{deleteDialog.username}"? This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDeleteCancel}>Cancel</Button>
                    <Button onClick={handleDeleteConfirm} color="error" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
} 