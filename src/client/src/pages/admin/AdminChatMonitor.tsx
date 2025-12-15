import React, { useEffect, useMemo, useState } from 'react';
import { Box, Paper, Typography, List, ListItem, ListItemText, ListItemAvatar, Avatar, Chip, Divider, TextField, Tabs, Tab, Badge } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useSocket } from '../../context/SocketContext';
import { formatDistanceToNow } from 'date-fns';
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
}

const AdminChatMonitor: React.FC = () => {
  const { on, off, isConnected } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'sent' | 'received' | 'statuses'>('all');
  const sessionId = (typeof window !== 'undefined' ? (sessionStorage.getItem('whatsflow_session') || localStorage.getItem('whatsflow_session')) : '') || '';
  const [unreadByChat, setUnreadByChat] = useState<Record<string, number>>({});

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
        avatar: data.avatar || data.avatar_url
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
    on('transfer-response', (data: any) => {
      const payload: Message = {
        id: `transfer-response-${data.chatJid}-${data.timestamp || Date.now()}`,
        chatJid: data.chatJid,
        message: data.message,
        text_content: data.message,
        timestamp: data.timestamp || new Date().toISOString(),
        from_me: false,
        isFromMe: false,
        status: 'received',
        agent_id: data.agentId ?? null,
        agent_name: data.agentName ?? null,
        contactName: data.chatName,
        avatar: null,
        message_type: 'notification'
      };
      setMessages(prev => [payload, ...prev].slice(0, 5000));
    });
    on('conversation-status-changed', (data: any) => {
      const payload: Message = {
        id: `conversation-status-${data.chatJid}-${Date.now()}`,
        chatJid: data.chatJid,
        message: `Conversación ${data.status} por agente ${data.agentId}`,
        text_content: `Conversación ${data.status} por agente ${data.agentId}`,
        timestamp: new Date().toISOString(),
        from_me: false,
        isFromMe: false,
        status: 'received',
        agent_id: data.agentId ?? null,
        agent_name: undefined,
        contactName: undefined,
        avatar: null,
        message_type: 'notification'
      };
      setMessages(prev => [payload, ...prev].slice(0, 5000));
    });

    return () => {
      off('message');
      off('message:received');
      off('message-sent');
      off('chat:transferred');
      off('transfer-response');
      off('conversation-status-changed');
    };
  }, [on, off]);

  const chats: ChatItem[] = useMemo(() => {
    const map = new Map<string, ChatItem>();
    for (const msg of messages) {
      const id = msg.chatJid;
      const existing = map.get(id);
      const text = msg.text_content || msg.message || '';
      const updated: ChatItem = {
        id,
        name: msg.contactName || id?.split('@')[0],
        avatar: msg.avatar || null,
        lastMessage: text.substring(0, 80),
        unreadCount: unreadByChat[id] || 0,
        updatedAt: msg.timestamp
      };
      map.set(id, { ...(existing || {}), ...updated });
    }
    return Array.from(map.values()).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }, [messages, unreadByChat]);

  const filteredMessages = useMemo(() => {
    return messages.filter(m => {
      if (tab === 'sent' && !(m.from_me || m.isFromMe)) return false;
      if (tab === 'received' && (m.from_me || m.isFromMe)) return false;
      if (tab === 'statuses') return false;
      const text = (m.text_content || m.message || '').toLowerCase();
      const jid = (m.chatJid || '').toLowerCase();
      const agent = (m.agent_name || '').toLowerCase();
      return !search || text.includes(search.toLowerCase()) || jid.includes(search.toLowerCase()) || agent.includes(search.toLowerCase());
    });
  }, [messages, search, tab]);

  return (
    <Box sx={{ display: 'flex', gap: 2, p: 2 }}>
      <Box sx={{ width: 360 }}>
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold' }}>
          Chats en tiempo real {isConnected ? '· Conectado' : '· Desconectado'}
        </Typography>
        <Paper
          variant="outlined"
          sx={theme => ({
            bgcolor: theme.palette.background.paper,
            borderColor: theme.palette.divider
          })}
        >
          <List dense>
            {chats.map(chat => (
              <React.Fragment key={chat.id}>
                <ListItem>
                  <ListItemAvatar>
                    <Badge
                      color="primary"
                      badgeContent={chat.unreadCount || 0}
                      max={99}
                      invisible={!chat.unreadCount || chat.unreadCount === 0}
                      sx={{
                        '& .MuiBadge-badge': {
                          backgroundColor: '#25d366',
                          color: 'white',
                          minWidth: 20,
                          height: 20,
                          fontWeight: 700
                        }
                      }}
                    >
                      <Avatar src={chat.avatar || undefined}>{(chat.name || chat.id)?.[0]}</Avatar>
                    </Badge>
                  </ListItemAvatar>
                  <ListItemText
                    primary={chat.name || chat.id}
                    secondary={`${chat.lastMessage || ''} · ${chat.updatedAt ? formatDistanceToNow(new Date(chat.updatedAt), { locale: es }) : ''}`}
                  />
                </ListItem>
                <Divider />
              </React.Fragment>
            ))}
            {chats.length === 0 && (
              <ListItem>
                <ListItemText primary="Sin actividad reciente" secondary="Conecte WhatsApp para iniciar el monitoreo" />
              </ListItem>
            )}
          </List>
        </Paper>
      </Box>

      <Box sx={{ flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Tabs
            value={['all', 'sent', 'received', 'statuses'].indexOf(tab)}
            onChange={(_, i) => setTab((['all', 'sent', 'received', 'statuses'] as any)[i])}
            variant="scrollable"
            scrollButtons="auto"
            sx={theme => ({
              '& .MuiTab-root': {
                color: theme.palette.text.secondary
              },
              '& .MuiTab-root.Mui-selected': {
                color: theme.palette.primary.light
              },
              '& .MuiTabs-indicator': {
                backgroundColor: theme.palette.primary.main
              }
            })}
          >
            <Tab label="Todos" />
            <Tab label="Enviados" />
            <Tab label="Recibidos" />
            <Tab label="Estados" />
          </Tabs>
          <TextField
            size="small"
            placeholder="Buscar mensaje, JID o agente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            sx={{ ml: 'auto', width: 360 }}
          />
        </Box>
        <Paper
          variant="outlined"
          sx={theme => ({
            p: 2,
            minHeight: 520,
            bgcolor: theme.palette.background.paper,
            borderColor: theme.palette.divider
          })}
        >
          {tab === 'statuses' ? (
            <Box sx={{ minHeight: 480 }}>
              {sessionId ? (
                <StatusList sessionId={sessionId} />
              ) : (
                <Typography color="text.secondary">Sin sesión activa para cargar estados.</Typography>
              )}
            </Box>
          ) : (
            <>
              {filteredMessages.length === 0 ? (
                <Typography color="text.secondary">No hay mensajes para mostrar.</Typography>
              ) : (
                <List dense>
                  {filteredMessages.map(m => (
                    <React.Fragment key={m.id}>
                      <ListItem alignItems="flex-start">
                        <ListItemAvatar>
                          <Avatar src={m.avatar || undefined}>{(m.contactName || m.chatJid)?.[0]}</Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography sx={{ fontWeight: 'bold' }}>{m.contactName || m.chatJid}</Typography>
                              {m.from_me || m.isFromMe ? (
                                <Chip
                                  size="small"
                                  color="success"
                                  label={m.agent_name ? `Agente: ${m.agent_name}` : 'Agente'}
                                  sx={theme => ({
                                    bgcolor: alpha(theme.palette.success.main, 0.2),
                                    color: theme.palette.success.light,
                                    border: '1px solid',
                                    borderColor: alpha(theme.palette.success.main, 0.4)
                                  })}
                                />
                              ) : (
                                <Chip
                                  size="small"
                                  label="Cliente"
                                  sx={theme => ({
                                    bgcolor: alpha(theme.palette.info.main, 0.18),
                                    color: theme.palette.text.secondary,
                                    border: '1px solid',
                                    borderColor: theme.palette.divider
                                  })}
                                />
                              )}
                              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                                {formatDistanceToNow(new Date(m.timestamp), { locale: es })} atrás
                              </Typography>
                            </Box>
                          }
                          secondary={m.text_content || m.message}
                        />
                      </ListItem>
                      <Divider />
                    </React.Fragment>
                  ))}
                </List>
              )}
            </>
          )}
        </Paper>
      </Box>
    </Box>
  );
};

export default AdminChatMonitor;
