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
    const socketURL = getSocketURL();

    const createSocket = () => {
      const sessionId = sessionStorage.getItem('whinsap_session') || localStorage.getItem('whinsap_session');
      const userRole = sessionStorage.getItem('userRole') || localStorage.getItem('userRole') || 'admin';
      const userId = sessionStorage.getItem('userId') || localStorage.getItem('userId');

      console.log('🔌 Conectando a Socket.IO en:', socketURL);
      console.log('🔌 SessionId para conexión:', sessionId);
      console.log('🔌 UserRole para conexión:', userRole);
      console.log('🔌 UserId para conexión:', userId);

      const newSocket = io(socketURL, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity,
        timeout: 20000,
        forceNew: false,
        upgrade: true,
        rememberUpgrade: true,
        path: '/socket.io/',
        withCredentials: true,
        query: {
          sessionId: sessionId || '',
          userRole: userRole,
          userId: userId || ''
        },
        auth: {
          sessionId: sessionId || '',
          userRole: userRole,
          userId: userId || ''
        },
        extraHeaders: {
          'X-Session-Id': sessionId || '',
          'X-User-Role': userRole,
          'X-User-Id': userId || ''
        }
      });

      setSocket((prev: any) => {
        if (prev) {
          try {
            prev.close();
          } catch { }
        }
        return newSocket;
      });

      (window as any).globalSocket = newSocket;
      console.log('🌍 Socket expuesto globalmente en window.globalSocket');

      attachSocketHandlers(newSocket);
    };

    const attachSocketHandlers = (newSocket: any) => {
      newSocket.on('connect', () => {
        const currentSessionId = sessionStorage.getItem('whinsap_session') || localStorage.getItem('whinsap_session');
        const currentUserRole = sessionStorage.getItem('userRole') || localStorage.getItem('userRole');
        const currentUserId = sessionStorage.getItem('userId') || localStorage.getItem('userId');

        console.log('🔌 Socket conectado:', newSocket.id);
        console.log('🔌 SessionId actual:', currentSessionId);
        console.log('🔌 UserRole actual:', currentUserRole);
        console.log('🔌 UserId actual:', currentUserId);
        setIsConnected(true);

        if (currentSessionId) {
          newSocket.emit('join-session', { sessionId: currentSessionId });
          console.log('🔌 Uniéndose a sala:', `session-${currentSessionId}`);
        }

        if (currentUserRole === 'agent' && currentUserId) {
          newSocket.emit('join-agent-room', { agentId: parseInt(currentUserId) });
          console.log('🔌 [AGENTE] Uniéndose a sala agent-' + currentUserId);
        }
      });

      newSocket.on('disconnect', (reason: string) => {
        console.log('🔌 Socket desconectado:', reason);
        setIsConnected(false);
      });

      newSocket.on('reconnect', (attemptNumber: number) => {
        const currentSessionId = sessionStorage.getItem('whinsap_session') || localStorage.getItem('whinsap_session');
        const currentUserRole = sessionStorage.getItem('userRole') || localStorage.getItem('userRole');
        const currentUserId = sessionStorage.getItem('userId') || localStorage.getItem('userId');

        console.log('🔌 Socket reconectado después de', attemptNumber, 'intentos');
        setIsConnected(true);

        if (currentSessionId) {
          newSocket.emit('join-session', { sessionId: currentSessionId });
          console.log('🔌 Re-uniéndose a sala:', `session-${currentSessionId}`);
        }

        if (currentUserRole === 'agent' && currentUserId) {
          newSocket.emit('join-agent-room', { agentId: parseInt(currentUserId) });
          console.log('🔌 [AGENTE] Re-uniéndose a sala agent-' + currentUserId);
        }
      });

      newSocket.on('reconnect_error', (error: any) => {
        console.error('🔌 Error de reconexión:', error);
      });

      newSocket.on('connect_error', (error: any) => {
        console.error('🔌 Error de conexión:', error);
        setIsConnected(false);
      });

      newSocket.on('connection-update', async (data: any) => {
        console.log('📱 Actualización de conexión WhatsApp:', data);

        const incomingSessionId = data?.sessionId || data?.newSessionId;
        const oldSessionId = sessionStorage.getItem('whinsap_session');

        if (incomingSessionId && incomingSessionId !== oldSessionId) {
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

        if (data?.status === 'connected' && incomingSessionId) {
          const existingToken = localStorage.getItem('token') || sessionStorage.getItem('token');
          if (!existingToken) {
            try {
              const API_BASE_URL = window.location.origin;

              console.log('🔑 [TOKEN] Generando token JWT para nueva sesión...');
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
                sessionStorage.setItem('token', result.token);
                console.log('🔑 Token JWT generado y guardado');
              } else {
                console.error('❌ Error generando token:', result.error);
              }
            } catch (error) {
              console.error('❌ Error al solicitar token:', error);
            }
          } else {
            console.log('🔑 [TOKEN] Token ya existe, saltando generación');
          }
        }
      });

      newSocket.on('qr-code', (data: any) => {
        console.log('📱 Nuevo código QR:', data);
      });

      newSocket.on('message', (data: any) => {
        console.log('💬 [SocketContext] Nuevo mensaje recibido:', data);
      });

      newSocket.on('message-status-update', (data: any) => {
        console.log('📊 Actualización de estado:', data);
      });

      newSocket.on('system-notification', (data: any) => {
        console.log('🔔 Notificación del sistema:', data);
      });

      newSocket.on('user-activity', (data: any) => {
        console.log('👤 Actividad de usuario:', data);
      });

      newSocket.on('session-invalidated', (data: any) => {
        console.log('🚫 Sesión invalidada:', data.message);
        window.dispatchEvent(new CustomEvent('session-invalidated', {
          detail: {
            reason: data.message || 'Tu sesión se cerró porque iniciaste sesión desde otro dispositivo'
          }
        }));
      });
    };

    const initialSessionId = sessionStorage.getItem('whinsap_session') || localStorage.getItem('whinsap_session');
    const initialUserId = sessionStorage.getItem('userId') || localStorage.getItem('userId');

    if (!initialSessionId && !initialUserId) {
      console.log('⏳ Socket esperando sessionId/userId para conectar...');

      const onSessionEstablished = () => {
        console.log('✅ Evento de sesión establecido recibido, creando socket');
        createSocket();
        window.removeEventListener('whinsap-session-established', onSessionEstablished);
      };

      window.addEventListener('whinsap-session-established', onSessionEstablished);
      return () => {
        window.removeEventListener('whinsap-session-established', onSessionEstablished);
      };
    }

    createSocket();

    return () => {
      console.log('🔌 Cerrando conexión Socket.IO');
      if (socket) {
        try { socket.close(); } catch { }
      }
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