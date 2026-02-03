/**
 * MessageInput - Componente optimizado para entrada de mensajes
 * Previene re-renders del componente padre al escribir
 */
import React, { useState, useCallback, useRef, memo } from 'react';
import {
  Box,
  IconButton,
  TextField,
  Paper,
  Typography
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachIcon,
  InsertEmoticon as EmojiIcon,
  Close as CloseIcon
} from '@mui/icons-material';

interface MessageInputProps {
  isDarkMode: boolean;
  onSendMessage: (message: string, file?: File | null) => void;
  disabled?: boolean;
  replyTo?: { message: string; sender: string } | null;
  onCancelReply?: () => void;
}

const MessageInput: React.FC<MessageInputProps> = memo(({
  isDarkMode,
  onSendMessage,
  disabled = false,
  replyTo,
  onCancelReply
}) => {
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMessageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
  }, []);

  const handleSend = useCallback(() => {
    if ((!message.trim() && !selectedFile) || disabled) return;
    
    onSendMessage(message.trim(), selectedFile);
    setMessage('');
    setSelectedFile(null);
    setFilePreview(null);
  }, [message, selectedFile, disabled, onSendMessage]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => setFilePreview(e.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
  }, []);

  const handleClearFile = useCallback(() => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const colors = {
    background: isDarkMode ? '#2a3942' : '#fff',
    border: isDarkMode ? '#37474f' : '#e0e0e0',
    text: isDarkMode ? '#e9edef' : '#111b21',
    primary: '#00a884'
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Reply indicator */}
      {replyTo && (
        <Paper
          elevation={0}
          sx={{
            p: 1,
            mb: 1,
            bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
            borderLeft: `3px solid ${colors.primary}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: colors.primary, fontWeight: 600 }}>
              Respondiendo a {replyTo.sender}
            </Typography>
            <Typography variant="body2" noWrap sx={{ color: colors.text, opacity: 0.8 }}>
              {replyTo.message}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onCancelReply}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Paper>
      )}

      {/* File preview */}
      {selectedFile && (
        <Paper
          elevation={1}
          sx={{
            p: 1,
            mb: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            bgcolor: isDarkMode ? '#202c33' : '#f5f5f5'
          }}
        >
          {filePreview ? (
            <img 
              src={filePreview} 
              alt="Preview" 
              style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 4 }} 
            />
          ) : (
            <AttachIcon sx={{ fontSize: 40, color: '#007bff' }} />
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
              {selectedFile.name}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {(selectedFile.size / 1024).toFixed(0)} KB
            </Typography>
          </Box>
          <IconButton size="small" onClick={handleClearFile}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Paper>
      )}

      {/* Input area */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton size="small">
          <EmojiIcon />
        </IconButton>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt"
          style={{ display: 'none' }}
        />

        <IconButton size="small" onClick={() => fileInputRef.current?.click()}>
          <AttachIcon />
        </IconButton>

        <TextField
          fullWidth
          variant="outlined"
          size="small"
          value={message}
          onChange={handleMessageChange}
          onKeyPress={handleKeyPress}
          placeholder={selectedFile ? "Agrega un mensaje..." : "Escribe un mensaje"}
          multiline
          maxRows={5}
          disabled={disabled}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: colors.background,
              borderRadius: 2,
              '& fieldset': {
                borderColor: colors.border,
              },
              '&:hover fieldset': {
                borderColor: isDarkMode ? '#4a5a63' : '#bdbdbd',
              },
              '&.Mui-focused fieldset': {
                borderColor: colors.primary,
              },
            },
            '& .MuiInputBase-input': {
              color: colors.text,
            }
          }}
        />

        <IconButton
          onClick={handleSend}
          disabled={(!message.trim() && !selectedFile) || disabled}
          sx={{
            bgcolor: (message.trim() || selectedFile) ? colors.primary : 'transparent',
            color: (message.trim() || selectedFile) ? 'white' : 'inherit',
            '&:hover': {
              bgcolor: (message.trim() || selectedFile) ? '#008f7a' : 'transparent'
            },
            '&.Mui-disabled': {
              bgcolor: 'transparent',
              color: isDarkMode ? '#555' : '#999'
            }
          }}
        >
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
});

MessageInput.displayName = 'MessageInput';

export default MessageInput;
