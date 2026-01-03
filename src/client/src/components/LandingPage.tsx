import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { getSocketURL, getAPIBaseURL } from '../utils/socketConfig';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  AppBar,
  Toolbar,
  IconButton,
  Paper,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Divider,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Badge,
  Fab,
  Menu,
  MenuItem,
  InputAdornment,
  Chip,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  WhatsApp,
  QrCode,
  Person,
  Settings,
  CheckCircle,
  Message,
  Campaign,
  Analytics,
  People,
  Schedule,
  TrendingUp,
  Refresh,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { whatsappAPI, initializeSocket } from '../services/api';



interface LandingPageProps {
  onQRSuccess: (sessionId: string) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onQRSuccess }) => {
  const navigate = useNavigate();
  const socketRef = useRef<any>(null);
  const pendingSessionIdRef = useRef<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  // Sesión que este navegador inició (para evitar tomar sesiones ajenas)
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

  // Sincronizar pendingSessionIdRef con pendingSessionId
  useEffect(() => {
    pendingSessionIdRef.current = pendingSessionId;
    console.log('🔄 [LANDING] pendingSessionIdRef actualizado:', pendingSessionId);
  }, [pendingSessionId]);

  // VERIFICAR SI YA HAY SESIÓN ACTIVA AL CARGAR
  useEffect(() => {
    const checkExistingSession = async () => {
      const savedSession = sessionStorage.getItem('whatsflow_session');
      const deviceId = sessionStorage.getItem('whatsflow_device_id');

      // Primero verificar si hay sesión por deviceId (más confiable)
      if (deviceId && !isConnected) {
        console.log('[LANDING] Verificando sesión por deviceId...');
        try {
          const deviceResponse = await fetch(`${getAPIBaseURL()}/api/session/check-by-device`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-device-id': deviceId
            },
            body: JSON.stringify({ deviceId })
          });

          if (deviceResponse.ok) {
            const deviceData = await deviceResponse.json();
            if (deviceData.success && deviceData.isConnected) {
              const foundSessionId = deviceData.phoneNumber || deviceData.sessionId;
              console.log('✅ [LANDING] Sesión activa encontrada por deviceId:', foundSessionId);
              setIsConnected(true);
              setSessionId(foundSessionId);
              sessionStorage.setItem('whatsflow_session', foundSessionId);
              onQRSuccess(foundSessionId);
              navigate('/dashboard', { replace: true });
              return;
            }
          }
        } catch (error) {
          console.log('[LANDING] No se encontró sesión por deviceId:', error);
        }
      }

      // Si no encontró por deviceId, verificar savedSession
      if (savedSession && !isConnected) {
        console.log('[LANDING] Verificando sesión guardada:', savedSession);
        try {
          const response = await fetch(`${getAPIBaseURL()}/api/session/${savedSession}/status`, {
            headers: {
              'x-device-id': deviceId || '',
              'x-session-token': sessionStorage.getItem('whatsflow_session_token') || ''
            }
          });
          const data = await response.json();

          if (data.success && data.isConnected) {
            console.log('✅ [LANDING] Sesión ya conectada, redirigiendo al dashboard...');
            setIsConnected(true);
            setSessionId(savedSession);
            onQRSuccess(savedSession);
            navigate('/dashboard', { replace: true });
          } else {
            console.log('⚠️ [LANDING] Sesión guardada no está conectada');
            sessionStorage.removeItem('whatsflow_session');
          }
        } catch (error) {
          console.error('[LANDING] Error verificando sesión guardada:', error);
        }
      }
    };

    checkExistingSession();
  }, [isConnected, navigate, onQRSuccess]);

  // VERIFICACIÓN: Polling solo para la sesión pendiente (cada 3 segundos - más suave)
  useEffect(() => {
    let check: ReturnType<typeof setInterval> | undefined;
    if (!isConnected && showQRModal && pendingSessionId) {
      console.log('[LANDING] 🔄 Iniciando polling de verificación cada 3 segundos');
      check = setInterval(async () => {
        try {
          const response = await fetch(`${getAPIBaseURL()}/api/session/${pendingSessionId}/status`);
          const data = await response.json();
          console.log('[LANDING-POLLING] Estado de sesión:', data);

          if (data.success && data.isConnected) {
            const finalSessionId = data.phoneNumber || pendingSessionId;
            console.log('✅ [LANDING-POLLING] ¡Sesión conectada! Redirigiendo a dashboard...');

            setIsConnected(true);
            setSessionId(finalSessionId);
            setShowQRModal(false);
            setLoading(false);
            sessionStorage.setItem('whatsflow_session', finalSessionId);

            if (check) clearInterval(check);

            onQRSuccess(finalSessionId);
            navigate('/dashboard', { replace: true });
          }
        } catch (err) {
          console.error('[LANDING-POLLING] Error:', err);
        }
      }, 3000); // Cada 3 segundos - menos agresivo
    }
    return () => {
      if (check) {
        console.log('[LANDING] Deteniendo polling');
        clearInterval(check);
      }
    };
  }, [isConnected, showQRModal, pendingSessionId, onQRSuccess, navigate]);

  // Socket setup
  useEffect(() => {
    const socketURL = getSocketURL();
    const newSocket = io(socketURL, {
      transports: ['websocket', 'polling'],
      autoConnect: true
    });
    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('Socket conectado');
    });

    newSocket.on('disconnect', () => {
      console.log('Socket desconectado');
    });

    // Evento GLOBAL de conexión exitosa (filtrado por pendingSessionId)
    newSocket.on('connection-update', (data: any) => {
      const currentPendingSessionId = pendingSessionIdRef.current;
      console.log('🔥 [LANDING] Evento connection-update recibido:', {
        status: data.status,
        sessionId: data.sessionId,
        phoneNumber: data.phoneNumber,
        oldSessionId: data.oldSessionId
      });
      console.log('🔥 [LANDING] PendingSessionId actual (ref):', currentPendingSessionId);

      // Solo aceptar si corresponde a la sesión que ESTE navegador inició
      const isOurSession = !!currentPendingSessionId && (
        data.sessionId === currentPendingSessionId || data.oldSessionId === currentPendingSessionId
      );

      console.log('🔥 [LANDING] ¿Es nuestra sesión?:', isOurSession);

      if (data.status === 'connected' && (data.sessionId || data.phoneNumber)) {
        if (currentPendingSessionId && isOurSession) {
          const finalSessionId = data.phoneNumber || data.sessionId;
          console.log(`✅ [LANDING] ¡CONEXIÓN EXITOSA! SessionId: ${finalSessionId}`);

          setIsConnected(true);
          setSessionId(finalSessionId);
          setShowQRModal(false);
          setLoading(false);
          sessionStorage.setItem('whatsflow_session', finalSessionId);

          // Limpiar sesiones previas
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('whatsflow_token');
          sessionStorage.removeItem('userRole');
          sessionStorage.removeItem('userId');
          sessionStorage.removeItem('userName');
          sessionStorage.removeItem('userEmail');

          console.log('📱 [LANDING] Llamando onQRSuccess y navegando al dashboard...');
          onQRSuccess(finalSessionId);

          // Redirigir al dashboard INMEDIATAMENTE
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
            console.log('🚀 [LANDING] Navegación ejecutada');
          }, 100);
        } else if (!currentPendingSessionId && showQRModal && !sessionId) {
          const finalSessionId = data.phoneNumber || data.sessionId;
          console.log(`✅ [LANDING] Conexión sin pendingSessionId previo: ${finalSessionId}`);

          setIsConnected(true);
          setSessionId(finalSessionId);
          setShowQRModal(false);
          setLoading(false);
          sessionStorage.setItem('whatsflow_session', finalSessionId);

          onQRSuccess(finalSessionId);
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 100);
        } else {
          console.log('🛡️ [LANDING] Ignorando evento - no es nuestra sesión');
        }
      } else if (data.status === 'disconnected') {
        console.log('📱 [LANDING] WhatsApp desconectado');
        setIsConnected(false);
        setSessionId(null);
        setQrDataUrl(null);
        localStorage.removeItem('whatsflow_session');
        localStorage.removeItem('whatsflow_user_type');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('whatsflow_token');
        sessionStorage.removeItem('userRole');
        sessionStorage.removeItem('userId');
        sessionStorage.removeItem('userName');
        sessionStorage.removeItem('userEmail');
      }
    });

    // Redirección alternativa: si llega token por Socket.IO, guardar y navegar
    newSocket.on('auth_token', (data: any) => {
      if (data?.token) {
        try {
          localStorage.setItem('token', data.token);
          sessionStorage.setItem('token', data.token);
        } catch { }
        navigate('/dashboard', { replace: true });
      }
    });

    // Evento específico de WhatsApp conectado (filtrado por pendingSessionId)
    newSocket.on('whatsapp-connected', (data: any) => {
      const currentPendingSessionId = pendingSessionIdRef.current;
      console.log('✅ [LANDING] Evento whatsapp-connected recibido:', {
        sessionId: data.sessionId,
        phoneNumber: data.phoneNumber
      });

      // Solo aceptar si corresponde a la sesión que ESTE navegador inició
      if (!currentPendingSessionId || (data.sessionId !== currentPendingSessionId)) {
        console.log('⏭️ [LANDING] Ignorando - no es nuestra sesión');
        return;
      }

      const finalSessionId = data.phoneNumber || data.sessionId;
      console.log(`✅ [LANDING] ¡WHATSAPP CONECTADO! SessionId: ${finalSessionId}`);

      setIsConnected(true);
      setSessionId(finalSessionId);
      setShowQRModal(false);
      setLoading(false);
      sessionStorage.setItem('whatsflow_session', finalSessionId);

      console.log('📱 [LANDING] Llamando onQRSuccess y navegando al dashboard...');
      onQRSuccess(finalSessionId);

      setTimeout(() => {
        navigate('/dashboard', { replace: true });
        console.log('🚀 [LANDING] Navegación ejecutada');
      }, 100);
    });

    // Evento de QR generado
    newSocket.on('qr-code', (data: any) => {
      console.log('📱 [LANDING] QR Code recibido:', {
        sessionId: data.sessionId,
        timestamp: data.timestamp,
        expiresIn: data.expiresIn
      });

      const currentPendingSessionId = pendingSessionIdRef.current;

      // Solo aceptar QR si es de nuestra sesión o si no hay sesión pendiente aún
      if (!currentPendingSessionId || data.sessionId === currentPendingSessionId) {
        if (data.qrDataUrl) {
          console.log('✅ [LANDING] Mostrando QR Code');
          setQrDataUrl(data.qrDataUrl);
          setLoading(false);
        }
      } else {
        console.log('⏭️ [LANDING] Ignorando QR - no es de nuestra sesión');
      }
    });



    return () => {
      console.log('[LANDING] Desconectando socket...');
      newSocket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo ejecutar una vez al montar el componente

  const fetchQR = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('🔄 Creando nueva sesión de WhatsApp...');

      // Leer preferencia de sincronización desde localStorage
      const syncHistory = localStorage.getItem('whatsflow_sync_history') === 'true';
      console.log('📊 Sincronización de historial:', syncHistory ? 'ACTIVADA' : 'DESACTIVADA');

      const baseURL = getAPIBaseURL();
      // Vincular esta creación de sesión al dispositivo/navegador
      let deviceId = sessionStorage.getItem('whatsflow_device_id');
      if (!deviceId) {
        deviceId = crypto.randomUUID ? crypto.randomUUID() : `device_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem('whatsflow_device_id', deviceId);
      }

      // ✅ CRÍTICO: Obtener userId del usuario logueado para vincular la sesión
      const userId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
      console.log('👤 Usuario logueado (userId):', userId);

      const response = await fetch(`${baseURL}/api/create-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syncHistory,
          deviceId,
          ownerPhone: userId // ✅ Vincular sesión con el usuario logueado
        })
      });

      const data = await response.json();
      console.log('📱 Respuesta sesión:', data);

      if (data.success) {
        if (data.isConnected) {
          setIsConnected(true);
          setSessionId(data.sessionId);
          setLoading(false);
          setShowQRModal(false);
          onQRSuccess(data.sessionId);

          // Redirigir al dashboard INMEDIATAMENTE
          console.log('✅ Ya está conectado, redirigiendo al dashboard...');
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 500);
          return;
        }

        // Sesión creada, esperando QR: unirse a la sala de la sesión
        console.log('✅ Sesión creada, esperando código QR...');
        setPendingSessionId(data.sessionId);
        setSessionId(data.sessionId);
        socketRef.current?.emit('join-session', { sessionId: data.sessionId });
        setShowQRModal(true);
      } else {
        setError(data.error || 'Error al crear sesión');
        setLoading(false);
      }
    } catch (err) {
      console.error('❌ Error:', err);
      setError('Error de conexión');
      setLoading(false);
    }
  };



  const handleConnect = () => {
    // Prevenir múltiples llamadas si ya está cargando o conectado
    if (loading || isConnected || showQRModal) {
      console.log('⚠️ [LANDING] Ya hay una conexión en proceso, ignorando...');
      return;
    }
    console.log('🔄 [LANDING] Iniciando conexión...');
    setShowQRModal(true);
    fetchQR();
  };


  // ❌ ELIMINADO: Generación automática de QR
  // Ahora el usuario debe hacer clic en "Conectar por QR" para generar el código

  const handleRefreshStatus = async () => {
    if (!pendingSessionId) return;

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/session/${pendingSessionId}/status`);
      const data = await response.json();

      if (data.success && data.isConnected) {
        const finalSessionId = data.phoneNumber || pendingSessionId;
        console.log('✅ Sesión conectada!');

        setIsConnected(true);
        setSessionId(finalSessionId);
        setShowQRModal(false);
        sessionStorage.setItem('whatsflow_session', finalSessionId);

        onQRSuccess(finalSessionId);
        navigate('/dashboard', { replace: true });
      }
    } catch (error) {
      console.error('Error verificando estado:', error);
    }
  };

  if (!isConnected) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: '#0f172a', // Deep Slate
          color: 'white',
          fontFamily: '"Inter", "Segoe UI", sans-serif'
        }}
      >
        {/* Hero Section */}
        <Box
          sx={{
            background: 'radial-gradient(circle at top right, #1e293b 0%, #0f172a 50%)',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Header */}
          <Box sx={{ p: 3, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <Container maxWidth="lg">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 16px rgba(79, 70, 229, 0.3)'
                  }}
                >
                  <WhatsApp sx={{ color: 'white', fontSize: 24 }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
                  WhatsFlow
                </Typography>
              </Box>
            </Container>
          </Box>

          {/* Main Content */}
          <Container maxWidth="lg" sx={{ flex: 1, display: 'flex', alignItems: 'center', py: 8 }}>
            <Grid container spacing={6} alignItems="center">
              {/* Left Side - Text & Agent Button */}
              <Grid item xs={12} md={6}>
                <Box sx={{ pr: { md: 4 } }}>
                  <Typography
                    variant="h2"
                    sx={{
                      fontWeight: 800,
                      fontSize: { xs: '2.5rem', md: '3.5rem' },
                      lineHeight: 1.1,
                      mb: 3,
                      background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}
                  >
                    La plataforma WhatsApp que su empresa necesita
                  </Typography>

                  <Typography
                    variant="h6"
                    sx={{
                      color: '#94a3b8',
                      mb: 4,
                      lineHeight: 1.6,
                      fontWeight: 400
                    }}
                  >
                    Automatice, mida y escale conversaciones de negocio con IA, campañas y reportes. Unifique equipos y canales en una sola plataforma.
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Button
                      variant="outlined"
                      size="large"
                      onClick={() => navigate('/login')}
                      sx={{
                        borderRadius: 3,
                        px: 4,
                        py: 1.5,
                        borderColor: '#6366f1',
                        color: '#818cf8',
                        fontWeight: 600,
                        textTransform: 'none',
                        fontSize: '1rem',
                        '&:hover': {
                          borderColor: '#818cf8',
                          bgcolor: 'rgba(99, 102, 241, 0.1)'
                        }
                      }}
                    >
                      <Person sx={{ mr: 1 }} />
                      Acceder como Agente
                    </Button>
                  </Box>

                  {/* Features List */}
                  <Box sx={{ mt: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {[
                      { icon: <CheckCircle sx={{ color: '#10b981' }} />, text: 'Multi-agente en tiempo real' },
                      { icon: <CheckCircle sx={{ color: '#10b981' }} />, text: 'Chatbots inteligentes con IA' },
                      { icon: <CheckCircle sx={{ color: '#10b981' }} />, text: 'Campañas masivas programadas' }
                    ].map((feature, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {feature.icon}
                        <Typography sx={{ color: '#cbd5e1' }}>{feature.text}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Grid>

              {/* Right Side - QR Code */}
              <Grid item xs={12} md={6} id="qr-block">
                <Card
                  sx={{
                    background: 'rgba(30, 41, 59, 0.6)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 4,
                    p: 4,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                  }}
                >
                  <Box sx={{ textAlign: 'center' }}>
                    <QrCode sx={{ fontSize: 48, color: '#6366f1', mb: 2 }} />
                    <Typography variant="h5" sx={{ fontWeight: 600, mb: 1, color: 'white' }}>
                      Conecta tu WhatsApp
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#94a3b8', mb: 4 }}>
                      Escanea el código QR con tu teléfono
                    </Typography>

                    {/* QR Code Display */}
                    <Box
                      sx={{
                        bgcolor: 'white',
                        borderRadius: 3,
                        p: 3,
                        display: 'inline-block',
                        mb: 3
                      }}
                    >
                      {loading ? (
                        <Box sx={{ width: 256, height: 256, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CircularProgress size={60} sx={{ color: '#6366f1' }} />
                        </Box>
                      ) : qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt="QR Code"
                          style={{ width: 256, height: 256, display: 'block' }}
                        />
                      ) : (
                        <Box sx={{ width: 256, height: 256, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
                          <QrCode sx={{ fontSize: 80, color: '#cbd5e1' }} />
                          <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>
                            Haz clic para generar el código QR
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    {/* 🆕 Botones de Control - Similar a la imagen de referencia */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                      <Button
                        variant="contained"
                        fullWidth
                        size="large"
                        onClick={fetchQR}
                        disabled={loading}
                        startIcon={<QrCode />}
                        sx={{
                          bgcolor: '#10b981',
                          color: 'white',
                          py: 1.5,
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 600,
                          fontSize: '1rem',
                          '&:hover': {
                            bgcolor: '#059669'
                          },
                          '&:disabled': {
                            bgcolor: '#6b7280',
                            color: '#d1d5db'
                          }
                        }}
                      >
                        {qrDataUrl ? 'Regenerar QR' : 'Conectar por QR'}
                      </Button>

                      {pendingSessionId && (
                        <Button
                          variant="outlined"
                          fullWidth
                          size="large"
                          onClick={handleRefreshStatus}
                          startIcon={<Refresh />}
                          sx={{
                            borderColor: '#6366f1',
                            color: '#6366f1',
                            py: 1.5,
                            borderRadius: 2,
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '1rem',
                            '&:hover': {
                              borderColor: '#4f46e5',
                              bgcolor: 'rgba(99, 102, 241, 0.1)'
                            }
                          }}
                        >
                          Actualizar estado
                        </Button>
                      )}
                    </Box>

                    {/* Instructions */}
                    <Box sx={{ textAlign: 'left', color: '#cbd5e1', fontSize: '0.9rem' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: 'white' }}>
                        Pasos para conectar:
                      </Typography>
                      <ol style={{ paddingLeft: '1.5rem', margin: 0 }}>
                        <li style={{ marginBottom: '0.5rem' }}>Abre WhatsApp en tu teléfono</li>
                        <li style={{ marginBottom: '0.5rem' }}>Ve a Configuración → Dispositivos vinculados</li>
                        <li style={{ marginBottom: '0.5rem' }}>Toca "Vincular un dispositivo"</li>
                        <li>Escanea este código QR</li>
                      </ol>
                    </Box>
                  </Box>
                </Card>
              </Grid>
            </Grid>
          </Container>
        </Box>

        {/* Testimonios / Confianza */}
        <Box
          sx={{
            bgcolor: '#1e293b',
            py: 10,
            borderTop: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          <Container maxWidth="lg">
            <Box sx={{ textAlign: 'center', mb: 8 }}>
              <Typography variant="h3" sx={{ fontWeight: 700, color: 'white', mb: 2 }}>
                Confianza y resultados
              </Typography>
              <Typography variant="h6" sx={{ color: '#94a3b8' }}>
                Equipos comerciales y de soporte ya optimizan su WhatsApp con WhatsFlow
              </Typography>
            </Box>
            <Grid container spacing={3}>
              {[
                '“Automatizamos respuestas y redujimos tiempos de atención en un 45%.”',
                '“Las campañas programadas nos duplicaron los leads calificados.”',
                '“El reporte por estados nos permitió mejorar el embudo de ventas.”'
              ].map((quote, i) => (
                <Grid item xs={12} md={4} key={i}>
                  <Card
                    sx={{
                      height: '100%',
                      bgcolor: '#0f172a',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 3,
                      p: 3
                    }}
                  >
                    <Typography variant="body1" sx={{ color: '#cbd5e1' }}>
                      {quote}
                    </Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* CTA final */}
        <Box
          sx={{
            bgcolor: '#0f172a',
            py: 10,
            borderTop: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          <Container maxWidth="lg">
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ color: 'white', fontWeight: 800, mb: 2 }}>
                Conecte su WhatsApp ahora
              </Typography>
              <Typography variant="h6" sx={{ color: '#94a3b8', mb: 4 }}>
                Escanee el QR y empiece a automatizar, medir y vender más
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={() => document.getElementById('qr-block')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                sx={{
                  bgcolor: '#6366f1',
                  borderRadius: 3,
                  px: 4,
                  py: 1.5,
                  '&:hover': { bgcolor: '#4f46e5' }
                }}
              >
                Conectar con QR
              </Button>
            </Box>
          </Container>
        </Box>

        {/* Integraciones y API REST */}
        <Box
          sx={{
            bgcolor: '#1e293b',
            py: 10,
            borderTop: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          <Container maxWidth="lg">
            <Box sx={{ textAlign: 'center', mb: 8 }}>
              <Typography variant="h3" sx={{ fontWeight: 700, color: 'white', mb: 2 }}>
                Integraciones y API REST
              </Typography>
              <Typography variant="h6" sx={{ color: '#94a3b8' }}>
                Conecte sus sistemas con una API simple y segura
              </Typography>
            </Box>
            <Grid container spacing={4} alignItems="center">
              <Grid item xs={12} md={6}>
                <Box sx={{ borderRadius: 3, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <img src="/api-rest.svg" alt="API REST" style={{ width: '100%', height: 260, objectFit: 'cover' }} loading="lazy" />
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ color: 'white', fontWeight: 700, mb: 2 }}>
                  Casos de uso
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {[
                    'Sincronizar contactos y etiquetas con su CRM',
                    'Disparar campañas transaccionales desde su ERP',
                    'Recibir webhooks de eventos (entregas, respuestas, cambios de estado)'
                  ].map((t, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <CheckCircle sx={{ color: '#10b981' }} />
                      <Typography variant="body1" sx={{ color: '#cbd5e1' }}>{t}</Typography>
                    </Box>
                  ))}
                </Box>
              </Grid>
            </Grid>
          </Container>
        </Box>

        {/* Cómo funciona */}
        <Box
          sx={{
            bgcolor: '#0f172a',
            py: 10,
            borderTop: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          <Container maxWidth="lg">
            <Box sx={{ textAlign: 'center', mb: 8 }}>
              <Typography variant="h3" sx={{ fontWeight: 700, color: 'white', mb: 2 }}>
                Cómo funciona
              </Typography>
              <Typography variant="h6" sx={{ color: '#94a3b8' }}>
                Conecte con QR y gestione todo desde un solo lugar
              </Typography>
            </Box>
            <Grid container spacing={3}>
              {[
                { step: '1', title: 'Generar QR', desc: 'Cree una sesión y obtenga el código.' },
                { step: '2', title: 'Escanear', desc: 'Use WhatsApp → Dispositivos vinculados.' },
                { step: '3', title: 'Conectar', desc: 'El sistema detecta la conexión automáticamente.' },
                { step: '4', title: 'Gestionar', desc: 'Campañas, IA, calendarios y CRM.' },
                { step: '5', title: 'Medir', desc: 'Reportes por estado y embudos.' }
              ].map((s, i) => (
                <Grid item xs={12} sm={6} md={2.4 as any} key={i}>
                  <Card
                    sx={{
                      height: '100%',
                      bgcolor: '#0f172a',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 3,
                      p: 3,
                      textAlign: 'center'
                    }}
                  >
                    <Box sx={{ fontSize: 28, fontWeight: 800, color: '#6366f1', mb: 1 }}>{s.step}</Box>
                    <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 700 }}>
                      {s.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                      {s.desc}
                    </Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* Detalle de módulos */}
        <Box
          sx={{
            bgcolor: '#1e293b',
            py: 10,
            borderTop: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          <Container maxWidth="lg">
            <Box sx={{ textAlign: 'center', mb: 8 }}>
              <Typography variant="h3" sx={{ fontWeight: 700, color: 'white', mb: 2 }}>
                Detalle de módulos
              </Typography>
              <Typography variant="h6" sx={{ color: '#94a3b8' }}>
                Vea cómo cada módulo potencia su operación
              </Typography>
            </Box>
            {[
              { img: '/campaigns.svg', title: 'Campañas masivas y programadas', bullets: ['Segmentación por etiquetas', 'Plantillas reutilizables', 'Calendario de envíos y reintentos'] },
              { img: '/chatbot-ia.svg', title: 'Chatbot con IA', bullets: ['Respuestas contextuales', 'Flujos guiados', 'Transferencia a agente'] },
              { img: '/calendario.svg', title: 'Calendarios inteligentes', bullets: ['Reservas automáticas', 'Recordatorios y confirmaciones', 'Reprogramaciones por chat'] },
              { img: '/historial.svg', title: 'Historial y análisis', bullets: ['Conversación unificada', 'Búsqueda avanzada', 'Etiquetado y notas'] },
              { img: '/reportes.svg', title: 'Reportes por estado', bullets: ['Métricas SLA', 'Embudos de conversión', 'Exportaciones'] },
              { img: '/api-rest.svg', title: 'API REST', bullets: ['Integración ERP/CRM', 'Webhooks', 'Mensajería transaccional'] },
              { img: '/multi-conexiones.svg', title: 'Múltiples conexiones', bullets: ['Sesiones paralelas', 'Equipos multi-agente', 'Aislamiento por dispositivo'] },
              { img: '/seguimiento.svg', title: 'Seguimiento de leads', bullets: ['Kanban visual', 'Automatizaciones', 'Alertas de etapa'] }
            ].map((d, i) => (
              <Grid container spacing={4} alignItems="center" sx={{ mb: 6 }} key={i}>
                <Grid item xs={12} md={6} order={{ xs: 2, md: i % 2 === 0 ? 1 : 2 }}>
                  <Typography variant="h5" sx={{ color: 'white', fontWeight: 700, mb: 2 }}>
                    {d.title}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {d.bullets.map((b, bi) => (
                      <Box key={bi} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <CheckCircle sx={{ color: '#10b981' }} />
                        <Typography variant="body1" sx={{ color: '#cbd5e1' }}>{b}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Grid>
                <Grid item xs={12} md={6} order={{ xs: 1, md: i % 2 === 0 ? 2 : 1 }}>
                  <Box sx={{ borderRadius: 3, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <img src={d.img} alt={d.title} style={{ width: '100%', height: 260, objectFit: 'cover' }} loading="lazy" />
                  </Box>
                </Grid>
              </Grid>
            ))}
          </Container>
        </Box>

        {/* Módulos del sistema (con imágenes) */}
        <Box
          sx={{
            bgcolor: '#0f172a',
            py: 10,
            borderTop: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          <Container maxWidth="lg">
            <Box sx={{ textAlign: 'center', mb: 8 }}>
              <Typography variant="h3" sx={{ fontWeight: 700, color: 'white', mb: 2 }}>
                Módulos del sistema
              </Typography>
              <Typography variant="h6" sx={{ color: '#94a3b8' }}>
                Funcionalidades clave para campañas, automatización y análisis
              </Typography>
            </Box>
            <Grid container spacing={3}>
              {[
                { img: '/campaigns.svg', title: 'Campañas', desc: 'Envíos masivos, segmentación y plantillas.' },
                { img: '/chatbot-ia.svg', title: 'Chatbot con IA', desc: 'Respuestas contextuales y handoff a agente.' },
                { img: '/calendario.svg', title: 'Calendarios inteligentes', desc: 'Reservas, recordatorios y reprogramaciones.' },
                { img: '/historial.svg', title: 'Historial y análisis', desc: 'Conversaciones centralizadas y búsqueda avanzada.' },
                { img: '/reportes.svg', title: 'Reportes por estados', desc: 'Embudos y métricas de conversión.' },
                { img: '/api-rest.svg', title: 'API REST', desc: 'Integración con ERP/CRM y webhooks.' },
                { img: '/multi-conexiones.svg', title: 'Múltiples conexiones', desc: 'Varias sesiones y equipos paralelos.' },
                { img: '/seguimiento.svg', title: 'Seguimiento de leads', desc: 'Kanban de contactos y etapas.' }
              ].map((m, i) => (
                <Grid item xs={12} sm={6} md={3} key={i}>
                  <Card
                    sx={{
                      height: '100%',
                      bgcolor: '#0f172a',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 3,
                      p: 3,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2
                    }}
                  >
                    <Box sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <img src={m.img} alt={m.title} style={{ width: '100%', height: 120, objectFit: 'cover' }} loading="lazy" />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: 'white' }}>
                      {m.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                      {m.desc}
                    </Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* Beneficios - Por qué WhatsFlow */}
        <Box
          sx={{
            bgcolor: '#0f172a',
            py: 8,
            borderTop: '1px solid rgba(255,255,255,0.05)'
          }}
        >
          <Container maxWidth="lg">
            <Box sx={{ textAlign: 'center', mb: 6 }}>
              <Typography
                variant="h3"
                sx={{ fontWeight: 700, color: 'white', mb: 2 }}
              >
                ¿Por qué WhatsFlow?
              </Typography>
              <Typography variant="h6" sx={{ color: '#94a3b8', fontWeight: 400 }}>
                Este sistema no puede faltar en su empresa: conecte, automatice y venda más.
              </Typography>
            </Box>
            <Grid container spacing={3}>
              {[
                { title: 'Automatización con IA', desc: 'Chatbots contextuales que reducen tiempos de respuesta y mejoran la experiencia.' },
                { title: 'Escalabilidad', desc: 'Múltiples agentes y conexiones para equipos que crecen sin fricciones.' },
                { title: 'Medición y reportes', desc: 'Métricas por estado y embudos para optimizar decisiones.' },
                { title: 'Integraciones', desc: 'API REST para conectar con ERP/CRM y sistemas internos.' }
              ].map((item, idx) => (
                <Grid item xs={12} sm={6} md={3} key={idx}>
                  <Card
                    sx={{
                      height: '100%',
                      bgcolor: '#0f172a',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 3,
                      p: 3
                    }}
                  >
                    <Typography variant="h6" sx={{ color: 'white', mb: 1, fontWeight: 600 }}>
                      {item.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                      {item.desc}
                    </Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* Services Section */}
        <Box
          sx={{
            bgcolor: '#1e293b',
            py: 10,
            borderTop: '1px solid rgba(255,255,255,0.05)'
          }}
        >
          <Container maxWidth="lg">
            <Box sx={{ textAlign: 'center', mb: 8 }}>
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 700,
                  mb: 2,
                  color: 'white'
                }}
              >
                Nuestros Servicios
              </Typography>
              <Typography variant="h6" sx={{ color: '#94a3b8', fontWeight: 400 }}>
                Todo lo que necesitas para gestionar tu negocio en WhatsApp
              </Typography>
            </Box>

            <Grid container spacing={3}>
              {[
                {
                  icon: <Message sx={{ fontSize: 40 }} />,
                  title: 'Chat Multi-agente',
                  description: 'Gestión de conversaciones con múltiples agentes en tiempo real',
                  color: '#6366f1'
                },
                {
                  icon: <Campaign sx={{ fontSize: 40 }} />,
                  title: 'Campañas Masivas',
                  description: 'Envío masivo de mensajes programados y personalizados',
                  color: '#ff9800'
                },
                {
                  icon: <Settings sx={{ fontSize: 40 }} />,
                  title: 'Chatbots Inteligentes',
                  description: 'Automatización de respuestas con inteligencia artificial',
                  color: '#e91e63'
                },
                {
                  icon: <People sx={{ fontSize: 40 }} />,
                  title: 'CRM Integrado',
                  description: 'Gestión completa de contactos y clientes',
                  color: '#00bcd4'
                },
                {
                  icon: <Schedule sx={{ fontSize: 40 }} />,
                  title: 'Calendario de Citas',
                  description: 'Programación y seguimiento de citas automático',
                  color: '#3b82f6'
                },
                {
                  icon: <Analytics sx={{ fontSize: 40 }} />,
                  title: 'Analytics en Tiempo Real',
                  description: 'Métricas y estadísticas detalladas de tu negocio',
                  color: '#10b981'
                },
                {
                  icon: <TrendingUp sx={{ fontSize: 40 }} />,
                  title: 'Kanban de Contactos',
                  description: 'Organización visual de leads y pipeline de ventas',
                  color: '#9c27b0'
                },
                {
                  icon: <Message sx={{ fontSize: 40 }} />,
                  title: 'API para Mensajes',
                  description: 'Integración con sistemas externos vía API REST',
                  color: '#64748b'
                }
              ].map((service, index) => (
                <Grid item xs={12} sm={6} md={3} key={index}>
                  <Card
                    sx={{
                      height: '100%',
                      bgcolor: '#0f172a',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: 3,
                      p: 3,
                      transition: 'all 0.3s',
                      '&:hover': {
                        transform: 'translateY(-8px)',
                        borderColor: service.color,
                        boxShadow: `0 20px 40px ${service.color}20`
                      }
                    }}
                  >
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: 3,
                        bgcolor: `${service.color}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2,
                        color: service.color
                      }}
                    >
                      {service.icon}
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: 'white' }}>
                      {service.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#94a3b8', lineHeight: 1.6 }}>
                      {service.description}
                    </Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* Botón flotante de WhatsApp */}
        <Fab
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            bgcolor: '#25D366',
            color: 'white',
            width: 64,
            height: 64,
            boxShadow: '0 8px 24px rgba(37, 211, 102, 0.4)',
            '&:hover': {
              bgcolor: '#20BA5A',
              transform: 'scale(1.1)',
              boxShadow: '0 12px 32px rgba(37, 211, 102, 0.6)'
            },
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: 1000
          }}
          href="https://wa.me/595994854167"
          target="_blank"
          rel="noopener noreferrer"
        >
          <WhatsApp sx={{ fontSize: 32 }} />
        </Fab>

        {/* Footer */}
        <Box
          sx={{
            bgcolor: '#0f172a',
            py: 4,
            borderTop: '1px solid rgba(255,255,255,0.05)'
          }}
        >
          <Container maxWidth="lg">
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 1 }}>
                © 2025 WhatsFlow - Plataforma Empresarial de WhatsApp
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                Todos los Derechos Reservados por <strong>CNID</strong> Centro-Nacional-Información-Digital NRO REG: 17789
              </Typography>
            </Box>
          </Container>
        </Box>

        {/* Botón flotante de WhatsApp */}
        <Fab
          sx={{
            position: 'fixed',
            bottom: 32,
            right: 32,
            bgcolor: '#25D366',
            color: 'white',
            width: 70,
            height: 70,
            boxShadow: '0 8px 24px rgba(37, 211, 102, 0.4)',
            transition: 'all 0.3s ease',
            zIndex: 1000,
            '&:hover': {
              bgcolor: '#20BA5A',
              transform: 'scale(1.1)',
              boxShadow: '0 12px 32px rgba(37, 211, 102, 0.6)',
            },
            animation: 'pulse 2s infinite',
            '@keyframes pulse': {
              '0%': {
                boxShadow: '0 8px 24px rgba(37, 211, 102, 0.4)',
              },
              '50%': {
                boxShadow: '0 8px 32px rgba(37, 211, 102, 0.6)',
              },
              '100%': {
                boxShadow: '0 8px 24px rgba(37, 211, 102, 0.4)',
              },
            },
          }}
          onClick={() => {
            window.open('https://wa.me/595994854167?text=Hola%2C%20me%20interesa%20WhatsFlow', '_blank');
          }}
          aria-label="Contactar por WhatsApp"
        >
          <WhatsApp sx={{ fontSize: 40 }} />
        </Fab>
      </Box>
    );
  }

  return (
    <Box sx={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      bgcolor: '#0f172a'
    }}>
      <CircularProgress size={60} sx={{ color: '#6366f1', mb: 4 }} />
      <Typography variant="h5" sx={{ color: 'white', fontWeight: 300 }}>
        Conectando con WhatsApp...
      </Typography>
      <Typography variant="body2" sx={{ color: '#94a3b8', mt: 1 }}>
        Por favor espere mientras verificamos su sesión
      </Typography>
    </Box>
  );



};

export default LandingPage;
