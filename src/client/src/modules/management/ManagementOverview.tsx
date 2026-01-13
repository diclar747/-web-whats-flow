import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Grid,
    Paper,
    Card,
    CardContent,
    CircularProgress,
    Stack,
    Chip,
    Button,
    ButtonGroup,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    useTheme,
    IconButton,
    alpha
} from '@mui/material';
import {
    TrendingUp,
    TrendingDown,
    AccountBalanceWallet,
    Assessment,
    ArrowUpward,
    ArrowDownward,
    MoreHoriz
} from '@mui/icons-material';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { getAPIBaseURL } from '../../utils/socketConfig';
import { motion } from 'framer-motion';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'];

const ManagementOverview: React.FC = () => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const [timeRange, setTimeRange] = useState('30d');

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const response = await fetch(`${getAPIBaseURL()}/api/management/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setStats(data.stats);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

    const income = parseFloat(stats?.totals?.find((t: any) => t.type === 'income')?.total || 0);
    const expense = parseFloat(stats?.totals?.find((t: any) => t.type === 'expense')?.total || 0);
    const balance = income - expense;

    const summaryData = [
        {
            title: 'Ingresos Totales',
            value: `Gs. ${income.toLocaleString('es-PY')}`,
            icon: <TrendingUp />,
            color: '#10b981',
            trend: '+12.5%',
            trendUp: true,
            desc: 'Crecimiento este mes'
        },
        {
            title: 'Egresos Totales',
            value: `Gs. ${expense.toLocaleString('es-PY')}`,
            icon: <TrendingDown />,
            color: '#f43f5e',
            trend: '-5.2%',
            trendUp: false,
            desc: 'Optimizado vs mes pasado'
        },
        {
            title: 'Balance Neto',
            value: `Gs. ${balance.toLocaleString('es-PY')}`,
            icon: <AccountBalanceWallet />,
            color: '#6366f1',
            trend: '+8.4%',
            trendUp: true,
            desc: 'Liquidez incrementada'
        },
        {
            title: 'Rentabilidad',
            value: `${income > 0 ? ((balance / income) * 100).toFixed(1) : 0}%`,
            icon: <Assessment />,
            color: '#8b5cf6',
            trend: '+2.1%',
            trendUp: true,
            desc: 'Margen operativo actual'
        }
    ];

    const chartData = stats?.byMonth?.map((m: any) => ({
        name: m.month,
        ingresos: parseFloat(m.type === 'income' ? m.total : 0),
        egresos: parseFloat(m.type === 'expense' ? m.total : 0)
    })).reduce((acc: any[], curr: any) => {
        const existing = acc.find(a => a.name === curr.name);
        if (existing) {
            existing.ingresos += curr.ingresos;
            existing.egresos += curr.egresos;
        } else {
            acc.push(curr);
        }
        return acc;
    }, []) || [];

    return (
        <Box sx={{ p: 1 }}>
            {/* Header Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                {summaryData.map((item, idx) => (
                    <Grid item xs={12} sm={6} md={3} key={idx}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.4, delay: idx * 0.1 }}
                        >
                            <Card sx={{
                                borderRadius: '24px',
                                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                                background: alpha(theme.palette.background.paper, 0.7),
                                backdropFilter: 'blur(20px)',
                                boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.5)' : '0 4px 24px rgba(0,0,0,0.02)',
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    transform: 'translateY(-5px)',
                                    boxShadow: isDark ? '0 12px 30px rgba(0,0,0,0.6)' : '0 12px 30px rgba(0,0,0,0.06)',
                                    borderColor: alpha(theme.palette.primary.main, 0.2)
                                }
                            }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            {item.title}
                                        </Typography>
                                        <Chip
                                            label={item.trend}
                                            size="small"
                                            icon={item.trendUp ? <ArrowUpward style={{ fontSize: 14 }} /> : <ArrowDownward style={{ fontSize: 14 }} />}
                                            sx={{
                                                height: 24,
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                bgcolor: item.trendUp ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.error.main, 0.1),
                                                color: item.trendUp ? theme.palette.success.main : theme.palette.error.main,
                                                border: 'none',
                                                '& .MuiChip-icon': { color: 'inherit' }
                                            }}
                                        />
                                    </Box>
                                    <Typography variant="h4" sx={{ fontWeight: 900, color: theme.palette.text.primary, mb: 1, letterSpacing: '-0.5px' }}>
                                        {item.value}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        {item.desc}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </Grid>
                ))}
            </Grid>

            {/* Main Area Chart Container */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
            >
                <Paper sx={{
                    p: 4, borderRadius: '32px', mb: 4,
                    background: alpha(theme.palette.background.paper, 0.8),
                    backdropFilter: 'blur(30px)',
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.4)' : '0 20px 50px rgba(0,0,0,0.03)',
                    minHeight: 450
                }}>
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 3, mb: 4 }}>
                        <Box>
                            <Typography variant="h5" sx={{ fontWeight: 900, color: theme.palette.text.primary }}>Análisis de Rendimiento</Typography>
                            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>Proyección histórica de flujos financieros</Typography>
                        </Box>
                        <ButtonGroup
                            variant="outlined"
                            sx={{
                                borderRadius: '12px',
                                overflow: 'hidden',
                                borderColor: theme.palette.divider,
                                '& .MuiButton-root': {
                                    border: 'none',
                                    color: theme.palette.text.secondary,
                                    fontWeight: 700,
                                    fontSize: '0.8rem',
                                    px: 3,
                                    '&.active': {
                                        bgcolor: theme.palette.text.primary,
                                        color: theme.palette.background.default
                                    }
                                }
                            }}
                        >
                            <Button className={timeRange === '90d' ? 'active' : ''} onClick={() => setTimeRange('90d')}>90 Días</Button>
                            <Button className={timeRange === '30d' ? 'active' : ''} onClick={() => setTimeRange('30d')}>30 Días</Button>
                            <Button className={timeRange === '7d' ? 'active' : ''} onClick={() => setTimeRange('7d')}>7 Días</Button>
                        </ButtonGroup>
                    </Box>

                    <Box sx={{ height: 350, width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={theme.palette.success.main} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={theme.palette.success.main} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.divider, 0.1)} />
                                <XAxis
                                    dataKey="name"
                                    stroke={theme.palette.text.disabled}
                                    tick={{ fontSize: 12, fontWeight: 500 }}
                                    axisLine={false}
                                    tickLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    stroke={theme.palette.text.disabled}
                                    tick={{ fontSize: 12, fontWeight: 500 }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(value) => `Gs. ${value.toLocaleString('es-PY')}`}
                                />
                                <RechartsTooltip
                                    contentStyle={{
                                        borderRadius: '16px',
                                        border: 'none',
                                        boxShadow: theme.shadows[10],
                                        padding: '16px',
                                        background: isDark ? alpha(theme.palette.background.paper, 0.9) : alpha(theme.palette.background.paper, 0.9),
                                        backdropFilter: 'blur(10px)',
                                        color: theme.palette.text.primary
                                    }}
                                    itemStyle={{ color: theme.palette.text.primary }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="ingresos"
                                    stroke={theme.palette.primary.main}
                                    strokeWidth={4}
                                    fillOpacity={1}
                                    fill="url(#colorIncome)"
                                    animationDuration={2000}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="egresos"
                                    stroke={theme.palette.success.main}
                                    strokeWidth={4}
                                    fillOpacity={1}
                                    fill="url(#colorExpense)"
                                    animationDuration={2000}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </Box>
                </Paper>
            </motion.div>

            {/* Bottom Section: Categories & Recent Activities */}
            <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.6 }}
                    >
                        <Paper sx={{
                            p: 4, borderRadius: '32px', height: '100%',
                            background: alpha(theme.palette.background.paper, 0.7),
                            backdropFilter: 'blur(20px)',
                            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                            boxShadow: isDark ? '0 15px 35px rgba(0,0,0,0.3)' : '0 15px 35px rgba(0,0,0,0.02)'
                        }}>
                            <Typography variant="h6" sx={{ fontWeight: 800, color: theme.palette.text.primary, mb: 3 }}>Categorías de Gasto</Typography>
                            <Box sx={{ height: 200, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={stats?.byCategory?.filter((c: any) => c.type === 'expense').map((c: any) => ({ name: c.category_name, value: parseFloat(c.total) })) || []}
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={8}
                                            dataKey="value"
                                            stroke="none"
                                            cornerRadius={8}
                                        >
                                            {(stats?.byCategory || []).map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip
                                            contentStyle={{
                                                background: alpha(theme.palette.background.paper, 0.9),
                                                border: 'none',
                                                borderRadius: '12px',
                                                boxShadow: theme.shadows[5],
                                                color: theme.palette.text.primary
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </Box>
                            <Stack spacing={2} sx={{ mt: 2 }}>
                                {stats?.byCategory?.filter((c: any) => c.type === 'expense').slice(0, 3).map((item: any, idx: number) => (
                                    <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Stack direction="row" spacing={1.5} alignItems="center">
                                            <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: COLORS[idx % COLORS.length] }} />
                                            <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.text.secondary }}>{item.category_name}</Typography>
                                        </Stack>
                                        <Typography variant="body2" sx={{ fontWeight: 800, color: theme.palette.text.primary }}>Gs. {parseFloat(item.total).toLocaleString('es-PY')}</Typography>
                                    </Box>
                                ))}
                            </Stack>
                        </Paper>
                    </motion.div>
                </Grid>

                <Grid item xs={12} md={8}>
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.7 }}
                    >
                        <Paper sx={{
                            p: 4, borderRadius: '32px', height: '100%',
                            background: alpha(theme.palette.background.paper, 0.7),
                            backdropFilter: 'blur(20px)',
                            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                            boxShadow: isDark ? '0 15px 35px rgba(0,0,0,0.3)' : '0 15px 35px rgba(0,0,0,0.02)'
                        }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                <Typography variant="h6" sx={{ fontWeight: 800, color: theme.palette.text.primary }}>Operaciones Destacadas</Typography>
                                <IconButton size="small"><MoreHoriz /></IconButton>
                            </Box>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 700, color: theme.palette.text.disabled, border: 'none', pb: 2 }}>ORIGEN</TableCell>
                                            <TableCell sx={{ fontWeight: 700, color: theme.palette.text.disabled, border: 'none', pb: 2 }}>CATEGORÍA</TableCell>
                                            <TableCell sx={{ fontWeight: 700, color: theme.palette.text.disabled, border: 'none', pb: 2 }}>ESTADO</TableCell>
                                            <TableCell sx={{ fontWeight: 700, color: theme.palette.text.disabled, border: 'none', pb: 2 }} align="right">MONTO</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {[
                                            { source: 'Facturación Directa', category: 'Ingresos', status: 'Completado', amount: 450.00, type: 'in' },
                                            { source: 'Pago Proveedores', category: 'Operativo', status: 'Procesando', amount: 128.50, type: 'out' },
                                            { source: 'Suscripción SaaS', category: 'Herramientas', status: 'Completado', amount: 89.00, type: 'out' },
                                            { source: 'Asesoría Externa', category: 'Servicios', status: 'Pendiente', amount: 300.25, type: 'in' },
                                        ].map((row, i) => (
                                            <TableRow key={i} sx={{ '& td': { borderBottom: `1px solid ${alpha(theme.palette.divider, 0.05)}`, py: 2 } }}>
                                                <TableCell sx={{ fontWeight: 700, color: theme.palette.text.primary }}>{row.source}</TableCell>
                                                <TableCell>
                                                    <Chip label={row.category} size="small" sx={{ borderRadius: '8px', fontWeight: 700, bgcolor: alpha(theme.palette.text.primary, 0.04), color: theme.palette.text.secondary }} />
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: row.status === 'Completado' ? theme.palette.success.main : row.status === 'Procesando' ? theme.palette.warning.main : theme.palette.text.disabled }} />
                                                        <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.text.secondary }}>{row.status}</Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 900, color: row.type === 'in' ? theme.palette.success.main : theme.palette.error.main }}>
                                                    {row.type === 'in' ? '+' : '-'}Gs. {row.amount.toLocaleString('es-PY')}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    </motion.div>
                </Grid>
            </Grid>
        </Box>
    );
};

export default ManagementOverview;
