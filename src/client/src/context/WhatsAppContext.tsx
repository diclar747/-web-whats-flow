import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';
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
    console.log('🔊 [AUDIO] Intentando reproducir sonido de notificación');

    // Función helper para reproducir sonido
    const playSound = (context: AudioContext) => {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      // Tono más audible y característico de WhatsApp
      oscillator.frequency.setValueAtTime(880, context.currentTime); // La nota A5
      oscillator.frequency.setValueAtTime(660, context.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(880, context.currentTime + 0.2); // A5

      // Volumen más alto y gradual
      gainNode.gain.setValueAtTime(0.5, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);

      oscillator.type = 'sine'; // Onda sinusoidal para un sonido más suave
      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.5);

      console.log('🔊 [AUDIO] Sonido reproducido exitosamente');
    };

    // Crear un nuevo contexto de audio cada vez para asegurar que funcione
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Verificar si el contexto está suspendido (común en navegadores modernos)
    if (audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        console.log('🔊 [AUDIO] Contexto de audio resumido');
        playSound(audioContext);
      });
    } else {
      playSound(audioContext);
    }
  } catch (error) {
    console.error('🔊 [AUDIO] Error reproduciendo sonido:', error);
  }
};

const showBrowserNotification = (options: NotificationOptions) => {
  console.log('🔔 [NOTIFICACIONES] showBrowserNotification llamada con:', options);

  // 🔇 SONIDO DESACTIVADO - Solo notificaciones visuales
  // if (!options.silent) {
  //   playNotificationSound();
  // }

  // Verificar si las notificaciones del navegador están soportadas
  if (!('Notification' in window)) {
    console.warn('🔔 [NOTIFICACIONES] Las notificaciones del navegador no están soportadas');
    return null;
  }

  console.log('🔔 [NOTIFICACIONES] Permiso actual:', Notification.permission);

  // Si no hay permisos, solicitarlos
  if (Notification.permission === 'default') {
    console.log('🔔 [NOTIFICACIONES] Solicitando permisos...');
    Notification.requestPermission().then(permission => {
      console.log('🔔 [NOTIFICACIONES] Permiso otorgado:', permission);
      if (permission === 'granted') {
        // Mostrar la notificación después de obtener permisos
        showNotification(options);
      }
    });
    return null;
  }

  // Si los permisos están denegados, solo reproducir sonido
  if (Notification.permission !== 'granted') {
    console.warn('🔔 [NOTIFICACIONES] Permisos denegados. Solo se reproducirá sonido.');
    return null;
  }

  // Mostrar notificación
  return showNotification(options);
};

function showNotification(options: NotificationOptions) {
  try {
    console.log('🔔 [NOTIFICACIONES] Mostrando notificación del navegador');

    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon || '/whatsapp-icon.png',
      tag: options.tag || 'whatsapp-message',
      requireInteraction: options.requireInteraction || false,
      silent: true, // Siempre silenciar la notificación del navegador porque usamos nuestro sonido custom
      badge: '/whatsapp-icon.png'
    });

    setTimeout(() => {
      notification.close();
    }, 5000);

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    console.log('🔔 [NOTIFICACIONES] Notificación mostrada exitosamente');
    return notification;
  } catch (error) {
    console.error('🔔 [NOTIFICACIONES] Error mostrando notificación:', error);
    return null;
  }
}

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
  lastMessageFromMe?: boolean; // Indica si el último mensaje fue enviado por mí
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
  assigned_agent_name?: string;
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
  markAllChatsAsRead: () => void;
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
  // Refs para evitar stale closures en listeners de socket
  const chatsRef = useRef<WhatsAppChat[]>([]);
  const activeChatRef = useRef<WhatsAppChat | null>(null);
  const connectedAtRef = useRef<number>(0);
  const lastChatsLoadAtRef = useRef<number>(0);

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

  // Actualizar refs cuando cambian los estados
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        console.log(`🔔 Permiso de notificaciones: ${permission}`);
        return permission === 'granted';
      }
      return Notification.permission === 'granted';
    }
    return false;
  };

  const loadChats = useCallback(async (sessionId: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      // Si es agente, usar endpoint de chats asignados
      const isAgent = userRole && userRole !== 'admin';
      const endpoint = isAgent && userId
        ? `${API_BASE}/api/agents/${userId}/chats?sessionId=${sessionId}`
        : `${API_BASE}/api/chats/${sessionId}`;

      console.log(`🔄 Cargando chats desde API (${isAgent ? 'AGENTE' : 'ADMIN'}):`, endpoint);
      const response = await fetch(endpoint);
      const data = await response.json();

      if (data.success && data.chats) {
        console.log(`✅ Chats cargados exitosamente: ${data.chats.length}`);

        const chatMap = new Map();

        data.chats.forEach((chat: any) => {
          if (!chatMap.has(chat.id)) {
            chatMap.set(chat.id, {
              id: chat.id,
              name: chat.subject || chat.name || chat.id.split('@')[0] || 'Desconocido',
              isGroup: chat.isGroup || chat.id.includes('@g.us'),
              lastMessage: chat.lastMessage || 'Toca para cargar mensajes',
              lastMessageFromMe: chat.fromMe !== undefined ? chat.fromMe : undefined, // Mapear campo del servidor
              timestamp: chat.timestamp || new Date().toISOString(),
              isOnline: !chat.isGroup && !chat.id.includes('@g.us'),
              // Reiniciar contadores de no leídos al cargar para evitar badges fantasma
              unreadCount: 0,
              avatar: chat.avatar || null,
              lastSeen: chat.lastSeen || null,
              isPinned: chat.isPinned || false,
              isMuted: chat.isMuted || false,
              isArchived: chat.isArchived || false,
              assigned_agent_name: chat.assigned_to || chat.assigned_agent_name
            });
          }
        });

        const mappedChats: WhatsAppChat[] = Array.from(chatMap.values());
        console.log(`📱 Chats únicos cargados: ${mappedChats.length} de ${data.chats.length} total`);

        // FILTRAR GRUPOS: NO guardar grupos en el estado
        const individualChats = mappedChats.filter(chat => !chat.isGroup);
        const groupCount = mappedChats.filter(chat => chat.isGroup).length;
        console.log(`📋 Filtrando ${groupCount} grupos. Solo contactos individuales: ${individualChats.length}`);

        setChats(individualChats);
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
    const savedSessionId = sessionStorage.getItem('whatsflow_session');
    if (savedSessionId) {
      console.log('Sesión encontrada en localStorage:', savedSessionId);
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

            await requestNotificationPermission();

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
  }, [loadChats, API_BASE]);

  useEffect(() => {
    if (session?.sessionId) {
      console.log('Conectando socket para sessionId:', session.sessionId);
      const socketURL = getSocketURL();
      console.log('URL del socket:', socketURL);
      const newSocket = io(socketURL, { query: { sessionId: session.sessionId } });

      newSocket.on('connect', () => {
        console.log('Socket conectado en WhatsAppContext:', newSocket.id);
        // Unirse al room de la sesión
        newSocket.emit('join-session', session.sessionId);
        // Registrar momento de conexión para filtrar mensajes antiguos
        connectedAtRef.current = Date.now();
        setConnectionStatus('connected');
      });

      newSocket.on('joined-session', (data: any) => {
        console.log('✅ Unido exitosamente a la sesión:', data);
      });

      newSocket.on('disconnect', (reason: string) => {
        console.log('Socket desconectado en WhatsAppContext, razón:', reason);
        // Solo cambiar el estado a desconectado, no eliminar la sesión
        setConnectionStatus('disconnected');
      });

      newSocket.on('connect_error', (error: Error) => {
        console.error('Error de conexión del socket:', error);
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

      // Recargar chats periódicamente para asegurar sincronización
      const syncInterval = setInterval(() => {
        if (loadChats && session?.sessionId) {
          console.log('🔄 [AUTO-SYNC] Recargando chats automáticamente...');
          loadChats(session.sessionId);
        }
      }, 10000); // Cada 10 segundos

      // LOG DE DEBUG: Capturar TODOS los eventos para debugging
      newSocket.onAny((eventName: string, ...args: any[]) => {
        console.log(`🔔 [SOCKET-EVENT] Evento recibido: ${eventName}`, args);
      });

      newSocket.on('message', (newMessage: WhatsAppMessage) => {
        console.log('🎉🎉🎉 MENSAJE RECIBIDO - INICIANDO PROCESAMIENTO');

        // Normalizar chatJid - puede venir en diferentes formatos
        const rawChatJid = newMessage.chatJid || (newMessage as any).chat_jid || newMessage.to || newMessage.from;
        const normalizedChatJid = rawChatJid?.includes('@') ? rawChatJid : `${rawChatJid}@s.whatsapp.net`;

        console.log('📨 Mensaje recibido en WhatsAppContext:', {
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

        // Notificaciones para mensajes entrantes - SIEMPRE mostrar
        if (!mappedMessage.isFromMe) {
          console.log('🔔 [NOTIFICACIONES] Procesando notificación para mensaje entrante');

          const chat = chatsRef.current.find(c => c.id === mappedMessage.chatJid);
          const senderName = chat?.name || mappedMessage.from?.split('@')[0] || 'Contacto';
          const messagePreview = mappedMessage.message || 'Nuevo mensaje multimedia';

          // SIEMPRE mostrar notificación y reproducir sonido
          console.log('🔔 [NOTIFICACIONES] Mostrando notificación para:', senderName);
          showBrowserNotification({
            title: `💬 ${senderName}`,
            body: messagePreview.length > 50 ? messagePreview.substring(0, 50) + '...' : messagePreview,
            icon: chat?.avatar || '/favicon.ico',
            tag: `chat-${mappedMessage.chatJid}`,
            requireInteraction: false,
            silent: false
          });

          // Actualizar contador en el título
          const currentTitle = document.title;
          if (!currentTitle.startsWith('(')) {
            const unreadCount = chatsRef.current.reduce((total, c) => total + (c.unreadCount || 0), 0) + 1;
            document.title = `(${unreadCount}) ${currentTitle}`;
          }
        }

        // Actualizar mensajes solo si es del chat activo
        // Comparar sin importar si tiene @ o no
        const isActiveChat = activeChatRef.current && mappedMessage.chatJid && (
          mappedMessage.chatJid === activeChatRef.current.id ||
          mappedMessage.chatJid.split('@')[0] === activeChatRef.current.id.split('@')[0]
        );

        console.log('🔍 Verificando si es chat activo:', {
          isActiveChat,
          mappedChatJid: mappedMessage.chatJid,
          activeChatId: activeChatRef.current?.id,
          comparison: mappedMessage.chatJid === activeChatRef.current?.id
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
        console.log('🔄🔄🔄 ACTUALIZANDO LISTA DE CHATS');
        console.log('📊 Chats actuales:', chatsRef.current.length);
        console.log('💬 Mensaje a agregar:', mappedMessage.chatJid);

        setChats(prev => {
          console.log('🔥 setChats EJECUTÁNDOSE con', prev.length, 'chats');
          let chatExists = false;
          const updatedChats = prev.map(chat => {
            const chatId = mappedMessage.chatJid;
            if (chat.id === chatId) {
              chatExists = true;
              console.log('✅ Chat encontrado! Actualizando:', chatId);
              // Solo incrementar unreadCount si NO soy yo, NO es el chat activo y es reciente
              const isChatCurrentlyActive = activeChatRef.current?.id === chatId;
              const msgTime = new Date(mappedMessage.timestamp || Date.now()).getTime();
              const isRecent = msgTime >= (connectedAtRef.current - 5000);
              const shouldIncrementUnread = !mappedMessage.isFromMe && !isChatCurrentlyActive && isRecent;
              console.log('🔔 [BADGE] isFromMe:', mappedMessage.isFromMe, 'isActive:', isChatCurrentlyActive, 'inc:', shouldIncrementUnread);
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
            const msgTime = new Date(mappedMessage.timestamp || Date.now()).getTime();
            const isRecent = msgTime >= (connectedAtRef.current - 5000);
            const newChat: WhatsAppChat = {
              id: mappedMessage.chatJid,
              name: mappedMessage.from?.split('@')[0] || (mappedMessage.chatJid?.split('@')[0] || 'Desconocido'),
              isGroup: mappedMessage.chatJid.includes('@g.us'),
              lastMessage: mappedMessage.message,
              timestamp: mappedMessage.timestamp,
              isOnline: !mappedMessage.chatJid.includes('@g.us'),
              unreadCount: mappedMessage.isFromMe ? 0 : (isRecent ? 1 : 0),
              avatar: undefined
            };
            updatedChats.unshift(newChat);

            // Recargar chats completos desde el servidor para obtener información actualizada
            console.log('🔄 Recargando lista completa de chats desde el servidor...');
            if (loadChats && session?.sessionId) {
              loadChats(session.sessionId);
            }
          }

          return updatedChats.sort((a, b) => {
            const aTimestamp = new Date(a.timestamp || 0).getTime();
            const bTimestamp = new Date(b.timestamp || 0).getTime();
            return bTimestamp - aTimestamp;
          });
        });
      });

      // Listener para actualizaciones de estado de mensaje (✓ ✓✓)
      newSocket.on('message-status-update', (update: any) => {
        console.log('📬 Actualización de estado recibida:', update);
        const { messageId, id, status, chatJid } = update;
        const msgId = messageId || id;

        if (msgId && status) {
          // Actualizar estado del mensaje en la lista de mensajes actual
          setMessages(prevMessages =>
            prevMessages.map(msg =>
              msg.id === msgId ? { ...msg, status } : msg
            )
          );

          console.log(`✅ Estado de mensaje ${msgId} actualizado a: ${status}`);
        }
      });

      // Nuevo evento: sync-complete - se emite cuando se completa la sincronización
      newSocket.on('sync-complete', (data: any) => {
        console.log('🔄 Sincronización completa recibida:', data);
        if (data?.success) {
          console.log(`✅ Sincronización exitosa: ${data.chatCount} chats`);
          // NO recargar chats automáticamente - los mensajes ya llegan via socket
          console.log('📡 Chats se actualizan en tiempo real via socket');
        } else if (data?.error) {
          console.error('❌ Error en la sincronización:', data.error);
        } else {
          console.warn('⚠️ sync-complete recibido sin success ni error definido');
        }
      });

      return () => {
        console.log('Desconectando socket en WhatsAppContext');
        clearInterval(syncInterval);
        newSocket.disconnect();
      };
    }

    return () => {
      // Cleanup por defecto si no hay sessionId
    };
  }, [session?.sessionId, loadChats]); // Solo reconectar cuando cambia la sesión, NO cuando cambia el chat activo

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
    sessionStorage.setItem('whatsflow_session', sessionId);
    loadChats(sessionId);
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
      // IMPORTANTE: Limpiar mensajes ANTES de empezar a cargar los nuevos
      console.log(`🗑️ Limpiando mensajes anteriores antes de cargar chat: ${chatId}`);
      setMessages([]);
      setIsLoading(true);

      console.log(`🔄 Cargando TODOS los mensajes para chat: ${chatId}`);

      // Cargar TODOS los mensajes sin límite
      const response = await fetch(`${API_BASE}/api/messages/${session.sessionId}?number=${chatId}&limit=10000`);
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
      const sentByUserId = sessionStorage.getItem('userId');
      const sentByUserName = sessionStorage.getItem('userName');

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

  const markAllChatsAsRead = useCallback(() => {
    console.log('🔔 [CHAT] Marcando todos los chats como leídos');
    setChats(prevChats =>
      prevChats.map(chat => ({ ...chat, unreadCount: 0 }))
    );

    // Limpiar el título del documento
    setTimeout(() => {
      const currentTitle = document.title.replace(/^\(\d+\)\s*/, '');
      document.title = currentTitle;
    }, 100);
  }, []);

  // Memoizar el valor del contexto para evitar re-renders innecesarios
  const value: WhatsAppContextType = useMemo(() => ({
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
    markChatAsRead,
    markAllChatsAsRead
  }), [
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
    markChatAsRead,
    markAllChatsAsRead
  ]);

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
