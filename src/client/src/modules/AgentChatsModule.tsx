import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { getAPIBaseURL } from '../utils/socketConfig';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Divider,
  Tab,
  Tabs,
  Badge,
  Tooltip,
  Card,
  CardContent
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Close as CloseIcon,
  Undo,
  SwapHoriz,
  People,
  Chat,
  AccessTime,
  WhatsApp,
  MoreVert
} from '@mui/icons-material';

interface AgentChatsModuleProps {
  sessionId: string;
  agentId: string;
}

interface TransferredChat {
  id: string;
  chatId: string;
  chatName: string;
  fromAgent: string;
  toAgent: string;
  status: 'pending' | 'accepted' | 'closed';
  transferredAt: string;
  lastMessage?: string;
  unreadCount?: number;
}

const AgentChatsModule: React.FC<AgentChatsModuleProps> = ({ sessionId, agentId }) => {
  const { isDarkMode } = useTheme();
  const [transferredChats, setTransferredChats] = useState<TransferredChat[]>([]);
  const [filterTab, setFilterTab] = useState(0); // 0: Pendientes, 1: Activos, 2: Cerrados
  const [selectedChat, setSelectedChat] = useState<TransferredChat | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);
  const [selectedAgentForTransfer, setSelectedAgentForTransfer] = useState('');
  const [loading, setLoading] = useState(true);

  const colors = {
    primary: '#00a884',
    background: isDarkMode ? '#0b141a' : '#f0f2f5',
    paper: isDarkMode ? '#111b21' : '#fff',
    text: isDarkMode ? '#e9edef' : '#111b21',
    textSecondary: isDarkMode ? '#8696a0' : '#667781',
    divider: isDarkMode ? '#2a3942' : '#d1d7db',
    hover: isDarkMode ? '#2a3942' : '#f5f6f6',
    pending: '#ff9800',
    active: '#00a884',
    closed: '#667781'
  };

  // Cargar chats transferidos
  useEffect(() => {
    loadTransferredChats();
    const interval = setInterval(loadTransferredChats, 30000); // Actualizar cada 30s
    return () => clearInterval(interval);
  }, [agentId]);

  // Cargar agentes disponibles
  useEffect(() => {
    loadAvailableAgents();
  }, []);

  const loadTransferredChats = async () => {
    
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/agent/${agentId}/chats`);
      const data = await response.json();
      if (data.success && data.chats) {
        setTransferredChats(data.chats);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error cargando chats transferidos:', error);
      setLoading(false);
    }
  };

  const loadAvailableAgents = async () => {
    
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/agents/available`);
      const data = await response.json();
      if (data.success && data.agents) {
        setAvailableAgents(data.agents.filter((a: any) => a.id !== agentId));
      }
    } catch (error) {
      console.error('Error cargando agentes:', error);
    }
  };

  const handleAcceptChat = async (chat: TransferredChat) => {
    
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/agent/chat/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transferId: chat.id,
          agentId: agentId
        })
      });

      const data = await response.json();
      if (data.success) {
        loadTransferredChats();
        // Redirigir al chat
        window.open(`/dashboard/chat?chatId=${chat.chatId}`, '_blank');
      }
    } catch (error) {
      console.error('Error aceptando chat:', error);
    }
  };

  const handleRejectChat = async (chat: TransferredChat) => {
    
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/agent/chat/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transferId: chat.id,
          agentId: agentId
        })
      });

      const data = await response.json();
      if (data.success) {
        loadTransferredChats();
      }
    } catch (error) {
      console.error('Error rechazando chat:', error);
    }
  };

  const handleCloseChat = async () => {
    
    if (!selectedChat) return;

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/agent/chat/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transferId: selectedChat.id,
          agentId: agentId
        })
      });

      const data = await response.json();
      if (data.success) {
        setCloseDialogOpen(false);
        loadTransferredChats();
      }
    } catch (error) {
      console.error('Error cerrando chat:', error);
    }
  };

  const handleReturnChat = async () => {
    
    if (!selectedChat) return;

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/agent/chat/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transferId: selectedChat.id,
          agentId: agentId
        })
      });

      const data = await response.json();
      if (data.success) {
        setReturnDialogOpen(false);
        loadTransferredChats();
      }
    } catch (error) {
      console.error('Error devolviendo chat:', error);
    }
  };

  const handleTransferChat = async () => {
    
    if (!selectedChat || !selectedAgentForTransfer) return;

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/agent/chat/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transferId: selectedChat.id,
          fromAgentId: agentId,
          toAgentId: selectedAgentForTransfer
        })
      });

      const data = await response.json();
      if (data.success) {
        setTransferDialogOpen(false);
        setSelectedAgentForTransfer('');
        loadTransferredChats();
      }
    } catch (error) {
      console.error('Error transfiriendo chat:', error);
    }
  };

  const filteredChats = transferredChats.filter(chat => {
    if (filterTab === 0) return chat.status === 'pending';
    if (filterTab === 1) return chat.status === 'accepted';
    if (filterTab === 2) return chat.status === 'closed';
    return true;
  });

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('es', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Box sx={{ p: 3, bgcolor: colors.background, minHeight: '100vh' }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: colors.paper }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <People sx={{ fontSize: 40, color: colors.primary }} />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600, color: colors.text }}>
                Mis Chats Asignados
              </Typography>
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                Gestiona los chats transferidos a ti
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Card sx={{ bgcolor: colors.hover }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                  Pendientes
                </Typography>
                <Typography variant="h6" sx={{ color: colors.pending, fontWeight: 600 }}>
                  {transferredChats.filter(c => c.status === 'pending').length}
                </Typography>
              </CardContent>
            </Card>
            <Card sx={{ bgcolor: colors.hover }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                  Activos
                </Typography>
                <Typography variant="h6" sx={{ color: colors.active, fontWeight: 600 }}>
                  {transferredChats.filter(c => c.status === 'accepted').length}
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ mb: 3, bgcolor: colors.paper }}>
        <Tabs
          value={filterTab}
          onChange={(e, newValue) => setFilterTab(newValue)}
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              color: colors.textSecondary,
              fontWeight: 500
            },
            '& .Mui-selected': {
              color: colors.primary
            },
            '& .MuiTabs-indicator': {
              bgcolor: colors.primary
            }
          }}
        >
          <Tab
            label={`Pendientes (${transferredChats.filter(c => c.status === 'pending').length})`}
            icon={<AccessTime />}
            iconPosition="start"
          />
          <Tab
            label={`Activos (${transferredChats.filter(c => c.status === 'accepted').length})`}
            icon={<Chat />}
            iconPosition="start"
          />
          <Tab
            label={`Cerrados (${transferredChats.filter(c => c.status === 'closed').length})`}
            icon={<CloseIcon />}
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* Lista de chats */}
      <Paper sx={{ bgcolor: colors.paper }}>
        {loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>
              Cargando chats...
            </Typography>
          </Box>
        ) : filteredChats.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <WhatsApp sx={{ fontSize: 60, color: colors.textSecondary, opacity: 0.3, mb: 2 }} />
            <Typography variant="body1" sx={{ color: colors.textSecondary }}>
              No hay chats {filterTab === 0 ? 'pendientes' : filterTab === 1 ? 'activos' : 'cerrados'}
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {filteredChats.map((chat, index) => (
              <React.Fragment key={chat.id}>
                {index > 0 && <Divider />}
                <ListItem
                  secondaryAction={
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      {chat.status === 'pending' && (
                        <>
                          <Tooltip title="Aceptar">
                            <IconButton
                              onClick={() => handleAcceptChat(chat)}
                              sx={{ color: colors.active }}
                            >
                              <CheckCircle />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Rechazar">
                            <IconButton
                              onClick={() => handleRejectChat(chat)}
                              sx={{ color: '#f44336' }}
                            >
                              <Cancel />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      {chat.status === 'accepted' && (
                        <IconButton
                          onClick={(e) => {
                            setSelectedChat(chat);
                            setMenuAnchor(e.currentTarget);
                          }}
                        >
                          <MoreVert />
                        </IconButton>
                      )}
                    </Box>
                  }
                  sx={{ py: 2, px: 3 }}
                >
                  <ListItemAvatar>
                    <Badge
                      badgeContent={chat.unreadCount}
                      color="error"
                      invisible={!chat.unreadCount || chat.unreadCount === 0}
                    >
                      <Avatar sx={{ bgcolor: colors.primary, width: 50, height: 50 }}>
                        {chat.chatName.charAt(0).toUpperCase()}
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: colors.text }}>
                          {chat.chatName}
                        </Typography>
                        <Chip
                          label={chat.status === 'pending' ? 'Pendiente' : chat.status === 'accepted' ? 'Activo' : 'Cerrado'}
                          size="small"
                          sx={{
                            bgcolor: chat.status === 'pending' ? colors.pending : chat.status === 'accepted' ? colors.active : colors.closed,
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.7rem'
                          }}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
                          {chat.lastMessage || 'Sin mensajes recientes'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                          Transferido desde: <strong>{chat.fromAgent}</strong> • {formatTime(chat.transferredAt)}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>

      {/* Menú de opciones */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => {
          window.open(`/dashboard/chat?chatId=${selectedChat?.chatId}`, '_blank');
          setMenuAnchor(null);
        }}>
          <Chat sx={{ mr: 2, color: colors.primary }} /> Abrir chat
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { setReturnDialogOpen(true); setMenuAnchor(null); }}>
          <Undo sx={{ mr: 2, color: '#2196f3' }} /> Devolver chat
        </MenuItem>
        <MenuItem onClick={() => { setTransferDialogOpen(true); setMenuAnchor(null); }}>
          <SwapHoriz sx={{ mr: 2, color: '#ff9800' }} /> Transferir a otro agente
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { setCloseDialogOpen(true); setMenuAnchor(null); }} sx={{ color: '#f44336' }}>
          <CloseIcon sx={{ mr: 2 }} /> Cerrar chat
        </MenuItem>
      </Menu>

      {/* Diálogo de cerrar chat */}
      <Dialog open={closeDialogOpen} onClose={() => setCloseDialogOpen(false)}>
        <DialogTitle>Cerrar chat</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
            ¿Estás seguro de que deseas cerrar este chat? El chat ya no aparecerá en tu lista de activos.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleCloseChat} variant="contained" color="error">
            Cerrar chat
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de devolver chat */}
      <Dialog open={returnDialogOpen} onClose={() => setReturnDialogOpen(false)}>
        <DialogTitle>Devolver chat</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
            ¿Deseas devolver este chat al agente que te lo transfirió?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReturnDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleReturnChat} variant="contained" sx={{ bgcolor: '#2196f3' }}>
            Devolver
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de transferir a otro agente */}
      <Dialog open={transferDialogOpen} onClose={() => setTransferDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Transferir a otro agente</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2 }}>
            Selecciona un agente para transferir este chat:
          </Typography>
          <TextField
            select
            fullWidth
            value={selectedAgentForTransfer}
            onChange={(e) => setSelectedAgentForTransfer(e.target.value)}
            label="Seleccionar agente"
          >
            {availableAgents.map((agent) => (
              <MenuItem key={agent.id} value={agent.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: '#ff9800' }}>
                    {agent.name?.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="body2">{agent.name}</Typography>
                    <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                      {agent.status === 'online' ? '🟢 En línea' : '⚫ Offline'}
                    </Typography>
                  </Box>
                </Box>
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferDialogOpen(false)}>Cancelar</Button>
          <Button
            onClick={handleTransferChat}
            variant="contained"
            disabled={!selectedAgentForTransfer}
            sx={{ bgcolor: '#ff9800' }}
          >
            Transferir
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AgentChatsModule;
