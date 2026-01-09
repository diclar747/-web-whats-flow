import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogActions,
    Typography,
    Button,
    Box,
    Fade,
    IconButton
} from '@mui/material';
import {
    NotificationsActive as NotificationIcon,
    Close as CloseIcon,
    Security as SecurityIcon,
    TouchApp as TouchIcon
} from '@mui/icons-material';

interface NotificationPermissionModalProps {
    isOpen?: boolean;
    onClose?: () => void;
}

const NotificationPermissionModal: React.FC<NotificationPermissionModalProps> = ({
    isOpen: externalIsOpen,
    onClose: externalOnClose
}) => {
    const [open, setOpen] = useState(false);
    const [permissionState, setPermissionState] = useState<NotificationPermission>('default');


    useEffect(() => {
        // Check initial permission state
        if ('Notification' in window) {
            setPermissionState(Notification.permission);

            // Auto-open if permission is default (not granted or denied)
            if (Notification.permission === 'default' && externalIsOpen === undefined) {
                // Small delay for better UX
                const timer = setTimeout(() => {
                    setOpen(true);
                }, 2000);
                return () => clearTimeout(timer);
            }
        }
        return undefined;
    }, [externalIsOpen]);

    // Sync with external control if provided
    useEffect(() => {
        if (externalIsOpen !== undefined) {
            setOpen(externalIsOpen);
        }
    }, [externalIsOpen]);

    const handleClose = () => {
        setOpen(false);
        if (externalOnClose) externalOnClose();
    };

    const handleRequestPermission = async () => {
        if (!('Notification' in window)) return;

        try {
            const permission = await Notification.requestPermission();
            setPermissionState(permission);

            if (permission === 'granted') {
                handleClose();
            }
        } catch (error) {
            console.error('Error requesting notification permission:', error);
        }
    };

    // Modern Glassmorphism Style
    const glassStyle = {
        background: 'rgba(32, 44, 51, 0.95)', // WhatsApp dark theme color
        backdropFilter: 'blur(10px)',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        maxWidth: '450px',
        margin: '16px'
    };

    if (permissionState === 'granted' && externalIsOpen === undefined) return null;

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            TransitionComponent={Fade}
            PaperProps={{
                style: glassStyle
            }}
            maxWidth="sm"
        >
            <Box sx={{ position: 'relative', p: 3, textAlign: 'center', color: '#e9edef' }}>
                <IconButton
                    aria-label="close"
                    onClick={handleClose}
                    sx={{
                        position: 'absolute',
                        right: 8,
                        top: 8,
                        color: '#8696a0',
                        '&:hover': { color: '#e9edef', bgcolor: 'rgba(255,255,255,0.1)' }
                    }}
                >
                    <CloseIcon />
                </IconButton>

                <Box
                    sx={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #00a884 0%, #008f6f 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 24px auto',
                        boxShadow: '0 0 20px rgba(0, 168, 132, 0.4)'
                    }}
                >
                    <NotificationIcon sx={{ fontSize: 40, color: 'white' }} />
                </Box>

                <Typography variant="h5" component="h2" sx={{ fontWeight: 600, mb: 2, color: '#e9edef' }}>
                    Activar Notificaciones
                </Typography>

                <Typography variant="body1" sx={{ color: '#8696a0', mb: 4, lineHeight: 1.6 }}>
                    No te pierdas ningún mensaje importante. Activa las notificaciones para saber instantáneamente cuando recibas un nuevo chat.
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#8696a0', fontSize: '0.9rem' }}>
                        <SecurityIcon sx={{ fontSize: 18, color: '#00a884' }} />
                        <span>Seguro</span>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#8696a0', fontSize: '0.9rem' }}>
                        <TouchIcon sx={{ fontSize: 18, color: '#00a884' }} />
                        <span>Personalizable</span>
                    </Box>
                </Box>
            </Box>

            <DialogActions sx={{ p: 3, justifyContent: 'center', gap: 2, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <Button
                    onClick={handleClose}
                    sx={{
                        color: '#8696a0',
                        textTransform: 'none',
                        fontSize: '1rem',
                        px: 3,
                        '&:hover': { color: '#e9edef', bgcolor: 'rgba(255,255,255,0.05)' }
                    }}
                >
                    Quizás después
                </Button>
                <Button
                    variant="contained"
                    onClick={handleRequestPermission}
                    sx={{
                        bgcolor: '#00a884',
                        color: '#fff',
                        textTransform: 'none',
                        fontSize: '1rem',
                        fontWeight: 600,
                        px: 4,
                        py: 1,
                        borderRadius: '24px',
                        boxShadow: '0 4px 12px rgba(0, 168, 132, 0.3)',
                        '&:hover': {
                            bgcolor: '#008f6f',
                            boxShadow: '0 6px 16px rgba(0, 168, 132, 0.4)'
                        }
                    }}
                >
                    Permitir
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default NotificationPermissionModal;
