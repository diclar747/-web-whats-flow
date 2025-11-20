import React, { useState, useEffect } from 'react';
import {
  Box,
  IconButton,
  Popper,
  Paper,
  ClickAwayListener,
  Typography,
  Tooltip,
  Fade,
  Chip
} from '@mui/material';
import {
  AddReaction as AddReactionIcon,
  Favorite as FavoriteIcon
} from '@mui/icons-material';
import { useTheme } from '../contexts/ThemeContext';

interface Reaction {
  userJid: string;
  reaction: string;
  timestamp: string;
}

interface MessageReactionsProps {
  messageId: string;
  sessionId: string;
  currentUserJid: string;
  reactions?: Reaction[];
  onReactionAdd: (messageId: string, reaction: string) => void;
  onReactionRemove: (messageId: string) => void;
}

const AVAILABLE_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍', '👎', '🙏'];

const MessageReactions: React.FC<MessageReactionsProps> = ({
  messageId,
  sessionId,
  currentUserJid,
  reactions = [],
  onReactionAdd,
  onReactionRemove
}) => {
  const { isDarkMode } = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  // Agrupar reacciones por emoji
  const groupedReactions = reactions.reduce((acc, reaction) => {
    if (!acc[reaction.reaction]) {
      acc[reaction.reaction] = [];
    }
    acc[reaction.reaction].push(reaction);
    return acc;
  }, {} as Record<string, Reaction[]>);

  // Verificar si el usuario actual ya reaccionó
  const userReaction = reactions.find(r => r.userJid === currentUserJid);

  const handleReactionClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    setShowReactionPicker(true);
  };

  const handleReactionSelect = (reaction: string) => {
    if (userReaction) {
      if (userReaction.reaction === reaction) {
        // Si ya tiene esta reacción, la elimina
        onReactionRemove(messageId);
      } else {
        // Si tiene otra reacción, la cambia
        onReactionAdd(messageId, reaction);
      }
    } else {
      // Si no tiene reacción, la agrega
      onReactionAdd(messageId, reaction);
    }
    setShowReactionPicker(false);
  };

  const handleClickAway = () => {
    setShowReactionPicker(false);
  };

  const getReactionTooltip = (reaction: string, users: Reaction[]) => {
    if (users.length === 1) {
      return `${users[0].userJid.split('@')[0]} reaccionó con ${reaction}`;
    } else if (users.length === 2) {
      return `${users[0].userJid.split('@')[0]} y ${users[1].userJid.split('@')[0]} reaccionaron con ${reaction}`;
    } else {
      return `${users[0].userJid.split('@')[0]} y ${users.length - 1} más reaccionaron con ${reaction}`;
    }
  };

  return (
    <Box sx={{ position: 'relative', display: 'inline-block' }}>
      {/* Mostrar reacciones existentes */}
      {Object.keys(groupedReactions).length > 0 && (
        <Box sx={{ 
          display: 'flex', 
          gap: 0.5, 
          mb: 0.5,
          flexWrap: 'wrap'
        }}>
          {Object.entries(groupedReactions).map(([reaction, users]) => (
            <Tooltip
              key={reaction}
              title={getReactionTooltip(reaction, users)}
              arrow
            >
              <Chip
                size="small"
                label={`${reaction} ${users.length}`}
                onClick={() => handleReactionSelect(reaction)}
                sx={{
                  height: 24,
                  fontSize: '0.75rem',
                  backgroundColor: users.some(u => u.userJid === currentUserJid)
                    ? isDarkMode ? '#005c4b' : '#dcf8c6'
                    : isDarkMode ? '#2a3942' : '#f0f2f5',
                  color: isDarkMode ? '#e9edef' : '#111b21',
                  border: users.some(u => u.userJid === currentUserJid)
                    ? '1px solid #00a884'
                    : '1px solid transparent',
                  '&:hover': {
                    backgroundColor: users.some(u => u.userJid === currentUserJid)
                      ? isDarkMode ? '#004d40' : '#c8e6c9'
                      : isDarkMode ? '#374045' : '#e0e0e0'
                  },
                  cursor: 'pointer'
                }}
              />
            </Tooltip>
          ))}
        </Box>
      )}

      {/* Botón para agregar reacción */}
      <Tooltip title="Agregar reacción">
        <IconButton
          size="small"
          onClick={handleReactionClick}
          sx={{
            width: 24,
            height: 24,
            color: isDarkMode ? '#8696a0' : '#667781',
            '&:hover': {
              backgroundColor: isDarkMode ? '#2a3942' : '#f0f2f5',
              color: isDarkMode ? '#e9edef' : '#111b21'
            }
          }}
        >
          <AddReactionIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>

      {/* Selector de reacciones */}
      <Popper
        open={showReactionPicker}
        anchorEl={anchorEl}
        placement="top"
        transition
        modifiers={[
          {
            name: 'offset',
            options: {
              offset: [0, 8],
            },
          },
        ]}
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={200}>
            <Paper
              elevation={8}
              sx={{
                p: 1,
                backgroundColor: isDarkMode ? '#233138' : 'white',
                border: `1px solid ${isDarkMode ? '#2f3b43' : '#d1d7db'}`,
                borderRadius: 3
              }}
            >
              <ClickAwayListener onClickAway={handleClickAway}>
                <Box sx={{ 
                  display: 'flex', 
                  gap: 0.5,
                  alignItems: 'center'
                }}>
                  {AVAILABLE_REACTIONS.map((reaction) => (
                    <IconButton
                      key={reaction}
                      size="small"
                      onClick={() => handleReactionSelect(reaction)}
                      sx={{
                        width: 36,
                        height: 36,
                        fontSize: '1.2rem',
                        backgroundColor: userReaction?.reaction === reaction
                          ? isDarkMode ? '#005c4b' : '#dcf8c6'
                          : 'transparent',
                        border: userReaction?.reaction === reaction
                          ? '2px solid #00a884'
                          : '2px solid transparent',
                        '&:hover': {
                          backgroundColor: isDarkMode ? '#2a3942' : '#f0f2f5',
                          transform: 'scale(1.2)'
                        },
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {reaction}
                    </IconButton>
                  ))}
                </Box>
              </ClickAwayListener>
            </Paper>
          </Fade>
        )}
      </Popper>
    </Box>
  );
};

export default MessageReactions;