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


  // VERIFICAR SI YA HAY SESIÓN ACTIVA AL CARGAR + POLLING COMO RESPALDO
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

    // POLLING agresivo: verificar is_active en DB cada 2 segundos
    const intervalCheck = setInterval(async () => {
      if (isConnected) {
        clearInterval(intervalCheck);
        return;
      }

      try {
        const currentDeviceId = sessionStorage.getItem('whatsflow_device_id') || '';
        const savedToken = sessionStorage.getItem('whatsflow_token') || '';

        // 1. Primero intentar con pendingSessionId si existe
        if (pendingSessionId) {
          const response = await fetch(`${getAPIBaseURL()}/api/session/${pendingSessionId}/status`, {
            headers: {
              'x-device-id': currentDeviceId,
              'x-session-token': savedToken
            }
          });
          const data = await response.json();

          console.log('[LANDING-POLLING-PENDING] Respuesta:', data);

          if (data.success && data.isConnected) {
            console.log('✅ [LANDING-POLLING] Sesión conectada detectada!');
            const finalSessionId = data.phoneNumber || data.sessionId || pendingSessionId;
            console.log('📱 [LANDING-POLLING] Guardando sessionId:', finalSessionId);

            setIsConnected(true);
            setSessionId(finalSessionId);
            setShowQRModal(false);
            setLoading(false);
            sessionStorage.setItem('whatsflow_session', finalSessionId);

            onQRSuccess(finalSessionId);
            navigate('/dashboard', { replace: true });
            clearInterval(intervalCheck);
            return;
          }
        }

        // 2. Si no hay pendingSessionId o no se encontró, buscar por deviceId
        // Esto detectará la sesión que acaba de conectarse incluso si no conocemos su ID
        const checkResponse = await fetch(`${getAPIBaseURL()}/api/session/check-by-device`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-device-id': currentDeviceId
          },
          body: JSON.stringify({ deviceId: currentDeviceId })
        });

        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          console.log('[LANDING-POLLING-DEVICE] Respuesta:', checkData);

          if (checkData.success && checkData.isConnected) {
            console.log('✅ [LANDING-POLLING-DEVICE] Sesión activa encontrada por deviceId!');
            const finalSessionId = checkData.phoneNumber || checkData.sessionId;

            setIsConnected(true);
            setSessionId(finalSessionId);
            setShowQRModal(false);
            setLoading(false);
            sessionStorage.setItem('whatsflow_session', finalSessionId);

            onQRSuccess(finalSessionId);
            navigate('/dashboard', { replace: true });
            clearInterval(intervalCheck);
          }
        }
      } catch (e) {
        console.error('[LANDING-POLLING] Error:', e);
      }
    }, 2000);

    return () => clearInterval(intervalCheck);
  }, [isConnected, pendingSessionId, navigate, onQRSuccess]);

  // POLLING ELIMINADO POR SEGURIDAD
  // El polling anterior buscaba cualquier sesión activa (de cualquier usuario)
  // Ahora la conexión se detecta solo via Socket.IO cuando EL USUARIO escanea su propio QR
  // useEffect para escuchar eventos de Socket.IO ya maneja la conexión correctamente

  // VERIFICACIÓN: Solo permitir conexión de la sesión iniciada por este navegador
  useEffect(() => {
    let check: ReturnType<typeof setInterval> | undefined;
    if (!isConnected && showQRModal && pendingSessionId) {
      check = setInterval(async () => {
        try {
          const response = await fetch(`${getAPIBaseURL()}/api/session/${pendingSessionId}/status`);
          const data = await response.json();
          if (data.success && data.isConnected) {
            const finalSessionId = data.phoneNumber || pendingSessionId;
            setIsConnected(true);
            setSessionId(finalSessionId);
            setShowQRModal(false);
            setLoading(false);
            sessionStorage.setItem('whatsflow_session', finalSessionId);
            onQRSuccess(finalSessionId);
            if (check) clearInterval(check);
          }
        } catch { }
      }, 1500);
    }
    return () => { if (check) clearInterval(check); };
  }, [isConnected, showQRModal, pendingSessionId, onQRSuccess]);

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
      console.log('🔥 [LANDING] Conexión exitosa detectada:', data);
      console.log('🔥 [LANDING] Status:', data.status, 'SessionId:', data.sessionId, 'PhoneNumber:', data.phoneNumber);
      console.log('🔥 [LANDING] PendingSessionId actual (ref):', currentPendingSessionId);

      // Solo aceptar si corresponde a la sesión que ESTE navegador inició
      const isOurSession = !!currentPendingSessionId && (
        data.sessionId === currentPendingSessionId || data.oldSessionId === currentPendingSessionId
      );

      console.log('🔥 [LANDING] ¿Es nuestra sesión?:', isOurSession);

      if (data.status === 'connected' && (data.sessionId || data.phoneNumber)) {
        // Si no hay pendingSessionId pero el evento contiene phoneNumber o sessionId que coincide con deviceId, también aceptar
        // Para evitar ignorar conexiones válidas, permitimos si el usuario está en la página de landing (showQRModal true)
        if (currentPendingSessionId && isOurSession) {
          // USAR EL NÚMERO DE TELÉFONO si está disponible, sino usar sessionId
          const finalSessionId = data.phoneNumber || data.sessionId;
          console.log(`📱 [LANDING] Guardando sesión: ${finalSessionId}`);

          setIsConnected(true);
          setSessionId(finalSessionId);
          setShowQRModal(false);
          setLoading(false);

          // Limpiar cualquier información de sesión previa de otros usuarios
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('whatsflow_token');
          sessionStorage.removeItem('userRole');
          sessionStorage.removeItem('userId');
          sessionStorage.removeItem('userName');
          sessionStorage.removeItem('userEmail');

          console.log('📱 [LANDING] Llamando onQRSuccess con:', finalSessionId);
          onQRSuccess(finalSessionId);

          // Redirigir al dashboard INMEDIATAMENTE - SIN TIMEOUT
          console.log('✅ [LANDING] Redirigiendo al dashboard AHORA...');
          navigate('/dashboard', { replace: true });
          console.log('🚀 [LANDING] Navegación ejecutada');
        } else {
          // Si no tenemos pendingSessionId pero el evento es de conexión, podríamos aceptarlo si estamos en modal
          // Esto puede ocurrir si pendingSessionId se perdió pero el socket aún está escuchando
          // Por seguridad, ignoramos pero logueamos
          console.log('🛡️ [LANDING] Ignorando evento de conexión ajeno (pendingSessionId:', currentPendingSessionId, ')');
        }
      } else if (data.status === 'disconnected') {
        console.log('📱 WhatsApp desconectado, redirigiendo al inicio...');
        setIsConnected(false);
        setSessionId(null);
        setQrDataUrl(null);
        // Limpiar localStorage
        localStorage.removeItem('whatsflow_session');
        localStorage.removeItem('whatsflow_user_type');
        // Limpiar cualquier información de usuario también en desconexión
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('whatsflow_token');
        sessionStorage.removeItem('userRole');
        sessionStorage.removeItem('userId');
        sessionStorage.removeItem('userName');
        sessionStorage.removeItem('userEmail');
        // La redirección se manejará automáticamente por el App.tsx
      }
    });

    // Evento específico de WhatsApp conectado (filtrado por pendingSessionId)
    newSocket.on('whatsapp-connected', (data: any) => {
      const currentPendingSessionId = pendingSessionIdRef.current;
      console.log('✅ [LANDING] WhatsApp conectado exitosamente:', data);
      console.log('✅ [LANDING] SessionId:', data.sessionId, 'PhoneNumber:', data.phoneNumber);

      // Solo aceptar si corresponde a la sesión que ESTE navegador inició
      if (!currentPendingSessionId || (data.sessionId !== currentPendingSessionId)) {
        console.log('⏭️ [LANDING] Ignorando whatsapp-connected de otra sesión (pendingSessionId:', currentPendingSessionId, ')');
        return;
      }

      // USAR EL NÚMERO DE TELÉFONO si está disponible, sino usar sessionId
      const finalSessionId = data.phoneNumber || data.sessionId;
      console.log(`📱 [LANDING] Guardando sesión (whatsapp-connected): ${finalSessionId}`);

      setIsConnected(true);
      setSessionId(finalSessionId);
      setShowQRModal(false);
      setLoading(false);

      console.log('📱 [LANDING] Llamando onQRSuccess con:', finalSessionId);
      onQRSuccess(finalSessionId);

      // Redirigir al dashboard INMEDIATAMENTE - SIN TIMEOUT
      console.log('✅ [LANDING] Redirigiendo al dashboard AHORA (whatsapp-connected)...');
      navigate('/dashboard', { replace: true });
      console.log('🚀 [LANDING] Navegación ejecutada (whatsapp-connected)');
    });

    // Evento de QR generado
    newSocket.on('qr-code', (data: any) => {
      console.log('📱 QR Code recibido:', data);
      if (data.qrDataUrl) {
        setQrDataUrl(data.qrDataUrl);
        setLoading(false);
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

      const response = await fetch(`${baseURL}/api/create-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncHistory, deviceId })
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


  // Ref para controlar que el QR solo se genere una vez automáticamente
  const autoQRGeneratedRef = useRef(false);

  // Generar QR automáticamente al cargar (solo una vez)
  useEffect(() => {
    const shouldGenerate = !isConnected && !autoQRGeneratedRef.current;

    console.log('[LANDING] 🔍 Verificando si generar QR automáticamente:', {
      isConnected,
      autoQRGenerated: autoQRGeneratedRef.current,
      shouldGenerate
    });

    if (shouldGenerate) {
      console.log('[LANDING] 🎯 Generando QR automáticamente al cargar...');
      autoQRGeneratedRef.current = true;

      // Pequeño delay para asegurar que el socket esté conectado
      setTimeout(() => {
        fetchQR();
      }, 500);
    }
  }, [isConnected]); // Solo depender de isConnected

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
                    Plataforma Empresarial de WhatsApp
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
                    Gestiona conversaciones, automatiza respuestas, y escala tu negocio con la plataforma más completa para WhatsApp Business.
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
              <Grid item xs={12} md={6}>
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
                          <Button
                            variant="contained"
                            onClick={fetchQR}
                            sx={{
                              bgcolor: '#6366f1',
                              '&:hover': { bgcolor: '#4f46e5' }
                            }}
                          >
                            Generar QR
                          </Button>
                        </Box>
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
                © 2024 WhatsFlow - Plataforma Empresarial de WhatsApp
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                Todos los Derechos Reservados por <strong>CNID</strong> Centro-Nacional-Información-Digital
              </Typography>
              <br />
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                NRO REG: 17789
              </Typography>
            </Box>
          </Container>
        </Box>
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
