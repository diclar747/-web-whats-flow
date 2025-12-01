import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
  Avatar,
  Chip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Button,
  Alert,
  Badge,
  LinearProgress
} from '@mui/material';
import { WhatsApp, Group, Refresh } from '@mui/icons-material';
import { getAPIBaseURL } from '../utils/socketConfig';

interface GroupMember {
  jid?: string;
  name?: string;
  notify?: string;
  admin?: boolean;
  is_admin?: boolean;
  owner?: boolean;
}

interface WhatsAppGroup {
  id?: string;
  jid?: string;
  name?: string;
  subject?: string;
  members?: GroupMember[];
  participant_list?: GroupMember[];
  created_at?: string;
  timestamp?: string;
  last_message_time?: string;
  is_online?: boolean;
  unread_count?: number;
  unreadCount?: number;
  isGroup?: boolean;
}

export const WhatsAppGroupsViewer: React.FC = () => {
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadGroups = async () => {
    try {
      setLoading(true);
      setError(null);

      const sessionId = sessionStorage.getItem('sessionId') || localStorage.getItem('sessionId');
      const token = sessionStorage.getItem('token') || localStorage.getItem('token') || '';

      if (!sessionId) {
        setError('No hay sesión activa. Por favor inicia sesión.');
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/chats/${sessionId}?page=1&limit=100`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (!response.ok) {
        throw new Error(`Error en API: ${response.status}`);
      }

      const data = await response.json();
      const chats = data.chats || data || [];

      // Filtrar solo grupos
      const whatsappGroups = chats.filter((chat: WhatsAppGroup) =>
        (chat.id || chat.jid || '').includes('@g.us') || chat.isGroup === true
      );

      setGroups(whatsappGroups);
      setLastUpdate(new Date());
    } catch (err: any) {
      setError(err.message || 'Error al cargar grupos');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
    const interval = setInterval(loadGroups, 30000); // Recargar cada 30 segundos
    return () => clearInterval(interval);
  }, []);

  const getMemberName = (member: any): string => {
    if (typeof member === 'string') {
      return member.split('@')[0];
    }
    return member.name || member.notify || member.jid?.split('@')[0] || 'Usuario';
  };

  const getMemberRole = (member: any): string | null => {
    if (typeof member === 'string') return null;
    if (member.owner) return 'Propietario';
    if (member.admin || member.is_admin) return 'Admin';
    return null;
  };

  const getMemberInitial = (member: any): string => {
    return getMemberName(member).charAt(0).toUpperCase();
  };

  const totalMembers = groups.reduce((sum, group) => {
    return sum + ((group.members?.length || 0) + (group.participant_list?.length || 0));
  }, 0);

  if (loading && groups.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <WhatsApp sx={{ fontSize: 32 }} />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                📱 Mis Grupos de WhatsApp
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Visualización de grupos y miembros en tiempo real
              </Typography>
            </Box>
          </Box>
          <Button
            onClick={loadGroups}
            disabled={loading}
            sx={{
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              '&:hover': { background: 'rgba(255,255,255,0.3)' },
              '&:disabled': { color: 'rgba(255,255,255,0.5)' }
            }}
            startIcon={<Refresh />}
          >
            Actualizar
          </Button>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip
            icon={<Group />}
            label={`Total Grupos: ${groups.length}`}
            sx={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}
          />
          <Chip
            label={`Total Miembros: ${totalMembers}`}
            sx={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}
          />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', pt: 1 }}>
            Última actualización: {lastUpdate.toLocaleTimeString('es-ES')}
          </Typography>
        </Box>
      </Paper>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <strong>❌ Error:</strong> {error}
        </Alert>
      )}

      {/* Empty State */}
      {!loading && groups.length === 0 && !error && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Group sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No hay grupos descargados aún
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Los grupos aparecerán aquí cuando se descargen desde WhatsApp
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Grupos */}
      {!loading && groups.length > 0 && (
        <Grid container spacing={3}>
          {groups.map((group, index) => {
            const groupId = group.id || group.jid || '';
            const groupName = group.name || group.subject || groupId.split('@')[0];
            const members = group.members || group.participant_list || [];
            const unreadCount = group.unread_count || group.unreadCount || 0;
            const isOnline = group.is_online ? true : false;

            return (
              <Grid item xs={12} md={6} lg={4} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 4
                    }
                  }}
                >
                  {/* Card Header */}
                  <Box
                    sx={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      p: 2,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 2
                    }}
                  >
                    <Badge
                      overlap="circular"
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      badgeContent={
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            background: isOnline ? '#4caf50' : '#bdbdbd',
                            border: '2px solid white'
                          }}
                        />
                      }
                    >
                      <Avatar sx={{ background: 'rgba(255,255,255,0.3)', width: 50, height: 50 }}>
                        👥
                      </Avatar>
                    </Badge>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {groupName}
                        </Typography>
                        {unreadCount > 0 && (
                          <Chip
                            label={unreadCount}
                            size="small"
                            sx={{
                              height: 20,
                              background: '#ff5252',
                              color: 'white',
                              fontWeight: 600,
                              fontSize: '11px'
                            }}
                          />
                        )}
                      </Box>
                      <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', wordBreak: 'break-all' }}>
                        {groupId}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Card Content */}
                  <CardContent sx={{ flex: 1, pb: 1 }}>
                    {/* Stats */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2 }}>
                      <Box sx={{ background: '#f5f5f5', p: 1.5, borderRadius: 1 }}>
                        <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 0.5 }}>
                          MIEMBROS
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {members.length}
                        </Typography>
                      </Box>
                      <Box sx={{ background: '#f5f5f5', p: 1.5, borderRadius: 1 }}>
                        <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 0.5 }}>
                          ESTADO
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: isOnline ? '#4caf50' : '#bdbdbd' }}>
                          {isOnline ? '🟢 Online' : '⚪ Offline'}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Members List */}
                    {members.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#888' }}>
                          Miembros ({members.length})
                        </Typography>
                        <List sx={{ p: 0, background: '#f9f9f9', borderRadius: 1 }}>
                          {members.slice(0, 5).map((member, idx) => (
                            <ListItem
                              key={idx}
                              sx={{
                                py: 1,
                                px: 1.5,
                                '&:not(:last-child)': { borderBottom: '1px solid #eee' }
                              }}
                            >
                              <ListItemAvatar sx={{ minWidth: 40, mr: 1 }}>
                                <Avatar
                                  sx={{
                                    width: 32,
                                    height: 32,
                                    background: '#667eea',
                                    color: 'white',
                                    fontSize: '12px',
                                    fontWeight: 600
                                  }}
                                >
                                  {getMemberInitial(member)}
                                </Avatar>
                              </ListItemAvatar>
                              <ListItemText
                                primary={
                                  <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '13px' }}>
                                    {getMemberName(member)}
                                  </Typography>
                                }
                                secondary={
                                  getMemberRole(member) && (
                                    <Chip
                                      label={getMemberRole(member)}
                                      size="small"
                                      sx={{
                                        height: 18,
                                        fontSize: '10px',
                                        background: '#e0e7ff',
                                        color: '#667eea',
                                        fontWeight: 600,
                                        mt: 0.5
                                      }}
                                    />
                                  )
                                }
                              />
                            </ListItem>
                          ))}
                          {members.length > 5 && (
                            <ListItem sx={{ py: 1, px: 1.5, background: '#f0f0f0' }}>
                              <Typography variant="caption" sx={{ color: '#999', width: '100%', textAlign: 'center' }}>
                                +{members.length - 5} más
                              </Typography>
                            </ListItem>
                          )}
                        </List>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Loading más grupos */}
      {loading && groups.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <LinearProgress />
          <Typography variant="caption" sx={{ color: '#999', display: 'block', mt: 1 }}>
            Actualizando información de grupos...
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default WhatsAppGroupsViewer;
