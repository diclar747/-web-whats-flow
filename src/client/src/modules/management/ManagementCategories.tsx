import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Button,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
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
    Stack,
    CircularProgress,
    useTheme,
    alpha
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { getAPIBaseURL } from '../../utils/socketConfig';
import { motion } from 'framer-motion';

const ManagementCategories: React.FC = () => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [openDialog, setOpenDialog] = useState(false);
    const [editingCategory, setEditingCategory] = useState<any>(null);
    const [formData, setFormData] = useState({
        name: '',
        type: 'expense',
        description: '',
        status: 'active'
    });

    const fetchCategories = async () => {
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const response = await fetch(`${getAPIBaseURL()}/api/management/categories`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setCategories(data.categories);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const handleOpenDialog = (category: any = null) => {
        if (category) {
            setEditingCategory(category);
            setFormData(category);
        } else {
            setEditingCategory(null);
            setFormData({ name: '', type: 'expense', description: '', status: 'active' });
        }
        setOpenDialog(true);
    };

    const handleSave = async () => {
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const method = editingCategory ? 'PUT' : 'POST';
            const url = editingCategory
                ? `${getAPIBaseURL()}/api/management/categories/${editingCategory.id}`
                : `${getAPIBaseURL()}/api/management/categories`;

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
                fetchCategories();
            }
        } catch (error) {
            console.error('Error saving category:', error);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('¿Estás seguro de eliminar esta categoría?')) return;
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const response = await fetch(`${getAPIBaseURL()}/api/management/categories/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) fetchCategories();
        } catch (error) {
            console.error('Error deleting category:', error);
        }
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 5 }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: theme.palette.text.primary }}>
                        Arquitectura de Datos
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                        Organiza tus finanzas con una taxonomía personalizada y lógica.
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => handleOpenDialog()}
                    sx={{
                        borderRadius: '12px',
                        px: 3, py: 1.2,
                        boxShadow: isDark ? '0 8px 15px rgba(0,0,0,0.3)' : '0 8px 15px rgba(0,0,0,0.05)',
                    }}
                >
                    Nueva Categoría
                </Button>
            </Box>

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
                            <TableCell sx={{ fontWeight: 700, color: theme.palette.text.secondary }}>NOMBRE</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: theme.palette.text.secondary }}>TIPO</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: theme.palette.text.secondary }}>DESCRIPCIÓN</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: theme.palette.text.secondary }}>ESTADO</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: theme.palette.text.secondary }} align="right">GESTIÓN</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {categories.map((category) => (
                            <TableRow key={category.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                <TableCell sx={{ fontWeight: 700, color: theme.palette.text.primary }}>{category.name}</TableCell>
                                <TableCell>
                                    <Chip
                                        label={category.type === 'income' ? 'Ingreso' : 'Egreso'}
                                        variant="outlined"
                                        size="small"
                                        sx={{
                                            borderColor: category.type === 'income' ? theme.palette.success.main : theme.palette.error.main,
                                            color: category.type === 'income' ? theme.palette.success.main : theme.palette.error.main,
                                            fontWeight: 700
                                        }}
                                    />
                                </TableCell>
                                <TableCell sx={{ color: theme.palette.text.secondary }}>{category.description || '—'}</TableCell>
                                <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: category.status === 'active' ? theme.palette.success.main : theme.palette.text.disabled }} />
                                        <Typography variant="body2" sx={{ fontWeight: 500, color: category.status === 'active' ? theme.palette.success.main : theme.palette.text.disabled }}>
                                            {category.status === 'active' ? 'Activo' : 'Inactivo'}
                                        </Typography>
                                    </Box>
                                </TableCell>
                                <TableCell align="right">
                                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                                        <IconButton size="small" onClick={() => handleOpenDialog(category)} sx={{ bgcolor: alpha(theme.palette.text.primary, 0.03), color: theme.palette.text.primary }}>
                                            <Edit fontSize="small" />
                                        </IconButton>
                                        <IconButton size="small" onClick={() => handleDelete(category.id)} sx={{ bgcolor: alpha(theme.palette.error.main, 0.05), color: theme.palette.error.main }}>
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
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: '28px',
                        p: 1,
                        background: alpha(theme.palette.background.paper, 0.95),
                        backdropFilter: 'blur(10px)',
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                    }
                }}
            >
                <DialogTitle sx={{ fontWeight: 800, fontSize: '1.5rem', px: 4, pt: 4, color: theme.palette.text.primary }}>
                    {editingCategory ? 'Editar Definición' : 'Nueva Categoría'}
                </DialogTitle>
                <DialogContent sx={{ px: 4 }}>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        <TextField
                            fullWidth
                            label="Nombre de Categoría"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                        />
                        <FormControl fullWidth>
                            <InputLabel>Naturaleza</InputLabel>
                            <Select
                                value={formData.type}
                                sx={{ borderRadius: '12px' }}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            >
                                <MenuItem value="income">Flujo de Ingreso</MenuItem>
                                <MenuItem value="expense">Flujo de Egreso</MenuItem>
                            </Select>
                        </FormControl>
                        <TextField
                            fullWidth
                            label="Propósito / Descripción"
                            multiline
                            rows={3}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
                        />
                        <FormControl fullWidth>
                            <InputLabel>Estado Operativo</InputLabel>
                            <Select
                                value={formData.status}
                                sx={{ borderRadius: '12px' }}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            >
                                <MenuItem value="active">Operativo / Activo</MenuItem>
                                <MenuItem value="inactive">Suspendido / Inactivo</MenuItem>
                            </Select>
                        </FormControl>
                    </Stack>
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
                        Guardar Taxonomía
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ManagementCategories;
