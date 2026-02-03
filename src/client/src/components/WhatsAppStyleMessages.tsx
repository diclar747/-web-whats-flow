import React, { useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Avatar,
  Typography,
  Paper,
  useTheme,
  Tooltip,
  Chip,
  Stack,
} from '@mui/material';
import {
  Check as CheckIcon,
  DoneAll as DoneAllIcon,
  AccessTime as PendingIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { format, isSameDay, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';
import { styled } from '@mui/material/styles';

// ==================== STYLED COMPONENTS ====================

const MessagesContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  padding: '16px',
  overflow: 'auto',
  flex: 1,
  backgroundColor: theme.palette.background.default,
  backgroundImage:
    theme.palette.mode === 'dark'
      ? 'radial-gradient(circle at 20% 50%, rgba(33, 150, 243, 0.1) 0%, transparent 50%)'
      : 'linear-gradient(135deg, rgba(33, 150, 243, 0.05) 0%, rgba(156, 39, 176, 0.05) 100%)',

  '&::-webkit-scrollbar': {
    width: '6px',
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: theme.palette.divider,
    borderRadius: '3px',
    '&:hover': {
      backgroundColor: theme.palette.text.secondary,
    },
  },
}));

const MessageGroup = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  marginBottom: '8px',
});

const MessageBubble = styled(Paper)(({ theme }) => ({
  maxWidth: '70%',
  padding: '12px 14px',
  borderRadius: '18px',
  wordBreak: 'break-word',
  whiteSpace: 'pre-wrap',
  position: 'relative',
  animation: 'slideIn 0.3s ease-in-out',
  '@keyframes slideIn': {
    from: {
      opacity: 0,
      transform: 'translateY(10px)',
    },
    to: {
      opacity: 1,
      transform: 'translateY(0)',
    },
  },
}));

const SentBubble = styled(MessageBubble)(({ theme }) => ({
  alignSelf: 'flex-end',
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  borderBottomRightRadius: '4px',
}));

const ReceivedBubble = styled(MessageBubble)(({ theme }) => ({
  alignSelf: 'flex-start',
  backgroundColor: theme.palette.mode === 'dark' 
    ? theme.palette.grey[800]
    : theme.palette.grey[200],
  color: theme.palette.text.primary,
  borderBottomLeftRadius: '4px',
}));

const MessageTime = styled(Typography)(({ theme }) => ({
  fontSize: '12px',
  color: theme.palette.text.disabled,
  alignSelf: 'flex-end',
  marginTop: '4px',
}));

const DateDivider = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  margin: '16px 0',
  opacity: 0.6,

  '&::before, &::after': {
    content: '""',
    flex: 1,
    height: '1px',
    backgroundColor: theme.palette.divider,
  },
}));

const DateChip = styled(Chip)(({ theme }) => ({
  height: '24px',
  fontSize: '12px',
  backgroundColor: theme.palette.divider,
  color: theme.palette.text.secondary,
}));

const StatusIconBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: '2px',
  alignItems: 'center',
  marginLeft: '4px',

  '& svg': {
    fontSize: '14px',
    color: theme.palette.primary.contrastText,
  },
}));

const MediaContainer = styled(Box)(({ theme }) => ({
  marginTop: '8px',
  borderRadius: '12px',
  overflow: 'hidden',
  maxWidth: '300px',
  backgroundColor: theme.palette.background.paper,
  display: 'flex',
  flexDirection: 'column',
}));

const MediaImage = styled('img')({
  maxWidth: '100%',
  maxHeight: '300px',
  objectFit: 'cover',
  display: 'block',
});

const MediaCaption = styled(Typography)(({ theme }) => ({
  padding: '8px 12px',
  fontSize: '14px',
  color: theme.palette.text.primary,
  backgroundColor: theme.palette.background.paper,
}));

const EmptyMessagesBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  padding: '24px',
  textAlign: 'center',
  color: theme.palette.text.secondary,
}));

// ==================== INTERFACE ====================

interface Message {
  id: string;
  from_me: boolean;
  text_content?: string;
  timestamp: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'error';
  message_type: 'conversation' | 'image' | 'document' | 'video' | 'audio' | 'ptt';
  media_url?: string;
  media_mime_type?: string;
  caption?: string;
  file_name?: string;
  sender_name?: string;
  sender_avatar?: string;
  agent_name?: string;
  agent_id?: number;
}

interface WhatsAppStyleMessagesProps {
  messages: Message[];
  chatName: string;
  chatAvatar?: string;
  loading?: boolean;
  currentUserAvatar?: string;
}

// ==================== COMPONENTE ====================

const WhatsAppStyleMessages: React.FC<WhatsAppStyleMessagesProps> = ({
  messages,
  chatName,
  chatAvatar,
  loading = false,
  currentUserAvatar,
}) => {
  const theme = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll a los mensajes más nuevos
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Agrupar mensajes por fecha
  const messagesByDate = useMemo(() => {
    const groups: { [key: string]: Message[] } = {};

    messages.forEach((msg) => {
      const date = new Date(msg.timestamp);
      const dateKey = format(date, 'yyyy-MM-dd');

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(msg);
    });

    return groups;
  }, [messages]);

  const formatMessageDate = (dateStr: string): string => {
    const date = new Date(dateStr);

    if (isToday(date)) {
      return 'Hoy';
    }
    if (isYesterday(date)) {
      return 'Ayer';
    }

    return format(date, 'dd \'de\' MMMM \'de\' yyyy', { locale: es });
  };

  const getStatusIcon = (status: string) => {
    const iconProps = { sx: { fontSize: '14px' } };

    switch (status) {
      case 'pending':
        return <PendingIcon {...iconProps} />;
      case 'sent':
        return <CheckIcon {...iconProps} />;
      case 'delivered':
        return <DoneAllIcon {...iconProps} />;
      case 'read':
        return <DoneAllIcon {...iconProps} sx={{ ...iconProps.sx, color: '#2196F3' }} />;
      case 'error':
        return <ErrorIcon {...iconProps} sx={{ ...iconProps.sx, color: '#F44336' }} />;
      default:
        return null;
    }
  };

  const renderMessageContent = (msg: Message) => {
    if (msg.message_type === 'conversation' && msg.text_content) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
          <Typography
            sx={{
              fontSize: '15px',
              lineHeight: 1.4,
              flex: 1,
            }}
          >
            {msg.text_content}
          </Typography>
          {msg.from_me && (
            <StatusIconBox>
              {getStatusIcon(msg.status)}
            </StatusIconBox>
          )}
        </Box>
      );
    }

    // Media messages
    if (msg.media_url) {
      const isImage = msg.message_type === 'image' || msg.media_mime_type?.startsWith('image/');
      const isVideo = msg.message_type === 'video' || msg.media_mime_type?.startsWith('video/');
      const isAudio = msg.message_type === 'audio' || msg.media_mime_type?.startsWith('audio/');

      return (
        <Box>
          <MediaContainer>
            {isImage && <MediaImage src={msg.media_url} alt="Imagen" />}
            {isVideo && (
              <video
                controls
                style={{
                  maxWidth: '100%',
                  maxHeight: '300px',
                  objectFit: 'cover',
                }}
              >
                <source src={msg.media_url} type={msg.media_mime_type} />
              </video>
            )}
            {isAudio && (
              <audio
                controls
                style={{
                  width: '100%',
                  padding: '8px',
                }}
              >
                <source src={msg.media_url} type={msg.media_mime_type} />
              </audio>
            )}
            {!isImage && !isVideo && !isAudio && (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2">{msg.file_name || 'Archivo'}</Typography>
              </Box>
            )}
          </MediaContainer>
          {msg.caption && <MediaCaption>{msg.caption}</MediaCaption>}
        </Box>
      );
    }

    return (
      <Typography sx={{ fontSize: '15px' }}>
        {msg.text_content || 'Mensaje sin contenido'}
      </Typography>
    );
  };

  if (loading) {
    return (
      <EmptyMessagesBox>
        <Typography>Cargando mensajes...</Typography>
      </EmptyMessagesBox>
    );
  }

  if (messages.length === 0) {
    return (
      <EmptyMessagesBox>
        <Avatar
          src={chatAvatar}
          alt={chatName}
          sx={{
            width: 80,
            height: 80,
            mb: 2,
            bgcolor: theme.palette.primary.main,
          }}
        >
          {chatName.charAt(0).toUpperCase()}
        </Avatar>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {chatName}
        </Typography>
        <Typography variant="body2">
          Sin mensajes. Comienza la conversación.
        </Typography>
      </EmptyMessagesBox>
    );
  }

  return (
    <MessagesContainer>
      {Object.entries(messagesByDate).map(([dateStr, dateMessages]) => (
        <div key={dateStr}>
          {/* Divisor de fecha */}
          <DateDivider>
            <DateChip label={formatMessageDate(dateStr)} />
          </DateDivider>

          {/* Mensajes del día */}
          {dateMessages.map((msg, idx) => (
            <MessageGroup key={msg.id || idx}>
              {msg.from_me ? (
                <Tooltip title={format(new Date(msg.timestamp), 'HH:mm', { locale: es })}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                    {/* Etiqueta del agente que envió el mensaje */}
                    <Chip
                      label={msg.agent_name || msg.sender_name || 'Admin'}
                      size="small"
                      sx={{
                        height: '20px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: theme.palette.success.main,
                        color: theme.palette.success.contrastText,
                        '& .MuiChip-label': { px: 1 },
                      }}
                    />
                    <SentBubble elevation={0}>
                      {renderMessageContent(msg)}
                    </SentBubble>
                  </Box>
                </Tooltip>
              ) : (
                <Tooltip
                  title={`${msg.sender_name || 'Usuario'} • ${format(new Date(msg.timestamp), 'HH:mm', { locale: es })}`}
                >
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                    <Avatar
                      src={msg.sender_avatar}
                      alt={msg.sender_name}
                      sx={{
                        width: 32,
                        height: 32,
                        bgcolor: theme.palette.primary.main,
                        fontSize: '12px',
                      }}
                    >
                      {(msg.sender_name || 'U').charAt(0).toUpperCase()}
                    </Avatar>
                    <ReceivedBubble elevation={0}>
                      {renderMessageContent(msg)}
                    </ReceivedBubble>
                  </Box>
                </Tooltip>
              )}
            </MessageGroup>
          ))}
        </div>
      ))}

      {/* Punto de referencia para auto-scroll */}
      <div ref={messagesEndRef} />
    </MessagesContainer>
  );
};

export default WhatsAppStyleMessages;
