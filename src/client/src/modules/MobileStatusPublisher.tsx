import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Button,
    Card,
    CardContent,
    TextField,
    Alert,
    CircularProgress,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    IconButton,
    Chip,
    Divider
} from '@mui/material';
import {
    PhoneAndroid,
    CloudSync,
    CheckCircle,
    Schedule,
    Share,
    NotificationsActive,
    Delete
} from '@mui/icons-material';
import { getAPIBaseURL } from '../utils/api';

interface PendingStatus {
    id: number;
    type: string;
    content: string;
    mediaUrl: string | null;
    scheduledTime: string | null;
    createdAt: string;
}

export const MobileStatusPublisher: React.FC = () => {
    const [isRegistered, setIsRegistered] = useState(false);
    const [loading, setLoading] = useState(true);
    const [deviceName, setDeviceName] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [pendingStatuses, setPendingStatuses] = useState<PendingStatus[]>([]);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        checkRegistration();
    }, []);

    const checkRegistration = async () => {
        const token = localStorage.getItem('pwa_device_token');
        if (token) {
            setIsRegistered(true);
            loadPendingStatuses();
        }
        setLoading(false);
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Obtener información del dispositivo
            const ua = navigator.userAgent;
            const os = ua.includes('Android') ? 'Android' : ua.includes('iPhone') ? 'iOS' : 'Other';

            const response = await fetch(`${getAPIBaseURL()}/api/pwa/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    deviceName: deviceName || 'Dispositivo Móvil',
                    deviceModel: navigator.platform,
                    osVersion: os,
                    appVersion: '1.0.0'
                })
            });

            const data = await response.json();

            if (data.success) {
                localStorage.setItem('pwa_device_token', data.deviceToken);
                localStorage.setItem('pwa_session_id', sessionId);
                setIsRegistered(true);
                loadPendingStatuses();

                // Solicitar permisos de notificación
                if ('Notification' in window) {
                    Notification.requestPermission();
                }
            } else {
                setError(data.error || 'Error al registrar dispositivo');
            }
        } catch (err) {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const loadPendingStatuses = async () => {
        setSyncing(true);
        try {
            const token = localStorage.getItem('pwa_device_token');
            const response = await fetch(`${getAPIBaseURL()}/api/pwa/statuses/pending`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();
            if (data.success) {
                setPendingStatuses(data.statuses);
            }
        } catch (err) {
            console.error('Error syncing statuses:', err);
        } finally {
            setSyncing(false);
        }
    };

    const handlePublish = async (status: PendingStatus) => {
        try {
            // 1. Preparar contenido para compartir
            let shareData: any = {
                title: 'Publicar Estado WhatsApp',
                text: status.content
            };

            // Si hay media, intentar descargar y compartir archivo
            if (status.mediaUrl) {
                try {
                    const response = await fetch(status.mediaUrl);
                    const blob = await response.blob();
                    const file = new File([blob], 'status-media', { type: blob.type });

                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        shareData.files = [file];
                    }
                } catch (e) {
                    console.error('Error downloading media:', e);
                }
            }

            // 2. Usar Web Share API si está disponible
            if (navigator.share) {
                await navigator.share(shareData);

                // 3. Confirmar publicación
                await confirmPublication(status.id);
            } else {
                // Fallback: Copiar texto y abrir WhatsApp
                if (status.content) {
                    await navigator.clipboard.writeText(status.content);
                    alert('Texto copiado. Pégalo en tu estado de WhatsApp.');
                }
                window.open('whatsapp://send?text=' + encodeURIComponent(status.content || ''));

                // Preguntar si se publicó
                if (window.confirm('¿Se publicó correctamente el estado?')) {
                    await confirmPublication(status.id);
                }
            }
        } catch (err) {
            console.error('Error sharing:', err);
            alert('No se pudo abrir WhatsApp automáticamente. Intenta hacerlo manual.');
        }
    };

    const confirmPublication = async (statusId: number) => {
        try {
            const token = localStorage.getItem('pwa_device_token');
            await fetch(`${getAPIBaseURL()}/api/pwa/statuses/${statusId}/confirm`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ publishedAt: new Date() })
            });

            // Recargar lista
            loadPendingStatuses();
        } catch (err) {
            console.error('Error confirming publication:', err);
        }
    };

    const handleUnregister = () => {
        if (window.confirm('¿Estás seguro de desvincular este dispositivo?')) {
            localStorage.removeItem('pwa_device_token');
            localStorage.removeItem('pwa_session_id');
            setIsRegistered(false);
            setPendingStatuses([]);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!isRegistered) {
        return (
            <Box sx={{ p: 3, maxWidth: 400, mx: 'auto', mt: 4 }}>
                <Card elevation={3}>
                    <CardContent>
                        <Box sx={{ textAlign: 'center', mb: 3 }}>
                            <PhoneAndroid sx={{ fontSize: 60, color: '#25d366', mb: 2 }} />
                            <Typography variant="h5" gutterBottom>
                                Whinsap Mobile
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Configura este dispositivo para publicar estados
                            </Typography>
                        </Box>

                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                        <form onSubmit={handleRegister}>
                            <TextField
                                fullWidth
                                label="ID de Sesión (Teléfono)"
                                value={sessionId}
                                onChange={(e) => setSessionId(e.target.value)}
                                margin="normal"
                                required
                                placeholder="Ej: 595985768793"
                            />
                            <TextField
                                fullWidth
                                label="Nombre del Dispositivo"
                                value={deviceName}
                                onChange={(e) => setDeviceName(e.target.value)}
                                margin="normal"
                                required
                                placeholder="Ej: Mi Samsung"
                            />
                            <Button
                                type="submit"
                                fullWidth
                                variant="contained"
                                size="large"
                                sx={{ mt: 3, bgcolor: '#25d366', '&:hover': { bgcolor: '#128c7e' } }}
                            >
                                Vincular Dispositivo
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 2, maxWidth: 600, mx: 'auto', pb: 10 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    📱 Whinsap Publisher
                </Typography>
                <IconButton onClick={loadPendingStatuses} disabled={syncing}>
                    <CloudSync className={syncing ? 'spin' : ''} />
                </IconButton>
            </Box>

            {/* Stats */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <Card sx={{ flex: 1, bgcolor: '#e8f5e9' }}>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Typography variant="h4" sx={{ color: '#2e7d32', fontWeight: 700 }}>
                            {pendingStatuses.length}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#2e7d32' }}>
                            Pendientes
                        </Typography>
                    </CardContent>
                </Card>
                <Card sx={{ flex: 1, bgcolor: '#e3f2fd' }}>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Typography variant="h4" sx={{ color: '#1565c0', fontWeight: 700 }}>
                            0
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#1565c0' }}>
                            Publicados Hoy
                        </Typography>
                    </CardContent>
                </Card>
            </Box>

            {/* Queue */}
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Cola de Publicación
            </Typography>

            {pendingStatuses.length === 0 ? (
                <Card sx={{ textAlign: 'center', p: 4, bgcolor: '#f5f5f5' }}>
                    <CheckCircle sx={{ fontSize: 48, color: '#bdbdbd', mb: 1 }} />
                    <Typography color="text.secondary">
                        No hay estados pendientes
                    </Typography>
                </Card>
            ) : (
                <List>
                    {pendingStatuses.map((status) => (
                        <Card key={status.id} sx={{ mb: 2 }}>
                            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Chip
                                        label={status.type.toUpperCase()}
                                        size="small"
                                        color={status.type === 'text' ? 'default' : 'primary'}
                                    />
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Schedule sx={{ fontSize: 14, color: 'text.secondary' }} />
                                        <Typography variant="caption" color="text.secondary">
                                            {new Date(status.createdAt).toLocaleTimeString()}
                                        </Typography>
                                    </Box>
                                </Box>

                                <Typography variant="body1" sx={{ mb: 2 }}>
                                    {status.content || 'Sin texto'}
                                </Typography>

                                {status.mediaUrl && (
                                    <Box
                                        component="img"
                                        src={status.mediaUrl}
                                        sx={{
                                            width: '100%',
                                            height: 200,
                                            objectFit: 'cover',
                                            borderRadius: 1,
                                            mb: 2
                                        }}
                                    />
                                )}

                                <Button
                                    variant="contained"
                                    fullWidth
                                    startIcon={<Share />}
                                    onClick={() => handlePublish(status)}
                                    sx={{ bgcolor: '#25d366', '&:hover': { bgcolor: '#128c7e' } }}
                                >
                                    Publicar en WhatsApp
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </List>
            )}

            {/* Footer Actions */}
            <Box sx={{ mt: 4, textAlign: 'center' }}>
                <Button
                    color="error"
                    startIcon={<Delete />}
                    onClick={handleUnregister}
                >
                    Desvincular Dispositivo
                </Button>
            </Box>
        </Box>
    );
};
