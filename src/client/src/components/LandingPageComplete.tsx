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
    BarChart,
    Notifications,
    Sms,
    TouchApp,
    Code,
    Send,
    Link,
    Image,
    Timer,
    AccountBalance,
    CreditScore,
    AccountBalanceWallet,
    ReceiptLong,
    Payments,
    PointOfSale
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import WinsapLogo from './WinsapLogo';

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

    // SEO: Inyectar datos estructurados JSON-LD
    useEffect(() => {
        const structuredData = {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Winsap",
            "operatingSystem": "Web",
            "applicationCategory": "BusinessApplication, CRM, Marketing",
            "description": "Plataforma profesional de WhatsApp Marketing, SMS masivo, CRM multi-agente y Chatbot IA.",
            "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
            },
            "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.9",
                "ratingCount": "1250"
            }
        };

        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.innerHTML = JSON.stringify(structuredData);
        document.head.appendChild(script);

        return () => {
            document.head.removeChild(script);
        };
    }, []);

    const coreFeatures = [
        {
            icon: <Campaign sx={{ fontSize: 32 }} />,
            title: 'WhatsApp Masivo Profesional',
            description: 'Realice envíos masivos por WhatsApp de forma segura. Campañas automatizadas para miles de contactos en segundos.',
            color: '#10b981',
            image: '/images/campaigns_module.png'
        },
        {
            icon: <Schedule sx={{ fontSize: 32 }} />,
            title: 'Envíos Programados de WhatsApp',
            description: 'Automatice su comunicación programando mensajes de WhatsApp para fechas y horas específicas. Eficacia total.',
            color: '#3b82f6',
            image: '/images/agenda_module.png'
        },
        {
            icon: <AutoGraph sx={{ fontSize: 32 }} />,
            title: 'Personalización de Mensajes',
            description: 'Cree mensajes únicos con variables dinámicas. Marketing personalizado por WhatsApp para aumentar conversiones.',
            color: '#8b5cf6',
            image: '/images/chatbot_module.png'
        },
        {
            icon: <DashboardIcon sx={{ fontSize: 32 }} />,
            title: 'CRM con WhatsApp & Kanban',
            description: 'El mejor CRM con WhatsApp integrado. Gestione su embudo de ventas visualmente y no pierda ningún lead.',
            color: '#f59e0b',
            image: '/images/kanban_module.png'
        },
        {
            icon: <NotificationsActive sx={{ fontSize: 32 }} />,
            title: 'Agenda & Recordatorios WhatsApp',
            description: 'Sistema de citas con recordatorios automáticos por WhatsApp. Reduzca inasistencias de forma inteligente.',
            color: '#ef4444',
            image: '/images/agenda_module.png'
        },
        {
            icon: <Dns sx={{ fontSize: 32 }} />,
            title: 'Winsap API REST Professional',
            description: 'Potente API para integrar Winsap con su ERP o sistemas propios.',
            color: '#06b6d4',
            image: '/images/api_module.png'
        },
        {
            icon: <Groups sx={{ fontSize: 32 }} />,
            title: 'Winsap Gestión de Agentes',
            description: 'Control total de roles, permisos y desempeño de su equipo.',
            color: '#ec4899',
            image: '/images/multiagent_module.png'
        },
        {
            icon: <Message sx={{ fontSize: 32 }} />,
            title: 'Winsap Chat Multi-Agente',
            description: 'Varios miembros del equipo atendiendo la misma línea oficial.',
            color: '#10b981',
            image: '/images/multiagent_module.png'
        },
        {
            icon: <TrackChanges sx={{ fontSize: 32 }} />,
            title: 'Winsap Monitoreo en Vivo',
            description: 'Supervise conversaciones en tiempo real para asegurar calidad.',
            color: '#6366f1',
            image: '/images/hero_dashboard.png'
        },
        {
            icon: <History sx={{ fontSize: 32 }} />,
            title: 'Winsap Historial Auditable',
            description: 'Registro completo de cada mensaje, envío y respuesta del sistema.',
            color: '#94a3b8',
            image: '/images/api_module.png'
        },
        {
            icon: <BarChart sx={{ fontSize: 32 }} />,
            title: 'Winsap Métricas Reales',
            description: 'Dashboard analítico con estados de campañas y tasas de lectura.',
            color: '#f97316',
            image: '/images/campaigns_module.png'
        },
        {
            icon: <Speed sx={{ fontSize: 32 }} />,
            title: 'Winsap Estados de Envío',
            description: 'Tracking en tiempo real: Enviado, Entregado y Leído (Doble Check).',
            color: '#22c55e',
            image: '/images/hero_dashboard.png'
        },
        // NUEVOS SERVICIOS - NOTIFICACIONES PUSH
        {
            icon: <Notifications sx={{ fontSize: 32 }} />,
            title: 'Winsap Notificaciones Push',
            description: 'Campañas de notificaciones push masivas en tiempo real para sus usuarios.',
            color: '#ff5722',
            image: '/images/campaigns_module.png'
        },
        {
            icon: <Image sx={{ fontSize: 32 }} />,
            title: 'Winsap Push con Imágenes',
            description: 'Envíe notificaciones push con imágenes, banners y contenido multimedia.',
            color: '#e91e63',
            image: '/images/campaigns_module.png'
        },
        {
            icon: <Link sx={{ fontSize: 32 }} />,
            title: 'Winsap Push con URLs',
            description: 'Notificaciones con enlaces directos que redirigen a su app o sitio web.',
            color: '#9c27b0',
            image: '/images/campaigns_module.png'
        },
        {
            icon: <TouchApp sx={{ fontSize: 32 }} />,
            title: 'Winsap Métricas Push',
            description: 'Mida clics, aperturas y conversiones de sus campañas push en tiempo real.',
            color: '#673ab7',
            image: '/images/analytics_module.png'
        },
        // NUEVOS SERVICIOS - SMS
        {
            icon: <Sms sx={{ fontSize: 32 }} />,
            title: 'SMS Masivo & Marketing',
            description: 'Combine WhatsApp con SMS masivo. Envíe mensajes de texto a cualquier operadora con alta tasa de entrega.',
            color: '#2196f3',
            image: '/images/campaigns_module.png'
        },
        {
            icon: <Timer sx={{ fontSize: 32 }} />,
            title: 'Programación de SMS',
            description: 'Programe sus campañas de SMS masivo. Ideal para notificaciones urgentes, alertas y marketing directo.',
            color: '#03a9f4',
            image: '/images/agenda_module.png'
        },
        {
            icon: <Campaign sx={{ fontSize: 32 }} />,
            title: 'Campañas de SMS Integradas',
            description: 'Cree campañas omnicanal. Gestione WhatsApp y SMS desde un solo dashboard con métricas reales.',
            color: '#00bcd4',
            image: '/images/campaigns_module.png'
        },
        // NUEVOS SERVICIOS - APIs
        {
            icon: <Code sx={{ fontSize: 32 }} />,
            title: 'Winsap API WhatsApp',
            description: 'API completa para enviar y recibir mensajes de WhatsApp desde su sistema.',
            color: '#009688',
            image: '/images/api_module.png'
        },
        {
            icon: <Send sx={{ fontSize: 32 }} />,
            title: 'Winsap API SMS',
            description: 'API REST para integrar envío de SMS en sus aplicaciones y sistemas.',
            color: '#4caf50',
            image: '/images/api_module.png'
        },
        {
            icon: <NotificationsActive sx={{ fontSize: 32 }} />,
            title: 'Winsap API Push',
            description: 'API para enviar notificaciones push programáticas desde su backend.',
            color: '#8bc34a',
            image: '/images/api_module.png'
        },
        // NUEVOS SERVICIOS - GESTIÓN Y CRÉDITOS
        {
            icon: <AccountBalance sx={{ fontSize: 32 }} />,
            title: 'Gestión Administrativa',
            description: 'Registre todos sus movimientos financieros: ingresos, egresos y balances detallados para un control total.',
            color: '#0ea5e9',
            image: '/images/hero_dashboard.png'
        },
        {
            icon: <CreditScore sx={{ fontSize: 32 }} />,
            title: 'Sistema de Créditos',
            description: 'Gestione acreedores y cuotas con fechas personalizadas. Notificaciones automáticas de vencimiento por WhatsApp.',
            color: '#f59e0b',
            image: '/images/kanban_module.png'
        },
        {
            icon: <Payments sx={{ fontSize: 32 }} />,
            title: 'Cuotas y Cobranzas',
            description: 'El sistema detecta vencimientos y envía recordatorios automáticos por WhatsApp para asegurar el pago de cada cuota.',
            color: '#10b981',
            image: '/images/agenda_module.png'
        },
        {
            icon: <ReceiptLong sx={{ fontSize: 32 }} />,
            title: 'Balances Financieros',
            description: 'Visualice su rentabilidad real con balances automatizados de ingresos vs egresos por periodos seleccionados.',
            color: '#6366f1',
            image: '/images/analytics_module.png'
        }
    ];

    const showcaseModules = [
        {
            title: 'Chatbot IA para WhatsApp',
            description: 'Automatice su atención al cliente con Chatbots inteligentes que entienden el lenguaje natural y responden 24/7 sin intervención humana.',
            image: '/images/chatbot_module.png',
            icon: <WhatsApp />,
            color: '#10b981'
        },
        {
            title: 'Plataforma Multi-Agente Profesional',
            description: 'Centralice todas sus líneas de WhatsApp en un solo lugar. Varios agentes atendiendo la misma línea con transferencias y CRM integrado.',
            image: '/images/multiagent_module.png',
            icon: <People />,
            color: '#3b82f6'
        },
        {
            title: 'WhatsApp Masivo & Campañas',
            description: 'Llegue a miles de clientes potenciales. Envíe promociones, avisos o noticias de forma masiva y analice los resultados en tiempo real.',
            image: '/images/campaigns_module.png',
            icon: <BarChart />,
            color: '#f59e0b'
        },
        {
            title: 'CRM con WhatsApp & Kanban',
            description: 'Organice su flujo de ventas con un tablero Kanban intuitivo vinculado directamente a sus conversaciones de WhatsApp.',
            image: '/images/kanban_module.png',
            icon: <DashboardIcon />,
            color: '#8b5cf6'
        },
        {
            title: 'Agenda & Citas Automatizadas',
            description: 'Olvídese de las inasistencias. Nuestro sistema agenda citas y envía recordatorios automáticos por WhatsApp a sus clientes.',
            image: '/images/agenda_module.png',
            icon: <Schedule />,
            color: '#ef4444'
        },
        {
            title: 'API de WhatsApp para Desarrolladores',
            description: 'Infraestructura robusta para integrar WhatsApp en cualquier sistema o aplicación móvil con facilidad y seguridad.',
            image: '/images/api_module.png',
            icon: <Dns />,
            color: '#06b6d4'
        },
        // NUEVOS MÓDULOS DESTACADOS
        {
            title: 'Notificaciones Push Masivas',
            description: 'Aumente el engagement de sus usuarios enviando notificaciones push personalizadas con imágenes y enlaces directos a su sitio.',
            image: '/images/campaigns_module.png',
            icon: <Notifications />,
            color: '#ff5722'
        },
        {
            title: 'Marketing por SMS Masivo',
            description: 'Combine el poder de WhatsApp y SMS. Envíe mensajes de texto programados y personalizados a gran escala de forma eficiente.',
            image: '/images/campaigns_module.png',
            icon: <Sms />,
            color: '#2196f3'
        },
        {
            title: 'Solución Multi-Canal API',
            description: 'Una única API para gestionar WhatsApp, SMS y Push. Simplifique su desarrollo e integración con nuestras APIs unificadas.',
            image: '/images/api_module.png',
            icon: <Code />,
            color: '#9c27b0'
        },
        {
            title: 'ERP & Gestión de Créditos',
            description: 'Gestione su negocio al completo. Desde el control financiero hasta la automatización de cobranzas y recuperación de cartera por WhatsApp.',
            image: '/images/hero_dashboard.png',
            icon: <AccountBalanceWallet />,
            color: '#0ea5e9'
        }
    ];

    const renderPlanFeatures = (plan: Plan) => {
        const features = [];

        // Canales y Mensajería
        features.push(`${plan.max_channels} ${plan.max_channels === 1 ? 'Canal' : 'Canales'} WhatsApp`);

        if (plan.max_messages >= 999999) {
            features.push('Mensajes ilimitados');
        } else {
            features.push(`${plan.max_messages.toLocaleString()} Mensajes/mes`);
        }

        // Multi-Agente
        features.push(`${plan.max_agents} ${plan.max_agents === 1 ? 'Agente' : 'Agentes'} de atención`);

        // Automatización y API
        if (plan.bot_enabled) features.push('Chatbot IA con Inteligencia Neural');
        if (plan.api_enabled) {
            features.push('API WhatsApp Business Profesional');
            features.push('API SMS Masivo para Integración');
        }

        // Módulos Especializados (Nuevos)
        features.push('Notificaciones Push Masivas');
        features.push('Envío de SMS Masivo & Marketing');
        features.push('Gestión Administrativa (Ingresos/Egresos)');
        features.push('Sistema de Créditos & Acreedores');
        features.push('Cobranzas Automáticas por WhatsApp');
        features.push('Balances Financieros en Tiempo Real');
        features.push('CRM Kanban & Embudo de Ventas');

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
                                bgcolor: 'rgba(255,255,255,0.05)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 0 20px rgba(16, 185, 129, 0.1)'
                            }}>
                                <WinsapLogo sx={{ fontSize: 32 }} />
                            </Box>
                            <Typography variant="h5" sx={{
                                fontWeight: 800,
                                letterSpacing: '-0.02em',
                                background: 'linear-gradient(to right, #fff, #94a3b8)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent'
                            }}>
                                Winsap
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
                                    WhatsApp Masivo, <Box component="span" sx={{ color: '#10b981' }}>CRM</Box> & Chatbot IA
                                </Typography>
                                <Typography variant="h5" sx={{ color: '#94a3b8', mb: 5, lineHeight: 1.6, fontWeight: 400, maxWidth: 600 }}>
                                    Llegue a sus clientes donde siempre están. La plataforma profesional de WhatsApp Marketing para envíos masivos, gestión multi-agente y automatización de procesos.
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
                                        alt="Winsap Dashboard"
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
                            Winsap Suite
                        </Typography >
                        <MotionTypography
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            variant="h2"
                            sx={{ fontWeight: 800, mb: 2, position: 'relative', zIndex: 1 }}
                        >
                            Ecosistema < Box component="span" sx={{ color: '#10b981' }}>Winsap</Box> Profesional
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
                        <Typography variant="h2" sx={{ fontWeight: 800, mb: 3 }}>Potencie su Negocio con WhatsApp Masivo</Typography>
                        <Typography variant="h6" sx={{ color: '#94a3b8', mb: 5 }}>
                            Únase a cientos de empresas que ya automatizan su marketing por WhatsApp y escalan sus ventas con el CRM de Winsap.
                        </Typography>
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
                            <Typography variant="h5" sx={{ fontWeight: 900, mb: 3 }}>Winsap</Typography>
                            <Typography sx={{ color: '#64748b', mb: 4, maxWidth: 300 }}>
                                Potenciando la comunicación empresarial en la era digital con inteligencia artificial y automatización de clase mundial.
                            </Typography>
                            <Stack direction="row" spacing={2}>
                                {/* Social icons would go here */}
                            </Stack >
                        </Grid >
                        <Grid item xs={6} md={2}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 3 }}>Servicios SEO</Typography>
                            <Stack spacing={2}>
                                <Typography sx={{ color: '#64748b', cursor: 'pointer', '&:hover': { color: '#10b981' } }}>WhatsApp Masivo</Typography>
                                <Typography sx={{ color: '#64748b', cursor: 'pointer', '&:hover': { color: '#10b981' } }}>CRM WhatsApp</Typography>
                                <Typography sx={{ color: '#64748b', cursor: 'pointer', '&:hover': { color: '#10b981' } }}>Notificaciones Push</Typography>
                                <Typography sx={{ color: '#64748b', cursor: 'pointer', '&:hover': { color: '#10b981' } }}>SMS Masivo Internacional</Typography>
                                <Typography sx={{ color: '#64748b', cursor: 'pointer', '&:hover': { color: '#10b981' } }}>API WhatsApp Business</Typography>
                                <Typography sx={{ color: '#64748b', cursor: 'pointer', '&:hover': { color: '#10b981' } }}>Planes y Precios</Typography>
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
                                soporte@winsap.com.py
                            </Button>
                        </Grid >
                    </Grid >
                    <Divider sx={{ my: 8, borderColor: 'rgba(255,255,255,0.05)' }} />
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="body2" sx={{ color: '#475569', mb: 1 }}>
                            © 2026 Winsap Enterprise Solutions - winsap.com.py
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', display: 'block' }}>
                            Todos los Derechos Reservados por CNID Centro-Nacional-Información-Digital NRO REG:17789
                        </Typography>
                    </Box>
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
