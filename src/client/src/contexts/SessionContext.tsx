import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { whatsappAPI, initializeSocket, socketEvents } from '../services/api';

// Interfaces básicas - solo lo necesario
interface Message {
  id: string;
  from: string;
  to?: string;
  message: string;
  timestamp: string;
  type: string;
  mediaUrl?: string;
}

interface Chat {
  id: string;
  name: string;
  isGroup: boolean;
  participants?: Array<{
    id: string;
    admin: boolean;
  }>;
}

interface SessionContextType {
  // Estado básico
  isConnected: boolean;
  sessionId: string | null;
  loading: boolean;
  error: string | null;

  // Datos reales
  messages: Message[];
  chats: Chat[];

  // Funciones reales
  sendMessage: (chatId: string, message: string) => Promise<void>;
  sendImage: (chatId: string, imageUrl: string, caption?: string) => Promise<void>;
  loadChats: () => Promise<void>;
  loadMessages: (chatId?: string) => Promise<void>;
  
  // Control de sesión
  setSession: (sessionId: string) => void;
  disconnect: () => void;
  clearError: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  // Estado básico
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Datos reales
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);

  // Inicializar socket cuando hay sessionId
  useEffect(() => {
    if (sessionId) {
      const socket = initializeSocket();
      
      // Configurar eventos de socket
      socketEvents.joinSession(sessionId);
      
      // Escuchar nuevos mensajes
      socketEvents.onNewMessage(sessionId, (message: Message) => {
        setMessages(prev => [...prev, message]);
      });

      // Escuchar actualizaciones de chats
      socketEvents.onChatsUpdate(sessionId, () => {
        loadChats();
      });

      // Escuchar cambios de conexión
      socketEvents.onConnectionUpdate(sessionId, (status: string) => {
        setIsConnected(status === 'connected');
      });

      return () => {
        socketEvents.leaveSession(sessionId);
        socketEvents.removeAllListeners();
      };
    }
    return undefined;
  }, [sessionId]);

  // Cargar chats
  const loadChats = async (): Promise<void> => {
    if (!sessionId) return;
    
    setLoading(true);
    try {
      const response = await whatsappAPI.getChats(sessionId);
      if (response.success && response.data) {
        setChats(response.data.chats);
      } else {
        setError(response.error || 'Error al cargar chats');
      }
    } catch (err) {
      setError('Error de conexión al cargar chats');
      console.error('Error cargando chats:', err);
    } finally {
      setLoading(false);
    }
  };

  // Cargar mensajes
  const loadMessages = async (chatId?: string): Promise<void> => {
    if (!sessionId) return;
    
    setLoading(true);
    try {
      const response = await whatsappAPI.getMessages(sessionId, chatId);
      if (response.success && response.data) {
        setMessages(response.data.messages);
      } else {
        setError(response.error || 'Error al cargar mensajes');
      }
    } catch (err) {
      setError('Error de conexión al cargar mensajes');
      console.error('Error cargando mensajes:', err);
    } finally {
      setLoading(false);
    }
  };

  // Enviar mensaje
  const sendMessage = async (chatId: string, message: string): Promise<void> => {
    if (!sessionId) throw new Error('No hay sesión activa');

    const response = await whatsappAPI.sendMessage(sessionId, chatId, message);
    if (!response.success) {
      throw new Error(response.error || 'Error al enviar mensaje');
    }
  };

  // Enviar imagen
  const sendImage = async (chatId: string, imageUrl: string, caption?: string): Promise<void> => {
    if (!sessionId) throw new Error('No hay sesión activa');

    const response = await whatsappAPI.sendImage(sessionId, chatId, imageUrl, caption);
    if (!response.success) {
      throw new Error(response.error || 'Error al enviar imagen');
    }
  };

  // Establecer sesión
  const setSession = (newSessionId: string) => {
    setSessionId(newSessionId);
    setIsConnected(true);
    setError(null);
  };

  // Desconectar
  const disconnect = () => {
    if (sessionId) {
      socketEvents.leaveSession(sessionId);
      socketEvents.removeAllListeners();
    }
    setSessionId(null);
    setIsConnected(false);
    setMessages([]);
    setChats([]);
    setError(null);
  };

  // Limpiar error
  const clearError = () => {
    setError(null);
  };

  const value: SessionContextType = {
    // Estado básico
    isConnected,
    sessionId,
    loading,
    error,

    // Datos reales
    messages,
    chats,

    // Funciones reales
    sendMessage,
    sendImage,
    loadChats,
    loadMessages,
    
    // Control de sesión
    setSession,
    disconnect,
    clearError,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = (): SessionContextType => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession debe ser usado dentro de un SessionProvider');
  }
  return context;
};

export default SessionContext; 