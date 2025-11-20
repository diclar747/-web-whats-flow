import React, { useState, useEffect } from 'react';
import { Box, LinearProgress, Typography, Paper, Fade, IconButton } from '@mui/material';
import { Close, CheckCircle, Sync } from '@mui/icons-material';
import { io } from 'socket.io-client';
import { getSocketURL } from '../utils/socketConfig';

interface SyncProgressBarProps {
  sessionId: string;
}

interface SyncProgress {
  status: 'syncing' | 'completed' | 'idle';
  progress: number;
  message: string;
  contacts?: number;
  groups?: number;
  messages?: number;
}

const SyncProgressBar: React.FC<SyncProgressBarProps> = ({ sessionId }) => {
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    status: 'idle',
    progress: 0,
    message: ''
  });
  const [show, setShow] = useState(false);
  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    // Conectar a Socket.IO
    const socketUrl = getSocketURL();
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    newSocket.on('connect', () => {
      console.log('[SyncProgress] Socket conectado');
      // Unirse a la sala de la sesión
      newSocket.emit('join-session', { sessionId });
    });

    // Escuchar eventos de sincronización
    newSocket.on('sync-start', (data: any) => {
      console.log('[SyncProgress] Sincronización iniciada en segundo plano', data);
      setSyncProgress({
        status: 'syncing',
        progress: 0,
        message: 'Iniciando sincronización...',
        contacts: 0,
        groups: 0,
        messages: 0
      });
      // NO mostrar la barra - sincronizar silenciosamente en segundo plano
      setShow(false);
    });

    newSocket.on('sync-progress', (data: any) => {
      console.log('[SyncProgress] Progreso', data);
      setSyncProgress(prev => ({
        ...prev,
        progress: data.progress || prev.progress,
        message: data.message || prev.message,
        contacts: data.contacts || prev.contacts,
        groups: data.groups || prev.groups,
        messages: data.messages || prev.messages
      }));
    });

    newSocket.on('sync-contacts', (data: any) => {
      setSyncProgress(prev => ({
        ...prev,
        progress: 33,
        message: `Sincronizando contactos... ${data.total || 0}`,
        contacts: data.total || 0
      }));
    });

    newSocket.on('sync-groups', (data: any) => {
      setSyncProgress(prev => ({
        ...prev,
        progress: 66,
        message: `Sincronizando grupos... ${data.total || 0}`,
        groups: data.total || 0
      }));
    });

    newSocket.on('sync-messages', (data: any) => {
      setSyncProgress(prev => ({
        ...prev,
        progress: 90,
        message: `Sincronizando mensajes... ${data.total || 0}`,
        messages: data.total || 0
      }));
    });

    newSocket.on('sync-complete', (data: any) => {
      console.log('[SyncProgress] Sincronización completada silenciosamente', data);
      const stats = data.stats || data;
      setSyncProgress({
        status: 'completed',
        progress: 100,
        message: 'Sincronización completada',
        contacts: stats.contacts || data.contacts || 0,
        groups: stats.groups || data.groups || 0,
        messages: stats.messages || data.messages || stats.chats || 0
      });

      // NO mostrar nada - sincronización completamente silenciosa
      setShow(false);
      
      // NO recargar la página automáticamente
      // Los mensajes/chats se actualizan via socket en tiempo real
    });

    newSocket.on('sync-error', (data: any) => {
      console.error('[SyncProgress] Error en sincronización', data);
      setSyncProgress({
        status: 'idle',
        progress: 0,
        message: `Error: ${data.error || 'Error desconocido'}`
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [sessionId]);

  const handleClose = () => {
    setShow(false);
  };

  if (!show || syncProgress.status === 'idle') {
    return null;
  }

  // 🆕 Diseño moderno tipo WhatsApp Web - Barra en la parte superior
  return (
    <Fade in={show}>
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: syncProgress.status === 'completed'
            ? 'linear-gradient(90deg, #25D366 0%, #128C7E 100%)'
            : 'linear-gradient(90deg, #00a884 0%, #008069 100%)',
          color: 'white',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          animation: show ? 'slideDown 0.3s ease-out' : 'none',
          '@keyframes slideDown': {
            '0%': { transform: 'translateY(-100%)' },
            '100%': { transform: 'translateY(0)' }
          }
        }}
      >
        <Box sx={{
          px: 3,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: 1200,
          margin: '0 auto'
        }}>
          {/* Lado izquierdo - Icono y mensaje */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
            {syncProgress.status === 'completed' ? (
              <CheckCircle sx={{ fontSize: 24 }} />
            ) : (
              <Sync sx={{
                fontSize: 24,
                animation: 'spin 1.5s linear infinite',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' }
                }
              }} />
            )}

            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight="600" sx={{ fontSize: '0.95rem' }}>
                {syncProgress.status === 'completed'
                  ? '✓ Sincronización completada'
                  : 'Sincronizando mensajes...'}
              </Typography>
              {syncProgress.status === 'syncing' && (
                <Typography variant="caption" sx={{ opacity: 0.9, fontSize: '0.75rem' }}>
                  {syncProgress.message}
                </Typography>
              )}
            </Box>
          </Box>

          {/* Centro - Estadísticas en línea */}
          {(syncProgress.contacts || syncProgress.groups || syncProgress.messages) ? (
            <Box sx={{
              display: { xs: 'none', md: 'flex' },
              gap: 3,
              fontSize: '0.85rem',
              opacity: 0.95
            }}>
              {(syncProgress.contacts ?? 0) > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <span>📱</span>
                  <strong>{syncProgress.contacts}</strong>
                </Box>
              )}
              {(syncProgress.groups ?? 0) > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <span>👥</span>
                  <strong>{syncProgress.groups}</strong>
                </Box>
              )}
              {(syncProgress.messages ?? 0) > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <span>💬</span>
                  <strong>{syncProgress.messages}</strong>
                </Box>
              )}
            </Box>
          ) : null}

          {/* Lado derecho - Progreso y botón cerrar */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {syncProgress.status === 'syncing' && (
              <Typography variant="body2" fontWeight="600" sx={{ fontSize: '0.9rem' }}>
                {syncProgress.progress}%
              </Typography>
            )}
            <IconButton
              size="small"
              onClick={handleClose}
              sx={{
                color: 'white',
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
              }}
            >
              <Close fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* Barra de progreso debajo */}
        {syncProgress.status === 'syncing' && (
          <LinearProgress
            variant="determinate"
            value={syncProgress.progress}
            sx={{
              height: 3,
              backgroundColor: 'rgba(255,255,255,0.2)',
              '& .MuiLinearProgress-bar': {
                backgroundColor: '#fff',
                transition: 'transform 0.4s ease'
              }
            }}
          />
        )}
      </Box>
    </Fade>
  );
};

export default SyncProgressBar;
