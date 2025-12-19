import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AppBar,
    Toolbar,
    Typography,
    Button,
    Container,
    Box,
    Grid,
    Card,
    CardContent,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Chip,
    CircularProgress
} from '@mui/material';
import {
    WhatsApp,
    CheckCircle,
    Message,
    Campaign,
    Analytics,
    People,
    Speed,
    Security
} from '@mui/icons-material';

interface Plan {
    id: number;
    name: string;
    price: number;
    max_channels: number;
    max_messages: number;
    max_agents: number;
    max_sessions: number;
    bot_enabled: number;
    api_enabled: number;
}

const LandingPageComplete: React.FC = () => {
    const navigate = useNavigate();
    const [activeSection, setActiveSection] = useState('inicio');
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(true);

    // Cargar planes desde la API
    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const response = await fetch('/api/public/plans');
                const data = await response.json();
                if (data.success) {
                    setPlans(data.plans);
                }
            } catch (error) {
                console.error('Error cargando planes:', error);
            } finally {
                setLoadingPlans(false);
            }
        };

        fetchPlans();
    }, []);

    const scrollToSection = (sectionId: string) => {
        setActiveSection(sectionId);
        const element = document.getElementById(sectionId);
        element?.scrollIntoView({ behavior: 'smooth' });
    };

    const features = [
        {
            icon: <Message sx={{ fontSize: 40 }} />,
            title: 'Chat Multi-Agente',
            description: 'Gestione múltiples conversaciones con un equipo de agentes en tiempo real'
        },
        {
            icon: <Campaign sx={{ fontSize: 40 }} />,
            title: 'Campañas Masivas',
            description: 'Envíe campañas programadas a miles de contactos con personalización'
        },
        {
            icon: <Analytics sx={{ fontSize: 40 }} />,
            title: 'Analytics Avanzado',
            description: 'Reportes detallados de mensajes, conversiones y rendimiento de agentes'
        },
        {
            icon: <People sx={{ fontSize: 40 }} />,
            title: 'CRM Integrado',
            description: 'Base de datos de contactos con segmentación y estados personalizados'
        },
        {
            icon: <Speed sx={{ fontSize: 40 }} />,
            title: 'Respuestas Automáticas',
            description: 'Chatbots inteligentes con IA para atención 24/7'
        },
        {
            icon: <Security sx={{ fontSize: 40 }} />,
            title: 'API REST Segura',
            description: 'Integre WhatsFlow con sus sistemas mediante API REST'
        }
    ];

    const renderPlanFeatures = (plan: Plan) => {
        const features = [];

        features.push(`${plan.max_channels} ${plan.max_channels === 1 ? 'canal' : 'canales'} WhatsApp`);

        if (plan.max_messages >= 999999) {
            features.push('Mensajes ilimitados');
        } else {
            features.push(`${plan.max_messages.toLocaleString()} mensajes/mes`);
        }

        features.push(`${plan.max_agents} ${plan.max_agents === 1 ? 'agente' : 'agentes'}`);
        features.push(`${plan.max_sessions} ${plan.max_sessions === 1 ? 'sesión' : 'sesiones'} simultáneas`);

        if (plan.bot_enabled) features.push('Bot IA Avanzado');
        if (plan.api_enabled) features.push('API REST');

        return features;
    };

    return (
        <Box sx={{ bgcolor: '#0f172a', minHeight: '100vh' }}>
            {/* Navigation Bar */}
            <AppBar position="sticky" sx={{ bgcolor: '#1e293b', boxShadow: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <Toolbar>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
                        <WhatsApp sx={{ color: '#10b981', fontSize: 32 }} />
                        <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>
                            WhatsFlow
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2, mr: 3 }}>
                        <Button color="inherit" onClick={() => scrollToSection('inicio')}>
                            Inicio
                        </Button>
                        <Button color="inherit" onClick={() => scrollToSection('servicios')}>
                            Servicios
                        </Button>
                        <Button color="inherit" onClick={() => scrollToSection('precios')}>
                            Precios
                        </Button>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="outlined"
                            onClick={() => navigate('/login')}
                            sx={{
                                borderColor: '#6366f1',
                                color: '#6366f1',
                                '&:hover': { borderColor: '#818cf8', bgcolor: 'rgba(99, 102, 241, 0.1)' }
                            }}
                        >
                            Acceso
                        </Button>
                        <Button
                            variant="contained"
                            onClick={() => navigate('/register')}
                            sx={{
                                bgcolor: '#10b981',
                                '&:hover': { bgcolor: '#059669' }
                            }}
                        >
                            Crear Cuenta
                        </Button>
                    </Box>
                </Toolbar>
            </AppBar>

            {/* Hero Section */}
            <Box
                id="inicio"
                sx={{
                    background: 'radial-gradient(circle at top right, #1e293b 0%, #0f172a 50%)',
                    py: 12
                }}
            >
                <Container maxWidth="lg">
                    <Grid container spacing={6} alignItems="center">
                        <Grid item xs={12} md={6}>
                            <Typography
                                variant="h2"
                                sx={{
                                    fontWeight: 800,
                                    color: 'white',
                                    mb: 3,
                                    fontSize: { xs: '2.5rem', md: '3.5rem' }
                                }}
                            >
                                La plataforma WhatsApp que su empresa necesita
                            </Typography>
                            <Typography variant="h6" sx={{ color: '#94a3b8', mb: 4 }}>
                                Automatice, mida y escale conversaciones de negocio con IA, campañas y reportes.
                                Unifique equipos y canales en una sola plataforma.
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <Button
                                    variant="contained"
                                    size="large"
                                    onClick={() => navigate('/register')}
                                    sx={{
                                        bgcolor: '#10b981',
                                        px: 4,
                                        py: 1.5,
                                        fontSize: '1.1rem',
                                        '&:hover': { bgcolor: '#059669' }
                                    }}
                                >
                                    Comenzar Gratis
                                </Button>
                                <Button
                                    variant="outlined"
                                    size="large"
                                    onClick={() => scrollToSection('servicios')}
                                    sx={{
                                        borderColor: '#6366f1',
                                        color: '#6366f1',
                                        px: 4,
                                        py: 1.5,
                                        '&:hover': { borderColor: '#818cf8' }
                                    }}
                                >
                                    Ver Servicios
                                </Button>
                            </Box>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            {/* Imagen removida - archivo no existe */}
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            {/* Servicios Section */}
            <Box id="servicios" sx={{ bgcolor: '#1e293b', py: 12 }}>
                <Container maxWidth="lg">
                    <Box sx={{ textAlign: 'center', mb: 8 }}>
                        <Typography variant="h3" sx={{ color: 'white', fontWeight: 700, mb: 2 }}>
                            Nuestros Servicios
                        </Typography>
                        <Typography variant="h6" sx={{ color: '#94a3b8' }}>
                            Todo lo que necesita para gestionar WhatsApp profesionalmente
                        </Typography>
                    </Box>

                    <Grid container spacing={4}>
                        {features.map((feature, index) => (
                            <Grid item xs={12} md={4} key={index}>
                                <Card
                                    sx={{
                                        height: '100%',
                                        bgcolor: '#0f172a',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        transition: 'all 0.3s',
                                        '&:hover': {
                                            transform: 'translateY(-8px)',
                                            boxShadow: '0 12px 32px rgba(99, 102, 241, 0.3)',
                                            borderColor: '#6366f1'
                                        }
                                    }}
                                >
                                    <CardContent sx={{ p: 4 }}>
                                        <Box sx={{ color: '#10b981', mb: 2 }}>
                                            {feature.icon}
                                        </Box>
                                        <Typography variant="h5" sx={{ color: 'white', fontWeight: 600, mb: 2 }}>
                                            {feature.title}
                                        </Typography>
                                        <Typography sx={{ color: '#94a3b8' }}>
                                            {feature.description}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </Container>
            </Box>

            {/* Precios Section */}
            <Box id="precios" sx={{ bgcolor: '#0f172a', py: 12 }}>
                <Container maxWidth="lg">
                    <Box sx={{ textAlign: 'center', mb: 8 }}>
                        <Typography variant="h3" sx={{ color: 'white', fontWeight: 700, mb: 2 }}>
                            Planes y Precios
                        </Typography>
                        <Typography variant="h6" sx={{ color: '#94a3b8' }}>
                            Elija el plan que mejor se adapte a su negocio
                        </Typography>
                    </Box>

                    {loadingPlans ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                            <CircularProgress sx={{ color: '#10b981' }} />
                        </Box>
                    ) : (
                        <Grid container spacing={4} justifyContent="center">
                            {plans.map((plan, index) => {
                                const isRecommended = index === 1; // Recomendar el segundo plan
                                const planFeatures = renderPlanFeatures(plan);

                                return (
                                    <Grid item xs={12} md={4} key={plan.id}>
                                        <Card
                                            sx={{
                                                height: '100%',
                                                bgcolor: isRecommended ? '#1e293b' : '#0f172a',
                                                border: isRecommended ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                                                position: 'relative',
                                                transition: 'transform 0.3s',
                                                '&:hover': {
                                                    transform: 'scale(1.05)'
                                                }
                                            }}
                                        >
                                            {isRecommended && (
                                                <Chip
                                                    label="Recomendado"
                                                    sx={{
                                                        position: 'absolute',
                                                        top: -12,
                                                        right: 20,
                                                        bgcolor: '#6366f1',
                                                        color: 'white',
                                                        fontWeight: 600
                                                    }}
                                                />
                                            )}
                                            <CardContent sx={{ p: 4 }}>
                                                <Typography variant="h5" sx={{ color: 'white', fontWeight: 700, mb: 1 }}>
                                                    {plan.name}
                                                </Typography>
                                                <Box sx={{ mb: 3 }}>
                                                    <Typography variant="h3" sx={{ color: '#10b981', fontWeight: 800, display: 'inline' }}>
                                                        ₲{plan.price.toLocaleString('es-PY')}
                                                    </Typography>
                                                    <Typography variant="body1" sx={{ color: '#94a3b8', display: 'inline' }}>
                                                        /mes
                                                    </Typography>
                                                </Box>
                                                <List>
                                                    {planFeatures.map((feature, idx) => (
                                                        <ListItem key={idx} sx={{ px: 0, py: 0.5 }}>
                                                            <ListItemIcon sx={{ minWidth: 36 }}>
                                                                <CheckCircle sx={{ color: '#10b981', fontSize: 20 }} />
                                                            </ListItemIcon>
                                                            <ListItemText
                                                                primary={feature}
                                                                primaryTypographyProps={{
                                                                    sx: { color: '#cbd5e1', fontSize: '0.95rem' }
                                                                }}
                                                            />
                                                        </ListItem>
                                                    ))}
                                                </List>
                                                <Button
                                                    variant={isRecommended ? 'contained' : 'outlined'}
                                                    fullWidth
                                                    size="large"
                                                    onClick={() => navigate('/register')}
                                                    sx={{
                                                        mt: 3,
                                                        py: 1.5,
                                                        bgcolor: isRecommended ? '#10b981' : 'transparent',
                                                        borderColor: isRecommended ? 'transparent' : '#6366f1',
                                                        color: isRecommended ? 'white' : '#6366f1',
                                                        '&:hover': {
                                                            bgcolor: isRecommended ? '#059669' : 'rgba(99, 102, 241, 0.1)'
                                                        }
                                                    }}
                                                >
                                                    Seleccionar Plan
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                );
                            })}
                        </Grid>
                    )}
                </Container>
            </Box>

            {/* CTA Final */}
            <Box sx={{ bgcolor: '#1e293b', py: 12, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <Container maxWidth="md">
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h3" sx={{ color: 'white', fontWeight: 800, mb: 3 }}>
                            ¿Listo para transformar su WhatsApp?
                        </Typography>
                        <Typography variant="h6" sx={{ color: '#94a3b8', mb: 4 }}>
                            Únase a cientos de empresas que ya automatizan y escalan con WhatsFlow
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                            <Button
                                variant="contained"
                                size="large"
                                onClick={() => navigate('/register')}
                                sx={{
                                    bgcolor: '#10b981',
                                    px: 5,
                                    py: 2,
                                    fontSize: '1.1rem',
                                    '&:hover': { bgcolor: '#059669' }
                                }}
                            >
                                Crear Cuenta Gratis
                            </Button>
                            <Button
                                variant="outlined"
                                size="large"
                                onClick={() => navigate('/login')}
                                sx={{
                                    borderColor: '#6366f1',
                                    color: '#6366f1',
                                    px: 5,
                                    py: 2,
                                    fontSize: '1.1rem',
                                    '&:hover': { borderColor: '#818cf8' }
                                }}
                            >
                                Iniciar Sesión
                            </Button>
                        </Box>
                    </Box>
                </Container>
            </Box>

            {/* Footer */}
            <Box sx={{ bgcolor: '#0f172a', py: 6, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <Container maxWidth="lg">
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography sx={{ color: '#64748b', mb: 1 }}>
                            © 2025 WhatsFlow. Todos los derechos reservados.
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#475569' }}>
                            Plataforma profesional de gestión WhatsApp Business
                        </Typography>
                    </Box>
                </Container>
            </Box>
        </Box>
    );
};

export default LandingPageComplete;
