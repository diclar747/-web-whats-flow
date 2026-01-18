import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
    Box, Container, Typography, Button, Paper,
    CircularProgress, Fade, IconButton, TextField,
    alpha, useTheme, Card, CardContent, Stack
} from '@mui/material';
import {
    NotificationsActive,
    CheckCircleOutline,
    ErrorOutline,
    Shield,
    NotificationsOff,
    Campaign
} from '@mui/icons-material';
import axios from 'axios';
import { subscribeToPush } from './pushService';

const PublicSubscriptionPage: React.FC = () => {
    const theme = useTheme();
    const { code } = useParams<{ code: string }>();
    const [searchParams] = useSearchParams();

    // States
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<'idle' | 'subscribing' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [urlData, setUrlData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Initial load to check if URL is valid
    useEffect(() => {
        const checkUrl = async () => {
            try {
                const res = await axios.get(`/api/push/public/url-info/${code}`);
                setUrlData(res.data.url);
                setLoading(false);
            } catch (err: any) {
                setError(err.response?.data?.error || 'Enlace no válido o expirado');
                setLoading(false);
            }
        };

        if (code) checkUrl();
    }, [code]);

    const handleSubscribe = async () => {
        if (!code) return;

        // Security timeout: if it takes more than 20 seconds, something is wrong
        const timeout = setTimeout(() => {
            if (status === 'subscribing') {
                setStatus('error');
                setError('La suscripción está tardando demasiado. Prueba a recargar la página o verifica los permisos de tu navegador.');
            }
        }, 20000);

        try {
            setStatus('subscribing');

            // Optional data from query params
            const name = searchParams.get('name') || undefined;
            const email = searchParams.get('email') || undefined;

            const result = await subscribeToPush(code, name, email);

            clearTimeout(timeout);
            setStatus('success');
            setMessage(result.message || '¡Te has suscrito correctamente!');

            // Redirect if the URL has a redirectUrl after a short delay
            if (result.redirectUrl) {
                setTimeout(() => {
                    window.location.href = result.redirectUrl;
                }, 2000);
            }
        } catch (err: any) {
            clearTimeout(timeout);
            console.error('Subscription error:', err);
            setStatus('error');
            setError(err.message || 'No pudimos procesar tu suscripción. Asegúrate de haber aceptado el permiso de notificaciones.');
        }
    };

    if (loading) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#0f172a' }}>
                <CircularProgress sx={{ color: '#3b82f6' }} />
            </Box>
        );
    }

    return (
        <Box sx={{
            minHeight: '100vh',
            bgcolor: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2,
            backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.1) 0%, rgba(15, 23, 42, 1) 100%)'
        }}>
            <Fade in={true} timeout={800}>
                <Container maxWidth="xs">
                    <Card sx={{
                        borderRadius: 6,
                        bgcolor: 'rgba(30, 41, 59, 0.7)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        overflow: 'visible',
                        position: 'relative'
                    }}>
                        <Box sx={{
                            position: 'absolute',
                            top: -40,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            bgcolor: '#3b82f6',
                            p: 2,
                            borderRadius: '50%',
                            boxShadow: '0 10px 20px -5px rgba(59, 130, 246, 0.5)',
                            color: 'white'
                        }}>
                            <NotificationsActive fontSize="large" />
                        </Box>

                        <CardContent sx={{ pt: 6, pb: 4, textAlign: 'center' }}>
                            {status === 'idle' && (
                                <>
                                    <Typography variant="h5" fontWeight="900" color="white" gutterBottom>
                                        ¿Quieres recibir notificaciones?
                                    </Typography>
                                    <Typography variant="body1" sx={{ color: '#94a3b8', mb: 4 }}>
                                        {urlData?.description || `${urlData?.name || 'Whinsap'} desea enviarte avisos importantes directamente a tu navegador.`}
                                    </Typography>

                                    <Stack spacing={2}>
                                        <Button
                                            variant="contained"
                                            size="large"
                                            fullWidth
                                            onClick={handleSubscribe}
                                            sx={{
                                                borderRadius: 4,
                                                py: 1.8,
                                                fontWeight: 800,
                                                fontSize: '1.1rem',
                                                textTransform: 'none',
                                                bgcolor: '#3b82f6',
                                                '&:hover': { bgcolor: '#2563eb' },
                                                boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)'
                                            }}
                                        >
                                            Aceptar y Suscribirme
                                        </Button>
                                        <Button
                                            variant="text"
                                            fullWidth
                                            onClick={() => window.close()}
                                            sx={{ color: '#64748b', fontWeight: 600, textTransform: 'none' }}
                                        >
                                            Gracias
                                        </Button>
                                    </Stack>

                                    <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center', gap: 3 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#475569' }}>
                                            <Shield sx={{ fontSize: 16 }} />
                                            <Typography variant="caption" fontWeight="700">Seguro</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#475569' }}>
                                            <NotificationsOff sx={{ fontSize: 16 }} />
                                            <Typography variant="caption" fontWeight="700">Sin Spam</Typography>
                                        </Box>
                                    </Box>
                                </>
                            )}

                            {status === 'subscribing' && (
                                <Box sx={{ py: 4 }}>
                                    <CircularProgress size={60} thickness={4} sx={{ mb: 3 }} />
                                    <Typography variant="h6" fontWeight="800" color="white">Procesando suscripción...</Typography>
                                    <Typography variant="body2" color="#94a3b8">Por favor, acepta el permiso en la esquina de tu navegador.</Typography>
                                </Box>
                            )}

                            {status === 'success' && (
                                <Fade in={true}>
                                    <Box sx={{ py: 2 }}>
                                        <CheckCircleOutline sx={{ fontSize: 80, color: '#10b981', mb: 2 }} />
                                        <Typography variant="h5" fontWeight="900" color="white" gutterBottom>
                                            ¡Suscripción Exitosa!
                                        </Typography>
                                        <Typography variant="body1" color="#94a3b8">
                                            {message}
                                        </Typography>
                                        <Typography variant="caption" sx={{ display: 'block', mt: 4, color: '#475569' }}>
                                            Ya puedes cerrar esta ventana.
                                        </Typography>
                                    </Box>
                                </Fade>
                            )}

                            {status === 'error' && (
                                <Fade in={true}>
                                    <Box sx={{ py: 2 }}>
                                        <ErrorOutline sx={{ fontSize: 80, color: '#ef4444', mb: 2 }} />
                                        <Typography variant="h5" fontWeight="900" color="white" gutterBottom>
                                            Ups, algo salió mal
                                        </Typography>
                                        <Typography variant="body1" color="#94a3b8">
                                            {error}
                                        </Typography>
                                        <Button
                                            variant="outlined"
                                            sx={{ mt: 4, borderRadius: 3, color: '#3b82f6', borderColor: '#3b82f6' }}
                                            onClick={() => setStatus('idle')}
                                        >
                                            Intentar de nuevo
                                        </Button>
                                    </Box>
                                </Fade>
                            )}
                        </CardContent>
                    </Card>

                    <Typography
                        variant="caption"
                        sx={{
                            display: 'block',
                            textAlign: 'center',
                            mt: 4,
                            color: '#475569',
                            fontWeight: 700,
                            letterSpacing: 2
                        }}
                    >
                        POWERED BY WINSAP PUSH
                    </Typography>
                </Container>
            </Fade>
        </Box>
    );
};

export default PublicSubscriptionPage;
