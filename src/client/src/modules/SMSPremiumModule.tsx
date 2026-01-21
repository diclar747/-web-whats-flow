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
    ButtonGroup,
    LinearProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    DialogContentText
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
    FilterList as FilterListIcon,

    Search as SearchIcon,
    AccessTime as AccessTimeIcon,
    Visibility as ViewIcon
} from '@mui/icons-material';
import { getAPIBaseURL } from '../utils/api';
import EmojiPicker from 'emoji-picker-react';
import SophisticatedProgressBar from '../components/SophisticatedProgressBar';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import { io, Socket } from 'socket.io-client';

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
    const [filterSearch, setFilterSearch] = useState<string>('');

    // Pagination
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(15);

    // Charts data
    const [chartData, setChartData] = useState<any>(null);
    const [chartPeriod, setChartPeriod] = useState<'week' | 'month' | 'year'>('week');
    const [loadingCharts, setLoadingCharts] = useState(false);

    // Real-time campaign progress
    const [campaignProgress, setCampaignProgress] = useState<{ [key: string]: number }>({});

    // Delete confirmation dialog
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [campaignToDelete, setCampaignToDelete] = useState<number | null>(null);

    // Edit campaign states
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [campaignToEdit, setCampaignToEdit] = useState<SMSCampaign | null>(null);
    const [editTemplate, setEditTemplate] = useState('');
    const [editName, setEditName] = useState('');

    // Direct send progress tracking
    const [directSendProgress, setDirectSendProgress] = useState<{ total: number, sent: number, failed: number } | null>(null);

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


    useEffect(() => {
        if (!userId) return;

        console.log('[SMS-SOCKET] Initializing socket connection...');
        const socket = io(getAPIBaseURL());

        socket.on('connect', () => {
            console.log('[SMS-SOCKET] ✅ Connected to server');
            socket.emit('join', `sms_${userId}`);
        });

        socket.on('sms_progress', (data: { campaignId: number, progress: number, sent: number, failed: number, total: number }) => {
            console.log('[SMS-SOCKET] 📊 Campaign Progress:', data);

            // Actualizar el estado de progreso para la barra suave
            setCampaignProgress(prev => ({
                ...prev,
                [data.campaignId]: data.progress
            }));

            // Actualizar la lista de campañas para que los números X/Y se vean en tiempo real
            setCampaigns(prev => prev.map(c => {
                if (c.id === data.campaignId) {
                    return {
                        ...c,
                        sent_count: data.sent,
                        failed_count: data.failed,
                        total_recipients: data.total
                    };
                }
                return c;
            }));
        });

        socket.on('direct_send_progress', (data: { total: number, sent: number, failed: number }) => {
            console.log('[SMS-SOCKET] 🚀 Direct Send Progress:', data);
            setDirectSendProgress(data);

            if (data.sent + data.failed === data.total) {
                console.log('[SMS-SOCKET] ✨ Direct send completed');
                // Refresh data after a short delay
                setTimeout(() => {
                    setDirectSendProgress(null);
                    loadStats(userId);
                    loadCampaigns(userId);
                }, 4000);
            }
        });

        socket.on('disconnect', () => {
            console.log('[SMS-SOCKET] ❌ Disconnected');
        });

        return () => {
            console.log('[SMS-SOCKET] Cleaning up socket connection');
            socket.disconnect();
        };
    }, [userId]);


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
                return data.data.token;
            }
        } catch (err) {
            console.error('Error generating token:', err);
        }
        return null;
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

        // Ensure token exists
        let currentToken = token;
        if (!currentToken) {
            console.log('[SMS-SEND] Token not found, generating new one...');
            currentToken = await generateSmsToken();
        }

        if (!currentToken) {
            setError('Error de autenticación: No se pudo obtener el token de envío.');
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

            if (totalRecipients > 2500) {
                setError(`Límite excedido. El máximo es de 2500 destinatarios por envío. Intentas enviar a ${totalRecipients}.`);
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
                    token: currentToken,
                    campaignName: directSendName,
                    category: 'Envío Directo'
                })
            });

            const data = await response.json();
            if (data.success) {
                setSuccess('Envío iniciado. La barra de progreso mostrará el avance en tiempo real.');
                setMessage('');
                setRecipients('');
                setDirectSendName('');
                setSelectedKanbanContacts([]);

                // AUTO-START: Iniciar el envío inmediatamente
                const campaignId = data.campaignId;
                if (campaignId) {
                    console.log(`[SMS-AUTOSTART] 🚀 Iniciando automáticamente campaña ${campaignId}...`);

                    // Inicializar progreso visual inmediatamente
                    setDirectSendProgress({
                        total: totalRecipients,
                        sent: 0,
                        failed: 0
                    });

                    // Llamar al endpoint de start (en segundo plano)
                    fetch(`${getAPIBaseURL()}/api/sms/campaigns/${campaignId}/start`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, token: currentToken })
                    }).catch(err => console.error('[SMS-AUTOSTART] Error starting campaign:', err));
                }

                loadStats(userId!);
                loadCampaigns(userId!);
            } else {
                setError(data.error || 'Error al guardar envío');
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

            // Convertir a UTC para guardar en BD
            // scheduledDate viene del input datetime-local (hora local)
            // new Date() lo interpreta como local y toISOString() lo pasa a UTC correctamente
            const utcString = new Date(scheduledDate).toISOString().slice(0, 19).replace('T', ' ');

            const response = await fetch(`${getAPIBaseURL()}/api/sms/schedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    campaignName,
                    message,
                    recipients: recipientList,
                    scheduledAt: utcString, // Enviar UTC
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
    const confirmDeleteCampaign = (campaignId: number) => {
        setCampaignToDelete(campaignId);
        setShowDeleteDialog(true);
    };

    const handleDeleteCampaign = async () => {
        if (campaignToDelete === null) return;

        try {
            const campaignId = campaignToDelete;
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
        } finally {
            setShowDeleteDialog(false);
            setCampaignToDelete(null);
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

    const handleStartCampaign = async (campaignId: number) => {
        if (!userId) return;

        try {
            setLoading(true);
            // Primero renovar token
            await generateSmsToken();

            const response = await fetch(`${getAPIBaseURL()}/api/sms/campaigns/${campaignId}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, token: token })
            });

            const data = await response.json();
            if (data.success) {
                setSuccess('Iniciando transmisión en tiempo real...');
                // La UI se actualizará vía Sockets
                loadCampaigns(userId);
            } else {
                setError(data.error || 'Error al iniciar envío');
            }
        } catch (err) {
            setError('Error de conexión al iniciar envío');
        } finally {
            setLoading(false);
        }
    };

    const handleEditCampaign = (camp: SMSCampaign) => {
        setCampaignToEdit(camp);
        setEditName(camp.name);
        setEditTemplate(camp.message_template);
        setShowEditDialog(true);
    };

    const handleSaveEdit = async () => {
        if (!campaignToEdit || !userId) return;

        try {
            const response = await fetch(`${getAPIBaseURL()}/api/sms/campaigns/${campaignToEdit.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editName, template: editTemplate })
            });

            const data = await response.json();
            if (data.success) {
                setSuccess('Campaña actualizada');
                loadCampaigns(userId);
                setShowEditDialog(false);
            } else {
                setError(data.error || 'Error al actualizar');
            }
        } catch (err) {
            setError('Error de conexión al actualizar');
        }
    };

    const handleResendCampaign = async (campaignId: number) => {
        try {
            setLoading(true);
            const response = await fetch(`${getAPIBaseURL()}/api/sms/campaigns/${campaignId}/resend`, {
                method: 'POST'
            });
            const data = await response.json();
            if (data.success) {
                setSuccess('Campaña duplicada como pendiente. Ahora puedes iniciar el envío.');
                loadCampaigns(userId!);
            } else {
                setError(data.error || 'Error al reanudar campaña');
            }
        } catch (err) {
            setError('Error de conexión al reanudar campaña');
        } finally {
            setLoading(false);
        }
    };

    // Filter campaigns
    const filteredCampaigns = campaigns.filter(campaign => {
        if (filterStatus !== 'all' && campaign.status !== filterStatus) return false;
        if (filterDate && !campaign.created_at.startsWith(filterDate)) return false;
        if (filterSearch && !campaign.name.toLowerCase().includes(filterSearch.toLowerCase()) &&
            !campaign.message_template.toLowerCase().includes(filterSearch.toLowerCase())) return false;
        return true;
    });

    const handlePageChange = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

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
                                        size="small"
                                        placeholder="Buscar campaña..."
                                        value={filterSearch}
                                        onChange={(e) => {
                                            setFilterSearch(e.target.value);
                                            setPage(0);
                                        }}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                                                </InputAdornment>
                                            ),
                                        }}
                                        sx={{
                                            minWidth: 200,
                                            ...textFieldStyle
                                        }}
                                    />
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
                                            <TableCell sx={{ fontWeight: 700, color: '#f1f5f9', borderBottom: '1px solid #334155' }}>Progreso</TableCell>
                                            <TableCell sx={{ fontWeight: 700, color: '#f1f5f9', borderBottom: '1px solid #334155' }} align="center">Enviados</TableCell>
                                            <TableCell sx={{ fontWeight: 700, color: '#f1f5f9', borderBottom: '1px solid #334155' }} align="center">Fallidos</TableCell>
                                            <TableCell sx={{ fontWeight: 700, color: '#f1f5f9', borderBottom: '1px solid #334155' }}>Fecha</TableCell>
                                            <TableCell sx={{ fontWeight: 700, color: '#f1f5f9', borderBottom: '1px solid #334155' }} align="center">Acciones</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredCampaigns.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                                                    <Box sx={{ opacity: 0.5 }}>
                                                        <HistoryIcon sx={{ fontSize: 40, mb: 1 }} />
                                                        <Typography>No se encontraron campañas o envíos</Typography>
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredCampaigns
                                                .slice()
                                                .reverse()
                                                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                                .map(campaign => {
                                                    const progress = campaign.total_recipients > 0
                                                        ? Math.round((campaign.sent_count / campaign.total_recipients) * 100)
                                                        : 0;
                                                    const campaignProgressValue = campaignProgress[campaign.id] !== undefined
                                                        ? campaignProgress[campaign.id]
                                                        : progress;

                                                    return (
                                                        <TableRow key={campaign.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 }, '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                                                            <TableCell sx={{ fontWeight: 600, color: '#f1f5f9' }}>{campaign.name}</TableCell>
                                                            <TableCell>
                                                                <Chip
                                                                    label={campaign.status === 'pending' ? 'PENDIENTE' : campaign.status.toUpperCase()}
                                                                    size="small"
                                                                    sx={{
                                                                        fontWeight: 800,
                                                                        fontSize: '0.65rem',
                                                                        bgcolor: campaign.status === 'pending' ? 'rgba(245, 158, 11, 0.1)' :
                                                                            campaign.status === 'completed' ? 'rgba(34, 197, 94, 0.1)' :
                                                                                campaign.status === 'active' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.05)',
                                                                        color: campaign.status === 'pending' ? '#f59e0b' :
                                                                            campaign.status === 'completed' ? '#22c55e' :
                                                                                campaign.status === 'active' ? '#3b82f6' : '#94a3b8',
                                                                        border: '1px solid currentColor'
                                                                    }}
                                                                />
                                                            </TableCell>
                                                            <TableCell sx={{ minWidth: 120 }}>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                    <LinearProgress
                                                                        variant="determinate"
                                                                        value={campaign.status === 'completed' ? 100 : campaignProgressValue}
                                                                        sx={{
                                                                            flexGrow: 1,
                                                                            height: 6,
                                                                            borderRadius: 3,
                                                                            bgcolor: 'rgba(255, 255, 255, 0.05)',
                                                                            '& .MuiLinearProgress-bar': {
                                                                                borderRadius: 3,
                                                                                bgcolor: '#22c55e',
                                                                            }
                                                                        }}
                                                                    />
                                                                    <Typography variant="caption" sx={{ fontWeight: 700, minWidth: 35 }}>
                                                                        {campaign.status === 'completed' ? '100%' : `${campaignProgressValue}%`}
                                                                    </Typography>
                                                                </Box>
                                                            </TableCell>
                                                            <TableCell align="center" sx={{ color: '#22c55e', fontWeight: 700 }}>{campaign.sent_count}</TableCell>
                                                            <TableCell align="center" sx={{ color: '#f44336', fontWeight: 700 }}>{campaign.failed_count || 0}</TableCell>
                                                            <TableCell sx={{ color: '#94a3b8' }}>{new Date(campaign.created_at).toLocaleDateString()}</TableCell>
                                                            <TableCell align="center">
                                                                <Stack direction="row" spacing={0.5} justifyContent="center">
                                                                    {campaign.status === 'pending' && (
                                                                        <Tooltip title="Enviar">
                                                                            <IconButton size="small" sx={{ color: '#22c55e' }} onClick={() => handleStartCampaign(campaign.id)}>
                                                                                <PlayArrowIcon fontSize="small" />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                    )}
                                                                    {(campaign.status === 'active' || campaign.status === 'sending') && (
                                                                        <Tooltip title="Pausar">
                                                                            <IconButton size="small" sx={{ color: '#f59e0b' }} onClick={() => handlePauseCampaign(campaign.id)}>
                                                                                <PauseIcon fontSize="small" />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                    )}
                                                                    {campaign.status === 'paused' && (
                                                                        <Tooltip title="Reanudar">
                                                                            <IconButton size="small" sx={{ color: '#22c55e' }} onClick={() => handleResumeCampaign(campaign.id)}>
                                                                                <PlayArrowIcon fontSize="small" />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                    )}
                                                                    <Tooltip title={campaign.message_template}>
                                                                        <IconButton size="small" sx={{ color: '#94a3b8' }}>
                                                                            <ViewIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                    <Tooltip title="Reenviar">
                                                                        <IconButton size="small" sx={{ color: '#a855f7' }} onClick={() => handleResendCampaign(campaign.id)}>
                                                                            <RefreshIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                    <Tooltip title="Editar">
                                                                        <IconButton size="small" sx={{ color: '#3b82f6' }} onClick={() => handleEditCampaign(campaign)}>
                                                                            <HistoryIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                    <Tooltip title="Eliminar">
                                                                        <IconButton size="small" sx={{ color: '#f44336' }} onClick={() => confirmDeleteCampaign(campaign.id)}>
                                                                            <DeleteIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                </Stack>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            <TablePagination
                                component="div"
                                count={filteredCampaigns.length}
                                page={page}
                                onPageChange={handlePageChange}
                                rowsPerPage={rowsPerPage}
                                onRowsPerPageChange={handleRowsPerPageChange}
                                rowsPerPageOptions={[5, 10, 15, 25, 50]}
                                labelRowsPerPage="Filas por página:"
                                sx={{
                                    color: '#94a3b8',
                                    borderTop: '1px solid rgba(255,255,255,0.05)',
                                    '& .MuiTablePagination-selectIcon': { color: '#94a3b8' },
                                    '& .MuiTablePagination-actions': { color: '#94a3b8' }
                                }}
                            />
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'success';
            case 'active': return 'primary';
            case 'paused': return 'warning';
            case 'pending': return 'default';
            case 'failed': return 'error';
            default: return 'default';
        }
    };

    const textFieldStyle = {
        '& .MuiInputBase-root': { bgcolor: '#1e293b', color: '#fff', borderRadius: 2 },
        '& .MuiInputLabel-root': { color: '#94a3b8' },
        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
        '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3b82f6' }
    };

    const renderCampaignCard = (camp: SMSCampaign) => {
        const progress = camp.total_recipients > 0
            ? Math.round((camp.sent_count / camp.total_recipients) * 100)
            : 0;

        const campaignProgressValue = campaignProgress[camp.id] !== undefined
            ? campaignProgress[camp.id]
            : progress;

        return (
            <Card
                key={camp.id}
                sx={{
                    mb: 2,
                    bgcolor: '#1e293b',
                    color: '#f1f5f9',
                    borderRadius: 3,
                    border: '1px solid rgba(255,255,255,0.05)',
                    transition: 'all 0.3s',
                    '&:hover': {
                        boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                        transform: 'translateY(-2px)'
                    }
                }}
            >
                <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1.5 }}>
                        <Typography variant="subtitle1" fontWeight="700" noWrap sx={{ maxWidth: '70%' }}>
                            {camp.name || 'Sin nombre'}
                        </Typography>
                        <Chip
                            icon={camp.status === 'pending' ? <AccessTimeIcon style={{ fontSize: 16 }} /> : undefined}
                            label={camp.status === 'pending' ? 'PROGRAMADO' : camp.status.toUpperCase()}
                            size="small"
                            color={getStatusColor(camp.status) as any}
                            sx={{
                                fontWeight: 900,
                                fontSize: '0.65rem',
                                bgcolor: camp.status === 'pending' ? 'rgba(59, 130, 246, 0.1)' : undefined,
                                color: camp.status === 'pending' ? '#3b82f6' : undefined,
                                border: camp.status === 'pending' ? '1px solid rgba(59, 130, 246, 0.3)' : undefined,
                                pl: camp.status === 'pending' ? 0.5 : 0
                            }}
                        />
                    </Box>

                    <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {camp.message_template}
                    </Typography>

                    {(camp.status === 'active' || camp.status === 'sending' || camp.status === 'completed' || camp.status === 'paused') && (
                        <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, alignItems: 'center' }}>
                                <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                                    Progreso: {camp.sent_count}/{camp.total_recipients}
                                </Typography>
                                <Typography variant="caption" sx={{ color: camp.status === 'completed' ? '#4caf50' : '#60a5fa', fontWeight: 900, fontSize: '0.8rem' }}>
                                    {camp.status === 'completed' ? '100%' : `${campaignProgressValue}%`}
                                </Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={camp.status === 'completed' ? 100 : campaignProgressValue}
                                sx={{
                                    height: 8,
                                    borderRadius: 4,
                                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                                    '& .MuiLinearProgress-bar': {
                                        borderRadius: 4,
                                        bgcolor: '#22c55e',
                                        backgroundImage: 'linear-gradient(90deg, #22c55e 0%, #4ade80 100%)',
                                        boxShadow: '0 0 10px rgba(34, 197, 94, 0.3)'
                                    }
                                }}
                            />
                        </Box>
                    )}

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                        <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.7rem' }}>
                            {new Date(camp.scheduled_at || camp.created_at).toLocaleString()}
                        </Typography>

                        <Stack direction="row" spacing={1} alignItems="center">
                            {camp.status === 'pending' && !camp.scheduled_at && (
                                <Button
                                    size="small"
                                    variant="contained"
                                    color="success"
                                    startIcon={<PlayArrowIcon />}
                                    onClick={() => handleStartCampaign(camp.id)}
                                    sx={{
                                        borderRadius: 2,
                                        textTransform: 'none',
                                        fontWeight: 800,
                                        px: 2,
                                        py: 0.5,
                                        fontSize: '0.75rem',
                                        bgcolor: '#22c55e',
                                        '&:hover': { bgcolor: '#16a34a' }
                                    }}
                                >
                                    ENVIAR
                                </Button>
                            )}

                            {(camp.status === 'active' || camp.status === 'sending') && (
                                <Tooltip title="Pausar">
                                    <IconButton
                                        size="small"
                                        sx={{
                                            color: '#f59e0b',
                                            bgcolor: 'rgba(245, 158, 11, 0.1)',
                                            '&:hover': { bgcolor: 'rgba(245, 158, 11, 0.2)' }
                                        }}
                                        onClick={() => handlePauseCampaign(camp.id)}
                                    >
                                        <PauseIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            )}

                            {camp.status === 'paused' && (
                                <Tooltip title="Reanudar">
                                    <IconButton
                                        size="small"
                                        sx={{
                                            color: '#22c55e',
                                            bgcolor: 'rgba(34, 197, 94, 0.1)',
                                            '&:hover': { bgcolor: 'rgba(34, 197, 94, 0.2)' }
                                        }}
                                        onClick={() => handleResumeCampaign(camp.id)}
                                    >
                                        <PlayArrowIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            )}

                            <Tooltip title={camp.message_template}>
                                <IconButton
                                    size="small"
                                    sx={{
                                        color: '#94a3b8',
                                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
                                    }}
                                >
                                    <ViewIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>

                            <Tooltip title="Reenviar">
                                <IconButton
                                    size="small"
                                    sx={{
                                        color: '#a855f7',
                                        bgcolor: 'rgba(168, 85, 247, 0.1)',
                                        '&:hover': { bgcolor: 'rgba(168, 85, 247, 0.2)' }
                                    }}
                                    onClick={() => handleResendCampaign(camp.id)}
                                >
                                    <RefreshIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>

                            <Tooltip title="Editar">
                                <IconButton
                                    size="small"
                                    sx={{
                                        color: '#60a5fa',
                                        bgcolor: 'rgba(96, 165, 250, 0.1)',
                                        '&:hover': { bgcolor: 'rgba(96, 165, 250, 0.2)' }
                                    }}
                                    onClick={() => handleEditCampaign(camp)}
                                >
                                    <HistoryIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>

                            <Tooltip title="Eliminar">
                                <IconButton
                                    size="small"
                                    sx={{
                                        color: '#f44336',
                                        bgcolor: 'rgba(244, 67, 54, 0.1)',
                                        '&:hover': { bgcolor: 'rgba(244, 67, 54, 0.2)' }
                                    }}
                                    onClick={() => confirmDeleteCampaign(camp.id)}
                                >
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Stack>
                    </Box>
                </CardContent>
            </Card>
        );
    };

    const renderSender = () => (
        <Box sx={{ p: 3 }}>
            <Grid container spacing={3}>
                <Grid item xs={12} md={7}>
                    <Card elevation={3} sx={{ borderRadius: 4, bgcolor: '#0f172a', color: '#f1f5f9' }}>
                        <CardContent sx={{ p: 4 }}>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', fontWeight: 600, mb: 3 }}>
                                <MessageIcon sx={{ mr: 1, color: '#60a5fa' }} /> Redactar Mensaje Directo
                            </Typography>

                            <TextField
                                fullWidth
                                label="Nombre del Envío (opcional)"
                                placeholder="Ej: Promoción Enero 2026"
                                value={directSendName}
                                onChange={(e) => setDirectSendName(e.target.value)}
                                sx={{ mb: 3, ...textFieldStyle }}
                                helperText="Identifica este envío para verlo en los reportes"
                            />

                            <Box sx={{ position: 'relative' }}>
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={5}
                                    label="Tu mensaje SMS"
                                    value={message}
                                    onChange={(e) => {
                                        const text = e.target.value;
                                        if (text.length <= 160) {
                                            setMessage(text);
                                        }
                                    }}
                                    placeholder="¡Hola! {nombre} ¿como estas?"
                                    sx={{ mb: 1, ...textFieldStyle }}
                                    helperText={`${message.length}/160 caracteres`}
                                    error={message.length >= 160}
                                />
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<EmojiIcon />}
                                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                            sx={{
                                                color: '#f1f5f9',
                                                borderColor: 'rgba(255,255,255,0.1)',
                                                borderRadius: 2,
                                                textTransform: 'none',
                                                bgcolor: 'rgba(255,255,255,0.03)',
                                                '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)' }
                                            }}
                                        >
                                            Emoji
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<LinkIcon />}
                                            onClick={() => setMessage(prev => (prev + ' http://').slice(0, 160))}
                                            sx={{
                                                color: '#f1f5f9',
                                                borderColor: 'rgba(255,255,255,0.1)',
                                                borderRadius: 2,
                                                textTransform: 'none',
                                                bgcolor: 'rgba(255,255,255,0.03)',
                                                '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)' }
                                            }}
                                        >
                                            URL
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<PersonIcon />}
                                            onClick={() => setMessage(prev => (prev + '{nombre}').slice(0, 160))}
                                            sx={{
                                                color: '#f1f5f9',
                                                borderColor: 'rgba(255,255,255,0.1)',
                                                borderRadius: 2,
                                                textTransform: 'none',
                                                bgcolor: 'rgba(255,255,255,0.03)',
                                                '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)' }
                                            }}
                                        >
                                            Nombre
                                        </Button>
                                    </Box>
                                </Box>
                                {showEmojiPicker && (
                                    <Box sx={{ position: 'absolute', bottom: '100%', left: 0, zIndex: 1000, mb: 1 }}>
                                        <EmojiPicker
                                            onEmojiClick={(emojiData) => {
                                                setMessage(prev => (prev + emojiData.emoji).slice(0, 160));
                                                setShowEmojiPicker(false);
                                            }}
                                            theme={"dark" as any}
                                            width={350}
                                            height={400}
                                        />
                                    </Box>
                                )}
                            </Box>

                            <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.05)' }} />

                            <Typography variant="subtitle2" sx={{ mb: 2, display: 'flex', alignItems: 'center', fontWeight: 600, color: '#f1f5f9' }}>
                                <GroupAddIcon sx={{ mr: 1, fontSize: 20, color: '#60a5fa' }} /> Destinatarios Manuales
                            </Typography>
                            <TextField
                                fullWidth
                                multiline
                                rows={4}
                                placeholder={"Ejemplo:\n595985768793,Claudio\n595994854167,Carlos\n595994854167,Liliana"}
                                value={recipients}
                                onChange={(e) => setRecipients(e.target.value)}
                                sx={{ mb: 4, ...textFieldStyle }}
                            />

                            <Typography variant="subtitle2" sx={{ mb: 2, display: 'flex', alignItems: 'center', fontWeight: 600, color: '#f1f5f9' }}>
                                <PlaylistAddIcon sx={{ mr: 1, fontSize: 20, color: '#a855f7' }} /> Seleccionar de Kanban
                            </Typography>
                            <Grid container spacing={2} sx={{ mb: 4 }}>
                                <Grid item xs={12} md={6}>
                                    <Autocomplete
                                        options={kanbanBoards}
                                        getOptionLabel={(option) => option.name}
                                        onChange={(_, newValue) => {
                                            setSelectedBoardId(newValue ? newValue.id : '');
                                            if (newValue) loadBoardContacts(newValue.id);
                                        }}
                                        renderInput={(params) => <TextField {...params} label="Tablero" size="small" sx={textFieldStyle} />}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Autocomplete
                                        multiple
                                        options={kanbanContacts}
                                        getOptionLabel={(option) => `${option.name} (${option.phone})`}
                                        value={selectedKanbanContacts}
                                        onChange={(_, newValue) => setSelectedKanbanContacts(newValue)}
                                        renderInput={(params) => <TextField {...params} label="Contactos" size="small" sx={textFieldStyle} />}
                                        disabled={!selectedBoardId}
                                    />
                                </Grid>
                            </Grid>

                            <Button
                                fullWidth
                                variant="contained"
                                color="primary"
                                size="large"
                                startIcon={sending ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                                disabled={sending}
                                onClick={handleSendSms}
                                sx={{
                                    borderRadius: 3,
                                    py: 2,
                                    fontSize: '1.1rem',
                                    fontWeight: 700,
                                    textTransform: 'none',
                                    boxShadow: '0 8px 16px rgba(37, 99, 235, 0.3)',
                                    backgroundImage: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                    '&:hover': {
                                        boxShadow: '0 12px 20px rgba(37, 99, 235, 0.4)',
                                        transform: 'translateY(-1px)'
                                    },
                                    mb: directSendProgress ? 2 : 0
                                }}
                            >
                                {sending ? 'Iniciando Envío...' : 'Ejecutar Envío Directo'}
                            </Button>

                            {directSendProgress && (
                                <Box sx={{ mt: 3 }}>
                                    <SophisticatedProgressBar
                                        progress={Math.round(((directSendProgress.sent + directSendProgress.failed) / directSendProgress.total) * 100)}
                                        message={`Enviando: ${directSendProgress.sent}/${directSendProgress.total} Enviados | ${directSendProgress.failed} Fallidos`}
                                    />
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                </Grid >

                <Grid item xs={12} md={5}>
                    <Card elevation={3} sx={{ borderRadius: 4, bgcolor: '#0f172a', color: '#f1f5f9', height: '100%', minHeight: 600 }}>
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', mb: 3 }}>
                                <HistoryIcon sx={{ mr: 1, color: '#f59e0b' }} /> Estado de Envíos Directos
                            </Typography>

                            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {campaigns.length === 0 ? (
                                    <Box sx={{ textAlign: 'center', py: 10, opacity: 0.5 }}>
                                        <HistoryIcon sx={{ fontSize: 64, mb: 2 }} />
                                        <Typography variant="h6">Sin envíos registrados</Typography>
                                        <Typography variant="body2">Tus envíos aparecerán aquí</Typography>
                                    </Box>
                                ) : (
                                    campaigns
                                        .slice().reverse()
                                        .slice(0, 15)
                                        .map((campaign) => renderCampaignCard(campaign))
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid >
        </Box >
    );

    const renderCampaigns = () => (
        <Box sx={{ p: 3 }}>
            <Grid container spacing={3}>
                <Grid item xs={12} md={7}>
                    <Card elevation={3} sx={{ borderRadius: 4, bgcolor: '#0f172a', color: '#f1f5f9' }}>
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                                <ScheduleIcon sx={{ mr: 1, color: '#a855f7' }} /> Nueva Campaña Programada
                            </Typography>
                            <TextField
                                fullWidth
                                label="Nombre de la Campaña"
                                value={campaignName}
                                onChange={(e) => setCampaignName(e.target.value)}
                                sx={{ mb: 2, ...textFieldStyle }}
                            />
                            <TextField
                                fullWidth
                                multiline
                                rows={4}
                                label="Mensaje de la Campaña"
                                placeholder="¡Hola! {nombre} ¿cómo estás?"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                sx={{ mb: 2, ...textFieldStyle }}
                                helperText="Usa {nombre} para personalizar"
                            />
                            <TextField
                                fullWidth
                                type="datetime-local"
                                label="Fecha y Hora de Envío"
                                InputLabelProps={{ shrink: true }}
                                value={scheduledDate}
                                onChange={(e) => setScheduledDate(e.target.value)}
                                sx={{ mb: 3, ...textFieldStyle }}
                            />

                            <Typography variant="subtitle2" sx={{ mb: 2, display: 'flex', alignItems: 'center', fontWeight: 600, color: '#f1f5f9' }}>
                                <GroupAddIcon sx={{ mr: 1, fontSize: 20, color: '#60a5fa' }} /> Destinatarios Manuales (Opcional)
                            </Typography>
                            <TextField
                                fullWidth
                                multiline
                                rows={4}
                                placeholder={"Ejemplo:\n595985768793,Claudio\n595994854167,Carlos\n595994854167,Liliana"}
                                value={recipients}
                                onChange={(e) => setRecipients(e.target.value)}
                                sx={{ mb: 3, ...textFieldStyle }}
                                helperText="Puedes combinar Kanban con números manuales"
                            />

                            <Typography variant="subtitle2" gutterBottom sx={{ color: '#f1f5f9', fontWeight: 600 }}>Destinatarios (Kanban)</Typography>
                            <Grid container spacing={2} sx={{ mb: 3 }}>
                                <Grid item xs={12} md={6}>
                                    <Autocomplete
                                        options={kanbanBoards}
                                        getOptionLabel={(option) => option.name}
                                        onChange={(_, newValue) => {
                                            setSelectedBoardId(newValue ? newValue.id : '');
                                            if (newValue) loadBoardContacts(newValue.id);
                                        }}
                                        renderInput={(params) => <TextField {...params} label="Tablero" size="small" sx={textFieldStyle} />}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Autocomplete
                                        multiple
                                        options={kanbanContacts}
                                        getOptionLabel={(option) => `${option.name} (${option.phone})`}
                                        value={selectedKanbanContacts}
                                        onChange={(_, newValue) => setSelectedKanbanContacts(newValue)}
                                        renderInput={(params) => <TextField {...params} label="Contactos" size="small" sx={textFieldStyle} />}
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
                                sx={{
                                    borderRadius: 3,
                                    py: 1.5,
                                    fontWeight: 700,
                                    textTransform: 'none',
                                    backgroundImage: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)'
                                }}
                            >
                                Programar Ahora
                            </Button>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={5}>
                    <Card elevation={3} sx={{ borderRadius: 4, bgcolor: '#0f172a', color: '#f1f5f9' }}>
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>Estado de Campañas</Typography>
                            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {campaigns.length === 0 ? (
                                    <Box sx={{ textAlign: 'center', py: 4, opacity: 0.5 }}>
                                        <HistoryIcon sx={{ fontSize: 48, mb: 1 }} />
                                        <Typography>No hay campañas creadas</Typography>
                                    </Box>
                                ) : (
                                    campaigns.slice().reverse().map(camp => renderCampaignCard(camp))
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );

    return (
        <Box sx={{ flexGrow: 1, height: '100%', overflow: 'auto' }}>
            <Paper sx={{ p: 3, mb: 3, mx: 3, mt: 3, borderRadius: 4, bgcolor: '#0f172a', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', fontWeight: 800 }}>
                            <SmsIcon sx={{ mr: 1.5, fontSize: 32, color: '#3b82f6' }} />
                            📱 SMS Premium
                        </Typography>
                        <Typography variant="body1" sx={{ color: '#94a3b8' }}>
                            Envía mensajes de texto masivos a tus contactos
                        </Typography>
                    </Box>
                    <IconButton
                        onClick={() => loadInitialData()}
                        title="Recargar"
                        sx={{
                            bgcolor: 'rgba(59, 130, 246, 0.1)',
                            color: '#3b82f6',
                            '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.2)' }
                        }}
                    >
                        <RefreshIcon />
                    </IconButton>
                </Box>

                <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Chip
                        icon={<SmsIcon style={{ color: '#3b82f6' }} />}
                        label={`${campaigns.length} campañas`}
                        sx={{ bgcolor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)', fontWeight: 600 }}
                    />
                    <Chip
                        icon={<HistoryIcon style={{ color: '#10b981' }} />}
                        label={`${campaigns.filter(c => c.status === 'completed').length} completadas`}
                        sx={{ bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', fontWeight: 600 }}
                    />
                    <Chip
                        icon={<SendIcon style={{ color: '#06b6d4' }} />}
                        label={`${stats.sent} SMS enviados`}
                        sx={{ bgcolor: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4', border: '1px solid rgba(6, 182, 212, 0.2)', fontWeight: 600 }}
                    />
                    <Chip
                        icon={<WalletIcon style={{ color: '#f59e0b' }} />}
                        label={`${Math.floor(stats.balance)} SMS disponibles`}
                        sx={{ bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)', fontWeight: 600 }}
                    />
                </Box>
            </Paper>

            <Box sx={{ px: 2, mb: 1 }}>
                <Paper
                    elevation={3}
                    sx={{
                        borderRadius: 4,
                        bgcolor: '#0f172a',
                        color: '#f1f5f9',
                        border: '1px solid rgba(255,255,255,0.05)',
                        overflow: 'hidden'
                    }}
                >
                    <Tabs
                        value={tab}
                        onChange={(_, v) => setTab(v)}
                        sx={{
                            '& .MuiTab-root': {
                                fontWeight: 600,
                                textTransform: 'none',
                                color: '#94a3b8',
                                py: 2,
                                px: 3,
                                transition: 'all 0.2s'
                            },
                            '& .Mui-selected': {
                                color: '#60a5fa !important',
                                bgcolor: 'rgba(96, 165, 250, 0.08)'
                            },
                            '& .MuiTabs-indicator': {
                                height: 3,
                                bgcolor: '#60a5fa',
                                borderRadius: '3px 3px 0 0'
                            }
                        }}
                    >
                        <Tab label="Dashboard" />
                        <Tab label="Envío Directo" />
                        <Tab label="Campañas" />
                    </Tabs>
                </Paper>
            </Box>

            {error && <Alert severity="error" sx={{ m: 2, borderRadius: 3 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ m: 2, borderRadius: 3 }}>{success}</Alert>}

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

            <Dialog
                open={showDeleteDialog}
                onClose={() => setShowDeleteDialog(false)}
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        bgcolor: '#1e293b',
                        color: '#f1f5f9',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                    }
                }}
            >
                <DialogTitle sx={{ pb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <DeleteIcon color="error" />
                        <Typography variant="h6" fontWeight="700">Confirmar Eliminación</Typography>
                    </Box>
                </DialogTitle>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                <DialogContent sx={{ pt: 3 }}>
                    <DialogContentText sx={{ color: '#94a3b8' }}>
                        ¿Estás seguro de que deseas eliminar esta campaña?
                        <br />
                        <Box component="span" sx={{ color: '#f87171', fontWeight: 600, mt: 1, display: 'block' }}>
                            Esta acción no se puede deshacer.
                        </Box>
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ p: 3, pt: 0 }}>
                    <Button onClick={() => setShowDeleteDialog(false)} sx={{ color: '#94a3b8' }}>Cancelar</Button>
                    <Button
                        onClick={handleDeleteCampaign}
                        variant="contained"
                        color="error"
                        sx={{ borderRadius: 2, px: 3 }}
                    >
                        Eliminar permanentemente
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Dialogo de Edición */}
            <Dialog
                open={showEditDialog}
                onClose={() => setShowEditDialog(false)}
                PaperProps={{ sx: { bgcolor: '#0f172a', color: '#f1f5f9', borderRadius: 4, minWidth: 400 } }}
            >
                <DialogTitle sx={{ fontWeight: 700 }}>Editar Campaña</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        label="Nombre"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        sx={{ mt: 2, mb: 3, ...textFieldStyle }}
                    />
                    <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label="Plantilla de Mensaje"
                        value={editTemplate}
                        onChange={(e) => setEditTemplate(e.target.value)}
                        sx={{ ...textFieldStyle }}
                        helperText={`${editTemplate.length}/160 caracteres`}
                    />
                </DialogContent>
                <DialogActions sx={{ p: 3 }}>
                    <Button onClick={() => setShowEditDialog(false)} sx={{ color: '#94a3b8' }}>Cancelar</Button>
                    <Button
                        onClick={handleSaveEdit}
                        variant="contained"
                        color="primary"
                        sx={{ borderRadius: 2, px: 3, backgroundImage: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
                    >
                        Guardar Cambios
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default SMSPremiumModule;
