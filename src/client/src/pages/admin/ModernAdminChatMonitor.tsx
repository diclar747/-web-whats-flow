import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
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
  InputAdornment,
  ListItemButton,
  Stack,
  CircularProgress,
  Button
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Search as SearchIcon,
  Check as CheckIcon,
  DoneAll as DoneAllIcon,
  Schedule as ScheduleIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  InsertDriveFile as FileIcon,
  Headset as HeadphonesIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useSocket } from '../../context/SocketContext';
import { format } from 'date-fns';
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
  agent_name?: string | null;
  agent_avatar?: string | null;
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
  agent_avatar?: string | null;
  contactName?: string;
  avatar?: string | null;
  file_name?: string;
  mime_type?: string;
}

const AudioPlayer: React.FC<{ url: string }> = ({ url }) => {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (playing) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setPlaying(!playing);
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: 'rgba(0,0,0,0.1)', borderRadius: 2, minWidth: 200 }}>
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} />
      <IconButton size="small" onClick={togglePlay} sx={{ color: 'white' }}>
        {playing ? <PauseIcon /> : <PlayIcon />}
      </IconButton>
      <Box sx={{ flex: 1 }}>
        <Box sx={{ height: 4, bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 2, position: 'relative' }}>
          <Box sx={{ position: 'absolute', height: '100%', width: '30%', bgcolor: '#25d366', borderRadius: 2 }} />
        </Box>
      </Box>
      <HeadphonesIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.5)' }} />
    </Box>
  );
};

const ModernAdminChatMonitor: React.FC = () => {
  const { on, off, isConnected } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'sent' | 'received' | 'statuses'>('all');
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const sessionId = (typeof window !== 'undefined' ? (sessionStorage.getItem('whinsap_session') || localStorage.getItem('whinsap_session')) : '') || '';
  const [unreadByChat, setUnreadByChat] = useState<Record<string, number>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);

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

  // Load initial chats and their recent messages
  const loadInitialData = async () => {
    try {
      if (!sessionId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      // Load all chats first
      const chatsRes = await fetch(`${getAPIBaseURL()}/api/chats/${sessionId}?includeGroups=false`);
      const chatsData = await chatsRes.json();

      if (chatsData?.success && Array.isArray(chatsData.chats)) {
        // Build unread counts map
        const unreadMap: Record<string, number> = {};
        for (const c of chatsData.chats) {
          unreadMap[c.id] = typeof c.unreadCount === 'number' ? c.unreadCount : 0;
        }
        setUnreadByChat(unreadMap);

        // Load recent messages for each chat (limit to last 20 messages per chat)
        const allMessages: Message[] = [];
        const chatPromises = chatsData.chats.slice(0, 50).map(async (chat: any) => {
          try {
            const msgRes = await fetch(`${getAPIBaseURL()}/api/messages/${sessionId}/${chat.id}?dateFilter=today&limit=50`);
            const msgData = await msgRes.json();

            if (msgData?.success && Array.isArray(msgData.messages)) {
              msgData.messages.forEach((msg: any) => {
                allMessages.push({
                  id: msg.id?.toString() || msg.message_id?.toString() || `${Date.now()}-${Math.random()}`,
                  chatJid: chat.id,
                  senderJid: msg.sender_jid || msg.senderJid,
                  message: msg.text_content || msg.message || msg.body,
                  text_content: msg.text_content || msg.message || msg.body,
                  timestamp: msg.timestamp || msg.created_at || new Date().toISOString(),
                  isFromMe: msg.from_me || msg.isFromMe || false,
                  from_me: msg.from_me || msg.isFromMe || false,
                  status: msg.status || (msg.from_me ? 'sent' : 'received'),
                  message_type: msg.message_type || msg.type,
                  media_url: msg.media_url || msg.mediaUrl,
                  agent_id: msg.agent_id ?? null,
                  agent_name: msg.agent_name ?? null,
                  agent_avatar: msg.agent_avatar || msg.agentAvatar || null,
                  contactName: chat.name || msg.contact_name,
                  avatar: chat.avatar || msg.avatar_url,
                  file_name: msg.file_name,
                  mime_type: msg.mime_type
                });
              });
            }
          } catch (err) {
            console.error(`Error loading messages for chat ${chat.id}:`, err);
          }
        });

        await Promise.all(chatPromises);

        // Sort all messages by timestamp (newest first)
        allMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        setMessages(allMessages);
        setInitialDataLoaded(true);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading initial monitoring data:', error);
      setLoading(false);
    }
  };

  // Load initial data on mount
  useEffect(() => {
    loadInitialData();
  }, [sessionId]);

  useEffect(() => {
    if (!initialDataLoaded) return;

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
        agent_avatar: data.agent_avatar || data.agentAvatar || null,
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
  }, [on, off, initialDataLoaded]);

  useEffect(() => {
    if (selectedChat) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, selectedChat]);

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

      if (msg.from_me || msg.isFromMe) {
        if (msg.status === 'pending') existing.pendingCount = (existing.pendingCount || 0) + 1;
        else if (msg.status === 'sent') existing.sentCount = (existing.sentCount || 0) + 1;
        else if (msg.status === 'delivered') existing.deliveredCount = (existing.deliveredCount || 0) + 1;
        else if (msg.status === 'read') existing.readCount = (existing.readCount || 0) + 1;
      } else {
        existing.receivedCount = (existing.receivedCount || 0) + 1;
      }

      if (msg.agent_name && !existing.agent_name) {
        existing.agent_name = msg.agent_name;
        existing.agent_avatar = msg.agent_avatar;
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
    if (selectedChat) {
      filtered = filtered.filter(m => m.chatJid === selectedChat);
    }
    filtered = filtered.filter(m => {
      if (tab === 'sent' && !(m.from_me || m.isFromMe)) return false;
      if (tab === 'received' && (m.from_me || m.isFromMe)) return false;
      if (tab === 'statuses') return false;
      return true;
    });
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

  const getStatusIcon = (status: string | undefined, fromMe: boolean) => {
    if (!fromMe) return null;
    switch (status) {
      case 'pending': return <ScheduleIcon sx={{ fontSize: 13, color: '#8696a0' }} />;
      case 'sent': return <CheckIcon sx={{ fontSize: 13, color: '#8696a0' }} />;
      case 'delivered': return <DoneAllIcon sx={{ fontSize: 13, color: '#8696a0' }} />;
      case 'read': return <DoneAllIcon sx={{ fontSize: 13, color: '#53bdeb' }} />;
      default: return <ScheduleIcon sx={{ fontSize: 13, color: '#8696a0' }} />;
    }
  };

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
    green: '#25d366',
    premium: '#10b981'
  };

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 80px)', bgcolor: colors.background, borderRadius: '12px', overflow: 'hidden', border: `1px solid ${colors.divider}` }}>
      {/* ============== LISTA DE CHATS ============== */}
      <Box sx={{ width: 450, bgcolor: colors.chatListBg, borderRight: `1px solid ${colors.divider}`, display: 'flex', flexDirection: 'column' }}>
        {/* Header Monitoring */}
        <Box sx={{ p: 2, bgcolor: colors.headerBg }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
            <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: colors.premium, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 15px ${alpha(colors.premium, 0.4)}` }}>
              <VisibilityIcon sx={{ color: 'white' }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 800 }}>Gestión de Chats</Typography>
              <Typography variant="caption" sx={{ color: colors.green, fontWeight: 600 }}>{chats.length} chat(s) activo(s)</Typography>
            </Box>
            <IconButton
              size="small"
              onClick={loadInitialData}
              disabled={loading}
              sx={{ color: colors.textSecondary }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Stack>

          <TextField
            fullWidth
            size="small"
            placeholder="Buscar por número o mensaje..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: '#2a3942',
                color: colors.text,
                borderRadius: '8px',
                '& fieldset': { borderColor: 'transparent' },
                '&:hover fieldset': { borderColor: 'transparent' },
                '&.Mui-focused fieldset': { borderColor: colors.green },
                '& input::placeholder': { color: colors.textSecondary, opacity: 1 }
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: colors.textSecondary, fontSize: 18 }} />
                </InputAdornment>
              )
            }}
          />
        </Box>

        {/* Lista Scrollable */}
        <List sx={{ flex: 1, overflow: 'auto', p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
              <CircularProgress size={40} sx={{ color: colors.premium }} />
            </Box>
          ) : chats.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1 }}>
                Sin chats activos
              </Typography>
              <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                Los chats aparecerán aquí en tiempo real
              </Typography>
            </Box>
          ) : chats.map((chat) => {
            const isSelected = selectedChat === chat.id;
            return (
              <React.Fragment key={chat.id}>
                <ListItemButton
                  selected={isSelected}
                  onClick={() => setSelectedChat(isSelected ? null : chat.id)}
                  sx={{
                    py: 2.5,
                    px: 3,
                    bgcolor: isSelected ? alpha(colors.premium, 0.08) : 'transparent',
                    borderLeft: isSelected ? `4px solid ${colors.premium}` : '4px solid transparent',
                    '&:hover': { bgcolor: colors.hover }
                  }}
                >
                  <ListItemAvatar>
                    <Badge
                      badgeContent={chat.unreadCount || 0}
                      color="error"
                      sx={{ '& .MuiBadge-badge': { bgcolor: colors.green, color: 'white' } }}
                    >
                      <Avatar src={chat.avatar || undefined} sx={{ width: 54, height: 54, border: `2px solid ${colors.divider}` }}>
                        {(chat.name || chat.id)?.[0]?.toUpperCase()}
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>

                  <ListItemText
                    sx={{ ml: 1.5 }}
                    primary={
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                        <Typography variant="subtitle2" sx={{ color: colors.text, fontWeight: 700 }}>
                          {chat.name || chat.id.split('@')[0]}
                        </Typography>
                        <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                          {chat.updatedAt ? format(new Date(chat.updatedAt), 'HH:mm', { locale: es }) : ''}
                        </Typography>
                      </Stack>
                    }
                    secondary={
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                          {chat.agent_name ? (
                            <Chip
                              avatar={<Avatar src={chat.agent_avatar || undefined} sx={{ width: 14, height: 14 }} />}
                              label={`Agente: ${chat.agent_name}`}
                              size="small"
                              sx={{ height: 20, fontSize: '0.7rem', bgcolor: alpha(colors.premium, 0.1), color: colors.premium, border: `1px solid ${alpha(colors.premium, 0.2)}` }}
                            />
                          ) : (
                            <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.7rem' }}>Sin agente asignado</Typography>
                          )}
                        </Stack>
                        <Typography variant="body2" sx={{ color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mb: 1.5, fontSize: '0.8rem' }}>
                          {chat.lastMessage || 'Sin mensajes'}
                        </Typography>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap">
                          {chat.sentCount! > 0 && <Chip label={`⬆ ${chat.sentCount}`} size="small" sx={{ height: 18, fontSize: 10, bgcolor: alpha(colors.premium, 0.1), color: colors.premium }} />}
                          {chat.receivedCount! > 0 && <Chip label={`⬇ ${chat.receivedCount}`} size="small" sx={{ height: 18, fontSize: 10, bgcolor: alpha('#2196f3', 0.1), color: '#2196f3' }} />}
                          {chat.readCount! > 0 && <Chip label={`✔✔ ${chat.readCount}`} size="small" sx={{ height: 18, fontSize: 10, bgcolor: alpha('#53bdeb', 0.1), color: '#53bdeb' }} />}
                          {chat.deliveredCount! > 0 && <Chip label={`✔ ${chat.deliveredCount}`} size="small" sx={{ height: 18, fontSize: 10, bgcolor: alpha('#8696a0', 0.1), color: '#8696a0' }} />}
                        </Stack>
                      </Box>
                    }
                  />
                </ListItemButton>
                <Divider sx={{ bgcolor: colors.divider }} />
              </React.Fragment>
            );
          })}
        </List>
      </Box>

      {/* ============== ÁREA DE CHAT ============== */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ bgcolor: colors.headerBg, borderBottom: `1px solid ${colors.divider}` }}>
          <Tabs
            value={['all', 'sent', 'received', 'statuses'].indexOf(tab)}
            onChange={(_, i) => setTab(['all', 'sent', 'received', 'statuses'][i] as any)}
            sx={{
              '& .MuiTab-root': { color: colors.textSecondary, fontWeight: 600, fontSize: '0.8rem' },
              '& .MuiTab-root.Mui-selected': { color: colors.premium },
              '& .MuiTabs-indicator': { backgroundColor: colors.premium }
            }}
          >
            <Tab label="Todos los Mensajes" />
            <Tab label="Enviados" />
            <Tab label="Recibidos" />
            <Tab label="Estado de Línea" />
          </Tabs>
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto', p: 3, bgcolor: colors.chatBg, backgroundImage: 'url("https://w7.pngwing.com/pngs/351/975/png-transparent-whatsapp-pattern-whatsapp-pattern-thumbnail.png")', backgroundOpacity: 0.1 }}>
          {tab === 'statuses' ? (
            <StatusList sessionId={sessionId} />
          ) : (
            <Stack spacing={2.5}>
              {filteredMessages.map((m) => {
                const isMe = !!(m.from_me || m.isFromMe);
                return (
                  <Box key={m.id} sx={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '70%', position: 'relative' }}>
                    {/* Agent Tooltip/Header */}
                    {isMe && m.agent_name && (
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5, justifyContent: 'flex-end' }}>
                        <Typography variant="caption" sx={{ color: colors.premium, fontWeight: 700 }}>{m.agent_name}</Typography>
                        <Avatar src={m.agent_avatar || undefined} sx={{ width: 18, height: 18, border: `1px solid ${colors.premium}` }}>
                          <PersonIcon sx={{ fontSize: 10 }} />
                        </Avatar>
                      </Stack>
                    )}

                    <Paper
                      elevation={1}
                      sx={{
                        p: 1.5,
                        bgcolor: isMe ? colors.myMessage : colors.theirMessage,
                        color: colors.text,
                        borderRadius: isMe ? '15px 15px 3px 15px' : '15px 15px 15px 3px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                        position: 'relative'
                      }}
                    >
                      {/* Media Rendering */}
                      {m.media_url && (
                        <Box sx={{ mb: 1, borderRadius: 1, overflow: 'hidden' }}>
                          {(m.message_type === 'image' || m.mime_type?.startsWith('image/')) ? (
                            <Box component="img" src={m.media_url} sx={{ width: '100%', maxHeight: 300, objectFit: 'cover', cursor: 'pointer' }} onClick={() => window.open(m.media_url!, '_blank')} />
                          ) : (m.message_type === 'video' || m.mime_type?.startsWith('video/')) ? (
                            <Box component="video" src={m.media_url} controls sx={{ width: '100%', maxHeight: 300 }} />
                          ) : (m.message_type === 'audio' || m.message_type === 'ptt' || m.mime_type?.startsWith('audio/')) ? (
                            <AudioPlayer url={m.media_url} />
                          ) : (
                            <Button startIcon={<FileIcon />} variant="outlined" size="small" sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.2)' }} onClick={() => window.open(m.media_url!, '_blank')}>
                              {m.file_name || 'Descargar Archivo'}
                            </Button>
                          )}
                        </Box>
                      )}

                      <Typography variant="body2" sx={{ fontSize: '0.95rem', whiteSpace: 'pre-wrap', mb: 0.5 }}>{m.text_content || m.message}</Typography>

                      <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                        <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: 10 }}>{format(new Date(m.timestamp), 'HH:mm', { locale: es })}</Typography>
                        {getStatusIcon(m.status, isMe)}
                      </Stack>
                    </Paper>
                  </Box>
                );
              })}
              <div ref={messagesEndRef} />
            </Stack>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default ModernAdminChatMonitor;
