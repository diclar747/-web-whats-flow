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
    DeviceHub, Language, OpenInNew, Warning
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
}> = ({ open, title, message, onClose, onConfirm, loading }) => (
    <Dialog open={open} onClose={onClose} TransitionComponent={Zoom} maxWidth="xs" fullWidth
        PaperProps={{
            sx: { borderRadius: 3, p: 1, bgcolor: 'background.paper', backgroundImage: 'none' }
        }}
    >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
            <Warning color="error" /> {title}
        </DialogTitle>
        <DialogContent>
            <Typography variant="body1">{message}</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
            <Button onClick={onClose} disabled={loading} sx={{ borderRadius: 2 }}>Cancelar</Button>
            <Button onClick={onConfirm} variant="contained" color="error" disabled={loading}
                sx={{ borderRadius: 2, px: 3, boxShadow: '0 4px 14px 0 rgba(239, 68, 68, 0.39)' }}
            >
                {loading ? <CircularProgress size={24} /> : 'Eliminar'}
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

    const handleResendCampaign = async (id: number) => {
        try {
            setLoading(true);
            await axios.post(`/api/push/campaigns/${id}/resend`, {}, getAuthHeaders());
            setSnackbar({ open: true, message: 'Campaña reenviada con éxito', severity: 'success' });
            loadCampaigns();
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
                                                    background: 'linear-gradient(145deg, #1e1e2f 0%, #161625 100%)', // DataBox-like deep blue/black
                                                    color: 'white',
                                                    height: '100%',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    position: 'relative',
                                                    overflow: 'hidden',
                                                    border: '1px solid rgba(255,255,255,0.05)',
                                                    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                                                    transition: 'all 0.3s ease',
                                                    '&:hover': {
                                                        transform: 'translateY(-5px)',
                                                        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                                                        borderColor: alpha(theme.palette.primary.main, 0.3)
                                                    }
                                                }}>
                                                    {/* Top Glow Line */}
                                                    <Box sx={{
                                                        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                                                        background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                                                        boxShadow: `0 0 10px ${theme.palette.primary.main}`
                                                    }} />

                                                    {/* Header: Status & Icon */}
                                                    <Box sx={{ p: 3, pb: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <Box sx={{
                                                            width: 48, height: 48, borderRadius: 3,
                                                            background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(59,130,246,0.05))',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            border: '1px solid rgba(59,130,246,0.1)'
                                                        }}>
                                                            {camp.image_url ? (
                                                                <img src={camp.image_url} alt="" style={{ width: '100%', height: '100%', borderRadius: 10, objectFit: 'cover' }} />
                                                            ) : (
                                                                <Send sx={{ color: '#3b82f6' }} />
                                                            )}
                                                        </Box>
                                                        <Chip
                                                            label={camp.status === 'sent' ? 'SENT' : (camp.status === 'sending' ? 'SENDING' : 'DRAFT')}
                                                            size="small"
                                                            sx={{
                                                                fontWeight: 800, fontSize: 10, height: 22,
                                                                bgcolor: camp.status === 'sent' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                                                color: camp.status === 'sent' ? '#34d399' : '#fbbf24',
                                                                border: '1px solid',
                                                                borderColor: camp.status === 'sent' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'
                                                            }}
                                                        />
                                                    </Box>

                                                    <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
                                                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: 1, mb: 1, display: 'block' }}>
                                                            {camp.name?.toUpperCase()}
                                                        </Typography>
                                                        <Typography variant="h6" fontWeight="800" sx={{
                                                            mb: 3, fontSize: 18, lineHeight: 1.4,
                                                            overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', minHeight: 50
                                                        }}>
                                                            {camp.title}
                                                        </Typography>

                                                        {/* Metrics Container - DataBox Style */}
                                                        <Box sx={{
                                                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3, mt: 'auto'
                                                        }}>
                                                            {/* VISTOS Metric */}
                                                            <Box sx={{
                                                                p: 2, borderRadius: 3,
                                                                bgcolor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)'
                                                            }}>
                                                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, letterSpacing: 0.5 }}>VISTOS</Typography>
                                                                <Typography variant="h4" fontWeight="900" sx={{ mt: 1, color: '#3b82f6', letterSpacing: -1 }}>
                                                                    {camp.total_viewed || 0}
                                                                </Typography>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                                                    <Visibility sx={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }} />
                                                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)' }}>Views</Typography>
                                                                </Box>
                                                            </Box>

                                                            {/* CLICKS Metric */}
                                                            <Box sx={{
                                                                p: 2, borderRadius: 3,
                                                                bgcolor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)'
                                                            }}>
                                                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, letterSpacing: 0.5 }}>CLICKS</Typography>
                                                                <Typography variant="h4" fontWeight="900" sx={{ mt: 1, color: '#10b981', letterSpacing: -1 }}>
                                                                    {camp.total_clicked || 0}
                                                                </Typography>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                                                    <Mouse sx={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }} />
                                                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)' }}>Clicks</Typography>
                                                                </Box>
                                                            </Box>
                                                        </Box>

                                                        {/* Footer Actions */}
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 2, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                            <Box>
                                                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>CTR PERFORMANCE</Typography>
                                                                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                                                                    <Typography variant="h6" fontWeight="900" color="white">
                                                                        {camp.total_sent > 0 ? ((camp.total_clicked / camp.total_sent) * 100).toFixed(1) : '0.0'}%
                                                                    </Typography>
                                                                    <TrendingUp sx={{ fontSize: 14, color: '#10b981' }} />
                                                                </Box>
                                                            </Box>
                                                            <Stack direction="row" spacing={1}>
                                                                <Tooltip title="Eliminar">
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => setConfirmDelete({ open: true, type: 'campaign', id: camp.id })}
                                                                        sx={{ color: 'rgba(255,255,255,0.2)', '&:hover': { color: '#ef4444', bgcolor: 'rgba(239, 68, 68, 0.1)' } }}
                                                                    >
                                                                        <Delete fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                                <Tooltip title="Reenviar">
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => handleResendCampaign(camp.id)}
                                                                        sx={{
                                                                            bgcolor: 'rgba(59, 130, 246, 0.1)',
                                                                            color: '#3b82f6',
                                                                            border: '1px solid rgba(59, 130, 246, 0.2)',
                                                                            '&:hover': { bgcolor: '#3b82f6', color: 'white' }
                                                                        }}
                                                                    >
                                                                        <Refresh fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </Stack>
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
                                        <Grid item xs={12} md={4}>
                                            <Paper sx={{ p: 4, borderRadius: 5, height: '100%', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                                                <Typography variant="h6" fontWeight="900" sx={{ mb: 3 }}>Resumen Global</Typography>
                                                <Stack spacing={4}>
                                                    <Box>
                                                        <Typography variant="caption" color="text.secondary" fontWeight="800">TOTAL CAMPAÑAS REALIZADAS</Typography>
                                                        <Typography variant="h3" fontWeight="900" color="primary.main">{overview.total_campaigns || 0}</Typography>
                                                    </Box>
                                                    <Box>
                                                        <Typography variant="caption" color="text.secondary" fontWeight="800">NOTIFICACIONES ENTREGADAS</Typography>
                                                        <Typography variant="h4" fontWeight="900">{overview.total_sent || 0}</Typography>
                                                    </Box>
                                                    <Box sx={{ p: 2, bgcolor: alpha(theme.palette.success.main, 0.05), borderRadius: 3, border: '1px solid', borderColor: alpha(theme.palette.success.main, 0.1) }}>
                                                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                                                            <Box>
                                                                <Typography variant="caption" color="success.main" fontWeight="800">CONVERSIÓN MEDIA (CTR)</Typography>
                                                                <Typography variant="h4" fontWeight="900" color="success.main">
                                                                    {overview.total_sent > 0 ? ((overview.total_clicked / overview.total_sent) * 100).toFixed(2) : 0}%
                                                                </Typography>
                                                            </Box>
                                                            <TrendingUp color="success" sx={{ fontSize: 40 }} />
                                                        </Stack>
                                                    </Box>
                                                </Stack>
                                            </Paper>
                                        </Grid>
                                        <Grid item xs={12} md={8}>
                                            <Paper sx={{ p: 4, borderRadius: 5, height: '100%', border: '1px solid', borderColor: 'divider' }}>
                                                <Typography variant="h6" fontWeight="900" sx={{ mb: 3 }}>Tráfico y Rendimiento</Typography>
                                                <Grid container spacing={4}>
                                                    <Grid item xs={12} sm={6}>
                                                        <Box sx={{ p: 3, borderRadius: 4, bgcolor: alpha(theme.palette.info.main, 0.05), textAlign: 'center' }}>
                                                            <Visibility sx={{ fontSize: 40, color: 'info.main', mb: 1.5 }} />
                                                            <Typography variant="h4" fontWeight="900">{overview.total_viewed || 0}</Typography>
                                                            <Typography variant="body2" color="text.secondary" fontWeight="700">IMPRESIONES TOTALES</Typography>
                                                        </Box>
                                                    </Grid>
                                                    <Grid item xs={12} sm={6}>
                                                        <Box sx={{ p: 3, borderRadius: 4, bgcolor: alpha(theme.palette.primary.main, 0.05), textAlign: 'center' }}>
                                                            <Mouse sx={{ fontSize: 40, color: 'primary.main', mb: 1.5 }} />
                                                            <Typography variant="h4" fontWeight="900">{overview.total_clicked || 0}</Typography>
                                                            <Typography variant="body2" color="text.secondary" fontWeight="700">CLICKS TOTALES</Typography>
                                                        </Box>
                                                    </Grid>
                                                    <Grid item xs={12}>
                                                        <Box sx={{ p: 3, borderRadius: 4, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                                                            <Typography variant="subtitle2" fontWeight="800" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <History color="primary" /> Historial de Eficiencia
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Tus campañas están teniendo un impacto continuo. Sigue segmentando por categorías para aumentar el CTR.
                                                            </Typography>
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
                            <Box sx={{ position: 'sticky', top: 0 }}>
                                <Typography variant="overline" sx={{ fontWeight: 900, color: 'text.secondary', display: 'block', mb: 2, textAlign: 'center' }}>VISTA PREVIA EN NAVEGADOR</Typography>
                                <Box sx={{
                                    bgcolor: '#1e293b', p: 2.5, borderRadius: 5, color: 'white',
                                    boxShadow: '0 20px 40px -15px rgba(0,0,0,0.5)', border: '1px solid #334155'
                                }}>
                                    <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
                                        <Box sx={{ width: 44, height: 44, bgcolor: '#3b82f6', borderRadius: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                                            <Notifications sx={{ color: 'white' }} />
                                        </Box>
                                        <Box sx={{ minWidth: 0 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: '900', display: 'flex', justifyContent: 'space-between', fontSize: 13, gap: 1 }}>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{campaignForm.title || 'Tu Título Aquí'}</span>
                                                <span style={{ opacity: 0.5, fontSize: 10, flexShrink: 0 }}>AHORA</span>
                                            </Typography>
                                            <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', lineHeight: 1.3, mt: 0.5 }}>
                                                {campaignForm.description || 'El contenido de tu mensaje aparecerá aquí en el centro de notificaciones.'}
                                            </Typography>
                                        </Box>
                                    </Box>
                                    {campaignForm.imageUrl && (
                                        <Box sx={{ width: '100%', height: 140, borderRadius: 2.5, overflow: 'hidden', mb: 1.5, border: '1px solid #334155' }}>
                                            <img src={campaignForm.imageUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </Box>
                                    )}
                                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ borderTop: '1px solid #334155', pt: 1.5 }}>
                                        <Typography variant="caption" sx={{ opacity: 0.4, fontWeight: 700, letterSpacing: 1 }}>WHATSFLOW PUSH</Typography>
                                        <Box sx={{ px: 1.5, py: 0.5, bgcolor: alpha('#3b82f6', 0.2), borderRadius: 1.5, color: '#60a5fa', fontSize: 10, fontWeight: 900 }}>DETALLES</Box>
                                    </Stack>
                                </Box>
                                <Box sx={{ mt: 3, p: 2, bgcolor: alpha(theme.palette.info.main, 0.05), borderRadius: 3, border: '1px dashed', borderColor: theme.palette.info.main }}>
                                    <Typography variant="caption" color="info.main" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
                                        <Language fontSize="inherit" /> Se enviará a todos los navegadores registrados.
                                    </Typography>
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
