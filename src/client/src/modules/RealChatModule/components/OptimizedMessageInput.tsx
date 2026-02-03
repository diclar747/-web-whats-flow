/**
 * OptimizedMessageInput - Input optimizado que usa refs para evitar re-renders
 * del componente padre mientras se escribe
 */
import React, { useRef, useCallback, memo, useState, useEffect } from 'react';
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
  Close as CloseIcon,
  Mic as MicIcon
} from '@mui/icons-material';

interface OptimizedMessageInputProps {
  isDarkMode: boolean;
  onSend: (message: string, file?: File | null) => void;
  disabled?: boolean;
  replyMessage: any;
  onCancelReply: () => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  filePreview: string | null;
  setFilePreview: (preview: string | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

const OptimizedMessageInput: React.FC<OptimizedMessageInputProps> = memo(({
  isDarkMode,
  onSend,
  disabled = false,
  replyMessage,
  onCancelReply,
  selectedFile,
  setSelectedFile,
  filePreview,
  setFilePreview,
  fileInputRef
}) => {
  // 🚀 Usar ref para el valor del input - evita re-renders en cada tecla
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasContent, setHasContent] = useState(false);

  const colors = {
    background: isDarkMode ? '#2a3942' : '#fff',
    border: isDarkMode ? '#37474f' : '#e0e0e0',
    text: isDarkMode ? '#e9edef' : '#111b21',
    primary: '#00a884'
  };

  // Actualizar estado de botón enviar
  const checkContent = useCallback(() => {
    const value = inputRef.current?.value || '';
    setHasContent(value.trim().length > 0 || !!selectedFile);
  }, [selectedFile]);

  const handleSend = useCallback(() => {
    const message = inputRef.current?.value || '';
    if ((!message.trim() && !selectedFile) || disabled) return;
    
    onSend(message.trim(), selectedFile);
    
    // Limpiar input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    setHasContent(false);
    setSelectedFile(null);
    setFilePreview(null);
  }, [onSend, selectedFile, disabled, setSelectedFile, setFilePreview]);

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
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const reader = new FileReader();
        reader.onload = (e) => setFilePreview(e.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
      setHasContent(true);
    }
  }, [setSelectedFile, setFilePreview]);

  const handleClearFile = useCallback(() => {
    setSelectedFile(null);
    setFilePreview(null);
    checkContent();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [setSelectedFile, setFilePreview, checkContent, fileInputRef]);

  // Limpiar cuando cambia el reply
  useEffect(() => {
    if (!replyMessage && inputRef.current) {
      // Mantener el foco después de enviar
      inputRef.current.focus();
    }
  }, [replyMessage]);

  return (
    <Box sx={{ width: '100%' }}>
      {/* Reply indicator */}
      {replyMessage && (
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
              Respondiendo a {replyMessage.from === 'me' ? 'ti' : (replyMessage.from?.split('@')[0] || 'Usuario')}
            </Typography>
            <Typography variant="body2" noWrap sx={{ color: colors.text, opacity: 0.8 }}>
              {replyMessage.message}
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
          {filePreview && selectedFile.type.startsWith('image/') ? (
            <img 
              src={filePreview} 
              alt="Preview" 
              style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 4 }} 
            />
          ) : filePreview && selectedFile.type.startsWith('video/') ? (
            <video 
              src={filePreview} 
              style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 4 }} 
            />
          ) : selectedFile.type.startsWith('audio/') ? (
            <MicIcon sx={{ fontSize: 40, color: colors.primary }} />
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

        {/* 🚀 Input no controlado con ref - no causa re-renders */}
        <TextField
          inputRef={inputRef}
          fullWidth
          variant="outlined"
          size="small"
          onChange={checkContent}
          onKeyPress={handleKeyPress}
          placeholder={selectedFile ? "Agrega un mensaje..." : "Escribe un mensaje"}
          multiline
          maxRows={5}
          disabled={disabled}
          defaultValue=""
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
          disabled={(!hasContent) || disabled}
          sx={{
            bgcolor: hasContent ? colors.primary : 'transparent',
            color: hasContent ? 'white' : 'inherit',
            '&:hover': {
              bgcolor: hasContent ? '#008f7a' : 'transparent'
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

OptimizedMessageInput.displayName = 'OptimizedMessageInput';

export default OptimizedMessageInput;
