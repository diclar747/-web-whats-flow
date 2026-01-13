import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    Alert,
    CircularProgress,
    Grid,
    Stack,
    InputAdornment,
    useTheme,
    alpha
} from '@mui/material';
import { Add, Edit, Delete, Search, FilterList } from '@mui/icons-material';
import { getAPIBaseURL } from '../../utils/socketConfig';
import { motion } from 'framer-motion';

const ManagementRecords: React.FC = () => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [records, setRecords] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [budgets, setBudgets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [openDialog, setOpenDialog] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [formData, setFormData] = useState({
        type: 'expense',
        category_id: '',
        budget_id: '',
        amount: '',
        description: '',
        record_date: new Date().toISOString().split('T')[0],
        payment_method: 'Efectivo',
        reference_number: ''
    });
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const [recordsRes, catRes, budRes] = await Promise.all([
                fetch(`${getAPIBaseURL()}/api/management/records`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${getAPIBaseURL()}/api/management/categories`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${getAPIBaseURL()}/api/management/budgets`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            const [recordsData, catData, budData] = await Promise.all([
                recordsRes.json(),
                catRes.json(),
                budRes.json()
            ]);

            if (recordsData.success) setRecords(recordsData.records);
            if (catData.success) setCategories(catData.categories);
            if (budData.success) setBudgets(budData.budgets);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleOpenDialog = (record: any = null) => {
        if (record) {
            setEditingRecord(record);
            setFormData({
                ...record,
                record_date: record.record_date.split('T')[0]
            });
        } else {
            setEditingRecord(null);
            setFormData({
                type: 'expense',
                category_id: '',
                budget_id: '',
                amount: '',
                description: '',
                record_date: new Date().toISOString().split('T')[0],
                payment_method: 'Efectivo',
                reference_number: ''
            });
        }
        setOpenDialog(true);
        setError(null);
    };

    const handleSave = async () => {
        if (!formData.amount || !formData.category_id || !formData.record_date) {
            return setError('Monto, categoría y fecha son requeridos');
        }

        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const method = editingRecord ? 'PUT' : 'POST';
            const url = editingRecord
                ? `${getAPIBaseURL()}/api/management/records/${editingRecord.id}`
                : `${getAPIBaseURL()}/api/management/records`;

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
            } else {
                setError(data.error);
            }
        } catch (error: any) {
            setError(error.message);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('¿Estás seguro de eliminar este registro?')) return;

        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const response = await fetch(`${getAPIBaseURL()}/api/management/records/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();
            if (data.success) {
                fetchData();
            } else {
                alert(data.error);
            }
        } catch (error: any) {
            alert(error.message);
        }
    };

    const filteredCategories = categories.filter(c => c.type === formData.type && c.status === 'active');

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: theme.palette.text.primary }}>
                    Registro de Operaciones
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => handleOpenDialog()}
                    sx={{
                        borderRadius: '12px',
                        px: 3, py: 1.5,
                        boxShadow: isDark ? '0 8px 20px rgba(0,0,0,0.4)' : '0 8px 20px rgba(63, 81, 181, 0.2)',
                        transition: 'all 0.3s'
                    }}
                >
                    Nueva Transacción
                </Button>
            </Box>

            <Paper sx={{
                mb: 4, p: 1.5, borderRadius: '16px',
                display: 'flex', alignItems: 'center', gap: 2,
                background: alpha(theme.palette.background.paper, 0.5),
                backdropFilter: 'blur(10px)',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
            }}>
                <Box sx={{ p: 1, bgcolor: alpha(theme.palette.text.primary, 0.05), borderRadius: '10px' }}>
                    <Search color="action" />
                </Box>
                <TextField
                    placeholder="Filtrar por descripción o categoría..."
                    variant="standard"
                    fullWidth
                    InputProps={{ disableUnderline: true, sx: { fontSize: '0.95rem', color: theme.palette.text.primary } }}
                />
                <Button startIcon={<FilterList />} sx={{ borderRadius: '10px', color: theme.palette.text.secondary }}>Avanzado</Button>
            </Paper>

            <TableContainer component={Paper} sx={{
                borderRadius: '24px',
                overflow: 'hidden',
                background: alpha(theme.palette.background.paper, 0.7),
                backdropFilter: 'blur(20px)',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                boxShadow: isDark ? '0 10px 40px rgba(0,0,0,0.3)' : '0 10px 40px rgba(0,0,0,0.03)'
            }}>
                <Table>
                    <TableHead sx={{ bgcolor: alpha(theme.palette.text.primary, 0.02) }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 700, color: theme.palette.text.secondary }}>FECHA</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: theme.palette.text.secondary }}>TIPO</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: theme.palette.text.secondary }}>CATEGORÍA</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: theme.palette.text.secondary }}>DESCRIPCIÓN</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: theme.palette.text.secondary }}>MONTO</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: theme.palette.text.secondary }}>MÉTODO</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: theme.palette.text.secondary }} align="right">GESTIÓN</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {records.map((record, idx) => (
                            <TableRow key={record.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                <TableCell sx={{ fontWeight: 500, color: theme.palette.text.primary }}>
                                    {new Date(record.record_date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={record.type === 'income' ? 'Ingreso' : 'Egreso'}
                                        sx={{
                                            bgcolor: record.type === 'income' ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.error.main, 0.1),
                                            color: record.type === 'income' ? theme.palette.success.main : theme.palette.error.main,
                                            fontWeight: 700,
                                            fontSize: '0.75rem',
                                            borderRadius: '8px'
                                        }}
                                    />
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }}>{record.category_name}</TableCell>
                                <TableCell sx={{ color: theme.palette.text.secondary, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {record.description}
                                </TableCell>
                                <TableCell sx={{ fontWeight: 800, color: record.type === 'income' ? theme.palette.success.main : theme.palette.error.main }}>
                                    {record.type === 'income' ? '+' : '-'}Gs. {parseFloat(record.amount).toLocaleString('es-PY')}
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" sx={{ fontWeight: 500, color: theme.palette.text.secondary }}>{record.payment_method}</Typography>
                                </TableCell>
                                <TableCell align="right">
                                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                                        <IconButton size="small" onClick={() => handleOpenDialog(record)} sx={{ color: theme.palette.primary.main, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                                            <Edit fontSize="small" />
                                        </IconButton>
                                        <IconButton size="small" onClick={() => handleDelete(record.id)} sx={{ color: theme.palette.error.main, bgcolor: alpha(theme.palette.error.main, 0.05) }}>
                                            <Delete fontSize="small" />
                                        </IconButton>
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog
                open={openDialog}
                onClose={() => setOpenDialog(false)}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: '28px',
                        p: 1,
                        background: alpha(theme.palette.background.paper, 0.9),
                        backdropFilter: 'blur(15px)',
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                    }
                }}
            >
                <DialogTitle sx={{ fontWeight: 800, fontSize: '1.5rem', px: 3, pt: 3, color: theme.palette.text.primary }}>
                    {editingRecord ? 'Editar Transacción' : 'Nueva Transacción'}
                </DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{error}</Alert>}
                    <Grid container spacing={3} sx={{ mt: 0.5 }}>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth>
                                <InputLabel>Naturaleza</InputLabel>
                                <Select
                                    value={formData.type}
                                    sx={{ borderRadius: '12px' }}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any, category_id: '' })}
                                >
                                    <MenuItem value="income">Ingreso Económico</MenuItem>
                                    <MenuItem value="expense">Egreso / Gasto</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                type="date"
                                label="Fecha de Registro"
                                value={formData.record_date}
                                onChange={(e) => setFormData({ ...formData, record_date: e.target.value })}
                                InputLabelProps={{ shrink: true }}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth>
                                <InputLabel>Categoría</InputLabel>
                                <Select
                                    value={formData.category_id}
                                    sx={{ borderRadius: '12px' }}
                                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                >
                                    {filteredCategories.map(c => (
                                        <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Monto"
                                type="number"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                                InputProps={{
                                    startAdornment: <InputAdornment position="start">Gs.</InputAdornment>,
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth>
                                <InputLabel>Vincular a Presupuesto</InputLabel>
                                <Select
                                    value={formData.budget_id}
                                    sx={{ borderRadius: '12px' }}
                                    onChange={(e) => setFormData({ ...formData, budget_id: e.target.value })}
                                >
                                    <MenuItem value="">Ninguno</MenuItem>
                                    {budgets.map(b => (
                                        <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth>
                                <InputLabel>Método</InputLabel>
                                <Select
                                    value={formData.payment_method}
                                    sx={{ borderRadius: '12px' }}
                                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                                >
                                    <MenuItem value="Efectivo">Efectivo 💵</MenuItem>
                                    <MenuItem value="Transferencia">Transferencia 🏦</MenuItem>
                                    <MenuItem value="Tarjeta">Tarjeta 💳</MenuItem>
                                    <MenuItem value="Cheque">Cheque 📝</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Notas Adicionales"
                                multiline
                                rows={3}
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '18px' } }}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ p: 4 }}>
                    <Button onClick={() => setOpenDialog(false)} sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>Cancelar</Button>
                    <Button
                        variant="contained"
                        onClick={handleSave}
                        sx={{
                            borderRadius: '12px',
                            px: 4,
                            '&:hover': { transform: 'translateY(-1px)' }
                        }}
                    >
                        Confirmar Registro
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ManagementRecords;
