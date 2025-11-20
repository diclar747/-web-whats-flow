import React, { useState, useEffect } from 'react';
import { getAPIBaseURL } from '../utils/socketConfig';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Stack,
  Badge,
  Tooltip,
  InputAdornment,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Person,
  Email,
  Phone,
  Work,
  Category as CategoryIcon,
  Search,
  Lock,
  Visibility,
  VisibilityOff,
  People,
  TrendingUp,
  Assignment,
  CheckCircle,
  Block,
  Chat as ChatIcon,
  Security,
  PeopleAlt as PeopleIcon,
} from '@mui/icons-material';

interface UsersModuleProps {
  sessionId: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'agent' | 'supervisor';
  department?: string;
  category?: string;
  status: 'active' | 'inactive' | 'suspended';
  avatar_url?: string;
  phone?: string;
  last_login?: string;
  created_at: string;
}

interface UserStats {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  assigned_chats: number;
  total_messages_sent: number;
  last_message_time?: string;
}

const UsersModule: React.FC<UsersModuleProps> = ({ sessionId }) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');

  // Estados para el diálogo de crear/editar usuario
  const [openDialog, setOpenDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Estado para diálogo de privilegios
  const [openPrivilegesDialog, setOpenPrivilegesDialog] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<User | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'agent' as 'admin' | 'agent' | 'supervisor',
    department: '',
    category: '',
    phone: '',
  });

  // Estados para el diálogo de departamentos
  const [openDeptDialog, setOpenDeptDialog] = useState(false);
  const [newDepartment, setNewDepartment] = useState('');

  // Estados para el diálogo de categorías
  const [openCatDialog, setOpenCatDialog] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  // Estados para transferencia de chats
  const [chatAssignments, setChatAssignments] = useState<any[]>([]);
  const [transferDialog, setTransferDialog] = useState(false);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [selectedNewAgent, setSelectedNewAgent] = useState('');
  const [transferReason, setTransferReason] = useState('');

  // Estados para confirmación de eliminación
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);

  useEffect(() => {
    loadUsers();
    loadStats();
    loadDepartments();
    loadCategories();
    loadChatAssignments();
  }, [filterRole, filterDepartment]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      let url = `${getAPIBaseURL()}/api/users?sessionId=${sessionId}&`;
      if (filterRole) url += `role=${filterRole}&`;
      if (filterDepartment) url += `department=${filterDepartment}&`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setUsers(data.users);
      } else {
        setError(data.error);
      }
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      setError('Error cargando usuarios');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/users/stats?sessionId=${sessionId}`);
      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  const loadDepartments = async () => {
    // Extraer departamentos únicos de los usuarios
    const uniqueDepts = Array.from(new Set(users.map(u => u.department).filter(d => d))) as string[];
    setDepartments(uniqueDepts);
  };

  const loadCategories = async () => {
    // Extraer categorías únicas de los usuarios
    const uniqueCats = Array.from(new Set(users.map(u => u.category).filter(c => c))) as string[];
    setCategories(uniqueCats);
  };

  const loadChatAssignments = async () => {
    try {
      // Cargar asignaciones de chats desde el servidor
      const response = await fetch(`${getAPIBaseURL()}/api/chat-assignments/${sessionId}`);
      const data = await response.json();

      if (data.success) {
        setChatAssignments(data.assignments || []);
      } else {
        console.error('Error cargando asignaciones:', data.error);
      }
    } catch (error) {
      console.error('Error cargando asignaciones de chats:', error);
    }
  };

  const handleCreateUser = async () => {
    try {
      setError(null);

      if (!formData.name || !formData.email || (!editingUser && !formData.password)) {
        setError('Nombre, email y contraseña son requeridos');
        return;
      }

      // Preparar datos para enviar - solo incluir campos con valores
      const dataToSend: any = { ...formData };
      
      // Agregar sessionId para vincular agentes a su admin
      if (sessionId) {
        dataToSend.sessionId = sessionId;
      }
      
      // Si estamos editando y la contraseña está vacía, eliminarla del objeto
      if (editingUser && !formData.password) {
        delete dataToSend.password;
      }

      const method = editingUser ? 'PUT' : 'POST';
      const url = editingUser
        ? `${getAPIBaseURL()}/api/users/${editingUser.id}`
        : `${getAPIBaseURL()}/api/users`;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(editingUser ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente');
        setOpenDialog(false);
        resetForm();
        loadUsers();
        loadStats();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error);
      }
    } catch (error) {
      console.error('Error guardando usuario:', error);
      setError('Error guardando usuario');
    }
  };

  const toggleUserStatus = async (user: User) => {
    try {
      const newStatus = user.status === 'active' ? 'inactive' : 'active';
      const response = await fetch(`${getAPIBaseURL()}/api/users/${user.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, sessionId })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`Usuario ${newStatus === 'active' ? 'activado' : 'desactivado'} correctamente`);
        loadUsers();
        loadStats();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error);
      }
    } catch (error) {
      console.error('Error cambiando estado del usuario:', error);
      setError('Error cambiando estado del usuario');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    setUserToDelete(userId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      console.log(`Intentando eliminar usuario con ID: ${userToDelete}`);
      const url = `${getAPIBaseURL()}/api/users/${userToDelete}`;
      console.log(`URL de solicitud: ${url}`);

      const response = await fetch(url, {
        method: 'DELETE',
      });

      console.log(`Respuesta de la API: ${response.status} ${response.statusText}`);

      // Verificar si la respuesta es válida
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error en la respuesta: ${response.status}`, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const data = await response.json();
      console.log('Datos recibidos:', data);

      if (data.success) {
        setSuccess('Usuario eliminado correctamente');
        loadUsers();
        loadStats();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Error desconocido al eliminar usuario');
      }
    } catch (error: unknown) {
      console.error('Error eliminando usuario:', error);
      if (error instanceof Error) {
        setError(`Error eliminando usuario: ${error.message}`);
      } else {
        setError('Error desconocido al eliminar usuario');
      }
    } finally {
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  const cancelDeleteUser = () => {
    setDeleteDialogOpen(false);
    setUserToDelete(null);
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      department: user.department || '',
      category: user.category || '',
      phone: user.phone || '',
    });
    setOpenDialog(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'agent',
      department: '',
      category: '',
      phone: '',
    });
    setEditingUser(null);
  };

  const handleOpenPrivileges = (user: User) => {
    setSelectedAgent(user);
    setOpenPrivilegesDialog(true);
  };

  const handleClosePrivileges = () => {
    setOpenPrivilegesDialog(false);
    setSelectedAgent(null);
  };

  const addDepartment = () => {
    if (newDepartment && !departments.includes(newDepartment)) {
      setDepartments([...departments, newDepartment]);
      setFormData({ ...formData, department: newDepartment });
      setNewDepartment('');
      setOpenDeptDialog(false);
    }
  };

  const addCategory = () => {
    if (newCategory && !categories.includes(newCategory)) {
      setCategories([...categories, newCategory]);
      setFormData({ ...formData, category: newCategory });
      setNewCategory('');
      setOpenCatDialog(false);
    }
  };

  const handleTransferChat = (chat: any) => {
    setSelectedChat(chat);
    setSelectedNewAgent('');
    setTransferReason('');
    setTransferDialog(true);
  };

  const confirmTransfer = async () => {
    if (!selectedChat || !selectedNewAgent) {
      setError('Selecciona un agente para transferir');
      return;
    }

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/chats/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          chatJid: selectedChat.chat_jid,
          fromUserId: selectedChat.user_id,
          toUserId: selectedNewAgent,
          reason: transferReason,
          transferredBy: 1 // Usuario actual (admin)
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Chat transferido correctamente');
        setTransferDialog(false);
        loadChatAssignments();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error);
      }
    } catch (error) {
      console.error('Error transfiriendo chat:', error);
      setError('Error transfiriendo chat');
    }
  };

  const getRoleBadge = (role: string) => {
    const colors: any = {
      admin: 'error',
      supervisor: 'warning',
      agent: 'success',
    };
    return <Chip label={role.toUpperCase()} size="small" color={colors[role] || 'default'} />;
  };

  const getStatusBadge = (status: string) => {
    const colors: any = {
      active: 'success',
      inactive: 'default',
      suspended: 'error',
    };
    const icons: any = {
      active: <CheckCircle fontSize="small" />,
      inactive: <Block fontSize="small" />,
      suspended: <Block fontSize="small" />,
    };
    return <Chip icon={icons[status]} label={status.toUpperCase()} size="small" color={colors[status]} />;
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
            👥 Gestión de Usuarios
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Administra usuarios, agentes y sus asignaciones
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            resetForm();
            setOpenDialog(true);
          }}
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
            },
          }}
        >
          Nuevo Usuario
        </Button>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={currentTab} onChange={(e, v) => setCurrentTab(v)} sx={{ mb: 3 }}>
        <Tab label="📋 Lista de Usuarios" />
        <Tab label="📊 Estadísticas" />
        <Tab label="💬 Transferencia de Chats" />
        <Tab label="🏢 Departamentos" />
        <Tab label="📁 Categorías" />
      </Tabs>

      {/* TAB 1: Lista de Usuarios */}
      {currentTab === 0 && (
        <Box>
          {/* Filtros y búsqueda */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Buscar por nombre o email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Filtrar por Rol</InputLabel>
                <Select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  label="Filtrar por Rol"
                >
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="supervisor">Supervisor</MenuItem>
                  <MenuItem value="agent">Agente</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Filtrar por Departamento</InputLabel>
                <Select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  label="Filtrar por Departamento"
                >
                  <MenuItem value="">Todos</MenuItem>
                  {departments.map((dept) => (
                    <MenuItem key={dept} value={dept}>
                      {dept}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {/* Tabla de usuarios */}
          <TableContainer component={Paper} elevation={2}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell>Usuario</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Rol</TableCell>
                  <TableCell>Departamento</TableCell>
                  <TableCell>Categoría</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Último Login</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar src={user.avatar_url}>{user.name[0]}</Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {user.name}
                          </Typography>
                          {user.phone && (
                            <Typography variant="caption" color="textSecondary">
                              {user.phone}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>{user.department || '-'}</TableCell>
                    <TableCell>{user.category || '-'}</TableCell>
                    <TableCell>{getStatusBadge(user.status)}</TableCell>
                    <TableCell>
                      {user.last_login
                        ? new Date(user.last_login).toLocaleString()
                        : 'Nunca'}
                    </TableCell>
                    <TableCell align="right">
                      {user.role === 'agent' && (
                        <Tooltip title="Gestionar Privilegios">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleOpenPrivileges(user)}
                          >
                            <Security fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title={user.status === 'active' ? "Desactivar usuario" : "Activar usuario"}>
                        <IconButton
                          size="small"
                          color={user.status === 'active' ? "default" : "primary"}
                          onClick={() => toggleUserStatus(user)}
                        >
                          {user.status === 'active' ? <Block fontSize="small" /> : <CheckCircle fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => openEditDialog(user)}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* TAB 2: Transferencia de Chats */}
      {currentTab === 2 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            💬 Gestión de Asignaciones de Chats
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Transfiere chats entre agentes y administra asignaciones
          </Typography>

          <Grid container spacing={3}>
            {chatAssignments.map((assignment) => (
              <Grid item xs={12} md={6} lg={4} key={assignment.id}>
                <Card elevation={2}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Avatar sx={{ mr: 2, bgcolor: '#00a884' }}>
                        <ChatIcon />
                      </Avatar>
                      <Box>
                        <Typography variant="h6" sx={{ fontSize: '0.9rem' }}>
                          {assignment.contact_name || assignment.chat_jid}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {assignment.chat_jid}
                        </Typography>
                      </Box>
                    </Box>

                    <Stack spacing={1} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Agente Actual:</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {users.find(u => u.id === assignment.user_id)?.name || 'Desconocido'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Estado:</Typography>
                        <Chip
                          label={assignment.status}
                          size="small"
                          color={assignment.status === 'active' ? 'success' : 'default'}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Asignado:</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {new Date(assignment.assigned_at).toLocaleString()}
                        </Typography>
                      </Box>
                    </Stack>

                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<PeopleIcon />}
                      onClick={() => handleTransferChat(assignment)}
                      fullWidth
                    >
                      Transferir Chat
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}

            {chatAssignments.length === 0 && (
              <Grid item xs={12}>
                <Card sx={{ p: 4, textAlign: 'center' }}>
                  <ChatIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    No hay chats asignados
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Los chats asignados a agentes aparecerán aquí
                  </Typography>
                </Card>
              </Grid>
            )}
          </Grid>
        </Box>
      )}

      {/* TAB 4: Estadísticas */}
      {currentTab === 4 && (
        <Grid container spacing={3}>
          {stats.map((stat) => (
            <Grid item xs={12} md={6} lg={4} key={stat.id}>
              <Card elevation={2}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar sx={{ mr: 2, bgcolor: '#667eea' }}>
                      <Person />
                    </Avatar>
                    <Box>
                      <Typography variant="h6">{stat.name}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        {stat.email}
                      </Typography>
                    </Box>
                  </Box>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Rol:</Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {stat.role}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Departamento:</Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {stat.department || '-'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Chats Asignados:</Typography>
                      <Chip
                        label={stat.assigned_chats}
                        size="small"
                        color="primary"
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Mensajes Enviados:</Typography>
                      <Chip
                        label={stat.total_messages_sent}
                        size="small"
                        color="success"
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Último Mensaje:</Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {stat.last_message_time ? new Date(stat.last_message_time).toLocaleString() : 'Nunca'}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* TAB 5: Departamentos */}
      {currentTab === 5 && (
        <Box>
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={() => setOpenDeptDialog(true)}
            sx={{ mb: 3 }}
          >
            Nuevo Departamento
          </Button>
          <Grid container spacing={2}>
            {departments.map((dept) => (
              <Grid item xs={12} sm={6} md={4} key={dept}>
                <Card>
                  <CardContent>
                    <Typography variant="h6">🏢 {dept}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {users.filter((u) => u.department === dept).length} usuarios
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* TAB 6: Categorías */}
      {currentTab === 6 && (
        <Box>
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={() => setOpenCatDialog(true)}
            sx={{ mb: 3 }}
          >
            Nueva Categoría
          </Button>
          <Grid container spacing={2}>
            {categories.map((cat) => (
              <Grid item xs={12} sm={6} md={4} key={cat}>
                <Card>
                  <CardContent>
                    <Typography variant="h6">📁 {cat}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {users.filter((u) => u.category === cat).length} usuarios
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Diálogo de Crear/Editar Usuario */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingUser ? '✏️ Editar Usuario' : '➕ Nuevo Usuario'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Nombre Completo"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Person />
                  </InputAdornment>
                ),
              }}
              required
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email />
                  </InputAdornment>
                ),
              }}
              required
            />
            <TextField
              fullWidth
              label={editingUser ? 'Nueva Contraseña (dejar vacío para mantener)' : 'Contraseña'}
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              required={!editingUser}
            />
            <FormControl fullWidth>
              <InputLabel>Rol</InputLabel>
              <Select
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value as any })
                }
                label="Rol"
              >
                <MenuItem value="agent">Agente</MenuItem>
                <MenuItem value="supervisor">Supervisor</MenuItem>
                <MenuItem value="admin">Administrador</MenuItem>
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <FormControl fullWidth>
                <InputLabel>Departamento</InputLabel>
                <Select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  label="Departamento"
                >
                  <MenuItem value="">Sin departamento</MenuItem>
                  {departments.map((dept) => (
                    <MenuItem key={dept} value={dept}>
                      {dept}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <IconButton onClick={() => setOpenDeptDialog(true)} color="primary">
                <Add />
              </IconButton>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <FormControl fullWidth>
                <InputLabel>Categoría</InputLabel>
                <Select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  label="Categoría"
                >
                  <MenuItem value="">Sin categoría</MenuItem>
                  {categories.map((cat) => (
                    <MenuItem key={cat} value={cat}>
                      {cat}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <IconButton onClick={() => setOpenCatDialog(true)} color="primary">
                <Add />
              </IconButton>
            </Box>
            <TextField
              fullWidth
              label="Teléfono"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Phone />
                  </InputAdornment>
                ),
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreateUser}>
            {editingUser ? 'Actualizar' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de Nuevo Departamento */}
      <Dialog open={openDeptDialog} onClose={() => setOpenDeptDialog(false)}>
        <DialogTitle>Nuevo Departamento</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nombre del Departamento"
            value={newDepartment}
            onChange={(e) => setNewDepartment(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeptDialog(false)}>Cancelar</Button>
          <Button variant="contained" onClick={addDepartment}>
            Agregar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de Nueva Categoría */}
      <Dialog open={openCatDialog} onClose={() => setOpenCatDialog(false)}>
        <DialogTitle>Nueva Categoría</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nombre de la Categoría"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCatDialog(false)}>Cancelar</Button>
          <Button variant="contained" onClick={addCategory}>
            Agregar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de Transferencia de Chat */}
      <Dialog open={transferDialog} onClose={() => setTransferDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          🔄 Transferir Chat
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Chat a Transferir:
              </Typography>
              <Typography variant="body2" sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 1 }}>
                {selectedChat?.contact_name || selectedChat?.chat_jid}
              </Typography>
            </Box>

            <FormControl fullWidth>
              <InputLabel>Nuevo Agente</InputLabel>
              <Select
                value={selectedNewAgent}
                onChange={(e) => setSelectedNewAgent(e.target.value)}
                label="Nuevo Agente"
              >
                {users
                  .filter(user => user.id !== selectedChat?.user_id && user.status === 'active')
                  .map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.name} ({user.role})
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Motivo de la Transferencia"
              multiline
              rows={3}
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              placeholder="Opcional: explica el motivo de la transferencia..."
            />

            <Alert severity="info">
              <Typography variant="body2">
                El agente actual será notificado de la transferencia y el nuevo agente recibirá acceso inmediato al chat.
              </Typography>
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferDialog(false)}>Cancelar</Button>
          <Button variant="contained" onClick={confirmTransfer}>
            Confirmar Transferencia
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de Confirmación de Eliminación */}
      <Dialog open={deleteDialogOpen} onClose={cancelDeleteUser} maxWidth="xs" fullWidth>
        <DialogTitle>
          🗑️ Confirmar Eliminación
        </DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Box sx={{ 
              width: 60, 
              height: 60, 
              borderRadius: '50%', 
              bgcolor: 'error.light', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <Delete sx={{ fontSize: 32, color: 'error.main' }} />
            </Box>
            <Typography variant="h6" gutterBottom>
              ¿Eliminar usuario?
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Esta acción no se puede deshacer. El usuario será eliminado permanentemente del sistema.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', gap: 1, px: 2, pb: 2 }}>
          <Button 
            onClick={cancelDeleteUser} 
            variant="outlined" 
            fullWidth
            sx={{ py: 1.5 }}
          >
            Cancelar
          </Button>
          <Button 
            onClick={confirmDeleteUser} 
            variant="contained" 
            color="error" 
            fullWidth
            sx={{ py: 1.5 }}
          >
            Eliminar Usuario
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de Gestión de Privilegios */}
      <Dialog 
        open={openPrivilegesDialog} 
        onClose={handleClosePrivileges}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ 
          bgcolor: 'primary.main', 
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <Security />
          Gestionar Privilegios - {selectedAgent?.name}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Gestión de privilegios para el agente <strong>{selectedAgent?.email}</strong>
          </Alert>
          
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Aquí podrás configurar los permisos específicos del agente:
          </Typography>

          <Stack spacing={2}>
            <Box sx={{ 
              p: 2, 
              border: '1px solid', 
              borderColor: 'divider',
              borderRadius: 1
            }}>
              <Typography variant="subtitle2" gutterBottom>
                📋 Módulos Disponibles
              </Typography>
              <Typography variant="body2" color="textSecondary">
                • Chat (Ver/Responder mensajes)
              </Typography>
              <Typography variant="body2" color="textSecondary">
                • Contactos (Ver/Editar contactos)
              </Typography>
              <Typography variant="body2" color="textSecondary">
                • Campañas (Ver/Crear campañas)
              </Typography>
              <Typography variant="body2" color="textSecondary">
                • Reportes (Ver estadísticas)
              </Typography>
            </Box>

            <Alert severity="warning">
              Próximamente: Sistema completo de gestión de privilegios
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={handleClosePrivileges}
            variant="contained"
            fullWidth
          >
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsersModule;
