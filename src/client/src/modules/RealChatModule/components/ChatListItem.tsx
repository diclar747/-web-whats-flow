/**
 * ChatListItem - Componente memoizado para items de la lista de chats
 * Previene re-renders cuando la lista de chats cambia
 */
import React, { memo, useCallback } from 'react';
import {
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  Typography,
  Badge,
  Box
} from '@mui/material';

interface ChatListItemProps {
  chat: any;
  isActive: boolean;
  isDarkMode: boolean;
  onClick: (chat: any) => void;
  onContextMenu?: (e: React.MouseEvent, chat: any) => void;
}

const ChatListItem: React.FC<ChatListItemProps> = memo(({
  chat,
  isActive,
  isDarkMode,
  onClick,
  onContextMenu
}) => {
  const handleClick = useCallback(() => {
    onClick(chat);
  }, [onClick, chat]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (onContextMenu) {
      onContextMenu(e, chat);
    }
  }, [onContextMenu, chat]);

  const formatTime = (timestamp: string | number | Date) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
    } else if (isYesterday) {
      return 'Ayer';
    } else {
      return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    }
  };

  const truncateMessage = (message: string, maxLength: number = 40) => {
    if (!message) return '';
    return message.length > maxLength ? message.substring(0, maxLength) + '...' : message;
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  const unreadCount = chat.unreadCount || 0;
  const lastMessage = chat.lastMessage || '';
  const lastMessageTime = chat.lastMessageTime || chat.timestamp;
  const isOnline = chat.isOnline || false;

  return (
    <ListItem
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      sx={{
        cursor: 'pointer',
        bgcolor: isActive 
          ? isDarkMode ? '#2a3942' : '#f0f2f5'
          : 'transparent',
        '&:hover': {
          bgcolor: isActive 
            ? isDarkMode ? '#2a3942' : '#f0f2f5'
            : isDarkMode ? '#202c33' : '#f5f6f6'
        },
        borderLeft: isActive ? '3px solid #00a884' : '3px solid transparent',
        transition: 'background-color 0.15s ease',
        py: 1,
        px: 1.5
      }}
    >
      <ListItemAvatar>
        <Badge
          overlap="circular"
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          variant="dot"
          sx={{
            '& .MuiBadge-badge': {
              bgcolor: isOnline ? '#00a884' : '#999',
              width: 10,
              height: 10,
              border: `2px solid ${isDarkMode ? '#111b21' : '#fff'}`,
              borderRadius: '50%'
            }
          }}
        >
          <Avatar
            src={chat.avatar || undefined}
            sx={{
              width: 48,
              height: 48,
              bgcolor: '#00a884'
            }}
          >
            {getInitials(chat.name || chat.pushName || chat.id)}
          </Avatar>
        </Badge>
      </ListItemAvatar>

      <ListItemText
        primary={
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            mb: 0.5
          }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: unreadCount > 0 ? 600 : 500,
                color: isDarkMode ? '#e9edef' : '#111b21',
                fontSize: '0.95rem',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
                mr: 1
              }}
            >
              {chat.name || chat.pushName || chat.id}
            </Typography>
            {lastMessageTime && (
              <Typography
                variant="caption"
                sx={{
                  color: unreadCount > 0 ? '#00a884' : (isDarkMode ? '#8696a0' : '#667781'),
                  fontWeight: unreadCount > 0 ? 600 : 400,
                  fontSize: '0.75rem',
                  whiteSpace: 'nowrap'
                }}
              >
                {formatTime(lastMessageTime)}
              </Typography>
            )}
          </Box>
        }
        secondary={
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography
              variant="body2"
              sx={{
                color: isDarkMode ? '#8696a0' : '#667781',
                fontSize: '0.85rem',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
                mr: 1,
                fontWeight: unreadCount > 0 ? 500 : 400
              }}
            >
              {chat.lastMessageIsFromMe && 'Tú: '}
              {truncateMessage(lastMessage)}
            </Typography>
            {unreadCount > 0 && (
              <Box
                sx={{
                  bgcolor: '#00a884',
                  color: '#fff',
                  borderRadius: '50%',
                  minWidth: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  px: 0.5
                }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Box>
            )}
          </Box>
        }
      />
    </ListItem>
  );
});

ChatListItem.displayName = 'ChatListItem';

export default ChatListItem;
