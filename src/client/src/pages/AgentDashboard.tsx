import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  IconButton,
  Badge,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  AppBar,
  Toolbar,
  Button
} from '@mui/material';
import {
  Chat as ChatIcon,
  Search as SearchIcon,
  AccessTime as TimeIcon,
  Check as CheckIcon,
  Logout as LogoutIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';

interface AgentChat {
  assignment_id: number;
  chat_jid: string;
  session_id: string;
  contact_name: string;
  phone_number: string;
  avatar_url?: string;
  unread_count: number;
  last_message_time: string;
  last_message: string;
  assignment_status: string;
}

const AgentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { socket, isConnected, on, off } = useSocket();
  const [chats, setChats] = useState<AgentChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [agentId, setAgentId] = useState<number | null>(null);
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    // Obtener datos del usuario y sessionId
    const token = sessionStorage.getItem('token');
    const savedSessionId = sessionStorage.getItem('whatsflow_session');
    const savedUserId = sessionStorage.getItem('userId');
    
    console.log('🔍 [AGENT-DASHBOARD] Inicializando...');
    console.log('🔍 Token:', token ? 'Existe' : 'No existe');
    console.log('🔍 SessionId:', savedSessionId);
    console.log('🔍 UserId guardado:', savedUserId);
    
    if (token && savedUserId) {
      setAgentId(parseInt(savedUserId));
      setUserName(sessionStorage.getItem('userName') || 'Agente');
      console.log('✅ AgentId establecido:', savedUserId);
    } else {
      console.error('❌ No hay token o userId en localStorage');
    }

    if (savedSessionId) {
      setSessionId(savedSessionId);
      console.log('✅ SessionId establecido:', savedSessionId);
    } else {
      console.error('❌ No hay sessionId en localStorage');
    }
  }, []);

  const loadAgentChats = useCallback(async () => {
    if (!agentId || !sessionId) {
      setLoading(false);
      return;
    }

    try {
      const token = sessionStorage.getItem('token');
      if (!token) {
        setError('No hay sesión activa');
        return;
      }

      const response = await fetch(`/api/agents/${agentId}/chats?sessionId=${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      console.log('📱 Chats del agente:', data);
      
      if (data.success) {
        setChats(data.chats || []);
        setError(null);
      } else {
        setError(data.error || 'Error cargando chats');
      }
    } catch (err) {
      console.error('Error loading chats:', err);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [agentId, sessionId]);

  // Carga inicial de chats
  useEffect(() => {
    if (agentId && sessionId) {
      loadAgentChats();
    }
  }, [agentId, sessionId, loadAgentChats]);

  // Escuchar eventos de socket para actualizaciones en tiempo real
  useEffect(() => {
    if (!socket || !isConnected || !agentId) return;

    console.log(`🔌 [AGENT-DASHBOARD] Socket conectado, escuchando eventos para agente ${agentId}`);

    // Evento cuando se asigna un nuevo chat al agente
    const handleNewAssignment = (data: any) => {
      console.log('🔔 [AGENT-DASHBOARD] Nuevo chat asignado:', data);
      loadAgentChats(); // Recargar chats
    };

    // Evento cuando llega un nuevo mensaje
    const handleNewMessage = (data: any) => {
      console.log('💬 [AGENT-DASHBOARD] Nuevo mensaje:', data);
      loadAgentChats(); // Recargar chats para actualizar último mensaje
    };

    // Evento cuando cambia una asignación
    const handleAssignmentChanged = (data: any) => {
      console.log('🔄 [AGENT-DASHBOARD] Asignación cambiada:', data);
      loadAgentChats();
    };

    // Suscribirse a los eventos
    on(`agent-${agentId}-assignment`, handleNewAssignment);
    on(`agent-${agentId}-new-chat`, handleNewAssignment);
    on('message', handleNewMessage);
    on('chat-assignment-changed', handleAssignmentChanged);
    on('chat-transferred', handleAssignmentChanged);

    // Cleanup al desmontar
    return () => {
      off(`agent-${agentId}-assignment`);
      off(`agent-${agentId}-new-chat`);
      off('message');
      off('chat-assignment-changed');
      off('chat-transferred');
    };
  }, [socket, isConnected, agentId, on, off, loadAgentChats]);

  const handleChatClick = (chat: AgentChat) => {
    // Navegar al chat
    window.location.href = `/chat?sessionId=${chat.session_id}&chatId=${chat.chat_jid}`;
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('whatsflow_session');
    localStorage.removeItem('whatsflow_user_type');
    window.location.href = '/';
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffHours = Math.abs(now.getTime() - date.getTime()) / 36e5;

      if (diffHours < 24) {
        return format(date, 'HH:mm', { locale: es });
      } else if (diffHours < 48) {
        return 'Ayer';
      } else {
        return format(date, 'dd/MM/yyyy', { locale: es });
      }
    } catch {
      return '';
    }
  };

  const filteredChats = chats.filter(chat => {
    const searchLower = searchTerm.toLowerCase();
    return (
      chat.contact_name?.toLowerCase().includes(searchLower) ||
      chat.phone_number?.toLowerCase().includes(searchLower) ||
      chat.last_message?.toLowerCase().includes(searchLower)
    );
  });

  const activeChats = filteredChats.filter(c => c.assignment_status === 'active');
  const unreadChats = activeChats.filter(c => c.unread_count > 0);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      {/* Header con logout */}
      <AppBar position="static" sx={{ bgcolor: '#00a884' }}>
        <Toolbar>
          <ChatIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            WhatsFlow - Panel de Agente
          </Typography>
          <Typography variant="body2" sx={{ mr: 2 }}>
            {userName}
          </Typography>
          <Button
            color="inherit"
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
          >
            Cerrar Sesión
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 3 }}>
        <Routes>
          <Route path="/" element={
            <>
              {/* Header */}
              <Box mb={3}>
                <Typography variant="h4" gutterBottom>
                  Mis Chats Asignados
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Visualiza y gestiona los chats que te han sido asignados
                </Typography>
              </Box>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}

              {/* Estadísticas */}
              <Grid container spacing={2} mb={3}>
                <Grid item xs={12} sm={4}>
                  <Card>
                    <CardContent>
                      <Box display="flex" alignItems="center">
                        <Badge badgeContent={activeChats.length > 0 ? activeChats.length : null} color="primary">
                          <ChatIcon fontSize="large" color="primary" />
                        </Badge>
                        <Box ml={2}>
                          <Typography variant="h5">{activeChats.length}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Chats Activos
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Card>
                    <CardContent>
                      <Box display="flex" alignItems="center">
                        <Badge badgeContent={unreadChats.length > 0 ? unreadChats.length : null} color="error">
                          <ChatIcon fontSize="large" color="error" />
                        </Badge>
                        <Box ml={2}>
                          <Typography variant="h5">{unreadChats.length}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Sin Leer
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Card>
                    <CardContent>
                      <Box display="flex" alignItems="center">
                        <CheckIcon fontSize="large" color="success" />
                        <Box ml={2}>
                          <Typography variant="h5">
                            {activeChats.reduce((sum, chat) => sum + chat.unread_count, 0)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Mensajes Pendientes
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Búsqueda y Filtros */}
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <TextField
                    fullWidth
                    placeholder="Buscar por nombre, teléfono o mensaje..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mt: 2 }}>
                    <Tab label={`Todos (${activeChats.length})`} />
                    <Tab label={`Sin Leer (${unreadChats.length})`} />
                  </Tabs>
                </CardContent>
              </Card>

              {/* Lista de Chats */}
              <Card>
                <List>
                  {(tabValue === 0 ? activeChats : unreadChats).length === 0 ? (
                    <ListItem>
                      <ListItemText
                        primary="No hay chats disponibles"
                        secondary="Los chats asignados aparecerán aquí"
                      />
                    </ListItem>
                  ) : (
                    (tabValue === 0 ? activeChats : unreadChats).map((chat) => (
                      <ListItem
                        key={chat.assignment_id}
                        button
                        onClick={() => handleChatClick(chat)}
                        sx={{
                          borderBottom: '1px solid #f0f0f0',
                          '&:hover': {
                            backgroundColor: '#f5f5f5'
                          }
                        }}
                      >
                        <ListItemAvatar>
                          <Badge
                            badgeContent={chat.unread_count}
                            color="error"
                            overlap="circular"
                          >
                            <Avatar
                              src={chat.avatar_url}
                              alt={chat.contact_name}
                            >
                              {chat.contact_name?.[0] || '?'}
                            </Avatar>
                          </Badge>
                        </ListItemAvatar>

                        <ListItemText
                          primary={
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                              <Typography variant="subtitle1" fontWeight={chat.unread_count > 0 ? 600 : 400}>
                                {chat.contact_name || 'Sin nombre'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatTime(chat.last_message_time)}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  fontWeight: chat.unread_count > 0 ? 500 : 400
                                }}
                              >
                                {chat.last_message || 'Sin mensajes'}
                              </Typography>
                              <Box display="flex" gap={1} mt={0.5}>
                                <Chip
                                  label={chat.phone_number.replace('@s.whatsapp.net', '')}
                                  size="small"
                                  variant="outlined"
                                />
                              </Box>
                            </Box>
                          }
                        />
                      </ListItem>
                    ))
                  )}
                </List>
              </Card>
            </>
          } />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Box>
    </Box>
  );
};

export default AgentDashboard;
