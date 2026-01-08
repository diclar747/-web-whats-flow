import React, { useState, useMemo } from 'react';
import {
  Box,
  Avatar,
  Typography,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Badge,
  Chip,
  Divider,
  InputAdornment,
  CircularProgress,
  LinearProgress,
  Paper,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  DoneAll as DoneAllIcon,
  Check as CheckIcon,
  AccessTime as PendingIcon,
  Circle as OnlineIcon,
} from '@mui/icons-material';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { styled } from '@mui/material/styles';

// ==================== STYLED COMPONENTS ====================

const ChatListContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: theme.palette.background.paper,
  borderRight: `1px solid ${theme.palette.divider}`,
  overflow: 'hidden',
}));

const SearchBoxContainer = styled(Box)(({ theme }) => ({
  padding: '16px',
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.default,
}));

const ChatSearchField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: '24px',
    backgroundColor: theme.palette.background.paper,
    transition: 'all 0.3s ease',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    '&.Mui-focused': {
      boxShadow: `0 0 0 3px ${theme.palette.primary.main}20`,
    },
  },
}));

const ChatListBox = styled(List)(({ theme }) => ({
  flex: 1,
  overflow: 'auto',
  padding: 0,
  '&::-webkit-scrollbar': {
    width: '6px',
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: theme.palette.background.paper,
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: theme.palette.divider,
    borderRadius: '3px',
    '&:hover': {
      backgroundColor: theme.palette.text.secondary,
    },
  },
}));

const ChatItemButton = styled(ListItemButton)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  '&.Mui-selected': {
    backgroundColor: theme.palette.action.selected,
    borderLeft: `4px solid ${theme.palette.primary.main}`,
    '&:hover': {
      backgroundColor: theme.palette.action.selected,
    },
  },
}));

const ChatBadge = styled(Badge)(({ theme }) => ({
  '& .MuiBadge-badge': {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    fontWeight: 700,
    minWidth: '20px',
    height: '20px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

const StatusIndicator = styled(Box)(({ theme }: any) => ({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
}));

const MessagePreview = styled(Typography)(({ theme }) => ({
  fontSize: '13px',
  color: theme.palette.text.secondary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '200px',
}));

const TimeStampTypography = styled(Typography)(({ theme }) => ({
  fontSize: '12px',
  color: theme.palette.text.disabled,
  marginTop: '2px',
}));

const EmptyChatBox = styled(Box)(({ theme }) => ({
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

interface Chat {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  phoneNumber?: string;
  status?: 'active' | 'closed' | 'transferred' | 'pending';
  isOnline?: boolean;
  assignedAt?: string;
  syncProgress?: number;
  isSyncing?: boolean;
}

interface ModernAgentChatListProps {
  chats: Chat[];
  selectedChat: Chat | null;
  onSelectChat: (chat: Chat) => void;
  loading?: boolean;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

// ==================== COMPONENTE ====================

const ModernAgentChatList: React.FC<ModernAgentChatListProps> = ({
  chats,
  selectedChat,
  onSelectChat,
  loading = false,
  searchTerm,
  onSearchChange,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);

  // Obtener color según status
  const getStatusColor = (status?: string) => {
    const statusColors: any = {
      active: theme.palette.success.main,
      pending: theme.palette.warning.main,
      closed: theme.palette.error.main,
      transferred: theme.palette.info.main,
    };
    return statusColors[status || 'pending'] || theme.palette.warning.main;
  };

  // Filtrar chats por búsqueda
  const filteredChats = useMemo(() => {
    return chats.filter((chat) => {
      const searchLower = localSearchTerm.toLowerCase();
      return (
        chat.name.toLowerCase().includes(searchLower) ||
        chat.phoneNumber?.includes(searchLower) ||
        chat.lastMessage.toLowerCase().includes(searchLower)
      );
    });
  }, [chats, localSearchTerm]);

  // Contar no leídos
  const totalUnread = useMemo(() => {
    return chats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);
  }, [chats]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearchTerm(value);
    onSearchChange(value);
  };

  const clearSearch = () => {
    setLocalSearchTerm('');
    onSearchChange('');
  };

  return (
    <ChatListContainer>
      {/* BUSCADOR */}
      <SearchBoxContainer>
        <ChatSearchField
          fullWidth
          placeholder="Buscar chat..."
          size="small"
          value={localSearchTerm}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: theme.palette.text.disabled }} />
              </InputAdornment>
            ),
            endAdornment: localSearchTerm && (
              <InputAdornment position="end">
                <CloseIcon
                  sx={{
                    cursor: 'pointer',
                    fontSize: '20px',
                    color: theme.palette.text.disabled,
                    '&:hover': { color: theme.palette.text.primary },
                  }}
                  onClick={clearSearch}
                />
              </InputAdornment>
            ),
          }}
        />

        {/* Mostrar contador de no leídos */}
        {totalUnread > 0 && (
          <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
              {chats.length} chat{chats.length !== 1 ? 's' : ''}
            </Typography>
            {totalUnread > 0 && (
              <Chip
                label={`${totalUnread} no leído${totalUnread !== 1 ? 's' : ''}`}
                size="small"
                color="primary"
                variant="filled"
                sx={{ fontWeight: 600 }}
              />
            )}
          </Box>
        )}
      </SearchBoxContainer>

      {/* LISTA DE CHATS */}
      {loading ? (
        <EmptyChatBox>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography>Cargando chats...</Typography>
        </EmptyChatBox>
      ) : filteredChats.length === 0 ? (
        <EmptyChatBox>
          <Typography variant="h6" sx={{ mb: 1 }}>
            {localSearchTerm ? 'No hay resultados' : 'Sin chats disponibles'}
          </Typography>
          <Typography variant="body2">
            {localSearchTerm
              ? 'Intenta con otro término de búsqueda'
              : 'Los chats asignados aparecerán aquí'}
          </Typography>
        </EmptyChatBox>
      ) : (
        <ChatListBox>
          {filteredChats.map((chat) => (
            <ChatItemButton
              key={chat.id}
              selected={selectedChat?.id === chat.id}
              onClick={() => onSelectChat(chat)}
              sx={{
                py: 1.5,
                px: 2,
              }}
            >
              <ListItemAvatar sx={{ mr: 2, position: 'relative' }}>
                <ChatBadge
                  badgeContent={chat.unreadCount > 0 ? chat.unreadCount : undefined}
                  overlap="circular"
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                  }}
                >
                  <Avatar
                    src={chat.avatar}
                    alt={chat.name}
                    sx={{
                      width: 48,
                      height: 48,
                      bgcolor: theme.palette.primary.main,
                      fontSize: '18px',
                      fontWeight: 700,
                    }}
                  >
                    {chat.name.charAt(0).toUpperCase()}
                  </Avatar>
                </ChatBadge>

                {/* Indicador de estado */}
                <StatusIndicator
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    border: `2px solid ${theme.palette.background.paper}`,
                    backgroundColor: getStatusColor(chat.status),
                    animation: chat.status === 'active' ? 'pulse 2s infinite' : 'none',
                    '@keyframes pulse': {
                      '0%': { opacity: 1 },
                      '50%': { opacity: 0.5 },
                      '100%': { opacity: 1 },
                    },
                  }}
                />
              </ListItemAvatar>

              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 700,
                        flex: 1,
                        mr: 1,
                      }}
                    >
                      {chat.name}
                    </Typography>
                    <TimeStampTypography>
                      {format(new Date(chat.timestamp), 'HH:mm', { locale: es })}
                    </TimeStampTypography>
                  </Box>
                }
                secondary={
                  <Box sx={{ mt: 0.5 }}>
                    <MessagePreview>{chat.lastMessage}</MessagePreview>
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center' }}>
                      {chat.phoneNumber && (
                        <Typography variant="caption" sx={{ color: theme.palette.text.disabled }}>
                          {chat.phoneNumber}
                        </Typography>
                      )}
                      {chat.status && (
                        <Chip
                          label={chat.status}
                          size="small"
                          sx={{
                            height: '18px',
                            fontSize: '10px',
                            backgroundColor:
                              chat.status === 'active'
                                ? theme.palette.success.light
                                : chat.status === 'pending'
                                ? theme.palette.warning.light
                                : chat.status === 'closed'
                                ? theme.palette.error.light
                                : theme.palette.info.light,
                            color:
                              chat.status === 'active'
                                ? theme.palette.success.dark
                                : chat.status === 'pending'
                                ? theme.palette.warning.dark
                                : chat.status === 'closed'
                                ? theme.palette.error.dark
                                : theme.palette.info.dark,
                          }}
                        />
                      )}
                    </Box>
                    {(chat.isSyncing || (typeof chat.syncProgress === 'number' && chat.syncProgress < 100)) && (
                      <LinearProgress
                        variant={typeof chat.syncProgress === 'number' ? 'determinate' : 'indeterminate'}
                        value={typeof chat.syncProgress === 'number' ? chat.syncProgress : 0}
                        sx={{
                          mt: 0.5,
                          height: 4,
                          borderRadius: 999,
                          backgroundColor: 'rgba(0, 168, 132, 0.12)',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: 'rgba(0, 168, 132, 0.9)',
                          },
                        }}
                      />
                    )}
                  </Box>
                }
              />
            </ChatItemButton>
          ))}
        </ChatListBox>
      )}
    </ChatListContainer>
  );
};

export default ModernAgentChatList;
