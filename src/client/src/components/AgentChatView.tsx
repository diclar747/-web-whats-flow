import React, { useState, useEffect } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  Badge,
  CircularProgress,
  Paper,
  Chip,
  Alert
} from '@mui/material';
import { PersonPin as AgentIcon } from '@mui/icons-material';
import { getAPIBaseURL } from '../utils/socketConfig';

interface AgentChat {
  chat_jid: string;
  session_id: string;
  status: string;
  assigned_at: string;
  notes: string;
  chat_name: string;
  phone_number: string;
  last_message: string;
  last_message_timestamp: string;
  unread_count: number;
}

interface AgentChatViewProps {
  userId: string;
  sessionId: string;
  onChatSelect: (chatJid: string) => void;
}

const AgentChatView: React.FC<AgentChatViewProps> = ({ 
  userId, 
  sessionId,
  onChatSelect 
}) => {
  const [assignedChats, setAssignedChats] = useState<AgentChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAssignedChats();
    
    // Recargar cada 30 segundos
    const interval = setInterval(loadAssignedChats, 30000);
    return () => clearInterval(interval);
  }, [userId, sessionId]);

  const loadAssignedChats = async () => {
    try {
      const API_BASE = getAPIBaseURL();
      const response = await fetch(
        `${API_BASE}/api/agent/${userId}/chats?sessionId=${sessionId}`
      );
      const data = await response.json();
      
      if (data.success) {
        setAssignedChats(data.chats || []);
        console.log(`✅ ${data.chats?.length || 0} chats asignados cargados`);
      } else {
        setError(data.error || 'Error al cargar chats');
      }
    } catch (err) {
      console.error('Error cargando chats asignados:', err);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (assignedChats.length === 0) {
    return (
      <Box 
        display="flex" 
        flexDirection="column"
        justifyContent="center" 
        alignItems="center" 
        height="400px"
        gap={2}
      >
        <AgentIcon sx={{ fontSize: 80, color: 'text.secondary' }} />
        <Typography variant="h6" color="text.secondary">
          No tienes chats asignados
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Espera a que un administrador te asigne conversaciones
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Paper elevation={2} sx={{ mb: 2, p: 2, bgcolor: 'primary.50' }}>
        <Box display="flex" alignItems="center" gap={2}>
          <AgentIcon color="primary" />
          <Box>
            <Typography variant="h6">
              Mis Chats Asignados
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {assignedChats.length} conversación{assignedChats.length !== 1 ? 'es' : ''} activa{assignedChats.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Box>
      </Paper>

      <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
        {assignedChats.map((chat) => (
          <ListItem
            key={chat.chat_jid}
            disablePadding
            sx={{
              borderBottom: '1px solid',
              borderColor: 'divider'
            }}
          >
            <ListItemButton onClick={() => onChatSelect(chat.chat_jid)}>
              <ListItemAvatar>
                <Badge
                  badgeContent={chat.unread_count || 0}
                  color="error"
                  max={99}
                >
                  <Avatar>
                    {(chat.chat_name || chat.phone_number || '?').charAt(0).toUpperCase()}
                  </Avatar>
                </Badge>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body1" fontWeight={chat.unread_count ? 'bold' : 'normal'}>
                      {chat.chat_name || chat.phone_number || 'Sin nombre'}
                    </Typography>
                    <Chip 
                      label="Asignado"
                      size="small"
                      color="success"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
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
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {chat.last_message || 'No hay mensajes'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Asignado: {new Date(chat.assigned_at).toLocaleDateString()}
                    </Typography>
                  </Box>
                }
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default AgentChatView;
