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
} from '@mui/material';
import { MoreVert, Block, CheckCircle, Smartphone } from '@mui/icons-material';
import { getAPIBaseURL } from '../../utils/socketConfig';

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
}

interface Plan {
    id: number;
    name: string;
}

const ClientsManager: React.FC = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);

    const [openPlanDialog, setOpenPlanDialog] = useState(false);
    const [selectedPlanId, setSelectedPlanId] = useState<number | ''>('');

    useEffect(() => {
        fetchClients();
        fetchPlans();
    }, []);

    const fetchClients = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${getAPIBaseURL()}/api/clients`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setClients(data.clients);
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
                fetchClients();
                handleMenuClose();
            }
        } catch (error) {
            console.error('Error toggling block:', error);
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
                fetchClients();
                setOpenPlanDialog(false);
            }
        } catch (error) {
            console.error('Error assigning plan:', error);
        }
    };

    const openAssignPlanDialog = () => {
        setAnchorEl(null); // Close menu but keep selectedClient
        setOpenPlanDialog(true);
    }

    return (
        <Box>
            <TableContainer component={Paper} sx={{ bgcolor: '#1a1a2e', color: 'white' }}>
                <Table>
                    <TableHead sx={{ bgcolor: '#16213e' }}>
                        <TableRow>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Cliente</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Contacto</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Estado Conexión</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Plan Actual</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Estado Cuenta</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Acciones</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {clients.map((client) => (
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
                                <TableCell sx={{ color: 'white' }}>{client.plan_name || 'Sin Plan'}</TableCell>
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
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
            >
                <MenuItem onClick={openAssignPlanDialog}>Asignar Plan</MenuItem>
                <MenuItem onClick={handleToggleBlock}>
                    {selectedClient?.is_blocked ? 'Desbloquear Cliente' : 'Bloquear Cliente'}
                </MenuItem>
                {/* Edit/Delete can be added here */}
            </Menu>

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
        </Box>
    );
};

export default ClientsManager;
