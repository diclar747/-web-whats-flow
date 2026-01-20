import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Card,
    CardContent,
    Button,
    TextField,
    IconButton,
    InputAdornment,
    Divider,
    Tabs,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Tooltip,
    Alert,
    CircularProgress,
    Autocomplete,
    Stack,
    Avatar,
    Select,
    MenuItem,
    TablePagination,
    ButtonGroup
} from '@mui/material';
import {
    Sms as SmsIcon,
    History as HistoryIcon,
    Send as SendIcon,
    GroupAdd as GroupAddIcon,
    Schedule as ScheduleIcon,
    EmojiEmotions as EmojiIcon,
    Link as LinkIcon,
    Person as PersonIcon,
    AccountBalanceWallet as WalletIcon,
    TrendingUp as TrendingIcon,
    PlaylistAdd as PlaylistAddIcon,
    Refresh as RefreshIcon,
    Message as MessageIcon,
    Delete as DeleteIcon,
    Pause as PauseIcon,
    PlayArrow as PlayArrowIcon,
    FilterList as FilterListIcon
} from '@mui/icons-material';
import { getAPIBaseURL } from '../utils/api';
import EmojiPicker from 'emoji-picker-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';

interface SMSStats {
    sent: number;
    failed: number;
    campaigns: number;
    balance: number;
}

interface SMSCampaign {
    id: number;
    name: string;
    message_template: string;
    scheduled_at: string | null;
    status: string;
    total_recipients: number;
    sent_count: number;
    failed_count: number;
    created_at: string;
}

const SMSPremiumModule: React.FC<{ sessionId: string }> = ({ sessionId }) => {
    const [tab, setTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<SMSStats>({ sent: 0, failed: 0, campaigns: 0, balance: 0 });
    const [campaigns, setCampaigns] = useState<SMSCampaign[]>([]);
    const [userId, setUserId] = useState<number | null>(null);
    const [token, setToken] = useState<string | null>(null);

    // Form states
    const [message, setMessage] = useState('');
    const [recipients, setRecipients] = useState('');
    const [campaignName, setCampaignName] = useState('');
    const [scheduledDate, setScheduledDate] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Kanban selection logic
    const [kanbanBoards, setKanbanBoards] = useState<any[]>([]);
    const [selectedBoardId, setSelectedBoardId] = useState<string>('');
    const [kanbanContacts, setKanbanContacts] = useState<any[]>([]);
    const [selectedKanbanContacts, setSelectedKanbanContacts] = useState<any[]>([]);
    const [loadingBoards, setLoadingBoards] = useState(false);
    const [loadingContacts, setLoadingContacts] = useState(false);
    const [boardsError, setBoardsError] = useState<string | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [directSendName, setDirectSendName] = useState(''); // Nombre para envíos directos

    // Campaign filters
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterDate, setFilterDate] = useState<string>('');

    // Charts data
    const [chartData, setChartData] = useState<any>(null);
    const [chartPeriod, setChartPeriod] = useState<'week' | 'month' | 'year'>('week');
    const [loadingCharts, setLoadingCharts] = useState(false);

    useEffect(() => {
        loadInitialData();
    }, [sessionId]);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            // Get userId from sessionStorage (set during login)
            const storedUserId = sessionStorage.getItem('userId') || localStorage.getItem('userId');

            if (!storedUserId) {
                console.error('[SMS] No userId found in storage');
                setError('No se pudo obtener el ID de usuario. Por favor, inicia sesión nuevamente.');
                setLoading(false);
                return;
            }

            const userIdNum = parseInt(storedUserId);
            console.log('[SMS] Loading initial data for userId:', userIdNum);
            setUserId(userIdNum);

            // Load all data with userId
            await Promise.all([
                loadStats(userIdNum),
                loadCampaigns(userIdNum),
                loadChartsData(userIdNum, chartPeriod),
                loadKanbanBoards(),
                generateSmsToken()
            ]);

        } catch (err) {
            console.error('[SMS] Error loading initial data:', err);
            setError('Error al cargar datos iniciales');
        } finally {
            setLoading(false);
        }
    };

    const loadChartsData = async (uid: number, period: string) => {
        setLoadingCharts(true);
        try {
            const response = await fetch(`${getAPIBaseURL()}/api/sms/charts/${uid}?period=${period}`);
            const data = await response.json();
            if (data.success) {
                setChartData(data);
            }
        } catch (err) {
            console.error('Error loading chart data:', err);
        } finally {
            setLoadingCharts(false);
        }
    };

    // Reload charts when period changes
    useEffect(() => {
        if (userId) {
            loadChartsData(userId, chartPeriod);
        }
    }, [chartPeriod]);

    const loadKanbanBoards = async () => {
        setLoadingBoards(true);
        setBoardsError(null);
        try {
            console.log('[SMS-KANBAN] 📋 Cargando tableros kanban...');
            const response = await fetch(`${getAPIBaseURL()}/api/kanban/boards/${sessionId}`);
            const data = await response.json();

            if (data.success) {
                console.log(`[SMS-KANBAN] ✅ ${data.boards?.length || 0} tableros cargados`);
                setKanbanBoards(data.boards || []);
                if (!data.boards || data.boards.length === 0) {
                    setBoardsError('No hay tableros kanban disponibles. Crea uno en el módulo de Kanban.');
                }
            } else {
                console.error('[SMS-KANBAN] ❌ Error en respuesta:', data.error);
                setBoardsError(data.error || 'Error al cargar tableros');
                setKanbanBoards([]);
            }
        } catch (err) {
            console.error('[SMS-KANBAN] ❌ Error loading Kanban boards:', err);
            setBoardsError('Error de conexión al cargar tableros. Verifica tu conexión.');
            setKanbanBoards([]);
        } finally {
            setLoadingBoards(false);
        }
    };

    const loadBoardContacts = async (boardId: string) => {
        if (!boardId) {
            console.warn('[SMS-KANBAN] ⚠️ No boardId provided');
            setKanbanContacts([]);
            setSelectedKanbanContacts([]); // Clear selection
            return;
        }

        setLoadingContacts(true);
        try {
            console.log(`[SMS-KANBAN] 👥 Cargando contactos del tablero ${boardId}...`);
            const response = await fetch(`${getAPIBaseURL()}/api/kanban/contacts/${sessionId}?boardId=${boardId}`);
            const data = await response.json();

            if (data.success) {
                console.log(`[SMS-KANBAN] ✅ ${data.contacts?.length || 0} contactos cargados`);
                setKanbanContacts(data.contacts || []);
                // AUTO-SELECT ALL CONTACTS
                setSelectedKanbanContacts(data.contacts || []);
                console.log(`[SMS-KANBAN] ✨ Auto-seleccionados ${data.contacts?.length || 0} contactos`);
            } else {
                console.error('[SMS-KANBAN] ❌ Error en respuesta:', data.error);
                setError(data.error || 'Error al cargar contactos del tablero');
                setKanbanContacts([]);
                setSelectedKanbanContacts([]);
            }
        } catch (err) {
            console.error('[SMS-KANBAN] ❌ Error loading board contacts:', err);
            setError('Error de conexión al cargar contactos');
            setKanbanContacts([]);
            setSelectedKanbanContacts([]);
        } finally {
            setLoadingContacts(false);
        }
    };

    // Normalizar números de teléfono al formato 595XXXXXXXXX
    const normalizePhoneNumber = (phone: string): string => {
        // Remover espacios, guiones y otros caracteres no numéricos
        let cleaned = phone.replace(/[\s\-\(\)]/g, '');

        // Si empieza con 0, removerlo
        if (cleaned.startsWith('0')) {
            cleaned = cleaned.substring(1);
        }

        // Si no empieza con 595, agregarlo
        if (!cleaned.startsWith('595')) {
            cleaned = '595' + cleaned;
        }

        return cleaned;
    };


    const generateSmsToken = async () => {
        try {
            const response = await fetch(`${getAPIBaseURL()}/api/sms/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const data = await response.json();
            if (data.success && data.data.token) {
                setToken(data.data.token);
            }
        } catch (err) {
            console.error('Error generating token:', err);
        }
    };

    const loadStats = async (uid: number) => {
        try {
            const response = await fetch(`${getAPIBaseURL()}/api/sms/stats/${uid}`);
            const data = await response.json();
            if (data.success) {
                setStats(data.stats);
            }
        } catch (err) {
            console.error('Error loading stats:', err);
        }
    };

    const loadCampaigns = async (uid: number) => {
        try {
            const response = await fetch(`${getAPIBaseURL()}/api/sms/campaigns/${uid}`);
            const data = await response.json();
            if (data.success) {
                setCampaigns(data.campaigns);
            }
        } catch (err) {
            console.error('Error loading campaigns:', err);
        }
    };

    const handleSendSms = async () => {
        if (!message.trim()) {
            setError('Escribe un mensaje');
            return;
        }
        if (!recipients.trim() && selectedKanbanContacts.length === 0) {
            setError('Agrega al menos un destinatario');
            return;
        }

        setSending(true);
        setError(null);
        setSuccess(null);

        try {
            // Preparar lista de destinatarios normalizados
            const recipientList: { phone: string; name: string }[] = [];

            // Procesar destinatarios manuales
            if (recipients.trim()) {
                const lines = recipients.split('\n').filter(l => l.trim());
                for (const line of lines) {
                    const [phone, name] = line.split(',').map(s => s.trim());
                    if (phone) {
                        recipientList.push({
                            phone: normalizePhoneNumber(phone),
                            name: name || phone
                        });
                    }
                }
            }

            // Procesar contactos de Kanban
            for (const contact of selectedKanbanContacts) {
                const phone = contact.jid?.split('@')[0] || contact.phone;
                if (phone) {
                    recipientList.push({
                        phone: normalizePhoneNumber(phone),
                        name: contact.name || phone
                    });
                }
            }

            const totalRecipients = recipientList.length;

            if (totalRecipients === 0) {
                setError('No se encontraron números válidos para enviar');
                setSending(false);
                return;
            }

            // Verificar saldo SMS del usuario
            console.log('[SMS-SEND] 💰 Verificando saldo SMS...');
            const balanceResponse = await fetch(`${getAPIBaseURL()}/api/sms/stats/${userId}`);
            const balanceData = await balanceResponse.json();

            if (!balanceData.success) {
                setError('Error al verificar saldo SMS');
                setSending(false);
                return;
            }

            const userBalance = balanceData.stats.balance || 0;
            console.log(`[SMS-SEND] 💰 Saldo actual: ${userBalance} SMS, Necesarios: ${totalRecipients} SMS`);

            if (userBalance < totalRecipients) {
                setError(`No tiene saldo suficiente. Tiene ${userBalance} SMS, necesita ${totalRecipients} SMS`);
                setSending(false);
                return;
            }

            // Enviar SMS
            console.log(`[SMS-SEND] 📤 Enviando a ${totalRecipients} destinatarios...`);

            // Renovar token antes de enviar (expira cada 24 horas)
            console.log('[SMS-SEND] 🔄 Renovando token de Mayten...');
            await generateSmsToken();

            // Esperar un momento para asegurar que el token se haya actualizado
            await new Promise(resolve => setTimeout(resolve, 500));

            // Preparar mensajes en el formato que espera el backend
            const messages = recipientList.map((rec, idx) => ({
                mensaje: message.replace(/{nombre}/g, rec.name),
                telefono: rec.phone,
                identificador: `sms_${userId}_${Date.now()}_${idx}`
            }));

            const response = await fetch(`${getAPIBaseURL()}/api/sms/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    messages,
                    token,
                    campaignName: directSendName,
                    category: 'Envío Directo'
                })
            });

            const data = await response.json();
            if (data.success) {
                setSuccess(`SMS enviado exitosamente a ${totalRecipients} destinatarios`);
                setMessage('');
                setRecipients('');
                setSelectedKanbanContacts([]);
                loadStats(userId!);
                loadCampaigns(userId!);
            } else {
                setError(data.error || 'Error al enviar SMS');
            }
        } catch (err: any) {
            console.error('[SMS-SEND] ❌ Error:', err);
            setError(err.message || 'Error al enviar SMS');
        } finally {
            setSending(false);
        }
    };

    const handleScheduleCampaign = async () => {
        if (!campaignName.trim() || !scheduledDate || !message.trim()) {
            setError('Completa todos los campos para programar la campaña');
            return;
        }

        setSending(true);
        setError(null);
        setSuccess(null);

        try {
            // Preparar lista de destinatarios normalizados
            const recipientList: { phone: string; name: string }[] = [];

            // Procesar destinatarios manuales
            if (recipients.trim()) {
                const lines = recipients.split('\n').filter(l => l.trim());
                for (const line of lines) {
                    const [phone, name] = line.split(',').map(s => s.trim());
                    if (phone) {
                        recipientList.push({
                            phone: normalizePhoneNumber(phone),
                            name: name || phone
                        });
                    }
                }
            }

            // Procesar contactos de Kanban
            for (const contact of selectedKanbanContacts) {
                const phone = contact.jid?.split('@')[0] || contact.phone;
                if (phone) {
                    recipientList.push({
                        phone: normalizePhoneNumber(phone),
                        name: contact.name || phone
                    });
                }
            }

            const totalRecipients = recipientList.length;

            if (totalRecipients === 0) {
                setError('Agrega al menos un destinatario');
                setSending(false);
                return;
            }

            // Verificar saldo SMS del usuario
            console.log('[SMS-SCHEDULE] 💰 Verificando saldo SMS...');
            const balanceResponse = await fetch(`${getAPIBaseURL()}/api/sms/stats/${userId}`);
            const balanceData = await balanceResponse.json();

            if (!balanceData.success) {
                setError('Error al verificar saldo SMS');
                setSending(false);
                return;
            }

            const userBalance = balanceData.stats.balance || 0;
            console.log(`[SMS-SCHEDULE] 💰 Saldo actual: ${userBalance} SMS, Necesarios: ${totalRecipients} SMS`);

            if (userBalance < totalRecipients) {
                setError(`No tiene saldo suficiente. Tiene ${userBalance} SMS, necesita ${totalRecipients} SMS`);
                setSending(false);
                return;
            }

            // Programar campaña
            console.log(`[SMS-SCHEDULE] 📅 Programando campaña para ${totalRecipients} destinatarios...`);

            // Renovar token antes de programar (expira cada 24 horas)
            console.log('[SMS-SCHEDULE] 🔄 Renovando token de Mayten...');
            await generateSmsToken();

            // Esperar un momento para asegurar que el token se haya actualizado
            await new Promise(resolve => setTimeout(resolve, 500));

            // Preparar mensajes en el formato que espera el backend
            const messages = recipientList.map((rec, idx) => ({
                mensaje: message.replace(/{nombre}/g, rec.name),
                telefono: rec.phone,
                identificador: `camp_${userId}_${Date.now()}_${idx}`
            }));

            const response = await fetch(`${getAPIBaseURL()}/api/sms/schedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    campaignName,
                    message,
                    recipients: recipientList,
                    scheduledAt: scheduledDate,
                    token
                })
            });

            const data = await response.json();
            if (data.success) {
                setSuccess(`Campaña "${campaignName}" programada exitosamente para ${totalRecipients} destinatarios`);
                setCampaignName('');
                setMessage('');
                setRecipients('');
                setScheduledDate('');
                setSelectedKanbanContacts([]);
                loadCampaigns(userId!);
            } else {
                setError(data.error || 'Error al programar campaña');
            }
        } catch (err: any) {
            console.error('[SMS-SCHEDULE] ❌ Error:', err);
            setError(err.message || 'Error al programar campaña');
        } finally {
            setSending(false);
        }
    };

    // Campaign management functions
    const handleDeleteCampaign = async (campaignId: number) => {
        if (!window.confirm('¿Estás seguro de eliminar esta campaña?')) return;

        try {
            const response = await fetch(`${getAPIBaseURL()}/api/sms/campaigns/${campaignId}`, {
                method: 'DELETE'
            });
            const data = await response.json();

            if (data.success) {
                setSuccess('Campaña eliminada exitosamente');
                loadCampaigns(userId!);
            } else {
                setError(data.error || 'Error al eliminar campaña');
            }
        } catch (err) {
            setError('Error de conexión al eliminar campaña');
        }
    };

    const handlePauseCampaign = async (campaignId: number) => {
        try {
            const response = await fetch(`${getAPIBaseURL()}/api/sms/campaigns/${campaignId}/pause`, {
                method: 'POST'
            });
            const data = await response.json();

            if (data.success) {
                setSuccess('Campaña pausada');
                loadCampaigns(userId!);
            }
        } catch (err) {
            setError('Error al pausar campaña');
        }
    };

    const handleResumeCampaign = async (campaignId: number) => {
        try {
            const response = await fetch(`${getAPIBaseURL()}/api/sms/campaigns/${campaignId}/resume`, {
                method: 'POST'
            });
            const data = await response.json();

            if (data.success) {
                setSuccess('Campaña reanudada');
                loadCampaigns(userId!);
            }
        } catch (err) {
            setError('Error al reanudar campaña');
        }
    };

    // Filter campaigns
    const filteredCampaigns = campaigns.filter(campaign => {
        if (filterStatus !== 'all' && campaign.status !== filterStatus) return false;
        if (filterDate && !campaign.created_at.startsWith(filterDate)) return false;
        return true;
    });

    const renderDashboard = () => (
        <Box sx={{ p: 3 }}>
            <Grid container spacing={3}>
                <Grid item xs={12} md={3}>
                    <Card
                        elevation={4}
                        sx={{
                            height: '100%',
                            borderRadius: 4,
                            background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
                            color: 'white',
                            position: 'relative',
                            overflow: 'hidden',
                            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                            '&:hover': {
                                transform: 'translateY(-8px) scale(1.02)',
                                boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
                            },
                            '&::before': {
                                content: '""',
                                position: 'absolute',
                                top: 0,
                                right: 0,
                                width: '100px',
                                height: '100px',
                                background: 'rgba(255,255,255,0.08)',
                                borderRadius: '50%',
                                transform: 'translate(50%, -50%)'
                            }
                        }}>
                        <CardContent sx={{ p: 3, position: 'relative', zIndex: 1 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                <Box flex={1}>
                                    <Typography variant="caption" sx={{ opacity: 0.9 }}>SMS Enviados</Typography>
                                    <Typography variant="h3" fontWeight="800" my={1}>{stats.sent}</Typography>
                                    <Typography variant="caption" sx={{ opacity: 0.8 }}>{stats.sent} enviados</Typography>
                                </Box>
                                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                                    <SmsIcon sx={{ fontSize: 32 }} />
                                </Avatar>
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                    <Card
                        elevation={4}
                        sx={{
                            height: '100%',
                            borderRadius: 4,
                            background: 'linear-gradient(135deg, #e91e63 0%, #c2185b 100%)',
                            color: 'white',
                            position: 'relative',
                            overflow: 'hidden',
                            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                            '&:hover': {
                                transform: 'translateY(-8px) scale(1.02)',
                                boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
                            },
                            '&::before': {
                                content: '""',
                                position: 'absolute',
                                top: 0,
                                right: 0,
                                width: '100px',
                                height: '100px',
                                background: 'rgba(255,255,255,0.08)',
                                borderRadius: '50%',
                                transform: 'translate(50%, -50%)'
                            }
                        }}>
                        <CardContent sx={{ p: 3, position: 'relative', zIndex: 1 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                <Box flex={1}>
                                    <Typography variant="caption" sx={{ opacity: 0.9 }}>Campañas Activas</Typography>
                                    <Typography variant="h3" fontWeight="800" my={1}>{stats.campaigns}</Typography>
                                    <Typography variant="caption" sx={{ opacity: 0.8 }}>Activas</Typography>
                                </Box>
                                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                                    <HistoryIcon sx={{ fontSize: 32 }} />
                                </Avatar>
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                    <Card
                        elevation={4}
                        sx={{
                            height: '100%',
                            borderRadius: 4,
                            background: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)',
                            color: 'white',
                            position: 'relative',
                            overflow: 'hidden',
                            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                            '&:hover': {
                                transform: 'translateY(-8px) scale(1.02)',
                                boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
                            },
                            '&::before': {
                                content: '""',
                                position: 'absolute',
                                top: 0,
                                right: 0,
                                width: '100px',
                                height: '100px',
                                background: 'rgba(255,255,255,0.08)',
                                borderRadius: '50%',
                                transform: 'translate(50%, -50%)'
                            }
                        }}>
                        <CardContent sx={{ p: 3, position: 'relative', zIndex: 1 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                <Box flex={1}>
                                    <Typography variant="caption" sx={{ opacity: 0.9 }}>Saldo SMS</Typography>
                                    <Typography variant="h3" fontWeight="800" my={1}>{Math.floor(stats.balance)} SMS</Typography>
                                    <Typography variant="caption" sx={{ opacity: 0.8 }}>Disponibles para enviar</Typography>
                                </Box>
                                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                                    <WalletIcon sx={{ fontSize: 32 }} />
                                </Avatar>
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                    <Card
                        elevation={4}
                        sx={{
                            height: '100%',
                            borderRadius: 4,
                            background: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
                            color: 'white',
                            position: 'relative',
                            overflow: 'hidden',
                            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                            '&:hover': {
                                transform: 'translateY(-8px) scale(1.02)',
                                boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
                            },
                            '&::before': {
                                content: '""',
                                position: 'absolute',
                                top: 0,
                                right: 0,
                                width: '100px',
                                height: '100px',
                                background: 'rgba(255,255,255,0.08)',
                                borderRadius: '50%',
                                transform: 'translate(50%, -50%)'
                            }
                        }}>
                        <CardContent sx={{ p: 3, position: 'relative', zIndex: 1 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                <Box flex={1}>
                                    <Typography variant="caption" sx={{ opacity: 0.9 }}>Errores</Typography>
                                    <Typography variant="h3" fontWeight="800" my={1}>{stats.failed}</Typography>
                                    <Typography variant="caption" sx={{ opacity: 0.8 }}>Fallidos</Typography>
                                </Box>
                                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                                    <TrendingIcon sx={{ fontSize: 32 }} />
                                </Avatar>
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Charts Section */}
                {chartData && (
                    <Grid item xs={12}>
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={4}>
                                <Card elevation={3} sx={{ height: '100%', borderRadius: 4 }}>
                                    <CardContent>
                                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Enviados vs Errores</Typography>
                                        <Box sx={{ height: 300, width: '100%' }}>
                                            <ResponsiveContainer>
                                                <PieChart>
                                                    <Pie
                                                        data={chartData.pieData}
                                                        innerRadius={60}
                                                        outerRadius={100}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                    >
                                                        <Cell fill="#4caf50" />
                                                        <Cell fill="#f44336" />
                                                    </Pie>
                                                    <ChartTooltip />
                                                    <Legend verticalAlign="bottom" height={36} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} md={8}>
                                <Card elevation={3} sx={{ height: '100%', borderRadius: 4 }}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                            <Typography variant="h6" sx={{ fontWeight: 700 }}>Envíos por Fecha</Typography>
                                            <Select
                                                value={chartPeriod}
                                                onChange={(e: any) => setChartPeriod(e.target.value)}
                                                size="small"
                                                sx={{ minWidth: 120 }}
                                            >
                                                <MenuItem value="week">Semana</MenuItem>
                                                <MenuItem value="month">Mes</MenuItem>
                                                <MenuItem value="year">Año</MenuItem>
                                            </Select>
                                        </Box>
                                        <Box sx={{ height: 300, width: '100%' }}>
                                            <ResponsiveContainer>
                                                <LineChart data={chartData.timeData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                                                    <XAxis
                                                        dataKey="date"
                                                        stroke="#888"
                                                        fontSize={12}
                                                        tickLine={false}
                                                        axisLine={false}
                                                        tickFormatter={(val) => chartPeriod === 'year' ? val : val.slice(5)}
                                                    />
                                                    <YAxis
                                                        stroke="#888"
                                                        fontSize={12}
                                                        tickLine={false}
                                                        axisLine={false}
                                                    />
                                                    <ChartTooltip />
                                                    <Legend verticalAlign="top" align="right" />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="sent"
                                                        name="Enviados"
                                                        stroke="#4caf50"
                                                        strokeWidth={3}
                                                        dot={{ r: 4, fill: '#4caf50', strokeWidth: 2, stroke: '#fff' }}
                                                        activeDot={{ r: 6 }}
                                                    />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="failed"
                                                        name="Errores"
                                                        stroke="#f44336"
                                                        strokeWidth={3}
                                                        dot={{ r: 4, fill: '#f44336', strokeWidth: 2, stroke: '#fff' }}
                                                        activeDot={{ r: 6 }}
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    </Grid>
                )}

                <Grid item xs={12}>
                    <Card elevation={3} sx={{ borderRadius: 4, bgcolor: '#0f172a', color: '#f1f5f9' }}>
                        <CardContent sx={{ p: 4 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                <Typography variant="h6" sx={{ fontWeight: 700, color: '#f1f5f9' }}>Gestión de Campañas y Envíos</Typography>
                                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                    <TextField
                                        type="date"
                                        label="Filtrar por fecha"
                                        value={filterDate}
                                        onChange={(e) => setFilterDate(e.target.value)}
                                        size="small"
                                        InputLabelProps={{ shrink: true }}
                                    />
                                    <Select
                                        value={filterStatus}
                                        onChange={(e: any) => setFilterStatus(e.target.value)}
                                        size="small"
                                        sx={{ minWidth: 160 }}
                                    >
                                        <MenuItem value="all">Todos los estados</MenuItem>
                                        <MenuItem value="pending">Pendientes</MenuItem>
                                        <MenuItem value="active">Activas</MenuItem>
                                        <MenuItem value="completed">Completadas</MenuItem>
                                        <MenuItem value="failed">Fallidas</MenuItem>
                                    </Select>
                                </Box>
                            </Box>

                            <TableContainer sx={{ border: '1px solid #334155', borderRadius: 2, bgcolor: '#0f172a' }}>
                                <Table>
                                    <TableHead sx={{ bgcolor: '#1e293b' }}>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 700, color: '#f1f5f9', borderBottom: '1px solid #334155' }}>Campaña</TableCell>
                                            <TableCell sx={{ fontWeight: 700, color: '#f1f5f9', borderBottom: '1px solid #334155' }}>Estado</TableCell>
                                            <TableCell sx={{ fontWeight: 700, color: '#f1f5f9', borderBottom: '1px solid #334155' }}>Categoría</TableCell>
                                            <TableCell sx={{ fontWeight: 700, color: '#f1f5f9', borderBottom: '1px solid #334155' }} align="center">Destinatarios</TableCell>
                                            <TableCell sx={{ fontWeight: 700, color: '#f1f5f9', borderBottom: '1px solid #334155' }} align="center">Enviados</TableCell>
                                            <TableCell sx={{ fontWeight: 700, color: '#f1f5f9', borderBottom: '1px solid #334155' }} align="center">Fallidos</TableCell>
                                            <TableCell sx={{ fontWeight: 700, color: '#f1f5f9', borderBottom: '1px solid #334155' }}>Fecha</TableCell>
                                            <TableCell sx={{ fontWeight: 700, color: '#f1f5f9', borderBottom: '1px solid #334155' }} align="center">Acciones</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredCampaigns.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                                                    <Box sx={{ opacity: 0.5 }}>
                                                        <HistoryIcon sx={{ fontSize: 40, mb: 1 }} />
                                                        <Typography>No se encontraron campañas o envíos</Typography>
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredCampaigns.map(campaign => (
                                                <TableRow key={campaign.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                                    <TableCell sx={{ fontWeight: 600 }}>{campaign.name}</TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={campaign.status}
                                                            size="small"
                                                            sx={{
                                                                fontWeight: 600,
                                                                bgcolor: campaign.status === 'completed' ? '#edfdf1' :
                                                                    campaign.status === 'active' ? '#eef3ff' :
                                                                        campaign.status === 'failed' ? '#fff1f0' : '#f5f5f5',
                                                                color: campaign.status === 'completed' ? '#2e7d32' :
                                                                    campaign.status === 'active' ? '#1976d2' :
                                                                        campaign.status === 'failed' ? '#d32f2f' : '#616161'
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={(campaign as any).category || 'Campaña'}
                                                            variant="outlined"
                                                            size="small"
                                                            sx={{ borderRadius: 1.5 }}
                                                        />
                                                    </TableCell>
                                                    <TableCell align="center">{campaign.total_recipients}</TableCell>
                                                    <TableCell align="center" sx={{ color: '#2e7d32', fontWeight: 600 }}>{campaign.sent_count}</TableCell>
                                                    <TableCell align="center" sx={{ color: '#d32f2f', fontWeight: 600 }}>{campaign.failed_count || 0}</TableCell>
                                                    <TableCell>{new Date(campaign.created_at).toLocaleDateString()}</TableCell>
                                                    <TableCell align="center">
                                                        <ButtonGroup variant="text" size="small">
                                                            {campaign.status === 'active' && !(campaign as any).paused && (
                                                                <Tooltip title="Pausar">
                                                                    <IconButton color="primary" onClick={() => handlePauseCampaign(campaign.id)}>
                                                                        <PauseIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            )}
                                                            {(campaign as any).paused && (
                                                                <Tooltip title="Reanudar">
                                                                    <IconButton color="success" onClick={() => handleResumeCampaign(campaign.id)}>
                                                                        <PlayArrowIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            )}
                                                            <Tooltip title="Eliminar">
                                                                <IconButton color="error" onClick={() => handleDeleteCampaign(campaign.id)}>
                                                                    <DeleteIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </ButtonGroup>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );

    const renderSender = () => (
        <Box sx={{ p: 3 }}>
            <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                    <Card elevation={3} sx={{ borderRadius: 4, bgcolor: '#0f172a', color: '#f1f5f9' }}>
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                                <MessageIcon sx={{ mr: 1, color: '#60a5fa' }} /> Redactar Mensaje
                            </Typography>

                            <TextField
                                fullWidth
                                label="Nombre del Envío (opcional)"
                                placeholder="Ej: Promoción Enero 2026"
                                value={directSendName}
                                onChange={(e) => setDirectSendName(e.target.value)}
                                sx={{ mb: 2 }}
                                helperText="Identifica este envío para verlo en los reportes"
                            />

                            <TextField
                                fullWidth
                                multiline
                                rows={4}
                                label="Tu mensaje SMS"
                                placeholder="Hola {nombre}, este es un mensaje SMS..."
                                value={message}
                                onChange={(e) => {
                                    const text = e.target.value;
                                    if (text.length <= 160) {
                                        setMessage(text);
                                    }
                                }}
                                inputProps={{ maxLength: 160 }}
                                sx={{ mb: 2 }}
                                helperText={`${message.length}/160 caracteres${message.length >= 160 ? ' - Límite alcanzado' : ''}`}
                                error={message.length >= 160}
                            />

                            <Box sx={{ mb: 3, display: 'flex', gap: 1, position: 'relative' }}>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<EmojiIcon />}
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    sx={{ color: '#94a3b8', borderColor: '#475569' }}
                                >
                                    Emoji
                                </Button>
                                {showEmojiPicker && (
                                    <Box sx={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        zIndex: 1000,
                                        mt: 1
                                    }}>
                                        <EmojiPicker
                                            onEmojiClick={(emojiData) => {
                                                setMessage(msg => msg + emojiData.emoji);
                                                setShowEmojiPicker(false);
                                            }}
                                            width={350}
                                            height={400}
                                        />
                                    </Box>
                                )}
                                <Button size="small" variant="outlined" startIcon={<LinkIcon />} onClick={() => setMessage(msg => msg + ' https://')} sx={{ color: '#94a3b8', borderColor: '#475569' }}>URL</Button>
                                <Button size="small" variant="outlined" startIcon={<PersonIcon />} onClick={() => setMessage(msg => msg + '{nombre}')} sx={{ color: '#94a3b8', borderColor: '#475569' }}>Nombre</Button>
                            </Box>

                            <Divider sx={{ my: 3, borderColor: '#475569' }} />

                            <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', color: '#f1f5f9' }}>
                                <PlaylistAddIcon sx={{ mr: 1, color: '#60a5fa' }} /> Destinatarios Manuales
                            </Typography>
                            <TextField
                                fullWidth
                                multiline
                                rows={3}
                                label="Formato: número,nombre (una por línea)"
                                placeholder="595994854167,Claudio\n595981123456,Jose"
                                value={recipients}
                                onChange={(e) => setRecipients(e.target.value)}
                                sx={{
                                    mb: 2,
                                    '& .MuiInputBase-root': { bgcolor: '#1e293b', color: '#fff' },
                                    '& .MuiInputLabel-root': { color: '#94a3b8' },
                                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#475569' }
                                }}
                            />

                            <Divider sx={{ my: 2, borderColor: '#475569' }} />

                            <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', color: '#f1f5f9' }}>
                                <GroupAddIcon sx={{ mr: 1, color: '#60a5fa' }} /> Seleccionar de Kanban
                            </Typography>

                            {boardsError && (
                                <Alert
                                    severity="warning"
                                    sx={{ mb: 2, bgcolor: '#422006', color: '#fbbf24', borderColor: '#78350f' }}
                                    action={
                                        <Button color="inherit" size="small" onClick={loadKanbanBoards}>
                                            <RefreshIcon sx={{ mr: 0.5 }} fontSize="small" />
                                            Reintentar
                                        </Button>
                                    }
                                >
                                    {boardsError}
                                </Alert>
                            )}

                            <Grid container spacing={2} sx={{ mb: 2 }}>
                                <Grid item xs={12} md={6}>
                                    <Autocomplete
                                        options={kanbanBoards}
                                        getOptionLabel={(option) => option.name}
                                        value={kanbanBoards.find(b => b.id === selectedBoardId) || null}
                                        loading={loadingBoards}
                                        onChange={(_, newValue) => {
                                            setSelectedBoardId(newValue ? newValue.id : '');
                                            setSelectedKanbanContacts([]);
                                            if (newValue) loadBoardContacts(newValue.id);
                                        }}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="Seleccionar Tablero"
                                                size="small"
                                                sx={{
                                                    '& .MuiInputBase-root': { bgcolor: '#1e293b', color: '#fff' },
                                                    '& .MuiInputLabel-root': { color: '#94a3b8' },
                                                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#475569' }
                                                }}
                                                InputProps={{
                                                    ...params.InputProps,
                                                    endAdornment: (
                                                        <>
                                                            {loadingBoards ? <CircularProgress color="inherit" size={20} /> : null}
                                                            {params.InputProps.endAdornment}
                                                        </>
                                                    ),
                                                }}
                                            />
                                        )}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Autocomplete
                                        multiple
                                        options={kanbanContacts}
                                        getOptionLabel={(option) => option.name || option.jid}
                                        value={selectedKanbanContacts}
                                        loading={loadingContacts}
                                        onChange={(_, newValue) => setSelectedKanbanContacts(newValue)}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label={selectedBoardId ? "Seleccionar Contactos" : "Primero selecciona un tablero"}
                                                size="small"
                                                sx={{
                                                    '& .MuiInputBase-root': { bgcolor: '#1e293b', color: '#fff' },
                                                    '& .MuiInputLabel-root': { color: '#94a3b8' },
                                                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#475569' }
                                                }}
                                                InputProps={{
                                                    ...params.InputProps,
                                                    endAdornment: (
                                                        <>
                                                            {loadingContacts ? <CircularProgress color="inherit" size={20} /> : null}
                                                            {params.InputProps.endAdornment}
                                                        </>
                                                    ),
                                                }}
                                            />
                                        )}
                                        disabled={!selectedBoardId}
                                        noOptionsText={selectedBoardId ? "No hay contactos en este tablero" : "Selecciona un tablero primero"}
                                    />
                                </Grid>
                            </Grid>

                            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    size="large"
                                    startIcon={sending ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                                    disabled={sending}
                                    onClick={handleSendSms}
                                    sx={{ borderRadius: 2, px: 4 }}
                                >
                                    {sending ? 'Enviando...' : 'Enviar Ahora'}
                                </Button>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Card elevation={3} sx={{ borderRadius: 4, bgcolor: '#0f172a', color: '#f1f5f9' }}>
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', fontWeight: 600, color: '#f1f5f9' }}>
                                <WalletIcon sx={{ mr: 1, color: '#4caf50' }} /> Información de Saldo
                            </Typography>
                            <Box sx={{ textAlign: 'center', py: 2 }}>
                                <Typography variant="h3" sx={{ color: '#4caf50', fontWeight: 700 }}>{stats.balance} SMS</Typography>
                                <Typography variant="body2" sx={{ color: '#94a3b8' }}>Cantidad de SMS disponibles</Typography>
                                {stats.balance < 1 && (
                                    <Alert severity="warning" sx={{ mt: 2 }}>
                                        Saldo bajo. Recarga pronto.
                                    </Alert>
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );

    const renderCampaigns = () => (
        <Box sx={{ p: 3 }}>
            <Grid container spacing={3}>
                <Grid item xs={12} md={7}>
                    <Card elevation={3} sx={{ borderRadius: 4, bgcolor: '#0f172a', color: '#f1f5f9' }}>
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                                <ScheduleIcon sx={{ mr: 1, color: '#9333ea' }} /> Nueva Campaña Programada
                            </Typography>
                            <TextField
                                fullWidth
                                label="Nombre de la Campaña"
                                value={campaignName}
                                onChange={(e) => setCampaignName(e.target.value)}
                                sx={{
                                    mb: 2,
                                    '& .MuiInputBase-root': { bgcolor: '#1e293b', color: '#fff' },
                                    '& .MuiInputLabel-root': { color: '#94a3b8' },
                                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#475569' }
                                }}
                            />
                            <TextField
                                fullWidth
                                multiline
                                rows={4}
                                label="Mensaje de la Campaña"
                                placeholder="Hola {nombre}, este es un mensaje programado..."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                sx={{
                                    mb: 2,
                                    '& .MuiInputBase-root': { bgcolor: '#1e293b', color: '#fff' },
                                    '& .MuiInputLabel-root': { color: '#94a3b8' },
                                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#475569' }
                                }}
                                helperText="Usa {nombre} para personalizar"
                            />
                            <TextField
                                fullWidth
                                type="datetime-local"
                                label="Fecha y Hora de Envío"
                                InputLabelProps={{ shrink: true }}
                                value={scheduledDate}
                                onChange={(e) => setScheduledDate(e.target.value)}
                                sx={{
                                    mb: 3,
                                    '& .MuiInputBase-root': { bgcolor: '#1e293b', color: '#fff' },
                                    '& .MuiInputLabel-root': { color: '#94a3b8' },
                                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#475569' }
                                }}
                            />

                            <Typography variant="subtitle2" gutterBottom sx={{ color: '#f1f5f9' }}>Destinatarios (Selecciona de Kanban)</Typography>
                            <Grid container spacing={2} sx={{ mb: 2 }}>
                                <Grid item xs={12} md={6}>
                                    <Autocomplete
                                        options={kanbanBoards}
                                        getOptionLabel={(option) => option.name}
                                        onChange={(_, newValue) => {
                                            setSelectedBoardId(newValue ? newValue.id : '');
                                            if (newValue) loadBoardContacts(newValue.id);
                                        }}
                                        renderInput={(params) => <TextField {...params} label="Tablero Kanban" size="small" sx={{ '& .MuiInputBase-root': { bgcolor: '#1e293b', color: '#fff' }, '& .MuiInputLabel-root': { color: '#94a3b8' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#475569' } }} />}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Autocomplete
                                        multiple
                                        options={kanbanContacts}
                                        getOptionLabel={(option) => `${option.name} (${option.phone})`}
                                        value={selectedKanbanContacts}
                                        onChange={(_, newValue) => setSelectedKanbanContacts(newValue)}
                                        renderInput={(params) => <TextField {...params} label="Contactos" size="small" sx={{ '& .MuiInputBase-root': { bgcolor: '#1e293b', color: '#fff' }, '& .MuiInputLabel-root': { color: '#94a3b8' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#475569' } }} />}
                                        disabled={!selectedBoardId}
                                    />
                                </Grid>
                            </Grid>

                            <Button
                                fullWidth
                                variant="contained"
                                color="secondary"
                                size="large"
                                startIcon={<ScheduleIcon />}
                                onClick={handleScheduleCampaign}
                                disabled={sending}
                            >
                                Programar Ahora
                            </Button>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={5}>
                    <Card elevation={3} sx={{ borderRadius: 4, bgcolor: '#0f172a', color: '#f1f5f9' }}>
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>Estado de Campañas</Typography>
                            <Box sx={{ mt: 2 }}>
                                {campaigns.map(camp => (
                                    <Box key={camp.id} sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'action.hover' }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                            <Typography fontWeight="bold">{camp.name}</Typography>
                                            <Chip label={camp.status} size="small" color={camp.status === 'completed' ? 'success' : 'primary'} />
                                        </Box>
                                        <Typography variant="body2" color="text.secondary" noWrap>{camp.message_template}</Typography>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                                            <Typography variant="caption" color="text.secondary">{new Date(camp.scheduled_at || camp.created_at).toLocaleString()}</Typography>
                                            <Typography variant="caption" color="text.secondary">{camp.sent_count}/{camp.total_recipients}</Typography>
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );

    return (
        <Box sx={{ flexGrow: 1, height: '100%', overflow: 'auto' }}>
            <Box sx={{
                p: 3,
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{ mr: 2, width: 56, height: 56, bgcolor: 'rgba(255,255,255,0.2)' }}>
                        <SmsIcon sx={{ fontSize: 32 }} />
                    </Avatar>
                    <Box>
                        <Typography variant="h4" fontWeight="700">SMS Premium</Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>Interfaz moderna de envío de mensajes de texto</Typography>
                    </Box>
                </Box>
                <IconButton onClick={() => loadInitialData()} title="Recargar" sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}>
                    <RefreshIcon />
                </IconButton>
            </Box>

            <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                sx={{
                    px: 2,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    '& .MuiTab-root': { fontWeight: 600 },
                    '& .Mui-selected': { color: '#4f46e5' }
                }}
            >
                <Tab label="Dashboard" />
                <Tab label="Envío Directo" />
                <Tab label="Campañas" />
            </Tabs>

            {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ m: 2 }}>{success}</Alert>}

            {loading && !sending ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                    <CircularProgress />
                </Box>
            ) : (
                <>
                    {tab === 0 && renderDashboard()}
                    {tab === 1 && renderSender()}
                    {tab === 2 && renderCampaigns()}
                </>
            )}
        </Box>
    );
};

export default SMSPremiumModule;
