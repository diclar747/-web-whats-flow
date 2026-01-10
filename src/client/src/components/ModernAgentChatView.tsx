import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  AppBar,
  Toolbar,
  Avatar,
  Typography,
  IconButton,
  Badge,
  Tooltip,
  Chip,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  WhatsApp as WhatsAppIcon,
  Logout as LogoutIcon,
  Chat as ChatIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Notifications as NotificationsIcon,
  NotificationsActive as NotificationsActiveIcon,
  Circle as OnlineIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import ModernAgentChatList from './ModernAgentChatList';
import WhatsAppStyleMessages from './WhatsAppStyleMessages';
import MessageInputComponent from './MessageInputComponent';
import CustomConfirmDialog from './CustomConfirmDialog';
import { styled } from '@mui/material/styles';

// ==================== STYLED COMPONENTS ====================

const MainContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  backgroundColor: theme.palette.background.default,
}));

const ContentBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
}));

const ChatListPanel = styled(Box)(({ theme }) => ({
  width: '320px',
  borderRight: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: theme.palette.background.paper,
  
  [theme.breakpoints.down('sm')]: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 10,
    width: '100%',
  },
}));

const ChatViewPanel = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: theme.palette.background.default,
  
  [theme.breakpoints.down('sm')]: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width: '100%',
  },
}));

const HeaderBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#128C7E',
  boxShadow: theme.shadows[2],
}));

// ==================== INTERFACE ====================

interface Chat {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  phoneNumber?: string;
  status?: 'active' | 'closed' | 'transferred' | 'pending';
}

interface Message {
  id: string;
  from_me: boolean;
  text_content?: string;
  timestamp: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'error';
  message_type: 'conversation' | 'image' | 'document' | 'video' | 'audio' | 'ptt';
  media_url?: string;
  media_mime_type?: string;
  caption?: string;
  file_name?: string;
  sender_name?: string;
  sender_avatar?: string;
}

interface ModernAgentChatViewProps {
  agentId?: number;
  userName?: string;
  userAvatar?: string;
  onLogout?: () => void;
}

// ==================== COMPONENTE ====================

const ModernAgentChatView: React.FC<ModernAgentChatViewProps> = ({
  agentId = 0,
  userName = 'Agente',
  userAvatar = '',
  onLogout,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const { isConnected } = useSocket();

  // Estados
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Cargar chats
  const loadChats = useCallback(async () => {
    if (!agentId) return;

    try {
      const token = sessionStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`/api/agents/${agentId}/chats`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success && data.chats) {
        const mappedChats = data.chats.map((chat: any) => ({
          id: chat.chatJid || chat.id,
          name: chat.chatName || chat.name,
          avatar: chat.avatar,
          lastMessage: chat.lastMessage || '',
          timestamp: chat.timestamp || new Date().toISOString(),
          unreadCount: chat.unreadCount || 0,
          phoneNumber: chat.phoneNumber,
          status: chat.status || 'active',
        }));

        setChats(mappedChats);
      }
    } catch (error) {
      console.error('Error cargando chats:', error);
    } finally {
      setLoadingChats(false);
    }
  }, [agentId]);

  // Cargar mensajes del chat seleccionado
  const loadMessages = useCallback(async () => {
    if (!selectedChat || !agentId) return;

    setLoadingMessages(true);
    try {
      const token = sessionStorage.getItem('token');
      if (!token) return;

      const response = await fetch(
        `/api/messages/${sessionStorage.getItem('adminSessionId') || 'session'}/${selectedChat.id}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      const data = await response.json();
      if (data.success && data.messages) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Error cargando mensajes:', error);
    } finally {
      setLoadingMessages(false);
    }
  }, [selectedChat, agentId]);

  // Efectos
  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    loadMessages();
  }, [selectedChat, loadMessages]);

  // Manejar cambio de chat
  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat);
    setMessages([]);
  };

  // Manejar envío de mensaje
  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedChat || !agentId) return;

    try {
      const token = sessionStorage.getItem('token');
      const sessionId = sessionStorage.getItem('adminSessionId');

      if (!token || !sessionId) return;

      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: selectedChat.id,
          message: messageText,
          sessionId,
          agentId,
        }),
      });

      if (response.ok) {
        setMessageText('');
        await loadMessages();
      }
    } catch (error) {
      console.error('Error enviando mensaje:', error);
    }
  };

  // Manejar logout
  const handleLogout = () => {
    setConfirmDialog({
      open: true,
      title: '¿Cerrar sesión?',
      message: '¿Estás seguro de que deseas cerrar sesión?',
      onConfirm: () => {
        sessionStorage.clear();
        localStorage.clear();
        if (onLogout) onLogout();
        navigate('/login');
      },
    });
  };

  return (
    <MainContainer>
      {/* Header */}
      <HeaderBar position="static">
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
          {/* Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WhatsAppIcon sx={{ color: 'white', fontSize: 28 }} />
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>
              Winsap
            </Typography>
          </Box>

          {/* Controles */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Status de conexión */}
            <Tooltip title={isConnected ? 'Conectado' : 'Desconectado'}>
              <OnlineIcon
                sx={{
                  fontSize: 14,
                  color: isConnected ? '#4caf50' : '#f44336',
                  animation: isConnected ? 'none' : 'pulse 1.5s infinite',
                }}
              />
            </Tooltip>

            {/* Sonido */}
            <Tooltip title={soundEnabled ? 'Sonido activado' : 'Sonido desactivado'}>
              <IconButton
                size="small"
                onClick={() => setSoundEnabled(!soundEnabled)}
                sx={{ color: 'white' }}
              >
                {soundEnabled ? <NotificationsActiveIcon /> : <NotificationsIcon />}
              </IconButton>
            </Tooltip>

            {/* Tema */}
            <Tooltip title={darkMode ? 'Modo claro' : 'Modo oscuro'}>
              <IconButton
                size="small"
                onClick={() => setDarkMode(!darkMode)}
                sx={{ color: 'white' }}
              >
                {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>

            {/* Avatar y nombre */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
              <Avatar
                src={userAvatar}
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: '#ffffff',
                  color: '#128C7E',
                  fontWeight: 700,
                }}
              >
                {!userAvatar && (userName?.[0]?.toUpperCase() || 'A')}
              </Avatar>
              <Typography variant="body2" sx={{ color: 'white', minWidth: 100 }}>
                {userName}
              </Typography>
            </Box>

            {/* Logout */}
            <Tooltip title="Cerrar sesión">
              <IconButton
                onClick={handleLogout}
                sx={{ color: 'white' }}
              >
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </HeaderBar>

      {/* Contenido */}
      <ContentBox>
        {/* Panel de lista de chats */}
        <ChatListPanel sx={{ display: { xs: selectedChat ? 'none' : 'flex', sm: 'flex' } }}>
          <ModernAgentChatList
            chats={chats}
            selectedChat={selectedChat}
            onSelectChat={handleSelectChat}
            loading={loadingChats}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
        </ChatListPanel>

        {/* Panel de vista de chat */}
        {selectedChat ? (
          <ChatViewPanel>
            {/* Header del chat */}
            <Paper
              elevation={0}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 2,
                borderBottom: `1px solid ${theme.palette.divider}`,
                backgroundColor: theme.palette.background.paper,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {isMobile && (
                  <IconButton onClick={() => setSelectedChat(null)}>
                    ← Atrás
                  </IconButton>
                )}
                <Avatar src={selectedChat.avatar} sx={{ width: 40, height: 40 }}>
                  {selectedChat.name?.[0]?.toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {selectedChat.name}
                  </Typography>
                  {selectedChat.phoneNumber && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {selectedChat.phoneNumber}
                    </Typography>
                  )}
                </Box>
              </Box>
              {selectedChat.status && (
                <Chip
                  label={selectedChat.status}
                  size="small"
                  color={selectedChat.status === 'active' ? 'success' : 'default'}
                />
              )}
            </Paper>

            {/* Mensajes */}
            <WhatsAppStyleMessages
              messages={messages}
              chatName={selectedChat.name}
              chatAvatar={selectedChat.avatar}
              loading={loadingMessages}
              currentUserAvatar={userAvatar}
            />

            {/* Input de mensaje */}
            <MessageInputComponent
              messageText={messageText}
              onMessageChange={setMessageText}
              onSend={handleSendMessage}
              disabled={!selectedChat || !isConnected}
            />
          </ChatViewPanel>
        ) : (
          <ChatViewPanel
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.secondary',
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <ChatIcon sx={{ fontSize: 80, mb: 2, opacity: 0.5 }} />
              <Typography variant="h6">Selecciona un chat</Typography>
              <Typography variant="body2">
                para comenzar la conversación
              </Typography>
            </Box>
          </ChatViewPanel>
        )}
      </ContentBox>

      {/* Diálogo de confirmación */}
      <CustomConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog({ ...confirmDialog, open: false });
        }}
        onCancel={() => setConfirmDialog({ ...confirmDialog, open: false })}
      />
    </MainContainer>
  );
};

export default ModernAgentChatView;
