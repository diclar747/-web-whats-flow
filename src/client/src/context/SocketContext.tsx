import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io } from 'socket.io-client';
import { getSocketURL } from '../utils/socketConfig';

interface SocketContextType {
  socket: any | null;
  isConnected: boolean;
  emit: (event: string, data?: any) => void;
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Determinar URL del socket según el entorno
    const socketURL = getSocketURL();

    // Obtener sessionId de sessionStorage primero (para agentes) o localStorage (para admins)
    const sessionId = sessionStorage.getItem('whatsflow_session') || localStorage.getItem('whatsflow_session');

    console.log('🔌 Conectando a Socket.IO en:', socketURL);
    console.log('🔌 SessionId para conexión:', sessionId);

    // Inicializar conexión Socket.IO CON sessionId en query
    const newSocket = io(socketURL, {
      transports: ['websocket', 'polling'], // Priorizar websocket, fallback a polling
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity, // Intentos ilimitados
      timeout: 20000,
      forceNew: false, // Reutilizar conexión existente si es posible
      upgrade: true, // Permitir upgrade a websocket
      rememberUpgrade: true, // Recordar upgrade exitoso
      path: '/socket.io/',
      withCredentials: true,
      query: {
        sessionId: sessionId || '' // Pasar sessionId al servidor
      },
      auth: {
        sessionId: sessionId || ''
      },
      extraHeaders: {
        'X-Session-Id': sessionId || ''
      }
    });

    setSocket(newSocket);

    // Eventos de conexión
    newSocket.on('connect', () => {
      const currentSessionId = sessionStorage.getItem('whatsflow_session') || localStorage.getItem('whatsflow_session');
      console.log('🔌 Socket conectado:', newSocket.id);
      console.log('🔌 SessionId actual:', currentSessionId);
      setIsConnected(true);

      // Unirse a la sala de la sesión al conectar
      if (currentSessionId) {
        newSocket.emit('join-session', { sessionId: currentSessionId });
        console.log('🔌 Uniéndose a sala:', `session-${currentSessionId}`);
      }
    });

    newSocket.on('disconnect', (reason: string) => {
      console.log('🔌 Socket desconectado:', reason);
      setIsConnected(false);
    });

    newSocket.on('reconnect', (attemptNumber: number) => {
      const currentSessionId = sessionStorage.getItem('whatsflow_session') || localStorage.getItem('whatsflow_session');
      console.log('🔌 Socket reconectado después de', attemptNumber, 'intentos');
      setIsConnected(true);

      // Re-unirse a la sala después de reconectar
      if (currentSessionId) {
        newSocket.emit('join-session', { sessionId: currentSessionId });
        console.log('🔌 Re-uniéndose a sala:', `session-${currentSessionId}`);
      }
    });

    newSocket.on('reconnect_error', (error: any) => {
      console.error('🔌 Error de reconexión:', error);
    });

    newSocket.on('connect_error', (error: any) => {
      console.error('🔌 Error de conexión:', error);
      setIsConnected(false);
    });

    // Eventos globales de WhatsApp
    newSocket.on('connection-update', async (data: any) => {
      console.log('📱 Actualización de conexión WhatsApp:', data);

      const incomingSessionId = data?.sessionId || data?.newSessionId;
      const oldSessionId = localStorage.getItem('whatsflow_session');

      if (incomingSessionId && incomingSessionId !== oldSessionId) {
        // Actualizar storage y re-unir salas sin recargar la página
        localStorage.setItem('whatsflow_session', incomingSessionId);
        try {
          if (oldSessionId) {
            newSocket.emit('leave-session', { sessionId: oldSessionId });
          }
          newSocket.emit('join-session', { sessionId: incomingSessionId });
          console.log(`🔁 Re-asignado a sala: session-${incomingSessionId} (antes: ${oldSessionId})`);
        } catch (err) {
          console.warn('⚠️ Error re-uniendo a sala tras connection-update:', err);
        }
      }

      // Generar token JWT cuando se conecta
      if (data?.status === 'connected' && incomingSessionId) {
        try {
          const API_BASE_URL = window.location.hostname === 'localhost' 
            ? 'http://localhost:3001' 
            : 'https://web.whats-flow.com';
          
          const response = await fetch(`${API_BASE_URL}/api/auth/generate-token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sessionId: incomingSessionId })
          });

          const result = await response.json();
          if (result.success && result.token) {
            localStorage.setItem('token', result.token);
            console.log('🔑 Token JWT generado y guardado');
          } else {
            console.error('❌ Error generando token:', result.error);
          }
        } catch (error) {
          console.error('❌ Error al solicitar token:', error);
        }
      }
    });

    newSocket.on('qr-code', (data: any) => {
      console.log('📱 Nuevo código QR:', data);
    });

    // IMPORTANTE: El servidor emite 'message', NO 'new-message'
    newSocket.on('message', (data: any) => {
      console.log('💬 [SocketContext] Nuevo mensaje recibido:', data);
    });

    newSocket.on('message-status-update', (data: any) => {
      console.log('📊 Actualización de estado:', data);
    });

    // Eventos del sistema
    newSocket.on('system-notification', (data: any) => {
      console.log('🔔 Notificación del sistema:', data);
    });

    newSocket.on('user-activity', (data: any) => {
      console.log('👤 Actividad de usuario:', data);
    });

    // Evento de invalidación de sesión
    newSocket.on('session-invalidated', (data: any) => {
      console.log('🚫 Sesión invalidada:', data.message);
      alert(data.message || 'Tu sesión se cerró porque iniciaste sesión desde otro dispositivo');

      // Limpiar sesión y recargar
      localStorage.clear();
      window.location.href = '/';
    });

    return () => {
      console.log('🔌 Cerrando conexión Socket.IO');
      newSocket.close();
    };
  }, []);

  const emit = (event: string, data?: any) => {
    if (socket && isConnected) {
      socket.emit(event, data);
    } else {
      console.warn('🔌 Socket no conectado, no se puede emitir:', event);
    }
  };

  const on = (event: string, callback: (data: any) => void) => {
    if (socket) {
      socket.on(event, callback);
    }
  };

  const off = (event: string) => {
    if (socket) {
      socket.off(event);
    }
  };

  const value: SocketContextType = {
    socket,
    isConnected,
    emit,
    on,
    off
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}; 