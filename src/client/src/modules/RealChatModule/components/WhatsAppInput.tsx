/**
 * WhatsAppInput - Input estilo WhatsApp Web
 * Diseño moderno, compacto y elegante
 */
import React, { useRef, useCallback, memo, useState, useEffect } from 'react';
import {
  Box,
  IconButton,
  Typography
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachIcon,
  InsertEmoticon as EmojiIcon,
  Close as CloseIcon,
  Mic as MicIcon,
  Add as AddIcon
} from '@mui/icons-material';

interface WhatsAppInputProps {
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

const WhatsAppInput: React.FC<WhatsAppInputProps> = memo(({
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
  const inputRef = useRef<HTMLDivElement>(null);
  const [hasContent, setHasContent] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Colores de WhatsApp Web
  const colors = {
    background: isDarkMode ? '#202c33' : '#f0f2f5',
    inputBg: isDarkMode ? '#2a3942' : '#ffffff',
    text: isDarkMode ? '#e9edef' : '#111b21',
    primary: '#00a884',
    hover: isDarkMode ? '#374045' : '#e5e5e5',
    border: isDarkMode ? '#2a3942' : '#e0e0e0'
  };

  const checkContent = useCallback(() => {
    const text = inputRef.current?.innerText || '';
    const hasText = text.trim().length > 0;
    setHasContent(hasText || !!selectedFile);
  }, [selectedFile]);

  const handleSend = useCallback(() => {
    const message = inputRef.current?.innerText?.trim() || '';
    if ((!message && !selectedFile) || disabled) return;

    onSend(message, selectedFile);

    // Limpiar input
    if (inputRef.current) {
      inputRef.current.innerText = '';
    }
    setHasContent(false);
    setSelectedFile(null);
    setFilePreview(null);
  }, [onSend, selectedFile, disabled, setSelectedFile, setFilePreview]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
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

  // Emoji click handler
  const insertEmoji = useCallback((emoji: string) => {
    if (inputRef.current) {
      inputRef.current.innerText += emoji;
      checkContent();
      // Mantener foco
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(inputRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [checkContent]);

  useEffect(() => {
    if (!replyMessage && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyMessage]);

  return (
    <Box
      sx={{
        width: '100%',
        bgcolor: colors.background,
        borderTop: `1px solid ${colors.border}`,
        p: '8px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 1
      }}
    >
      {/* Reply indicator */}
      {replyMessage && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: '6px 12px',
            bgcolor: isDarkMode ? '#1a262f' : '#f5f5f5',
            borderRadius: '8px',
            borderLeft: `4px solid ${colors.primary}`
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{
                color: colors.primary,
                fontWeight: 600,
                fontSize: '0.75rem'
              }}
            >
              Respondiendo a {replyMessage.from === 'me' ? 'ti' : (replyMessage.from?.split('@')[0] || 'Usuario')}
            </Typography>
            <Typography
              variant="body2"
              noWrap
              sx={{
                color: isDarkMode ? '#aebac1' : '#667781',
                fontSize: '0.8rem'
              }}
            >
              {replyMessage.message}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onCancelReply} sx={{ p: 0.5 }}>
            <CloseIcon fontSize="small" sx={{ color: colors.text }} />
          </IconButton>
        </Box>
      )}

      {/* File preview */}
      {selectedFile && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: '6px 12px',
            bgcolor: isDarkMode ? '#1a262f' : '#f5f5f5',
            borderRadius: '8px'
          }}
        >
          {filePreview && selectedFile.type.startsWith('image/') ? (
            <Box
              component="img"
              src={filePreview}
              sx={{
                width: 40,
                height: 40,
                objectFit: 'cover',
                borderRadius: 1
              }}
            />
          ) : (
            <Box
              sx={{
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: isDarkMode ? '#2a3942' : '#e0e0e0',
                borderRadius: 1
              }}
            >
              <AttachIcon sx={{ color: colors.text }} />
            </Box>
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontSize: '0.85rem', color: colors.text }}>
              {selectedFile.name}
            </Typography>
            <Typography variant="caption" sx={{ color: isDarkMode ? '#8696a0' : '#667781' }}>
              {(selectedFile.size / 1024).toFixed(0)} KB
            </Typography>
          </Box>
          <IconButton size="small" onClick={handleClearFile} sx={{ p: 0.5 }}>
            <CloseIcon fontSize="small" sx={{ color: colors.text }} />
          </IconButton>
        </Box>
      )}

      {/* Input row - Estilo WhatsApp Web */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 1,
          minHeight: '44px'
        }}
      >
        {/* Botón más/emoji */}
        <IconButton
          size="small"
          sx={{
            color: isDarkMode ? '#8696a0' : '#54656f',
            p: '8px',
            '&:hover': { bgcolor: colors.hover }
          }}
        >
          <AddIcon />
        </IconButton>

        {/* Input de texto - Estilo WhatsApp */}
        <Box
          sx={{
            flex: 1,
            bgcolor: colors.inputBg,
            borderRadius: '22px',
            minHeight: '44px',
            maxHeight: '120px',
            display: 'flex',
            alignItems: 'center',
            px: 2,
            py: 0.5,
            overflow: 'hidden'
          }}
        >
          <IconButton
            size="small"
            sx={{
              color: isDarkMode ? '#8696a0' : '#54656f',
              mr: 1,
              p: '4px'
            }}
          >
            <EmojiIcon />
          </IconButton>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt"
            style={{ display: 'none' }}
          />

          <Box
            ref={inputRef}
            contentEditable
            onInput={checkContent}
            onKeyDown={handleKeyDown}
            sx={{
              flex: 1,
              outline: 'none',
              border: 'none',
              color: colors.text,
              fontSize: '0.9375rem',
              lineHeight: '20px',
              maxHeight: '100px',
              overflowY: 'auto',
              wordWrap: 'break-word',
              py: '8px',
              '&:empty:before': {
                content: '"Escribe un mensaje"',
                color: isDarkMode ? '#8696a0' : '#999',
                pointerEvents: 'none'
              }
            }}
          />

          <IconButton
            size="small"
            onClick={() => fileInputRef.current?.click()}
            sx={{
              color: isDarkMode ? '#8696a0' : '#54656f',
              ml: 1,
              p: '4px'
            }}
          >
            <AttachIcon />
          </IconButton>
        </Box>

        {/* Botón enviar/micrófono */}
        <IconButton
          onClick={handleSend}
          disabled={(!hasContent) || disabled}
          sx={{
            bgcolor: hasContent ? colors.primary : 'transparent',
            color: hasContent ? 'white' : isDarkMode ? '#8696a0' : '#54656f',
            width: '44px',
            height: '44px',
            '&:hover': {
              bgcolor: hasContent ? '#008f7a' : colors.hover
            },
            '&.Mui-disabled': {
              bgcolor: 'transparent',
              color: isDarkMode ? '#8696a0' : '#999'
            },
            transition: 'all 0.2s ease'
          }}
        >
          {hasContent ? <SendIcon /> : <MicIcon />}
        </IconButton>
      </Box>
    </Box>
  );
});

WhatsAppInput.displayName = 'WhatsAppInput';

export default WhatsAppInput;
