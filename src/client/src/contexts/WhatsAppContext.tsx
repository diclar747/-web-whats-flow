import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { io } from 'socket.io-client';
import { getSocketURL, getAPIBaseURL } from '../utils/socketConfig';

declare global {
  interface Window {
    chatRefreshInterval?: NodeJS.Timeout;
    notificationSound?: HTMLAudioElement;
  }
}

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
}

const playNotificationSound = () => {
  try {
    console.log('🔊 [SOUND] Intentando reproducir sonido de notificación...');

    // Usar archivo de audio MP3 en lugar de Web Audio API
    if (!window.notificationSound) {
      console.log('🔊 [SOUND] Creando nuevo objeto Audio...');
      window.notificationSound = new Audio('/notification.mp3');
      window.notificationSound.volume = 0.5;
    }

    // Clonar y reproducir para permitir múltiples notificaciones simultáneas
    const audio = window.notificationSound.cloneNode() as HTMLAudioElement;
    audio.volume = 0.5;

    // Intentar reproducir con promesa para manejar errores de autoplay
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('🔊 [SOUND] ✅ Sonido reproducido exitosamente');
        })
        .catch(err => {
          console.warn('🔊 [SOUND] ⚠️ No se pudo reproducir automáticamente:', err.message);
          console.warn('🔊 [SOUND] 💡 Puede necesitar interacción del usuario primero');
        });
    }
  } catch (error) {
    console.error('🔊 [SOUND] ❌ Error reproduciendo sonido:', error);
  }
};

const showBrowserNotification = (options: NotificationOptions) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon || '/favicon.ico',
      tag: options.tag || 'whatsapp-message',
      requireInteraction: options.requireInteraction || false,
      silent: options.silent || false,
      badge: '/favicon.ico'
    });

    if (!options.silent) {
      playNotificationSound();
    }

    setTimeout(() => {
      notification.close();
    }, 5000);

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return notification;
  }
  return null;
};

interface Call {
  id: string;
  from: string;
  isVideo: boolean;
  isGroup: boolean;
}

interface WhatsAppSession {
  sessionId: string;
  isConnected: boolean;
  phoneNumber?: string;
  deviceName?: string;
  lastActivity?: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
}

export interface WhatsAppChat {
  id: string;
  name: string;
  lastMessage?: string;
  timestamp?: string;
  unreadCount?: number;
  isGroup: boolean;
  avatar?: string;
  isOnline?: boolean;
  participants?: string[];
  isArchived?: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
  lastSeen?: string;
  description?: string;
  participantsCount?: number;
}

interface MessageReaction {
  userJid: string;
  reaction: string;
  timestamp: string;
}

interface WhatsAppMessage {
  id: string;
  from: string;
  to?: string;
  message: string;
  text?: string;
  timestamp: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker';
  isFromMe: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  chatJid?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  sentBy?: string; // Nombre del agente que envió el mensaje
  reactions?: MessageReaction[];
  contextInfo?: {
    quotedMessageId?: string;
    quotedMessageText?: string;
    quotedMessageSender?: string;
  };
}

interface WhatsAppContextType {
  session: WhatsAppSession | null;
  chats: WhatsAppChat[];
  activeChat: WhatsAppChat | null;
  messages: WhatsAppMessage[];
  isLoading: boolean;
  error: string | null;
  activeCall: Call | null;
  replyMessage: WhatsAppMessage | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';

  generateQR: () => Promise<string | null>;
  connectSession: (sessionId: string) => void;
  disconnectSession: () => void;
  loadChats: (sessionId: string) => Promise<void>;
  loadMessages: (chatId: string) => Promise<void>;
  sendMessage: (chatId: string, message: string, contextInfo?: any) => Promise<boolean>;
  sendFile: (chatId: string, file: File, caption?: string) => Promise<boolean>;
  setActiveChat: (chat: WhatsAppChat | null) => void;
  clearError: () => void;
  rejectCall: (callId: string) => Promise<void>;
  setReplyMessage: (message: WhatsAppMessage | null) => void;
  searchMessages: (chatId: string, query: string) => Promise<WhatsAppMessage[]>;
  archiveChat: (chatId: string) => Promise<void>;
  pinChat: (chatId: string) => Promise<void>;
  muteChat: (chatId: string) => Promise<void>;
  addReaction: (messageId: string, reaction: string) => Promise<void>;
  removeReaction: (messageId: string) => Promise<void>;
  loadMessageReactions: (messageId: string) => Promise<MessageReaction[]>;
  markChatAsRead: (chatId: string) => void;
}

const WhatsAppContext = createContext<WhatsAppContextType | undefined>(undefined);

export const useWhatsApp = () => {
  const context = useContext(WhatsAppContext);
  if (context === undefined) {
    throw new Error('useWhatsApp must be used within a WhatsAppProvider');
  }
  return context;
};

interface WhatsAppProviderProps {
  children: ReactNode;
  userId?: number; // ID del usuario si es agente
  userRole?: string; // Rol del usuario
}

export const WhatsAppProvider: React.FC<WhatsAppProviderProps> = ({ children, userId, userRole }) => {
  const [session, setSession] = useState<WhatsAppSession | null>(null);
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [activeChat, setActiveChat] = useState<WhatsAppChat | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [replyMessage, setReplyMessage] = useState<WhatsAppMessage | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');

  const API_BASE = getAPIBaseURL();

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        console.log(`🔔 [PERMISSION] Permiso de notificaciones: ${permission}`);
        return permission === 'granted';
      }
      console.log(`🔔 [PERMISSION] Permiso actual: ${Notification.permission}`);
      return Notification.permission === 'granted';
    }
    console.warn('🔔 [PERMISSION] Notificaciones no soportadas en este navegador');
    return false;
  };

  // Inicializar sonido con interacción del usuario
  const initializeSound = useCallback(() => {
    console.log('🔊 [SOUND] Inicializando sistema de sonido...');
    try {
      if (!window.notificationSound) {
        window.notificationSound = new Audio('/notification.mp3');
        window.notificationSound.volume = 0.5;
        // Pre-cargar el audio
        window.notificationSound.load();
        console.log('🔊 [SOUND] ✅ Sistema de sonido inicializado');
      }
      // Hacer una reproducción silenciosa para "desbloquear" el audio
      const testAudio = new Audio();
      testAudio.volume = 0;
      testAudio.play().catch(() => {
        console.log('🔊 [SOUND] Necesita interacción del usuario para desbloquear audio');
      });
    } catch (error) {
      console.error('🔊 [SOUND] ❌ Error inicializando sonido:', error);
    }
  }, []);

  const loadChats = useCallback(async (sessionId: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      // Si es agente, usar endpoint de chats asignados
      const isAgent = userRole && userRole !== 'admin';
      const endpoint = isAgent && userId
        ? `${API_BASE}/api/agents/${userId}/chats?sessionId=${sessionId}&includeGroups=false`
        : `${API_BASE}/api/chats/${sessionId}?includeGroups=false`;

      console.log(`🔄 Cargando chats desde API (${isAgent ? 'AGENTE' : 'ADMIN'}):`, endpoint);
      const response = await fetch(endpoint);
      const data = await response.json();

      if (data.success && data.chats) {
        console.log(`✅ Chats cargados exitosamente: ${data.chats.length}`);

        const chatMap = new Map();

        data.chats.forEach((chat: any) => {
          // ⚠️ FILTRAR GRUPOS - NO cargarlos en el contexto
          const isGroupChat = chat.isGroup || chat.id.includes('@g.us') || chat.id.includes('@broadcast');
          
          if (isGroupChat) {
            console.log(`🚫 Grupo filtrado: ${chat.name || chat.id}`);
            return; // Saltar grupos
          }
          
          if (!chatMap.has(chat.id)) {
            chatMap.set(chat.id, {
              id: chat.id,
              name: chat.subject || chat.name || chat.id.split('@')[0] || 'Desconocido',
              isGroup: false, // Ya filtramos arriba, esto siempre será false
              lastMessage: chat.lastMessage || 'Toca para cargar mensajes',
              timestamp: chat.timestamp || new Date().toISOString(),
              isOnline: true, // Es contacto individual
              unreadCount: chat.unreadCount || 0,
              avatar: chat.avatar || null,
              lastSeen: chat.lastSeen || null,
              isPinned: chat.isPinned || false,
              isMuted: chat.isMuted || false,
              isArchived: chat.isArchived || false
            });
          }
        });

        const mappedChats: WhatsAppChat[] = Array.from(chatMap.values());
        console.log(`📱 Chats únicos cargados: ${mappedChats.length} de ${data.chats.length} total`);

        setChats(mappedChats);
        setConnectionStatus('connected');
        
      } else if (data.source === 'database_fallback') {
        console.log('📦 Usando datos de fallback de base de datos');

        const fallbackChats: WhatsAppChat[] = [
          {
            id: 'fallback@c.us',
            name: 'Datos de respaldo',
            isGroup: false,
            lastMessage: 'Conecte WhatsApp para ver chats completos',
            timestamp: new Date().toISOString(),
            isOnline: false,
            unreadCount: 0
          }
        ];

        setChats(fallbackChats);
        setConnectionStatus('connected');
        setError('Usando datos guardados. Conecte WhatsApp para ver chats completos.');
      } else {
        console.log('❌ No se encontraron chats');
        setChats([]);
        setConnectionStatus('error');
        setError('No se pudieron cargar los chats. Verifique la conexión de WhatsApp.');
      }
    } catch (error) {
      console.error('❌ Error cargando chats:', error);
      setError('Error de conexión. No se pudieron cargar los chats.');
      setConnectionStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, [API_BASE, userId, userRole]);

  useEffect(() => {
    // 🔒 SEGURIDAD: Leer SOLO de sessionStorage (único por pestaña)
    const savedSessionId = sessionStorage.getItem('whatsflow_session');
    if (savedSessionId) {
      console.log('Sesión encontrada en sessionStorage:', savedSessionId);
      setConnectionStatus('connecting');

      const checkConnection = async () => {
        try {
          const response = await fetch(`${API_BASE}/api/session/${savedSessionId}/status`);
          const data = await response.json();

          if (data.success && data.isConnected) {
            console.log('🎉 Sesión conectada, inicializando y cargando chats...');
            const newSession: WhatsAppSession = {
              sessionId: savedSessionId,
              isConnected: true,
              status: 'connected',
              lastActivity: new Date().toISOString()
            };
            setSession(newSession);
            setConnectionStatus('connected');

            // Solicitar permisos y preparar audio
            await requestNotificationPermission();
            initializeSound();

            console.log('📱 Cargando chats automáticamente...');
            await loadChats(savedSessionId);
          } else {
            console.log('Sesión guardada pero no conectada. Manteniendo en localStorage para posibles reintentos...');
            // Mantener la sesión en localStorage pero cambiar el estado a desconectado
            setConnectionStatus('disconnected');
            // No eliminar la sesión de localStorage para permitir reintentos automáticos
          }
        } catch (error) {
          console.error('Error verificando conexión:', error);
          setConnectionStatus('error');
          // Intentar reconexión automática cada 5 segundos
          setTimeout(() => {
            checkConnection();
          }, 5000);
        }
      };

      checkConnection();
    }

    // Inicializar sonido al hacer clic en cualquier parte (para navegadores que bloquean autoplay)
    const handleFirstInteraction = () => {
      initializeSound();
      // Remover el listener después de la primera interacción
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('keydown', handleFirstInteraction);

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [loadChats, API_BASE, initializeSound]);

  useEffect(() => {
    if (session?.sessionId) {
      console.log('Conectando socket para sessionId:', session.sessionId);
      const socketURL = getSocketURL();
      console.log('URL del socket:', socketURL);
      const newSocket = io(socketURL, {
        query: { sessionId: session.sessionId },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000
      });

      newSocket.on('connect', () => {
        console.log('✅ Socket conectado en WhatsAppContext:', newSocket.id);
        // Unirse al room de la sesión con el formato correcto
        newSocket.emit('join-session', { sessionId: session.sessionId });
        console.log('📡 Intentando unirse a sala:', `session-${session.sessionId}`);
        setConnectionStatus('connected');
      });

      newSocket.on('joined-session', (data: any) => {
        console.log('✅ Unido exitosamente a la sesión:', data);
        // Cargar chats al conectar
        loadChats(session.sessionId);
      });

      newSocket.on('disconnect', (reason: string) => {
        console.log('⚠️ Socket desconectado en WhatsAppContext, razón:', reason);
        // Solo cambiar el estado a desconectado, no eliminar la sesión
        setConnectionStatus('disconnected');
        
        // Intentar reconectar automáticamente si fue desconexión inesperada
        if (reason === 'io server disconnect') {
          // El servidor forzó la desconexión, reconectar manualmente
          setTimeout(() => {
            console.log('🔄 Intentando reconectar...');
            newSocket.connect();
          }, 1000);
        }
      });

      newSocket.on('connect_error', (error: Error) => {
        console.error('❌ Error de conexión del socket:', error);
        setConnectionStatus('error');
      });

      newSocket.on('reconnect', (attemptNumber: number) => {
        console.log('Reconexión exitosa después de', attemptNumber, 'intentos');
        setConnectionStatus('connected');
      });

      newSocket.on('reconnect_attempt', (attemptNumber: number) => {
        console.log('Intentando reconexión #', attemptNumber);
      });

      newSocket.on('reconnect_error', (error: Error) => {
        console.error('Error en intento de reconexión:', error);
      });

      newSocket.on('reconnect_failed', () => {
        console.error('Reconexión fallida, se perdió la conexión con el servidor');
        setConnectionStatus('error');
      });

      newSocket.on('incoming-call', (call: Call) => {
        setActiveCall(call);
      });

      newSocket.on('message-status-update', ({ id, status }: { id: string; status: string }) => {
        console.log('Actualización de estado de mensaje:', id, status);
        setMessages(prev =>
          prev.map(msg => (msg.id === id ? { ...msg, status: status as 'sending' | 'sent' | 'delivered' | 'read' } : msg))
        );
      });

      newSocket.on('message', (newMessage: WhatsAppMessage) => {
        console.log('📨 [REALTIME] Mensaje recibido via Socket.IO:', {
          id: newMessage.id,
          from: newMessage.from,
          chatJid: (newMessage as any).chatJid || (newMessage as any).chat_jid,
          message: newMessage.message?.substring(0, 50) + '...',
          isFromMe: newMessage.isFromMe
        });

        // Normalizar chatJid - puede venir en diferentes formatos
        const rawChatJid = newMessage.chatJid || (newMessage as any).chat_jid || newMessage.to || newMessage.from;
        const normalizedChatJid = rawChatJid?.includes('@') ? rawChatJid : `${rawChatJid}@s.whatsapp.net`;

        console.log('📨 Mensaje procesado:', {
          id: newMessage.id,
          from: newMessage.from,
          rawChatJid: rawChatJid,
          normalizedChatJid: normalizedChatJid,
          activeChatId: activeChat?.id,
          message: newMessage.message?.substring(0, 50) + '...',
          isFromMe: newMessage.isFromMe,
          type: newMessage.type
        });

        // Mapear el mensaje correctamente
        const mappedMessage: WhatsAppMessage = {
          ...newMessage,
          message: newMessage.message || newMessage.text || '',
          text: newMessage.message || newMessage.text || '',
          chatJid: normalizedChatJid,
          isFromMe: Boolean((newMessage as any).from_me || newMessage.isFromMe)
        };

        // Notificaciones para mensajes entrantes (solo si NO es mío)
        if (!mappedMessage.isFromMe) {
            console.log('🔔 [NOTIF] Procesando notificación para mensaje entrante');
            const isChatActive = activeChat?.id === mappedMessage.chatJid;
            const shouldNotify = !document.hasFocus() || !isChatActive;

            if (shouldNotify) {
                const chat = chats.find(c => c.id === mappedMessage.chatJid);
                const senderName = chat?.name || mappedMessage.from?.split('@')[0] || 'Contacto';
                const messagePreview = mappedMessage.message || 'Nuevo mensaje multimedia';

                console.log('🔔 [NOTIF] Reproduciendo sonido y mostrando notificación');

                // Reproducir sonido de notificación
                playNotificationSound();

                showBrowserNotification({
                    title: `💬 ${senderName}`,
                    body: messagePreview.length > 50 ? messagePreview.substring(0, 50) + '...' : messagePreview,
                    icon: chat?.avatar || '/favicon.ico',
                    tag: `chat-${mappedMessage.chatJid}`,
                    requireInteraction: false,
                    silent: false
                });

                // Actualizar título con contador de mensajes no leídos
                const currentTitle = document.title.replace(/^\(\d+\)\s*/, '');
                const unreadCount = chats.reduce((total, c) => total + (c.unreadCount || 0), 0) + 1;
                document.title = `(${unreadCount}) ${currentTitle}`;
            } else {
                console.log('🔔 [NOTIF] No notificar - chat activo o ventana enfocada');
            }
        } else {
            console.log('📤 [NOTIF] Mensaje propio - no notificar');
        }

        // Actualizar mensajes solo si es del chat activo
        // Comparar sin importar si tiene @ o no
        const isActiveChat = activeChat && mappedMessage.chatJid && (
          mappedMessage.chatJid === activeChat.id ||
          mappedMessage.chatJid.split('@')[0] === activeChat.id.split('@')[0]
        );

        console.log('🔍 Verificando si es chat activo:', {
          isActiveChat,
          mappedChatJid: mappedMessage.chatJid,
          activeChatId: activeChat?.id,
          comparison: mappedMessage.chatJid === activeChat?.id
        });

        if (isActiveChat) {
          setMessages(prev => {
            const exists = prev.some(msg => msg.id === mappedMessage.id);
            if (exists) {
              console.log('📝 Mensaje duplicado, ignorando:', mappedMessage.id);
              return prev;
            }
            console.log('✅✅✅ AGREGANDO MENSAJE AL CHAT ACTIVO:', mappedMessage.id, mappedMessage.message?.substring(0, 50));
            const newMessages = [...prev, mappedMessage].sort((a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
            console.log(`📊 Total mensajes en chat: ${newMessages.length}`);
            return newMessages;
          });

          // Hacer scroll al final cuando llega mensaje nuevo
          setTimeout(() => {
            const messagesContainer = document.querySelector('[data-messages-container]');
            if (messagesContainer) {
              messagesContainer.scrollTop = messagesContainer.scrollHeight;
              console.log('📜 Scroll automático al final');
            }
          }, 100);
        } else {
          console.log('⚠️ Mensaje NO es del chat activo, solo actualizando lista de chats');
        }

        // Actualizar lista de chats
        setChats(prev => {
          let chatExists = false;
          const updatedChats = prev.map(chat => {
            const chatId = mappedMessage.chatJid;
            if (chat.id === chatId) {
              chatExists = true;
              console.log('🔄 Actualizando chat:', chatId, 'con mensaje:', mappedMessage.message?.substring(0, 30));

              // Solo incrementar unreadCount si:
              // 1. No es mi mensaje (isFromMe === false)
              // 2. No es el chat actualmente abierto
              const isChatCurrentlyActive = activeChat?.id === chatId;
              const shouldIncrementUnread = !mappedMessage.isFromMe && !isChatCurrentlyActive;

              console.log('🔔 [BADGE] Chat:', chat.name, '- isFromMe:', mappedMessage.isFromMe, '- isActive:', isChatCurrentlyActive, '- increment:', shouldIncrementUnread);

              return {
                ...chat,
                lastMessage: mappedMessage.message,
                timestamp: mappedMessage.timestamp,
                unreadCount: shouldIncrementUnread ? (chat.unreadCount || 0) + 1 : (chat.unreadCount || 0)
              };
            }
            return chat;
          });

          if (!chatExists && mappedMessage.chatJid) {
            console.log('➕ Agregando nuevo chat desde mensaje:', mappedMessage.chatJid);
            const newChat: WhatsAppChat = {
              id: mappedMessage.chatJid,
              name: mappedMessage.from?.split('@')[0] || (mappedMessage.chatJid?.split('@')[0] || 'Desconocido'),
              isGroup: mappedMessage.chatJid.includes('@g.us'),
              lastMessage: mappedMessage.message,
              timestamp: mappedMessage.timestamp,
              isOnline: !mappedMessage.chatJid.includes('@g.us'),
              unreadCount: mappedMessage.isFromMe ? 0 : 1,
              avatar: undefined
            };
            updatedChats.unshift(newChat);
          }

          return updatedChats.sort((a, b) => {
            const aTimestamp = new Date(a.timestamp || 0).getTime();
            const bTimestamp = new Date(b.timestamp || 0).getTime();
            return bTimestamp - aTimestamp;
          });
        });
      });

      // Nuevo evento: sync-complete - se emite cuando se completa la sincronización
      newSocket.on('sync-complete', (data: any) => {
        console.log('🔄 Sincronización completa recibida:', data);
        if (data && data.success) {
          console.log(`✅ Sincronización exitosa: ${data.chatCount} chats`);
          
          // Cargar chats actualizados
          loadChats(session.sessionId);
        } else if (data) {
          console.error('❌ Error en la sincronización:', data?.error || 'Error desconocido');
        }
      });

      // Evento alternativo con sessionId en el nombre (compatibilidad)
      newSocket.on(`sync-complete-${session.sessionId}`, (data: any) => {
        console.log('🔄 Sincronización completa recibida (alt):', data);
        if (data && data.success) {
          console.log(`✅ Sincronización exitosa (alt): ${data.chatCount} chats`);
          loadChats(session.sessionId);
        }
      });

      return () => {
        console.log('Desconectando socket en WhatsAppContext');
        newSocket.disconnect();
      };
    }

    return () => {
      // Cleanup por defecto si no hay sessionId
    };
  }, [session?.sessionId, activeChat?.id]);

  const rejectCall = async (callId: string) => {
    if (!session?.sessionId) return;
    try {
      await fetch(`${API_BASE}/api/call/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId, callId })
      });
      setActiveCall(null);
    } catch (err) {
      setError('Error rejecting call');
    }
  };

  const generateQR = async (): Promise<string | null> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE}/api/qr-status`);
      const data = await response.json();
      
      if (data.success) {
        if (data.isConnected && data.sessionId) {
          connectSession(data.sessionId);
          return null; // Ya conectado
        }
        return data.qrDataUrl;
      } else {
        setError(data.error || 'Error al generar código QR');
        return null;
      }
    } catch (err) {
      setError('Error de conexión al servidor');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const connectSession = (sessionId: string) => {
    setConnectionStatus('connecting');
    const newSession: WhatsAppSession = {
      sessionId,
      isConnected: true,
      status: 'connected',
      lastActivity: new Date().toISOString()
    };
    setSession(newSession);

    // 🔒 CRÍTICO: NO sobrescribir whatsflow_session si el usuario ya está autenticado con email
    // Para usuarios con login email/password, whatsflow_session SIEMPRE debe ser user.id
    const existingUserId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
    const existingToken = localStorage.getItem('token') || sessionStorage.getItem('token');

    if (existingUserId && existingToken) {
      // Usuario autenticado con email/password - mantener user.id como sessionId principal
      console.log('✅ [WhatsApp] Usuario ya autenticado con email - manteniendo sessionId=user.id:', existingUserId);
      console.log('📱 [WhatsApp] Conexión de WhatsApp establecida:', sessionId);

      // Guardar el phone de WhatsApp por separado para referencia, pero NO como sessionId principal
      localStorage.setItem('whatsapp_phone', sessionId);
      sessionStorage.setItem('whatsapp_phone', sessionId);

      // Mantener el user.id como sessionId principal (NO sobrescribir)
      // Ya está guardado desde el login, no tocar

      // Cargar chats con el sessionId correcto (user.id, no phone)
      const correctSessionId = localStorage.getItem('whatsflow_session') || sessionStorage.getItem('whatsflow_session') || existingUserId;
      loadChats(correctSessionId);
    } else {
      // Usuario NO autenticado (login por QR directo) - usar el sessionId de WhatsApp
      console.log('✅ [WhatsApp] Login directo por QR - usando sessionId de WhatsApp:', sessionId);
      localStorage.setItem('whatsflow_session', sessionId);
      sessionStorage.setItem('whatsflow_session', sessionId);
      loadChats(sessionId);
    }

    // 🔄 Forzar sincronización inicial para poblar BD tras conexión por QR
    (async () => {
      try {
        console.log(`🔄 Forzando sincronización inicial para la sesión ${sessionId}...`);
        const resp = await fetch(`${API_BASE}/api/force-sync/${sessionId}`, { method: 'POST' });
        const data = await resp.json();
        if (data.success) {
          console.log('✅ Sincronización inicial completada:', data.stats || {});
          // Cargar chats nuevamente por si cambió el orden
          loadChats(sessionId);
        } else {
          console.warn('⚠️ Falló la sincronización inicial:', data.error || 'Error desconocido');
        }
      } catch (err) {
        console.warn('⚠️ Error forzando sincronización inicial:', err);
      }
    })();
  };

  const disconnectSession = () => {
    setSession(null);
    setChats([]);
    setActiveChat(null);
    setMessages([]);
    setConnectionStatus('disconnected');

    if (window.chatRefreshInterval) {
      clearInterval(window.chatRefreshInterval);
      window.chatRefreshInterval = undefined;
      console.log('🛑 Intervalo de actualización de chats limpiado');
    }
  };


  const loadMessages = async (chatId: string): Promise<void> => {
    if (!session?.sessionId) return;

    try {
      setIsLoading(true);
      console.log(`🔄 Cargando mensajes para chat: ${chatId}`);
      // Cargar histórico completo por defecto para evitar lista vacía tras QR
      const response = await fetch(`${API_BASE}/api/messages/${session.sessionId}?number=${chatId}&limit=100&dateFilter=all`);
      const data = await response.json();

      if (data.success && data.messages) {
        console.log(`✅ Mensajes cargados: ${data.messages.length} para chat ${chatId}`);
        const mappedMessages: WhatsAppMessage[] = data.messages.map((msg: any) => ({
          id: msg.id,
          from: msg.from,
          to: msg.to,
          message: msg.message || msg.text || '',
          text: msg.message || msg.text || '',
          timestamp: msg.timestamp,
          type: msg.type || 'text',
          isFromMe: Boolean(msg.isFromMe),
          status: msg.status || 'delivered',
          chatJid: msg.chatJid || chatId,
          mediaUrl: msg.mediaUrl,
          mediaMimeType: msg.mediaMimeType,
          sentBy: msg.sentBy, // Nombre del agente que envió
          contextInfo: msg.contextInfo
        }));
        setMessages(mappedMessages);

        // Marcar mensajes como leídos si no son míos
        const unreadMessages = mappedMessages.filter(msg => !msg.isFromMe && msg.status !== 'read');
        if (unreadMessages.length > 0) {
          console.log(`📖 Marcando ${unreadMessages.length} mensajes como leídos`);
          // Aquí puedes enviar una actualización al servidor para marcar como leídos
        }
      } else {
        console.log(`ℹ️ No se encontraron mensajes para chat ${chatId}`);
        setMessages([]);
      }
    } catch (err) {
      console.error('❌ Error al cargar mensajes:', err);
      setError('Error al cargar mensajes');
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (chatId: string, message: string, contextInfo?: any): Promise<boolean> => {
    if (!session?.sessionId) return false;

    try {
      console.log(`📤 Enviando mensaje a ${chatId}:`, message.substring(0, 50) + '...');

      // Crear mensaje temporal para mostrar inmediatamente
      const tempMessage: WhatsAppMessage = {
        id: `temp-${Date.now()}`,
        from: 'me',
        to: chatId,
        message,
        text: message,
        timestamp: new Date().toISOString(),
        type: 'text',
        isFromMe: true,
        status: 'sending',
        chatJid: chatId
      };

      // Agregar mensaje temporal inmediatamente
      setMessages(prev => [...prev, tempMessage].sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ));

      // Obtener información del usuario que envía (para etiquetas de agente)
      const sentByUserId = localStorage.getItem('userId');
      const sentByUserName = localStorage.getItem('userName');

      const response = await fetch(`${API_BASE}/api/send/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          number: chatId,
          message,
          contextInfo,
          sentBy: sentByUserId,
          sentByName: sentByUserName
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log(`✅ Mensaje enviado exitosamente. ID: ${data.messageId}`);

        // Actualizar mensaje temporal con el real
        setMessages(prev => prev.map(msg =>
          msg.id === tempMessage.id
            ? { ...msg, id: data.messageId || `sent-${Date.now()}`, status: 'sent' }
            : msg
        ));

        // Actualizar lista de chats
        setChats(prev => prev.map(chat =>
          chat.id === chatId
            ? { ...chat, lastMessage: message, timestamp: tempMessage.timestamp }
            : chat
        ));

        return true;
      } else {
        console.error('❌ Error enviando mensaje:', data.error);

        // Marcar mensaje como fallido
        setMessages(prev => prev.map(msg =>
          msg.id === tempMessage.id
            ? { ...msg, status: 'failed' as any }
            : msg
        ));

        setError(data.error || 'Error al enviar mensaje');
        return false;
      }
    } catch (err) {
      console.error('❌ Error de conexión al enviar mensaje:', err);

      // Marcar mensaje como fallido
      setMessages(prev => prev.map(msg =>
        msg.id.startsWith('temp-')
          ? { ...msg, status: 'failed' as any }
          : msg
      ));

      setError('Error de conexión al enviar mensaje');
      return false;
    }
  };

  const sendFile = async (chatId: string, file: File, caption?: string): Promise<boolean> => {
    if (!session?.sessionId) return false;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        const base64Content = base64Data.split(',')[1];

        let endpoint = '';
        const formData = {
          sessionId: session.sessionId,
          number: chatId
        };

        if (file.type.startsWith('image/')) {
          endpoint = '/api/send/image';
          (formData as any).url = `data:${file.type};base64,${base64Content}`;
          (formData as any).caption = caption || '';
          (formData as any).mimetype = file.type;
        } else if (file.type.startsWith('audio/')) {
          endpoint = '/api/send/audio';
          (formData as any).url = `data:${file.type};base64,${base64Content}`;
          (formData as any).mimetype = file.type;
        } else if (file.type.startsWith('video/')) {
          endpoint = '/api/send/video';
          (formData as any).url = `data:${file.type};base64,${base64Content}`;
          (formData as any).caption = caption || '';
          (formData as any).mimetype = file.type;
        }

        const response = await fetch(`${API_BASE}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        const data = await response.json();
        if (data.success) {
          console.log('Archivo enviado exitosamente');
        } else {
          console.error('Error enviando archivo:', data.error);
        }
      };
      reader.readAsDataURL(file);
      return true;
    } catch (err) {
      setError('Error enviando archivo');
      return false;
    }
  };

  const searchMessages = async (chatId: string, query: string): Promise<WhatsAppMessage[]> => {
    if (!session?.sessionId) return [];

    try {
      const response = await fetch(`${API_BASE}/api/messages/${session.sessionId}?number=${chatId}&search=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (data.success && data.messages) {
        return data.messages.map((msg: any) => ({
          id: msg.id,
          from: msg.from,
          to: msg.to,
          message: msg.message,
          text: msg.message,
          timestamp: msg.timestamp,
          type: msg.type || 'text',
          isFromMe: msg.from === 'me' || msg.type === 'sent',
          status: 'delivered'
        }));
      }
      return [];
    } catch (err) {
      console.error('Error buscando mensajes:', err);
      return [];
    }
  };

  const archiveChat = async (chatId: string): Promise<void> => {
    setChats(prev => prev.map(chat =>
      chat.id === chatId ? { ...chat, isArchived: !chat.isArchived } : chat
    ));
  };

  const pinChat = async (chatId: string): Promise<void> => {
    setChats(prev => prev.map(chat =>
      chat.id === chatId ? { ...chat, isPinned: !chat.isPinned } : chat
    ));
  };

  const muteChat = async (chatId: string): Promise<void> => {
    setChats(prev => prev.map(chat =>
      chat.id === chatId ? { ...chat, isMuted: !chat.isMuted } : chat
    ));
  };

  const addReaction = async (messageId: string, reaction: string): Promise<void> => {
    if (!session?.sessionId) return;

    try {
      console.log(`😍 Agregando reacción ${reaction} al mensaje ${messageId}`);

      // Actualizar inmediatamente en la UI
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          const currentReactions = msg.reactions || [];
          const userReaction = currentReactions.find(r => r.userJid === session.sessionId);

          if (userReaction) {
            // Actualizar reacción existente
            return {
              ...msg,
              reactions: currentReactions.map(r =>
                r.userJid === session.sessionId
                  ? { ...r, reaction, timestamp: new Date().toISOString() }
                  : r
              )
            };
          } else {
            // Agregar nueva reacción
            return {
              ...msg,
              reactions: [
                ...currentReactions,
                {
                  userJid: session.sessionId,
                  reaction,
                  timestamp: new Date().toISOString()
                }
              ]
            };
          }
        }
        return msg;
      }));

      const response = await fetch(`${API_BASE}/api/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          reaction,
          userJid: session.sessionId
        })
      });

      const data = await response.json();
      if (data.success) {
        console.log('✅ Reacción agregada exitosamente');
        // Sincronizar con la respuesta del servidor
        setMessages(prev => prev.map(msg =>
          msg.id === messageId
            ? { ...msg, reactions: data.reactions }
            : msg
        ));
      } else {
        console.error('❌ Error agregando reacción:', data.error);
        setError('Error al agregar reacción');
      }
    } catch (error) {
      console.error('❌ Error agregando reacción:', error);
      setError('Error al agregar reacción');
    }
  };

  const removeReaction = async (messageId: string): Promise<void> => {
    if (!session?.sessionId) return;

    try {
      const response = await fetch(`${API_BASE}/api/messages/${messageId}/reactions`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          userJid: session.sessionId
        })
      });

      const data = await response.json();
      if (data.success) {
        setMessages(prev => prev.map(msg =>
          msg.id === messageId
            ? { ...msg, reactions: data.reactions }
            : msg
        ));
      }
    } catch (error) {
      console.error('Error eliminando reacción:', error);
      setError('Error al eliminar reacción');
    }
  };

  const loadMessageReactions = async (messageId: string): Promise<MessageReaction[]> => {
    if (!session?.sessionId) return [];

    try {
      const response = await fetch(`${API_BASE}/api/messages/${messageId}/reactions?sessionId=${session.sessionId}`);
      const data = await response.json();
      
      if (data.success) {
        return data.reactions;
      }
      return [];
    } catch (error) {
      console.error('Error cargando reacciones:', error);
      return [];
    }
  };

  const clearError = () => {
    setError(null);
  };

  const markChatAsRead = useCallback((chatId: string) => {
    setChats(prevChats => 
      prevChats.map(chat => 
        chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
      )
    );
    
    // Also update the document title to remove the unread count
    setTimeout(() => {
      const currentTitle = document.title.replace(/^\(\d+\)\s*/, '');
      const remainingUnread = chats.reduce((total, c) => {
        return c.id === chatId ? total : total + (c.unreadCount || 0);
      }, 0);
      
      if (remainingUnread > 0) {
        document.title = `(${remainingUnread}) ${currentTitle}`;
      } else {
        document.title = currentTitle;
      }
    }, 100);
  }, [chats]);

  const value: WhatsAppContextType = {
    session,
    chats,
    activeChat,
    messages,
    isLoading,
    error,
    replyMessage,
    connectionStatus,
    generateQR,
    connectSession,
    disconnectSession,
    loadChats,
    loadMessages,
    sendMessage,
    sendFile,
    setActiveChat,
    clearError,
    activeCall,
    rejectCall,
    setReplyMessage,
    searchMessages,
    archiveChat,
    pinChat,
    muteChat,
    addReaction,
    removeReaction,
    loadMessageReactions,
    markChatAsRead
  };

  // Escuchar evento de recarga de chats asignados
  useEffect(() => {
    const handleReloadChats = () => {
      console.log('🔄 [CONTEXT] Recargando chats después de transferencia...');
      if (session?.sessionId) {
        loadChats(session.sessionId);
      }
    };

    window.addEventListener('reload-assigned-chats', handleReloadChats);

    return () => {
      window.removeEventListener('reload-assigned-chats', handleReloadChats);
    };
  }, [loadChats, session?.sessionId]);

  return (
    <WhatsAppContext.Provider value={value}>
      {children}
    </WhatsAppContext.Provider>
  );
};