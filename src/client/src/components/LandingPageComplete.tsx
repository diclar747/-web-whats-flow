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
    CircularProgress,
    Fab,
    IconButton,
    useScrollTrigger,
    Fade,
    Paper,
    Avatar,
    Stack,
    Divider
} from '@mui/material';
import {
    WhatsApp,
    CheckCircle,
    Message,
    Campaign,
    Analytics,
    People,
    Speed,
    Security,
    Schedule,
    AutoGraph,
    TrackChanges,
    History,
    Dns,
    Dashboard as DashboardIcon,
    Menu as MenuIcon,
    ArrowForward,
    PlayArrow,
    Groups,
    NotificationsActive,
    BarChart
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

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

const MotionBox = motion(Box);
const MotionTypography = motion(Typography);
const MotionGrid = motion(Grid);
const MotionCard = motion(Card);

const LandingPageComplete: React.FC = () => {
    const navigate = useNavigate();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(true);

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
        const element = document.getElementById(sectionId);
        element?.scrollIntoView({ behavior: 'smooth' });
    };

    const coreFeatures = [
        {
            icon: <Campaign sx={{ fontSize: 32 }} />,
            title: 'Whinsap Campañas Masivas',
            description: 'Envíos masivos automatizados a toda su base de contactos en segundos.',
            color: '#10b981',
            image: '/images/campaigns_module.png'
        },
        {
            icon: <Schedule sx={{ fontSize: 32 }} />,
            title: 'Whinsap Envíos Programados',
            description: 'Defina día y hora para sus comunicaciones. Automatización total.',
            color: '#3b82f6',
            image: '/images/agenda_module.png'
        },
        {
            icon: <AutoGraph sx={{ fontSize: 32 }} />,
            title: 'Whinsap Personalización',
            description: 'Use variables y campos dinámicos para mensajes únicos por cliente.',
            color: '#8b5cf6',
            image: '/images/chatbot_module.png'
        },
        {
            icon: <DashboardIcon sx={{ fontSize: 32 }} />,
            title: 'Whinsap Tableros Kanban',
            description: 'Gestione su embudo de ventas visualmente. Leads organizados.',
            color: '#f59e0b',
            image: '/images/kanban_module.png'
        },
        {
            icon: <NotificationsActive sx={{ fontSize: 32 }} />,
            title: 'Whinsap Agenda Inteligente',
            description: 'Recordatorios automáticos por WhatsApp para citas y eventos.',
            color: '#ef4444',
            image: '/images/agenda_module.png'
        },
        {
            icon: <Dns sx={{ fontSize: 32 }} />,
            title: 'Whinsap API REST Professional',
            description: 'Potente API para integrar Whinsap con su ERP o sistemas propios.',
            color: '#06b6d4',
            image: '/images/api_module.png'
        },
        {
            icon: <Groups sx={{ fontSize: 32 }} />,
            title: 'Whinsap Gestión de Agentes',
            description: 'Control total de roles, permisos y desempeño de su equipo.',
            color: '#ec4899',
            image: '/images/multiagent_module.png'
        },
        {
            icon: <Message sx={{ fontSize: 32 }} />,
            title: 'Whinsap Chat Multi-Agente',
            description: 'Varios miembros del equipo atendiendo la misma línea oficial.',
            color: '#10b981',
            image: '/images/multiagent_module.png'
        },
        {
            icon: <TrackChanges sx={{ fontSize: 32 }} />,
            title: 'Whinsap Monitoreo en Vivo',
            description: 'Supervise conversaciones en tiempo real para asegurar calidad.',
            color: '#6366f1',
            image: '/images/hero_dashboard.png'
        },
        {
            icon: <History sx={{ fontSize: 32 }} />,
            title: 'Whinsap Historial Auditable',
            description: 'Registro completo de cada mensaje, envío y respuesta del sistema.',
            color: '#94a3b8',
            image: '/images/api_module.png'
        },
        {
            icon: <BarChart sx={{ fontSize: 32 }} />,
            title: 'Whinsap Métricas Reales',
            description: 'Dashboard analítico con estados de campañas y tasas de lectura.',
            color: '#f97316',
            image: '/images/campaigns_module.png'
        },
        {
            icon: <Speed sx={{ fontSize: 32 }} />,
            title: 'Whinsap Estados de Envío',
            description: 'Tracking en tiempo real: Enviado, Entregado y Leído (Doble Check).',
            color: '#22c55e',
            image: '/images/hero_dashboard.png'
        }
    ];

    const showcaseModules = [
        {
            title: 'Bot de Inteligencia Artificial',
            description: 'Chatbots avanzados que entienden el contexto y responden 24/7. Automatice sus ventas y soporte sin perder el toque humano con nuestra tecnología NEURAL.',
            image: '/images/chatbot_module.png',
            icon: <WhatsApp />,
            color: '#10b981'
        },
        {
            title: 'Panel Multi-Agente Profesional',
            description: 'Centralice la atención de su empresa. Múltiples agentes atendiendo una sola línea con transferencias inteligentes y notas internas para su equipo.',
            image: '/images/multiagent_module.png',
            icon: <People />,
            color: '#3b82f6'
        },
        {
            title: 'Campañas Masivas y Analítica',
            description: 'Llegue a miles de clientes con un solo clic. Mida la tasa de entrega, lectura y conversión en tiempo real con dashboards interactivos y detallados.',
            image: '/images/campaigns_module.png',
            icon: <BarChart />,
            color: '#f59e0b'
        },
        {
            title: 'CRM Kanban Integrado',
            description: 'Visualice su embudo de ventas de manera intuitiva. Mueva sus leads entre etapas personalizables y asegure el cierre de cada negocio.',
            image: '/images/kanban_module.png',
            icon: <DashboardIcon />,
            color: '#8b5cf6'
        },
        {
            title: 'Agenda Electrónica Inteligente',
            description: 'Gestione citas y reservas sin esfuerzo. El sistema envía recordatorios automáticos por WhatsApp para eliminar las inasistencias por completo.',
            image: '/images/agenda_module.png',
            icon: <Schedule />,
            color: '#ef4444'
        },
        {
            title: 'API REST para Desarrolladores',
            description: 'Poderosa infraestructura escalable. Integre Whinsap con cualquier sistema externo mediante nuestra API robusta y de baja latencia.',
            image: '/images/api_module.png',
            icon: <Dns />,
            color: '#06b6d4'
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
        if (plan.api_enabled) features.push('API REST Profesional');
        return features;
    };

    return (
        <Box sx={{ bgcolor: '#020617', minHeight: '100vh', overflowX: 'hidden', color: 'white' }}>
            {/* Header / Navbar */}
            <AppBar position="fixed" sx={{
                bgcolor: 'rgba(2, 6, 23, 0.8)',
                backdropFilter: 'blur(10px)',
                boxShadow: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                zIndex: 1100
            }}>
                <Container maxWidth="xl">
                    <Toolbar sx={{ justifyContent: 'space-between', py: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{
                                width: 42,
                                height: 42,
                                borderRadius: '12px',
                                bgcolor: '#10b981',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)'
                            }}>
                                <WhatsApp sx={{ color: 'white', fontSize: 28 }} />
                            </Box>
                            <Typography variant="h5" sx={{
                                fontWeight: 800,
                                letterSpacing: '-0.02em',
                                background: 'linear-gradient(to right, #fff, #94a3b8)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent'
                            }}>
                                Whinsap
                            </Typography>
                        </Box>

                        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 4 }}>
                            {['Inicio', 'Funciones', 'Planes', 'Contacto'].map((item) => (
                                <Typography
                                    key={item}
                                    onClick={() => scrollToSection(item.toLowerCase())}
                                    sx={{
                                        color: '#94a3b8',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        '&:hover': { color: '#10b981' },
                                        transition: 'color 0.2s'
                                    }}
                                >
                                    {item}
                                </Typography>
                            ))}
                        </Box>

                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Button
                                variant="text"
                                onClick={() => navigate('/login')}
                                sx={{ color: 'white', fontWeight: 600, textTransform: 'none' }}
                            >
                                Iniciar Sesión
                            </Button>
                            <Button
                                variant="contained"
                                onClick={() => navigate('/register')}
                                sx={{
                                    bgcolor: '#10b981',
                                    fontWeight: 600,
                                    borderRadius: '10px',
                                    px: 3,
                                    textTransform: 'none',
                                    '&:hover': { bgcolor: '#059669', transform: 'translateY(-2px)' },
                                    transition: 'all 0.2s'
                                }}
                            >
                                Pruébalo Ahora
                            </Button>
                        </Box>
                    </Toolbar>
                </Container>
            </AppBar>

            {/* Hero Section */}
            <Box id="inicio" sx={{
                position: 'relative',
                pt: { xs: 15, md: 20 },
                pb: { xs: 10, md: 15 },
                background: 'radial-gradient(circle at 50% -20%, rgba(16, 185, 129, 0.15) 0%, transparent 50%)'
            }}>
                <Container maxWidth="xl">
                    <Grid container spacing={8} alignItems="center">
                        <Grid item xs={12} md={6}>
                            <MotionBox
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6 }}
                            >
                                <Chip
                                    label="Nueva Versión 2026"
                                    sx={{
                                        bgcolor: 'rgba(16, 185, 129, 0.1)',
                                        color: '#10b981',
                                        fontWeight: 700,
                                        mb: 3,
                                        border: '1px solid rgba(16, 185, 129, 0.2)'
                                    }}
                                />
                                <Typography variant="h1" sx={{
                                    fontSize: { xs: '3rem', md: '5rem' },
                                    fontWeight: 900,
                                    lineHeight: 1.1,
                                    mb: 3,
                                    letterSpacing: '-0.04em'
                                }}>
                                    Potencie su Empresa con <Box component="span" sx={{ color: '#10b981' }}>Whinsap</Box> Profesional
                                </Typography>
                                <Typography variant="h5" sx={{ color: '#94a3b8', mb: 5, lineHeight: 1.6, fontWeight: 400, maxWidth: 600 }}>
                                    La plataforma líder en automatización de WhatsApp. Gestión multi-agente, IA avanzada y CRM integrado para equipos de alto rendimiento.
                                </Typography>

                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
                                    <Button
                                        variant="contained"
                                        size="large"
                                        onClick={() => navigate('/register')}
                                        endIcon={<ArrowForward />}
                                        sx={{
                                            bgcolor: '#10b981',
                                            height: 56,
                                            px: 5,
                                            fontSize: '1.1rem',
                                            borderRadius: '14px',
                                            fontWeight: 700,
                                            textTransform: 'none',
                                            '&:hover': { bgcolor: '#059669', transform: 'scale(1.02)' },
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        Comenzar Ahora
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        size="large"
                                        onClick={() => scrollToSection('funciones')}
                                        startIcon={<PlayArrow />}
                                        sx={{
                                            borderColor: 'rgba(255,255,255,0.1)',
                                            color: 'white',
                                            height: 56,
                                            px: 4,
                                            fontSize: '1.1rem',
                                            borderRadius: '14px',
                                            fontWeight: 600,
                                            textTransform: 'none',
                                            '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.05)' }
                                        }}
                                    >
                                        Ver Funciones
                                    </Button>
                                </Stack>
                            </MotionBox>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <MotionBox
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.8, delay: 0.2 }}
                                sx={{ position: 'relative' }}
                            >
                                <Paper sx={{
                                    p: 1.5,
                                    bgcolor: 'rgba(30, 41, 59, 0.5)',
                                    borderRadius: '24px',
                                    backdropFilter: 'blur(20px)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    boxShadow: '0 40px 100px rgba(0,0,0,0.5)'
                                }}>
                                    <Box
                                        component="img"
                                        src={`${process.env.PUBLIC_URL}/images/hero_dashboard.png`}
                                        alt="Whinsap Dashboard"
                                        sx={{
                                            width: '100%',
                                            height: 'auto',
                                            borderRadius: '16px',
                                            display: 'block'
                                        }}
                                    />
                                </Paper>

                                {/* Badge Flotante para efecto Premium */}
                                <Box sx={{
                                    position: 'absolute',
                                    bottom: -20,
                                    right: -20,
                                    bgcolor: '#1e293b',
                                    p: 2,
                                    borderRadius: '16px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                                    display: { xs: 'none', lg: 'block' }
                                }}>
                                    <Stack direction="row" spacing={2} alignItems="center">
                                        <CircularProgress variant="determinate" value={100} size={40} sx={{ color: '#10b981' }} />
                                        <Box>
                                            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>Efectividad de envío</Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 800 }}>99.9% Exitoso</Typography>
                                        </Box>
                                    </Stack>
                                </Box >
                            </MotionBox >
                        </Grid >
                    </Grid >
                </Container >
            </Box >

            {/* Features Section */}
            < Box id="funciones" sx={{ py: 15, bgcolor: 'rgba(2, 6, 23, 0.5)' }}>
                < Container maxWidth="xl">
                    < Box sx={{ textAlign: 'center', mb: 10, position: 'relative' }}>
                        <Typography
                            variant="h1"
                            sx={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                fontSize: { xs: '5rem', md: '10rem' },
                                fontWeight: 900,
                                color: 'rgba(16, 185, 129, 0.03)',
                                zIndex: 0,
                                whiteSpace: 'nowrap',
                                pointerEvents: 'none',
                                textTransform: 'uppercase'
                            }}
                        >
                            Whinsap Suite
                        </Typography >
                        <MotionTypography
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            variant="h2"
                            sx={{ fontWeight: 800, mb: 2, position: 'relative', zIndex: 1 }}
                        >
                            Ecosistema < Box component="span" sx={{ color: '#10b981' }}>Whinsap</Box> Profesional
                        </MotionTypography >
                        <MotionTypography
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            variant="h6"
                            sx={{ color: '#94a3b8', maxWidth: 800, mx: 'auto', position: 'relative', zIndex: 1 }}
                        >
                            Potencie su comunicación con el conjunto de herramientas más avanzado y moderno de la industria.Diseñado para empresas de alto rendimiento.
                        </MotionTypography >
                    </Box >

                    <Grid container spacing={4}>
                        {coreFeatures.map((feature, index) => (
                            <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
                                <MotionCard
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    whileInView={{ opacity: 1, scale: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.05 }}
                                    sx={{
                                        height: '100%',
                                        bgcolor: 'rgba(30, 41, 59, 0.3)',
                                        borderRadius: '24px',
                                        border: '1px solid rgba(255,255,255,0.05)',
                                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        '&:hover': {
                                            transform: 'translateY(-12px)',
                                            bgcolor: 'rgba(30, 41, 59, 0.5)',
                                            border: `1px solid ${feature.color}44`,
                                            boxShadow: `0 30px 60px ${feature.color}15`
                                        }
                                    }}
                                >
                                    <Box sx={{ width: '100%', height: 160, overflow: 'hidden', position: 'relative' }}>
                                        <Box
                                            component="img"
                                            src={feature.image}
                                            alt={feature.title}
                                            sx={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                                opacity: 0.6,
                                                filter: 'brightness(0.7)',
                                                transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                                '&:hover': { opacity: 0.9, filter: 'brightness(1)', transform: 'scale(1.1)' }
                                            }}
                                        />
                                        <Box sx={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            background: `linear-gradient(to bottom, transparent 30%, rgba(2, 6, 23, 0.9) 100%)`
                                        }} />
                                        <Box sx={{
                                            position: 'absolute',
                                            bottom: 12,
                                            left: 12,
                                            width: 44,
                                            height: 44,
                                            borderRadius: '12px',
                                            bgcolor: `${feature.color}20`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: feature.color,
                                            backdropFilter: 'blur(10px)',
                                            border: `1px solid ${feature.color}40`,
                                            boxShadow: `0 4px 12px rgba(0,0,0,0.5)`
                                        }}>
                                            {feature.icon}
                                        </Box>
                                    </Box>

                                    <CardContent sx={{ p: 3, pt: 1, flexGrow: 1, position: 'relative' }}>
                                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                                            <Chip
                                                label="WHINSAP CORE"
                                                size="small"
                                                sx={{
                                                    height: 18,
                                                    fontSize: '0.55rem',
                                                    fontWeight: 900,
                                                    bgcolor: `${feature.color}15`,
                                                    color: feature.color,
                                                    border: `1px solid ${feature.color}20`,
                                                    letterSpacing: 0.5
                                                }}
                                            />
                                            <Typography variant="caption" sx={{ color: '#475569', fontWeight: 800, fontSize: '0.65rem' }}>EN VIVO</Typography>
                                        </Stack>

                                        <Typography variant="h6" sx={{
                                            fontWeight: 800,
                                            mb: 1.5,
                                            fontSize: '1.2rem',
                                            letterSpacing: '-0.01em',
                                            color: 'white'
                                        }}>
                                            {feature.title}
                                        </Typography>

                                        <Typography sx={{
                                            color: '#94a3b8',
                                            lineHeight: 1.6,
                                            fontSize: '0.85rem',
                                            fontWeight: 400
                                        }}>
                                            {feature.description}
                                        </Typography>
                                    </CardContent>
                                    <Box sx={{ p: 3, pt: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10b981' }} />
                                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, letterSpacing: 0.5 }}>SISTEMA ACTIVO</Typography>
                                    </Box >
                                </MotionCard >
                            </Grid >
                        ))}
                    </Grid >
                </Container >
            </Box >


            {/* Pricing Section */}
            < Box id="planes" sx={{ py: 15 }}>
                < Container maxWidth="xl">
                    < Box sx={{ textAlign: 'center', mb: 10 }}>
                        <Typography variant="h2" sx={{ fontWeight: 800, mb: 2 }}>Planes que Escalan con Usted</Typography>
                        < Typography variant="h6" sx={{ color: '#94a3b8' }}>Simple, transparente y potente. Comience hoy mismo.</Typography>
                    </Box >

                    {
                        loadingPlans ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }} >
                                <CircularProgress sx={{ color: '#10b981' }} />
                            </Box >
                        ) : (
                            <Grid container spacing={4} justifyContent="center" alignItems="stretch">
                                {
                                    plans.map((plan, index) => {
                                        const isRecommended = index === 1 || plans.length === 1;
                                        const planFeatures = renderPlanFeatures(plan);

                                        return (
                                            <Grid item xs={12} md={4} key={plan.id}>
                                                <MotionCard
                                                    initial={{ opacity: 0, y: 30 }}
                                                    whileInView={{ opacity: 1, y: 0 }}
                                                    viewport={{ once: true }}
                                                    transition={{ delay: index * 0.1 }}
                                                    sx={{
                                                        height: '100%',
                                                        bgcolor: isRecommended ? '#1e293b' : 'rgba(30,41,59,0.3)',
                                                        borderRadius: '24px',
                                                        border: isRecommended ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.05)',
                                                        position: 'relative',
                                                        transform: isRecommended ? 'scale(1.05)' : 'none',
                                                        zIndex: isRecommended ? 2 : 1,
                                                        display: 'flex',
                                                        flexDirection: 'column'
                                                    }}
                                                >
                                                    {isRecommended && (
                                                        <Chip
                                                            label="MÁS POPULAR"
                                                            sx={{
                                                                position: 'absolute',
                                                                top: -12,
                                                                left: '50%',
                                                                transform: 'translateX(-50%)',
                                                                bgcolor: '#10b981',
                                                                color: 'white',
                                                                fontWeight: 900,
                                                                fontSize: '0.7rem'
                                                            }}
                                                        />
                                                    )}
                                                    <CardContent sx={{ p: 5, flexGrow: 1 }}>
                                                        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>{plan.name}</Typography>
                                                        <Box sx={{ mb: 4 }}>
                                                            <Typography component="span" variant="h3" sx={{ fontWeight: 800, color: '#10b981' }}>
                                                                ₲{plan.price.toLocaleString('es-PY')}
                                                            </Typography>
                                                            <Typography component="span" variant="h6" sx={{ color: '#94a3b8' }}>/mes</Typography>
                                                        </Box>

                                                        <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)', mb: 4 }} />

                                                        <List sx={{ mb: 4 }}>
                                                            {planFeatures.map((item, idx) => (
                                                                <ListItem key={idx} sx={{ px: 0, py: 1 }}>
                                                                    <ListItemIcon sx={{ minWidth: 32 }}>
                                                                        <CheckCircle sx={{ color: '#10b981', fontSize: 20 }} />
                                                                    </ListItemIcon>
                                                                    <ListItemText
                                                                        primary={item}
                                                                        primaryTypographyProps={{ sx: { color: '#cbd5e1', fontWeight: 500 } }}
                                                                    />
                                                                </ListItem>
                                                            ))}
                                                        </List>
                                                    </CardContent >
                                                    <Box sx={{ p: 5, pt: 0 }}>
                                                        <Button
                                                            variant={isRecommended ? 'contained' : 'outlined'}
                                                            fullWidth
                                                            size="large"
                                                            onClick={() => navigate('/register')}
                                                            sx={{
                                                                height: 56,
                                                                borderRadius: '14px',
                                                                fontWeight: 700,
                                                                textTransform: 'none',
                                                                bgcolor: isRecommended ? '#10b981' : 'transparent',
                                                                borderColor: '#10b981',
                                                                color: isRecommended ? 'white' : '#10b981',
                                                                '&:hover': {
                                                                    bgcolor: isRecommended ? '#059669' : 'rgba(16,185,129,0.05)',
                                                                    borderColor: '#10b981'
                                                                }
                                                            }}
                                                        >
                                                            Empezar ahora
                                                        </Button>
                                                    </Box >
                                                </MotionCard >
                                            </Grid >
                                        );
                                    })}
                            </Grid >
                        )}
                </Container >
            </Box >

            {/* Final CTA */}
            < Box id="contacto" sx={{ py: 20, textAlign: 'center' }}>
                < Container maxWidth="md">
                    < MotionBox
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        sx={{
                            p: { xs: 5, md: 8 },
                            bgcolor: '#1e293b',
                            borderRadius: '40px',
                            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            boxShadow: '0 40px 100px rgba(0,0,0,0.4)'
                        }}
                    >
                        <Typography variant="h2" sx={{ fontWeight: 800, mb: 3 }}>¿Listo para el siguiente nivel?</Typography>
                        < Typography variant="h6" sx={{ color: '#94a3b8', mb: 5 }}>
                            Únase a cientos de empresas que ya automatizan y escalan sus conversaciones con Whinsap.
                        </Typography >
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
                            < Button
                                variant="contained"
                                size="large"
                                onClick={() => navigate('/register')}
                                sx={{
                                    bgcolor: '#10b981',
                                    height: 56,
                                    px: 5,
                                    fontSize: '1.1rem',
                                    borderRadius: '14px',
                                    fontWeight: 700,
                                    '&:hover': { bgcolor: '#059669' }
                                }}
                            >
                                Crear Cuenta Gratis
                            </Button >
                            <Button
                                variant="outlined"
                                size="large"
                                onClick={() => window.open("https://wa.me/yournumber", "_blank")}
                                startIcon={< WhatsApp />}
                                sx={{
                                    borderColor: 'rgba(255,255,255,0.1)',
                                    color: 'white',
                                    height: 56,
                                    px: 4,
                                    fontSize: '1.1rem',
                                    borderRadius: '14px',
                                    fontWeight: 600,
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                                }}
                            >
                                Hablar con Ventas
                            </Button >
                        </Stack >
                    </MotionBox >
                </Container >
            </Box >

            {/* Footer */}
            < Box sx={{ py: 10, bgcolor: '#010413', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <Container maxWidth="xl">
                    < Grid container spacing={8} >
                        <Grid item xs={12} md={4}>
                            <Typography variant="h5" sx={{ fontWeight: 900, mb: 3 }}>Whinsap</Typography>
                            <Typography sx={{ color: '#64748b', mb: 4, maxWidth: 300 }}>
                                Potenciando la comunicación empresarial en la era digital con inteligencia artificial y automatización de clase mundial.
                            </Typography>
                            <Stack direction="row" spacing={2}>
                                {/* Social icons would go here */}
                            </Stack >
                        </Grid >
                        <Grid item xs={6} md={2}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 3 }}>Producto</Typography>
                            <Stack spacing={2}>
                                <Typography sx={{ color: '#64748b', cursor: 'pointer', '&:hover': { color: '#10b981' } }}>Funciones</Typography>
                                <Typography sx={{ color: '#64748b', cursor: 'pointer', '&:hover': { color: '#10b981' } }}>API</Typography>
                                <Typography sx={{ color: '#64748b', cursor: 'pointer', '&:hover': { color: '#10b981' } }}>Precios</Typography>
                            </Stack>
                        </Grid >
                        <Grid item xs={6} md={2}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 3 }}>Empresa</Typography>
                            <Stack spacing={2}>
                                <Typography sx={{ color: '#64748b', cursor: 'pointer', '&:hover': { color: '#10b981' } }}>Sobre nosotros</Typography>
                                <Typography sx={{ color: '#64748b', cursor: 'pointer', '&:hover': { color: '#10b981' } }}>Contacto</Typography>
                                <Typography sx={{ color: '#64748b', cursor: 'pointer', '&:hover': { color: '#10b981' } }}>Legal</Typography>
                            </Stack>
                        </Grid >
                        <Grid item xs={12} md={4}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 3 }}>Soporte</Typography>
                            <Typography sx={{ color: '#64748b', mb: 3 }}>
                                ¿Necesita ayuda? Nuestro equipo técnico está disponible 24/7 para asistirle.
                            </Typography>
                            <Button variant="text" sx={{ color: '#10b981', fontWeight: 700, p: 0 }}>
                                centrodeayuda@whinsap.com
                            </Button >
                        </Grid >
                    </Grid >
                    <Divider sx={{ my: 8, borderColor: 'rgba(255,255,255,0.05)' }} />
                    <Typography variant="body2" sx={{ color: '#475569', textAlign: 'center' }}>
                        © 2026 Whinsap Enterprise Solutions.Todos los derechos reservados.
                    </Typography >
                </Container >
            </Box >

            {/* Floating WhatsApp Button */}
            < Fab
                color="primary"
                sx={{
                    position: 'fixed',
                    bottom: 30,
                    right: 30,
                    bgcolor: '#25D366',
                    '&:hover': { bgcolor: '#128C7E' },
                    zIndex: 1000
                }}
                onClick={() => window.open("https://wa.me/yournumber", "_blank")}
            >
                <WhatsApp />
            </Fab >
        </Box >
    );
};

export default LandingPageComplete;
