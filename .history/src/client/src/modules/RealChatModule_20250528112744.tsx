import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import {
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Badge,
  Divider,
  IconButton,
  CircularProgress
} from '@mui/material';
import {
  Send as SendIcon,
  MoreVert as MoreIcon,
  Search as SearchIcon,
  AttachFile as AttachIcon,
  Mic as MicIcon,
  InsertEmoticon as EmojiIcon
} from '@mui/icons-material';

interface Contact {
  id: string;
  name: string;
  phone: string;
  avatar: string;
  status?: string;
  lastSeen?: Date;
  unreadCount?: number;
}

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: Date;
  status?: 'sent' | 'delivered' | 'read';
  isMedia?: boolean;
  mediaUrl?: string;
}

interface Chat {
  contactId: string;
  messages: Message[];
}

interface RealChatModuleProps {
  sessionId: string;
  contacts?: Contact[];
  initialChats?: Chat[];
}

const RealChatModule: React.FC<RealChatModuleProps> = ({
  sessionId,
  contacts = [],
  initialChats = []
}) => {
  const { isDarkMode } = useTheme();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]); // Eliminar esta línea
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [chats, setChats] = useState<Chat[]>(initialChats);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const activeMessages = useMemo(() => {
    if (!activeContact) return [];
    const chat = chats.find(c => c.contactId === activeContact.id);
    return chat ? chat.messages : [];
  }, [activeContact, chats]);

  useEffect(() => {
    const newSocket = io('http://localhost:3002', {
      query: { sessionId }
    });
    setSocket(newSocket);

    // Cargar mensajes iniciales desde la base de datos
    const loadInitialMessages = async (contactId: string) => {
      try {
        // Mostrar estado de carga
        setChats(prev => prev.map(c =>
          c.contactId === contactId
            ? { ...c, loading: true }
            : c
        ));

        const response = await fetch(`http://localhost:3001/api/messages?contactId=${contactId}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const { data: messages } = await response.json();
        
        setChats(prev => {
          const existingChat = prev.find(c => c.contactId === contactId);
          return existingChat
            ? prev.map(c => c.contactId === contactId
                ? { ...c, messages, loading: false }
                : c)
            : [...prev, {
                contactId,
                messages,
                loading: false
              }];
        });

      } catch (error) {
        console.error('Error cargando mensajes:', error);
        setChats(prev => prev.map(c =>
          c.contactId === contactId
            ? { ...c, loading: false, error: 'Error al cargar mensajes' }
            : c
        ));
      }
    };

    // Escuchar nuevos mensajes
    newSocket.on('message', (message: Message) => {
      setChats(prev => {
        const contactId = message.sender === 'user'
          ? activeContact?.id
          : message.sender;
        
        if (!contactId) return prev;

        const existingChat = prev.find(c => c.contactId === contactId);
        return existingChat
          ? prev.map(c => c.contactId === contactId
              ? { ...c, messages: [...c.messages, message] }
              : c)
          : [...prev, {
              contactId,
              messages: [message]
            }];
      });

      // Si es el contacto activo, hacer scroll al final
      if (activeContact?.id === message.sender ||
          (message.sender === 'user' && activeContact)) {
        setTimeout(() => {
          const messagesContainer = document.querySelector('[data-messages-container]');
          if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
        }, 50);
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [sessionId, activeContact]);

  // Cargar mensajes cuando cambia el contacto activo
  useEffect(() => {
    if (activeContact) {
      const existingChat = chats.find(c => c.contactId === activeContact.id);
      if (!existingChat || existingChat.messages.length === 0) {
        // Disparar carga de mensajes iniciales
        socket?.emit('loadMessages', { contactId: activeContact.id });
      }
    }
  }, [activeContact]);

  const handleSendMessage = () => {
    if (newMessage.trim() && socket) {
      const message: Message = {
        id: Date.now().toString(),
        text: newMessage,
        sender: 'user',
        timestamp: new Date()
      };
      socket.emit('message', message);
      setNewMessage('');
    }
  };

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      backgroundColor: isDarkMode ? '#0c1317' : '#f0f2f5'
    }}>
      {/* Sidebar de contactos */}
      <div style={{
        width: '30%',
        borderRight: `1px solid ${isDarkMode ? '#303d45' : '#e9edef'}`,
        backgroundColor: isDarkMode ? '#111b21' : '#fff'
      }}>
        <div style={{
          padding: '10px 16px',
          backgroundColor: isDarkMode ? '#202c33' : '#f0f2f5',
          display: 'flex',
          alignItems: 'center'
        }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Buscar o empezar nuevo chat"
            InputProps={{
              startAdornment: <SearchIcon style={{ marginRight: 8 }} />,
              style: {
                backgroundColor: isDarkMode ? '#111b21' : '#fff',
                borderRadius: '8px'
              }
            }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <List style={{ overflowY: 'auto', height: 'calc(100vh - 60px)' }}>
          {contacts.map(contact => (
            <ListItem
              key={contact.id}
              button
              selected={activeContact?.id === contact.id}
              onClick={() => setActiveContact(contact)}
              style={{
                backgroundColor: activeContact?.id === contact.id
                  ? isDarkMode ? '#2a3942' : '#f5f6f6'
                  : 'transparent'
              }}
            >
              <ListItemAvatar>
                <Badge
                  overlap="circular"
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  variant="dot"
                  color="success"
                >
                  <Avatar src={contact.avatar} />
                </Badge>
              </ListItemAvatar>
              <ListItemText
                primary={contact.name}
                secondary={contact.status || 'En línea'}
                secondaryTypographyProps={{
                  color: isDarkMode ? '#aebac1' : '#667781'
                }}
              />
              <ListItemText
                secondary={contact.lastSeen?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                style={{ textAlign: 'right' }}
                secondaryTypographyProps={{
                  color: isDarkMode ? '#aebac1' : '#667781'
                }}
              />
            </ListItem>
          ))}
        </List>
      </div>

      {/* Área de chat principal */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: isDarkMode ? '#0b141a' : '#e5ddd5'
      }}>
        {activeContact ? (
          <>
            {/* Cabecera del chat */}
            <div style={{
              padding: '10px 16px',
              backgroundColor: isDarkMode ? '#202c33' : '#f0f2f5',
              display: 'flex',
              alignItems: 'center',
              borderBottom: `1px solid ${isDarkMode ? '#303d45' : '#e9edef'}`
            }}>
              <Avatar src={activeContact.avatar} />
              <div style={{ marginLeft: '15px', flex: 1 }}>
                <div style={{ fontWeight: 'bold' }}>{activeContact.name}</div>
                <div style={{
                  fontSize: '0.8rem',
                  color: isDarkMode ? '#aebac1' : '#667781'
                }}>
                  {activeContact.status || 'En línea'}
                </div>
              </div>
              <IconButton>
                <MoreIcon />
              </IconButton>
            </div>

            {/* Mensajes */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
              backgroundImage: isDarkMode
                ? 'linear-gradient(rgba(11, 20, 26, 0.9), rgba(11, 20, 26, 0.9))'
                : 'linear-gradient(rgba(229, 221, 213, 0.9), rgba(229, 221, 213, 0.9))'
            }}>
              {activeMessages.map((msg) => (
                <div key={msg.id} style={{
                  display: 'flex',
                  justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: '10px'
                }}>
                  <div style={{
                    maxWidth: '70%',
                    padding: '8px 12px',
                    borderRadius: msg.sender === 'user'
                      ? '7.5px 0 7.5px 7.5px'
                      : '0 7.5px 7.5px 7.5px',
                    backgroundColor: msg.sender === 'user'
                      ? isDarkMode ? '#005c4b' : '#d9fdd3'
                      : isDarkMode ? '#202c33' : '#fff',
                    color: isDarkMode ? '#e9edef' : '#111b21',
                    position: 'relative'
                  }}>
                    {msg.text}
                    <div style={{
                      fontSize: '0.7rem',
                      textAlign: 'right',
                      color: isDarkMode ? '#aebac1' : '#667781',
                      marginTop: '4px'
                    }}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {msg.sender === 'user' && (
                        <span style={{ marginLeft: '4px' }}>
                          {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Barra de envío de mensajes */}
            <div style={{
              padding: '8px 16px',
              backgroundColor: isDarkMode ? '#202c33' : '#f0f2f5',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <IconButton>
                <EmojiIcon />
              </IconButton>
              <IconButton>
                <AttachIcon />
              </IconButton>
              <TextField
                fullWidth
                variant="outlined"
                size="small"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Escribe un mensaje"
                style={{
                  backgroundColor: isDarkMode ? '#2a3942' : '#fff',
                  borderRadius: '8px'
                }}
              />
              <IconButton onClick={handleSendMessage}>
                {newMessage.trim() ? <SendIcon /> : <MicIcon />}
              </IconButton>
            </div>
          </>
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isDarkMode ? '#aebac1' : '#667781'
          }}>
            <div style={{ textAlign: 'center' }}>
              <h3>Selecciona un chat para empezar</h3>
              <p>Los mensajes están cifrados de extremo a extremo</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RealChatModule;