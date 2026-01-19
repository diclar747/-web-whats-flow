import React from 'react';
import { Box, Container, Typography, Button, Paper } from '@mui/material';
import { Block, WhatsApp } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const AccountBlocked: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Obtener supportPhone del state o de los query params
    const getPhone = () => {
        const statePhone = (location.state as any)?.supportPhone;
        if (statePhone) return statePhone;

        const params = new URLSearchParams(window.location.search);
        return params.get('supportPhone') || '595994854167';
    };

    const supportPhone = getPhone();

    const handleWhatsAppContact = () => {
        const message = encodeURIComponent('Hola, mi cuenta ha sido suspendida. Necesito ayuda para reactivarla.');
        window.open(`https://wa.me/${supportPhone}?text=${message}`, '_blank');
    };

    const handleBackToLogin = () => {
        // Limpiar todo el localStorage
        localStorage.clear();
        sessionStorage.clear();
        navigate('/login');
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f1626 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 2
            }}
        >
            <Container maxWidth="sm">
                <Paper
                    elevation={24}
                    sx={{
                        p: 4,
                        bgcolor: 'rgba(26, 26, 46, 0.9)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: 3,
                        border: '1px solid rgba(244, 67, 54, 0.3)',
                        textAlign: 'center'
                    }}
                >
                    {/* Ícono */}
                    <Box
                        sx={{
                            width: 100,
                            height: 100,
                            borderRadius: '50%',
                            bgcolor: 'rgba(244, 67, 54, 0.1)',
                            border: '3px solid #f44336',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 24px'
                        }}
                    >
                        <Block sx={{ fontSize: 50, color: '#f44336' }} />
                    </Box>

                    {/* Título */}
                    <Typography
                        variant="h4"
                        sx={{
                            color: '#f44336',
                            fontWeight: 'bold',
                            mb: 2
                        }}
                    >
                        Cuenta Suspendida
                    </Typography>

                    {/* Mensaje */}
                    <Typography
                        variant="body1"
                        sx={{
                            color: 'rgba(255,255,255,0.9)',
                            mb: 1,
                            lineHeight: 1.8
                        }}
                    >
                        Tu cuenta ha sido suspendida por la administración.
                    </Typography>

                    <Typography
                        variant="body2"
                        sx={{
                            color: 'rgba(255,255,255,0.7)',
                            mb: 4
                        }}
                    >
                        Por favor, contacta con soporte para más información.
                    </Typography>

                    {/* Botón de WhatsApp */}
                    <Button
                        variant="contained"
                        size="large"
                        fullWidth
                        startIcon={<WhatsApp />}
                        onClick={handleWhatsAppContact}
                        sx={{
                            mb: 2,
                            bgcolor: '#25D366',
                            color: 'white',
                            py: 1.5,
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            '&:hover': {
                                bgcolor: '#1da851'
                            }
                        }}
                    >
                        Contactar por WhatsApp
                    </Button>

                    <Typography
                        variant="caption"
                        sx={{
                            display: 'block',
                            color: 'rgba(255,255,255,0.6)',
                            mb: 3
                        }}
                    >
                        WhatsApp: +{supportPhone}
                    </Typography>

                    {/* Botón volver al login */}
                    <Button
                        variant="outlined"
                        fullWidth
                        onClick={handleBackToLogin}
                        sx={{
                            color: 'rgba(255,255,255,0.7)',
                            borderColor: 'rgba(255,255,255,0.2)',
                            '&:hover': {
                                borderColor: 'rgba(255,255,255,0.4)',
                                bgcolor: 'rgba(255,255,255,0.05)'
                            }
                        }}
                    >
                        Volver al Login
                    </Button>
                </Paper>
            </Container>
        </Box>
    );
};

export default AccountBlocked;
