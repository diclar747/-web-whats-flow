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

interface Plan {
    id: number;
    plan_name: string;
    plan_display_name: string;
    duration_days: number;
    price: string;
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
    const [plans, setPlans] = useState<Plan[]>([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [currentPlan, setCurrentPlan] = useState<Partial<Plan>>({});
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/subscriptions/plans', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setPlans(data.plans.map((p: any) => ({
                    ...p,
                    bot_enabled: Boolean(p.bot_enabled),
                    api_enabled: Boolean(p.api_enabled)
                })));
            }
        } catch (error) {
            console.error('Error fetching plans:', error);
        }
    };

    const handleSave = async () => {
        try {
            const token = localStorage.getItem('token');
            const method = isEditing ? 'PUT' : 'POST';
            const url = isEditing ? `/api/subscriptions/plans/${currentPlan.id}` : '/api/subscriptions/plans';

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
            const response = await fetch(`/api/subscriptions/plans/${id}`, {
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
                                <Typography variant="h5" component="div">
                                    {plan.plan_display_name}
                                </Typography>
                                <Typography sx={{ mb: 1.5 }} color="text.secondary">
                                    {plan.price} Gs/mes
                                </Typography>

                                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2 }}>
                                    <Typography variant="body2"><strong>Agentes:</strong> {plan.max_users}</Typography>
                                    <Typography variant="body2"><strong>Canales:</strong> {plan.max_channels || 1}</Typography>
                                    <Typography variant="body2"><strong>Mensajes:</strong> {plan.max_messages_per_month?.toLocaleString()}</Typography>
                                    <Typography variant="body2"><strong>Campañas:</strong> {plan.max_campaigns}</Typography>
                                </Box>

                                <Box sx={{ mt: 2 }}>
                                    <Chip
                                        icon={plan.bot_enabled ? <Check /> : <Close />}
                                        label="BOT IA"
                                        color={plan.bot_enabled ? "success" : "default"}
                                        variant="outlined"
                                        size="small"
                                        sx={{ mr: 1 }}
                                    />
                                    <Chip
                                        icon={plan.api_enabled ? <Check /> : <Close />}
                                        label="API REST"
                                        color={plan.api_enabled ? "success" : "default"}
                                        variant="outlined"
                                        size="small"
                                    />
                                </Box>
                            </CardContent>
                            <CardActions>
                                <Button size="small" startIcon={<Edit />} onClick={() => {
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

            <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle>{isEditing ? 'Editar Plan' : 'Nuevo Plan'}</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Nombre Interno (slug)"
                                fullWidth
                                value={currentPlan.plan_name || ''}
                                onChange={(e) => setCurrentPlan({ ...currentPlan, plan_name: e.target.value })}
                                disabled={isEditing}
                                helperText="Ej: basico, estandar, manager"
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Nombre para Mostrar"
                                fullWidth
                                value={currentPlan.plan_display_name || ''}
                                onChange={(e) => setCurrentPlan({ ...currentPlan, plan_display_name: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={6} md={4}>
                            <TextField
                                label="Precio (Gs)"
                                fullWidth
                                type="number"
                                value={currentPlan.price || ''}
                                onChange={(e) => setCurrentPlan({ ...currentPlan, price: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={6} md={4}>
                            <TextField
                                label="Duración (días)"
                                fullWidth
                                type="number"
                                value={currentPlan.duration_days || 30}
                                onChange={(e) => setCurrentPlan({ ...currentPlan, duration_days: parseInt(e.target.value) })}
                            />
                        </Grid>
                        <Grid item xs={6} md={4}>
                            <TextField
                                label="Máx. Agentes"
                                fullWidth
                                type="number"
                                value={currentPlan.max_users || ''}
                                onChange={(e) => setCurrentPlan({ ...currentPlan, max_users: parseInt(e.target.value) })}
                            />
                        </Grid>
                        <Grid item xs={6} md={4}>
                            <TextField
                                label="Máx. Canales"
                                fullWidth
                                type="number"
                                value={currentPlan.max_channels || ''}
                                onChange={(e) => setCurrentPlan({ ...currentPlan, max_channels: parseInt(e.target.value) })}
                            />
                        </Grid>
                        <Grid item xs={6} md={4}>
                            <TextField
                                label="Límite Mensajes/Mes"
                                fullWidth
                                type="number"
                                value={currentPlan.max_messages_per_month || ''}
                                onChange={(e) => setCurrentPlan({ ...currentPlan, max_messages_per_month: parseInt(e.target.value) })}
                            />
                        </Grid>
                        <Grid item xs={6} md={4}>
                            <TextField
                                label="Máx. Campañas"
                                fullWidth
                                type="number"
                                value={currentPlan.max_campaigns || ''}
                                onChange={(e) => setCurrentPlan({ ...currentPlan, max_campaigns: parseInt(e.target.value) })}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={currentPlan.bot_enabled || false}
                                        onChange={(e) => setCurrentPlan({ ...currentPlan, bot_enabled: e.target.checked })}
                                    />
                                }
                                label="Habilitar BOT IA"
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={currentPlan.api_enabled || false}
                                        onChange={(e) => setCurrentPlan({ ...currentPlan, api_enabled: e.target.checked })}
                                    />
                                }
                                label="Habilitar API REST"
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
