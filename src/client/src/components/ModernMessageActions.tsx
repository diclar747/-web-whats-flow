import React, { useState } from 'react';
import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Fade
} from '@mui/material';
import {
  Reply as ReplyIcon,
  Forward as ForwardIcon,
  AddReaction as AddReactionIcon,
  MoreVert as MoreIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Star as StarIcon,
  TransferWithinAStation as TransferIcon,
  Download as DownloadIcon,
  Info as InfoIcon
} from '@mui/icons-material';

interface ModernMessageActionsProps {
  messageId: string;
  isFromMe: boolean;
  isDarkMode: boolean;
  messageText?: string;
  mediaUrl?: string;
  onReply?: () => void;
  onForward?: () => void;
  onReact?: () => void;
  onTransfer?: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
  onStar?: () => void;
  onDownload?: () => void;
  onInfo?: () => void;
}

const ModernMessageActions: React.FC<ModernMessageActionsProps> = ({
  messageId,
  isFromMe,
  isDarkMode,
  messageText,
  mediaUrl,
  onReply,
  onForward,
  onReact,
  onTransfer,
  onCopy,
  onDelete,
  onStar,
  onDownload,
  onInfo
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleAction = (action?: () => void) => {
    if (action) action();
    handleClose();
  };

  return (
    <Box
      className="message-actions"
      onMouseEnter={() => setShowQuickActions(true)}
      onMouseLeave={() => setShowQuickActions(false)}
      sx={{
        position: 'absolute',
        top: -8,
        right: isFromMe ? 'auto' : -8,
        left: isFromMe ? -8 : 'auto',
        display: 'flex',
        gap: 0.5,
        opacity: showQuickActions ? 1 : 0,
        transition: 'opacity 0.2s',
        zIndex: 10
      }}
    >
      <Fade in={showQuickActions}>
        <Box
          sx={{
            display: 'flex',
            gap: 0.5,
            bgcolor: isDarkMode ? '#2a3942' : '#ffffff',
            borderRadius: '20px',
            padding: '4px 6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            border: `1px solid ${isDarkMode ? '#3b4a54' : '#e9edef'}`
          }}
        >
          {/* Responder */}
          {onReply && (
            <Tooltip title="Responder" arrow>
              <IconButton
                size="small"
                onClick={() => handleAction(onReply)}
                sx={{
                  width: 32,
                  height: 32,
                  color: isDarkMode ? '#8696a0' : '#54656f',
                  '&:hover': {
                    bgcolor: isDarkMode ? '#374048' : '#f0f2f5',
                    color: '#00a884'
                  }
                }}
              >
                <ReplyIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}

          {/* Reaccionar */}
          {onReact && (
            <Tooltip title="Reaccionar" arrow>
              <IconButton
                size="small"
                onClick={() => handleAction(onReact)}
                sx={{
                  width: 32,
                  height: 32,
                  color: isDarkMode ? '#8696a0' : '#54656f',
                  '&:hover': {
                    bgcolor: isDarkMode ? '#374048' : '#f0f2f5',
                    color: '#f59e0b'
                  }
                }}
              >
                <AddReactionIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}

          {/* Reenviar */}
          {onForward && (
            <Tooltip title="Reenviar" arrow>
              <IconButton
                size="small"
                onClick={() => handleAction(onForward)}
                sx={{
                  width: 32,
                  height: 32,
                  color: isDarkMode ? '#8696a0' : '#54656f',
                  '&:hover': {
                    bgcolor: isDarkMode ? '#374048' : '#f0f2f5',
                    color: '#06b6d4'
                  }
                }}
              >
                <ForwardIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}

          {/* Más opciones */}
          <Tooltip title="Más opciones" arrow>
            <IconButton
              size="small"
              onClick={handleClick}
              sx={{
                width: 32,
                height: 32,
                color: isDarkMode ? '#8696a0' : '#54656f',
                '&:hover': {
                  bgcolor: isDarkMode ? '#374048' : '#f0f2f5'
                }
              }}
            >
              <MoreIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Fade>

      {/* Menú contextual */}
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        TransitionComponent={Fade}
        PaperProps={{
          sx: {
            bgcolor: isDarkMode ? '#2a3942' : '#ffffff',
            color: isDarkMode ? '#e9edef' : '#111b21',
            minWidth: 200,
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            border: `1px solid ${isDarkMode ? '#3b4a54' : '#e9edef'}`
          }
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: isFromMe ? 'left' : 'right'
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: isFromMe ? 'left' : 'right'
        }}
      >
        {/* Copiar texto */}
        {messageText && onCopy && (
          <MenuItem
            onClick={() => handleAction(onCopy)}
            sx={{
              py: 1.5,
              px: 2,
              '&:hover': {
                bgcolor: isDarkMode ? '#374048' : '#f0f2f5'
              }
            }}
          >
            <ListItemIcon>
              <CopyIcon sx={{ color: isDarkMode ? '#8696a0' : '#54656f', fontSize: 20 }} />
            </ListItemIcon>
            <ListItemText
              primary="Copiar texto"
              primaryTypographyProps={{
                fontSize: '0.875rem',
                fontWeight: 400
              }}
            />
          </MenuItem>
        )}

        {/* Transferir chat */}
        {onTransfer && (
          <MenuItem
            onClick={() => handleAction(onTransfer)}
            sx={{
              py: 1.5,
              px: 2,
              '&:hover': {
                bgcolor: isDarkMode ? '#374048' : '#f0f2f5'
              }
            }}
          >
            <ListItemIcon>
              <TransferIcon sx={{ color: '#00a884', fontSize: 20 }} />
            </ListItemIcon>
            <ListItemText
              primary="Transferir chat"
              primaryTypographyProps={{
                fontSize: '0.875rem',
                fontWeight: 400
              }}
            />
          </MenuItem>
        )}

        {/* Descargar archivo */}
        {mediaUrl && onDownload && (
          <MenuItem
            onClick={() => handleAction(onDownload)}
            sx={{
              py: 1.5,
              px: 2,
              '&:hover': {
                bgcolor: isDarkMode ? '#374048' : '#f0f2f5'
              }
            }}
          >
            <ListItemIcon>
              <DownloadIcon sx={{ color: '#06b6d4', fontSize: 20 }} />
            </ListItemIcon>
            <ListItemText
              primary="Descargar"
              primaryTypographyProps={{
                fontSize: '0.875rem',
                fontWeight: 400
              }}
            />
          </MenuItem>
        )}

        {/* Destacar mensaje */}
        {onStar && (
          <MenuItem
            onClick={() => handleAction(onStar)}
            sx={{
              py: 1.5,
              px: 2,
              '&:hover': {
                bgcolor: isDarkMode ? '#374048' : '#f0f2f5'
              }
            }}
          >
            <ListItemIcon>
              <StarIcon sx={{ color: '#f59e0b', fontSize: 20 }} />
            </ListItemIcon>
            <ListItemText
              primary="Destacar"
              primaryTypographyProps={{
                fontSize: '0.875rem',
                fontWeight: 400
              }}
            />
          </MenuItem>
        )}

        {/* Información del mensaje */}
        {onInfo && (
          <MenuItem
            onClick={() => handleAction(onInfo)}
            sx={{
              py: 1.5,
              px: 2,
              '&:hover': {
                bgcolor: isDarkMode ? '#374048' : '#f0f2f5'
              }
            }}
          >
            <ListItemIcon>
              <InfoIcon sx={{ color: isDarkMode ? '#8696a0' : '#54656f', fontSize: 20 }} />
            </ListItemIcon>
            <ListItemText
              primary="Info. del mensaje"
              primaryTypographyProps={{
                fontSize: '0.875rem',
                fontWeight: 400
              }}
            />
          </MenuItem>
        )}

        {/* Eliminar mensaje */}
        {isFromMe && onDelete && (
          <MenuItem
            onClick={() => handleAction(onDelete)}
            sx={{
              py: 1.5,
              px: 2,
              color: '#ef4444',
              '&:hover': {
                bgcolor: 'rgba(239, 68, 68, 0.1)'
              }
            }}
          >
            <ListItemIcon>
              <DeleteIcon sx={{ color: '#ef4444', fontSize: 20 }} />
            </ListItemIcon>
            <ListItemText
              primary="Eliminar"
              primaryTypographyProps={{
                fontSize: '0.875rem',
                fontWeight: 400
              }}
            />
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
};

export default ModernMessageActions;
