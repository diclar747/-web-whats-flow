/**
 * Store Centralizado para Chat de WhatsApp
 * Gestiona estado global de chats, mensajes y conexiones
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Tipos
export interface Chat {
  id: string;
  jid: string;
  name: string;
  phone?: string;
  avatar?: string;
  isGroup: boolean;
  lastMessage?: string;
  lastMessageTime?: string;
  lastMessageIsFromMe?: boolean;
  unreadCount: number;
  status: 'online' | 'offline' | 'typing' | 'recording' | 'away';
  isPinned?: boolean;
  isArchived?: boolean;
  labels?: string[];
  assignedAgent?: string;
}

export interface Message {
  id: string;
  key: {
    id: string;
    remoteJid: string;
    fromMe: boolean;
    participant?: string;
  };
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'sticker' | 'ptt';
  timestamp: number;
  fromMe: boolean;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  reactions?: { emoji: string; count: number; userReacted?: boolean }[];
  replyTo?: Message;
  isForwarded?: boolean;
  mediaUrl?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  caption?: string;
  latitude?: number;
  longitude?: number;
  duration?: number;
}

export interface Contact {
  id: string;
  jid: string;
  name: string;
  notifyName?: string;
  phone: string;
  avatar?: string;
  status?: string;
  isGroup: boolean;
  isBlocked?: boolean;
}

interface ChatState {
  // Estado
  chats: Map<string, Chat>;
  messages: Map<string, Message[]>;
  activeChat: string | null;
  contacts: Map<string, Contact>;
  isLoading: boolean;
  isLoadingMessages: boolean;
  hasMoreMessages: Map<string, boolean>;
  messageOffsets: Map<string, number>;
  typingUsers: Map<string, { timestamp: number; type: 'typing' | 'recording' }>;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  sessionId: string | null;
  
  // Acciones - Chats
  setChats: (chats: Chat[]) => void;
  addChat: (chat: Chat) => void;
  updateChat: (jid: string, updates: Partial<Chat>) => void;
  removeChat: (jid: string) => void;
  setActiveChat: (jid: string | null) => void;
  updateLastMessage: (jid: string, message: string, fromMe: boolean, timestamp: string) => void;
  incrementUnread: (jid: string) => void;
  clearUnread: (jid: string) => void;
  pinChat: (jid: string, pinned: boolean) => void;
  archiveChat: (jid: string, archived: boolean) => void;
  
  // Acciones - Mensajes
  setMessages: (chatJid: string, messages: Message[]) => void;
  addMessage: (chatJid: string, message: Message) => void;
  addMessages: (chatJid: string, messages: Message[], prepend?: boolean) => void;
  updateMessage: (chatJid: string, messageId: string, updates: Partial<Message>) => void;
  updateMessageStatus: (chatJid: string, messageId: string, status: Message['status']) => void;
  deleteMessage: (chatJid: string, messageId: string) => void;
  setHasMoreMessages: (chatJid: string, hasMore: boolean) => void;
  setMessageOffset: (chatJid: string, offset: number) => void;
  
  // Acciones - Contactos
  setContacts: (contacts: Contact[]) => void;
  addContact: (contact: Contact) => void;
  updateContact: (jid: string, updates: Partial<Contact>) => void;
  
  // Acciones - Typing
  setTyping: (jid: string, type: 'typing' | 'recording' | null) => void;
  
  // Acciones - Estado
  setConnectionStatus: (status: 'connected' | 'disconnected' | 'connecting') => void;
  setSessionId: (sessionId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setLoadingMessages: (loading: boolean) => void;
  
  // Getters
  getChat: (jid: string) => Chat | undefined;
  getMessages: (jid: string) => Message[];
  getContact: (jid: string) => Contact | undefined;
  getUnreadCount: (jid: string) => number;
  getTotalUnreadCount: () => number;
  getSortedChats: () => Chat[];
  
  // Cleanup
  clearAll: () => void;
}

// Crear el store con Zustand + Immer + Persist
export const useChatStore = create<ChatState>()(
  immer(
    persist(
      (set, get) => ({
        // Estado inicial
        chats: new Map(),
        messages: new Map(),
        activeChat: null,
        contacts: new Map(),
        isLoading: false,
        isLoadingMessages: false,
        hasMoreMessages: new Map(),
        messageOffsets: new Map(),
        typingUsers: new Map(),
        connectionStatus: 'disconnected',
        sessionId: null,

        // Acciones - Chats
        setChats: (chats) => {
          set((state) => {
            state.chats = new Map(chats.map(c => [c.jid, c]));
          });
        },

        addChat: (chat) => {
          set((state) => {
            state.chats.set(chat.jid, chat);
          });
        },

        updateChat: (jid, updates) => {
          set((state) => {
            const chat = state.chats.get(jid);
            if (chat) {
              Object.assign(chat, updates);
            }
          });
        },

        removeChat: (jid) => {
          set((state) => {
            state.chats.delete(jid);
            state.messages.delete(jid);
          });
        },

        setActiveChat: (jid) => {
          set((state) => {
            state.activeChat = jid;
            if (jid) {
              state.typingUsers.delete(jid);
            }
          });
        },

        updateLastMessage: (jid, message, fromMe, timestamp) => {
          set((state) => {
            const chat = state.chats.get(jid);
            if (chat) {
              chat.lastMessage = message;
              chat.lastMessageIsFromMe = fromMe;
              chat.lastMessageTime = timestamp;
            }
          });
        },

        incrementUnread: (jid) => {
          set((state) => {
            const chat = state.chats.get(jid);
            if (chat && state.activeChat !== jid) {
              chat.unreadCount = (chat.unreadCount || 0) + 1;
            }
          });
        },

        clearUnread: (jid) => {
          set((state) => {
            const chat = state.chats.get(jid);
            if (chat) {
              chat.unreadCount = 0;
            }
          });
        },

        pinChat: (jid, pinned) => {
          set((state) => {
            const chat = state.chats.get(jid);
            if (chat) {
              chat.isPinned = pinned;
            }
          });
        },

        archiveChat: (jid, archived) => {
          set((state) => {
            const chat = state.chats.get(jid);
            if (chat) {
              chat.isArchived = archived;
            }
          });
        },

        // Acciones - Mensajes
        setMessages: (chatJid, messages) => {
          set((state) => {
            state.messages.set(chatJid, messages.sort((a, b) => a.timestamp - b.timestamp));
          });
        },

        addMessage: (chatJid, message) => {
          set((state) => {
            const existing = state.messages.get(chatJid) || [];
            
            // Verificar por ID
            const existsById = existing.some(m => m.id === message.id || m.key?.id === message.key?.id);
            if (existsById) return;
            
            // 🔧 FIX: Si el mensaje es fromMe, verificar si existe uno temporal reciente con mismo contenido
            // para evitar duplicados cuando llega la confirmación del servidor
            if (message.fromMe) {
              const recentTemp = existing.find(m => 
                m.fromMe === true && 
                m.content === message.content &&
                (m.id?.startsWith('temp-') || m.status === 'pending') &&
                Math.abs(m.timestamp - message.timestamp) < 30000 // 30 segundos de diferencia
              );
              
              if (recentTemp) {
                // Actualizar el mensaje temporal con el real en lugar de agregar duplicado
                recentTemp.id = message.id;
                if (recentTemp.key) recentTemp.key.id = message.key?.id || message.id;
                recentTemp.status = message.status || 'sent';
                state.messages.set(chatJid, [...existing]);
                return;
              }
            }
            
            existing.push(message);
            existing.sort((a, b) => a.timestamp - b.timestamp);
            state.messages.set(chatJid, existing);
          });
        },

        addMessages: (chatJid, newMessages, prepend = false) => {
          set((state) => {
            const existing = state.messages.get(chatJid) || [];
            if (prepend) {
              const uniqueNew = newMessages.filter(
                m => !existing.some(e => e.id === m.id || e.key?.id === m.key?.id)
              );
              state.messages.set(chatJid, [...uniqueNew, ...existing]);
            } else {
              const uniqueNew = newMessages.filter(
                m => !existing.some(e => e.id === m.id || e.key?.id === m.key?.id)
              );
              existing.push(...uniqueNew);
              existing.sort((a, b) => a.timestamp - b.timestamp);
              state.messages.set(chatJid, existing);
            }
          });
        },

        updateMessage: (chatJid, messageId, updates) => {
          set((state) => {
            const messages = state.messages.get(chatJid);
            if (messages) {
              const msg = messages.find(m => m.id === messageId || m.key?.id === messageId);
              if (msg) {
                Object.assign(msg, updates);
              }
            }
          });
        },

        updateMessageStatus: (chatJid, messageId, status) => {
          set((state) => {
            const messages = state.messages.get(chatJid);
            if (messages) {
              const msg = messages.find(m => m.id === messageId || m.key?.id === messageId);
              if (msg) {
                msg.status = status;
              }
            }
          });
        },

        deleteMessage: (chatJid, messageId) => {
          set((state) => {
            const messages = state.messages.get(chatJid);
            if (messages) {
              state.messages.set(
                chatJid,
                messages.filter(m => m.id !== messageId && m.key?.id !== messageId)
              );
            }
          });
        },

        setHasMoreMessages: (chatJid, hasMore) => {
          set((state) => {
            state.hasMoreMessages.set(chatJid, hasMore);
          });
        },

        setMessageOffset: (chatJid, offset) => {
          set((state) => {
            state.messageOffsets.set(chatJid, offset);
          });
        },

        // Acciones - Contactos
        setContacts: (contacts) => {
          set((state) => {
            state.contacts = new Map(contacts.map(c => [c.jid, c]));
          });
        },

        addContact: (contact) => {
          set((state) => {
            state.contacts.set(contact.jid, contact);
          });
        },

        updateContact: (jid, updates) => {
          set((state) => {
            const contact = state.contacts.get(jid);
            if (contact) {
              Object.assign(contact, updates);
            }
          });
        },

        // Acciones - Typing
        setTyping: (jid, type) => {
          set((state) => {
            if (type) {
              state.typingUsers.set(jid, { timestamp: Date.now(), type });
            } else {
              state.typingUsers.delete(jid);
            }
          });
        },

        // Acciones - Estado
        setConnectionStatus: (status) => {
          set((state) => {
            state.connectionStatus = status;
          });
        },

        setSessionId: (sessionId) => {
          set((state) => {
            state.sessionId = sessionId;
          });
        },

        setLoading: (loading) => {
          set((state) => {
            state.isLoading = loading;
          });
        },

        setLoadingMessages: (loading) => {
          set((state) => {
            state.isLoadingMessages = loading;
          });
        },

        // Getters
        getChat: (jid) => {
          return get().chats.get(jid);
        },

        getMessages: (jid) => {
          return get().messages.get(jid) || [];
        },

        getContact: (jid) => {
          return get().contacts.get(jid);
        },

        getUnreadCount: (jid) => {
          return get().chats.get(jid)?.unreadCount || 0;
        },

        getTotalUnreadCount: () => {
          let total = 0;
          get().chats.forEach(chat => {
            total += chat.unreadCount || 0;
          });
          return total;
        },

        getSortedChats: () => {
          const chats = Array.from(get().chats.values());
          return chats.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
            const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
            return timeB - timeA;
          });
        },

        // Cleanup
        clearAll: () => {
          set((state) => {
            state.chats.clear();
            state.messages.clear();
            state.activeChat = null;
            state.contacts.clear();
            state.typingUsers.clear();
            state.hasMoreMessages.clear();
            state.messageOffsets.clear();
          });
        },
      }),
      {
        name: 'whatsapp-chat-storage',
        storage: createJSONStorage(() => sessionStorage),
        partialize: (state) => ({
          sessionId: state.sessionId,
          chats: Array.from(state.chats.entries()),
          contacts: Array.from(state.contacts.entries()),
        }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            state.chats = new Map(state.chats);
            state.contacts = new Map(state.contacts);
          }
        },
      }
    )
  )
);

// Hooks helper
export const useActiveChat = () => useChatStore(state => state.activeChat);
export const useChatMessages = (jid: string) => useChatStore(state => state.messages.get(jid) || []);
export const useChatById = (jid: string) => useChatStore(state => state.chats.get(jid));
export const useTotalUnread = () => useChatStore(state => state.getTotalUnreadCount());
