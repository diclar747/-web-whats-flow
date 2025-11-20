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
  IconButton
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
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [chats, setChats] = useState<Chat[]>(initialChats);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const newSocket = io('http://localhost:3001', {
      query: { sessionId }
    });
    setSocket(newSocket);

    newSocket.on('message', (message: Message) => {
      setMessages(prev => [...prev, message]);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [sessionId]);

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
      padding: '1rem',
      backgroundColor: isDarkMode ? '#1e1e1e' : '#f5f5f5',
      color: isDarkMode ? '#fff' : '#333',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <h2 style={{ borderBottom: `1px solid ${isDarkMode ? '#444' : '#ddd'}`}}>
        Chat en Tiempo Real
      </h2>

      <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
        <List>
          {messages.map(msg => (
            <ListItem key={msg.id}>
              <ListItemText 
                primary={msg.text}
                secondary={`${msg.sender} - ${msg.timestamp.toLocaleTimeString()}`}
                style={{
                  color: isDarkMode ? '#fff' : '#333',
                  backgroundColor: msg.sender === 'user' 
                    ? isDarkMode ? '#2a5c8a' : '#e3f2fd'
                    : isDarkMode ? '#333' : '#eee',
                  padding: '0.5rem',
                  borderRadius: '4px'
                }}
              />
            </ListItem>
          ))}
        </List>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <TextField
          fullWidth
          variant="outlined"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Escribe un mensaje..."
          style={{
            backgroundColor: isDarkMode ? '#333' : '#fff',
          }}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={handleSendMessage}
          endIcon={<SendIcon />}
        >
          Enviar
        </Button>
      </div>
    </div>
  );
};

export default RealChatModule;