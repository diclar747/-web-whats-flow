import React, { useState, useEffect } from 'react';
import {
    Box, Container, Typography, Button, TextField,
    Dialog, DialogTitle, DialogContent, DialogActions,
    Snackbar, Alert, Paper, Grid, Tabs, Tab,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    IconButton, Chip, Card, CardContent, CircularProgress,
    Tooltip, MenuItem, Select, FormControl, InputLabel,
    Divider, alpha, useTheme, Zoom, Fade, Stack
} from '@mui/material';
import {
    Notifications, Add, Link as LinkIcon, People,
    Send, BarChart, Delete, Edit, Refresh,
    Visibility, ContentCopy, CheckCircle, ErrorOutline,
    GroupWork, Mouse, Assessment, TrendingUp, History,
    DeviceHub, Language, OpenInNew, Warning,
    SignalCellularAlt, Wifi, BatteryFull, FlashlightOn, CameraAlt
} from '@mui/icons-material';
import axios from 'axios';

// Componente para Diálogos de Confirmación Estilizados
const StyledConfirmDialog: React.FC<{
    open: boolean;
    title: string;
    message: string;
    onClose: () => void;
    onConfirm: () => void;
    loading?: boolean;
    confirmText?: string;
    confirmColor?: 'error' | 'primary' | 'success' | 'warning';
}> = ({ open, title, message, onClose, onConfirm, loading, confirmText = 'Eliminar', confirmColor = 'error' }) => (
    <Dialog open={open} onClose={onClose} TransitionComponent={Zoom} maxWidth="xs" fullWidth
        PaperProps={{
            sx: { borderRadius: 3, p: 1, bgcolor: 'background.paper', backgroundImage: 'none' }
        }}
    >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: `${confirmColor}.main` }}>
            <Warning color={confirmColor} /> {title}
        </DialogTitle>
        <DialogContent>
            <Typography variant="body1">{message}</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
            <Button onClick={onClose} disabled={loading} sx={{ borderRadius: 2 }}>Cancelar</Button>
            <Button onClick={onConfirm} variant="contained" color={confirmColor} disabled={loading}
                sx={{
                    borderRadius: 2, px: 3,
                    boxShadow: confirmColor === 'error' ? '0 4px 14px 0 rgba(239, 68, 68, 0.39)' :
                        confirmColor === 'primary' ? '0 4px 14px 0 rgba(59, 130, 246, 0.39)' : 'none'
                }}
            >
                {loading ? <CircularProgress size={24} /> : confirmText}
            </Button>
        </DialogActions>
    </Dialog>
);

const PushNotificationsModule: React.FC = () => {
    const theme = useTheme();
    // States
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<any[]>([]);
    const [urls, setUrls] = useState<any[]>([]);
    const [subscribers, setSubscribers] = useState<any[]>([]);
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [stats, setStats] = useState<any>({ total: 0, active: 0, unsubscribed: 0, this_month: 0 });
    const [overview, setOverview] = useState<any>({});

    // Dialogs
    const [categoryDialog, setCategoryDialog] = useState(false);
    const [urlDialog, setUrlDialog] = useState(false);
    const [campaignDialog, setCampaignDialog] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    // Deletion Modal
    const [confirmDelete, setConfirmDelete] = useState<{ open: boolean, type: 'category' | 'url' | 'campaign', id: number | null }>({
        open: false, type: 'category', id: null
    });

    // Confirmation for campaign resend
    const [confirmResend, setConfirmResend] = useState<{ open: boolean, id: number | null }>({
        open: false, id: null
    });

    // Forms
    const [categoryForm, setCategoryForm] = useState({ name: '', description: '', color: '#3b82f6' });
    const [urlForm, setUrlForm] = useState({ name: '', categoryId: null as number | null, redirectUrl: '' });
    const [campaignForm, setCampaignForm] = useState({
        name: '', title: '', description: '', imageUrl: '', actionUrl: '',
        targetAll: true, targetCategoryIds: [] as number[], sendImmediately: true
    });

    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as any });

    const getAuthHeaders = () => {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        return {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };
    };

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeTab === 0) await loadCategories();
            if (activeTab === 1) await loadUrls();
            if (activeTab === 2) {
                await loadSubscribers();
                await loadStats();
            }
            if (activeTab === 3) await loadCampaigns();
            if (activeTab === 4) await loadAnalytics();
        } catch (error) {
            console.error('[PUSH] Error general de carga:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadCategories = async () => {
        try {
            const res = await axios.get('/api/push/categories', getAuthHeaders());
            setCategories(res.data.categories || []);
        } catch (error: any) {
            setSnackbar({ open: true, message: 'Error cargando categorías', severity: 'error' });
            setCategories([]);
        }
    };

    const loadUrls = async () => {
        try {
            const res = await axios.get('/api/push/urls', getAuthHeaders());
            setUrls(res.data.urls || []);
        } catch (error) {
            setUrls([]);
        }
    };

    const loadSubscribers = async () => {
        try {
            const res = await axios.get('/api/push/subscribers', getAuthHeaders());
            setSubscribers(res.data.subscribers || []);
        } catch (error) {
            setSubscribers([]);
        }
    };

    const loadCampaigns = async () => {
        try {
            const res = await axios.get('/api/push/campaigns', getAuthHeaders());
            setCampaigns(res.data.campaigns || []);
        } catch (error) {
            setCampaigns([]);
        }
    };

    const loadStats = async () => {
        try {
            const res = await axios.get('/api/push/subscribers/stats', getAuthHeaders());
            setStats(res.data.stats || { total: 0, active: 0, unsubscribed: 0, this_month: 0 });
        } catch (error) { }
    };

    const loadAnalytics = async () => {
        try {
            const res = await axios.get('/api/push/analytics/overview', getAuthHeaders());
            setOverview(res.data.overview || {});
        } catch (error) { }
    };

    // Actions
    const handleCreateCategory = async () => {
        if (!categoryForm.name) return;
        try {
            if (editingId) {
                await axios.put(`/api/push/categories/${editingId}`, categoryForm, getAuthHeaders());
                setSnackbar({ open: true, message: 'Categoría actualizada exitosamente', severity: 'success' });
            } else {
                await axios.post('/api/push/categories', categoryForm, getAuthHeaders());
                setSnackbar({ open: true, message: 'Categoría creada con éxito', severity: 'success' });
            }
            setCategoryDialog(false);
            setEditingId(null);
            setCategoryForm({ name: '', description: '', color: '#3b82f6' });
            loadCategories();
        } catch (error: any) {
            setSnackbar({ open: true, message: error.response?.data?.error || 'Error la realizar la acción', severity: 'error' });
        }
    };

    const executeDeletion = async () => {
        if (!confirmDelete.id) return;
        try {
            let endpoint = '';
            if (confirmDelete.type === 'category') endpoint = `/api/push/categories/${confirmDelete.id}`;
            if (confirmDelete.type === 'url') endpoint = `/api/push/urls/${confirmDelete.id}`;
            if (confirmDelete.type === 'campaign') endpoint = `/api/push/campaigns/${confirmDelete.id}`;

            await axios.delete(endpoint, getAuthHeaders());
            setSnackbar({ open: true, message: 'Elemento eliminado correctamente', severity: 'success' });
            setConfirmDelete({ open: false, type: 'category', id: null });
            loadData();
        } catch (error: any) {
            setSnackbar({ open: true, message: 'Error al intentar eliminar el elemento', severity: 'error' });
        }
    };

    const handleResendCampaign = async () => {
        if (!confirmResend.id) return;

        try {
            setLoading(true);
            await axios.post(`/api/push/campaigns/${confirmResend.id}/resend`, {}, getAuthHeaders());
            setSnackbar({ open: true, message: '✅ Campaña reenviada con éxito', severity: 'success' });
            loadCampaigns();
            setConfirmResend({ open: false, id: null });
        } catch (error: any) {
            setSnackbar({ open: true, message: 'Error al reenviar la campaña', severity: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleEditCategory = (cat: any) => {
        setEditingId(cat.id);
        setCategoryForm({
            name: cat.name,
            description: cat.description || '',
            color: cat.color || '#3b82f6'
        });
        setCategoryDialog(true);
    };

    const handleCreateUrl = async () => {
        if (!urlForm.name) return;
        try {
            if (editingId) {
                await axios.put(`/api/push/urls/${editingId}`, urlForm, getAuthHeaders());
                setSnackbar({ open: true, message: 'URL actualizada exitosamente', severity: 'success' });
            } else {
                await axios.post('/api/push/urls', urlForm, getAuthHeaders());
                setSnackbar({ open: true, message: 'Enlace de suscripción generado', severity: 'success' });
            }
            setUrlDialog(false);
            setEditingId(null);
            setUrlForm({ name: '', categoryId: null, redirectUrl: '' });
            loadUrls();
        } catch (error: any) {
            setSnackbar({ open: true, message: error.response?.data?.error || 'Error en el servidor', severity: 'error' });
        }
    };

    const handleEditUrl = (u: any) => {
        setEditingId(u.id);
        setUrlForm({
            name: u.name,
            categoryId: u.category_id,
            redirectUrl: u.redirect_url || ''
        });
        setUrlDialog(true);
    };

    const handleCreateCampaign = async () => {
        if (!campaignForm.name || !campaignForm.title) return;
        try {
            await axios.post('/api/push/campaigns', campaignForm, getAuthHeaders());
            setSnackbar({ open: true, message: 'La notificación está en camino', severity: 'success' });
            setCampaignDialog(false);
            setCampaignForm({
                name: '', title: '', description: '', imageUrl: '', actionUrl: '',
                targetAll: true, targetCategoryIds: [], sendImmediately: true
            });
            loadCampaigns();
        } catch (error: any) {
            setSnackbar({ open: true, message: error.response?.data?.error || 'Error al enviar campaña', severity: 'error' });
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setSnackbar({ open: true, message: 'Enlace copiado al portapapeles', severity: 'success' });
    };

    // Helper para Cards de Estadísticas Pro
    const StatCard = ({ title, value, icon, color }: any) => (
        <Paper elevation={0} sx={{
            p: 2.5, borderRadius: 4, display: 'flex', alignItems: 'center', gap: 2,
            bgcolor: alpha(color, 0.05), border: `1px solid ${alpha(color, 0.1)}`,
            transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' }
        }}>
            <Box sx={{
                p: 1.5, borderRadius: 3, bgcolor: alpha(color, 0.1), color: color,
                display: 'flex', justifyContent: 'center', alignItems: 'center'
            }}>
                {icon}
            </Box>
            <Box>
                <Typography variant="h5" fontWeight="800" color="text.primary">{value}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {title}
                </Typography>
            </Box>
        </Paper>
    );

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Fade in={true} timeout={800}>
                <Box>
                    {/* HEADER */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{
                                bgcolor: 'primary.main', p: 1.5, borderRadius: 3,
                                display: 'flex', boxShadow: '0 8px 16px -4px rgba(59, 130, 246, 0.5)'
                            }}>
                                <Notifications sx={{ fontSize: 32, color: 'white' }} />
                            </Box>
                            <Box>
                                <Typography variant="h4" fontWeight="900" sx={{ letterSpacing: -1 }}>Notificaciones Push</Typography>
                                <Typography variant="body2" color="text.secondary">Gestiona tus canales de comunicación directa y campañas masivas</Typography>
                            </Box>
                        </Box>
                        <Button
                            variant="contained"
                            startIcon={<Refresh />}
                            onClick={() => loadData()}
                            sx={{ borderRadius: 3, px: 3, bgcolor: 'background.paper', color: 'text.primary', '&:hover': { bgcolor: 'background.default' } }}
                        >
                            Actualizar
                        </Button>
                    </Box>

                    {/* TABS SOFISTICADAS */}
                    <Paper sx={{
                        mb: 5.5, p: 0.8, borderRadius: 4,
                        bgcolor: alpha(theme.palette.background.paper, 0.6),
                        backdropFilter: 'blur(10px)', border: '1px solid', borderColor: 'divider'
                    }} elevation={0}>
                        <Tabs
                            value={activeTab}
                            onChange={(_, v) => setActiveTab(v)}
                            variant="fullWidth"
                            sx={{
                                '& .MuiTabs-indicator': { height: '100%', borderRadius: 3, zIndex: 0, bgcolor: alpha(theme.palette.primary.main, 0.1) },
                                '& .MuiTab-root': { zIndex: 1, minHeight: 48, fontWeight: 700, borderRadius: 3, color: 'text.secondary' },
                                '& .Mui-selected': { color: 'primary.main !important' }
                            }}
                        >
                            <Tab icon={<GroupWork sx={{ fontSize: 20 }} />} label="Categorías" iconPosition="start" />
                            <Tab icon={<LinkIcon sx={{ fontSize: 20 }} />} label="Enlaces" iconPosition="start" />
                            <Tab icon={<People sx={{ fontSize: 20 }} />} label="Suscriptores" iconPosition="start" />
                            <Tab icon={<Send sx={{ fontSize: 20 }} />} label="Campañas" iconPosition="start" />
                            <Tab icon={<Assessment sx={{ fontSize: 20 }} />} label="Global" iconPosition="start" />
                        </Tabs>
                    </Paper>

                    {loading ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 15, gap: 2 }}>
                            <CircularProgress size={50} thickness={4} />
                            <Typography color="text.secondary" fontWeight="600">Sincronizando datos...</Typography>
                        </Box>
                    ) : (
                        <Box>
                            {/* TAB CATEGORIES */}
                            {activeTab === 0 && (
                                <Box>
                                    <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography variant="h6" fontWeight="800">Grupos de Segmentación</Typography>
                                        <Button
                                            variant="contained"
                                            startIcon={<Add />}
                                            onClick={() => {
                                                setEditingId(null);
                                                setCategoryForm({ name: '', description: '', color: '#3b82f6' });
                                                setCategoryDialog(true);
                                            }}
                                            sx={{ borderRadius: 3, px: 3, py: 1, fontWeight: 700, boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)' }}
                                        >
                                            Nueva Categoría
                                        </Button>
                                    </Box>
                                    <Grid container spacing={3}>
                                        {categories.length === 0 ? (
                                            <Grid item xs={12}>
                                                <Box sx={{ p: 8, textAlign: 'center', bgcolor: alpha(theme.palette.background.paper, 0.5), borderRadius: 6, border: '2px dashed', borderColor: 'divider' }}>
                                                    <GroupWork sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
                                                    <Typography variant="h6" color="text.secondary" fontWeight="700">Comienza segmentando tu audiencia</Typography>
                                                    <Typography variant="body2" color="text.disabled">Las categorías te ayudan a enviar mensajes a las personas correctas.</Typography>
                                                </Box>
                                            </Grid>
                                        ) : (
                                            categories.map((cat) => (
                                                <Grid item xs={12} sm={6} md={4} key={cat.id}>
                                                    <Card sx={{
                                                        borderRadius: 4, height: '100%', border: '1px solid', borderColor: 'divider',
                                                        backgroundImage: `linear-gradient(135deg, ${alpha(cat.color, 0.15)} 0%, ${alpha(cat.color, 0.02)} 100%)`,
                                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        '&:hover': { transform: 'scale(1.02)', boxShadow: `0 12px 24px -10px ${alpha(cat.color, 0.3)}`, borderColor: cat.color }
                                                    }}>
                                                        <CardContent sx={{ p: 3 }}>
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                                                <Box>
                                                                    <Typography variant="h5" fontWeight="900" color="text.primary">{cat.name}</Typography>
                                                                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>{cat.description || 'Sin descripción'}</Typography>
                                                                </Box>
                                                                <Chip
                                                                    label={`${cat.subscriber_count || 0} subs`}
                                                                    size="small"
                                                                    sx={{ bgcolor: cat.color, color: 'white', fontWeight: 'bold' }}
                                                                />
                                                            </Box>
                                                            <Divider sx={{ my: 2, borderColor: alpha(cat.color, 0.2) }} />
                                                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                                                                <IconButton
                                                                    sx={{ bgcolor: alpha(theme.palette.text.primary, 0.05), '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' } }}
                                                                    onClick={() => handleEditCategory(cat)}
                                                                >
                                                                    <Edit fontSize="small" />
                                                                </IconButton>
                                                                <IconButton
                                                                    sx={{ bgcolor: alpha(theme.palette.error.main, 0.05), color: 'error.main', '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.15) } }}
                                                                    onClick={() => setConfirmDelete({ open: true, type: 'category', id: cat.id })}
                                                                >
                                                                    <Delete fontSize="small" />
                                                                </IconButton>
                                                            </Box>
                                                        </CardContent>
                                                    </Card>
                                                </Grid>
                                            ))
                                        )}
                                    </Grid>
                                </Box>
                            )}

                            {/* TAB URLS */}
                            {activeTab === 1 && (
                                <Box>
                                    <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography variant="h6" fontWeight="800">Enlaces de Captación</Typography>
                                        <Button
                                            variant="contained"
                                            startIcon={<Add />}
                                            onClick={() => {
                                                setEditingId(null);
                                                setUrlForm({ name: '', categoryId: null, redirectUrl: '' });
                                                setUrlDialog(true);
                                            }}
                                            sx={{ borderRadius: 3, px: 3, fontWeight: 700 }}
                                        >
                                            Nueva URL
                                        </Button>
                                    </Box>
                                    <TableContainer component={Paper} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                                        <Table>
                                            <TableHead sx={{ bgcolor: alpha(theme.palette.background.default, 0.5) }}>
                                                <TableRow>
                                                    <TableCell sx={{ fontWeight: 800 }}>NOMBRE INTERNO</TableCell>
                                                    <TableCell sx={{ fontWeight: 800 }}>PREVISUALIZACIÓN DE ENLACE</TableCell>
                                                    <TableCell sx={{ fontWeight: 800 }}>SEGMENTO</TableCell>
                                                    <TableCell sx={{ fontWeight: 800 }} align="center">SUSCRIPTORES</TableCell>
                                                    <TableCell sx={{ fontWeight: 800 }} align="right">ACCIONES</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {urls.map((u) => (
                                                    <TableRow key={u.id} sx={{ '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.01) } }}>
                                                        <TableCell sx={{ fontWeight: 700 }}>{u.name}</TableCell>
                                                        <TableCell>
                                                            <Box sx={{
                                                                display: 'flex', alignItems: 'center', gap: 1,
                                                                bgcolor: alpha(theme.palette.background.default, 0.8), p: 1, pr: 0.5, borderRadius: 2, maxWidth: 350
                                                            }}>
                                                                <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {`${window.location.origin}/subscribe/${u.url_code}`}
                                                                </Typography>
                                                                <Tooltip title="Copiar enlace">
                                                                    <IconButton size="small" onClick={() => copyToClipboard(`${window.location.origin}/subscribe/${u.url_code}`)}>
                                                                        <ContentCopy fontSize="inherit" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                                <Tooltip title="Abrir">
                                                                    <IconButton size="small" component="a" href={`${window.location.origin}/subscribe/${u.url_code}`} target="_blank">
                                                                        <OpenInNew fontSize="inherit" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={u.category_name || 'General'}
                                                                size="small"
                                                                sx={{
                                                                    bgcolor: alpha(u.category_color || '#94a3b8', 0.1),
                                                                    color: u.category_color || '#94a3b8',
                                                                    fontWeight: 800, border: '1px solid', borderColor: alpha(u.category_color || '#94a3b8', 0.2)
                                                                }}
                                                            />
                                                        </TableCell>
                                                        <TableCell align="center">
                                                            <Typography fontWeight="800">{u.subscriber_count}</Typography>
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                                <IconButton size="small" color="primary" onClick={() => handleEditUrl(u)} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}><Edit fontSize="small" /></IconButton>
                                                                <IconButton size="small" color="error" onClick={() => setConfirmDelete({ open: true, type: 'url', id: u.id })} sx={{ bgcolor: alpha(theme.palette.error.main, 0.05) }}><Delete fontSize="small" /></IconButton>
                                                            </Stack>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Box>
                            )}

                            {/* TAB SUBSCRIBERS */}
                            {activeTab === 2 && (
                                <Box>
                                    <Grid container spacing={3} sx={{ mb: 5 }}>
                                        <Grid item xs={12} sm={3}>
                                            <StatCard title="Suscriptores Totales" value={stats.total} icon={<People fontSize="large" />} color={theme.palette.primary.main} />
                                        </Grid>
                                        <Grid item xs={12} sm={3}>
                                            <StatCard title="Activos Ahora" value={stats.active} icon={<CheckCircle fontSize="large" />} color={theme.palette.success.main} />
                                        </Grid>
                                        <Grid item xs={12} sm={3}>
                                            <StatCard title="Bajas / Bloqueos" value={stats.unsubscribed} icon={<ErrorOutline fontSize="large" />} color={theme.palette.error.main} />
                                        </Grid>
                                        <Grid item xs={12} sm={3}>
                                            <StatCard title="Nuevos (Crecimiento)" value={stats.this_month} icon={<TrendingUp fontSize="large" />} color={theme.palette.info.main} />
                                        </Grid>
                                    </Grid>

                                    <Typography variant="h6" fontWeight="800" sx={{ mb: 3 }}>Listado de Dispositivos Registrados</Typography>
                                    <TableContainer component={Paper} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
                                        <Table>
                                            <TableHead sx={{ bgcolor: alpha(theme.palette.background.default, 0.5) }}>
                                                <TableRow>
                                                    <TableCell sx={{ fontWeight: 800 }}>USUARIO</TableCell>
                                                    <TableCell sx={{ fontWeight: 800 }}>SEGMENTO</TableCell>
                                                    <TableCell sx={{ fontWeight: 800 }}>ESTADO</TableCell>
                                                    <TableCell sx={{ fontWeight: 800 }}>AGENTE / SISTEMA</TableCell>
                                                    <TableCell sx={{ fontWeight: 800 }}>FECHA REGISTRO</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {subscribers.map((s) => (
                                                    <TableRow key={s.id}>
                                                        <TableCell>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                                <Box sx={{ p: 1, borderRadius: '50%', bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', display: 'flex' }}>
                                                                    <People sx={{ fontSize: 18 }} />
                                                                </Box>
                                                                <Box>
                                                                    <Typography variant="body2" fontWeight="800">{s.subscriber_name || 'Visitante Anónimo'}</Typography>
                                                                    <Typography variant="caption" color="text.secondary">{s.subscriber_email || s.ip_address}</Typography>
                                                                </Box>
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell>
                                                            {s.category_name ? (
                                                                <Chip
                                                                    label={s.category_name}
                                                                    size="small"
                                                                    sx={{
                                                                        bgcolor: alpha(s.category_color || '#3b82f6', 0.1),
                                                                        color: s.category_color || '#3b82f6',
                                                                        fontWeight: 800, border: '1px solid', borderColor: alpha(s.category_color || '#3b82f6', 0.2)
                                                                    }}
                                                                />
                                                            ) : (
                                                                <Typography variant="caption" color="text.secondary" fontWeight="600">General</Typography>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {s.is_active ?
                                                                <Chip label="ACTIVO" size="small" sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.main', fontWeight: 900, height: 20, fontSize: 10 }} /> :
                                                                <Chip label="INACTIVO" size="small" sx={{ bgcolor: alpha(theme.palette.error.main, 0.1), color: 'error.main', fontWeight: 900, height: 20, fontSize: 10 }} />
                                                            }
                                                        </TableCell>
                                                        <TableCell>
                                                            <Tooltip title={s.user_agent}>
                                                                <Typography variant="caption" sx={{
                                                                    p: 0.5, px: 1, bgcolor: alpha(theme.palette.text.disabled, 0.1), borderRadius: 1.5,
                                                                    color: 'text.secondary', fontWeight: 500, fontSize: 11, display: 'inline-block',
                                                                    maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                                }}>
                                                                    {s.user_agent}
                                                                </Typography>
                                                            </Tooltip>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                                                                {new Date(s.subscribed_at).toLocaleDateString()}
                                                            </Typography>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Box>
                            )}

                            {/* TAB CAMPAIGNS */}
                            {activeTab === 3 && (
                                <Box>
                                    <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography variant="h6" fontWeight="800">Historial de Transmisiones</Typography>
                                        <Button
                                            variant="contained"
                                            startIcon={<Send />}
                                            onClick={() => setCampaignDialog(true)}
                                            sx={{ borderRadius: 3, px: 3, py: 1.2, fontWeight: 700, backgroundImage: 'linear-gradient(to right, #3b82f6, #6366f1)' }}
                                        >
                                            Nueva Campaña
                                        </Button>
                                    </Box>
                                    <Grid container spacing={3}>
                                        {campaigns.map((camp) => (
                                            <Grid item xs={12} sm={6} md={4} lg={3} key={camp.id}>
                                                <Card sx={{
                                                    borderRadius: 4,
                                                    bgcolor: '#1e293b', // Slate 800 - cleaner dark
                                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                                                    border: '1px solid rgba(255,255,255,0.05)',
                                                    transition: 'all 0.3s ease',
                                                    display: 'flex', flexDirection: 'column', height: '100%',
                                                    position: 'relative', overflow: 'visible',
                                                    '&:hover': {
                                                        transform: 'translateY(-4px)',
                                                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                                                        borderColor: '#6366f1'
                                                    }
                                                }}>
                                                    {/* 1. Header Image / Gradient Area */}
                                                    <Box sx={{
                                                        height: 120, width: '100%',
                                                        borderTopLeftRadius: 16, borderTopRightRadius: 16,
                                                        position: 'relative',
                                                        overflow: 'hidden',
                                                        backgroundImage: camp.image_url ? `url(${camp.image_url})` : 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                                                        backgroundSize: 'cover', backgroundPosition: 'center',
                                                    }}>
                                                        <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.3)' }} /> {/* Overlay */}

                                                        {/* Status Badge */}
                                                        <Chip
                                                            label={camp.status === 'sent' ? 'ENVIADO' : (camp.status === 'sending' ? 'ENVIANDO' : 'BORRADOR')}
                                                            size="small"
                                                            sx={{
                                                                position: 'absolute', top: 12, right: 12, // Removed zIndex
                                                                bgcolor: camp.status === 'sent' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(245, 158, 11, 0.9)',
                                                                color: 'white', fontWeight: 800, fontSize: 10,
                                                                backdropFilter: 'blur(4px)',
                                                                height: 20
                                                            }}
                                                        />
                                                    </Box>

                                                    {/* 2. Floating Icon */}
                                                    <Box sx={{
                                                        width: 44, height: 44,
                                                        bgcolor: '#0f172a', // Darker bg
                                                        borderRadius: '12px',
                                                        border: '4px solid #1e293b', // Matches card bg
                                                        position: 'absolute', top: 96, left: 20,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                                                        zIndex: 2 // Low zIndex just to sit above card path
                                                    }}>
                                                        <Notifications sx={{ color: 'white', fontSize: 20 }} />
                                                    </Box>

                                                    <CardContent sx={{ pt: 5, px: 2.5, pb: 2.5, flex: 1, display: 'flex', flexDirection: 'column' }}>
                                                        {/* Title */}
                                                        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 700, fontSize: 10, mb: 0.5, letterSpacing: 0.5 }}>
                                                            {camp.name?.toUpperCase()}
                                                        </Typography>
                                                        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1, lineHeight: 1.3, fontSize: 16, minHeight: 42 }}>
                                                            {camp.title}
                                                        </Typography>

                                                        {/* DYNAMIC PERFORMANCE CHART (Area Chart) */}
                                                        {/* Visualizes: Sent -> Delivered -> Viewed -> Clicked */}
                                                        <Box sx={{
                                                            mt: 1, mb: 2, height: 80, position: 'relative',
                                                            bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 3, overflow: 'hidden',
                                                            display: 'flex', alignItems: 'flex-end'
                                                        }}>
                                                            {(() => {
                                                                // Calculate Data Points
                                                                const sent = camp.total_sent || 0;
                                                                const dlvr = camp.total_delivered || 0;
                                                                const view = camp.total_viewed || 0;
                                                                const clck = camp.total_clicked || 0;

                                                                // Find true max to normalize chart properly (avoid negative coordinates if view > sent)
                                                                const maxValue = Math.max(sent, dlvr, view, clck, 1);

                                                                // Normalizing height (max height 50px inside 80px container to leave top padding)
                                                                const h = 50;
                                                                const paddingTop = 10;

                                                                // Helper to calculate Y position (inverted for SVG)
                                                                const getY = (val: number) => {
                                                                    const normalized = (val / maxValue) * h;
                                                                    return h + paddingTop - normalized; // Inverted: 0 is top, so h - val puts it at bottom if val is small
                                                                };

                                                                const ySent = getY(sent);
                                                                const yDlvr = getY(dlvr);
                                                                const yView = getY(view);
                                                                const yClck = getY(clck);

                                                                // SVG Points (4 distinct points distributed horizontally)
                                                                // x coordinates: 0%, 33%, 66%, 100%

                                                                // Smooth Curve Command (Cubic Bezier approx)
                                                                const pathData = `
                                                                    M 0,${60} 
                                                                    L 0,${ySent} 
                                                                    C 16,${ySent} 16,${yDlvr} 33,${yDlvr} 
                                                                    C 50,${yDlvr} 50,${yView} 66,${yView} 
                                                                    C 83,${yView} 83,${yClck} 100,${yClck} 
                                                                    L 100,${60} Z
                                                                `;

                                                                const linePath = `
                                                                    M 0,${ySent} 
                                                                    C 16,${ySent} 16,${yDlvr} 33,${yDlvr}
                                                                    C 50,${yDlvr} 50,${yView} 66,${yView}
                                                                    C 83,${yView} 83,${yClck} 100,${yClck}
                                                                `;

                                                                return (
                                                                    <svg viewBox="0 0 100 60" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                                                                        <defs>
                                                                            <linearGradient id={`grad-${camp.id}`} x1="0" y1="0" x2="0" y2="1">
                                                                                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
                                                                                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                                                                            </linearGradient>
                                                                            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                                                                                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                                                                                <feMerge>
                                                                                    <feMergeNode in="coloredBlur" />
                                                                                    <feMergeNode in="SourceGraphic" />
                                                                                </feMerge>
                                                                            </filter>
                                                                        </defs>
                                                                        {/* Area Fill */}
                                                                        <path d={pathData} fill={`url(#grad-${camp.id})`} />
                                                                        {/* Stroke Line with Glow */}
                                                                        <path d={linePath} fill="none" stroke="#60a5fa" strokeWidth="3" vectorEffect="non-scaling-stroke" filter="url(#glow)" />

                                                                        {/* Dots with white fill and blue border */}
                                                                        <circle cx="0" cy={ySent} r="2" fill="#1e293b" stroke="#60a5fa" strokeWidth="1" />
                                                                        <circle cx="33" cy={yDlvr} r="2" fill="#1e293b" stroke="#60a5fa" strokeWidth="1" />
                                                                        <circle cx="66" cy={yView} r="2" fill="#1e293b" stroke="#60a5fa" strokeWidth="1" />
                                                                        <circle cx="100" cy={yClck} r="2" fill="#1e293b" stroke="#60a5fa" strokeWidth="1" />
                                                                    </svg>
                                                                );
                                                            })()}

                                                            {/* Overlay Labels */}
                                                            <Box sx={{ position: 'absolute', bottom: 4, left: 4, right: 4, display: 'flex', justifyContent: 'space-between', px: 1 }}>
                                                                <Typography variant="caption" sx={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Enviado</Typography>
                                                                <Typography variant="caption" sx={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Click</Typography>
                                                            </Box>
                                                        </Box>

                                                        {/* Detailed Stats Row */}
                                                        <Box sx={{
                                                            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, // Increased grid to 4 columns
                                                            p: 1.5, mb: 3,
                                                            bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.03)'
                                                        }}>
                                                            <Box>
                                                                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 9, display: 'block', fontWeight: 700 }}>VOLUMEN</Typography>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                    <Typography variant="subtitle2" sx={{ fontWeight: 900, color: 'white' }}>{camp.total_sent || 0}</Typography>
                                                                    <Typography variant="caption" sx={{ fontSize: 9, color: 'text.disabled', fontWeight: 700 }}>Subs</Typography>
                                                                </Box>
                                                            </Box>
                                                            <Box>
                                                                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 9, display: 'block', fontWeight: 700 }}>VISTOS</Typography>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                    <Typography variant="subtitle2" sx={{ fontWeight: 900, color: 'white' }}>{camp.total_viewed || 0}</Typography>
                                                                    <Typography variant="caption" sx={{ fontSize: 9, color: '#34d399', fontWeight: 700 }}>
                                                                        {camp.total_sent > 0 ? Math.round(((camp.total_viewed || 0) / camp.total_sent) * 100) : 0}%
                                                                    </Typography>
                                                                </Box>
                                                            </Box>
                                                            <Box>
                                                                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 9, display: 'block', fontWeight: 700 }}>CLICKS</Typography>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                    <Typography variant="subtitle2" sx={{ fontWeight: 900, color: 'white' }}>{camp.total_clicked || 0}</Typography>
                                                                    <Typography variant="caption" sx={{ fontSize: 9, color: '#60a5fa', fontWeight: 700 }}>
                                                                        {camp.total_viewed > 0 ? Math.round(((camp.total_clicked || 0) / camp.total_viewed) * 100) : 0}%
                                                                    </Typography>
                                                                </Box>
                                                            </Box>
                                                            <Box>
                                                                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 9, display: 'block', fontWeight: 700 }}>CTR</Typography>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                    <Typography variant="subtitle2" sx={{ fontWeight: 900, color: 'white' }}>
                                                                        {camp.total_sent > 0 ? ((camp.total_clicked / camp.total_sent) * 100).toFixed(1) : '0'}%
                                                                    </Typography>
                                                                </Box>
                                                            </Box>
                                                        </Box>

                                                        {/* Actions Footer */}
                                                        <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 2, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                            <Button
                                                                size="small"
                                                                variant="contained"
                                                                startIcon={<Refresh sx={{ fontSize: 16 }} />}
                                                                onClick={() => setConfirmResend({ open: true, id: camp.id })}
                                                                sx={{
                                                                    borderRadius: 2, fontSize: 11, px: 2, py: 0.5,
                                                                    bgcolor: 'rgba(255,255,255,0.05)', color: 'white', fontWeight: 600, textTransform: 'none',
                                                                    boxShadow: 'none', border: '1px solid rgba(255,255,255,0.1)',
                                                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', boxShadow: 'none' }
                                                                }}
                                                            >
                                                                Reenviar
                                                            </Button>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => setConfirmDelete({ open: true, type: 'campaign', id: camp.id })}
                                                                sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}
                                                            >
                                                                <Delete fontSize="small" />
                                                            </IconButton>
                                                        </Box>
                                                    </CardContent>
                                                </Card>
                                            </Grid>
                                        ))}
                                    </Grid>
                                </Box>
                            )}

                            {/* TAB ANALYTICS */}
                            {activeTab === 4 && (
                                <Box>
                                    <Grid container spacing={3} sx={{ mb: 4 }}>
                                        {/* Left Column: Key KPIs */}
                                        <Grid item xs={12} md={4}>
                                            <Paper sx={{
                                                p: 3, borderRadius: 4, height: '100%',
                                                bgcolor: '#1e293b', color: 'white', // Slate 800
                                                border: '1px solid rgba(255,255,255,0.05)',
                                                display: 'flex', flexDirection: 'column', gap: 3
                                            }}>
                                                <Typography variant="h6" fontWeight="900" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Assessment sx={{ color: '#818cf8' }} /> Resumen Global
                                                </Typography>

                                                <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700, letterSpacing: 1 }}>CAMPAÑAS TOTALES</Typography>
                                                    <Typography variant="h3" fontWeight="900" sx={{ mt: 1, background: '-webkit-linear-gradient(45deg, #fff 30%, #94a3b8 90%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                                        {overview.total_campaigns || 0}
                                                    </Typography>
                                                </Box>

                                                <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700, letterSpacing: 1 }}>NOTIFICACIONES ENVIADAS</Typography>
                                                    <Typography variant="h4" fontWeight="900" sx={{ mt: 1, color: 'white' }}>
                                                        {overview.total_sent || 0}
                                                    </Typography>
                                                </Box>

                                                <Box sx={{
                                                    p: 3, mt: 'auto', borderRadius: 3,
                                                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0) 100%)',
                                                    border: '1px solid rgba(16, 185, 129, 0.2)'
                                                }}>
                                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                                        <Box>
                                                            <Typography variant="caption" sx={{ color: '#34d399', fontWeight: 800 }}>CONVERSIÓN (CTR)</Typography>
                                                            <Typography variant="h3" fontWeight="900" sx={{ color: '#34d399' }}>
                                                                {overview.total_sent > 0 ? ((overview.total_clicked / overview.total_sent) * 100).toFixed(1) : 0}%
                                                            </Typography>
                                                        </Box>
                                                        <TrendingUp sx={{ fontSize: 48, color: '#34d399', opacity: 0.5 }} />
                                                    </Stack>
                                                </Box>
                                            </Paper>
                                        </Grid>

                                        {/* Right Column: Visualizations & Funnel */}
                                        <Grid item xs={12} md={8}>
                                            <Paper sx={{
                                                p: 4, borderRadius: 4, height: '100%',
                                                bgcolor: '#0f172a', color: 'white', // Slate 900
                                                border: '1px solid rgba(255,255,255,0.05)'
                                            }}>
                                                <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Typography variant="h6" fontWeight="900">Rendimiento de Impacto</Typography>
                                                    <Chip label="Global" size="small" sx={{ bgcolor: '#3b82f6', color: 'white', fontWeight: 700 }} />
                                                </Box>

                                                <Grid container spacing={3}>
                                                    {/* Views Card */}
                                                    <Grid item xs={12} sm={6}>
                                                        <Box sx={{
                                                            p: 3, borderRadius: 3, bgcolor: '#1e293b',
                                                            display: 'flex', alignItems: 'center', gap: 2,
                                                            borderLeft: '4px solid #38bdf8'
                                                        }}>
                                                            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>
                                                                <Visibility />
                                                            </Box>
                                                            <Box>
                                                                <Typography variant="h5" fontWeight="900" color="white">{overview.total_viewed || 0}</Typography>
                                                                <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700 }}>VISTAS TOTALES</Typography>
                                                            </Box>
                                                        </Box>
                                                    </Grid>

                                                    {/* Clicks Card */}
                                                    <Grid item xs={12} sm={6}>
                                                        <Box sx={{
                                                            p: 3, borderRadius: 3, bgcolor: '#1e293b',
                                                            display: 'flex', alignItems: 'center', gap: 2,
                                                            borderLeft: '4px solid #4ade80'
                                                        }}>
                                                            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(74, 222, 128, 0.1)', color: '#4ade80' }}>
                                                                <Mouse />
                                                            </Box>
                                                            <Box>
                                                                <Typography variant="h5" fontWeight="900" color="white">{overview.total_clicked || 0}</Typography>
                                                                <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700 }}>CLICKS (INTERACCIÓN)</Typography>
                                                            </Box>
                                                        </Box>
                                                    </Grid>

                                                    {/* GLOBAL FUNNEL CHART */}
                                                    <Grid item xs={12}>
                                                        <Box sx={{ mt: 2, p: 4, borderRadius: 3, bgcolor: '#1e293b', position: 'relative', overflow: 'hidden' }}>
                                                            <Typography variant="subtitle2" sx={{ color: '#94a3b8', fontWeight: 700, mb: 3 }}>EMBUDO DE CONVERSIÓN (GRÁFICO DE ÁREA)</Typography>

                                                            {/* DYNAMIC PERFORMANCE CHART (Area Chart for Global) */}
                                                            <Box sx={{
                                                                height: 200, position: 'relative',
                                                                bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 3, overflow: 'hidden',
                                                                display: 'flex', alignItems: 'flex-end', px: 2, pb: 2
                                                            }}>
                                                                {(() => {
                                                                    // Calculate Data Points based on Overview
                                                                    const sent = overview.total_sent || 0;
                                                                    const dlvr = overview.total_delivered || 0;
                                                                    const view = overview.total_viewed || 0;
                                                                    const clck = overview.total_clicked || 0;

                                                                    // Find true max to normalize chart properly
                                                                    const maxValue = Math.max(sent, dlvr, view, clck, 1);

                                                                    // Normalizing height (max height 160px inside 200px container)
                                                                    const h = 160;
                                                                    const paddingTop = 20;

                                                                    // Helper to calculate Y position (inverted for SVG)
                                                                    const getY = (val: number) => {
                                                                        const normalized = (val / maxValue) * h;
                                                                        return h + paddingTop - normalized;
                                                                    };

                                                                    const ySent = getY(sent);
                                                                    const yDlvr = getY(dlvr);
                                                                    const yView = getY(view);
                                                                    const yClck = getY(clck);

                                                                    // Smooth Curve Command
                                                                    const pathData = `
                                                                        M 0,${180} 
                                                                        L 0,${ySent} 
                                                                        C 16,${ySent} 16,${yDlvr} 33,${yDlvr} 
                                                                        C 50,${yDlvr} 50,${yView} 66,${yView} 
                                                                        C 83,${yView} 83,${yClck} 100,${yClck} 
                                                                        L 100,${180} Z
                                                                    `;

                                                                    const linePath = `
                                                                        M 0,${ySent} 
                                                                        C 16,${ySent} 16,${yDlvr} 33,${yDlvr}
                                                                        C 50,${yDlvr} 50,${yView} 66,${yView}
                                                                        C 83,${yView} 83,${yClck} 100,${yClck}
                                                                    `;

                                                                    return (
                                                                        <svg viewBox="0 0 100 180" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                                                                            <defs>
                                                                                <linearGradient id="grad-global" x1="0" y1="0" x2="0" y2="1">
                                                                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
                                                                                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                                                                                </linearGradient>
                                                                                <filter id="glow-global" x="-50%" y="-50%" width="200%" height="200%">
                                                                                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                                                                                    <feMerge>
                                                                                        <feMergeNode in="coloredBlur" />
                                                                                        <feMergeNode in="SourceGraphic" />
                                                                                    </feMerge>
                                                                                </filter>
                                                                            </defs>
                                                                            {/* Area Fill */}
                                                                            <path d={pathData} fill="url(#grad-global)" />
                                                                            {/* Stroke Line with Glow */}
                                                                            <path d={linePath} fill="none" stroke="#60a5fa" strokeWidth="2" vectorEffect="non-scaling-stroke" filter="url(#glow-global)" />

                                                                            {/* Dots with white fill and blue border - Larger for main chart */}
                                                                            <circle cx="0" cy={ySent} r="1.5" fill="#1e293b" stroke="#60a5fa" strokeWidth="0.5" />
                                                                            <circle cx="33" cy={yDlvr} r="1.5" fill="#1e293b" stroke="#60a5fa" strokeWidth="0.5" />
                                                                            <circle cx="66" cy={yView} r="1.5" fill="#1e293b" stroke="#60a5fa" strokeWidth="0.5" />
                                                                            <circle cx="100" cy={yClck} r="1.5" fill="#1e293b" stroke="#60a5fa" strokeWidth="0.5" />
                                                                        </svg>
                                                                    );
                                                                })()}

                                                                {/* Labels underneath */}
                                                                <Box sx={{ position: 'absolute', bottom: 10, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', zIndex: 2 }}>
                                                                    <Typography variant="caption" sx={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>ENVIADOS</Typography>
                                                                    <Typography variant="caption" sx={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>ENTREGADOS</Typography>
                                                                    <Typography variant="caption" sx={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>VISTOS</Typography>
                                                                    <Typography variant="caption" sx={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>CLICKS</Typography>
                                                                </Box>
                                                            </Box>
                                                        </Box>
                                                    </Grid>
                                                </Grid>
                                            </Paper>
                                        </Grid>
                                    </Grid>
                                </Box>
                            )}
                        </Box>
                    )}
                </Box>
            </Fade>

            {/* DIALOGS */}

            {/* CATEGORY DIALOG */}
            <Dialog open={categoryDialog} onClose={() => setCategoryDialog(false)} maxWidth="sm" fullWidth TransitionComponent={Fade}>
                <DialogTitle sx={{ fontWeight: 900, fontSize: '1.5rem', pb: 0 }}>{editingId ? '⚡ Editar Categoría' : '🚀 Nueva Categoría'}</DialogTitle>
                <DialogContent>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>Define un grupo de usuarios para segmentar tus envíos.</Typography>
                    <TextField
                        fullWidth label="Nombre del Segmento *"
                        value={categoryForm.name}
                        onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                        sx={{ mb: 3 }}
                        variant="filled"
                        placeholder="Ej: Clientes VIP"
                    />
                    <TextField
                        fullWidth label="Descripción (opcional)"
                        value={categoryForm.description}
                        onChange={e => setCategoryForm({ ...categoryForm, description: e.target.value })}
                        sx={{ mb: 3 }}
                        multiline rows={2}
                        variant="filled"
                    />
                    <Box sx={{ p: 2, bgcolor: alpha(theme.palette.background.default, 0.5), borderRadius: 3 }}>
                        <Typography variant="subtitle2" fontWeight="800" gutterBottom>🎨 Color Identificador</Typography>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <input
                                type="color"
                                value={categoryForm.color}
                                onChange={e => setCategoryForm({ ...categoryForm, color: e.target.value })}
                                style={{ width: 60, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'none' }}
                            />
                            <Typography variant="caption" color="text.secondary">Este color aparecerá en los chips de los suscriptores.</Typography>
                        </Stack>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 3 }}>
                    <Button onClick={() => setCategoryDialog(false)} sx={{ fontWeight: 700 }}>Cerrar</Button>
                    <Button variant="contained" onClick={handleCreateCategory} sx={{ borderRadius: 2.5, px: 4, fontWeight: 800 }}>
                        {editingId ? 'Guardar Cambios' : 'Crear Segmento'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* URL DIALOG */}
            <Dialog open={urlDialog} onClose={() => setUrlDialog(false)} maxWidth="sm" fullWidth TransitionComponent={Fade}>
                <DialogTitle sx={{ fontWeight: 900, fontSize: '1.5rem', pb: 0 }}>{editingId ? '✏️ Editar Enlace' : '🔗 Generar Enlace de Suscripción'}</DialogTitle>
                <DialogContent>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>Crea una puerta de entrada para nuevos suscriptores.</Typography>
                    <TextField
                        fullWidth label="Nombre Interno *"
                        value={urlForm.name}
                        onChange={e => setUrlForm({ ...urlForm, name: e.target.value })}
                        sx={{ mb: 3 }}
                        variant="filled"
                        placeholder="Ej: Campaña Facebook Agosto"
                    />
                    <FormControl fullWidth sx={{ mb: 3 }} variant="filled">
                        <InputLabel>Asignar Automáticamente a:</InputLabel>
                        <Select
                            value={urlForm.categoryId || ''}
                            onChange={(e: any) => setUrlForm({ ...urlForm, categoryId: e.target.value })}
                        >
                            <MenuItem value="">Ninguna (General)</MenuItem>
                            {categories.map((cat) => (
                                <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <TextField
                        fullWidth label="URL de Redirección Final"
                        value={urlForm.redirectUrl}
                        onChange={e => setUrlForm({ ...urlForm, redirectUrl: e.target.value })}
                        sx={{ mb: 1 }}
                        variant="filled"
                        placeholder="https://tupagina.com/gracias"
                    />
                    <Typography variant="caption" color="text.disabled">Después de suscribirse, el usuario será enviado aquí.</Typography>
                </DialogContent>
                <DialogActions sx={{ p: 3 }}>
                    <Button onClick={() => setUrlDialog(false)} sx={{ fontWeight: 700 }}>Cancelar</Button>
                    <Button variant="contained" onClick={handleCreateUrl} sx={{ borderRadius: 2.5, px: 4, fontWeight: 800 }}>
                        {editingId ? 'Guardar' : 'Generar Enlace'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* CAMPAIGN DIALOG */}
            <Dialog open={campaignDialog} onClose={() => setCampaignDialog(false)} maxWidth="md" fullWidth TransitionComponent={Zoom}>
                <DialogTitle sx={{ fontWeight: 1000, fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Send color="primary" sx={{ fontSize: 35 }} /> Diseñar Envío Masivo
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={3} sx={{ mt: 1 }}>
                        <Grid item xs={12} md={7}>
                            <Stack spacing={2.5}>
                                <TextField
                                    fullWidth label="Nombre de Campaña (Control Interno)"
                                    value={campaignForm.name}
                                    onChange={e => setCampaignForm({ ...campaignForm, name: e.target.value })}
                                    variant="outlined"
                                    placeholder="Ej: Oferta Relámpago Lunes"
                                />
                                <TextField
                                    fullWidth label="Título Visual de la Notificación *"
                                    value={campaignForm.title}
                                    onChange={e => setCampaignForm({ ...campaignForm, title: e.target.value })}
                                    inputProps={{ style: { fontWeight: 800 } }}
                                />
                                <TextField
                                    fullWidth label="Contenido del Mensaje *"
                                    value={campaignForm.description}
                                    onChange={e => setCampaignForm({ ...campaignForm, description: e.target.value })}
                                    multiline rows={3}
                                />
                                <TextField
                                    fullWidth label="URL de la Imagen Grande"
                                    value={campaignForm.imageUrl}
                                    onChange={e => setCampaignForm({ ...campaignForm, imageUrl: e.target.value })}
                                    placeholder="https://tuhost.com/imagen.jpg"
                                />
                                <TextField
                                    fullWidth label="URL al hacer Click"
                                    value={campaignForm.actionUrl}
                                    onChange={e => setCampaignForm({ ...campaignForm, actionUrl: e.target.value })}
                                    placeholder="https://tutienda.com/producto"
                                    InputProps={{ startAdornment: <LinkIcon sx={{ mr: 1, opacity: 0.5 }} /> }}
                                />

                                <Box sx={{ p: 2.5, bgcolor: alpha(theme.palette.background.default, 0.8), borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
                                    <Typography variant="subtitle2" fontWeight="900" gutterBottom>🎯 Segmentación del Público</Typography>
                                    <FormControl fullWidth sx={{ mt: 2 }} size="small">
                                        <InputLabel>Enviar a:</InputLabel>
                                        <Select
                                            value={campaignForm.targetAll ? 'all' : 'select'}
                                            onChange={(e: any) => setCampaignForm({ ...campaignForm, targetAll: e.target.value === 'all' })}
                                        >
                                            <MenuItem value="all">🌐 Toda la Base de Datos</MenuItem>
                                            <MenuItem value="select">🏷️ Segmentar por Categoría</MenuItem>
                                        </Select>
                                    </FormControl>

                                    {!campaignForm.targetAll && (
                                        <FormControl fullWidth sx={{ mt: 2 }} size="small">
                                            <InputLabel>Seleccionar Categorías</InputLabel>
                                            <Select
                                                multiple
                                                value={campaignForm.targetCategoryIds}
                                                onChange={(e: any) => setCampaignForm({ ...campaignForm, targetCategoryIds: e.target.value })}
                                                renderValue={(selected) => (
                                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                        {selected.map((value: any) => (
                                                            <Chip key={value} label={categories.find(c => c.id === value)?.name} size="small" />
                                                        ))}
                                                    </Box>
                                                )}
                                            >
                                                {categories.map((cat) => (
                                                    <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    )}
                                </Box>
                            </Stack>
                        </Grid>

                        {/* PREVIEW PRO */}
                        <Grid item xs={12} md={5}>
                            <Box sx={{ position: 'sticky', top: 0, textAlign: 'center' }}>
                                <Typography variant="overline" sx={{ fontWeight: 900, color: 'text.secondary', display: 'block', mb: 3 }}>
                                    VISTA PREVIA (LOCK SCREEN)
                                </Typography>

                                {/* PHONE MOCKUP FRAME */}
                                <Box sx={{
                                    width: 270,
                                    height: 520,
                                    bgcolor: 'black',
                                    borderRadius: '38px',
                                    border: '4px solid #2d2d2d',
                                    boxShadow: '0 30px 60px -10px rgba(0,0,0,0.6)',
                                    position: 'relative',
                                    margin: '0 auto',
                                    overflow: 'hidden'
                                }}>
                                    {/* Mute Switch & Buttons Side */}
                                    <Box sx={{ position: 'absolute', top: 80, left: -6, width: 3, height: 25, bgcolor: '#222', borderTopLeftRadius: 2, borderBottomLeftRadius: 2 }} />
                                    <Box sx={{ position: 'absolute', top: 120, left: -6, width: 3, height: 50, bgcolor: '#222', borderTopLeftRadius: 2, borderBottomLeftRadius: 2 }} />
                                    <Box sx={{ position: 'absolute', top: 110, right: -6, width: 3, height: 80, bgcolor: '#222', borderTopRightRadius: 2, borderBottomRightRadius: 2 }} />

                                    {/* SCREEN */}
                                    <Box sx={{
                                        width: '100%',
                                        height: '100%',
                                        bgcolor: '#0f172a',
                                        background: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 40%, #c026d3 100%)', // Futuristic Purple/Blue Gradient
                                        position: 'relative',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}>
                                        {/* Status Bar */}
                                        <Box sx={{
                                            height: 40, px: 2.5, pt: 1.5,
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            zIndex: 20
                                        }}>
                                            <Typography sx={{ color: 'white', fontSize: 11, fontWeight: 700 }}>12:42</Typography>
                                            <Stack direction="row" spacing={0.5} sx={{ color: 'white', alignItems: 'center' }}>
                                                <Box sx={{ width: 14, height: 14, bgcolor: 'white', opacity: 0.2, borderRadius: '50%' }} /> {/* Fake signal */}
                                                <Box sx={{ width: 14, height: 14, bgcolor: 'white', opacity: 0.2, borderRadius: 2 }} /> {/* Fake wifi */}
                                                <Box sx={{ width: 22, height: 10, borderRadius: 1, border: '1px solid rgba(255,255,255,0.4)', position: 'relative' }}>
                                                    <Box sx={{ width: '60%', height: '100%', bgcolor: 'white' }} />
                                                </Box>
                                            </Stack>
                                        </Box>

                                        {/* Dynamic Island / Notch */}
                                        <Box sx={{
                                            position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
                                            width: 80, height: 22, bgcolor: 'black', borderRadius: 12, zIndex: 30
                                        }} />

                                        {/* Clock on Lock Screen */}
                                        <Box sx={{ mt: 5, textAlign: 'center', color: 'white', opacity: 0.9 }}>
                                            <Typography sx={{ fontSize: 56, fontWeight: 200, lineHeight: 1 }}>12:42</Typography>
                                            <Typography sx={{ fontSize: 14, fontWeight: 500 }}>Miércoles, 16 Enero</Typography>
                                        </Box>

                                        {/* NOTIFICATION ITEM */}
                                        <Box sx={{
                                            mx: 1.5, mt: 3,
                                            bgcolor: 'rgba(255, 255, 255, 0.15)', // Glassmorphism
                                            backdropFilter: 'blur(12px)',
                                            borderRadius: 2.5,
                                            overflow: 'hidden',
                                            color: 'white',
                                            boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                                            transition: 'all 0.3s ease',
                                            animation: 'slideIn 0.5s ease-out',
                                            '@keyframes slideIn': {
                                                '0%': { opacity: 0, transform: 'translateY(20px)' },
                                                '100%': { opacity: 1, transform: 'translateY(0)' }
                                            }
                                        }}>
                                            {/* Header */}
                                            <Box sx={{ p: 1.2, pb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Box sx={{
                                                    width: 20, height: 20, bgcolor: 'black', borderRadius: 1.5, // App Icon box
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    <Notifications sx={{ fontSize: 12, color: 'white' }} />
                                                </Box>
                                                <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, flex: 1 }}>WINSAP</Typography>
                                                <Typography sx={{ fontSize: 10, opacity: 0.6 }}>AHORA</Typography>
                                            </Box>

                                            {/* Content */}
                                            <Box sx={{ px: 1.5, pb: 1.5, pt: 0.5 }}>
                                                <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.3 }}>
                                                    {campaignForm.title || 'Tu Título Aquí'}
                                                </Typography>
                                                <Typography sx={{ fontSize: 12, lineHeight: 1.35, opacity: 0.9 }}>
                                                    {campaignForm.description || 'El contenido de tu mensaje aparecerá aquí de forma inmersiva.'}
                                                </Typography>

                                                {/* Image Preview */}
                                                {campaignForm.imageUrl && (
                                                    <Box sx={{ mt: 1.5, borderRadius: 2, overflow: 'hidden', aspectRatio: '16/9', bgcolor: 'rgba(0,0,0,0.1)' }}>
                                                        <img src={campaignForm.imageUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    </Box>
                                                )}
                                            </Box>
                                        </Box>

                                        {/* Bottom Action Indicators */}
                                        <Stack direction="row" sx={{ position: 'absolute', bottom: 30, left: 0, right: 0, px: 4 }} justifyContent="space-between">
                                            <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
                                                <FlashlightOn sx={{ fontSize: 18, color: 'white' }} />
                                            </Box>
                                            <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
                                                <CameraAlt sx={{ fontSize: 18, color: 'white' }} />
                                            </Box>
                                        </Stack>
                                        <Box sx={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', width: 100, height: 4, bgcolor: 'white', borderRadius: 2 }} />
                                    </Box>
                                </Box>
                            </Box>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ p: 4, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
                    <Button onClick={() => setCampaignDialog(false)} sx={{ fontWeight: 700 }}>Guardar Borrador</Button>
                    <Button
                        variant="contained"
                        startIcon={<Send />}
                        onClick={handleCreateCampaign}
                        size="large"
                        sx={{ borderRadius: 3, px: 5, py: 1.5, fontWeight: 900, textTransform: 'none', fontSize: '1.1rem', backgroundImage: 'linear-gradient(to right, #3b82f6, #6366f1)' }}
                    >
                        DESPEGAR CAMPAÑA
                    </Button>
                </DialogActions>
            </Dialog>

            {/* CONFIRM DELETION DIALOG */}
            <StyledConfirmDialog
                open={confirmDelete.open}
                title="¿Confirmar Eliminación?"
                message={`Esta acción no se puede deshacer. Se eliminará permanentemente esta ${confirmDelete.type === 'category' ? 'categoría' : (confirmDelete.type === 'url' ? 'URL de suscripción' : 'campaña')}.`}
                onClose={() => setConfirmDelete({ open: false, type: 'category', id: null })}
                onConfirm={executeDeletion}
            />

            {/* CONFIRM RESEND DIALOG */}
            <StyledConfirmDialog
                open={confirmResend.open}
                title="🔄 ¿Reenviar Campaña?"
                message="Esta acción reenviará la campaña a todos los suscriptores nuevamente. ¿Deseas continuar?"
                onClose={() => setConfirmResend({ open: false, id: null })}
                onConfirm={handleResendCampaign}
                confirmText="Reenviar"
                confirmColor="primary"
            />

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert severity={snackbar.severity} sx={{ borderRadius: 4, fontWeight: 700, boxShadow: theme.shadows[10] }} elevation={6} variant="filled">
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Container >
    );
};

export default PushNotificationsModule;
