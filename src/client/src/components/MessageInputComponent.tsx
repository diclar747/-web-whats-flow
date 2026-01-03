import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Tooltip,
  CircularProgress,
  Collapse,
  LinearProgress,
  Paper,
  Typography,
  useTheme,
  InputAdornment,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Popper,
  ClickAwayListener,
  Divider,
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  EmojiEmotions as EmojiIcon,
  Image as ImageIcon,
  Description as FileIcon,
  Videocam as VideoIcon,
  Mic as AudioIcon,
  Close as CloseIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import EmojiPicker from 'emoji-picker-react';

// ==================== STYLED COMPONENTS ====================

const InputContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  borderTop: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
  padding: '12px 16px',
  gap: '8px',
}));

const MessageInputBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: '8px',
  alignItems: 'flex-end',
  backgroundColor: theme.palette.background.default,
  borderRadius: '24px',
  paddingLeft: '12px',
  paddingRight: '4px',
  transition: 'all 0.3s ease',
  border: `1px solid ${theme.palette.divider}`,

  '&:hover': {
    borderColor: theme.palette.primary.main,
    boxShadow: `0 0 0 2px ${theme.palette.primary.main}15`,
  },

  '&.focused': {
    borderColor: theme.palette.primary.main,
    boxShadow: `0 0 0 3px ${theme.palette.primary.main}20`,
  },
}));

const MessageInput = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    fontSize: '15px',
    padding: '8px 0',
    backgroundColor: 'transparent',
    border: 'none',

    '& fieldset': {
      border: 'none',
    },

    '&:hover fieldset': {
      border: 'none',
    },

    '&.Mui-focused fieldset': {
      border: 'none',
    },
  },

  '& .MuiInputBase-input': {
    padding: '8px 0',
    maxHeight: '100px',

    '&::placeholder': {
      color: theme.palette.text.disabled,
      opacity: 0.7,
    },
  },
}));

const ActionButton = styled(IconButton)(({ theme }) => ({
  borderRadius: '50%',
  width: '36px',
  height: '36px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s ease',
  color: theme.palette.text.secondary,

  '&:hover': {
    color: theme.palette.primary.main,
    backgroundColor: theme.palette.action.hover,
  },

  '&.send-button': {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    width: '40px',
    height: '40px',

    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },

    '&:disabled': {
      backgroundColor: theme.palette.action.disabledBackground,
      color: theme.palette.action.disabled,
    },
  },
}));

const AttachmentMenu = styled(Paper)(({ theme }) => ({
  borderRadius: '12px',
  boxShadow: theme.shadows[8],
  zIndex: 1300,
  minWidth: '200px',
}));

const UploadIndicator = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 12px',
  backgroundColor: theme.palette.action.hover,
  borderRadius: '8px',
  fontSize: '13px',
  color: theme.palette.text.secondary,
}));

// ==================== INTERFACE ====================

interface MessageInputComponentProps {
  messageText: string;
  onMessageChange: (text: string) => void;
  onSend: () => void;
  sending?: boolean;
  disabled?: boolean;
  onAttachFile?: (file: File, type: 'image' | 'document' | 'video' | 'audio') => void;
  uploadProgress?: number;
  uploadFileName?: string;
  onEmojiClick?: (emoji: string) => void;
}

// ==================== COMPONENTE ====================

const MessageInputComponent: React.FC<MessageInputComponentProps> = ({
  messageText,
  onMessageChange,
  onSend,
  sending = false,
  disabled = false,
  onAttachFile,
  uploadProgress,
  uploadFileName,
  onEmojiClick,
}) => {
  const theme = useTheme();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null);
  const [attachmentAnchor, setAttachmentAnchor] = useState<HTMLElement | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleEmojiClick = (event: React.MouseEvent<HTMLElement>) => {
    setEmojiAnchor(emojiAnchor ? null : event.currentTarget);
    setShowEmojiPicker(!showEmojiPicker);
  };

  const handleAttachmentClick = (event: React.MouseEvent<HTMLElement>) => {
    setAttachmentAnchor(attachmentAnchor ? null : event.currentTarget);
  };

  const handleEmojiSelect = (emoji: string) => {
    onMessageChange(messageText + emoji);
  };

  const handleFileSelect = (file: File, type: 'image' | 'document' | 'video' | 'audio') => {
    if (onAttachFile) {
      onAttachFile(file, type);
    }
  };

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file, 'image');
  }, [onAttachFile]);

  const handleDocumentSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file, 'document');
  }, [onAttachFile]);

  const handleVideoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file, 'video');
  }, [onAttachFile]);

  const handleAudioSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file, 'audio');
  }, [onAttachFile]);

  const handleSend = () => {
    if (messageText.trim() && !sending) {
      onSend();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const attachmentOpen = Boolean(attachmentAnchor);

  return (
    <InputContainer>
      {/* Indicador de carga */}
      {uploadProgress !== undefined && uploadProgress > 0 && uploadProgress < 100 && (
        <Box>
          <UploadIndicator>
            <CircularProgress size={16} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption">
                {uploadFileName ? `Cargando ${uploadFileName}...` : 'Cargando archivo...'}
              </Typography>
              <LinearProgress variant="determinate" value={uploadProgress} sx={{ mt: 0.5 }} />
            </Box>
          </UploadIndicator>
        </Box>
      )}

      {/* Campo de entrada */}
      <MessageInputBox className={isFocused ? 'focused' : ''}>
        {/* Botón de archivos adjuntos */}
        <Tooltip title="Adjuntar">
          <ActionButton
            size="small"
            onClick={handleAttachmentClick}
            disabled={disabled || sending}
            sx={{ color: theme.palette.text.secondary }}
          >
            <AttachFileIcon sx={{ fontSize: '20px' }} />
          </ActionButton>
        </Tooltip>

        {/* Menú de adjuntos */}
        <Popper
          open={attachmentOpen}
          anchorEl={attachmentAnchor}
          placement="top-start"
          style={{ zIndex: 1300 }}
        >
          <ClickAwayListener onClickAway={() => setAttachmentAnchor(null)}>
            <AttachmentMenu>
              <List sx={{ py: 0 }}>
                <ListItem
                  button
                  onClick={() => {
                    imageInputRef.current?.click();
                    setAttachmentAnchor(null);
                  }}
                  sx={{ py: 1 }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <ImageIcon sx={{ color: theme.palette.primary.main }} />
                  </ListItemIcon>
                  <ListItemText primary="Imagen" />
                </ListItem>

                <ListItem
                  button
                  onClick={() => {
                    videoInputRef.current?.click();
                    setAttachmentAnchor(null);
                  }}
                  sx={{ py: 1 }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <VideoIcon sx={{ color: theme.palette.success.main }} />
                  </ListItemIcon>
                  <ListItemText primary="Video" />
                </ListItem>

                <ListItem
                  button
                  onClick={() => {
                    audioInputRef.current?.click();
                    setAttachmentAnchor(null);
                  }}
                  sx={{ py: 1 }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <AudioIcon sx={{ color: theme.palette.warning.main }} />
                  </ListItemIcon>
                  <ListItemText primary="Audio" />
                </ListItem>

                <Divider />

                <ListItem
                  button
                  onClick={() => {
                    fileInputRef.current?.click();
                    setAttachmentAnchor(null);
                  }}
                  sx={{ py: 1 }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <FileIcon sx={{ color: theme.palette.info.main }} />
                  </ListItemIcon>
                  <ListItemText primary="Archivo" />
                </ListItem>
              </List>
            </AttachmentMenu>
          </ClickAwayListener>
        </Popper>

        {/* Input de texto */}
        <MessageInput
          fullWidth
          multiline
          maxRows={4}
          placeholder="Escribe un mensaje..."
          value={messageText}
          onChange={(e) => onMessageChange(e.target.value)}
          onKeyPress={handleKeyPress}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled || sending}
          variant="outlined"
          size="small"
        />

        {/* Botón de emoji */}
        <Tooltip title="Emoji">
          <ActionButton
            size="small"
            onClick={handleEmojiClick}
            disabled={disabled || sending}
          >
            <EmojiIcon sx={{ fontSize: '20px' }} />
          </ActionButton>
        </Tooltip>

        {/* Picker de emoji */}
        <Popper
          open={showEmojiPicker}
          anchorEl={emojiAnchor}
          placement="top-end"
          style={{ zIndex: 1300 }}
        >
          <ClickAwayListener onClickAway={() => setShowEmojiPicker(false)}>
            <Box>
              <EmojiPicker
                onEmojiClick={(emojiData: any) => {
                  handleEmojiSelect(emojiData.emoji);
                }}
                theme={theme.palette.mode as any}
              />
            </Box>
          </ClickAwayListener>
        </Popper>

        {/* Botón de envío */}
        <Tooltip title={messageText.trim() ? 'Enviar (Enter)' : 'Escribe un mensaje'}>
          <ActionButton
            className="send-button"
            size="small"
            onClick={handleSend}
            disabled={!messageText.trim() || sending || disabled}
          >
            {sending ? (
              <CircularProgress size={20} />
            ) : (
              <SendIcon sx={{ fontSize: '20px' }} />
            )}
          </ActionButton>
        </Tooltip>
      </MessageInputBox>

      {/* File inputs ocultos */}
      <input
        ref={fileInputRef}
        type="file"
        hidden
        onChange={handleDocumentSelect}
        accept="*/*"
      />
      <input
        ref={imageInputRef}
        type="file"
        hidden
        onChange={handleImageSelect}
        accept="image/*"
      />
      <input
        ref={videoInputRef}
        type="file"
        hidden
        onChange={handleVideoSelect}
        accept="video/*"
      />
      <input
        ref={audioInputRef}
        type="file"
        hidden
        onChange={handleAudioSelect}
        accept="audio/*"
      />
    </InputContainer>
  );
};

export default MessageInputComponent;
