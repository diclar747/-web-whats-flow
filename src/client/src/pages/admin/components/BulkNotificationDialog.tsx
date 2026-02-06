
import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Checkbox,
    FormControlLabel,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Typography,
    Box,
    CircularProgress,
    Alert
} from '@mui/material';
import { getAPIBaseURL } from '../../../utils/socketConfig';

interface User {
    id: number;
    name: string;
    phone: string;
    email: string;
}

interface BulkNotificationDialogProps {
    open: boolean;
    onClose: () => void;
    users: User[]; // List of available users to select from
}

export const BulkNotificationDialog: React.FC<BulkNotificationDialogProps> = ({ open, onClose, users }) => {
    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [sendEmail, setSendEmail] = useState(true);
    const [sendWhatsApp, setSendWhatsApp] = useState(true);
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Reset state when opening
    useEffect(() => {
        if (open) {
            setSelectedUsers([]);
            setSubject('');
            setMessage('');
            setSuccessMessage(null);
            setErrorMessage(null);
            setLoading(false);
        }
    }, [open]);

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedUsers(users.map(u => u.id));
        } else {
            setSelectedUsers([]);
        }
    };

    const handleSelectUser = (id: number, checked: boolean) => {
        if (checked) {
            setSelectedUsers(prev => [...prev, id]);
        } else {
            setSelectedUsers(prev => prev.filter(uid => uid !== id));
        }
    };

    const handleSend = async () => {
        if (!message.trim()) {
            setErrorMessage('El mensaje es obligatorio');
            return;
        }
        if (selectedUsers.length === 0) {
            setErrorMessage('Debe seleccionar al menos un usuario');
            return;
        }
        if (!sendEmail && !sendWhatsApp) {
            setErrorMessage('Seleccione al menos un canal de envío (Email o WhatsApp)');
            return;
        }

        setLoading(true);
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${getAPIBaseURL()}/api/notifications/bulk`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    userIds: selectedUsers,
                    message,
                    subject,
                    sendEmail,
                    sendWhatsApp
                })
            });

            const data = await response.json();

            if (data.success) {
                setSuccessMessage(data.message);
                setTimeout(() => {
                    onClose();
                }, 2000);
            } else {
                setErrorMessage(data.error || 'Error al enviar notificaciones');
            }
        } catch (error: any) {
            setErrorMessage('Error de conexión al servidor');
        } finally {
            setLoading(false);
        }
    };

    const isAllSelected = users.length > 0 && selectedUsers.length === users.length;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>📢 Enviar Notificaciones Masivas (v2)</DialogTitle>
            <DialogContent dividers>
                {errorMessage && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage}</Alert>}
                {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}

                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" gutterBottom>Configuración de Mensaje</Typography>

                    <FormControlLabel
                        control={<Checkbox checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} />}
                        label="Enviar por Email"
                    />
                    <FormControlLabel
                        control={<Checkbox checked={sendWhatsApp} onChange={e => setSendWhatsApp(e.target.checked)} />}
                        label="Enviar por WhatsApp"
                    />

                    {sendEmail && (
                        <TextField
                            fullWidth
                            label="Asunto del Correo"
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                            margin="normal"
                            size="small"
                        />
                    )}

                    <TextField
                        fullWidth
                        label="Mensaje"
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        margin="normal"
                        multiline
                        rows={4}
                        placeholder="Ejemplo: Hola {nombre}, este es un mensaje personalizado para ti 🚀"
                        helperText="Variables disponibles: {nombre}, {email}, {phone} o {telefono}"
                    />
                </Box>

                <Box>
                    <Typography variant="subtitle2" gutterBottom>
                        Seleccionar Destinatarios ({selectedUsers.length} seleccionados)
                    </Typography>

                    <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                        <Table stickyHeader size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            checked={isAllSelected}
                                            indeterminate={selectedUsers.length > 0 && selectedUsers.length < users.length}
                                            onChange={e => handleSelectAll(e.target.checked)}
                                        />
                                    </TableCell>
                                    <TableCell>Nombre</TableCell>
                                    <TableCell>Teléfono</TableCell>
                                    <TableCell>Email</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {users.map(user => (
                                    <TableRow key={user.id} hover onClick={() => handleSelectUser(user.id, !selectedUsers.includes(user.id))}>
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                checked={selectedUsers.includes(user.id)}
                                                onChange={e => handleSelectUser(user.id, e.target.checked)}
                                            />
                                        </TableCell>
                                        <TableCell>{user.name}</TableCell>
                                        <TableCell>{user.phone}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit" disabled={loading}>
                    Cancelar
                </Button>
                <Button onClick={handleSend} variant="contained" color="primary" disabled={loading}>
                    {loading ? <CircularProgress size={24} color="inherit" /> : 'Enviar Notificaciones'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
