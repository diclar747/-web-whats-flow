/**
 * Hook optimizado para manejar conexiones Socket.IO de WhatsApp
 * Maneja reconexiones automáticas, eventos de mensajes y estado de conexión
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';
import { useChatStore, Message, Chat, Contact } from '../store/chatStore';
import { getAPIBaseURL } from '../utils/socketConfig';

interface UseWhatsAppSocketOptions {
  sessionId: string;
  userRole?: string;
  userId?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export const useWhatsAppSocket = (options: UseWhatsAppSocketOptions) => {
  const { sessionId, userRole, userId, onConnect, onDisconnect, onError } = options;
  
  const socketRef = useRef<any>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectAttempts = 10;
  const reconnectDelayRef = useRef<number>(1000);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<Error | null>(null);
  
  // Referencias a acciones del store
  const storeActions = useRef({
    addMessage: useChatStore.getState().addMessage,
    addChat: useChatStore.getState().addChat,
    updateChat: useChatStore.getState().updateChat,
    updateMessageStatus: useChatStore.getState().updateMessageStatus,
    setTyping: useChatStore.getState().setTyping,
    setConnectionStatus: useChatStore.getState().setConnectionStatus,
    updateLastMessage: useChatStore.getState().updateLastMessage,
    incrementUnread: useChatStore.getState().incrementUnread,
    addContact: useChatStore.getState().addContact,
  });

  // Función para conectar
  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('[Socket] Ya conectado');
      return;
    }

    const apiUrl = getAPIBaseURL();
    console.log(`[Socket] Conectando a ${apiUrl} con sessionId: ${sessionId}`);

    const socket = io(apiUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: reconnectDelayRef.current,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: maxReconnectAttempts,
      timeout: 20000,
      withCredentials: true,
      query: {
        sessionId,
        userRole: userRole || 'user',
        userId: userId || '',
      },
      auth: {
        sessionId,
        userRole: userRole || 'user',
        userId: userId || '',
      },
    });

    socketRef.current = socket;

    // Eventos de conexión
    socket.on('connect', () => {
      console.log('[Socket] Conectado exitosamente');
      setIsConnected(true);
      setConnectionError(null);
      reconnectAttemptsRef.current = 0;
      reconnectDelayRef.current = 1000;
      storeActions.current.setConnectionStatus('connected');
      
      // Unirse a la sala de sesión
      socket.emit('join-session', { sessionId });
      
      onConnect?.();
    });

    socket.on('disconnect', (reason: string) => {
      console.log(`[Socket] Desconectado: ${reason}`);
      setIsConnected(false);
      storeActions.current.setConnectionStatus('disconnected');
      onDisconnect?.();
    });

    socket.on('connect_error', (error: Error) => {
      console.error('[Socket] Error de conexión:', error);
      setConnectionError(error);
      storeActions.current.setConnectionStatus('disconnected');
      onError?.(error);
    });

    socket.on('reconnect', (attemptNumber: number) => {
      console.log(`[Socket] Reconectado después de ${attemptNumber} intentos`);
      setIsConnected(true);
      setConnectionError(null);
      storeActions.current.setConnectionStatus('connected');
    });

    socket.on('reconnect_attempt', (attemptNumber: number) => {
      console.log(`[Socket] Intento de reconexión ${attemptNumber}/${maxReconnectAttempts}`);
      reconnectAttemptsRef.current = attemptNumber;
    });

    socket.on('reconnect_error', (error: Error) => {
      console.error('[Socket] Error en reconexión:', error);
    });

    // Eventos de mensajes
    socket.on('new-message', (data: any) => {
      console.log('[Socket] Nuevo mensaje recibido:', data);
      
      const message: Message = {
        id: data.messageId || data.key?.id || `${Date.now()}`,
        key: {
          id: data.messageId || data.key?.id,
          remoteJid: data.remoteJid || data.key?.remoteJid,
          fromMe: data.fromMe || data.key?.fromMe || false,
          participant: data.participant || data.key?.participant,
        },
        content: data.text || data.content || '',
        type: data.messageType || 'text',
        timestamp: data.timestamp ? Number(data.timestamp) : Date.now(),
        fromMe: data.fromMe || false,
        status: data.status || 'sent',
        mediaUrl: data.mediaUrl,
        caption: data.caption,
      };

      const chatJid = data.remoteJid || data.key?.remoteJid;
      if (chatJid) {
        storeActions.current.addMessage(chatJid, message);
        storeActions.current.updateLastMessage(
          chatJid,
          message.content,
          message.fromMe,
          new Date(message.timestamp).toISOString()
        );
        
        if (!message.fromMe) {
          storeActions.current.incrementUnread(chatJid);
        }
      }
    });

    // Eventos de estado de mensajes
    socket.on('message-status-update', (data: any) => {
      console.log('[Socket] Actualización de estado:', data);
      const { chatJid, messageId, status } = data;
      if (chatJid && messageId && status) {
        storeActions.current.updateMessageStatus(chatJid, messageId, status);
      }
    });

    // Eventos de typing
    socket.on('typing', (data: any) => {
      console.log('[Socket] Typing:', data);
      const { jid, type } = data;
      if (jid) {
        storeActions.current.setTyping(jid, type || 'typing');
        
        // Auto-clear typing después de 10 segundos
        setTimeout(() => {
          storeActions.current.setTyping(jid, null);
        }, 10000);
      }
    });

    // Eventos de contactos
    socket.on('contact-created', (data: any) => {
      console.log('[Socket] Nuevo contacto:', data);
      const contact: Contact = {
        id: data.id,
        jid: data.jid,
        name: data.name || data.notifyName || data.jid.split('@')[0],
        notifyName: data.notifyName,
        phone: data.phone || data.jid.split('@')[0],
        avatar: data.avatarUrl,
        isGroup: data.jid.includes('@g.us'),
      };
      storeActions.current.addContact(contact);
    });

    // Eventos de actualización de chat (CRÍTICO para lista de chats en tiempo real)
    socket.on('chat-update', (data: any) => {
      console.log('[Socket] Actualización de chat:', data);
      const chatJid = data.jid || data.chatJid;
      if (chatJid) {
        // Actualizar o crear el chat
        const existingChat = useChatStore.getState().getChat(chatJid);
        if (existingChat) {
          // Actualizar chat existente
          storeActions.current.updateChat(chatJid, {
            lastMessage: data.lastMessage,
            lastMessageTime: data.lastMessageTime,
            lastMessageIsFromMe: data.lastMessageIsFromMe,
            unreadCount: (existingChat.unreadCount || 0) + (data.unreadCount || 0),
            name: data.name || existingChat.name,
          });
        } else {
          // Crear nuevo chat
          const newChat: Chat = {
            id: chatJid,
            jid: chatJid,
            name: data.name || chatJid.split('@')[0],
            isGroup: data.isGroup || chatJid.includes('@g.us'),
            lastMessage: data.lastMessage,
            lastMessageTime: data.lastMessageTime,
            lastMessageIsFromMe: data.lastMessageIsFromMe,
            unreadCount: data.unreadCount || 0,
            status: 'offline',
          };
          storeActions.current.addChat(newChat);
        }
      }
    });

    // Eventos de grupos
    socket.on('group-created', (data: any) => {
      console.log('[Socket] Nuevo grupo:', data);
      const chat: Chat = {
        id: data.groupId,
        jid: data.groupId,
        name: data.name || 'Grupo',
        isGroup: true,
        unreadCount: 0,
        status: 'offline',
      };
      storeActions.current.addChat(chat);
    });

    socket.on('group-participants-update', (data: any) => {
      console.log('[Socket] Actualización de participantes:', data);
      // Actualizar info del grupo si es necesario
    });

    // Eventos de conexión de WhatsApp
    socket.on('whatsapp-connected', (data: any) => {
      console.log('[Socket] WhatsApp conectado:', data);
    });

    socket.on('whatsapp-disconnected', (data: any) => {
      console.log('[Socket] WhatsApp desconectado:', data);
      storeActions.current.setConnectionStatus('disconnected');
    });

    // Eventos de QR
    socket.on('qr-code', (data: any) => {
      console.log('[Socket] QR recibido');
    });

  }, [sessionId, userRole, userId, onConnect, onDisconnect, onError]);

  // Función para desconectar
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('[Socket] Desconectando manualmente');
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // Función para unirse a un chat específico
  const joinChat = useCallback((chatJid: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join-chat', { sessionId, chatJid });
      console.log(`[Socket] Unido al chat: ${chatJid}`);
    }
  }, [sessionId]);

  // Función para salir de un chat
  const leaveChat = useCallback((chatJid: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave-chat', { sessionId, chatJid });
      console.log(`[Socket] Salido del chat: ${chatJid}`);
    }
  }, [sessionId]);

  // Función para enviar mensaje de typing
  const sendTyping = useCallback((chatJid: string, type: 'typing' | 'recording' = 'typing') => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing', { sessionId, chatJid, type });
    }
  }, [sessionId]);

  // Función para enviar mensaje
  const sendMessage = useCallback((chatJid: string, content: string, options?: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('send-message', {
        sessionId,
        chatJid,
        content,
        ...options,
      });
    }
  }, [sessionId]);

  // Efecto de conexión inicial
  useEffect(() => {
    if (sessionId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [sessionId, connect, disconnect]);

  return {
    socket: socketRef.current,
    isConnected,
    connectionError,
    connect,
    disconnect,
    joinChat,
    leaveChat,
    sendTyping,
    sendMessage,
  };
};

export default useWhatsAppSocket;
