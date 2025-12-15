import React, { useEffect, useState } from 'react';
import { Box, List, ListItem, ListItemAvatar, Avatar, ListItemText, Typography, Dialog, DialogTitle, DialogContent, IconButton, CircularProgress, Tabs, Tab, Divider } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getAPIBaseURL } from '../utils/socketConfig';

interface StatusItem {
  id: string;
  text_content: string | null;
  media_url: string | null;
  media_type: 'text' | 'image' | 'video';
  status: 'draft' | 'scheduled' | 'published' | 'failed' | 'expired';
  created_at: string;
  published_at?: string | null;
}

interface ContactStatus {
  jid: string;
  name: string;
  phone: string;
  avatar?: string | null;
  statuses: {
    id: string;
    type: 'image' | 'video' | 'text';
    url?: string;
    caption?: string;
    timestamp: number;
  }[];
  unreadCount: number;
}

export default function StatusList({ sessionId }: { sessionId: string }) {
  const [myItems, setMyItems] = useState<StatusItem[]>([]);
  const [contactStatuses, setContactStatuses] = useState<ContactStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewer, setViewer] = useState<StatusItem | null>(null);
  const [contactViewer, setContactViewer] = useState<{ contact: ContactStatus; statusIndex: number } | null>(null);
  const [tabValue, setTabValue] = useState(1); // 0: Mis estados, 1: Estados de contactos

  const resolveMediaUrl = (url?: string | null) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${getAPIBaseURL()}${url}`;
  };

  // Cargar estados de contactos desde WhatsApp
  const loadContactStatuses = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getAPIBaseURL()}/api/whatsapp/statuses/${sessionId}`);
      const data = await res.json();

      if (data.success && data.statuses) {
        setContactStatuses(data.statuses);
        console.log('[STATUS-LIST] Estados de contactos cargados:', data.statuses.length);
      }
    } catch (error) {
      console.error('[STATUS-LIST] Error cargando estados de contactos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar mis estados publicados
  const loadMyStatuses = async () => {
    setLoading(true);

    const mapSelfStatuses = (items: any[]): StatusItem[] => {
      const mapped: StatusItem[] = items.map((s: any) => {
        const timestamp = s.timestamp || (s.published_at ? new Date(s.published_at).getTime() : Date.now());
        const published = s.published_at || (timestamp ? new Date(timestamp).toISOString() : new Date().toISOString());
        const created = s.created_at || published || new Date().toISOString();

        const typeGuess: 'text' | 'image' | 'video' =
          s.media_type === 'image' || s.type === 'image' ? 'image' :
          s.media_type === 'video' || s.type === 'video' ? 'video' : 'text';

        const item: StatusItem = {
          id: (s.id || s.message_id || Math.random().toString()).toString(),
          text_content: (s.text_content ?? s.caption ?? null) as string | null,
          media_url: (s.media_url ?? s.url ?? null) as string | null,
          media_type: typeGuess,
          status: 'published',
          created_at: String(created),
          published_at: String(published)
        };

        return item;
      });

      return mapped.sort((a, b) => {
        const ta = new Date(a.published_at || a.created_at).getTime();
        const tb = new Date(b.published_at || b.created_at).getTime();
        return tb - ta;
      });
    };

    let handled = false;

    // Intentar cargar estados reales desde WhatsApp
    try {
      const res = await fetch(`${getAPIBaseURL()}/api/whatsapp/statuses/${sessionId}`);
      const data = await res.json();

      if (data.success && Array.isArray(data.selfStatuses)) {
        const mapped = mapSelfStatuses(data.selfStatuses);
        if (mapped.length > 0) {
          setMyItems(mapped);
          handled = true;
        }
      }
    } catch (error) {
      console.error('[STATUS-LIST] Error cargando mis estados (WhatsApp):', error);
    }

    // Fallback al sistema anterior si no hay estados reales o hubo error
    if (!handled) {
      try {
        const res = await fetch(`${getAPIBaseURL()}/api/statuses/${sessionId}`);
        const data = await res.json();
        const published: StatusItem[] = (data.history || []).map((s: any) => ({
          id: s.id?.toString() || Math.random().toString(),
          text_content: s.text_content,
          media_url: s.media_url,
          media_type: s.media_type,
          status: s.status,
          created_at: s.created_at,
          published_at: s.published_at
        }));
        const drafts: StatusItem[] = (data.statuses || []).filter((s: any) => s.status !== 'published').map((s: any) => ({
          id: s.id?.toString() || Math.random().toString(),
          text_content: s.text_content,
          media_url: s.media_url,
          media_type: s.media_type,
          status: s.status,
          created_at: s.created_at,
          published_at: s.published_at
        }));
        const all = [...published, ...drafts].sort((a, b) => {
          const ta = new Date(a.published_at || a.created_at).getTime();
          const tb = new Date(b.published_at || b.created_at).getTime();
          return tb - ta;
        });
        setMyItems(all);
      } catch (error) {
        console.error('[STATUS-LIST] Error cargando mis estados (fallback):', error);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!sessionId) return;

    if (tabValue === 0) {
      loadMyStatuses();
    } else {
      loadContactStatuses();
    }
  }, [sessionId, tabValue]);

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) return 'Hace unos minutos';
    if (hours === 1) return 'Hace 1 hora';
    if (hours < 24) return `Hace ${hours} horas`;
    return 'Ayer';
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#111b21' }}>
      {/* Tabs y botón de actualizar */}
      <Box sx={{ borderBottom: '1px solid #2a3942' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2 }}>
          <Tabs
            value={tabValue}
            onChange={(_, v) => setTabValue(v)}
            sx={{
              '& .MuiTab-root': {
                color: '#8696a0',
                textTransform: 'none',
                fontSize: '0.9rem',
                minHeight: 48
              },
              '& .Mui-selected': { color: '#00a884' },
              '& .MuiTabs-indicator': { bgcolor: '#00a884' }
            }}
          >
            <Tab label="Mis estados" />
            <Tab label="Recientes" />
          </Tabs>
          <IconButton
            onClick={() => tabValue === 0 ? loadMyStatuses() : loadContactStatuses()}
            sx={{ color: '#8696a0' }}
            size="small"
          >
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={24} sx={{ color: '#00a884' }} />
        </Box>
      ) : tabValue === 1 ? (
        /* Estados de contactos */
        <List sx={{ overflow: 'auto', p: 0, flex: 1 }}>
          {contactStatuses.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: '#8696a0', mb: 1 }}>
                No hay estados disponibles
              </Typography>
              <Typography variant="caption" sx={{ color: '#667781' }}>
                Los estados de tus contactos aparecerán aquí
              </Typography>
            </Box>
          ) : (
            contactStatuses.map((contact) => (
              <ListItem
                key={contact.jid}
                button
                onClick={() => setContactViewer({ contact, statusIndex: 0 })}
                sx={{
                  borderBottom: '1px solid #2a3942',
                  '&:hover': { bgcolor: '#202c33' }
                }}
              >
                <ListItemAvatar>
                  <Box sx={{ position: 'relative' }}>
                    <Avatar
                      src={contact.avatar ? `${getAPIBaseURL()}${contact.avatar}` : undefined}
                      sx={{
                        bgcolor: '#00a884',
                        width: 56,
                        height: 56,
                        border: contact.unreadCount > 0 ? '3px solid #00a884' : '3px solid #2a3942'
                      }}
                    >
                      {!contact.avatar && (contact.name?.[0]?.toUpperCase() || contact.phone?.[0])}
                    </Avatar>
                    {contact.unreadCount > 0 && (
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          bgcolor: '#00a884',
                          borderRadius: '50%',
                          width: 20,
                          height: 20,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '2px solid #111b21',
                          fontSize: '0.7rem',
                          fontWeight: 'bold',
                          color: 'white'
                        }}
                      >
                        {contact.unreadCount}
                      </Box>
                    )}
                  </Box>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#e9edef' }}>
                      {contact.name || contact.phone}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" sx={{ color: '#8696a0' }}>
                      {formatTime(contact.statuses[0]?.timestamp || Date.now())}
                    </Typography>
                  }
                />
              </ListItem>
            ))
          )}
        </List>
      ) : (
        /* Mis estados */
        <List sx={{ overflow: 'auto', p: 0, flex: 1 }}>
          {myItems.map((s) => {
            const time = new Date(s.published_at || s.created_at);
            const preview = s.text_content || (s.media_type === 'image' ? 'Imagen' : s.media_type === 'video' ? 'Video' : 'Estado');
            return (
              <ListItem
                key={s.id}
                button
                onClick={() => setViewer(s)}
                sx={{
                  borderBottom: '1px solid #2a3942',
                  '&:hover': { bgcolor: '#202c33' }
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: '#00a884' }}>S</Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#e9edef' }}>
                        {preview.length > 40 ? `${preview.slice(0, 40)}…` : preview}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#8696a0' }}>
                        {time.toLocaleString()}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Typography variant="caption" sx={{ color: '#8696a0' }}>
                      {s.status === 'published' ? 'Publicado' : s.status === 'scheduled' ? 'Programado' : 'Borrador'}
                    </Typography>
                  }
                />
              </ListItem>
            );
          })}
          {myItems.length === 0 && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: '#8696a0' }}>Sin estados</Typography>
            </Box>
          )}
        </List>
      )}

      {/* Diálogo para mis estados */}
      <Dialog
        open={!!viewer}
        onClose={() => setViewer(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#202c33' } }}
      >
        <DialogTitle sx={{ color: '#e9edef' }}>
          Mi Estado
          <IconButton onClick={() => setViewer(null)} sx={{ position: 'absolute', right: 8, top: 8, color: '#8696a0' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {viewer && (
            <Box>
              {viewer.media_url ? (
                viewer.media_type === 'image' ? (
                  <img
                    src={resolveMediaUrl(viewer.media_url) || undefined}
                    alt=""
                    style={{ width: '100%', borderRadius: 8 }}
                  />
                ) : (
                  <video
                    controls
                    src={resolveMediaUrl(viewer.media_url) || undefined}
                    style={{ width: '100%', borderRadius: 8 }}
                  />
                )
              ) : (
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', color: '#e9edef' }}>
                  {viewer.text_content}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo para estados de contactos */}
      <Dialog
        open={!!contactViewer}
        onClose={() => setContactViewer(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#000', m: 0 } }}
        sx={{
          '& .MuiDialog-paper': {
            maxHeight: '100vh',
            height: '100vh',
            borderRadius: 0
          }
        }}
      >
        {contactViewer && (
          <Box sx={{ position: 'relative', height: '100%', bgcolor: '#000' }}>
            {/* Header */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 10,
                p: 2,
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
                display: 'flex',
                alignItems: 'center',
                gap: 2
              }}
            >
              <IconButton onClick={() => setContactViewer(null)} sx={{ color: 'white' }}>
                <CloseIcon />
              </IconButton>
              <Avatar
                src={contactViewer.contact.avatar ? `${getAPIBaseURL()}${contactViewer.contact.avatar}` : undefined}
                sx={{ bgcolor: '#00a884', width: 40, height: 40 }}
              >
                {!contactViewer.contact.avatar && (contactViewer.contact.name?.[0]?.toUpperCase() || contactViewer.contact.phone?.[0])}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 600 }}>
                  {contactViewer.contact.name || contactViewer.contact.phone}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  {formatTime(contactViewer.contact.statuses[contactViewer.statusIndex]?.timestamp || Date.now())}
                </Typography>
              </Box>
            </Box>

            {/* Indicadores de progreso */}
            {contactViewer.contact.statuses.length > 1 && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 60,
                  left: 8,
                  right: 8,
                  zIndex: 10,
                  display: 'flex',
                  gap: 0.5
                }}
              >
                {contactViewer.contact.statuses.map((_, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      flex: 1,
                      height: 3,
                      bgcolor: 'rgba(255,255,255,0.3)',
                      borderRadius: 1,
                      overflow: 'hidden'
                    }}
                  >
                    {idx <= contactViewer.statusIndex && (
                      <Box sx={{ width: '100%', height: '100%', bgcolor: 'white' }} />
                    )}
                  </Box>
                ))}
              </Box>
            )}

            {/* Contenido del estado */}
            <Box
              sx={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#000'
              }}
              onClick={(e) => {
                // Click en la mitad derecha avanza, en la izquierda retrocede
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const isRightHalf = clickX > rect.width / 2;

                if (isRightHalf) {
                  // Avanzar
                  if (contactViewer.statusIndex < contactViewer.contact.statuses.length - 1) {
                    setContactViewer({
                      ...contactViewer,
                      statusIndex: contactViewer.statusIndex + 1
                    });
                  } else {
                    setContactViewer(null);
                  }
                } else {
                  // Retroceder
                  if (contactViewer.statusIndex > 0) {
                    setContactViewer({
                      ...contactViewer,
                      statusIndex: contactViewer.statusIndex - 1
                    });
                  }
                }
              }}
            >
              {(() => {
                const status = contactViewer.contact.statuses[contactViewer.statusIndex];
                if (!status) return null;

                if (status.type === 'image' && status.url) {
                  return (
                    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
                      <img
                        src={status.url}
                        alt=""
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain'
                        }}
                      />
                      {status.caption && (
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            p: 3,
                            background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)'
                          }}
                        >
                          <Typography sx={{ color: 'white', fontSize: '1.1rem' }}>
                            {status.caption}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  );
                }

                if (status.type === 'video' && status.url) {
                  return (
                    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
                      <video
                        src={status.url}
                        controls
                        autoPlay
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain'
                        }}
                      />
                      {status.caption && (
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            p: 3,
                            background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)'
                          }}
                        >
                          <Typography sx={{ color: 'white', fontSize: '1.1rem' }}>
                            {status.caption}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  );
                }

                // Estado de texto
                return (
                  <Box sx={{ p: 4, maxWidth: 600 }}>
                    <Typography
                      variant="h5"
                      sx={{
                        color: 'white',
                        textAlign: 'center',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}
                    >
                      {status.caption || 'Estado'}
                    </Typography>
                  </Box>
                );
              })()}
            </Box>
          </Box>
        )}
      </Dialog>
    </Box>
  );
}
