import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Divider,
  TextField,
  Tabs,
  Tab,
  Badge,
  IconButton,
  Tooltip,
  InputAdornment,
  ListItemButton
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Search as SearchIcon,
  Check as CheckIcon,
  DoneAll as DoneAllIcon,
  Schedule as ScheduleIcon,
  Circle as CircleIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  Send as SendIcon,
  GetApp as GetAppIcon,
  Image as ImageIcon,
  Videocam as VideoIcon,
  AudioFile as AudioIcon,
  InsertDriveFile as FileIcon
} from '@mui/icons-material';
import { useSocket } from '../../context/SocketContext';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import StatusList from '../../components/StatusList';
import { getAPIBaseURL } from '../../utils/socketConfig';

interface ChatItem {
  id: string;
  name?: string;
  avatar?: string | null;
  lastMessage?: string;
  unreadCount?: number;
  updatedAt?: string;
  sentCount?: number;
  receivedCount?: number;
  readCount?: number;
  deliveredCount?: number;
  pendingCount?: number;
}

interface Message {
  id: string;
  chatJid: string;
  senderJid?: string;
  message?: string;
  text_content?: string;
  timestamp: string;
  isFromMe?: boolean;
  from_me?: boolean;
  status?: 'pending' | 'sent' | 'delivered' | 'read' | 'received' | 'error';
  message_type?: string;
  media_url?: string | null;
  agent_id?: number | null;
  agent_name?: string | null;
  contactName?: string;
  avatar?: string | null;
  file_name?: string;
  mime_type?: string;
}

const ModernAdminChatMonitor: React.FC = () => {
  const { on, off, isConnected } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'sent' | 'received' | 'statuses'>('all');
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const sessionId = (typeof window !== 'undefined' ? (sessionStorage.getItem('whatsflow_session') || localStorage.getItem('whatsflow_session')) : '') || '';
  const [unreadByChat, setUnreadByChat] = useState<Record<string, number>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const refreshUnreadCounts = async () => {
    try {
      if (!sessionId) return;
      const res = await fetch(`${getAPIBaseURL()}/api/chats/${sessionId}?includeGroups=false`);
      const data = await res.json();
      if (data?.success && Array.isArray(data.chats)) {
        const map: Record<string, number> = {};
        for (const c of data.chats) {
          map[c.id] = typeof c.unreadCount === 'number' ? c.unreadCount : 0;
        }
        setUnreadByChat(map);
      }
    } catch (_e) {
      // silencioso
    }
  };

  useEffect(() => {
    refreshUnreadCounts();
    const handler = (data: any) => {
      const payload: Message = {
        id: data.id?.toString() || `${Date.now()}`,
        chatJid: data.chatJid || data.chat_jid || data.senderJid || data.sender_jid,
        senderJid: data.senderJid || data.sender_jid,
        message: data.message || data.text || data.text_content,
        text_content: data.text_content || data.message,
        timestamp: data.timestamp || new Date().toISOString(),
        isFromMe: typeof data.isFromMe === 'boolean' ? data.isFromMe : !!data.from_me,
        from_me: typeof data.from_me === 'boolean' ? data.from_me : !!data.isFromMe,
        status: data.status,
        message_type: data.message_type,
        media_url: data.media_url,
        agent_id: data.agent_id ?? null,
        agent_name: data.agent_name ?? null,
        contactName: data.contactName || data.contact_name,
        avatar: data.avatar || data.avatar_url,
        file_name: data.file_name,
        mime_type: data.mime_type
      };

      setMessages(prev => {
        if (prev.some(m => m.id === payload.id)) return prev;
        return [payload, ...prev].slice(0, 5000);
      });
      refreshUnreadCounts();
    };

    const handlerReceived = (data: any) => handler({ ...data, status: 'received', from_me: false, isFromMe: false });
    const handlerSent = (data: any) => handler({ ...data, status: 'sent', from_me: true, isFromMe: true });

    on('message', handler);
    on('message:received', handlerReceived);
    on('message-sent', handlerSent);
    on('chat:transferred', (data: any) => {
      const payload: Message = {
        id: `transfer-${data.chatJid}-${data.timestamp || Date.now()}`,
        chatJid: data.chatJid,
        message: data.message || `Chat transferido al agente ${data.agentId}`,
        text_content: data.message || `Chat transferido al agente ${data.agentId}`,
        timestamp: data.timestamp || new Date().toISOString(),
        from_me: false,
        isFromMe: false,
        status: 'received',
        agent_id: data.agentId ?? null,
        agent_name: undefined,
        contactName: data.chatName,
        avatar: data.avatar || null,
        message_type: 'notification'
      };
      setMessages(prev => [payload, ...prev].slice(0, 5000));
    });

    return () => {
      off('message');
      off('message:received');
      off('message-sent');
      off('chat:transferred');
    };
  }, [on, off]);

  // Scroll automático cuando hay nuevo mensaje en chat seleccionado
  useEffect(() => {
    if (selectedChat) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, selectedChat]);

  // Calcular estadísticas por chat
  const chats: ChatItem[] = useMemo(() => {
    const map = new Map<string, ChatItem>();

    for (const msg of messages) {
      const id = msg.chatJid;
      const existing = map.get(id) || {
        id,
        name: msg.contactName || id?.split('@')[0],
        avatar: msg.avatar || null,
        lastMessage: '',
        unreadCount: unreadByChat[id] || 0,
        updatedAt: '',
        sentCount: 0,
        receivedCount: 0,
        readCount: 0,
        deliveredCount: 0,
        pendingCount: 0
      };

      const text = msg.text_content || msg.message || '';

      // Actualizar contadores
      if (msg.from_me || msg.isFromMe) {
        if (msg.status === 'pending') existing.pendingCount = (existing.pendingCount || 0) + 1;
        else if (msg.status === 'sent') existing.sentCount = (existing.sentCount || 0) + 1;
        else if (msg.status === 'delivered') existing.deliveredCount = (existing.deliveredCount || 0) + 1;
        else if (msg.status === 'read') existing.readCount = (existing.readCount || 0) + 1;
      } else {
        existing.receivedCount = (existing.receivedCount || 0) + 1;
      }

      map.set(id, {
        ...existing,
        lastMessage: text.substring(0, 80),
        updatedAt: msg.timestamp
      });
    }

    return Array.from(map.values()).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }, [messages, unreadByChat]);

  const filteredMessages = useMemo(() => {
    let filtered = messages;

    // Filtrar por chat seleccionado
    if (selectedChat) {
      filtered = filtered.filter(m => m.chatJid === selectedChat);
    }

    // Filtrar por tab
    filtered = filtered.filter(m => {
      if (tab === 'sent' && !(m.from_me || m.isFromMe)) return false;
      if (tab === 'received' && (m.from_me || m.isFromMe)) return false;
      if (tab === 'statuses') return false;
      return true;
    });

    // Filtrar por búsqueda
    if (search) {
      filtered = filtered.filter(m => {
        const text = (m.text_content || m.message || '').toLowerCase();
        const jid = (m.chatJid || '').toLowerCase();
        const agent = (m.agent_name || '').toLowerCase();
        return text.includes(search.toLowerCase()) || jid.includes(search.toLowerCase()) || agent.includes(search.toLowerCase());
      });
    }

    return filtered;
  }, [messages, search, tab, selectedChat]);

  // Renderizar íconos de estado
  const getStatusIcon = (status: string | undefined, fromMe: boolean) => {
    if (!fromMe) return null;

    switch (status) {
      case 'pending':
        return <ScheduleIcon sx={{ fontSize: 14, color: '#8696a0' }} />;
      case 'sent':
        return <CheckIcon sx={{ fontSize: 14, color: '#8696a0' }} />;
      case 'delivered':
        return <DoneAllIcon sx={{ fontSize: 14, color: '#8696a0' }} />;
      case 'read':
        return <DoneAllIcon sx={{ fontSize: 14, color: '#53bdeb' }} />;
      default:
        return <ScheduleIcon sx={{ fontSize: 14, color: '#8696a0' }} />;
    }
  };

  // Renderizar ícono de multimedia
  const getMediaIcon = (messageType: string | undefined, mimeType: string | undefined) => {
    if (messageType === 'image' || mimeType?.startsWith('image/')) {
      return <ImageIcon sx={{ fontSize: 16, mr: 0.5 }} />;
    } else if (messageType === 'video' || mimeType?.startsWith('video/')) {
      return <VideoIcon sx={{ fontSize: 16, mr: 0.5 }} />;
    } else if (messageType === 'audio' || messageType === 'ptt' || mimeType?.startsWith('audio/')) {
      return <AudioIcon sx={{ fontSize: 16, mr: 0.5 }} />;
    } else if (messageType === 'document') {
      return <FileIcon sx={{ fontSize: 16, mr: 0.5 }} />;
    }
    return null;
  };

  // Colores tema WhatsApp
  const colors = {
    background: '#0b141a',
    chatListBg: '#111b21',
    chatBg: '#0b141a',
    headerBg: '#202c33',
    myMessage: '#005c4b',
    theirMessage: '#202c33',
    text: '#e9edef',
    textSecondary: '#8696a0',
    divider: '#2a3942',
    hover: '#2a3942',
    selected: '#2a3942',
    green: '#25d366'
  };

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 100px)', bgcolor: colors.background }}>
      {/* ============== LISTA DE CHATS ============== */}
      <Box
        sx={{
          width: 420,
          bgcolor: colors.chatListBg,
          borderRight: `1px solid ${colors.divider}`,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <Box sx={{ p: 2, bgcolor: colors.headerBg }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ color: colors.text, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <VisibilityIcon />
              Monitoreo de Chats
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title={isConnected ? 'Conectado' : 'Desconectado'}>
                <CircleIcon sx={{ fontSize: 12, color: isConnected ? colors.green : '#f44336' }} />
              </Tooltip>
              <Tooltip title="Refrescar">
                <IconButton size="small" onClick={refreshUnreadCounts} sx={{ color: colors.textSecondary }}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Búsqueda */}
          <TextField
            fullWidth
            size="small"
            placeholder="Buscar chat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: '#2a3942',
                color: colors.text,
                borderRadius: 2,
                '& fieldset': { borderColor: 'transparent' },
                '&:hover fieldset': { borderColor: 'transparent' },
                '&.Mui-focused fieldset': { borderColor: '#00a884' },
                '& input::placeholder': { color: colors.textSecondary, opacity: 1 }
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: colors.textSecondary, fontSize: 20 }} />
                </InputAdornment>
              )
            }}
          />
        </Box>

        {/* Lista de chats */}
        <List
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 0,
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: colors.divider,
              borderRadius: '3px'
            }
          }}
        >
          {chats.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center', color: colors.textSecondary }}>
              <Typography variant="body2">Sin actividad reciente</Typography>
              <Typography variant="caption">Los chats aparecerán aquí en tiempo real</Typography>
            </Box>
          ) : (
            chats.map((chat) => {
              const isSelected = selectedChat === chat.id;

              return (
                <React.Fragment key={chat.id}>
                  <ListItemButton
                    selected={isSelected}
                    onClick={() => setSelectedChat(isSelected ? null : chat.id)}
                    sx={{
                      py: 2,
                      px: 2,
                      bgcolor: isSelected ? colors.selected : 'transparent',
                      '&:hover': { bgcolor: colors.hover }
                    }}
                  >
                    <ListItemAvatar>
                      <Badge
                        badgeContent={chat.unreadCount || 0}
                        color="error"
                        max={99}
                        sx={{
                          '& .MuiBadge-badge': {
                            bgcolor: colors.green,
                            color: 'white',
                            fontWeight: 600
                          }
                        }}
                      >
                        <Avatar src={chat.avatar || undefined} sx={{ width: 48, height: 48, bgcolor: '#00a884' }}>
                          {(chat.name || chat.id)?.[0]?.toUpperCase()}
                        </Avatar>
                      </Badge>
                    </ListItemAvatar>

                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                          <Typography variant="subtitle2" sx={{ color: colors.text, fontWeight: 600 }}>
                            {chat.name || chat.id.split('@')[0]}
                          </Typography>
                          {chat.updatedAt && (
                            <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: 11 }}>
                              {format(new Date(chat.updatedAt), 'HH:mm', { locale: es })}
                            </Typography>
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography
                            variant="body2"
                            sx={{
                              color: colors.textSecondary,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontSize: 13,
                              mb: 1
                            }}
                          >
                            {chat.lastMessage || 'Sin mensajes'}
                          </Typography>

                          {/* Badges de estadísticas */}
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {(chat.sentCount || 0) > 0 && (
                              <Chip
                                size="small"
                                icon={<SendIcon sx={{ fontSize: 12 }} />}
                                label={`${chat.sentCount}`}
                                sx={{
                                  height: 20,
                                  fontSize: 10,
                                  bgcolor: alpha('#00a884', 0.2),
                                  color: '#00a884',
                                  border: '1px solid',
                                  borderColor: alpha('#00a884', 0.3),
                                  '& .MuiChip-icon': { ml: 0.5 },
                                  '& .MuiChip-label': { px: 0.5 }
                                }}
                              />
                            )}
                            {(chat.receivedCount || 0) > 0 && (
                              <Chip
                                size="small"
                                icon={<GetAppIcon sx={{ fontSize: 12 }} />}
                                label={`${chat.receivedCount}`}
                                sx={{
                                  height: 20,
                                  fontSize: 10,
                                  bgcolor: alpha('#2196f3', 0.2),
                                  color: '#2196f3',
                                  border: '1px solid',
                                  borderColor: alpha('#2196f3', 0.3),
                                  '& .MuiChip-icon': { ml: 0.5 },
                                  '& .MuiChip-label': { px: 0.5 }
                                }}
                              />
                            )}
                            {(chat.readCount || 0) > 0 && (
                              <Chip
                                size="small"
                                icon={<DoneAllIcon sx={{ fontSize: 12 }} />}
                                label={`${chat.readCount}`}
                                sx={{
                                  height: 20,
                                  fontSize: 10,
                                  bgcolor: alpha('#53bdeb', 0.2),
                                  color: '#53bdeb',
                                  border: '1px solid',
                                  borderColor: alpha('#53bdeb', 0.3),
                                  '& .MuiChip-icon': { ml: 0.5 },
                                  '& .MuiChip-label': { px: 0.5 }
                                }}
                              />
                            )}
                            {(chat.deliveredCount || 0) > 0 && (
                              <Chip
                                size="small"
                                icon={<DoneAllIcon sx={{ fontSize: 12 }} />}
                                label={`${chat.deliveredCount}`}
                                sx={{
                                  height: 20,
                                  fontSize: 10,
                                  bgcolor: alpha('#8696a0', 0.2),
                                  color: '#8696a0',
                                  border: '1px solid',
                                  borderColor: alpha('#8696a0', 0.3),
                                  '& .MuiChip-icon': { ml: 0.5 },
                                  '& .MuiChip-label': { px: 0.5 }
                                }}
                              />
                            )}
                            {(chat.pendingCount || 0) > 0 && (
                              <Chip
                                size="small"
                                icon={<ScheduleIcon sx={{ fontSize: 12 }} />}
                                label={`${chat.pendingCount}`}
                                sx={{
                                  height: 20,
                                  fontSize: 10,
                                  bgcolor: alpha('#ff9800', 0.2),
                                  color: '#ff9800',
                                  border: '1px solid',
                                  borderColor: alpha('#ff9800', 0.3),
                                  '& .MuiChip-icon': { ml: 0.5 },
                                  '& .MuiChip-label': { px: 0.5 }
                                }}
                              />
                            )}
                            {(chat.unreadCount || 0) > 0 && (
                              <Chip
                                size="small"
                                label={`${chat.unreadCount}`}
                                sx={{
                                  height: 20,
                                  fontSize: 10,
                                  bgcolor: alpha('#f44336', 0.2),
                                  color: '#f44336',
                                  border: '1px solid',
                                  borderColor: alpha('#f44336', 0.3),
                                  '& .MuiChip-label': { px: 0.5 }
                                }}
                              />
                            )}
                          </Box>
                        </Box>
                      }
                    />
                  </ListItemButton>
                  <Divider sx={{ bgcolor: colors.divider }} />
                </React.Fragment>
              );
            })
          )}
        </List>
      </Box>

      {/* ============== ÁREA DE MENSAJES ============== */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Tabs */}
        <Box sx={{ bgcolor: colors.headerBg, borderBottom: `1px solid ${colors.divider}` }}>
          <Tabs
            value={['all', 'sent', 'received', 'statuses'].indexOf(tab)}
            onChange={(_, i) => setTab(['all', 'sent', 'received', 'statuses'][i] as any)}
            variant="fullWidth"
            sx={{
              '& .MuiTab-root': {
                color: colors.textSecondary,
                textTransform: 'none',
                fontSize: 14,
                fontWeight: 500
              },
              '& .MuiTab-root.Mui-selected': {
                color: '#00a884'
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#00a884'
              }
            }}
          >
            <Tab label="Todos" />
            <Tab label="Enviados" />
            <Tab label="Recibidos" />
            <Tab label="Estados" />
          </Tabs>
        </Box>

        {/* Contenido */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            bgcolor: colors.chatBg,
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg opacity=\'0.03\'%3E%3Cpath d=\'M30 30 L30 15 L15 15 Z\' fill=\'%23ffffff\'/%3E%3C/g%3E%3C/svg%3E")',
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: colors.divider,
              borderRadius: '3px'
            }
          }}
        >
          {tab === 'statuses' ? (
            <Box sx={{ p: 2 }}>
              {sessionId ? (
                <StatusList sessionId={sessionId} />
              ) : (
                <Typography sx={{ color: colors.textSecondary, textAlign: 'center', mt: 4 }}>
                  Sin sesión activa para cargar estados.
                </Typography>
              )}
            </Box>
          ) : filteredMessages.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: colors.textSecondary,
                gap: 2
              }}
            >
              <VisibilityIcon sx={{ fontSize: 80, opacity: 0.3 }} />
              <Typography variant="h6">
                {selectedChat ? 'No hay mensajes' : 'Selecciona un chat'}
              </Typography>
              <Typography variant="body2" sx={{ textAlign: 'center', maxWidth: 400 }}>
                {selectedChat
                  ? 'Los mensajes aparecerán en tiempo real'
                  : 'Haz clic en un chat para ver la actividad'}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ p: 2 }}>
              {filteredMessages.map((m) => (
                <Box
                  key={m.id}
                  sx={{
                    display: 'flex',
                    justifyContent: m.from_me || m.isFromMe ? 'flex-end' : 'flex-start',
                    mb: 1.5
                  }}
                >
                  <Paper
                    sx={{
                      maxWidth: '65%',
                      p: 1.5,
                      bgcolor: (m.from_me || m.isFromMe) ? colors.myMessage : colors.theirMessage,
                      borderRadius: (m.from_me || m.isFromMe) ? '8px 0px 8px 8px' : '0px 8px 8px 8px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
                    }}
                  >
                    {/* Nombre del agente */}
                    {m.agent_name && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#00a884',
                          fontWeight: 600,
                          display: 'block',
                          mb: 0.5
                        }}
                      >
                        {m.agent_name}
                      </Typography>
                    )}

                    {/* Tipo de multimedia */}
                    {(m.message_type && m.message_type !== 'conversation' && m.message_type !== 'text') && (
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, color: colors.text }}>
                        {getMediaIcon(m.message_type, m.mime_type)}
                        <Typography variant="caption">
                          {m.file_name ||
                            (m.message_type === 'image' ? 'Imagen' :
                              m.message_type === 'video' ? 'Video' :
                                m.message_type === 'audio' || m.message_type === 'ptt' ? 'Audio' :
                                  'Archivo')}
                        </Typography>
                      </Box>
                    )}

                    {/* Texto */}
                    {m.text_content || m.message ? (
                      <Typography
                        variant="body2"
                        sx={{
                          color: colors.text,
                          wordBreak: 'break-word',
                          whiteSpace: 'pre-wrap',
                          fontSize: 14
                        }}
                      >
                        {m.text_content || m.message}
                      </Typography>
                    ) : null}

                    {/* Tiempo y estado */}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                      <Typography variant="caption" sx={{ fontSize: 11, color: colors.textSecondary }}>
                        {format(new Date(m.timestamp), 'HH:mm', { locale: es })}
                      </Typography>
                      {getStatusIcon(m.status, m.from_me || m.isFromMe || false)}
                    </Box>
                  </Paper>
                </Box>
              ))}
              <div ref={messagesEndRef} />
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default ModernAdminChatMonitor;
