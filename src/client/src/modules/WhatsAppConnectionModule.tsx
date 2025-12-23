import React, { useState, useEffect, useRef } from 'react';
import { sessionFetch } from '../utils/sessionFetch';
import io from 'socket.io-client';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  LinearProgress,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Grid
} from '@mui/material';
import {
  QrCode,
  Refresh,
  Delete,
  Phone,
  WhatsApp
} from '@mui/icons-material';

interface WhatsAppConnectionModuleProps {
  sessionId: string;
}

interface WhatsAppSession {
  sessionId: string;
  phoneNumber?: string;
  name?: string;
  avatar?: string;
  isConnected: boolean;
  hasAuth: boolean;
  ownerPhone?: string;
}

const WhatsAppConnectionModule: React.FC<WhatsAppConnectionModuleProps> = ({ sessionId }) => {
  const resolvedSessionId = React.useMemo(() => (
    sessionId
    || sessionStorage.getItem('whatsflow_session')
    || localStorage.getItem('whatsflow_session')
    || sessionStorage.getItem('sessionId')
    || localStorage.getItem('sessionId')
  ), [sessionId]);

  const [qrState, setQrState] = useState<{ sessionId: string; qrDataUrl: string; isLoading: boolean }>({
    sessionId: '',
    qrDataUrl: '',
    isLoading: false
  });
  const [waSessions, setWaSessions] = useState<WhatsAppSession[]>([]);
  const [waLoading, setWaLoading] = useState(false);
  const [waError, setWaError] = useState('');
  const [normalizedMaxChannels, setNormalizedMaxChannels] = useState<number>(Infinity);
  const [disconnectDialog, setDisconnectDialog] = useState<{ open: boolean; sessionId: string }>({
    open: false,
    sessionId: ''
  });

  const qrPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cargar plan de suscripción y límites
  useEffect(() => {
    const fetchSubscriptionLimits = async () => {
      if (!resolvedSessionId) {
        setNormalizedMaxChannels(1);
        return;
      }
      try {
        const response = await sessionFetch(`/api/subscriptions/my-subscription?phone=${resolvedSessionId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
          const data = await response.json();
          const maxChannels = data?.subscription?.max_channels;
          if (typeof maxChannels === 'number' && maxChannels > 0) {
            setNormalizedMaxChannels(maxChannels);
          } else if (maxChannels === 'unlimited' || maxChannels === -1) {
            setNormalizedMaxChannels(Infinity);
          } else {
            setNormalizedMaxChannels(1);
          }
        }
      } catch (err) {
        console.error('[SUBSCRIPTION] Error al cargar límites:', err);
        setNormalizedMaxChannels(1);
      }
    };

    fetchSubscriptionLimits();
  }, [resolvedSessionId]);

  // Cargar sesiones activas
  const fetchActiveSessions = async () => {
    if (!resolvedSessionId) {
      setWaError('No hay sessionId disponible. Intenta volver a iniciar sesión.');
      setWaLoading(false);
      return;
    }
    setWaLoading(true);
    setWaError('');
    try {
      const response = await sessionFetch(`/api/sessions/active?sessionId=${encodeURIComponent(resolvedSessionId || '')}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al cargar sesiones');
      }

      const data = await response.json();
      setWaSessions((data.sessions || []).map((s: any) => ({
        sessionId: s.sessionId,
        phoneNumber: s.phoneNumber,
        name: s.name,
        avatar: s.avatar,
        isConnected: s.isConnected,
        hasAuth: true,
        ownerPhone: s.ownerPhone
      })));
    } catch (err: any) {
      console.error('[WHATSAPP] Error al cargar sesiones:', err);
      setWaError(err.message || 'Error al cargar sesiones de WhatsApp');
    } finally {
      setWaLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveSessions();

    // ✅ Conectar Socket.IO para actualizaciones en tiempo real
    const socket = io();

    // Escuchar eventos de desconexión de WhatsApp
    socket.on('whatsapp-disconnected', (data: any) => {
      console.log('[WA-CONNECTION] WhatsApp desconectado:', data);
      fetchActiveSessions(); // Refrescar lista
    });

    // Escuchar eventos de cambio de estado de sesión
    socket.on('session-status', (data: any) => {
      console.log('[WA-CONNECTION] Cambio de estado:', data);
      fetchActiveSessions(); // Refrescar lista
    });

    // Escuchar evento de conexión exitosa
    socket.on('connection-update', (data: any) => {
      console.log('[WA-CONNECTION] Actualización de conexión:', data);
      fetchActiveSessions(); // Refrescar lista
    });

    return () => {
      stopQrPolling();
      socket.disconnect();
    };
  }, [resolvedSessionId]);

  const stopQrPolling = () => {
    if (qrPollRef.current) {
      clearInterval(qrPollRef.current);
      qrPollRef.current = null;
    }
  };

  const startQrFlow = async () => {
    if (!resolvedSessionId) {
      setWaError('No hay sessionId disponible. Vuelve a iniciar sesión.');
      return;
    }

    setWaError('');
    stopQrPolling();
    setQrState({ sessionId: '', qrDataUrl: '', isLoading: true });

    try {
      const response = await sessionFetch(`/api/whatsapp/qr-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: resolvedSessionId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al generar QR');
      }

      const qrData = await response.json();
      if (!qrData.sessionId || !qrData.qrDataUrl) {
        throw new Error('No se recibió QR del servidor');
      }

      setQrState({ sessionId: qrData.sessionId, qrDataUrl: qrData.qrDataUrl, isLoading: false });
      console.log('[WHATSAPP] QR generado para sesión:', qrData.sessionId);

      // Iniciar polling para detectar cuando se escanea el QR (más frecuente para detección rápida)
      qrPollRef.current = setInterval(async () => {
        try {
          const statusResponse = await sessionFetch(`/api/sessions/active?sessionId=${encodeURIComponent(resolvedSessionId)}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });

          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            const foundSession = (statusData.sessions || []).find(
              (s: WhatsAppSession) =>
                (s.sessionId === qrData.sessionId || s.phoneNumber === qrData.sessionId) && s.isConnected
            );

            if (foundSession) {
              console.log('[WHATSAPP] ✅ QR escaneado exitosamente - Conexión establecida:', foundSession.phoneNumber || foundSession.name);
              stopQrPolling();
              setQrState({ sessionId: '', qrDataUrl: '', isLoading: false });
              setWaError('');
              await fetchActiveSessions();
            }
          }
        } catch (err) {
          console.error('[WHATSAPP] Error en polling:', err);
        }
      }, 2000);
    } catch (err: any) {
      console.error('[WHATSAPP] Error en QR flow:', err);
      setWaError(err.message || 'Error al generar código QR');
      setQrState({ sessionId: '', qrDataUrl: '', isLoading: false });
    }
  };

  const handleReconnectSession = async (targetSessionId: string) => {
    setWaError('');
    setWaLoading(true);
    try {
      const response = await sessionFetch(`/api/whatsapp/reconnect/${targetSessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al reconectar');
      }

      await fetchActiveSessions();
    } catch (err: any) {
      console.error('[WHATSAPP] Error al reconectar:', err);
      setWaError(err.message || 'Error al reconectar sesión');
    } finally {
      setWaLoading(false);
    }
  };

  const openDisconnectDialog = (targetSessionId: string) => {
    setDisconnectDialog({ open: true, sessionId: targetSessionId });
  };

  const closeDisconnectDialog = () => {
    setDisconnectDialog({ open: false, sessionId: '' });
  };

  const confirmDisconnect = async () => {
    const targetSessionId = resolvedSessionId || disconnectDialog.sessionId;
    closeDisconnectDialog();

    setWaError('');
    setWaLoading(true);

    try {
      // Eliminar SOLO la conexión (user_sessions + auth), sin tocar datos
      const response = await sessionFetch(`/api/sessions/${targetSessionId}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Error al desconectar');
      }

      await fetchActiveSessions();
    } catch (err: any) {
      console.error('[WHATSAPP] Error al desconectar:', err);
      setWaError(err.message || 'Error al desconectar sesión');
    } finally {
      setWaLoading(false);
    }
  };


  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <WhatsApp sx={{ fontSize: 40, color: '#25d366' }} />
          Gestión de Conexiones WhatsApp
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Conecta y administra múltiples líneas de WhatsApp para tu negocio
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Panel izquierdo - Estado y acciones */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>📡 Estado de WhatsApp</Typography>
              <Stack spacing={1}>
                <Typography variant="body2" color="textSecondary">Límites del plan</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {Number.isFinite(normalizedMaxChannels)
                    ? `${waSessions.length}/${normalizedMaxChannels} líneas`
                    : `${waSessions.length} / Ilimitado`}
                </Typography>
                {Number.isFinite(normalizedMaxChannels) && (
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, (waSessions.length / (normalizedMaxChannels || 1)) * 100)}
                    sx={{ height: 8, borderRadius: 1 }}
                  />
                )}
                <Alert severity={Number.isFinite(normalizedMaxChannels) && waSessions.length >= normalizedMaxChannels ? 'warning' : 'info'}>
                  {Number.isFinite(normalizedMaxChannels)
                    ? `${Math.max(0, normalizedMaxChannels - waSessions.length)} slots disponibles`
                    : 'Slots ilimitados'}
                </Alert>

                {waError && (
                  <Alert severity="error" onClose={() => setWaError('')}>
                    {waError}
                  </Alert>
                )}

                <Button
                  variant="contained"
                  startIcon={<QrCode />}
                  onClick={startQrFlow}
                  disabled={qrState.isLoading || (Number.isFinite(normalizedMaxChannels) && waSessions.length >= normalizedMaxChannels)}
                  sx={{
                    bgcolor: '#25d366',
                    '&:hover': { bgcolor: '#1ebe57' },
                    '&:disabled': { bgcolor: 'rgba(37, 211, 102, 0.3)' }
                  }}
                >
                  Conectar por QR
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={fetchActiveSessions}
                  disabled={waLoading}
                >
                  Actualizar estado
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Panel central - QR Scanner */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Escanear código QR</Typography>
              {qrState.isLoading && <LinearProgress sx={{ mb: 2 }} />}

              {qrState.qrDataUrl ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 280 }}>
                  <Paper elevation={3} sx={{ p: 2, textAlign: 'center', bgcolor: '#fff' }}>
                    <img src={qrState.qrDataUrl} alt="QR de WhatsApp" style={{ width: 240, height: 240 }} />
                    <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
                      Session ID: {qrState.sessionId}
                    </Typography>
                  </Paper>
                  <Alert severity="info" sx={{ mt: 2, maxWidth: 400 }}>
                    1. Abre WhatsApp en tu teléfono<br />
                    2. Ve a Configuración → Dispositivos vinculados<br />
                    3. Toca "Vincular un dispositivo"<br />
                    4. Escanea este código QR
                  </Alert>
                  <Button
                    variant="outlined"
                    startIcon={<Refresh />}
                    onClick={startQrFlow}
                    sx={{ mt: 2 }}
                    disabled={qrState.isLoading}
                  >
                    Generar nuevo QR
                  </Button>
                </Box>
              ) : (
                <Box sx={{ minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Stack spacing={2} alignItems="center">
                    <WhatsApp sx={{ fontSize: 80, color: 'text.disabled' }} />
                    <Typography variant="body1" color="textSecondary" align="center">
                      Presiona "Conectar por QR" para generar un código<br />
                      y vincular una nueva línea de WhatsApp
                    </Typography>
                  </Stack>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Lista de conexiones */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">Líneas conectadas ({waSessions.length})</Typography>
                {waLoading && <LinearProgress sx={{ width: 200 }} />}
              </Box>

              {!waLoading && waSessions.length === 0 && (
                <Alert severity="info">
                  No hay sesiones activas. Conecta tu primera línea de WhatsApp usando el código QR.
                </Alert>
              )}

              <List>
                {waSessions.map((session) => {
                  const isPrimary = session.sessionId === sessionId;
                  const iconBg = isPrimary ? 'primary.main' : 'success.main';
                  const displayName = session.name || session.phoneNumber || session.sessionId;

                  return (
                    <ListItem
                      key={session.sessionId}
                      divider
                      sx={{
                        bgcolor: session.isConnected ? 'transparent' : 'rgba(255, 0, 0, 0.05)',
                        borderLeft: session.isConnected ? '4px solid #25d366' : '4px solid #f44336',
                        mb: 1,
                        borderRadius: 1
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar
                          src={session.avatar || undefined}
                          sx={{
                            bgcolor: !session.avatar ? iconBg : undefined,
                            width: 56,
                            height: 56
                          }}
                        >
                          {!session.avatar && <Phone />}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Typography component="span" variant="subtitle1" sx={{ fontWeight: 600 }}>
                              {displayName}
                            </Typography>
                            {isPrimary && (
                              <Chip
                                label="👑 Principal"
                                color="primary"
                                size="small"
                              />
                            )}
                            {!isPrimary && session.ownerPhone && (
                              <Chip
                                label="Secundaria"
                                color="success"
                                variant="outlined"
                                size="small"
                              />
                            )}
                            {session.isConnected ? (
                              <Chip
                                label="🟢 Conectado"
                                color="success"
                                size="small"
                                sx={{ fontWeight: 600 }}
                              />
                            ) : (
                              <Chip
                                label="🔴 Desconectado"
                                color="error"
                                size="small"
                                sx={{ fontWeight: 600 }}
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box sx={{ mt: 0.5 }}>
                            <Typography component="span" variant="body2" display="block" sx={{ fontWeight: 500 }}>
                              📱 {session.phoneNumber || session.sessionId}
                            </Typography>
                            {!isPrimary && session.ownerPhone && (
                              <Typography component="span" variant="caption" display="block" color="text.secondary">
                                Relacionada con: {session.ownerPhone}
                              </Typography>
                            )}
                            {session.name && session.phoneNumber && session.name !== session.phoneNumber && (
                              <Typography component="span" variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                                👤 Nombre en WhatsApp: {session.name}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                      <Stack direction="row" spacing={1} alignItems="center">
                        {!session.isConnected && session.hasAuth && (
                          <Button
                            size="small"
                            color="success"
                            variant="contained"
                            onClick={() => handleReconnectSession(session.sessionId)}
                            startIcon={<Refresh />}
                          >
                            Reconectar
                          </Button>
                        )}
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          onClick={() => openDisconnectDialog(session.sessionId)}
                          startIcon={<Delete />}
                        >
                          Desconectar
                        </Button>
                      </Stack>
                    </ListItem>
                  );
                })}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dialog de confirmación de desconexión */}
      <Dialog open={disconnectDialog.open} onClose={closeDisconnectDialog}>
        <DialogTitle>Confirmar desconexión</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Estás seguro de que deseas desconectar esta sesión de WhatsApp?
            Podrás reconectar en cualquier momento escaneando el código QR nuevamente.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDisconnectDialog}>Cancelar</Button>
          <Button onClick={confirmDisconnect} color="error" variant="contained">
            Desconectar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WhatsAppConnectionModule;
