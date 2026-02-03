import { useState, useCallback, useRef } from 'react';

interface Message {
    id: string;
    message: string;
    timestamp: number;
    isFromMe: boolean;
    status?: 'pending' | 'sent' | 'delivered' | 'read' | 'error';
}

/**
 * Hook personalizado para gestionar mensajes sin duplicados
 * Usa un Set para trackear IDs únicos
 */
export const useUniqueMessages = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const messageIdsRef = useRef<Set<string>>(new Set());

    /**
     * Agregar un mensaje solo si no existe
     */
    const addMessage = useCallback((newMessage: Message) => {
        if (messageIdsRef.current.has(newMessage.id)) {
            console.log(`[DUPLICATE] Mensaje ${newMessage.id} ya existe, ignorando`);
            return false;
        }

        messageIdsRef.current.add(newMessage.id);
        setMessages(prev => [...prev, newMessage]);
        console.log(`[ADD] Mensaje ${newMessage.id} agregado`);
        return true;
    }, []);

    /**
     * Agregar múltiples mensajes sin duplicados
     */
    const addMessages = useCallback((newMessages: Message[]) => {
        const uniqueMessages = newMessages.filter(msg => {
            if (messageIdsRef.current.has(msg.id)) {
                console.log(`[DUPLICATE] Mensaje ${msg.id} ya existe, ignorando`);
                return false;
            }
            messageIdsRef.current.add(msg.id);
            return true;
        });

        if (uniqueMessages.length > 0) {
            setMessages(prev => [...prev, ...uniqueMessages]);
            console.log(`[ADD] ${uniqueMessages.length} mensajes únicos agregados`);
        }
    }, []);

    /**
     * Actualizar estado de un mensaje existente
     */
    const updateMessageStatus = useCallback((messageId: string, status: Message['status']) => {
        setMessages(prev =>
            prev.map(msg =>
                msg.id === messageId ? { ...msg, status } : msg
            )
        );
    }, []);

    /**
     * Limpiar todos los mensajes
     */
    const clearMessages = useCallback(() => {
        setMessages([]);
        messageIdsRef.current.clear();
        console.log('[CLEAR] Todos los mensajes eliminados');
    }, []);

    /**
     * Reemplazar todos los mensajes (útil al cambiar de chat)
     */
    const setUniqueMessages = useCallback((newMessages: Message[]) => {
        messageIdsRef.current.clear();
        const uniqueMessages = newMessages.filter(msg => {
            if (messageIdsRef.current.has(msg.id)) {
                return false;
            }
            messageIdsRef.current.add(msg.id);
            return true;
        });
        setMessages(uniqueMessages);
        console.log(`[SET] ${uniqueMessages.length} mensajes únicos establecidos`);
    }, []);

    return {
        messages,
        addMessage,
        addMessages,
        updateMessageStatus,
        clearMessages,
        setUniqueMessages
    };
};

/**
 * Generar ID único para mensajes
 */
export const generateMessageId = (): string => {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Normalizar mensaje desde diferentes fuentes
 */
export const normalizeMessage = (msg: any): Message => {
    return {
        id: msg.id || msg.messageId || generateMessageId(),
        message: msg.message || msg.body || msg.text || '',
        timestamp: msg.timestamp || msg.time || Date.now(),
        isFromMe: msg.isFromMe || msg.fromMe || false,
        status: msg.status || 'sent'
    };
};
