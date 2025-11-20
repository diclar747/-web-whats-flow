import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  Tabs,
  Tab
} from '@mui/material';
import {
  PersonAdd as AssignIcon,
  SwapHoriz as TransferIcon,
  Refresh as RefreshIcon,
  Dashboard as DashboardIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface UnassignedChat {
  chat_jid: string;
  session_id: string;
  contact_name: string;
  avatar_url?: string;
  is_group: boolean;
  total_messages: number;
  last_message_time: string;
  last_message: string;
}

interface Agent {
  id: number;
  name: string;
  email: string;
  active_chats: number;
  total_unread: number;
}

interface DashboardStats {
  total_agents: number;
  unassigned_chats: number;
  messages_today: number;
  agents: Agent[];
}

const AdminChatAssignment: React.FC = () => {
  const [unassignedChats, setUnassignedChats] = useState<UnassignedChat[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedChat, setSelectedChat] = useState<UnassignedChat | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sessionId] = useState('default');
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Refresh cada 10 segundos
    return () => clearInterval(interval);
  }, [sessionId]);

  const loadData = async () => {
    await Promise.all([
      loadUnassignedChats(),
      loadDashboard()
    ]);
  };

  const loadUnassignedChats = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`/api/chats/unassigned?sessionId=${sessionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        setUnassignedChats(data.chats);
      }
    } catch (err) {
      console.error('Error loading unassigned chats:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch('/api/admin/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
        setAgents(data.stats.agents);
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
    }
  };

  const handleAssignClick = (chat: UnassignedChat) => {
    setSelectedChat(chat);
    setSelectedAgent('');
    setNotes('');
    setAssignDialogOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedChat || !selectedAgent) {
      setError('Debes seleccionar un agente');
      return;
    }

    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch('/api/chats/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          chat_jid: selectedChat.chat_jid,
          session_id: selectedChat.session_id,
          user_id: selectedAgent,
          notes
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess('Chat asignado correctamente');
        setAssignDialogOpen(false);
        loadData();
        
        // Emitir evento Socket.IO para notificar al agente
        // socket.emit('chat:assigned', { chat_jid: selectedChat.chat_jid, user_id: selectedAgent });
      } else {
        setError(data.error || 'Error asignando chat');
      }
    } catch (err) {
      console.error('Error assigning chat:', err);
      setError('Error de conexión');
    }
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'dd/MM/yyyy HH:mm', { locale: es });
    } catch {
      return '';
    }
  };

  if (loading) {
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
        <Box>
          <Typography variant="h4" gutterBottom>
            Administración de Chats
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Asigna y gestiona chats entre agentes
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadData}
        >
          Actualizar
        </Button>
      </Box>

      {/* Alertas */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Dashboard Estadísticas */}
      {stats && (
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <DashboardIcon fontSize="large" color="primary" />
                  <Box ml={2}>
                    <Typography variant="h5">{stats.total_agents}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Agentes Activos
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <AssignIcon fontSize="large" color="warning" />
                  <Box ml={2}>
                    <Typography variant="h5">{stats.unassigned_chats}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Chats Sin Asignar
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <Typography variant="h5">{stats.messages_today}</Typography>
                  <Box ml={2}>
                    <Typography variant="body2" color="text.secondary">
                      Mensajes Hoy
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <Typography variant="h5">
                    {agents.reduce((sum, a) => sum + a.active_chats, 0)}
                  </Typography>
                  <Box ml={2}>
                    <Typography variant="body2" color="text.secondary">
                      Chats Asignados
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Grid container spacing={3}>
        {/* Chats sin asignar */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Chats Pendientes de Asignación
              </Typography>
              
              <List>
                {unassignedChats.length === 0 ? (
                  <ListItem>
                    <ListItemText
                      primary="No hay chats sin asignar"
                      secondary="Todos los chats han sido asignados a agentes"
                    />
                  </ListItem>
                ) : (
                  unassignedChats.map((chat) => (
                    <ListItem
                      key={chat.chat_jid}
                      sx={{ borderBottom: '1px solid #f0f0f0' }}
                    >
                      <ListItemAvatar>
                        <Avatar src={chat.avatar_url}>
                          {chat.contact_name?.[0] || '?'}
                        </Avatar>
                      </ListItemAvatar>

                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="subtitle1">
                              {chat.contact_name || 'Sin nombre'}
                            </Typography>
                            {chat.is_group && (
                              <Chip label="Grupo" size="small" color="info" />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {chat.last_message}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {chat.total_messages} mensajes • {formatTime(chat.last_message_time)}
                            </Typography>
                          </Box>
                        }
                      />

                      <Button
                        variant="contained"
                        startIcon={<AssignIcon />}
                        onClick={() => handleAssignClick(chat)}
                        size="small"
                      >
                        Asignar
                      </Button>
                    </ListItem>
                  ))
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Panel de agentes */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Agentes Disponibles
              </Typography>
              
              <List>
                {agents.map((agent) => (
                  <ListItem key={agent.id} sx={{ borderBottom: '1px solid #f0f0f0' }}>
                    <ListItemAvatar>
                      <Avatar>{agent.name[0]}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={agent.name}
                      secondary={
                        <Box>
                          <Typography variant="caption">
                            {agent.email}
                          </Typography>
                          <Box display="flex" gap={1} mt={0.5}>
                            <Chip
                              label={`${agent.active_chats} chats`}
                              size="small"
                              color={agent.active_chats > 5 ? 'warning' : 'success'}
                            />
                            {agent.total_unread > 0 && (
                              <Chip
                                label={`${agent.total_unread} sin leer`}
                                size="small"
                                color="error"
                              />
                            )}
                          </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dialog de Asignación */}
      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Asignar Chat a Agente</DialogTitle>
        <DialogContent>
          {selectedChat && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Chat seleccionado:
              </Typography>
              <Box display="flex" alignItems="center" gap={2} mb={3} p={2} bgcolor="#f5f5f5" borderRadius={1}>
                <Avatar src={selectedChat.avatar_url}>
                  {selectedChat.contact_name?.[0] || '?'}
                </Avatar>
                <Box>
                  <Typography variant="subtitle1">{selectedChat.contact_name}</Typography>
                  <Typography variant="caption">{selectedChat.total_messages} mensajes</Typography>
                </Box>
              </Box>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Seleccionar Agente</InputLabel>
                <Select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value as number)}
                  label="Seleccionar Agente"
                >
                  {agents.map((agent) => (
                    <MenuItem key={agent.id} value={agent.id}>
                      {agent.name} ({agent.active_chats} chats activos)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notas (opcional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Cliente importante, lead de campaña..."
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialogOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleAssign}
            disabled={!selectedAgent}
          >
            Asignar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminChatAssignment;
