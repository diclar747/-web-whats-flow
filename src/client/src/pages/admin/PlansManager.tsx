import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    CardActions,
    Typography,
    Grid,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Chip,
    FormControlLabel,
    Checkbox
} from '@mui/material';
import { Add, Edit, Delete, Check, Close } from '@mui/icons-material';
import { getAPIBaseURL } from '../../utils/socketConfig';

console.log('[PlansManager] ⚡ MÓDULO CARGADO - PlansManager.tsx ejecutándose');

interface Plan {
    id: number;
    plan_name: string;
    plan_display_name: string;
    description: string;
    duration_days: number;
    price: string | number;
    max_users: number;
    max_messages_per_month: number;
    max_campaigns: number;
    max_contacts: number;
    max_channels: number;
    bot_enabled: boolean;
    api_enabled: boolean;
    status: string;
}

const PlansManager: React.FC = () => {
    console.log('[PlansManager] 🎨 COMPONENTE RENDERIZADO');
    const [plans, setPlans] = useState<Plan[]>([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [currentPlan, setCurrentPlan] = useState<Partial<Plan>>({});
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        console.log('[PlansManager] 🔧 useEffect ejecutado - llamando fetchPlans()');
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        console.log('[PlansManager] 🔄 Iniciando fetch de planes...');
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${getAPIBaseURL()}/api/plans`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            console.log('[PlansManager] 📦 Datos recibidos:', data);
            if (data.success) {
                const mappedPlans = data.plans.map((p: any) => ({
                    ...p,
                    bot_enabled: Boolean(p.bot_enabled),
                    api_enabled: Boolean(p.api_enabled)
                }));
                console.log('[PlansManager] ✅ Planes mapeados:', mappedPlans.length);
                setPlans(mappedPlans);
            } else {
                console.error('[PlansManager] ❌ Error en respuesta:', data.error);
            }
        } catch (error) {
            console.error('[PlansManager] ❌ Error fetching plans:', error);
        }
    };

    const handleSave = async () => {
        try {
            const token = localStorage.getItem('token');
            const method = isEditing ? 'PUT' : 'POST';
            const url = isEditing ? `${getAPIBaseURL()}/api/plans/${currentPlan.id}` : `${getAPIBaseURL()}/api/plans`;

            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(currentPlan)
            });

            const data = await response.json();
            if (data.success) {
                setOpenDialog(false);
                fetchPlans();
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Error saving plan:', error);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('¿Estás seguro de eliminar este plan?')) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${getAPIBaseURL()}/api/plans/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                fetchPlans();
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Error deleting plan:', error);
        }
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => {
                        setCurrentPlan({
                            bot_enabled: true,
                            api_enabled: true,
                            duration_days: 30,
                            max_users: 1,
                            max_channels: 1,
                            max_messages_per_month: 1000,
                            max_campaigns: 10,
                            max_contacts: 1000
                        });
                        setIsEditing(false);
                        setOpenDialog(true);
                    }}
                >
                    Nuevo Plan
                </Button>
            </Box>

            <Grid container spacing={3}>
                {plans.map((plan) => (
                    <Grid item xs={12} md={4} key={plan.id}>
                        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <CardContent sx={{ flexGrow: 1 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                        {plan.plan_display_name}
                                    </Typography>
                                    <Chip
                                        label={plan.plan_name}
                                        size="small"
                                        variant="outlined"
                                        sx={{ color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)' }}
                                    />
                                </Box>
                                <Typography variant="h4" sx={{ mb: 2, fontWeight: 'bold' }}>
                                    Gs. {Number(plan.price).toLocaleString()}
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 2 }}>
                                    {plan.description}
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                                        • {plan.max_users} Agentes
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                                        • {plan.max_channels} Canales
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                                        • {Number(plan.max_messages_per_month).toLocaleString()} Mensajes/mes
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                        {plan.bot_enabled && <Chip label="BOT IA" size="small" color="secondary" />}
                                        {plan.api_enabled && <Chip label="API REST" size="small" color="info" />}
                                    </Box>
                                </Box>
                            </CardContent>
                            <CardActions sx={{ justifyContent: 'flex-end', p: 2, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <Button size="small" color="primary" startIcon={<Edit />} onClick={() => {
                                    setCurrentPlan(plan);
                                    setIsEditing(true);
                                    setOpenDialog(true);
                                }}>Editar</Button>
                                <Button size="small" color="error" startIcon={<Delete />} onClick={() => handleDelete(plan.id)}>Eliminar</Button>
                            </CardActions>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Dialog
                open={openDialog}
                onClose={() => setOpenDialog(false)}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        bgcolor: '#1a1a2e',
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }
                }}
            >
                <DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    {isEditing ? 'Editar Plan' : 'Nuevo Plan'}
                </DialogTitle>
                <DialogContent sx={{ mt: 2 }}>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Nombre Interno (slug)"
                                fullWidth
                                value={currentPlan.plan_name || ''}
                                onChange={(e) => setCurrentPlan({ ...currentPlan, plan_name: e.target.value })}
                                disabled={isEditing}
                                helperText="Ej: basico, estandar, manager"
                                InputLabelProps={{ style: { color: 'rgba(255,255,255,0.7)' } }}
                                inputProps={{ style: { color: 'white' } }}
                                sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Nombre para Mostrar"
                                fullWidth
                                value={currentPlan.plan_display_name || ''}
                                onChange={(e) => setCurrentPlan({ ...currentPlan, plan_display_name: e.target.value })}
                                InputLabelProps={{ style: { color: 'rgba(255,255,255,0.7)' } }}
                                inputProps={{ style: { color: 'white' } }}
                                sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                label="Descripción"
                                fullWidth
                                multiline
                                rows={2}
                                value={currentPlan.description || ''}
                                onChange={(e) => setCurrentPlan({ ...currentPlan, description: e.target.value })}
                                InputLabelProps={{ style: { color: 'rgba(255,255,255,0.7)' } }}
                                inputProps={{ style: { color: 'white' } }}
                                sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                            />
                        </Grid>
                        <Grid item xs={6} md={4}>
                            <TextField
                                label="Precio (Gs)"
                                fullWidth
                                type="number"
                                value={currentPlan.price || ''}
                                onChange={(e) => setCurrentPlan({ ...currentPlan, price: e.target.value })}
                                InputLabelProps={{ style: { color: 'rgba(255,255,255,0.7)' } }}
                                inputProps={{ style: { color: 'white' } }}
                                sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                            />
                        </Grid>
                        <Grid item xs={6} md={4}>
                            <TextField
                                label="Agentes"
                                fullWidth
                                type="number"
                                value={currentPlan.max_users || ''}
                                onChange={(e) => setCurrentPlan({ ...currentPlan, max_users: Number(e.target.value) })}
                                InputLabelProps={{ style: { color: 'rgba(255,255,255,0.7)' } }}
                                inputProps={{ style: { color: 'white' } }}
                                sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                            />
                        </Grid>
                        <Grid item xs={6} md={4}>
                            <TextField
                                label="Canales (Sesiones)"
                                fullWidth
                                type="number"
                                value={currentPlan.max_channels || ''}
                                onChange={(e) => setCurrentPlan({ ...currentPlan, max_channels: Number(e.target.value) })}
                                InputLabelProps={{ style: { color: 'rgba(255,255,255,0.7)' } }}
                                inputProps={{ style: { color: 'white' } }}
                                sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                            />
                        </Grid>
                        <Grid item xs={6} md={6}>
                            <TextField
                                label="Mensajes por Mes"
                                fullWidth
                                type="number"
                                value={currentPlan.max_messages_per_month || ''}
                                onChange={(e) => setCurrentPlan({ ...currentPlan, max_messages_per_month: Number(e.target.value) })}
                                InputLabelProps={{ style: { color: 'rgba(255,255,255,0.7)' } }}
                                inputProps={{ style: { color: 'white' } }}
                                sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={currentPlan.bot_enabled || false}
                                        onChange={(e) => setCurrentPlan({ ...currentPlan, bot_enabled: e.target.checked })}
                                        sx={{ color: 'rgba(255,255,255,0.3)', '&.Mui-checked': { color: 'primary.main' } }}
                                    />
                                }
                                label={<Typography sx={{ color: 'white' }}>Bot IA</Typography>}
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={currentPlan.api_enabled || false}
                                        onChange={(e) => setCurrentPlan({ ...currentPlan, api_enabled: e.target.checked })}
                                        sx={{ color: 'rgba(255,255,255,0.3)', '&.Mui-checked': { color: 'primary.main' } }}
                                    />
                                }
                                label={<Typography sx={{ color: 'white' }}>API REST</Typography>}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
                    <Button onClick={handleSave} variant="contained">Guardar</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default PlansManager;
