import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
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
  TextField,
  Alert,
  Badge,
  Tooltip,
  Divider,
  LinearProgress
} from '@mui/material';
import {
  Chat as ChatIcon,
  Person,
  Email,
  Phone,
  Work,
  Send,
  TransferWithinAStation,
  CheckCircle,
  Block,
  Logout,
  Refresh,
  Visibility,
  VisibilityOff,
  Message,
  Assignment,
  People
} from '@mui/icons-material';
import { getAPIBaseURL } from '../utils/socketConfig';

interface AgentPanelProps {
  user: any;
  token: string;
  onLogout: () => void;
}

interface ChatAssignment {
  id: number;
  chat_jid: string;
  session_id: string;
  user_id: number;
  assigned_at: string;
  notes: string;
  status: string;
  contact_name: string;
  contact_phone: string;
  avatar_url: string;
  last_message: string;
  last_message_time: string;
  message_count: number;
  unread_count: number;
}

interface AvailableAgent {
  id: number;
  name: string;
  role: string;
  status: string;
  department: string;
}

const AgentPanel: React.FC<AgentPanelProps> = ({ user, token, onLogout }) => {
  const [chats, setChats] = useState<ChatAssignment[]>([]);
  const [agents, setAgents] = useState<AvailableAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Estados para transferencia de chat
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedChat, setSelectedChat] = useState<ChatAssignment | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<number | ''>('');
  const [transferReason, setTransferReason] = useState('');
  
  // Estados para ver mensajes
  const [viewMessagesDialogOpen, setViewMessagesDialogOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    loadAssignedChats();
    loadAvailableAgents();
  }, []);

  const loadAssignedChats = async () => {
    try {
      setLoading(true);
      const API_BASE = getAPIBaseURL();
      const response = await fetch(`${API_BASE}/api/users/${user.id}/chats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setChats(data.chats || []);
      } else {
        setError(data.error);
      }
    } catch (error) {
      console.error('Error cargando chats asignados:', error);
      setError('Error cargando chats asignados');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableAgents = async () => {
    try {
      const API_BASE = getAPIBaseURL();
      const response = await fetch(`${API_BASE}/api/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Filtrar agentes activos que no sean el usuario actual
        const availableAgents = data.users.filter((agent: any) => 
          agent.id !== user.id && 
          agent.status === 'active' && 
          ['agent', 'supervisor'].includes(agent.role)
        );
        setAgents(availableAgents);
      }
    } catch (error) {
      console.error('Error cargando agentes disponibles:', error);
    }
  };

  const handleTransferChat = (chat: ChatAssignment) => {
    setSelectedChat(chat);
    setSelectedAgent('');
    setTransferReason('');
    setTransferDialogOpen(true);
  };

  const confirmTransferChat = async () => {
    if (!selectedChat || !selectedAgent) {
      setError('Selecciona un agente para transferir');
      return;
    }

    try {
      const API_BASE = getAPIBaseURL();
      const response = await fetch(`${API_BASE}/api/chats/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId: selectedChat.session_id,
          chatJid: selectedChat.chat_jid,
          fromUserId: user.id,
          toUserId: selectedAgent,
          reason: transferReason,
          transferredBy: user.id
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Chat transferido correctamente');
        setTransferDialogOpen(false);
        loadAssignedChats();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error);
      }
    } catch (error) {
      console.error('Error transfiriendo chat:', error);
      setError('Error transfiriendo chat');
    }
  };

  const handleViewMessages = async (chat: ChatAssignment) => {
    try {
      setSelectedChat(chat);
      setViewMessagesDialogOpen(true);
      
      // Aquí iría la lógica para cargar los mensajes del chat
      // Por ahora simulamos con datos de ejemplo
      const mockMessages = [
        {
          id: 1,
          text: 'Hola, necesito ayuda con mi pedido',
          from_me: false,
          timestamp: new Date().toISOString()
        },
        {
          id: 2,
          text: 'Claro, ¿en qué puedo ayudarte?',
          from_me: true,
          timestamp: new Date().toISOString()
        }
      ];
      
      setChatMessages(mockMessages);
    } catch (error) {
      console.error('Error cargando mensajes:', error);
      setError('Error cargando mensajes');
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;

    try {
      // Aquí iría la lógica para enviar el mensaje
      // Por ahora solo agregamos a la lista local
      const newMsg = {
        id: Date.now(),
        text: newMessage,
        from_me: true,
        timestamp: new Date().toISOString()
      };
      
      setChatMessages([...chatMessages, newMsg]);
      setNewMessage('');
      
      // Aquí harías la llamada a la API para enviar el mensaje real
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      setError('Error enviando mensaje');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#4caf50';
      case 'inactive': return '#9e9e9e';
      case 'suspended': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ 
        mb: 4, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 3,
        p: 3,
        color: 'white'
      }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            👤 Panel de Agente
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9, fontWeight: 300 }}>
            Bienvenido, {user.name} ({user.role})
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Logout />}
          onClick={onLogout}
          sx={{
            bgcolor: 'rgba(255,255,255,0.2)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
          }}
        >
          Cerrar Sesión
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

      {/* Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card elevation={2}>
            <CardContent sx={{ textAlign: 'center' }}>
              <ChatIcon sx={{ fontSize: 48, color: '#2196f3', mb: 2 }} />
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#2196f3' }}>
                {chats.length}
              </Typography>
              <Typography variant="h6" sx={{ color: '#64748b' }}>
                Chats Asignados
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card elevation={2}>
            <CardContent sx={{ textAlign: 'center' }}>
              <People sx={{ fontSize: 48, color: '#4caf50', mb: 2 }} />
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#4caf50' }}>
                {agents.length}
              </Typography>
              <Typography variant="h6" sx={{ color: '#64748b' }}>
                Agentes Disponibles
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card elevation={2}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Message sx={{ fontSize: 48, color: '#ff9800', mb: 2 }} />
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#ff9800' }}>
                {chats.reduce((sum, chat) => sum + (chat.unread_count || 0), 0)}
              </Typography>
              <Typography variant="h6" sx={{ color: '#64748b' }}>
                Mensajes Sin Leer
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Chats asignados */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              📨 Chats Asignados
            </Typography>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={loadAssignedChats}
              disabled={loading}
            >
              Actualizar
            </Button>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <LinearProgress sx={{ width: '100%' }} />
            </Box>
          ) : chats.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <ChatIcon sx={{ fontSize: 80, color: '#ccc', mb: 2 }} />
              <Typography variant="h6" color="textSecondary" sx={{ mb: 1 }}>
                No tienes chats asignados
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Los chats se asignarán automáticamente cuando los clientes inicien conversaciones
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={3}>
              {chats.map((chat) => (
                <Grid item xs={12} md={6} lg={4} key={chat.id}>
                  <Card 
                    elevation={3} 
                    sx={{ 
                      height: '100%',
                      border: '1px solid #e0e0e0',
                      '&:hover': {
                        borderColor: '#2196f3',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 24px rgba(33, 150, 243, 0.15)'
                      },
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Badge
                          overlap="circular"
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                          badgeContent={
                            <Box sx={{ 
                              width: 12, 
                              height: 12, 
                              borderRadius: '50%', 
                              bgcolor: chat.status === 'active' ? '#4caf50' : '#9e9e9e' 
                            }} />
                          }
                        >
                          <Avatar 
                            src={chat.avatar_url} 
                            sx={{ 
                              width: 56, 
                              height: 56, 
                              bgcolor: '#2196f3',
                              fontSize: '1.5rem',
                              fontWeight: 600
                            }}
                          >
                            {chat.contact_name.charAt(0).toUpperCase()}
                          </Avatar>
                        </Badge>
                        <Box sx={{ ml: 2, flex: 1 }}>
                          <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                            {chat.contact_name}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#64748b' }}>
                            {chat.contact_phone || 'Número no disponible'}
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{ mb: 2 }}>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: '#64748b',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            mb: 1
                          }}
                        >
                          {chat.last_message || 'Sin mensajes'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                          Último mensaje: {new Date(chat.last_message_time).toLocaleString()}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Chip
                          label={`${chat.message_count || 0} mensajes`}
                          size="small"
                          sx={{ 
                            bgcolor: '#e3f2fd',
                            color: '#1976d2',
                            fontWeight: 600
                          }}
                        />
                        {chat.unread_count > 0 && (
                          <Chip
                            label={`${chat.unread_count} sin leer`}
                            size="small"
                            color="primary"
                            sx={{ fontWeight: 600 }}
                          />
                        )}
                      </Box>

                      <Divider sx={{ my: 2 }} />

                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<Visibility />}
                          onClick={() => handleViewMessages(chat)}
                          sx={{ flex: 1 }}
                        >
                          Ver Chat
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<TransferWithinAStation />}
                          onClick={() => handleTransferChat(chat)}
                          sx={{ 
                            flex: 1,
                            bgcolor: '#9c27b0',
                            '&:hover': { bgcolor: '#7b1fa2' }
                          }}
                        >
                          Transferir
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de transferencia de chat */}
      <Dialog 
        open={transferDialogOpen} 
        onClose={() => setTransferDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>
          🔄 Transferir Chat
        </DialogTitle>
        <DialogContent>
          {selectedChat && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Chat a transferir:
              </Typography>
              <Typography variant="body2" sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 1 }}>
                {selectedChat.contact_name} ({selectedChat.contact_phone})
              </Typography>
            </Box>
          )}

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Agente destino</InputLabel>
            <Select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value as number)}
              label="Agente destino"
            >
              {agents.map((agent) => (
                <MenuItem key={agent.id} value={agent.id}>
                  {agent.name} ({agent.role}) - {agent.department || 'Sin departamento'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Motivo de la transferencia"
            multiline
            rows={3}
            value={transferReason}
            onChange={(e) => setTransferReason(e.target.value)}
            placeholder="Opcional: explica el motivo de la transferencia..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferDialogOpen(false)}>
            Cancelar
          </Button>
          <Button 
            variant="contained" 
            onClick={confirmTransferChat}
            sx={{ 
              bgcolor: '#9c27b0',
              '&:hover': { bgcolor: '#7b1fa2' }
            }}
          >
            Confirmar Transferencia
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de visualización de mensajes */}
      <Dialog 
        open={viewMessagesDialogOpen} 
        onClose={() => setViewMessagesDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
        sx={{ '& .MuiDialog-paper': { height: '80vh' } }}
      >
        <DialogTitle>
          💬 Conversación con {selectedChat?.contact_name}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ 
            flex: 1, 
            overflowY: 'auto', 
            mb: 2, 
            p: 2, 
            bgcolor: '#f8fafc',
            borderRadius: 1,
            border: '1px solid #e2e8f0'
          }}>
            {chatMessages.map((message) => (
              <Box 
                key={message.id}
                sx={{ 
                  display: 'flex', 
                  justifyContent: message.from_me ? 'flex-end' : 'flex-start',
                  mb: 2
                }}
              >
                <Box sx={{ 
                  maxWidth: '70%',
                  bgcolor: message.from_me ? '#00a884' : '#ffffff',
                  color: message.from_me ? '#ffffff' : '#000000',
                  p: 2,
                  borderRadius: 2,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}>
                  <Typography variant="body1">{message.text}</Typography>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      display: 'block', 
                      mt: 1, 
                      opacity: 0.7,
                      textAlign: message.from_me ? 'right' : 'left'
                    }}
                  >
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje..."
              variant="outlined"
              size="small"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              multiline
              maxRows={3}
            />
            <Button
              variant="contained"
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              sx={{ 
                minWidth: 'auto',
                bgcolor: '#00a884',
                '&:hover': { bgcolor: '#008c6d' },
                '&:disabled': { bgcolor: '#cccccc' }
              }}
            >
              <Send />
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewMessagesDialogOpen(false)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AgentPanel;