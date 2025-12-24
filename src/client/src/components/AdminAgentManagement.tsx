import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Tooltip,
  Badge,
  Tab,
  Tabs,
  Autocomplete
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
  Assignment as AssignmentIcon,
  SwapHoriz as TransferIcon,
  Timeline as StatsIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getAPIBaseURL } from '../utils/socketConfig';

interface Agent {
  id: number;
  name: string;
  email: string;
  role: string;
  department?: string;
  status: string;
  created_at: string;
  active_chats: number;
  total_unread: number;
  total_assigned: number;
  completed_today: number;
  is_online?: boolean;
  phone?: string;
  avatar_url?: string;
}

interface Contact {
  jid: string;
  name: string;
  notify_name?: string;
  avatar_url?: string;
}

interface UnassignedChat {
  chat_jid: string;
  session_id: string;
  contact_name: string;
  phone_number: string;
  avatar_url?: string;
  last_message: string;
  last_message_time: string;
  total_messages: number;
}

const AdminAgentManagement: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [unassignedChats, setUnassignedChats] = useState<UnassignedChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  // ✅ OBTENER SESIÓN REAL DEL USUARIO CONECTADO
  const [sessionId] = useState(() => {
    return sessionStorage.getItem('whatsflow_session') ||
      localStorage.getItem('whatsflow_session') ||
      sessionStorage.getItem('sessionId') ||
      localStorage.getItem('sessionId') ||
      'default';
  });

  // Dialogs
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedChat, setSelectedChat] = useState<UnassignedChat | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<number | ''>('');
  const [assignNotes, setAssignNotes] = useState('');

  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferFromAgentId, setTransferFromAgentId] = useState<number | ''>('');
  const [transferToAgentId, setTransferToAgentId] = useState<number | ''>('');
  const [transferReason, setTransferReason] = useState('');
  const [transferChatJid, setTransferChatJid] = useState('');

  // Create Agent Dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentEmail, setNewAgentEmail] = useState('');
  const [newAgentPassword, setNewAgentPassword] = useState('');
  const [newAgentPhone, setNewAgentPhone] = useState('');
  const [newAgentAvatar, setNewAgentAvatar] = useState('');
  const [creatingAgent, setCreatingAgent] = useState(false);

  // Contacts autocomplete
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // ✅ Ref para el debounce timer
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const apiUrl = getAPIBaseURL();
  const token = sessionStorage.getItem('token') || '';

  // 🔍 LOG DE INICIALIZACIÓN
  console.log('═════════════════════════════════════════');
  console.log('[AdminAgentManagement] COMPONENTE CARGADO');
  console.log('  SessionId:', sessionId);
  console.log('  API URL:', apiUrl);
  console.log('  Token:', token ? 'PRESENTE' : 'AUSENTE');
  console.log('═════════════════════════════════════════');

  useEffect(() => {
    console.log('[AdminAgentManagement] useEffect ejecutado - Cargando datos...');
    loadData();
    // ✅ NO cargar contactos al inicio - se cargan al escribir
    const interval = setInterval(loadData, 30000); // Refresh cada 30 segundos
    return () => clearInterval(interval);
  }, [sessionId]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadAgents(),
        loadUnassignedChats()
      ]);
      setError(null);
    } catch (err) {
      setError('Error cargando datos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAgents = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/admin/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Error cargando agentes');

      const data = await response.json();
      if (data.success && data.stats.agents) {
        setAgents(data.stats.agents);
      }
    } catch (err) {
      console.error('Error loading agents:', err);
    }
  };

  const loadUnassignedChats = async () => {
    try {
      const response = await fetch(
        `${apiUrl}/api/chats/unassigned?sessionId=${sessionId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) throw new Error('Error cargando chats sin asignar');

      const data = await response.json();
      if (data.success) {
        setUnassignedChats(data.chats || []);
      }
    } catch (err) {
      console.error('Error loading unassigned chats:', err);
    }
  };

  const loadContacts = async (searchTerm: string = '') => {
    try {
      setLoadingContacts(true);

      // ✅ OBTENER SESIÓN ACTUAL DEL USUARIO CONECTADO
      const currentSessionId = sessionStorage.getItem('whatsflow_session') ||
        localStorage.getItem('whatsflow_session') ||
        sessionStorage.getItem('sessionId') ||
        localStorage.getItem('sessionId') ||
        sessionId;

      console.log('[LOAD-CONTACTS] 🔍 Buscando contactos para sesión:', currentSessionId);
      console.log('[LOAD-CONTACTS] 🔎 Término de búsqueda:', searchTerm || 'TODOS');

      // ✅ Siempre usar búsqueda, incluso si está vacío
      const searchParam = `&search=${encodeURIComponent(searchTerm || '')}`;
      const url = `${apiUrl}/api/contacts/${currentSessionId}?limit=100${searchParam}`;

      console.log('[LOAD-CONTACTS] 📡 URL:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('[LOAD-CONTACTS] ❌ Error HTTP:', response.status);
        throw new Error(`Error HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('[LOAD-CONTACTS] ✅ Respuesta:', {
        success: data.success,
        totalContactos: data.contacts?.length || 0,
        mensaje: data.message || 'Sin mensaje'
      });

      if (data.success && data.contacts) {
        // Filtrar solo contactos individuales (no grupos)
        const individualContacts = data.contacts.filter((c: any) => c.jid && c.jid.endsWith('@s.whatsapp.net'));
        console.log('[LOAD-CONTACTS] 📋 Contactos individuales filtrados:', individualContacts.length);
        setContacts(individualContacts);
        return individualContacts;
      } else {
        console.log('[LOAD-CONTACTS] ⚠️ No hay contactos o error:', data.error || 'Sin datos');
        setContacts([]);
        return [];
      }
    } catch (err) {
      console.error('[LOAD-CONTACTS] ❌ Error completo:', err);
      setContacts([]);
      return [];
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleAssignChat = async () => {
    if (!selectedChat || !selectedAgentId) {
      alert('Por favor selecciona un agente');
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/chats/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          chat_jid: selectedChat.chat_jid,
          session_id: selectedChat.session_id,
          user_id: selectedAgentId,
          notes: assignNotes
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('Chat asignado correctamente');
        setAssignDialogOpen(false);
        setSelectedChat(null);
        setSelectedAgentId('');
        setAssignNotes('');
        loadData();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Error assigning chat:', err);
      alert('Error asignando chat');
    }
  };

  const handleTransferChat = async () => {
    if (!transferFromAgentId || !transferToAgentId || !transferChatJid) {
      alert('Por favor completa todos los campos');
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/chats/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          chat_jid: transferChatJid,
          session_id: sessionId,
          from_user_id: transferFromAgentId,
          to_user_id: transferToAgentId,
          reason: transferReason
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('Chat transferido correctamente');
        setTransferDialogOpen(false);
        setTransferFromAgentId('');
        setTransferToAgentId('');
        setTransferChatJid('');
        setTransferReason('');
        loadData();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Error transferring chat:', err);
      alert('Error transfiriendo chat');
    }
  };

  const handleCreateAgent = async () => {
    if (!newAgentName || !newAgentEmail || !newAgentPassword) {
      alert('Nombre, Email y Contraseña son requeridos');
      return;
    }

    setCreatingAgent(true);
    try {
      // Intentar obtener sessionId del storage si no está en estado
      const adminSessionId = sessionStorage.getItem('whatsflow_session') || sessionId;

      // ✅ Usar ruta plana para evitar redirecciones 301 a GET y conflictos con :id
      const response = await fetch(`${apiUrl}/api/agents-create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newAgentName,
          email: newAgentEmail,
          password: newAgentPassword,
          phone: newAgentPhone,
          avatar_url: newAgentAvatar,
          sessionId: adminSessionId,
          sendWhatsApp: true  // Enviar credenciales por WhatsApp
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('✅ Agente creado exitosamente. Se enviaron las credenciales por WhatsApp.');
        setCreateDialogOpen(false);
        setNewAgentName('');
        setNewAgentEmail('');
        setNewAgentPassword('');
        setNewAgentPhone('');
        setNewAgentAvatar('');
        setSelectedContact(null);
        loadData();
      } else {
        alert(`Error creando agente: ${data.error}`);
      }
    } catch (err) {
      console.error('Error creating agent:', err);
      alert('Error de conexión al crear agente');
    } finally {
      setCreatingAgent(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'default';
      case 'suspended': return 'error';
      default: return 'default';
    }
  };

  const getLoadColor = (activeChats: number) => {
    if (activeChats === 0) return '#4caf50';
    if (activeChats < 5) return '#8bc34a';
    if (activeChats < 10) return '#ff9800';
    return '#f44336';
  };

  if (loading && agents.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Gestión de Agentes
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadData}
          >
            Actualizar
          </Button>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Nuevo Agente
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Agentes
              </Typography>
              <Typography variant="h3" fontWeight="bold">
                {agents.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Chats sin Asignar
              </Typography>
              <Typography variant="h3" fontWeight="bold" color="error">
                {unassignedChats.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Chats Activos
              </Typography>
              <Typography variant="h3" fontWeight="bold" color="primary">
                {agents.reduce((sum, agent) => sum + agent.active_chats, 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Sin Leer
              </Typography>
              <Typography variant="h3" fontWeight="bold" color="warning">
                {agents.reduce((sum, agent) => sum + agent.total_unread, 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 2 }}>
        <Tab label={`Agentes (${agents.length})`} />
        <Tab label={`Sin Asignar (${unassignedChats.length})`} />
      </Tabs>

      {/* Tab 0: Agents Table */}
      {activeTab === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Agente</TableCell>
                <TableCell>Teléfono</TableCell>
                <TableCell>Departamento</TableCell>
                <TableCell align="center">Estado</TableCell>
                <TableCell align="center">Chats Activos</TableCell>
                <TableCell align="center">Sin Leer</TableCell>
                <TableCell align="center">Completados Hoy</TableCell>
                <TableCell align="center">Carga</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {agents.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Avatar
                        src={agent.avatar_url}
                        sx={{
                          bgcolor: agent.avatar_url ? 'transparent' : getLoadColor(agent.active_chats),
                          width: 45,
                          height: 45
                        }}
                      >
                        {!agent.avatar_url && agent.name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography fontWeight="bold">{agent.name}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {agent.email}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2">
                      {agent.phone || '-'}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    {agent.department || '-'}
                  </TableCell>

                  <TableCell align="center">
                    <Chip
                      label={agent.status}
                      color={getStatusColor(agent.status)}
                      size="small"
                      icon={agent.status === 'active' ? <ActiveIcon /> : <InactiveIcon />}
                    />
                  </TableCell>

                  <TableCell align="center">
                    <Badge badgeContent={agent.active_chats > 0 ? agent.active_chats : null} color="primary">
                      <AssignmentIcon />
                    </Badge>
                  </TableCell>

                  <TableCell align="center">
                    <Badge badgeContent={agent.total_unread > 0 ? agent.total_unread : null} color="error">
                      <Typography variant="body2">📨</Typography>
                    </Badge>
                  </TableCell>

                  <TableCell align="center">
                    <Chip
                      label={agent.completed_today || 0}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>

                  <TableCell align="center">
                    <Box
                      sx={{
                        width: 60,
                        height: 8,
                        bgcolor: '#e0e0e0',
                        borderRadius: 1,
                        overflow: 'hidden',
                        display: 'inline-block'
                      }}
                    >
                      <Box
                        sx={{
                          width: `${Math.min(agent.active_chats * 10, 100)}%`,
                          height: '100%',
                          bgcolor: getLoadColor(agent.active_chats)
                        }}
                      />
                    </Box>
                  </TableCell>

                  <TableCell align="center">
                    <Tooltip title="Ver estadísticas">
                      <IconButton size="small">
                        <StatsIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Transferir chats">
                      <IconButton size="small" onClick={() => {
                        setTransferFromAgentId(agent.id);
                        setTransferDialogOpen(true);
                      }}>
                        <TransferIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Tab 1: Unassigned Chats */}
      {activeTab === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Contacto</TableCell>
                <TableCell>Último Mensaje</TableCell>
                <TableCell align="center">Total Mensajes</TableCell>
                <TableCell align="center">Hace</TableCell>
                <TableCell align="center">Acción</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {unassignedChats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography color="textSecondary" py={4}>
                      No hay chats sin asignar
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                unassignedChats.map((chat) => (
                  <TableRow key={chat.chat_jid}>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Avatar src={chat.avatar_url}>
                          {chat.contact_name?.charAt(0) || '?'}
                        </Avatar>
                        <Box>
                          <Typography fontWeight="bold">
                            {chat.contact_name || 'Sin nombre'}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {chat.phone_number}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                        {chat.last_message || 'Sin mensajes'}
                      </Typography>
                    </TableCell>

                    <TableCell align="center">
                      <Chip label={chat.total_messages} size="small" />
                    </TableCell>

                    <TableCell align="center">
                      <Typography variant="caption">
                        {chat.last_message_time
                          ? format(new Date(chat.last_message_time), 'dd/MM HH:mm', { locale: es })
                          : '-'}
                      </Typography>
                    </TableCell>

                    <TableCell align="center">
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<AssignmentIcon />}
                        onClick={() => {
                          setSelectedChat(chat);
                          setAssignDialogOpen(true);
                        }}
                      >
                        Asignar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Asignar Chat a Agente</DialogTitle>
        <DialogContent>
          {selectedChat && (
            <Box mb={2}>
              <Typography variant="body2" color="textSecondary">
                Chat: <strong>{selectedChat.contact_name}</strong> ({selectedChat.phone_number})
              </Typography>
            </Box>
          )}

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Seleccionar Agente</InputLabel>
            <Select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value as number)}
              label="Seleccionar Agente"
            >
              {agents.filter(a => a.status === 'active').map((agent) => (
                <MenuItem key={agent.id} value={agent.id}>
                  {agent.name} - {agent.active_chats} chats activos
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Notas (opcional)"
            value={assignNotes}
            onChange={(e) => setAssignNotes(e.target.value)}
            placeholder="Ej: Cliente VIP, lead de campaña X..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleAssignChat} variant="contained">
            Asignar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onClose={() => setTransferDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Transferir Chat</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mb: 2, mt: 1 }}>
            <InputLabel>De (Agente Origen)</InputLabel>
            <Select
              value={transferFromAgentId}
              onChange={(e) => setTransferFromAgentId(e.target.value as number)}
              label="De (Agente Origen)"
            >
              {agents.filter(a => a.active_chats > 0).map((agent) => (
                <MenuItem key={agent.id} value={agent.id}>
                  {agent.name} - {agent.active_chats} chats
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>A (Agente Destino)</InputLabel>
            <Select
              value={transferToAgentId}
              onChange={(e) => setTransferToAgentId(e.target.value as number)}
              label="A (Agente Destino)"
            >
              {agents.filter(a => a.status === 'active' && a.id !== transferFromAgentId).map((agent) => (
                <MenuItem key={agent.id} value={agent.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: agent.is_online ? '#44b700' : '#9e9e9e',
                        boxShadow: agent.is_online ? '0 0 4px #44b700' : 'none'
                      }}
                    />
                    <Box sx={{ flex: 1 }}>
                      {agent.name} - {agent.active_chats} chats
                      {agent.is_online && <Chip label="En línea" size="small" color="success" sx={{ ml: 1, height: 20 }} />}
                    </Box>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="JID del Chat"
            value={transferChatJid}
            onChange={(e) => setTransferChatJid(e.target.value)}
            sx={{ mb: 2 }}
            placeholder="573001234567@s.whatsapp.net"
          />

          <TextField
            fullWidth
            multiline
            rows={2}
            label="Razón de la transferencia"
            value={transferReason}
            onChange={(e) => setTransferReason(e.target.value)}
            placeholder="Ej: Mejor distribución de carga..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleTransferChat} variant="contained">
            Transferir
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Agent Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <PersonAddIcon />
            <Typography variant="h6">Crear Nuevo Agente</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={2}>
            {/* ✅ AUTOCOMPLETADO CON BÚSQUEDA DE CONTACTOS */}
            <Autocomplete
              freeSolo
              options={contacts}
              inputValue={newAgentName}
              loading={loadingContacts}
              noOptionsText={
                newAgentName.length < 2
                  ? "Escribe al menos 2 letras para buscar"
                  : loadingContacts
                    ? "Buscando..."
                    : "No se encontraron contactos"
              }
              getOptionLabel={(option) => {
                if (typeof option === 'string') return option;
                return option.name || option.notify_name || option.jid?.split('@')[0] || '';
              }}
              filterOptions={(options) => options} // No filtrar localmente, ya viene filtrado del servidor
              onInputChange={(event, value, reason) => {
                console.log('[AUTOCOMPLETE] onInputChange:', { value, reason, length: value.length });
                setNewAgentName(value);

                // Limpiar timeout anterior
                if (searchTimeoutRef.current) {
                  clearTimeout(searchTimeoutRef.current);
                }

                // Búsqueda con debounce
                if (value && value.length >= 2) {
                  // Usar setTimeout para debounce
                  searchTimeoutRef.current = setTimeout(() => {
                    console.log('[AUTOCOMPLETE] 🔍 Ejecutando búsqueda para:', value);
                    loadContacts(value);
                  }, 500); // Esperar 500ms después de que el usuario deje de escribir
                } else if (value.length === 0) {
                  setContacts([]);  // Limpiar contactos si se borra todo
                  console.log('[AUTOCOMPLETE] 🧹 Campo vacío, limpiando contactos');
                }
              }}
              onChange={(event, value) => {
                console.log('[AUTOCOMPLETE] onChange:', value);
                if (value && typeof value === 'object') {
                  const name = value.name || value.notify_name || '';
                  const phone = value.jid?.split('@')[0] || '';
                  const avatar = value.avatar_url || '';

                  console.log('[AUTOCOMPLETE] Contacto seleccionado:', { name, phone });

                  setNewAgentName(name);
                  setNewAgentPhone(phone);
                  setNewAgentAvatar(avatar);
                  setSelectedContact(value);
                } else if (typeof value === 'string') {
                  // Si escriben texto libre
                  setNewAgentName(value);
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Nombre Completo *"
                  required
                  helperText={
                    loadingContacts
                      ? "🔍 Buscando contactos..."
                      : contacts.length > 0
                        ? `✅ ${contacts.length} contacto(s) encontrado(s)`
                        : newAgentName.length >= 2
                          ? "⚠️ No se encontraron contactos con ese nombre"
                          : "💡 Escribe al menos 2 letras para buscar en tus contactos"
                  }
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingContacts && <CircularProgress size={20} />}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props} sx={{ display: 'flex', gap: 2, alignItems: 'center', py: 1 }}>
                  <Avatar src={option.avatar_url} sx={{ width: 40, height: 40 }}>
                    {(option.name || option.notify_name || '?').charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body1" fontWeight={500}>
                      {option.name || option.notify_name || 'Sin nombre'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      📱 {option.jid?.split('@')[0]}
                    </Typography>
                  </Box>
                </Box>
              )}
            />

            <TextField
              label="Teléfono"
              fullWidth
              value={newAgentPhone}
              onChange={(e) => setNewAgentPhone(e.target.value)}
              placeholder="595981234567"
              helperText="Número de WhatsApp para enviar credenciales"
              required
            />

            <TextField
              label="Correo Electrónico"
              fullWidth
              type="email"
              value={newAgentEmail}
              onChange={(e) => setNewAgentEmail(e.target.value)}
              required
              helperText="Email para iniciar sesión"
            />

            <TextField
              label="Contraseña"
              fullWidth
              type="password"
              value={newAgentPassword}
              onChange={(e) => setNewAgentPassword(e.target.value)}
              required
              helperText="Contraseña temporal (se recomienda cambiarla después)"
            />

            {newAgentAvatar && (
              <Box display="flex" alignItems="center" gap={2} p={2} bgcolor="#f5f5f5" borderRadius={1}>
                <Avatar src={newAgentAvatar} sx={{ width: 50, height: 50 }} />
                <Typography variant="caption" color="textSecondary">
                  ✅ Avatar del contacto cargado
                </Typography>
              </Box>
            )}

            {newAgentPhone && (
              <Alert severity="success">
                📱 Las credenciales se enviarán automáticamente al WhatsApp: <strong>{newAgentPhone}</strong>
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateDialogOpen(false);
            setSelectedContact(null);
            setNewAgentName('');
            setNewAgentEmail('');
            setNewAgentPassword('');
            setNewAgentPhone('');
            setNewAgentAvatar('');
          }}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreateAgent}
            variant="contained"
            disabled={creatingAgent || !newAgentName || !newAgentEmail || !newAgentPassword || !newAgentPhone}
            startIcon={creatingAgent ? <CircularProgress size={20} /> : <PersonAddIcon />}
            sx={{ bgcolor: '#25d366', '&:hover': { bgcolor: '#1da851' } }}
          >
            {creatingAgent ? 'Creando...' : 'Crear y Enviar Credenciales'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box >
  );
};

export default AdminAgentManagement;
