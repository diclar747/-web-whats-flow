import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';
import { getSocketURL, getAPIBaseURL } from '../utils/socketConfig';
import { sessionFetch } from '../utils/sessionFetch';
import { useSocket } from './SocketContext';

declare global {
  interface Window {
    chatRefreshInterval?: NodeJS.Timeout;
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

const showBrowserNotification = (options: NotificationOptions) => {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon || '/whatsapp-icon.png',
      tag: options.tag || 'whatsapp-message',
      silent: true // Sonido desactivado a petición del usuario
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    setTimeout(() => notification.close(), 5000);
    return notification;
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') showBrowserNotification(options);
    });
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

export interface SyncProgress {
  status: 'syncing' | 'completed' | 'idle' | 'error';
  progress: number;
  message: string;
  contacts?: number;
  groups?: number;
  messages?: number;
  sessionId?: string; // 🔥 Added sessionId
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
  phone_channel?: string; // 🔥 NUEVO: Canal de origen del chat
  channel_phone?: string; // 🔥 NUEVO: Número del canal de origen
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
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'system' | 'imageMessage' | 'videoMessage' | 'audioMessage' | 'ptt' | 'documentMessage' | 'stickerMessage';
  isFromMe: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  chatJid?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  fileName?: string; // 🔥 Nombre del archivo para documentos
  sentBy?: string; // Nombre del agente que envió el mensaje
  agent_id?: number; // 🔥 ID del agente que envió el mensaje
  agent_name?: string; // 🔥 Nombre del agente que envió el mensaje
  channelPhone?: string; // 🔥 Canal de origen del mensaje
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
  loadMessages: (chatId: string, dateFilter?: string, limit?: number, offset?: number, append?: boolean) => Promise<void>;
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
  syncProgress: SyncProgress;
  syncProgresses: Record<string, SyncProgress>; // 🔥 Map of sync progress by sessionId
  getSyncProgress: (sessionId: string) => SyncProgress | undefined; // 🔥 Helper
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
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    status: 'idle',
    progress: 0,
    message: ''
  });
  const [syncProgresses, setSyncProgresses] = useState<Record<string, SyncProgress>>({});

  const getSyncProgress = useCallback((targetSessionId: string) => {
    return syncProgresses[targetSessionId];
  }, [syncProgresses]);

  const { socket, isConnected: isSocketConnected } = useSocket();

  const API_BASE = getAPIBaseURL();

  // Actualizar refs cuando cambian los estados
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    activeChatRef.current = activeChat;

    // 🔥 AUTOMATIC MESSAGE LOADING
    if (activeChat?.id) {
      // Avoid reloading if it's the same chat (optional check, but good for perf)
      // But since we want to ensure messages are loaded, just call it.
      // loadMessages handles state reset.
      console.log(`[WhatsAppContext] 🔄 Chat activo cambiado a ${activeChat.id}, cargando mensajes...`);
      loadMessages(activeChat.id, 'all', 50);
    }
  }, [activeChat?.id]);

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

  const loadChats = useCallback(async (sessionId: string, dateFilter: string = 'week', offset: number = 0, append: boolean = false): Promise<void> => {
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

    // 🔓 MULTI-CHANNEL: Permitir cargar chats para cualquier número conectado
    // Anteriormente se bloqueaba si no era primario, pero ahora el usuario puede cambiar de pestañas.
    console.log(`[WhatsAppContext] 🔄 Iniciando carga de chats para sesión ${sessionId}...`);

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
      const limit = 500; // Sin límite práctico - cargar TODOS los chats del día
      const offsetParam = offset || 0; // Si no se pasa, es 0

      if (append) {
        setIsLoadingMoreChats(true);
      } else {
        setIsLoading(true);
        // Si es carga nueva (no append), resetear hasMoreChats temporalmente
        setHasMoreChats(true);

        // 🔥 CRÍTICO: Si el sessionId cambió, limpiar datos anteriores inmediatamente
        // para evitar "flicker" o datos mezclados entre canales
        if (session?.sessionId !== sessionId) {
          console.log(`[WhatsAppContext] 🔀 Detectado cambio de sesión: ${session?.sessionId || 'ninguna'} -> ${sessionId}`);
          setChats([]);
          setMessages([]);
          // También refrescar el objeto session para que los sockets filtren correctamente
          setSession(prev => ({
            sessionId: sessionId,
            isConnected: true, // Asumimos conectado si estamos intentando cargar chats
            status: 'connected',
            phoneNumber: sessionId.length >= 10 ? sessionId : (prev?.phoneNumber || ''), // Intentar inferir phone si es largo
            lastActivity: new Date().toISOString()
          }));
        }
      }

      const endpoint = isAgent && userId
        ? `${API_BASE}/api/agents/${userId}/chats?sessionId=${sessionId}&dateFilter=${dateFilter}&limit=${limit}&offset=${offsetParam}`
        : `${API_BASE}/api/chats/${sessionId}?dateFilter=${dateFilter}&limit=${limit}&offset=${offsetParam}`;

      console.log(`🔄 Cargando chats desde API (${isAgent ? 'AGENTE' : 'ADMIN'}) con filtro: ${dateFilter}`, endpoint);

      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await sessionFetch(endpoint, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
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

          if (chat.id.includes('@lid')) {
            console.log('[WhatsAppContext] 🚫 Filtrando chat LID:', chat.id);
            return false;
          }
          if (chat.id.includes('status@broadcast')) {
            console.log('[WhatsAppContext] 🚫 Filtrando status broadcast');
            return false;
          }

          // 🛡️ FILTRO MEJORADO: Solo filtrar el chat propio si coincide EXACTAMENTE
          const chatNumber = chat.id.split('@')[0].split(':')[0]; // Extraer solo el número

          // Solo filtrar si el chat ES EXACTAMENTE el número de la sesión actual
          if (currentPhone && chatNumber === currentPhone) {
            console.log('[WhatsAppContext] 🚫 Filtrando chat propio (número exacto):', chat.id, 'vs', currentPhone);
            return false;
          }

          console.log('[WhatsAppContext] ✅ Chat permitido:', chat.id, '(sessionId:', currentPhone, ')');
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
          // 🔥 CRÍTICO: LIMPIAR COMPLETAMENTE los chats viejos antes de cargar nuevos
          console.log('[WhatsAppContext] 🧹 LIMPIANDO chats antiguos del estado...');
          setChats([]); // Limpiar primero

          // Usar setTimeout para asegurar que React procese la limpieza
          setTimeout(() => {
            setChats(filteredChats);
            console.log('[WhatsAppContext] ✅ Chats reemplazados (inicio):', filteredChats.length);
          }, 0);
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

        // Actualizar sesión con el phoneNumber real que viene de la API si es posible
        if (data.sessionId || sessionId) {
          const actualSessionId = data.sessionId || sessionId;
          setSession(prev => ({
            ...prev,
            sessionId: actualSessionId,
            isConnected: true,
            status: 'connected',
            phoneNumber: data.phoneNumber || prev?.phoneNumber || (actualSessionId.length >= 10 ? actualSessionId : ''),
            lastActivity: new Date().toISOString()
          }));
        }
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
          const response = await fetch(`${API_BASE}/api/sessions/check/${savedSessionId}`);
          const data = await response.json();

          if (data.success && data.valid) { // valid=true significa que la sesión existe
            console.log('🎉 Sesión verificada, inicializando y cargando chats...', data);
            const newSession: WhatsAppSession = {
              sessionId: savedSessionId,
              isConnected: data.isConnected,
              status: data.isConnected ? 'connected' : 'disconnected',
              lastActivity: new Date().toISOString(),
              phoneNumber: data.profile?.phoneNumber
            };
            setSession(newSession);
            setConnectionStatus(data.isConnected ? 'connected' : 'disconnected');

            // await requestNotificationPermission(); // 🚫 Desactivado para usar Modal UI moderno

            console.log('📱 Cargando chats automáticamente...');
            await loadChats(savedSessionId);
          } else {
            console.log('Sesión no válida o no encontrada. Manteniendo en localStorage para posibles reintentos...');
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

      // ⚡ ACTUALIZACIÓN: Ahora no filtramos por canal individual porque el backend ya lo hace
      // El backend devuelve solo los mensajes que pertenecen al usuario actual
      // pero mantenemos el channelPhone para mostrarlo al usuario

      // ⚡ OPTIMIZACIÓN: Normalizar chatJid de forma más eficiente
      const rawChatJid = newMessage.chatJid || (newMessage as any).chat_jid || newMessage.to || newMessage.from;
      const normalizedChatJid = rawChatJid?.includes('@') ? rawChatJid : `${rawChatJid}@s.whatsapp.net`;
      const chatPhone = normalizedChatJid?.split('@')[0];

      // Normalize message type to simple format (audio, image, video, etc.)
      let normalizedType: any = newMessage.type || (newMessage as any).message_type || 'text';
      if (typeof normalizedType === 'string') {
        normalizedType = normalizedType.replace('Message', '').toLowerCase();
        if (normalizedType === 'ptt') normalizedType = 'audio';
        if (normalizedType === 'conversation' || normalizedType === 'extendedtext') normalizedType = 'text';
      }

      // ⚡ OPTIMIZACIÓN: Mapear mensaje con operaciones mínimas
      const mappedMessage: WhatsAppMessage = {
        ...newMessage,
        message: newMessage.message || newMessage.text || '',
        text: newMessage.message || newMessage.text || '',
        type: normalizedType as any,
        chatJid: normalizedChatJid,
        isFromMe: Boolean((newMessage as any).from_me || newMessage.isFromMe),
        agent_id: (newMessage as any).agent_id,
        agent_name: (newMessage as any).agent_name
      };

      // ⚡ OPTIMIZACIÓN: Notificaciones Inmediatas (Con info del canal)
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
        const channelInfo = (mappedMessage as any).channelPhone ? `[Línea: ${(mappedMessage as any).channelPhone}] ` : '';

        if (document.hidden || !isCurrentChatActive) {
          showBrowserNotification({
            title: `💬 ${channelInfo}${senderName}`,
            body: messagePreview.length > 50 ? messagePreview.substring(0, 50) + '...' : messagePreview,
            icon: chat?.avatar || '/favicon.ico',
            tag: `chat-${mappedMessage.chatJid}`,
            requireInteraction: false,
            silent: true
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
        console.log(`[DEBUG] activeChatId: ${activeChatId}, msgChatJid: ${mappedMessage.chatJid}, chatPhone: ${chatPhone}`);
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
        console.log('ℹ️ [REAL-TIME] Mensaje NO es del chat activo:', { activeChatId, msgChat: mappedMessage.chatJid, chatPhone });
        console.log(`[DEBUG] Comparison failed: Is ${activeChatId} === ${mappedMessage.chatJid}? OR ${activeChatId?.split('@')[0]} === ${chatPhone}?`);
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

          // Solo filtrar si el chat ES EXACTAMENTE el número de la sesión actual
          const currentPhone = String(session?.sessionId || '').split(':')[0]?.split('@')[0];
          if (currentPhone && chatPhone === currentPhone) {
            console.log('[REAL-TIME] 🚫 Ignorando chat propio en creación:', mappedMessage.chatJid);
            return prev;
          }

          console.log('[REAL-TIME] ✅ Creando nuevo chat:', mappedMessage.chatJid);

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

      // 🛡️ SECURITY: Filter events for the current session only
      // @ts-ignore
      const msgChannel = (id as any).channelPhone || (status as any).channelPhone; // Backend might send it in different places or not at all for status updates?
      // Actually status update payload is usually small.
      // If we don't have channel info here, we might skip filtering or rely on room separation.
      // Backend emit: emit('message-status-update', { id, status, chatJid: msg.remote_jid })
      // It does NOT seem to include channelPhone in status update yet.
      // However, since we implemented room isolation, this might be less critical.
      // But let's add it if we can, or rely on room isolation.
      // For now, room isolation is the main defense here.


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
        // ❌ NO sobrescribir whinsap_session - debe mantener el user.id del usuario logueado
        // sessionStorage.setItem('whinsap_session', newSid);
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

      const newSessionId = data.sessionId || data.phoneNumber;
      const currentActiveSession = sessionStorage.getItem('whinsap_session') || localStorage.getItem('whinsap_session');

      // 🔥 FIX: Solo actualizar si no hay sesión activa o si el evento es de la sesión actual
      // NO queremos que conectar la línea B nos saque de la línea A automáticamente
      if (!currentActiveSession || currentActiveSession === newSessionId) {
        if (newSessionId) {
          sessionStorage.setItem('whinsap_session', newSessionId);
          localStorage.setItem('whinsap_session', newSessionId);
          console.log('🔄 [WhatsAppContext] whinsap_session actualizado/mantenido:', newSessionId);
        }

        if (data.phoneNumber) {
          sessionStorage.setItem('whatsappPhone', data.phoneNumber);
          localStorage.setItem('whatsappPhone', data.phoneNumber);
        }

        if (newSessionId) {
          setSession({
            sessionId: newSessionId,
            isConnected: true,
            status: 'connected',
            lastActivity: new Date().toISOString(),
            phoneNumber: data.phoneNumber
          });
          setConnectionStatus('connected');
          loadChats(newSessionId);
        }
      } else {
        console.log(`ℹ️ [WhatsAppContext] Ignorando cambio de sesión automática para ${newSessionId}. Sesión actual ${currentActiveSession} se mantiene.`);
      }
    };

    const handleWhatsAppSessionUpdated = (data: any) => {
      console.log('🔄 [WhatsAppContext] Evento whatsapp-session-updated recibido:', data);

      const existingToken = sessionStorage.getItem('token') || localStorage.getItem('token');
      const currentActiveSession = sessionStorage.getItem('whinsap_session') || localStorage.getItem('whinsap_session');

      if (existingToken) {
        console.log('✅ [WhatsAppContext] Usuario ya autenticado');

        // 🔥 FIX: Solo actualizar si coincide con la sesión enfocada actualmente
        if (data.sessionId && (!currentActiveSession || currentActiveSession === data.sessionId)) {
          sessionStorage.setItem('whinsap_session', data.sessionId);
          localStorage.setItem('whinsap_session', data.sessionId);

          if (data.phoneNumber) {
            sessionStorage.setItem('whatsappPhone', data.phoneNumber);
            localStorage.setItem('whatsappPhone', data.phoneNumber);
          }

          setSession({
            sessionId: data.sessionId,
            isConnected: true,
            status: 'connected',
            lastActivity: new Date().toISOString(),
            phoneNumber: data.phoneNumber
          });
          setConnectionStatus('connected');
          loadChats(data.sessionId);
        } else {
          console.log(`ℹ️ [WhatsAppContext] Session updated para ${data.sessionId}, pero el foco está en ${currentActiveSession}. Manteniendo foco.`);
        }
      } else {
        // ... (resto de lógica para nuevos usuarios sin token)
        if (data.token) {
          sessionStorage.setItem('token', data.token);
          localStorage.setItem('token', data.token);
        }
        if (data.user) {
          sessionStorage.setItem('user', JSON.stringify(data.user));
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        if (data.sessionId) {
          setSession({
            sessionId: data.sessionId,
            isConnected: true,
            status: 'connected',
            lastActivity: new Date().toISOString(),
            phoneNumber: data.phoneNumber
          });
          setConnectionStatus('connected');
          loadChats(data.sessionId);
        }
      }
    };

    const handleTransferRequest = (data: any) => {
      console.log('🔔 [SOCKET] Solicitud de transferencia recibida:', data);
      setTransferRequest(data);
    };

    const handleTransferUpdate = (data: any) => {
      console.log('🔔 [SOCKET] Actualización de transferencia:', data);
      // Aquí podrías mostrar un toast o notificación
    };

    const handleChatUpdate = (data: any) => {
      console.log('🔄 [SOCKET] Actualización de chat recibida:', data);

      // 🛡️ SECURITY: Filter events for the current session only
      const msgChannel = data.channelPhone;
      if (msgChannel && session?.phoneNumber && msgChannel !== session.phoneNumber) {
        console.log(`[SOCKET] 🛡️ Ignorando CHAT-UPDATE de otro canal (${msgChannel}) en sesión actual (${session.phoneNumber})`);
        return;
      }

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
    socket.on('whatsapp-session-updated', handleWhatsAppSessionUpdated);
    if (userId) {
      socket.on(`agent-${userId}-transfer-request`, handleTransferRequest);
    }
    socket.on('transfer-request-update', handleTransferUpdate);

    // 🔄 SYNC PROGRESS LISTENERS
    socket.on('sync-start', (data: any) => {
      console.log('🔄 [WhatsAppContext] Sync started:', data);
      const targetSessionId = data.sessionId || session?.sessionId;

      const newProgress: SyncProgress = {
        status: 'syncing',
        progress: 0,
        message: 'Iniciando sincronización...',
        contacts: 0,
        groups: 0,
        messages: 0,
        sessionId: targetSessionId
      };

      if (targetSessionId) {
        setSyncProgresses(prev => ({
          ...prev,
          [targetSessionId]: newProgress
        }));
      }

      // Update global if it matches current session
      if (targetSessionId === session?.sessionId) {
        setSyncProgress(newProgress);
      }
    });

    socket.on('sync-progress', (data: any) => {
      // console.log('🔄 [WhatsAppContext] Sync progress:', data);
      const targetSessionId = data.sessionId || session?.sessionId;

      if (targetSessionId) {
        setSyncProgresses(prev => {
          const prevProgress = prev[targetSessionId] || { status: 'idle', progress: 0, message: '' };
          return {
            ...prev,
            [targetSessionId]: {
              ...prevProgress,
              status: 'syncing',
              progress: data.progress || data.percentage || prevProgress.progress,
              message: data.message || prevProgress.message,
              contacts: data.contacts || prevProgress.contacts,
              groups: data.groups || prevProgress.groups,
              messages: data.messages || prevProgress.messages,
              sessionId: targetSessionId
            }
          };
        });
      }

      if (targetSessionId === session?.sessionId) {
        setSyncProgress(prev => ({
          ...prev,
          status: 'syncing',
          progress: data.progress || data.percentage || prev.progress,
          message: data.message || prev.message,
          contacts: data.contacts || prev.contacts,
          groups: data.groups || prev.groups,
          messages: data.messages || prev.messages
        }));
      }
    });

    const handleSyncCompletion = (data: any) => {
      console.log('✅ [WhatsAppContext] Sync completed:', data);
      const targetSessionId = data.sessionId || session?.sessionId;

      const completedProgress: SyncProgress = {
        status: 'completed',
        progress: 100,
        message: '¡Sincronización completada!',
        contacts: data.contacts || data.stats?.contacts,
        groups: data.groups || data.stats?.groups,
        messages: (data.messages || data.stats?.messages) || (data.chats || data.stats?.chats),
        sessionId: targetSessionId
      };

      if (targetSessionId) {
        setSyncProgresses(prev => ({
          ...prev,
          [targetSessionId]: completedProgress
        }));

        // Clear after 5 seconds
        setTimeout(() => {
          setSyncProgresses(prev => ({
            ...prev,
            [targetSessionId]: { ...prev[targetSessionId], status: 'idle' }
          }));
        }, 5000);
      }

      if (targetSessionId === session?.sessionId) {
        setSyncProgress(completedProgress);
        // Clear after 5 seconds
        setTimeout(() => {
          setSyncProgress(prev => ({ ...prev, status: 'idle' }));
        }, 5000);
      }
    };

    socket.on('sync-complete', handleSyncCompletion);
    socket.on('sync-completed', handleSyncCompletion);

    socket.on('sync-error', (data: any) => {
      console.error('❌ [WhatsAppContext] Sync error:', data);
      setSyncProgress(prev => ({
        ...prev,
        status: 'error',
        message: data.error || 'Error en la sincronización'
      }));
    });



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
      socket.off('whatsapp-session-updated', handleWhatsAppSessionUpdated);
      if (userId) {
        socket.off(`agent-${userId}-transfer-request`, handleTransferRequest);
      }
      socket.off('transfer-request-update', handleTransferUpdate);
      socket.off('sync-start');
      socket.off('sync-progress');
      socket.off('sync-complete');
      socket.off('sync-completed');
      socket.off('sync-error');
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
  const loadMessages = async (chatId: string, dateFilter: string = 'week', limit: number = 50, offset: number = 0, append: boolean = false): Promise<void> => {
    if (!session?.sessionId) return;

    try {
      // ⚠️ IMPORTANTE: NO cargar desde cache inicialmente
      // Siempre consultar la BD PRIMERO con el filtro de fecha
      // Ahora por defecto carga mensajes de los últimos 7 días
      if (!append) {
        setMessages([]);
        setIsLoading(true);
      }

      console.log(`🔄[API] Cargando mensajes para ${chatId} (dateFilter=${dateFilter}, limit=${limit}, offset=${offset}, append=${append})`);

      // ✅ Usar el endpoint correcto: /api/messages/:sessionId/:chatJid
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const sessionId = session?.sessionId || '1';

      // Construir URL correctamente con chatJid en la ruta
      const endpoint = `${API_BASE}/api/messages/${sessionId}/${chatId}?dateFilter=${dateFilter}&limit=${limit}&offset=${offset}`;

      console.log(`📡 Endpoint: ${endpoint}`);

      const response = await fetch(endpoint, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await response.json();

      if (data.success && data.messages && data.messages.length > 0) {
        console.log(`✅ Mensajes cargados: ${data.messages.length} para chat ${chatId} (fecha: ${dateFilter})`);

        // 🐛 DEBUG: Log first message to see exact API structure
        if (data.messages.length > 0) {
          console.log('[loadMessages] 🔍 Primer mensaje de API (raw):', data.messages[0]);
        }

        const mappedMessages: WhatsAppMessage[] = data.messages.map((msg: any) => {
          // Normalize message type to simple format (audio, image, video, etc.)
          let normalizedType: any = msg.message_type || msg.type || 'text';
          if (typeof normalizedType === 'string') {
            normalizedType = normalizedType.replace('Message', '').toLowerCase();
            if (normalizedType === 'ptt') normalizedType = 'audio';
            if (normalizedType === 'conversation' || normalizedType === 'extendedtext') normalizedType = 'text';
          }

          const mapped = {
            id: msg.id,
            from: msg.sender_jid || msg.from,
            to: msg.chat_jid || msg.to,
            message: msg.text_content || msg.message || msg.text || '',
            text: msg.text_content || msg.message || msg.text || '',
            timestamp: msg.timestamp,
            type: normalizedType as any,
            isFromMe: Boolean(msg.from_me),
            status: msg.status || 'delivered',
            chatJid: msg.chat_jid || chatId,
            mediaUrl: msg.media_url || msg.mediaUrl,
            mediaMimeType: msg.media_mime_type || msg.mediaMimeType,
            sentBy: msg.sender_name || msg.agent_name || msg.sentBy,
            agent_id: msg.agent_id,
            agent_name: msg.agent_name,
            contextInfo: msg.contextInfo
          };

          // 🐛 DEBUG: Log mapping for media messages
          if (msg.message_type && msg.message_type !== 'conversation') {
            console.log('[loadMessages] 🎯 Media message mapping:', {
              id: msg.id,
              type: msg.message_type,
              media_url_from_api: msg.media_url,
              mediaUrl_from_api: msg.mediaUrl,
              mapped_mediaUrl: mapped.mediaUrl,
              hasMediaUrl: !!mapped.mediaUrl
            });
          }

          return mapped;
        });

        if (append) {
          // AGREGAR AL INICIO (mensajes más viejos arriba)
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newUniqueMessages = mappedMessages.filter(m => !existingIds.has(m.id));
            return [...newUniqueMessages.reverse(), ...prev];
          });
        } else {
          // Reemplazar todo (ahora incluye mensajes de la semana completa)
          const sortedMessages = mappedMessages.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
          setMessages(sortedMessages);
          // ⚠️ NO guardar en cache - siempre consultar BD fresca
        }

        setIsLoading(false);
      } else {
        console.log(`ℹ️ No hay mensajes para chat ${chatId} (fecha: ${dateFilter})`);
        if (!append) {
          setMessages([]);
          setIsLoading(false);
        }
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
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`${API_BASE} /api/messages / ${session.sessionId}?number = ${chatId}& search=${encodeURIComponent(query)} `, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
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

      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_BASE} /api/messages / ${messageId}/reactions`, {
        method: 'POST',
        headers,
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
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_BASE}/api/messages/${messageId}/reactions`, {
        method: 'DELETE',
        headers,
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
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/messages/${messageId}/reactions?sessionId=${session.sessionId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
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
    typingStatus: Object.fromEntries(typingStatus),
    syncProgress,
    syncProgresses,
    getSyncProgress
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
    typingStatus,
    syncProgress,
    syncProgresses
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
