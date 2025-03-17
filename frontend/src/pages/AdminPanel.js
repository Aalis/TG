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
    Button,
    Chip,
    TextField,
    InputAdornment,
    TablePagination,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { adminService } from '../services/adminService';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import TimerIcon from '@mui/icons-material/Timer';
import SearchIcon from '@mui/icons-material/Search';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { format, formatDistanceToNow, isPast } from 'date-fns';

const PARSE_DURATIONS = [
    { value: '1_hour', label: '1 Hour', icon: <AccessTimeIcon /> },
    { value: '1_day', label: '1 Day', icon: <AccessTimeIcon /> },
    { value: '5_days', label: '5 Days', icon: <AccessTimeIcon /> },
    { value: '20_days', label: '20 Days', icon: <AccessTimeIcon /> },
];

export default function AdminPanel() {
    const [users, setUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteDialog, setDeleteDialog] = useState({ open: false, userId: null, username: '' });
    const [page, setPage] = useState(0);
    const [totalUsers, setTotalUsers] = useState(0);
    const [newClientDialog, setNewClientDialog] = useState({ open: false, credentials: null });
    const [parseMenuAnchor, setParseMenuAnchor] = useState(null);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const rowsPerPage = 10;
    const { enqueueSnackbar } = useSnackbar();

    const fetchUsers = async (search = searchQuery, currentPage = page) => {
        try {
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            params.append('skip', (currentPage * rowsPerPage).toString());
            params.append('limit', rowsPerPage.toString());
            const { data, total } = await adminService.getUsers(params);
            setUsers(data);
            setTotalUsers(total);
        } catch (err) {
            enqueueSnackbar('Failed to fetch users', { variant: 'error' });
            console.error('Error fetching users:', err);
        }
    };

    useEffect(() => {
        fetchUsers();
        const interval = setInterval(() => fetchUsers(), 60000);
        return () => clearInterval(interval);
    }, [page]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setPage(0);
            fetchUsers(searchQuery, 0);
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    const handleSearchChange = (event) => {
        setSearchQuery(event.target.value);
    };

    const handlePageChange = (event, newPage) => {
        setPage(newPage);
    };

    const handleCreateClient = async () => {
        try {
            const credentials = await adminService.createClientAccount();
            setNewClientDialog({ open: true, credentials });
            await fetchUsers();
            enqueueSnackbar('Client account created successfully', { variant: 'success' });
        } catch (err) {
            enqueueSnackbar('Failed to create client account', { variant: 'error' });
            console.error('Error creating client account:', err);
        }
    };

    const handleCopyCredentials = (text) => {
        navigator.clipboard.writeText(text);
        enqueueSnackbar('Copied to clipboard', { variant: 'success' });
    };

    const handleToggleParsePermission = async (userId, currentValue, event) => {
        if (!currentValue) {
            // Opening menu to enable parsing with duration
            setSelectedUserId(userId);
            setParseMenuAnchor(event.currentTarget);
        } else {
            // Directly disable parsing
            try {
                const updatedUser = await adminService.toggleParsePermission(userId, false);
                setUsers(users.map(user => 
                    user.id === userId ? updatedUser : user
                ));
                enqueueSnackbar('Parse permission disabled', { variant: 'success' });
            } catch (err) {
                enqueueSnackbar('Failed to update permission', { variant: 'error' });
                console.error('Error updating permission:', err);
            }
        }
    };

    const handleSelectDuration = async (duration) => {
        try {
            const updatedUser = await adminService.toggleParsePermission(selectedUserId, true, duration);
            setUsers(users.map(user => 
                user.id === selectedUserId ? updatedUser : user
            ));
            enqueueSnackbar('Parse permission enabled', { variant: 'success' });
        } catch (err) {
            enqueueSnackbar('Failed to update permission', { variant: 'error' });
            console.error('Error updating permission:', err);
        } finally {
            setParseMenuAnchor(null);
            setSelectedUserId(null);
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

    const formatParsePermission = (user) => {
        if (!user.can_parse) return 'Disabled';
        if (!user.parse_permission_expires) return 'Enabled';

        const expiryDate = new Date(user.parse_permission_expires);
        if (isPast(expiryDate)) {
            return (
                <Chip
                    label="Expired"
                    color="error"
                    size="small"
                    icon={<TimerIcon />}
                />
            );
        }

        return (
            <Tooltip title={`Expires ${format(expiryDate, 'dd.MM.yyyy HH:mm')}`}>
                <Chip
                    label={`${formatDistanceToNow(expiryDate)} left`}
                    color="success"
                    size="small"
                    icon={<TimerIcon />}
                />
            </Tooltip>
        );
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" component="h1">
                    User Management
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Button
                        variant="contained"
                        startIcon={<PersonAddIcon />}
                        onClick={handleCreateClient}
                    >
                        Create Client Account
                    </Button>
                    <TextField
                        size="small"
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                        }}
                    />
                    <Tooltip title="Refresh users list">
                        <IconButton onClick={() => fetchUsers()}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
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
                            <TableCell align="center">Parse Status</TableCell>
                            <TableCell align="center">Superuser</TableCell>
                            <TableCell align="right">Last Visit</TableCell>
                            <TableCell align="center">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {users.map((user, index) => (
                            <TableRow key={user.id}>
                                <TableCell>{page * rowsPerPage + index + 1}</TableCell>
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
                                        onChange={(e) => handleToggleParsePermission(user.id, user.can_parse, e)}
                                        disabled={user.is_superuser}
                                    />
                                </TableCell>
                                <TableCell align="center">
                                    {formatParsePermission(user)}
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
                                    <IconButton
                                        color="error"
                                        onClick={() => handleDeleteClick(user.id, user.username)}
                                        disabled={user.is_superuser}
                                    >
                                        <DeleteIcon />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <TablePagination
                    component="div"
                    count={totalUsers}
                    page={page}
                    onPageChange={handlePageChange}
                    rowsPerPage={rowsPerPage}
                    rowsPerPageOptions={[rowsPerPage]}
                />
            </TableContainer>

            <Dialog
                open={deleteDialog.open}
                onClose={handleDeleteCancel}
            >
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete user "{deleteDialog.username}"? This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDeleteCancel}>Cancel</Button>
                    <Button onClick={handleDeleteConfirm} color="error">Delete</Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={newClientDialog.open}
                onClose={() => setNewClientDialog({ open: false, credentials: null })}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>New Client Account Created</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Please save these credentials. You won't be able to see them again:
                    </DialogContentText>
                    <Box sx={{ mt: 2, mb: 2 }}>
                        <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="body1">
                                    <strong>Username:</strong> {newClientDialog.credentials?.username}
                                </Typography>
                                <IconButton 
                                    size="small"
                                    onClick={() => handleCopyCredentials(newClientDialog.credentials?.username)}
                                >
                                    <ContentCopyIcon fontSize="small" />
                                </IconButton>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body1">
                                    <strong>Password:</strong> {newClientDialog.credentials?.password}
                                </Typography>
                                <IconButton 
                                    size="small"
                                    onClick={() => handleCopyCredentials(newClientDialog.credentials?.password)}
                                >
                                    <ContentCopyIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        </Paper>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button 
                        onClick={() => handleCopyCredentials(
                            `Username: ${newClientDialog.credentials?.username}\nPassword: ${newClientDialog.credentials?.password}`
                        )}
                    >
                        Copy All
                    </Button>
                    <Button 
                        onClick={() => setNewClientDialog({ open: false, credentials: null })}
                        variant="contained"
                    >
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Parse Duration Menu */}
            <Menu
                anchorEl={parseMenuAnchor}
                open={Boolean(parseMenuAnchor)}
                onClose={() => {
                    setParseMenuAnchor(null);
                    setSelectedUserId(null);
                }}
            >
                {PARSE_DURATIONS.map((duration) => (
                    <MenuItem 
                        key={duration.value}
                        onClick={() => handleSelectDuration(duration.value)}
                    >
                        <ListItemIcon>
                            {duration.icon}
                        </ListItemIcon>
                        <ListItemText primary={duration.label} />
                    </MenuItem>
                ))}
            </Menu>
        </Container>
    );
} 