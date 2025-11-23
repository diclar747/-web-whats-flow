import React, { useState, useEffect } from 'react';
import { getAPIBaseURL } from '../utils/socketConfig';
import {
    Box,
    Grid,
    Card,
    CardContent,
    Typography,
    Button,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Chip,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    Alert,
    CircularProgress,
    Tabs,
    Tab,
    Stack,
    Divider,
    Tooltip,
    Switch,
    FormControlLabel,
} from '@mui/material';
import {
    Add,
    Edit,
    Delete,
    Send,
    Schedule,
    Image,
    VideoLibrary,
    TextFields,
    Refresh,
    PlayArrow,
    Pause,
    Visibility,
} from '@mui/icons-material';

interface WhatsAppStatusModuleProps {
    sessionId: string;
}

interface WhatsAppStatus {
    id: number;
    session_id: string;
    text_content: string | null;
    media_url: string | null;
    media_type: 'text' | 'image' | 'video';
    background_color: string;
    font_style: string;
    status: 'draft' | 'scheduled' | 'published' | 'failed' | 'expired';
    published_at: string | null;
    expires_at: string | null;
    created_at: string;
}

interface StatusSchedule {
    id: number;
    session_id: string;
    name: string;
    interval_minutes: number;
    rotation_days: number;
    is_active: boolean;
    current_index: number;
    next_publish_at: string;
    total_published: number;
    items: any[];
}

const WhatsAppStatusModule: React.FC<WhatsAppStatusModuleProps> = ({ sessionId }) => {
    const [statuses, setStatuses] = useState<WhatsAppStatus[]>([]);
    const [schedules, setSchedules] = useState<StatusSchedule[]>([]);
    const [loading, setLoading] = useState(false);
    const [tabValue, setTabValue] = useState(0);

    // Create/Edit Dialog
    const [openDialog, setOpenDialog] = useState(false);
    const [editingStatus, setEditingStatus] = useState<WhatsAppStatus | null>(null);
    const [formData, setFormData] = useState({
        textContent: '',
        mediaType: 'text' as 'text' | 'image' | 'video',
        backgroundColor: '#075E54',
        fontStyle: 'default',
    });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    // Schedule Dialog
    const [openScheduleDialog, setOpenScheduleDialog] = useState(false);
    const [scheduleForm, setScheduleForm] = useState({
        name: '',
        intervalMinutes: 60,
        rotationDays: 30,
        selectedStatusIds: [] as number[],
    });

    const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

    useEffect(() => {
        loadStatuses();
    }, [sessionId]);

    const loadStatuses = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${getAPIBaseURL()}/api/statuses/${sessionId}`);
            const data = await response.json();

            if (data.success) {
                setStatuses(data.statuses || []);
                setSchedules(data.schedules || []);
            } else {
                showAlert('error', 'Error al cargar estados');
            }
        } catch (error) {
            console.error('Error loading statuses:', error);
            showAlert('error', 'Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const showAlert = (type: 'success' | 'error' | 'info', message: string) => {
        setAlert({ type, message });
        setTimeout(() => setAlert(null), 5000);
    };

    const handleCreateStatus = async () => {
        try {
            const formDataToSend = new FormData();
            formDataToSend.append('sessionId', sessionId);
            formDataToSend.append('textContent', formData.textContent);
            formDataToSend.append('backgroundColor', formData.backgroundColor);
            formDataToSend.append('fontStyle', formData.fontStyle);

            if (selectedFile) {
                formDataToSend.append('mediaFile', selectedFile);
            }

            const response = await fetch(`${getAPIBaseURL()}/api/statuses/create`, {
                method: 'POST',
                body: formDataToSend,
            });

            const data = await response.json();

            if (data.success) {
                showAlert('success', 'Estado creado exitosamente');
                setOpenDialog(false);
                resetForm();
                loadStatuses();
            } else {
                showAlert('error', data.error || 'Error al crear estado');
            }
        } catch (error) {
            console.error('Error creating status:', error);
            showAlert('error', 'Error al crear estado');
        }
    };

    const handlePublishStatus = async (statusId: number) => {
        try {
            const response = await fetch(`${getAPIBaseURL()}/api/statuses/publish/${statusId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
            });

            const data = await response.json();

            if (data.success) {
                showAlert('success', '✅ Estado publicado en WhatsApp');
                loadStatuses();
            } else {
                showAlert('error', data.error || 'Error al publicar estado');
            }
        } catch (error) {
            console.error('Error publishing status:', error);
            showAlert('error', 'Error al publicar estado');
        }
    };

    const handleDeleteStatus = async (statusId: number) => {
        if (!window.confirm('¿Estás seguro de eliminar este estado?')) return;

        try {
            const response = await fetch(`${getAPIBaseURL()}/api/statuses/${statusId}`, {
                method: 'DELETE',
            });

            const data = await response.json();

            if (data.success) {
                showAlert('success', 'Estado eliminado');
                loadStatuses();
            } else {
                showAlert('error', 'Error al eliminar estado');
            }
        } catch (error) {
            console.error('Error deleting status:', error);
            showAlert('error', 'Error al eliminar estado');
        }
    };

    const handleCreateSchedule = async () => {
        if (scheduleForm.selectedStatusIds.length === 0) {
            showAlert('error', 'Selecciona al menos un estado');
            return;
        }

        try {
            const response = await fetch(`${getAPIBaseURL()}/api/statuses/schedule/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    name: scheduleForm.name,
                    statusIds: scheduleForm.selectedStatusIds,
                    intervalMinutes: scheduleForm.intervalMinutes,
                    rotationDays: scheduleForm.rotationDays,
                }),
            });

            const data = await response.json();

            if (data.success) {
                showAlert('success', 'Programación creada exitosamente');
                setOpenScheduleDialog(false);
                resetScheduleForm();
                loadStatuses();
            } else {
                showAlert('error', data.error || 'Error al crear programación');
            }
        } catch (error) {
            console.error('Error creating schedule:', error);
            showAlert('error', 'Error al crear programación');
        }
    };

    const handleToggleSchedule = async (scheduleId: number, isActive: boolean) => {
        try {
            const response = await fetch(`${getAPIBaseURL()}/api/statuses/schedule/${scheduleId}/toggle`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !isActive }),
            });

            const data = await response.json();

            if (data.success) {
                showAlert('success', `Programación ${!isActive ? 'activada' : 'desactivada'}`);
                loadStatuses();
            } else {
                showAlert('error', 'Error al actualizar programación');
            }
        } catch (error) {
            console.error('Error toggling schedule:', error);
            showAlert('error', 'Error al actualizar programación');
        }
    };

    const resetForm = () => {
        setFormData({
            textContent: '',
            mediaType: 'text',
            backgroundColor: '#075E54',
            fontStyle: 'default',
        });
        setSelectedFile(null);
        setEditingStatus(null);
    };

    const resetScheduleForm = () => {
        setScheduleForm({
            name: '',
            intervalMinutes: 60,
            rotationDays: 30,
            selectedStatusIds: [],
        });
    };

    const getStatusIcon = (mediaType: string) => {
        switch (mediaType) {
            case 'image': return <Image />;
            case 'video': return <VideoLibrary />;
            default: return <TextFields />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'published': return 'success';
            case 'scheduled': return 'info';
            case 'failed': return 'error';
            case 'expired': return 'default';
            default: return 'warning';
        }
    };

    const draftStatuses = statuses.filter(s => s.status === 'draft');
    const scheduledStatuses = statuses.filter(s => s.status === 'scheduled');
    const publishedStatuses = statuses.filter(s => s.status === 'published');

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: '#1a1a1a' }}>
                        Estados de WhatsApp
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        Gestiona y programa estados automáticos para WhatsApp
                    </Typography>
                </Box>
                <Stack direction="row" spacing={2}>
                    <Tooltip title="Actualizar">
                        <IconButton onClick={loadStatuses} color="primary">
                            <Refresh />
                        </IconButton>
                    </Tooltip>
                    <Button
                        variant="contained"
                        startIcon={<Add />}
                        onClick={() => setOpenDialog(true)}
                        sx={{ bgcolor: '#25d366', '&:hover': { bgcolor: '#1fa855' } }}
                    >
                        Nuevo Estado
                    </Button>
                </Stack>
            </Box>

            {/* Alert */}
            {alert && (
                <Alert severity={alert.type} sx={{ mb: 3 }} onClose={() => setAlert(null)}>
                    {alert.message}
                </Alert>
            )}

            {/* Tabs */}
            <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 3 }}>
                <Tab label={`Borradores (${draftStatuses.length})`} />
                <Tab label={`Programados (${scheduledStatuses.length})`} />
                <Tab label={`Publicados (${publishedStatuses.length})`} />
                <Tab label={`Programaciones (${schedules.length})`} />
            </Tabs>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <>
                    {/* Tab 0: Borradores */}
                    {tabValue === 0 && (
                        <Grid container spacing={3}>
                            {draftStatuses.length === 0 ? (
                                <Grid item xs={12}>
                                    <Card sx={{ textAlign: 'center', py: 6 }}>
                                        <Typography variant="h6" color="textSecondary">
                                            No hay estados en borrador
                                        </Typography>
                                        <Button
                                            variant="contained"
                                            startIcon={<Add />}
                                            onClick={() => setOpenDialog(true)}
                                            sx={{ mt: 2, bgcolor: '#25d366' }}
                                        >
                                            Crear Primer Estado
                                        </Button>
                                    </Card>
                                </Grid>
                            ) : (
                                draftStatuses.map((status) => (
                                    <Grid item xs={12} md={6} lg={4} key={status.id}>
                                        <Card>
                                            <CardContent>
                                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                                                    {getStatusIcon(status.media_type)}
                                                    <Typography variant="h6" sx={{ flex: 1 }}>
                                                        {status.media_type === 'text' ? 'Estado de Texto' : `Estado con ${status.media_type}`}
                                                    </Typography>
                                                    <Chip
                                                        label={status.status}
                                                        color={getStatusColor(status.status) as any}
                                                        size="small"
                                                    />
                                                </Stack>

                                                {status.text_content && (
                                                    <Typography variant="body2" sx={{ mb: 2 }}>
                                                        {status.text_content.substring(0, 100)}
                                                        {status.text_content.length > 100 && '...'}
                                                    </Typography>
                                                )}

                                                {status.media_url && (
                                                    <Box sx={{ mb: 2 }}>
                                                        {status.media_type === 'image' ? (
                                                            <img
                                                                src={`${getAPIBaseURL()}${status.media_url}`}
                                                                alt="Preview"
                                                                style={{ width: '100%', borderRadius: '8px', maxHeight: '200px', objectFit: 'cover' }}
                                                            />
                                                        ) : (
                                                            <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 1, textAlign: 'center' }}>
                                                                <VideoLibrary sx={{ fontSize: 48, color: '#666' }} />
                                                                <Typography variant="caption" display="block">
                                                                    Video adjunto
                                                                </Typography>
                                                            </Box>
                                                        )}
                                                    </Box>
                                                )}

                                                <Divider sx={{ my: 2 }} />

                                                <Stack direction="row" spacing={1}>
                                                    <Tooltip title="Publicar ahora">
                                                        <IconButton
                                                            size="small"
                                                            color="success"
                                                            onClick={() => handlePublishStatus(status.id)}
                                                        >
                                                            <Send />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Eliminar">
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            onClick={() => handleDeleteStatus(status.id)}
                                                        >
                                                            <Delete />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Stack>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))
                            )}
                        </Grid>
                    )}

                    {/* Tab 1: Programados */}
                    {tabValue === 1 && (
                        <Grid container spacing={3}>
                            {scheduledStatuses.length === 0 ? (
                                <Grid item xs={12}>
                                    <Card sx={{ textAlign: 'center', py: 6 }}>
                                        <Typography variant="h6" color="textSecondary">
                                            No hay estados programados
                                        </Typography>
                                    </Card>
                                </Grid>
                            ) : (
                                scheduledStatuses.map((status) => (
                                    <Grid item xs={12} md={6} lg={4} key={status.id}>
                                        <Card>
                                            <CardContent>
                                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                                                    {getStatusIcon(status.media_type)}
                                                    <Chip label="Programado" color="info" size="small" />
                                                </Stack>
                                                <Typography variant="body2">
                                                    {status.text_content?.substring(0, 100) || 'Estado multimedia'}
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))
                            )}
                        </Grid>
                    )}

                    {/* Tab 2: Publicados */}
                    {tabValue === 2 && (
                        <Grid container spacing={3}>
                            {publishedStatuses.length === 0 ? (
                                <Grid item xs={12}>
                                    <Card sx={{ textAlign: 'center', py: 6 }}>
                                        <Typography variant="h6" color="textSecondary">
                                            No hay estados publicados
                                        </Typography>
                                    </Card>
                                </Grid>
                            ) : (
                                publishedStatuses.map((status) => (
                                    <Grid item xs={12} md={6} lg={4} key={status.id}>
                                        <Card>
                                            <CardContent>
                                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                                                    {getStatusIcon(status.media_type)}
                                                    <Chip label="Publicado" color="success" size="small" />
                                                </Stack>
                                                <Typography variant="body2" sx={{ mb: 1 }}>
                                                    {status.text_content?.substring(0, 100) || 'Estado multimedia'}
                                                </Typography>
                                                <Typography variant="caption" color="textSecondary">
                                                    Publicado: {new Date(status.published_at!).toLocaleString()}
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))
                            )}
                        </Grid>
                    )}

                    {/* Tab 3: Programaciones */}
                    {tabValue === 3 && (
                        <Box>
                            <Button
                                variant="contained"
                                startIcon={<Schedule />}
                                onClick={() => setOpenScheduleDialog(true)}
                                sx={{ mb: 3, bgcolor: '#673ab7' }}
                            >
                                Nueva Programación
                            </Button>

                            <Grid container spacing={3}>
                                {schedules.length === 0 ? (
                                    <Grid item xs={12}>
                                        <Card sx={{ textAlign: 'center', py: 6 }}>
                                            <Typography variant="h6" color="textSecondary">
                                                No hay programaciones activas
                                            </Typography>
                                        </Card>
                                    </Grid>
                                ) : (
                                    schedules.map((schedule) => (
                                        <Grid item xs={12} md={6} key={schedule.id}>
                                            <Card>
                                                <CardContent>
                                                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                                                        <Typography variant="h6">{schedule.name}</Typography>
                                                        <FormControlLabel
                                                            control={
                                                                <Switch
                                                                    checked={schedule.is_active}
                                                                    onChange={() => handleToggleSchedule(schedule.id, schedule.is_active)}
                                                                    color="success"
                                                                />
                                                            }
                                                            label={schedule.is_active ? 'Activo' : 'Inactivo'}
                                                        />
                                                    </Stack>

                                                    <Typography variant="body2" color="textSecondary" gutterBottom>
                                                        📅 Intervalo: {schedule.interval_minutes} minutos
                                                    </Typography>
                                                    <Typography variant="body2" color="textSecondary" gutterBottom>
                                                        🔄 Rotación: {schedule.rotation_days} días
                                                    </Typography>
                                                    <Typography variant="body2" color="textSecondary" gutterBottom>
                                                        📊 Estados: {schedule.items?.length || 0}
                                                    </Typography>
                                                    <Typography variant="body2" color="textSecondary" gutterBottom>
                                                        ✅ Publicados: {schedule.total_published}
                                                    </Typography>
                                                    <Typography variant="body2" color="textSecondary">
                                                        ⏰ Próximo: {new Date(schedule.next_publish_at).toLocaleString()}
                                                    </Typography>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    ))
                                )}
                            </Grid>
                        </Box>
                    )}
                </>
            )}

            {/* Create/Edit Dialog */}
            <Dialog open={openDialog} onClose={() => { setOpenDialog(false); resetForm(); }} maxWidth="sm" fullWidth>
                <DialogTitle>Crear Nuevo Estado</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 2 }}>
                        <FormControl fullWidth>
                            <InputLabel>Tipo de Estado</InputLabel>
                            <Select
                                value={formData.mediaType}
                                label="Tipo de Estado"
                                onChange={(e) => setFormData({ ...formData, mediaType: e.target.value as any })}
                            >
                                <MenuItem value="text">Solo Texto</MenuItem>
                                <MenuItem value="image">Imagen con Texto</MenuItem>
                                <MenuItem value="video">Video con Texto</MenuItem>
                            </Select>
                        </FormControl>

                        <TextField
                            label="Texto del Estado"
                            multiline
                            rows={4}
                            fullWidth
                            value={formData.textContent}
                            onChange={(e) => setFormData({ ...formData, textContent: e.target.value })}
                            placeholder="Escribe el contenido de tu estado..."
                        />

                        {(formData.mediaType === 'image' || formData.mediaType === 'video') && (
                            <Button
                                variant="outlined"
                                component="label"
                                fullWidth
                            >
                                {selectedFile ? selectedFile.name : `Seleccionar ${formData.mediaType === 'image' ? 'Imagen' : 'Video'}`}
                                <input
                                    type="file"
                                    hidden
                                    accept={formData.mediaType === 'image' ? 'image/*' : 'video/*'}
                                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                />
                            </Button>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setOpenDialog(false); resetForm(); }}>
                        Cancelar
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleCreateStatus}
                        disabled={!formData.textContent && !selectedFile}
                        sx={{ bgcolor: '#25d366' }}
                    >
                        Crear Estado
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Schedule Dialog */}
            <Dialog open={openScheduleDialog} onClose={() => { setOpenScheduleDialog(false); resetScheduleForm(); }} maxWidth="md" fullWidth>
                <DialogTitle>Nueva Programación Automática</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 2 }}>
                        <TextField
                            label="Nombre de la Programación"
                            fullWidth
                            value={scheduleForm.name}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                            placeholder="Ej: Estados Diarios"
                        />

                        <TextField
                            label="Intervalo (minutos)"
                            type="number"
                            fullWidth
                            value={scheduleForm.intervalMinutes}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, intervalMinutes: parseInt(e.target.value) })}
                            helperText="Cada cuántos minutos se publicará un estado"
                        />

                        <TextField
                            label="Días de Rotación"
                            type="number"
                            fullWidth
                            value={scheduleForm.rotationDays}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, rotationDays: parseInt(e.target.value) })}
                            helperText="Después de cuántos días se desactiva la programación"
                        />

                        <Box>
                            <Typography variant="subtitle2" gutterBottom>
                                Seleccionar Estados ({scheduleForm.selectedStatusIds.length} seleccionados)
                            </Typography>
                            <List sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: 1 }}>
                                {draftStatuses.map((status) => (
                                    <ListItem
                                        key={status.id}
                                        button
                                        selected={scheduleForm.selectedStatusIds.includes(status.id)}
                                        onClick={() => {
                                            const isSelected = scheduleForm.selectedStatusIds.includes(status.id);
                                            setScheduleForm({
                                                ...scheduleForm,
                                                selectedStatusIds: isSelected
                                                    ? scheduleForm.selectedStatusIds.filter(id => id !== status.id)
                                                    : [...scheduleForm.selectedStatusIds, status.id]
                                            });
                                        }}
                                    >
                                        <ListItemText
                                            primary={status.text_content?.substring(0, 50) || `Estado ${status.media_type}`}
                                            secondary={`Tipo: ${status.media_type}`}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setOpenScheduleDialog(false); resetScheduleForm(); }}>
                        Cancelar
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleCreateSchedule}
                        disabled={!scheduleForm.name || scheduleForm.selectedStatusIds.length === 0}
                        sx={{ bgcolor: '#673ab7' }}
                    >
                        Crear Programación
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default WhatsAppStatusModule;
