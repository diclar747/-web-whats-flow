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
    List,
    ListItem,
    ListItemText,
    IconButton,
    Chip,
    FormControlLabel,
    Checkbox
} from '@mui/material';
import { Add, Edit, Delete, Check, Close } from '@mui/icons-material';

interface Plan {
    id: number;
    name: string;
    description: string;
    price: string;
    modules: string[];
    max_agents: number;
    max_sessions: number;
    max_channels: number;
    max_messages: number;
    bot_enabled: boolean;
    api_enabled: boolean;
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
            const response = await fetch('/api/plans', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setPlans(data.plans.map((p: any) => ({
                    ...p,
                    modules: typeof p.modules === 'string' ? JSON.parse(p.modules) : p.modules || [],
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
            const url = isEditing ? `/api/plans/${currentPlan.id}` : '/api/plans';

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
            const response = await fetch(`/api/plans/${id}`, {
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
                        setCurrentPlan({ modules: [], bot_enabled: false, api_enabled: false });
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
                                    {plan.name}
                                </Typography>
                                <Typography sx={{ mb: 1.5 }} color="text.secondary">
                                    ${plan.price}/mes
                                </Typography>
                                <Typography variant="body2" sx={{ mb: 2 }}>
                                    {plan.description}
                                </Typography>

                                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                                    <Typography variant="body2"><strong>Agentes:</strong> {plan.max_agents}</Typography>
                                    <Typography variant="body2"><strong>Canales:</strong> {plan.max_channels || 1}</Typography>
                                    <Typography variant="body2"><strong>Sesiones:</strong> {plan.max_sessions}</Typography>
                                    <Typography variant="body2"><strong>Mensajes:</strong> {plan.max_messages || 1000}</Typography>
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

                                <Box sx={{ mt: 2 }}>
                                    <Typography variant="subtitle2">Módulos:</Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {plan.modules && plan.modules.map((m) => <Chip key={m} label={m} size="small" />)}
                                    </Box>
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

            <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
                <DialogTitle>{isEditing ? 'Editar Plan' : 'Nuevo Plan'}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Nombre del Plan"
                        fullWidth
                        value={currentPlan.name || ''}
                        onChange={(e) => setCurrentPlan({ ...currentPlan, name: e.target.value })}
                    />
                    <TextField
                        margin="dense"
                        label="Descripción"
                        fullWidth
                        multiline
                        rows={2}
                        value={currentPlan.description || ''}
                        onChange={(e) => setCurrentPlan({ ...currentPlan, description: e.target.value })}
                    />
                    <Grid container spacing={2}>
                        <Grid item xs={6}>
                            <TextField
                                margin="dense"
                                label="Precio (mensual)"
                                fullWidth
                                type="number"
                                value={currentPlan.price || ''}
                                onChange={(e) => setCurrentPlan({ ...currentPlan, price: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                margin="dense"
                                label="Máximo de Agentes"
                                fullWidth
                                type="number"
                                value={currentPlan.max_agents || ''}
                                onChange={(e) => setCurrentPlan({ ...currentPlan, max_agents: parseInt(e.target.value) })}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                margin="dense"
                                label="Máximo de Canales"
                                fullWidth
                                type="number"
                                value={currentPlan.max_channels || ''}
                                onChange={(e) => setCurrentPlan({ ...currentPlan, max_channels: parseInt(e.target.value) })}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                margin="dense"
                                label="Límite Envíos"
                                fullWidth
                                type="number"
                                value={currentPlan.max_messages || ''}
                                onChange={(e) => setCurrentPlan({ ...currentPlan, max_messages: parseInt(e.target.value) })}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                margin="dense"
                                label="Máximo de Sesiones"
                                fullWidth
                                type="number"
                                value={currentPlan.max_sessions || ''}
                                onChange={(e) => setCurrentPlan({ ...currentPlan, max_sessions: parseInt(e.target.value) })}
                            />
                        </Grid>
                    </Grid>

                    <Box sx={{ mt: 2 }}>
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
                    </Box>
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
