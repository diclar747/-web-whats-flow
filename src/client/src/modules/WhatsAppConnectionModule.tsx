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
  created_at?: string; // 🆕 Added field
}

const WhatsAppConnectionModule: React.FC<WhatsAppConnectionModuleProps> = ({ sessionId }) => {
  const resolvedSessionId = React.useMemo(() => (
    sessionId
    || sessionStorage.getItem('whinsap_session')
    || localStorage.getItem('whinsap_session')
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
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('inactive');
  const [disconnectDialog, setDisconnectDialog] = useState<{ open: boolean; sessionId: string }>({
    open: false,
    sessionId: ''
  });

  const qrPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cargar plan de suscripción y límites
  useEffect(() => {
    const fetchSubscriptionLimits = async () => {
      // 🔥 PRIORIDAD: Usar teléfono guardado en localStorage
      let identifier = localStorage.getItem('userPhone')
        || sessionStorage.getItem('userPhone')
        || localStorage.getItem('phone')
        || sessionStorage.getItem('phone')
        || resolvedSessionId;

      // Si no hay teléfono, intentar extraer del user guardado
      if (!identifier || /^[a-f0-9]{16}$/.test(identifier)) {
        try {
          const savedUser = localStorage.getItem('user');
          if (savedUser) {
            const userData = JSON.parse(savedUser);
            identifier = userData.phone || userData.phone_number || userData.email || identifier;
          }
        } catch (e) {
          console.warn('[SUBSCRIPTION] Error parse user:', e);
        }
      }

      console.log('[SUBSCRIPTION] 🔍 Buscando plan para:', identifier);

      if (!identifier) {
        setNormalizedMaxChannels(1);
        return;
      }

      try {
        const response = await sessionFetch(`/api/subscriptions/my-subscription?phone=${encodeURIComponent(identifier)}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
          const data = await response.json();
          console.log('[SUBSCRIPTION] 📦 Respuesta:', data);
          const sub = data?.subscription;
          setSubscriptionStatus(sub?.subscription_status || 'inactive');

          const maxChannels = sub?.plan_details?.max_channels || sub?.max_channels;
          console.log('[SUBSCRIPTION] 📊 max_channels:', maxChannels);

          if (typeof maxChannels === 'number' && maxChannels > 0) {
            setNormalizedMaxChannels(maxChannels);
            console.log('[SUBSCRIPTION] ✅ Plan:', maxChannels, 'líneas');
          } else if (maxChannels === 'unlimited' || maxChannels === -1) {
            setNormalizedMaxChannels(Infinity);
            console.log('[SUBSCRIPTION] ✅ Plan ilimitado');
          } else {
            setNormalizedMaxChannels(1);
            console.log('[SUBSCRIPTION] ⚠️ Usando 1 línea por defecto');
          }
        } else {
          console.error('[SUBSCRIPTION] ❌ HTTP:', response.status);
        }
      } catch (err) {
        console.error('[SUBSCRIPTION] Error al cargar límites:', err);
        setNormalizedMaxChannels(1);
        setSubscriptionStatus('inactive');
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
      console.log('[WhatsAppConnection] 📋 API Response:', data);

      const sessionsData = (data.sessions || []).map((s: any) => {
        console.log('[WhatsAppConnection] 🔍 Mapping session:', {
          sessionId: s.sessionId,
          phoneNumber: s.phoneNumber,
          name: s.name,
          avatar: s.avatar
        });

        return {
          sessionId: s.sessionId,
          phoneNumber: s.phoneNumber,
          name: s.name,
          avatar: s.avatar,
          isConnected: s.isConnected,
          hasAuth: true,
          ownerPhone: s.ownerPhone,
          created_at: s.created_at
        };
      });

      // 🆕 Sort logic (Verified): Priority strictly to Oldest (Primary)
      sessionsData.sort((a: WhatsAppSession, b: WhatsAppSession) => {
        // Age priority (Oldest first) - Strict Principal
        const timeA = new Date(a.created_at || 0).getTime();
        const timeB = new Date(b.created_at || 0).getTime();
        return timeA - timeB;
      });

      setWaSessions(sessionsData);
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

    // 🆕 Escuchar evento específico emitido por el servidor al conectar
    socket.on('whatsapp-connected', (data: any) => {
      console.log('[WA-CONNECTION] WhatsApp conectado exitosamente:', data);
      setWaError(''); // Limpiar errores
      stopQrPolling(); // Detener polling si estaba activo
      setQrState(prev => ({ ...prev, isLoading: false, qrDataUrl: '' })); // Limpiar QR
      setQrState(prev => ({ ...prev, isLoading: false, qrDataUrl: '' })); // Limpiar QR
      fetchActiveSessions(); // Refrescar lista inmediatamente

      // 🔥 DISPARAR EVENTO GLOBAL PARA ACTUALIZAR APP
      try {
        window.dispatchEvent(new CustomEvent('whinsap-session-established', {
          detail: {
            sessionId: data.sessionId || resolvedSessionId,
            userId: sessionStorage.getItem('userId'),
            userRole: sessionStorage.getItem('userRole')
          }
        }));
        console.log('📣 Evento whinsap-session-established emitido (socket)');
      } catch (e) {
        console.error('Error emitiendo evento:', e);
      }
    });

    // 🔐 Escuchar token JWT del servidor
    socket.on('auth_token', (data: any) => {
      console.log('[WA-CONNECTION] 🔐 Token JWT recibido:', { hasToken: !!data?.token, user: data?.user });
      if (!data?.token) return;

      // Si ya hay un JWT de usuario, NO lo sobrescribimos para evitar perder el contexto (email/rol)
      const existingUserToken = localStorage.getItem('token') || sessionStorage.getItem('token');
      const storedUserJson = localStorage.getItem('user') || sessionStorage.getItem('user');
      const storedUserEmail = (() => {
        try { return storedUserJson ? JSON.parse(storedUserJson)?.email : null; } catch { return null; }
      })();
      const incomingEmail = data?.user?.email;

      const shouldReplaceToken = !existingUserToken || (incomingEmail && storedUserEmail && incomingEmail === storedUserEmail);

      if (shouldReplaceToken) {
        localStorage.setItem('token', data.token);
        sessionStorage.setItem('token', data.token);
        console.log('[WA-CONNECTION] ✅ Token principal actualizado');
      } else {
        // Guardar token de conexión WhatsApp en claves separadas para APIs específicas si hiciera falta
        localStorage.setItem('wh_session_token', data.token);
        sessionStorage.setItem('wh_session_token', data.token);
        console.log('[WA-CONNECTION] 🧪 Token alterno guardado en wh_session_token (no se reemplaza el del usuario)');
      }

      // Guardar datos de la sesión de WhatsApp sin afectar datos del usuario logueado
      if (data.user) {
        if (data.user.role) {
          localStorage.setItem('userRole', data.user.role);
          sessionStorage.setItem('userRole', data.user.role);
        }
        if (data.user.phone) {
          localStorage.setItem('userPhone', data.user.phone);
          sessionStorage.setItem('userPhone', data.user.phone);
        }
        if (data.user.sessionId) {
          const existingSession = localStorage.getItem('whinsap_session') || sessionStorage.getItem('whinsap_session');
          if (!existingSession) {
            localStorage.setItem('whinsap_session', data.user.sessionId);
            sessionStorage.setItem('whinsap_session', data.user.sessionId);
            console.log('[WA-CONNECTION] ✅ whinsap_session inicializada');
          } else {
            localStorage.setItem('whinsap_alt_session', data.user.sessionId);
            sessionStorage.setItem('whinsap_alt_session', data.user.sessionId);
            console.log('[WA-CONNECTION] 🧭 Sesión WhatsApp adicional guardada en whinsap_alt_session (principal conservada)');
          }
        }
      }

      // En lugar de recargar toda la app, emitir evento para que los módulos se actualicen
      try {
        window.dispatchEvent(new CustomEvent('whinsap-session-established', {
          detail: {
            sessionId: data.user?.sessionId || resolvedSessionId,
            userId: sessionStorage.getItem('userId'),
            userRole: data.user?.role || sessionStorage.getItem('userRole') || 'admin',
            token: shouldReplaceToken ? data.token : (existingUserToken || data.token)
          }
        }));
        console.log('📣 Evento whinsap-session-established emitido (auth_token, sin recarga)');
      } catch (e) {
        console.error('Error emitiendo evento:', e);
      }

      // Refrescar lista de sesiones y plan sin recargar la página
      fetchActiveSessions();
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

  const startQrFlow = async (targetSessionId?: string) => {
    // 🆕 Detectar sesión principal para validar plan
    const primarySession = waSessions.length > 0 ? waSessions[0] : null;
    const primaryOwnerId = primarySession ? (primarySession.sessionId || primarySession.phoneNumber) : resolvedSessionId;

    // Si NO hay targetSessionId (es una nueva conexión), generar ID único
    const isNewConnection = !targetSessionId;
    const sessionToUse = targetSessionId || `session-${Date.now()}`;

    // Si es reconexión, usar el ID existente. Si es nueva, usar el generado.
    console.log(`[QR-FLOW] Iniciando flow. Mode: ${isNewConnection ? 'NEW' : 'RECONNECT'}, Session: ${sessionToUse}, Owner: ${primaryOwnerId}`);

    if (!sessionToUse) {
      setWaError('No hay sessionId disponible.');
      return;
    }

    setWaError('');

    // Validar plan activo (usar 'active' como string literal si es necesario, pero subscriptionStatus viene del state)
    if (subscriptionStatus !== 'active') {
      setWaError('Es necesario activar un plan para generar el código QR.');
      return;
    }

    // Validar límite de canales (solo para nuevas conexiones)
    if (isNewConnection && Number.isFinite(normalizedMaxChannels) && waSessions.length >= normalizedMaxChannels) {
      setWaError(`Has alcanzado el límite de líneas de tu plan (${waSessions.length}/${normalizedMaxChannels}).`);
      return;
    }

    stopQrPolling();
    setQrState({ sessionId: '', qrDataUrl: '', isLoading: true });

    try {
      const response = await sessionFetch(`/api/whatsapp/qr-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionToUse,
          ownerId: primaryOwnerId // 🆕 Enviar ownerId explícito para validación de plan
        })
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
          const statusResponse = await sessionFetch(`/api/sessions/active?sessionId=${encodeURIComponent(sessionToUse)}`, {
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
              setWaError('');
              await fetchActiveSessions();

              // 🔥 DISPARAR EVENTO GLOBAL PARA ACTUALIZAR APP
              try {
                window.dispatchEvent(new CustomEvent('whinsap-session-established', {
                  detail: {
                    sessionId: foundSession.sessionId,
                    userId: sessionStorage.getItem('userId'),
                    userRole: sessionStorage.getItem('userRole')
                  }
                }));
                console.log('📣 Evento whinsap-session-established emitido (polling)');
              } catch (e) {
                console.error('Error emitiendo evento:', e);
              }
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

      const data = await response.json();

      if (!data.isConnected) {
        console.log('[RECONNECT] Sesión no conectada automáticamente, iniciando flujo QR para:', targetSessionId);
        startQrFlow(targetSessionId);
      } else {
        await fetchActiveSessions();
      }
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
                  onClick={() => startQrFlow()}
                  disabled={
                    qrState.isLoading ||
                    subscriptionStatus !== 'active' ||
                    (Number.isFinite(normalizedMaxChannels) && waSessions.length >= normalizedMaxChannels)
                  }
                  sx={{
                    bgcolor: '#25d366',
                    '&:hover': { bgcolor: '#1ebe57' },
                    '&:disabled': { bgcolor: 'rgba(37, 211, 102, 0.3)' }
                  }}
                >
                  {subscriptionStatus !== 'active' ? 'Plan Requerido' : 'Conectar por QR'}
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
                    onClick={() => startQrFlow()}
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
                {waSessions.map((session, index) => {
                  // 🆕 Primary logic: First session in the sorted list is Primary
                  const isPrimary = index === 0;
                  const iconBg = isPrimary ? 'primary.main' : 'success.main';
                  const displayName = session.name || session.phoneNumber || session.sessionId;

                  // 🔥 Proxy WhatsApp CDN URLs to avoid 403 errors
                  const getProxiedAvatar = (avatarUrl: string | undefined) => {
                    if (!avatarUrl) return undefined;

                    // Check if it's a WhatsApp CDN URL
                    if (avatarUrl.includes('pps.whatsapp.net') || avatarUrl.includes('mmg.whatsapp.net')) {
                      const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;
                      return `${API_BASE}/api/proxy/avatar?url=${encodeURIComponent(avatarUrl)}`;
                    }

                    return avatarUrl;
                  };

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
                          src={getProxiedAvatar(session.avatar) || undefined}
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
                          Eliminar
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
        <DialogTitle>Confirmar eliminación</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Estás seguro de que deseas eliminar esta sesión de WhatsApp?
            Esto eliminará la conexión y los archivos de autenticación. Podrás reconectar en cualquier momento escaneando el código QR nuevamente.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDisconnectDialog}>Cancelar</Button>
          <Button onClick={confirmDisconnect} color="error" variant="contained">
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WhatsAppConnectionModule;
