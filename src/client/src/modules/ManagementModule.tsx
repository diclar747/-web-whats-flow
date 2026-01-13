import React, { useState } from 'react';
import {
    Box,
    Container,
    Typography,
    Tabs,
    Tab,
    Paper,
    Breadcrumbs,
    Link,
    IconButton,
    Tooltip,
    Stack,
    useTheme,
    alpha
} from '@mui/material';
import {
    Assessment,
    ReceiptLong,
    AccountBalance,
    Category,
    Refresh,
    NavigateNext
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

import ManagementOverview from './management/ManagementOverview';
import ManagementRecords from './management/ManagementRecords';
import ManagementBudgets from './management/ManagementBudgets';
import ManagementCategories from './management/ManagementCategories';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

const TabPanel = (props: TabPanelProps) => {
    const { children, value, index, ...other } = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`management-tabpanel-${index}`}
            aria-labelledby={`management-tab-${index}`}
            {...other}
            style={{ overflow: 'hidden' }}
        >
            <AnimatePresence mode="wait">
                {value === index && (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <Box sx={{ py: { xs: 2, md: 4 } }}>
                            {children}
                        </Box>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const ManagementModule: React.FC<{ sessionId: string }> = ({ sessionId }) => {
    const [activeTab, setActiveTab] = useState(0);
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
    };

    return (
        <Box sx={{
            minHeight: '100vh',
            background: isDark
                ? `linear-gradient(135deg, ${theme.palette.background.default} 0%, ${alpha(theme.palette.background.paper, 0.8)} 100%)`
                : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            position: 'relative',
            overflow: 'hidden',
            color: theme.palette.text.primary,
            pb: 8
        }}>
            {/* Background Decorative Elements */}
            <Box sx={{
                position: 'absolute', top: -100, right: -100, width: 400, height: 400,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 70%)`,
                zIndex: 0
            }} />
            <Box sx={{
                position: 'absolute', bottom: -150, left: -150, width: 500, height: 500,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${alpha(theme.palette.success.main, 0.05)} 0%, transparent 70%)`,
                zIndex: 0
            }} />

            <Container maxWidth="xl" sx={{ py: 4, position: 'relative', zIndex: 1 }}>
                {/* Header Section */}
                <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                >
                    <Box sx={{ mb: 5, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'flex-end' }, gap: 3 }}>
                        <Box>
                            <Breadcrumbs separator={<NavigateNext fontSize="small" sx={{ color: theme.palette.text.disabled }} />} sx={{ mb: 1.5 }}>
                                <Link underline="none" color="inherit" href="#" sx={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', fontWeight: 500, color: theme.palette.text.secondary }}>
                                    WhatsFlow
                                </Link>
                                <Typography color="primary" sx={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', fontWeight: 600 }}>
                                    Administración Inteligente
                                </Typography>
                            </Breadcrumbs>
                            <Typography variant="h3" sx={{
                                fontWeight: 900,
                                color: theme.palette.text.primary,
                                letterSpacing: '-0.04em',
                                background: isDark
                                    ? `linear-gradient(90deg, ${theme.palette.text.primary} 0%, ${theme.palette.primary.light} 100%)`
                                    : 'linear-gradient(90deg, #0f172a 0%, #3f51b5 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                mb: 1
                            }}>
                                Centro Financiero
                            </Typography>
                            <Typography variant="h6" sx={{ color: theme.palette.text.secondary, fontWeight: 400, maxWidth: 600, lineHeight: 1.6 }}>
                                Visualiza, controla y proyecta el crecimiento de tu negocio con herramientas de precisión quirúrgica.
                            </Typography>
                        </Box>

                        <Stack direction="row" spacing={2}>
                            <Tooltip title="Actualizar Datos">
                                <IconButton
                                    onClick={() => window.location.reload()}
                                    sx={{
                                        bgcolor: alpha(theme.palette.background.paper, 0.7),
                                        backdropFilter: 'blur(8px)',
                                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                                        boxShadow: theme.shadows[2],
                                        color: theme.palette.text.primary,
                                        '&:hover': { bgcolor: theme.palette.background.paper, transform: 'rotate(180deg)', transition: 'all 0.4s ease' }
                                    }}
                                >
                                    <Refresh />
                                </IconButton>
                            </Tooltip>
                        </Stack>
                    </Box>
                </motion.div>

                {/* Tabs Navigation - Premium Style */}
                <Paper sx={{
                    borderRadius: '24px',
                    p: 1,
                    mb: 2,
                    boxShadow: isDark ? '0 20px 40px rgba(0,0,0,0.3)' : '0 20px 40px rgba(0,0,0,0.04)',
                    background: alpha(theme.palette.background.paper, 0.75),
                    backdropFilter: 'blur(20px)',
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    overflowX: 'auto',
                    '::-webkit-scrollbar': { display: 'none' }
                }}>
                    <Tabs
                        value={activeTab}
                        onChange={handleTabChange}
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{
                            '& .MuiTabs-indicator': {
                                height: '100%',
                                borderRadius: '18px',
                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                zIndex: 0
                            },
                            '& .MuiTab-root': {
                                py: 2,
                                px: { xs: 2, md: 4 },
                                fontWeight: 700,
                                fontSize: '0.95rem',
                                color: theme.palette.text.secondary,
                                zIndex: 1,
                                textTransform: 'none',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                minHeight: 64,
                                borderRadius: '18px',
                                mr: 1,
                                '&:hover': { color: theme.palette.primary.main, background: alpha(theme.palette.primary.main, 0.05) },
                                '&.Mui-selected': { color: theme.palette.primary.main }
                            },
                        }}
                    >
                        <Tab icon={<Assessment sx={{ mr: 1 }} />} iconPosition="start" label="Inteligencia & Datos" />
                        <Tab icon={<ReceiptLong sx={{ mr: 1 }} />} iconPosition="start" label="Libro Mayor" />
                        <Tab icon={<AccountBalance sx={{ mr: 1 }} />} iconPosition="start" label="Estrategia Presupuestaria" />
                        <Tab icon={<Category sx={{ mr: 1 }} />} iconPosition="start" label="Taxonomía" />
                    </Tabs>
                </Paper>

                {/* Tab Content with Animation Wrapper in TabPanel */}
                <TabPanel value={activeTab} index={0}>
                    <ManagementOverview />
                </TabPanel>
                <TabPanel value={activeTab} index={1}>
                    <ManagementRecords />
                </TabPanel>
                <TabPanel value={activeTab} index={2}>
                    <ManagementBudgets />
                </TabPanel>
                <TabPanel value={activeTab} index={3}>
                    <ManagementCategories />
                </TabPanel>
            </Container>
        </Box>
    );
};

export default ManagementModule;
