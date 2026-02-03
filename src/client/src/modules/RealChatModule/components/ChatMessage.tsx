/**
 * ChatMessage - Componente memoizado para mensajes individuales
 * Previene re-renders cuando otros mensajes cambian
 */
import React, { memo, useCallback } from 'react';
import {
  Avatar,
  Typography,
  IconButton,
  Box
} from '@mui/material';
import {
  Done as DoneIcon,
  DoneAll as DoneAllIcon,
  AccessTime,
  Error as ErrorIcon,
  MoreVert as MoreIcon
} from '@mui/icons-material';
import ModernMessageMedia from '../../../components/ModernMessageMedia';

interface ChatMessageProps {
  msg: any;
  isDarkMode: boolean;
  colors: any;
  onMessageMenu: (element: HTMLElement, message: any) => void;
  onContextMenu: (e: React.MouseEvent, messageId: string) => void;
  getContactName: (msg: any) => string;
  getContactAvatar: (msg: any) => string | null;
}

const ChatMessage: React.FC<ChatMessageProps> = memo(({
  msg,
  isDarkMode,
  colors,
  onMessageMenu,
  onContextMenu,
  getContactName,
  getContactAvatar
}) => {
  const handleMenuClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    onMessageMenu(e.currentTarget, msg);
  }, [onMessageMenu, msg]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    onContextMenu(e, msg.id);
  }, [onContextMenu, msg.id]);

  // Render status icon
  const renderStatusIcon = () => {
    const status = msg.status || 'pending';
    const iconProps = { 
      sx: { 
        fontSize: 14, 
        ml: 0.5,
        color: status === 'read' ? '#53bdeb' : 'inherit'
      } 
    };

    switch (status) {
      case 'pending':
      case 'sending':
        return <AccessTime {...iconProps} sx={{ ...iconProps.sx, color: isDarkMode ? '#8696a0' : '#999' }} />;
      case 'sent':
        return <DoneIcon {...iconProps} />;
      case 'delivered':
        return <DoneAllIcon {...iconProps} />;
      case 'read':
        return <DoneAllIcon {...iconProps} sx={{ ...iconProps.sx, color: '#53bdeb' }} />;
      case 'failed':
        return <ErrorIcon {...iconProps} sx={{ ...iconProps.sx, color: '#f44336' }} />;
      default:
        return null;
    }
  };

  // Format timestamp
  const formatTime = (timestamp: string | number | Date) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  if (msg.type === 'system') {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        mb: 1,
        width: '100%'
      }}>
        <Box
          sx={{
            bgcolor: isDarkMode ? 'rgba(32, 44, 51, 0.8)' : 'rgba(225, 245, 254, 0.9)',
            color: isDarkMode ? '#8696a0' : '#455a64',
            padding: '5px 12px',
            borderRadius: '8px',
            fontSize: '0.75rem',
            textAlign: 'center',
            border: `1px solid ${isDarkMode ? 'rgba(134, 150, 160, 0.15)' : 'rgba(11, 20, 26, 0.05)'}`,
          }}
        >
          {msg.message || msg.text_content}
        </Box>
      </Box>
    );
  }

  const isFromMe = msg.isFromMe || msg.from_me;

  return (
    <Box sx={{
      display: 'flex',
      justifyContent: isFromMe ? 'flex-end' : 'flex-start',
      mb: 1,
      alignItems: 'flex-end',
      maxWidth: '90%',
      marginLeft: isFromMe ? 'auto' : '10px',
      marginRight: isFromMe ? '10px' : 'auto',
      position: 'relative'
    }}>
      {!isFromMe && (
        <Avatar
          src={getContactAvatar(msg) || undefined}
          sx={{
            width: 32,
            height: 32,
            mr: 1,
            bgcolor: '#00a884',
            flexShrink: 0
          }}
        >
          {getContactName(msg).charAt(0)}
        </Avatar>
      )}

      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '100%'
      }}>
        {!isFromMe && (
          <Typography
            variant="caption"
            sx={{
              color: isDarkMode ? '#aebac1' : '#667781',
              ml: 1,
              mb: 0.25,
              fontWeight: 500,
              alignSelf: 'flex-start',
              fontSize: '0.75rem'
            }}
          >
            {getContactName(msg)}
          </Typography>
        )}

        {isFromMe && msg.agent_name && (
          <Typography
            variant="caption"
            sx={{
              color: colors.primary,
              fontWeight: 600,
              alignSelf: 'flex-end',
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              mb: 0.25
            }}
          >
            {msg.agent_name}
          </Typography>
        )}

        <Box sx={{ position: 'relative' }}>
          <IconButton
            size="small"
            onClick={handleMenuClick}
            sx={{
              position: 'absolute',
              top: -8,
              right: isFromMe ? -8 : 'auto',
              left: isFromMe ? 'auto' : -8,
              opacity: 0,
              transition: 'opacity 0.2s',
              padding: '4px',
              bgcolor: isDarkMode ? '#2a3942' : '#f0f2f5',
              zIndex: 2,
              '&:hover': { opacity: 1 },
              '.message-bubble:hover + &': { opacity: 0.7 }
            }}
          >
            <MoreIcon sx={{ fontSize: 16 }} />
          </IconButton>

          <Box
            className="message-bubble"
            onContextMenu={handleContextMenu}
            sx={{
              padding: (msg.type !== 'document' && msg.type !== 'image' && msg.type !== 'video' && msg.type !== 'audio') ? '8px 14px' : '4px',
              borderRadius: isFromMe ? '12px 0px 12px 12px' : '0px 12px 12px 12px',
              backgroundColor: isFromMe
                ? isDarkMode ? '#0d47a1' : '#e3f2fd'
                : isDarkMode ? '#202c33' : '#ffffff',
              color: isFromMe
                ? isDarkMode ? '#ffffff' : '#0d47a1'
                : isDarkMode ? '#e9edef' : '#111b21',
              position: 'relative',
              cursor: 'pointer',
              border: isFromMe
                ? 'none'
                : `1px solid ${isDarkMode ? 'rgba(134, 150, 160, 0.15)' : 'rgba(11, 20, 26, 0.08)'}`,
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
              maxWidth: '75%',
              wordWrap: 'break-word',
              alignSelf: isFromMe ? 'flex-end' : 'flex-start',
              backgroundImage: isFromMe && isDarkMode ? 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)' : 'none',
              '&:hover': {
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.12)'
              }
            }}
          >
            {/* Reply reference */}
            {msg.contextInfo?.quotedMessageText && (
              <Box sx={{
                bgcolor: isFromMe 
                  ? 'rgba(255,255,255,0.15)' 
                  : isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                p: 0.5,
                mb: 0.5,
                borderRadius: 1,
                borderLeft: `3px solid ${isFromMe ? '#fff' : '#00a884'}`,
                fontSize: '0.8rem',
                opacity: 0.9
              }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                  {msg.contextInfo.quotedMessageSender || 'Mensaje'}
                </Typography>
                <Typography variant="caption" noWrap sx={{ display: 'block' }}>
                  {msg.contextInfo.quotedMessageText}
                </Typography>
              </Box>
            )}

            {/* Media content */}
            {msg.media_url && (
              <ModernMessageMedia 
                message={msg} 
                isFromMe={isFromMe}
                isDarkMode={isDarkMode}
              />
            )}

            {/* Text content */}
            {(msg.message || msg.text_content) && (
              <Typography
                variant="body2"
                sx={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontSize: '0.875rem',
                  lineHeight: 1.4
                }}
              >
                {msg.message || msg.text_content}
              </Typography>
            )}

            {/* Timestamp and status */}
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              mt: 0.5,
              gap: 0.5
            }}>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.7rem',
                  opacity: 0.7,
                  color: isFromMe 
                    ? isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(13, 71, 161, 0.7)'
                    : isDarkMode ? '#8696a0' : '#667781'
                }}
              >
                {formatTime(msg.timestamp)}
              </Typography>
              {isFromMe && renderStatusIcon()}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
});

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage;
