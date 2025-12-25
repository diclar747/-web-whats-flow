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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    CircularProgress,
    Alert,
    Snackbar
} from '@mui/material';
import { CheckCircle, Cancel, ShoppingCart } from '@mui/icons-material';
import { getAPIBaseURL } from '../../utils/socketConfig';

interface PlanRequest {
    id: number;
    phone_number: string;
    plan_id: number;
    plan_name: string;
    plan_price: number;
    duration_days: number;
    status: 'pending' | 'approved' | 'rejected';
    requested_at: string;
    plan_display_name?: string;
}

const PlanRequestsManager: React.FC = () => {
    const [requests, setRequests] = useState<PlanRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Dialogs
    const [approveDialogOpen, setApproveDialogOpen] = useState(false);
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<PlanRequest | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`${getAPIBaseURL()}/api/plan-requests?status=pending`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setRequests(data.requests || []);
            } else {
                setError(data.error || 'Error al cargar solicitudes');
            }
        } catch (error) {
            console.error('Error fetching plan requests:', error);
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!selectedRequest) return;
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`${getAPIBaseURL()}/api/plan-requests/${selectedRequest.id}/approve`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();
            if (data.success) {
                setSuccessMessage('Solicitud aprobada exitosamente');
                setApproveDialogOpen(false);
                fetchRequests();
            } else {
                setError(data.error || 'Error al aprobar solicitud');
            }
        } catch (error) {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async () => {
        if (!selectedRequest) return;
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`${getAPIBaseURL()}/api/plan-requests/${selectedRequest.id}/reject`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reason: rejectionReason })
            });
            const data = await response.json();
            if (data.success) {
                setSuccessMessage('Solicitud rechazada');
                setRejectDialogOpen(false);
                fetchRequests();
            } else {
                setError(data.error || 'Error al rechazar solicitud');
            }
        } catch (error) {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                    Solicitudes de Planes Pendientes
                </Typography>
                <Button variant="outlined" onClick={fetchRequests} disabled={loading}>
                    Actualizar
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

            <TableContainer component={Paper} sx={{ bgcolor: '#1a1a2e', color: 'white' }}>
                <Table>
                    <TableHead sx={{ bgcolor: '#16213e' }}>
                        <TableRow>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Fecha</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Teléfono</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Plan</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Monto</TableCell>
                            <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold' }}>Acciones</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading && requests.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'white' }}>
                                    <CircularProgress size={24} />
                                </TableCell>
                            </TableRow>
                        ) : requests.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'white' }}>
                                    No hay solicitudes pendientes
                                </TableCell>
                            </TableRow>
                        ) : (
                            requests.map((request) => (
                                <TableRow key={request.id} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                                    <TableCell sx={{ color: 'white' }}>{new Date(request.requested_at).toLocaleString()}</TableCell>
                                    <TableCell sx={{ color: 'white' }}>{request.phone_number}</TableCell>
                                    <TableCell sx={{ color: 'white' }}>
                                        <Chip label={request.plan_name} size="small" color="primary" variant="outlined" />
                                    </TableCell>
                                    <TableCell sx={{ color: 'white' }}>Gs. {Number(request.plan_price).toLocaleString()}</TableCell>
                                    <TableCell align="center">
                                        <Button
                                            startIcon={<CheckCircle />}
                                            color="success"
                                            onClick={() => {
                                                setSelectedRequest(request);
                                                setApproveDialogOpen(true);
                                            }}
                                            sx={{ mr: 1 }}
                                        >
                                            Aprobar
                                        </Button>
                                        <Button
                                            startIcon={<Cancel />}
                                            color="error"
                                            onClick={() => {
                                                setSelectedRequest(request);
                                                setRejectDialogOpen(true);
                                            }}
                                        >
                                            Rechazar
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Approve Dialog */}
            <Dialog
                open={approveDialogOpen}
                onClose={() => setApproveDialogOpen(false)}
                PaperProps={{
                    sx: {
                        bgcolor: '#1a1a2e',
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }
                }}
            >
                <DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Confirmar Aprobación</DialogTitle>
                <DialogContent sx={{ mt: 2 }}>
                    <Typography sx={{ color: 'white' }}>
                        ¿Estás seguro de que deseas aprobar la solicitud de <strong>{selectedRequest?.phone_number}</strong> para el plan <strong>{selectedRequest?.plan_name}</strong>?
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1, color: 'rgba(255,255,255,0.6)' }}>
                        Esto activará el plan por {selectedRequest?.duration_days} días y notificará al cliente por WhatsApp.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <Button onClick={() => setApproveDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.7)' }}>Cancelar</Button>
                    <Button onClick={handleApprove} color="success" variant="contained" disabled={loading}>
                        {loading ? <CircularProgress size={20} /> : 'Aprobar Plan'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog
                open={rejectDialogOpen}
                onClose={() => setRejectDialogOpen(false)}
                PaperProps={{
                    sx: {
                        bgcolor: '#1a1a2e',
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }
                }}
            >
                <DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Rechazar Solicitud</DialogTitle>
                <DialogContent sx={{ mt: 2 }}>
                    <Typography sx={{ mb: 2, color: 'white' }}>
                        ¿Por qué deseas rechazar la solicitud de {selectedRequest?.phone_number}?
                    </Typography>
                    <TextField
                        fullWidth
                        label="Motivo del rechazo"
                        multiline
                        rows={3}
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Ej: Comprobante de pago inválido"
                        InputLabelProps={{ style: { color: 'rgba(255,255,255,0.7)' } }}
                        inputProps={{ style: { color: 'white' } }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' }
                            }
                        }}
                    />
                </DialogContent>
                <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <Button onClick={() => setRejectDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.7)' }}>Cancelar</Button>
                    <Button onClick={handleReject} color="error" variant="contained" disabled={loading}>
                        {loading ? <CircularProgress size={20} /> : 'Rechazar'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={!!successMessage}
                autoHideDuration={4000}
                onClose={() => setSuccessMessage(null)}
                message={successMessage}
            />
        </Box>
    );
};

export default PlanRequestsManager;
