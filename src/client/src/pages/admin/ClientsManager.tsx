import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Button,
    Chip,
    IconButton,
    Menu,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    TextField,
    Alert,
    Snackbar,
} from '@mui/material';
import { MoreVert, Block, CheckCircle, Smartphone, Search, Edit, Delete, PersonAdd, Message, Lock, Visibility, VisibilityOff, NotificationsActive, Campaign } from '@mui/icons-material';
import { getAPIBaseURL } from '../../utils/socketConfig';
import { BulkNotificationDialog } from './components/BulkNotificationDialog';

interface Client {
    id: number;
    name: string;
    email: string;
    phone: string;
    status: string;
    is_blocked: boolean;
    is_connected: boolean; // Computed from backend
    last_seen: string;
    plan_name: string;
    plan_id: number;
    plan_expires_at: string;
}

interface Plan {
    id: number;
    name: string;
}

const ClientsManager: React.FC = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [filteredClients, setFilteredClients] = useState<Client[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [plans, setPlans] = useState<Plan[]>([]);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);

    const [openPlanDialog, setOpenPlanDialog] = useState(false);
    const [selectedPlanId, setSelectedPlanId] = useState<number | ''>('');

    const [openEditDialog, setOpenEditDialog] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [editFormData, setEditFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        plan_expires_at: ''
    });

    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [openSmsDialog, setOpenSmsDialog] = useState(false);
    const [openBulkDialog, setOpenBulkDialog] = useState(false);
    const [smsAmount, setSmsAmount] = useState<number | ''>('');
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

    useEffect(() => {
        fetchClients();
        fetchPlans();
    }, []);

    useEffect(() => {
        // Filtrar clientes cuando cambia el término de búsqueda
        if (searchTerm.trim() === '') {
            setFilteredClients(clients);
        } else {
            const filtered = clients.filter(client =>
                client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                client.phone.includes(searchTerm)
            );
            setFilteredClients(filtered);
        }
    }, [searchTerm, clients]);

    const fetchClients = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${getAPIBaseURL()}/api/clients`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setClients(data.clients);
                setFilteredClients(data.clients);
            }
        } catch (error) {
            console.error('Error fetching clients:', error);
        }
    };

    const fetchPlans = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${getAPIBaseURL()}/api/plans`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setPlans(data.plans);
            }
        } catch (error) {
            console.error('Error fetching plans:', error);
        }
    };

    const handleMenuClick = (event: React.MouseEvent<HTMLElement>, client: Client) => {
        setAnchorEl(event.currentTarget);
        setSelectedClient(client);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setSelectedClient(null);
    };

    const handleToggleBlock = async () => {
        if (!selectedClient) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${getAPIBaseURL()}/api/clients/${selectedClient.id}/block`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ blocked: !selectedClient.is_blocked })
            });
            const data = await response.json();
            if (data.success) {
                showSnackbar(`Cliente ${selectedClient.is_blocked ? 'desbloqueado' : 'bloqueado'} exitosamente`, 'success');
                fetchClients();
                handleMenuClose();
            }
        } catch (error) {
            console.error('Error toggling block:', error);
            showSnackbar('Error al cambiar estado del cliente', 'error');
        }
    };

    const handleAssignPlan = async () => {
        if (!selectedClient || !selectedPlanId) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${getAPIBaseURL()}/api/clients/${selectedClient.id}/assign-plan`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ plan_id: selectedPlanId })
            });
            const data = await response.json();
            if (data.success) {
                showSnackbar('Plan asignado exitosamente', 'success');
                fetchClients();
                setOpenPlanDialog(false);
            }
        } catch (error) {
            console.error('Error assigning plan:', error);
            showSnackbar('Error al asignar plan', 'error');
        }
    };

    const openAssignPlanDialog = () => {
        setAnchorEl(null);
        setOpenPlanDialog(true);
    };

    const openAssignSmsDialog = () => {
        setAnchorEl(null);
        setSmsAmount('');
        setOpenSmsDialog(true);
    };

    const openEditClientDialog = () => {
        if (!selectedClient) return;
        setEditFormData({
            name: selectedClient.name,
            email: selectedClient.email,
            phone: selectedClient.phone,
            password: '',
            plan_expires_at: selectedClient.plan_expires_at ? selectedClient.plan_expires_at.split('T')[0] : ''
        });
        setAnchorEl(null);
        setOpenEditDialog(true);
        setShowPassword(false);
    };

    const handleEditClient = async () => {
        if (!selectedClient) return;
        if (!editFormData.name || !editFormData.email || !editFormData.phone) {
            showSnackbar('Todos los campos son obligatorios', 'error');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${getAPIBaseURL()}/api/clients/${selectedClient.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(editFormData)
            });
            const data = await response.json();
            if (data.success) {
                showSnackbar('Cliente actualizado exitosamente', 'success');
                fetchClients();
                setOpenEditDialog(false);
                setSelectedClient(null);
            } else {
                showSnackbar(data.error || 'Error al actualizar cliente', 'error');
            }
        } catch (error) {
            console.error('Error editing client:', error);
            showSnackbar('Error al actualizar cliente', 'error');
        }
    };

    const openConfirmDeleteDialog = () => {
        setAnchorEl(null);
        setOpenDeleteDialog(true);
    };

    const handleDeleteClient = async () => {
        if (!selectedClient) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${getAPIBaseURL()}/api/clients/${selectedClient.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (data.success) {
                showSnackbar('Cliente eliminado exitosamente', 'success');
                fetchClients();
                setOpenDeleteDialog(false);
                setSelectedClient(null);
            } else {
                showSnackbar(data.error || 'Error al eliminar cliente', 'error');
            }
        } catch (error) {
            console.error('Error deleting client:', error);
            showSnackbar('Error al eliminar cliente', 'error');
        }
    };

    const handleAssignSms = async () => {
        if (!selectedClient || smsAmount === '' || Number(smsAmount) <= 0) {
            showSnackbar('Ingrese una cantidad válida', 'error');
            return;
        }
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${getAPIBaseURL()}/api/clients/${selectedClient.id}/assign-sms`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ amount: Number(smsAmount) })
            });
            const data = await response.json();
            if (data.success) {
                showSnackbar(`Se han asignado ${smsAmount} SMS exitosamente`, 'success');
                fetchClients();
                setOpenSmsDialog(false);
            } else {
                showSnackbar(data.error || 'Error al asignar saldo', 'error');
            }
        } catch (error) {
            console.error('Error assigning SMS:', error);
            showSnackbar('Error al conectar con el servidor', 'error');
        }
    };

    const handleSendExpirationNotification = async () => {
        if (!selectedClient) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${getAPIBaseURL()}/api/clients/${selectedClient.id}/notify-expiration`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (data.success) {
                showSnackbar(data.message || 'Notificación enviada exitosamente', 'success');
                handleMenuClose();
            } else {
                showSnackbar(data.error || 'Error al enviar notificación', 'error');
            }
        } catch (error) {
            console.error('Error sending notification:', error);
            showSnackbar('Error al conectar con el servidor', 'error');
        }
    };

    const showSnackbar = (message: string, severity: 'success' | 'error') => {
        setSnackbar({ open: true, message, severity });
    };

    const handleCloseSnackbar = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    return (
        <Box>
            {/* Barra de búsqueda */}
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <TextField
                    fullWidth
                    placeholder="Buscar clientes por nombre, email o teléfono..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: <Search sx={{ color: 'rgba(255,255,255,0.5)', mr: 1 }} />
                    }}
                    sx={{
                        bgcolor: '#1a1a2e',
                        borderRadius: 2,
                        '& .MuiOutlinedInput-root': {
                            color: 'white',
                            '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                            '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                            '&.Mui-focused fieldset': { borderColor: '#25D366' }
                        }
                    }}
                />
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', minWidth: 150, textAlign: 'right' }}>
                    {filteredClients.length} de {clients.length} clientes
                </Typography>
                <Button 
                    variant="contained" 
                    startIcon={<Campaign />} 
                    onClick={() => setOpenBulkDialog(true)}
                    sx={{ bgcolor: '#eab308', '&:hover': { bgcolor: '#ca8a04' }, color: 'black', fontWeight: 'bold' }}
                >
                    Notificaciones
                </Button>
            </Box>

            <TableContainer component={Paper} sx={{ bgcolor: '#1a1a2e', color: 'white' }}>
                <Table>
                    <TableHead sx={{ bgcolor: '#16213e' }}>
                        <TableRow>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Cliente</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Contacto</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Estado Conexión</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Plan Actual / Vencimiento</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Estado Cuenta</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Acciones</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredClients.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'rgba(255,255,255,0.5)' }}>
                                    {searchTerm ? 'No se encontraron clientes que coincidan con la búsqueda' : 'No hay clientes registrados'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredClients.map((client) => (
                                <TableRow key={client.id} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                                    <TableCell>
                                        <Typography variant="subtitle2" sx={{ color: 'white' }}>{client.name}</Typography>
                                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>{client.email}</Typography>
                                    </TableCell>
                                    <TableCell sx={{ color: 'white' }}>{client.phone}</TableCell>
                                    <TableCell>
                                        {client.is_connected ? (
                                            <Chip icon={<CheckCircle />} label="Conectado" color="success" size="small" />
                                        ) : (
                                            <Chip icon={<Smartphone />} label="Desconectado" color="default" size="small" sx={{ color: 'rgba(255,255,255,0.7)' }} />
                                        )}
                                    </TableCell>
                                    <TableCell sx={{ color: 'white' }}>
                                        <Typography variant="body2">{client.plan_name || 'Sin Plan'}</Typography>
                                        {client.plan_expires_at && (
                                            <Box>
                                                {new Date(client.plan_expires_at) < new Date() ? (
                                                    <Chip
                                                        label={`Vencido: ${new Date(client.plan_expires_at).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
                                                        size="small"
                                                        sx={{
                                                            mt: 0.5,
                                                            bgcolor: 'rgba(244, 67, 54, 0.1)',
                                                            color: '#f44336',
                                                            border: '1px solid rgba(244, 67, 54, 0.3)',
                                                            height: 20,
                                                            fontSize: '0.7rem'
                                                        }}
                                                    />
                                                ) : (
                                                    <Chip
                                                        label={`Vence: ${new Date(client.plan_expires_at).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
                                                        size="small"
                                                        sx={{
                                                            mt: 0.5,
                                                            bgcolor: 'rgba(76, 175, 80, 0.1)',
                                                            color: '#4caf50',
                                                            border: '1px solid rgba(76, 175, 80, 0.3)',
                                                            height: 20,
                                                            fontSize: '0.7rem'
                                                        }}
                                                    />
                                                )}
                                            </Box>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {client.is_blocked ? (
                                            <Chip label="Bloqueado" color="error" size="small" />
                                        ) : (
                                            <Chip label="Activo" color="primary" size="small" />
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <IconButton onClick={(e) => handleMenuClick(e, client)} sx={{ color: 'white' }}>
                                            <MoreVert />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Menú de acciones */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                PaperProps={{
                    sx: { bgcolor: '#1a1a2e', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }
                }}
            >
                <MenuItem onClick={openEditClientDialog}>
                    <Edit sx={{ mr: 1, fontSize: 20 }} /> Editar Cliente
                </MenuItem>
                <MenuItem onClick={openAssignPlanDialog}>
                    <PersonAdd sx={{ mr: 1, fontSize: 20 }} /> Asignar Plan
                </MenuItem>
                <MenuItem onClick={openAssignSmsDialog}>
                    <Message sx={{ mr: 1, fontSize: 20 }} /> Asignar Saldo SMS
                </MenuItem>
                <MenuItem onClick={handleSendExpirationNotification}>
                    <NotificationsActive sx={{ mr: 1, fontSize: 20 }} /> Enviar Notificación Vencimiento
                </MenuItem>
                <MenuItem onClick={handleToggleBlock}>
                    <Block sx={{ mr: 1, fontSize: 20 }} /> {selectedClient?.is_blocked ? 'Desbloquear Cliente' : 'Bloquear Cliente'}
                </MenuItem>
                <MenuItem onClick={openConfirmDeleteDialog} sx={{ color: '#f44336' }}>
                    <Delete sx={{ mr: 1, fontSize: 20 }} /> Eliminar Cliente
                </MenuItem>
            </Menu>

            {/* Diálogo de Editar Cliente */}
            <Dialog
                open={openEditDialog}
                onClose={() => setOpenEditDialog(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        bgcolor: '#1a1a2e',
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }
                }}
            >
                <DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    Editar Cliente
                </DialogTitle>
                <DialogContent sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label="Nombre"
                            fullWidth
                            value={editFormData.name}
                            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                            sx={{
                                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                                '& .MuiOutlinedInput-root': {
                                    color: 'white',
                                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                                    '&.Mui-focused fieldset': { borderColor: '#25D366' }
                                }
                            }}
                        />
                        <TextField
                            label="Email"
                            type="email"
                            fullWidth
                            value={editFormData.email}
                            onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                            sx={{
                                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                                '& .MuiOutlinedInput-root': {
                                    color: 'white',
                                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                                    '&.Mui-focused fieldset': { borderColor: '#25D366' }
                                }
                            }}
                        />
                        <TextField
                            label="Teléfono"
                            fullWidth
                            value={editFormData.phone}
                            onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                            sx={{
                                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                                '& .MuiOutlinedInput-root': {
                                    color: 'white',
                                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                                    '&.Mui-focused fieldset': { borderColor: '#25D366' }
                                }
                            }}
                        />
                        <FormControl variant="outlined" fullWidth>
                            <TextField
                                label="Nueva Contraseña (Opcional)"
                                type={showPassword ? 'text' : 'password'}
                                fullWidth
                                value={editFormData.password}
                                onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                                sx={{
                                    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                                    '& .MuiOutlinedInput-root': {
                                        color: 'white',
                                        '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                                        '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                                        '&.Mui-focused fieldset': { borderColor: '#25D366' }
                                    }
                                }}
                                InputProps={{
                                    endAdornment: (
                                        <IconButton
                                            onClick={() => setShowPassword(!showPassword)}
                                            edge="end"
                                            sx={{ color: 'rgba(255,255,255,0.7)' }}
                                        >
                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    )
                                }}
                            />
                        </FormControl>
                        <TextField
                            label="Fecha de Vencimiento del Plan"
                            type="date"
                            fullWidth
                            value={editFormData.plan_expires_at}
                            onChange={(e) => setEditFormData({ ...editFormData, plan_expires_at: e.target.value })}
                            InputLabelProps={{ shrink: true }}
                            sx={{
                                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                                '& .MuiOutlinedInput-root': {
                                    color: 'white',
                                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                                    '&.Mui-focused fieldset': { borderColor: '#25D366' }
                                }
                            }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <Button onClick={() => setOpenEditDialog(false)} sx={{ color: 'rgba(255,255,255,0.7)' }}>Cancelar</Button>
                    <Button onClick={handleEditClient} variant="contained" sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1da851' } }}>Guardar</Button>
                </DialogActions>
            </Dialog>

            {/* Diálogo de Asignar Plan */}
            <Dialog
                open={openPlanDialog}
                onClose={() => setOpenPlanDialog(false)}
                PaperProps={{
                    sx: {
                        bgcolor: '#1a1a2e',
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }
                }}
            >
                <DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    Asignar Plan a {selectedClient?.name}
                </DialogTitle>
                <DialogContent sx={{ minWidth: 300, mt: 2 }}>
                    <FormControl fullWidth sx={{ mt: 1 }}>
                        <InputLabel sx={{ color: 'rgba(255,255,255,0.7)' }}>Seleccionar Plan</InputLabel>
                        <Select
                            value={selectedPlanId}
                            label="Seleccionar Plan"
                            onChange={(e) => setSelectedPlanId(Number(e.target.value))}
                            sx={{
                                color: 'white',
                                '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                                '.MuiSvgIcon-root': { color: 'white' }
                            }}
                        >
                            {plans.map(p => (
                                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <Button onClick={() => setOpenPlanDialog(false)} sx={{ color: 'rgba(255,255,255,0.7)' }}>Cancelar</Button>
                    <Button onClick={handleAssignPlan} variant="contained">Asignar</Button>
                </DialogActions>
            </Dialog>

            {/* Diálogo de Asignar Saldo SMS */}
            <Dialog
                open={openSmsDialog}
                onClose={() => setOpenSmsDialog(false)}
                PaperProps={{
                    sx: {
                        bgcolor: '#1a1a2e',
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }
                }}
            >
                <DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    Asignar Saldo SMS a {selectedClient?.name}
                </DialogTitle>
                <DialogContent sx={{ minWidth: 300, mt: 2 }}>
                    <Typography variant="body2" sx={{ mb: 2, color: 'rgba(255,255,255,0.7)' }}>
                        Ingrese la cantidad de mensajes SMS a recargar al usuario.
                    </Typography>
                    <TextField
                        fullWidth
                        type="number"
                        label="Cantidad de SMS"
                        value={smsAmount}
                        onChange={(e) => setSmsAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        sx={{
                            mt: 1,
                            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                            '& .MuiOutlinedInput-root': {
                                color: 'white',
                                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                                '&.Mui-focused fieldset': { borderColor: '#25D366' }
                            }
                        }}
                    />
                </DialogContent>
                <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <Button onClick={() => setOpenSmsDialog(false)} sx={{ color: 'rgba(255,255,255,0.7)' }}>Cancelar</Button>
                    <Button onClick={handleAssignSms} variant="contained" sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1da851' } }}>Asignar Saldo</Button>
                </DialogActions>
            </Dialog>

            {/* Diálogo de Confirmación de Eliminación */}
            <Dialog
                open={openDeleteDialog}
                onClose={() => setOpenDeleteDialog(false)}
                PaperProps={{
                    sx: {
                        bgcolor: '#1a1a2e',
                        color: 'white',
                        border: '1px solid rgba(255,0,0,0.3)'
                    }
                }}
            >
                <DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#f44336' }}>
                    ⚠️ Confirmar Eliminación
                </DialogTitle>
                <DialogContent sx={{ mt: 2 }}>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                        ¿Estás seguro de que deseas eliminar al cliente <strong>{selectedClient?.name}</strong>?
                    </Typography>
                    <Alert severity="warning" sx={{ bgcolor: 'rgba(255,152,0,0.1)', color: '#ff9800' }}>
                        Esta acción no se puede deshacer. Se eliminarán todos los datos asociados al cliente.
                    </Alert>
                </DialogContent>
                <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <Button onClick={() => setOpenDeleteDialog(false)} sx={{ color: 'rgba(255,255,255,0.7)' }}>Cancelar</Button>
                    <Button onClick={handleDeleteClient} variant="contained" color="error">Eliminar Cliente</Button>
                </DialogActions>
            </Dialog>

            {/* Diálogo de Notificaciones Masivas */}
            <BulkNotificationDialog 
                open={openBulkDialog} 
                onClose={() => setOpenBulkDialog(false)} 
                users={clients} 
            />

            {/* Snackbar de notificaciones */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default ClientsManager;
