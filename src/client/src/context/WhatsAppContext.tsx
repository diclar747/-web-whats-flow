import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';
import { getSocketURL, getAPIBaseURL } from '../utils/socketConfig';
import { useSocket } from './SocketContext';

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

const initializeSound = () => {
  if (!window.notificationSound) {
    console.log('🔊 [AUDIO] Creando objeto de audio global...');
    const audio = new Audio('/notification.mp3');
    audio.volume = 0.5;
    audio.preload = 'auto';
    window.notificationSound = audio;
  }

  // Cargar audio
  window.notificationSound.load();

  // Intentar desbloquear con interacción
  const unlockAudio = () => {
    const audio = window.notificationSound;
    if (audio) {
      audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        console.log('🔊 [AUDIO] Audio desbloqueado exitosamente');
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
      }).catch(err => {
        console.log('🔊 [AUDIO] Esperando interacción para audio:', err.message);
      });
    }
  };

  window.addEventListener('click', unlockAudio);
  window.addEventListener('touchstart', unlockAudio);
};

const playNotificationSound = () => {
  console.log('🔊 [AUDIO] Intentando reproducir sonido...');
  const audio = window.notificationSound;

  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(e => {
      console.warn('⚠️ [AUDIO] No se pudo reproducir MP3, usando fallback beep:', e.message);
      playBeepFallback();
    });
  } else {
    playBeepFallback();
  }
};

const playBeepFallback = () => {
  try {
    const context = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    gainNode.gain.setValueAtTime(0.1, context.currentTime);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.1);
  } catch (e) {
    console.error('❌ [AUDIO] Beep fallback falló:', e);
  }
};

const showBrowserNotification = (options: NotificationOptions) => {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon || '/whatsapp-icon.png',
      tag: options.tag || 'whatsapp-message',
      silent: true // Usamos nuestro propio sonido
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    setTimeout(() => notification.close(), 5000);

    if (!options.silent) playNotificationSound();
    return notification;
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') showBrowserNotification(options);
    });
  }

  // Si no hay permiso, al menos sonar
  if (!options.silent) playNotificationSound();
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
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'pending';
  lastUpdate?: number; // 🔥 NUEVO: Timestamp del último cambio para animaciones
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
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'system';
  isFromMe: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  chatJid?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  sentBy?: string; // Nombre del agente que envió el mensaje
  agent_id?: number; // 🔥 ID del agente que envió el mensaje
  agent_name?: string; // 🔥 Nombre del agente que envió el mensaje
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
  loadChats: (sessionId: string, dateFilter?: string, offset?: number, append?: boolean) => Promise<void>;
  hasMoreChats: boolean;
  isLoadingMoreChats: boolean;
  loadMessages: (chatId: string) => Promise<void>;
  sendMessage: (chatId: string, message: string, contextInfo?: any) => Promise<boolean>;
  sendFile: (chatId: string, file: File, caption?: string) => Promise<boolean>;
  setActiveChat: (chat: WhatsAppChat | null) => void;
  clearError: () => void;
  rejectCall: (callId: string) => Promise<void>;
  setReplyMessage: (message: WhatsAppMessage | null) => void;
  searchMessages: (chatId: string, query: string) => Promise<WhatsAppMessage[]>;
  pinChat: (chatId: string) => Promise<void>;
  muteChat: (chatId: string) => Promise<void>;
  addReaction: (messageId: string, reaction: string) => Promise<void>;
  removeReaction: (messageId: string) => Promise<void>;
  loadMessageReactions: (messageId: string) => Promise<MessageReaction[]>;
  markChatAsRead: (chatId: string) => void;
  markAllChatsAsRead: () => void;
  transferRequest: any | null;
  setTransferRequest: (request: any | null) => void;
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  setChats: React.Dispatch<React.SetStateAction<WhatsAppChat[]>>;
  typingStatus: { [chatId: string]: string };
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
  // Cache para mensajes por chat
  const messagesCacheRef = useRef<Map<string, WhatsAppMessage[]>>(new Map());
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const messagesRef = useRef<WhatsAppMessage[]>([]); // Ref para acceso síncrono en listeners
  const [typingStatus, setTypingStatus] = useState<Map<string, string>>(new Map()); // 🔥 NUEVO: Estado de escritura

  // Sincronizar ref con state
  useEffect(() => {
    messagesRef.current = messages;
    // Actualizar cache si hay un chat activo y mensajes cargados
    if (activeChat?.id && messages.length > 0) {
      messagesCacheRef.current.set(activeChat.id, messages);
    }
  }, [messages, activeChat]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [replyMessage, setReplyMessage] = useState<WhatsAppMessage | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [hasMoreChats, setHasMoreChats] = useState(true);
  const [isLoadingMoreChats, setIsLoadingMoreChats] = useState(false);
  const [transferRequest, setTransferRequest] = useState<any | null>(null);

  const { socket, isConnected: isSocketConnected } = useSocket();

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

  const loadChats = useCallback(async (sessionId: string, dateFilter: string = 'all', offset: number = 0, append: boolean = false): Promise<void> => {
    // 🛡️ SEGURIDAD: No intentar cargar chats si no hay token (tras logout o sesión expirada)
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (!token) {
      console.log('[WhatsAppContext] 🛑 Omitiendo loadChats: No hay token de autenticación');
      return;
    }

    if (!sessionId) {
      console.log('[WhatsAppContext] 🛑 Omitiendo loadChats: sessionId es nulo o indefinido');
      return;
    }
    console.log('[WhatsAppContext] 🚀 loadChats llamado con:', {
      sessionId,
      dateFilter,
      userRole,
      userId,
      stackTrace: new Error().stack?.split('\n').slice(1, 4).join('\n')
    });

    try {
      setIsLoading(true);
      setError(null);

      // Si es agente, usar endpoint de chats asignados
      const isAgent = userRole && userRole !== 'admin';
      const limit = 500; // ⚡ OPTIMIZADO: Aumentado de 20 a 500 para cargar todos los chats
      const offsetParam = offset || 0; // Si no se pasa, es 0

      if (append) {
        setIsLoadingMoreChats(true);
      } else {
        setIsLoading(true);
        // Si es carga nueva (no append), resetear hasMoreChats temporalmente
        setHasMoreChats(true);
      }

      const endpoint = isAgent && userId
        ? `${API_BASE}/api/agents/${userId}/chats?sessionId=${sessionId}&dateFilter=${dateFilter}&limit=${limit}&offset=${offsetParam}`
        : `${API_BASE}/api/chats/${sessionId}?dateFilter=${dateFilter}&limit=${limit}&offset=${offsetParam}`;

      console.log(`🔄 Cargando chats desde API (${isAgent ? 'AGENTE' : 'ADMIN'}) con filtro: ${dateFilter}`, endpoint);
      const response = await fetch(endpoint);
      const data = await response.json();

      console.log('[WhatsAppContext] 📦 Respuesta de API recibida:', {
        success: data.success,
        chatsLength: data.chats?.length,
        source: data.source,
        fullData: data
      });

      if (data.success && data.chats) {
        console.log(`✅ Chats cargados exitosamente: ${data.chats.length}`);

        const chatMap = new Map();

        data.chats.forEach((chat: any) => {
          // Safety check: ensure chat.id exists
          if (!chat.id && chat.chat_jid) chat.id = chat.chat_jid; // Fallback for agent chats

          if (chat.id && !chatMap.has(chat.id)) {
            chatMap.set(chat.id, {
              id: chat.id,
              name: chat.subject || chat.name || (chat.id ? chat.id.split('@')[0] : 'Desconocido'),
              isGroup: chat.isGroup || (chat.id && chat.id.includes('@g.us')),
              lastMessage: chat.lastMessage || 'Toca para cargar mensajes',
              lastMessageFromMe: chat.fromMe !== undefined ? chat.fromMe : undefined, // Mapear campo del servidor
              timestamp: chat.timestamp || new Date().toISOString(),
              isOnline: !chat.isGroup && !chat.id.includes('@g.us'),
              unreadCount: 0,
              avatar: chat.avatar || null,
              lastSeen: chat.lastSeen || null,
              isPinned: chat.isPinned || false,
              isMuted: chat.isMuted || false,
              isArchived: chat.isArchived || false,
              assigned_agent_name: chat.assigned_to || chat.assigned_agent_name,
              status: chat.status || 'pending'
            });
          }
        });

        const mappedChats: WhatsAppChat[] = Array.from(chatMap.values());
        console.log(`📱 Chats únicos cargados: ${mappedChats.length} de ${data.chats.length} total`);

        // FILTRAR GRUPOS: YA NO FILTRAR GRUPOS - Mostrarlos para la pestaña respectiva
        // 🔒 Filtro: NO chats propios, NO LIDs, NO Status broadcast
        const currentSessionId = sessionId;
        const currentPhone = String(currentSessionId || '').split(':')[0]?.split('@')[0];

        const filteredChats = mappedChats.filter(chat => {
          // ✅ FIX: Permitir grupos (se filtrarán visualmente en tabs)
          // if (chat.isGroup) return false; 

          if (chat.id.includes('@lid')) return false;
          if (chat.id.includes('status@broadcast')) return false;

          // 🛡️ FILTRO MEJORADO: Normalizar números para comparación
          const chatNumber = chat.id.split('@')[0].split(':')[0]; // Extraer solo el número

          // Comparar números normalizados (sin @, sin :, sin espacios)
          if (currentPhone && chatNumber === currentPhone) {
            console.log('[WhatsAppContext] 🚫 Filtrando chat propio (número exacto):', chat.id, 'vs', currentPhone);
            return false;
          }

          // Verificar variaciones comunes
          if (currentPhone && (
            chat.id === currentPhone ||
            chat.id === `${currentPhone}@s.whatsapp.net` ||
            chat.id === `${currentPhone}@c.us` ||
            chat.id.startsWith(currentPhone + ':')
          )) {
            console.log('[WhatsAppContext] 🚫 Filtrando chat propio (variación):', chat.id);
            return false;
          }

          return true;
        })
          // ⚡ ORDENAR EXPLÍCITAMENTE
          .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

        const groupCount = filteredChats.filter(chat => chat.isGroup).length;
        console.log(`📋 Chats filtrados: ${filteredChats.length}. Grupos incluidos: ${groupCount}`);

        console.log('[WhatsAppContext] 💾 Guardando chats en estado (ordenado):', filteredChats.length);
        console.log('[WhatsAppContext] 📅 Fechas de chats:', filteredChats.map(c => ({
          name: c.name,
          timestamp: c.timestamp,
        })).slice(0, 5));

        if (append) {
          setChats(prev => {
            // Evitar duplicados al añadir
            const existingIds = new Set(prev.map(c => c.id));
            const newUniqueChats = filteredChats.filter(c => !existingIds.has(c.id));
            // Ordenar todo de nuevo al unir
            return [...prev, ...newUniqueChats].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
          });
          console.log(`[WhatsAppContext] ➕ Chats añadidos: ${filteredChats.length}`);
        } else {
          setChats(filteredChats);
          console.log('[WhatsAppContext] ✅ Chats reemplazados (inicio):', filteredChats.length);
        }

        const pagination = (data as any).pagination;
        if (pagination) {
          setHasMoreChats(pagination.hasMore);
          console.log(`[WhatsAppContext] 📜 Paginación: hasMore=${pagination.hasMore}, count=${pagination.count}`);
        } else {
          // Fallback si no hay info de paginación
          setHasMoreChats(filteredChats.length >= limit);
        }

        setConnectionStatus('connected');
      } else if (data.source === 'database_fallback') {
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

        if (!append) setChats(fallbackChats);
        setConnectionStatus('connected');
        if (!append) setError('Usando datos guardados. Conecte WhatsApp para ver chats completos.');
      } else {
        console.error('[WhatsAppContext] ❌ No se encontraron chats o API falló:', {
          success: data.success,
          hasChats: !!data.chats,
          chatsLength: data.chats?.length,
          error: data.error,
          message: data.message,
          chatsActuales: chats.length
        });

        // 🛡️ NO limpiar chats si ya tenemos datos cargados (mantener estabilidad)
        if (chats.length > 0) {
          console.warn('[WhatsAppContext] ⚠️ API falló pero manteniendo chats existentes:', chats.length);
          setConnectionStatus('error');
          setError('Error actualizando chats. Mostrando última versión disponible.');
        } else {
          console.log('[WhatsAppContext] 🚫 No hay chats previos, no cargar datos vacíos');
          setConnectionStatus('error');
          setError('No se pudieron cargar los chats. Verifique la conexión de WhatsApp.');
        }
      }
    } catch (error) {
      console.error('❌ Error cargando chats:', error);
      setError('Error de conexión. No se pudieron cargar los chats.');
      setConnectionStatus('error');
    } finally {
      if (append) {
        setIsLoadingMoreChats(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [API_BASE, userId, userRole]);

  useEffect(() => {
    // 🔄 FIX: Check localStorage too in case AuthContext hasn't synced it to sessionStorage yet
    const savedSessionId = sessionStorage.getItem('whinsap_session') || localStorage.getItem('whinsap_session');
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

            // await requestNotificationPermission(); // 🚫 Desactivado para usar Modal UI moderno

            console.log('📱 Cargando chats automáticamente...');
            await loadChats(savedSessionId);
          } else {
            console.log('Sesión guardada pero no conectada. Manteniendo en localStorage para posibles reintentos...');
            setConnectionStatus('disconnected');
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

  // Efecto para manejar eventos del socket compartido
  useEffect(() => {
    if (!socket || !session?.sessionId) return;

    console.log('🔄 [WhatsAppContext] Configurando listeners en socket compartido for session:', session.sessionId);

    const handleMessage = (newMessage: WhatsAppMessage) => {
      console.log('📨 [REAL-TIME] handleMessage recibido:', newMessage);

      // ⚡ OPTIMIZACIÓN: Normalizar chatJid de forma más eficiente
      const rawChatJid = newMessage.chatJid || (newMessage as any).chat_jid || newMessage.to || newMessage.from;
      const normalizedChatJid = rawChatJid?.includes('@') ? rawChatJid : `${rawChatJid}@s.whatsapp.net`;
      const chatPhone = normalizedChatJid?.split('@')[0];

      // ⚡ OPTIMIZACIÓN: Mapear mensaje con operaciones mínimas
      const mappedMessage: WhatsAppMessage = {
        ...newMessage,
        message: newMessage.message || newMessage.text || '',
        text: newMessage.message || newMessage.text || '',
        chatJid: normalizedChatJid,
        isFromMe: Boolean((newMessage as any).from_me || newMessage.isFromMe),
        agent_id: (newMessage as any).agent_id,
        agent_name: (newMessage as any).agent_name
      };

      // ⚡ OPTIMIZACIÓN: Notificaciones Inmediatas (Sin requestIdleCallback)
      if (!mappedMessage.isFromMe) {
        console.log('🔔 [REAL-TIME] Procesando notificación para mensaje entrante...');

        // Buscar chat de forma robusta
        const chat = chatsRef.current.find(c =>
          c.id === mappedMessage.chatJid || c.id.split('@')[0] === chatPhone
        );
        const senderName = chat?.name || mappedMessage.from?.split('@')[0] || 'Contacto';
        const messagePreview = mappedMessage.message || 'Nuevo mensaje multimedia';

        // 1. Mostrar notificación visual (si estamos en segundo plano o no es el chat activo)
        const isCurrentChatActive = activeChatRef.current?.id === mappedMessage.chatJid;
        if (document.hidden || !isCurrentChatActive) {
          showBrowserNotification({
            title: `💬 ${senderName}`,
            body: messagePreview.length > 50 ? messagePreview.substring(0, 50) + '...' : messagePreview,
            icon: chat?.avatar || '/favicon.ico',
            tag: `chat-${mappedMessage.chatJid}`,
            requireInteraction: false,
            silent: false // El sonido se maneja dentro de showBrowserNotification o fallback
          });
        }

        // ⚡ Actualizar título dinámicamente
        const currentTitle = document.title;
        if (!currentTitle.startsWith('(')) {
          const unreadCount = chatsRef.current.reduce((total, c) => total + (c.unreadCount || 0), 0) + 1;
          document.title = `(${unreadCount}) ${currentTitle}`;
        }
      }

      // ⚡ OPTIMIZACIÓN: Actualizar mensajes del chat activo de forma robusta
      const activeChatId = activeChatRef.current?.id;
      const isActiveChat = activeChatId && (
        activeChatId === mappedMessage.chatJid ||
        activeChatId.split('@')[0] === chatPhone
      );

      if (isActiveChat) {
        console.log('✅ [REAL-TIME] Mensaje pertenece al chat activo, actualizando UI...');
        requestAnimationFrame(() => {
          setMessages(prev => {
            // Evitar duplicados por ID
            if (prev.some(msg => msg.id === mappedMessage.id)) return prev;

            // Lógica de reemplazo de temporales optimizada
            if (mappedMessage.isFromMe) {
              const tempIndex = prev.findIndex(msg =>
                msg.id.startsWith('temp-') &&
                msg.message === mappedMessage.message
              );
              if (tempIndex !== -1) {
                const newArr = [...prev];
                newArr[tempIndex] = mappedMessage;
                return newArr;
              }
            }

            const updated = [...prev, mappedMessage].sort((a, b) =>
              new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
            );

            // Actualizar cache
            if (activeChatId) messagesCacheRef.current.set(activeChatId, updated);
            return updated;
          });

          // Scroll más agresivo y fiable (como WhatsApp Web)
          setTimeout(() => {
            const container = document.querySelector('[data-messages-container]');
            if (container) {
              container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth'
              });
            }
          }, 50);
        });
      } else {
        console.log('ℹ️ [REAL-TIME] Mensaje NO es del chat activo:', { activeChatId, msgChat: mappedMessage.chatJid });
      }

      // ⚡ OPTIMIZACIÓN: Actualizar lista de chats (Historial)
      setChats(prev => {
        // Buscar chat robustamente (matching exacto o por número)
        const chatIndex = prev.findIndex(c =>
          c.id === mappedMessage.chatJid || c.id.split('@')[0] === chatPhone
        );

        if (chatIndex !== -1) {
          console.log('[REAL-TIME] Actualizando chat existente en lista:', prev[chatIndex].name);
          const chat = prev[chatIndex];
          const isMsgForActiveChat = activeChatRef.current?.id === (chat.id || mappedMessage.chatJid);
          const shouldIncrementUnread = !mappedMessage.isFromMe && !isMsgForActiveChat;

          const updatedChat = {
            ...chat,
            lastMessage: mappedMessage.message,
            timestamp: mappedMessage.timestamp,
            unreadCount: shouldIncrementUnread ? (chat.unreadCount || 0) + 1 : (isMsgForActiveChat ? 0 : chat.unreadCount || 0),
            status: mappedMessage.status || 'delivered',
            lastUpdate: Date.now() // 🔥 Marcar actualización para animación
          };

          const newChats = [...prev];
          newChats.splice(chatIndex, 1);
          return [updatedChat, ...newChats];
        } else if (mappedMessage.chatJid) {
          console.log('[REAL-TIME] Creando NUEVO chat en lista:', mappedMessage.chatJid);

          // 🛡️ FILTRO ROBUSTO DE CHAT PROPIO & LID
          if (mappedMessage.chatJid.includes('@lid')) {
            console.log('[REAL-TIME] 🚫 Ignorando chat LID:', mappedMessage.chatJid);
            return prev;
          }
          const currentPhone = String(session?.sessionId || '').split(':')[0]?.split('@')[0];
          if (currentPhone && (chatPhone === currentPhone ||
            mappedMessage.chatJid === currentPhone ||
            mappedMessage.chatJid === `${currentPhone}@s.whatsapp.net` ||
            mappedMessage.chatJid === `${currentPhone}@c.us` ||
            mappedMessage.chatJid.startsWith(currentPhone + ':'))) {
            console.log('[REAL-TIME] 🚫 Ignorando chat propio en creación:', mappedMessage.chatJid);
            return prev;
          }

          const newChat: WhatsAppChat = {
            id: mappedMessage.chatJid,
            name: mappedMessage.from?.split('@')[0] || chatPhone || 'Desconocido',
            isGroup: mappedMessage.chatJid.includes('@g.us'),
            lastMessage: mappedMessage.message,
            timestamp: mappedMessage.timestamp,
            isOnline: !mappedMessage.chatJid.includes('@g.us'),
            unreadCount: mappedMessage.isFromMe ? 0 : 1,
            avatar: undefined,
            status: 'delivered'
          };

          // ⚡ ORDENAMIENTO ESTRICTO: Siempre ordenar por fecha descendente
          return [newChat, ...prev].sort((a, b) =>
            new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
          );
        }
        return prev;
      });
    };

    const handleConnect = () => {
      console.log('✅ [WhatsAppContext] Socket conectado');
      setConnectionStatus('connected');
      if (session?.sessionId) {
        socket.emit('join-session', { sessionId: session.sessionId });
      }
      connectedAtRef.current = Date.now();
    };

    const handleDisconnect = (reason: string) => {
      console.log('❌ [WhatsAppContext] Socket desconectado:', reason);
      setConnectionStatus('disconnected');
    };

    const handleConnectError = (err: any) => {
      console.error('⚠️ [WhatsAppContext] Error de conexión:', err);
      setConnectionStatus('error');
    };

    const handleJoinedSession = (data: any) => {
      console.log('✅ [WhatsAppContext] Unido a sesión:', data);
    };

    const handleIncomingCall = (call: Call) => {
      setActiveCall(call);
    };

    const handleMessageStatusUpdate = ({ id, status, chatJid }: { id: string; status: string; chatJid?: string }) => {
      console.log('📊 [WhatsAppContext] Estado mensaje actualizado:', id, status, chatJid);

      const statusOrder: Record<string, number> = { 'read': 4, 'visto': 4, 'delivered': 3, 'entregado': 3, 'sent': 2, 'enviado': 2, 'pending': 1, 'received': 0 };
      const newOrder = statusOrder[status] || 0;

      setMessages(prev => {
        const index = prev.findIndex(m => m.id === id);
        if (index === -1) return prev;

        const currentOrder = statusOrder[prev[index].status || ''] || 0;
        if (newOrder <= currentOrder) return prev; // No degradar

        const newMessages = [...prev];
        newMessages[index] = { ...newMessages[index], status: status as any };
        return newMessages;
      });

      // También actualizar estado en la lista de chats si es el último mensaje
      if (chatJid) {
        setChats(prev => {
          const index = prev.findIndex(c => c.id === chatJid);
          if (index === -1) return prev;

          const currentOrder = statusOrder[prev[index].status || ''] || 0;
          if (newOrder <= currentOrder) return prev; // No degradar

          const newChats = [...prev];
          newChats[index] = { ...newChats[index], status: status as any };
          return newChats;
        });
      }
    };

    // 🔥 NUEVO: Manejar actualización de presencia (typing/recording)
    const handlePresenceUpdate = (data: any) => {
      const { chatJid, presences } = data;
      const jid = Object.keys(presences)[0];
      const presence = presences[jid];

      if (presence && presence.lastKnownPresence) {
        setTypingStatus(prev => {
          const newMap = new Map(prev);
          if (presence.lastKnownPresence === 'composing') {
            newMap.set(chatJid, 'escribiendo...');
          } else if (presence.lastKnownPresence === 'recording') {
            newMap.set(chatJid, 'grabando audio...');
          } else {
            newMap.delete(chatJid);
          }
          return newMap;
        });

        // Limpieza automática tras 5 segundos si no hay más updates
        setTimeout(() => {
          setTypingStatus(prev => {
            if (prev.has(chatJid)) {
              const newMap = new Map(prev);
              newMap.delete(chatJid);
              return newMap;
            }
            return prev;
          });
        }, 5000);
      }
    };

    const handleConnectionUpdate = (data: any) => {
      console.log('📱 [WhatsAppContext] Actualización de conexión recibida:', data);
      if (data.status === 'connected' && (data.sessionId || data.newSessionId)) {
        const newSid = data.sessionId || data.newSessionId;
        console.log('🎉 [WhatsAppContext] WhatsApp conectado exitosamente:', newSid);

        setSession({
          sessionId: newSid,
          isConnected: true,
          status: 'connected',
          lastActivity: new Date().toISOString(),
          phoneNumber: data.phoneNumber
        });
        setConnectionStatus('connected');
        sessionStorage.setItem('whinsap_session', newSid);
        loadChats(newSid);
      } else if (data.status === 'disconnected') {
        console.log('⚠️ [WhatsAppContext] WhatsApp desconectado');
        setConnectionStatus('disconnected');
        setSession(prev => prev ? { ...prev, isConnected: false, status: 'disconnected' } : null);
      }
    };

    const handleSyncComplete = (data: any) => {
      console.log('🔄 [WhatsAppContext] Sincronización completa:', data);
    };

    const handleWhatsAppConnected = (data: any) => {
      console.log('🎉 [WhatsAppContext] Evento whatsapp-connected recibido:', data);
      // Recargar chats cuando WhatsApp se conecta
      if (session?.sessionId) {
        console.log('🔄 [WhatsAppContext] Recargando chats después de conectar WhatsApp...');
        loadChats(session.sessionId);
      }
    };

    const handleTransferRequest = (data: any) => {
      console.log('🔔 [SOCKET] Solicitud de transferencia recibida:', data);
      setTransferRequest(data);
      playNotificationSound();
    };

    const handleTransferUpdate = (data: any) => {
      console.log('🔔 [SOCKET] Actualización de transferencia:', data);
      // Aquí podrías mostrar un toast o notificación
    };

    const handleChatUpdate = (data: any) => {
      console.log('🔄 [SOCKET] Actualización de chat recibida:', data);

      setChats(prev => {
        const chatIndex = prev.findIndex(c => c.id === data.id);

        // Si el chat ya existe
        if (chatIndex !== -1) {
          const updatedChat = {
            ...prev[chatIndex],
            lastMessage: data.lastMessage,
            timestamp: data.timestamp,
            unreadCount: prev[chatIndex].unreadCount || 0,
            // Opcionalmente actualizar nombre/foto si vienen
            ...(data.name ? { name: data.name } : {}),
            ...(data.profilePicUrl ? { avatar: data.profilePicUrl } : {})
          };

          // Mover al principio
          const newChats = [...prev];
          newChats.splice(chatIndex, 1);
          return [updatedChat, ...newChats];
        } else {
          // Nuevo chat
          const newChat: WhatsAppChat = {
            id: data.id,
            name: data.name || data.id.split('@')[0],
            isGroup: data.id.includes('@g.us'),
            lastMessage: data.lastMessage,
            timestamp: data.timestamp,
            isOnline: !data.id.includes('@g.us'),
            unreadCount: 0,
            avatar: data.profilePicUrl,
            status: 'delivered'
          };
          return [newChat, ...prev];
        }
      });
    };

    // Registrar listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('joined-session', handleJoinedSession);
    socket.on('incoming-call', handleIncomingCall);
    socket.on('message-status-update', handleMessageStatusUpdate);
    socket.on('connection-update', handleConnectionUpdate);
    socket.on('message', handleMessage);
    socket.on('message:received', handleMessage);
    socket.on('message:sent', handleMessage);
    socket.on('chat-update', handleChatUpdate);
    socket.on('sync-complete', handleSyncComplete);
    socket.on('whatsapp-connected', handleWhatsAppConnected);
    if (userId) {
      socket.on(`agent-${userId}-transfer-request`, handleTransferRequest);
    }
    socket.on('transfer-request-update', handleTransferUpdate);

    initializeSound();

    return () => {
      console.log('🔌 [WhatsAppContext] Limpiando listeners');
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('joined-session', handleJoinedSession);
      socket.off('incoming-call', handleIncomingCall);
      socket.off('message-status-update', handleMessageStatusUpdate);
      socket.off('connection-update', handleConnectionUpdate);
      socket.off('message', handleMessage);
      socket.off('message:received', handleMessage);
      socket.off('message:sent', handleMessage);
      socket.off('chat-update', handleChatUpdate);
      socket.off('sync-complete', handleSyncComplete);
      socket.off('whatsapp-connected', handleWhatsAppConnected);
      if (userId) {
        socket.off(`agent-${userId}-transfer-request`, handleTransferRequest);
      }
      socket.off('transfer-request-update', handleTransferUpdate);
    };
  }, [socket, session?.sessionId, isSocketConnected, loadChats, userId]);
  // Solo reconectar cuando cambia la sesión, NO cuando cambia el chat activo

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

      // Obtener deviceId del almacenamiento
      const deviceId = sessionStorage.getItem('device_id')
        || sessionStorage.getItem('whinsap_device_id')
        || sessionStorage.getItem('whinsap_session_device_id')
        || localStorage.getItem('device_id')
        || localStorage.getItem('whinsap_device_id')
        || localStorage.getItem('whinsap_session_device_id')
        || crypto.randomUUID?.()
        || Date.now().toString(36) + Math.random().toString(36).substr(2);

      const response = await fetch(`${API_BASE}/api/qr-status?deviceId=${encodeURIComponent(deviceId)}`);
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

    // 🔒 SEGURIDAD: NO guardar automáticamente el sessionId aquí
    // Solo debe guardarse cuando el usuario EXPLÍCITAMENTE inicia sesión
    // Esta función puede ser llamada desde eventos de Socket.IO sin autenticación
    // sessionStorage.setItem('whinsap_session', sessionId);

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


  // ⚡ OPTIMIZADO: Soporte para paginación y "Load More"
  const loadMessages = async (chatId: string, dateFilter: string = 'all', limit: number = 25, offset: number = 0, append: boolean = false): Promise<void> => {
    if (!session?.sessionId) return;

    try {
      // 1. Si no es "append" (carga inicial), intentar cargar desde cache para respuesta instantánea
      if (!append && messagesCacheRef.current.has(chatId) && offset === 0) {
        console.log(`⚡[CACHE] Cargando mensajes desde cache para: ${chatId} `);
        const cachedMessages = messagesCacheRef.current.get(chatId) || [];
        setMessages(cachedMessages);
        setIsLoading(false);
      } else if (!append) {
        // Solo limpiar si no es append y no hay cache
        setMessages([]);
        setIsLoading(true);
      }

      console.log(`🔄[API] Cargando mensajes para ${chatId} (offset = ${offset}, limit = ${limit}, append = ${append})`);

      // ⚡ URL paginada
      const response = await fetch(`${API_BASE}/api/messages/${session.sessionId}?number=${chatId}&dateFilter=${dateFilter}&limit=${limit}&offset=${offset}`);
      const data = await response.json();

      if (data.success && data.messages) {
        console.log(`✅ Mensajes cargados: ${data.messages.length} para chat ${chatId} `);
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
          agent_id: msg.agent_id,
          agent_name: msg.agent_name,
          contextInfo: msg.contextInfo
        }));

        if (append) {
          // AGREGAR AL INICIO (mensajes más viejos arriba)
          // Filtrar duplicados por si acaso
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newUniqueMessages = mappedMessages.filter(m => !existingIds.has(m.id));
            // Combinar: [nuevos_viejos, ...existentes]
            // NOTA: Depende del orden que devuelva la API.
            // Asumimos API devuelve orden descendente (más recientes primero).
            // Si la API devuelve los mensajes [20..40], deberían ir ANTES de [0..20].
            return [...newUniqueMessages.reverse(), ...prev];
          });
        } else {
          // Reemplazar todo (y guardar en cache)
          // Asegurar orden cronológico (más viejo arriba) para visualización correcta
          const sortedMessages = mappedMessages.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
          setMessages(sortedMessages);
          messagesCacheRef.current.set(chatId, sortedMessages);
        }

        // Marcar mensajes como leídos si no son míos (solo en carga inicial no-append)
        if (!append) {
          const unreadMessages = mappedMessages.filter(msg => !msg.isFromMe && msg.status !== 'read');
          if (unreadMessages.length > 0) {
            console.log(`📖 Marcando ${unreadMessages.length} mensajes como leídos`);
          }
        }
      } else {
        console.log(`ℹ️ No se encontraron mensajes para chat ${chatId} `);
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
      console.log(`📤 Enviando mensaje a ${chatId}: `, message.substring(0, 50) + '...');

      // Crear mensaje temporal para mostrar inmediatamente
      const tempMessage: WhatsAppMessage = {
        id: `temp - ${Date.now()} `,
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
        new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
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
        console.log(`✅ Mensaje enviado exitosamente.ID: ${data.messageId} `);

        // Actualizar mensaje temporal con el real
        setMessages(prev => prev.map(msg =>
          msg.id === tempMessage.id
            ? { ...msg, id: data.messageId || `sent - ${Date.now()} `, status: 'sent' }
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
      // Usar FormData para enviar el archivo directamente al endpoint /api/send/media
      // Esto soporta todos los tipos de archivos y permite enviar metadata del agente
      const formData = new FormData();
      formData.append('sessionId', session.sessionId);
      formData.append('number', chatId);
      formData.append('file', file);
      if (caption) formData.append('caption', caption);

      // Agregar información del agente
      const sentByUserId = sessionStorage.getItem('userId');
      const sentByUserName = sessionStorage.getItem('userName');

      if (sentByUserId) formData.append('agentId', sentByUserId);
      if (sentByUserName) formData.append('agentName', sentByUserName);
      // Compatibilidad
      if (sentByUserId) formData.append('sentBy', sentByUserId);
      if (sentByUserName) formData.append('sentByName', sentByUserName);

      const endpoint = '/api/send/media';

      const response = await fetch(`${API_BASE}${endpoint} `, {
        method: 'POST',
        // No establecer Content-Type header, el navegador lo hará con el boundary correcto para FormData
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        console.log('✅ Archivo enviado exitosamente con atribución de agente');
        return true;
      } else {
        console.error('❌ Error enviando archivo:', data.error);
        return false;
      }
    } catch (err) {
      setError('Error enviando archivo');
      return false;
    }
  };

  const searchMessages = async (chatId: string, query: string): Promise<WhatsAppMessage[]> => {
    if (!session?.sessionId) return [];

    try {
      const response = await fetch(`${API_BASE} /api/messages / ${session.sessionId}?number = ${chatId}& search=${encodeURIComponent(query)} `);
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
      console.log(`😍 Agregando reacción ${reaction} al mensaje ${messageId} `);

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

      const response = await fetch(`${API_BASE} /api/messages / ${messageId}/reactions`, {
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

  const markChatAsRead = useCallback(async (chatId: string) => {
    // 1. Optimistic UI update
    setChats(prevChats =>
      prevChats.map(chat =>
        chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
      )
    );

    // 2. Call Backend API to update DB
    if (session?.sessionId) {
      try {
        await fetch(`${getAPIBaseURL()}/api/messages/mark-read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: session.sessionId,
            chatJid: chatId
          })
        });
        console.log(`✅ Chat ${chatId} marcado como leído en BD`);
      } catch (error) {
        console.error('❌ Error marcando chat como leído en BD:', error);
      }
    }

    // 3. Update document title
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
  }, [chats, session?.sessionId]);

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
    hasMoreChats,
    isLoadingMoreChats,
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
    markAllChatsAsRead,
    transferRequest,
    setTransferRequest,
    setMessages,
    setChats,
    typingStatus: Object.fromEntries(typingStatus)
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
    hasMoreChats,
    isLoadingMoreChats,
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
    markAllChatsAsRead,
    typingStatus
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
