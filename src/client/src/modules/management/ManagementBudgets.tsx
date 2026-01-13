import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Grid,
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
    LinearProgress,
    Stack,
    InputAdornment,
    CircularProgress,
    useTheme,
    alpha
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { getAPIBaseURL } from '../../utils/socketConfig';
import { motion } from 'framer-motion';

const ManagementBudgets: React.FC = () => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [budgets, setBudgets] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [openDialog, setOpenDialog] = useState(false);
    const [editingBudget, setEditingBudget] = useState<any>(null);
    const [formData, setFormData] = useState({
        name: '',
        category_id: '',
        total_amount: '',
        period: 'monthly',
        start_date: new Date().toISOString().split('T')[0],
        end_date: ''
    });

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const [budRes, catRes] = await Promise.all([
                fetch(`${getAPIBaseURL()}/api/management/budgets`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${getAPIBaseURL()}/api/management/categories`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            const budData = await budRes.json();
            const catData = await catRes.json();
            if (budData.success) setBudgets(budData.budgets);
            if (catData.success) setCategories(catData.categories.filter((c: any) => c.type === 'expense'));
        } catch (error) {
            console.error('Error fetching budgets:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleOpenDialog = (budget: any = null) => {
        if (budget) {
            setEditingBudget(budget);
            setFormData({
                name: budget.name,
                category_id: budget.category_id,
                total_amount: budget.total_amount,
                period: budget.period,
                start_date: budget.start_date.split('T')[0],
                end_date: budget.end_date ? budget.end_date.split('T')[0] : ''
            });
        } else {
            setEditingBudget(null);
            setFormData({
                name: '',
                category_id: '',
                total_amount: '',
                period: 'monthly',
                start_date: new Date().toISOString().split('T')[0],
                end_date: ''
            });
        }
        setOpenDialog(true);
    };

    const handleSave = async () => {
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const method = editingBudget ? 'PUT' : 'POST';
            const url = editingBudget
                ? `${getAPIBaseURL()}/api/management/budgets/${editingBudget.id}`
                : `${getAPIBaseURL()}/api/management/budgets`;

            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            if (data.success) {
                setOpenDialog(false);
                fetchData();
            }
        } catch (error) {
            console.error('Error saving budget:', error);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('¿Estás seguro de eliminar este presupuesto?')) return;
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const response = await fetch(`${getAPIBaseURL()}/api/management/budgets/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) fetchData();
        } catch (error) {
            console.error('Error deleting budget:', error);
        }
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 5 }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: theme.palette.text.primary }}>
                        Planeación Presupuestaria
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                        Define límites de control para optimizar tu flujo de caja.
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => handleOpenDialog()}
                    sx={{
                        borderRadius: '14px',
                        px: 3, py: 1.5,
                        boxShadow: isDark ? '0 8px 25px rgba(0,0,0,0.4)' : '0 8px 25px rgba(99, 102, 241, 0.3)',
                    }}
                >
                    Nuevo Presupuesto
                </Button>
            </Box>

            <Grid container spacing={4}>
                {budgets.map((budget, idx) => {
                    const spent = parseFloat(budget.current_spent || 0);
                    const limit = parseFloat(budget.total_amount);
                    const percent = Math.min((spent / limit) * 100, 100);
                    const isExceeded = spent > limit;

                    return (
                        <Grid item xs={12} md={6} lg={4} key={budget.id}>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                            >
                                <Paper sx={{
                                    p: 4, borderRadius: '28px',
                                    background: alpha(theme.palette.background.paper, 0.7),
                                    backdropFilter: 'blur(20px)',
                                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                                    boxShadow: isDark ? '0 15px 45px rgba(0,0,0,0.3)' : '0 15px 45px rgba(0,0,0,0.03)',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                                        <Box>
                                            <Typography variant="h6" sx={{ fontWeight: 800, color: theme.palette.text.primary }}>{budget.name}</Typography>
                                            <Typography variant="caption" sx={{ color: theme.palette.primary.main, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                {budget.category_name}
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <IconButton onClick={() => handleOpenDialog(budget)} size="small" sx={{ bgcolor: alpha(theme.palette.text.primary, 0.03), mr: 1, color: theme.palette.text.primary }}>
                                                <Edit fontSize="small" />
                                            </IconButton>
                                            <IconButton onClick={() => handleDelete(budget.id)} size="small" sx={{ bgcolor: alpha(theme.palette.error.main, 0.05), color: theme.palette.error.main }}>
                                                <Delete fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    </Box>

                                    <Box sx={{ mb: 4 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                                            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>Ejecución</Typography>
                                            <Typography variant="body2" sx={{ color: isExceeded ? theme.palette.error.main : theme.palette.text.primary, fontWeight: 800 }}>
                                                {percent.toFixed(1)}%
                                            </Typography>
                                        </Box>
                                        <LinearProgress
                                            variant="determinate"
                                            value={percent}
                                            sx={{
                                                height: 12,
                                                borderRadius: 6,
                                                bgcolor: alpha(theme.palette.text.primary, 0.05),
                                                '& .MuiLinearProgress-bar': {
                                                    borderRadius: 6,
                                                    background: isExceeded
                                                        ? `linear-gradient(90deg, ${theme.palette.error.main} 0%, ${theme.palette.error.light} 100%)`
                                                        : `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`
                                                }
                                            }}
                                        />
                                    </Box>

                                    <Stack direction="row" spacing={2} justifyContent="space-between">
                                        <Box>
                                            <Typography variant="caption" display="block" sx={{ color: theme.palette.text.disabled, fontWeight: 600 }}>CONSUMIDO</Typography>
                                            <Typography variant="h6" sx={{ fontWeight: 800, color: isExceeded ? theme.palette.error.main : theme.palette.text.primary }}>
                                                Gs. {spent.toLocaleString('es-PY')}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ textAlign: 'right' }}>
                                            <Typography variant="caption" display="block" sx={{ color: theme.palette.text.disabled, fontWeight: 600 }}>LÍMITE</Typography>
                                            <Typography variant="h6" sx={{ fontWeight: 800, color: theme.palette.text.primary }}>
                                                Gs. {limit.toLocaleString('es-PY')}
                                            </Typography>
                                        </Box>
                                    </Stack>

                                    {isExceeded && (
                                        <Box sx={{
                                            mt: 2, p: 1, borderRadius: '10px',
                                            bgcolor: alpha(theme.palette.error.main, 0.05),
                                            border: `1px dashed ${theme.palette.error.main}`,
                                            display: 'flex', alignItems: 'center', gap: 1
                                        }}>
                                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: theme.palette.error.main }} />
                                            <Typography variant="caption" sx={{ color: theme.palette.error.main, fontWeight: 700 }}>SOBREPASADO</Typography>
                                        </Box>
                                    )}
                                </Paper>
                            </motion.div>
                        </Grid>
                    );
                })}
            </Grid>

            {budgets.length === 0 && (
                <Paper sx={{
                    p: 10, textAlign: 'center', borderRadius: '32px',
                    background: alpha(theme.palette.background.paper, 0.4),
                    backdropFilter: 'blur(10px)',
                    border: `1px dashed ${alpha(theme.palette.divider, 0.2)}`
                }}>
                    <Typography sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>No hay presupuestos activos de momento.</Typography>
                </Paper>
            )}

            <Dialog
                open={openDialog}
                onClose={() => setOpenDialog(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: '32px',
                        p: 1,
                        background: alpha(theme.palette.background.paper, 0.95),
                        backdropFilter: 'blur(10px)',
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                    }
                }}
            >
                <DialogTitle sx={{ fontWeight: 900, fontSize: '1.6rem', px: 4, pt: 4, color: theme.palette.text.primary }}>
                    {editingBudget ? 'Configuración de Meta' : 'Nueva Meta de Gasto'}
                </DialogTitle>
                <DialogContent sx={{ px: 4 }}>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        <TextField
                            fullWidth
                            label="Nombre del Presupuesto"
                            placeholder="Ej: Marketing Digital Q1"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
                        />
                        <FormControl fullWidth>
                            <InputLabel>Categoría de Gasto</InputLabel>
                            <Select
                                value={formData.category_id}
                                sx={{ borderRadius: '16px' }}
                                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                            >
                                {categories.map(c => (
                                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <TextField
                            fullWidth
                            label="Monto Máximo"
                            type="number"
                            value={formData.total_amount}
                            onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
                            InputProps={{
                                startAdornment: <InputAdornment position="start">Gs.</InputAdornment>,
                            }}
                        />
                        <Stack direction="row" spacing={2}>
                            <TextField
                                fullWidth
                                type="date"
                                label="Inicio"
                                value={formData.start_date}
                                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                InputLabelProps={{ shrink: true }}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
                            />
                            <TextField
                                fullWidth
                                type="date"
                                label="Fin (Opcional)"
                                value={formData.end_date}
                                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                InputLabelProps={{ shrink: true }}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
                            />
                        </Stack>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 4 }}>
                    <Button onClick={() => setOpenDialog(false)} sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>Cancelar</Button>
                    <Button
                        variant="contained"
                        onClick={handleSave}
                        sx={{
                            borderRadius: '14px',
                            px: 4,
                            '&:hover': { transform: 'translateY(-1px)' }
                        }}
                    >
                        Confirmar Meta
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ManagementBudgets;
