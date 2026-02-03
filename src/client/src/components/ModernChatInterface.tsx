import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Box,
    TextField,
    IconButton,
    Avatar,
    Typography,
    Paper,
    Tooltip,
    Menu,
    MenuItem,
    Divider,
    Badge,
    CircularProgress,
    Chip
} from '@mui/material';
import {
    Send,
    AttachFile,
    EmojiEmotions,
    MoreVert,
    Search,
    Close,
    Check,
    DoneAll,
    AccessTime,
    Error as ErrorIcon,
    ArrowBack
} from '@mui/icons-material';
import { format, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';

interface Message {
    id: string;
    message: string;
    timestamp: number;
    isFromMe: boolean;
    status?: 'pending' | 'sent' | 'delivered' | 'read' | 'error';
    type?: 'text' | 'image' | 'video' | 'audio' | 'document';
    mediaUrl?: string;
}

interface Chat {
    id: string;
    name: string;
    avatar?: string;
    lastMessage?: string;
    lastMessageTime?: number;
    unreadCount?: number;
    isOnline?: boolean;
    isGroup?: boolean;
}

interface ModernChatInterfaceProps {
    activeChat: Chat | null;
    messages: Message[];
    onSendMessage: (message: string) => void;
    onBack?: () => void;
    isDarkMode?: boolean;
}

const ModernChatInterface: React.FC<ModernChatInterfaceProps> = ({
    activeChat,
    messages,
    onSendMessage,
    onBack,
    isDarkMode = true
}) => {
    const [inputMessage, setInputMessage] = useState('');
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isSending, setIsSending] = useState(false);

    // Colores del tema
    const colors = {
        background: isDarkMode ? '#0b141a' : '#efeae2',
        chatBg: isDarkMode ? '#0b141a' : '#e5ddd5',
        header: isDarkMode ? '#202c33' : '#f0f2f5',
        myMessage: isDarkMode ? '#005c4b' : '#d9fdd3',
        theirMessage: isDarkMode ? '#202c33' : '#ffffff',
        text: isDarkMode ? '#e9edef' : '#111b21',
        textSecondary: isDarkMode ? '#8696a0' : '#667781',
        border: isDarkMode ? '#2a3942' : '#d1d7db',
        input: isDarkMode ? '#2a3942' : '#ffffff',
        hover: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
    };

    // Scroll automático al final
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Formatear hora del mensaje
    const formatMessageTime = (timestamp: number) => {
        const date = new Date(timestamp);
        if (isToday(date)) {
            return format(date, 'HH:mm');
        } else if (isYesterday(date)) {
            return `Ayer ${format(date, 'HH:mm')}`;
        } else {
            return format(date, 'dd/MM/yyyy HH:mm', { locale: es });
        }
    };

    // Enviar mensaje
    const handleSend = async () => {
        if (!inputMessage.trim() || isSending) return;

        setIsSending(true);
        try {
            await onSendMessage(inputMessage.trim());
            setInputMessage('');
        } catch (error) {
            console.error('Error enviando mensaje:', error);
        } finally {
            setIsSending(false);
        }
    };

    // Manejar Enter
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Icono de estado del mensaje
    const getStatusIcon = (status?: string) => {
        switch (status) {
            case 'pending':
                return <AccessTime sx={{ fontSize: 14, color: colors.textSecondary }} />;
            case 'sent':
                return <Check sx={{ fontSize: 14, color: colors.textSecondary }} />;
            case 'delivered':
                return <DoneAll sx={{ fontSize: 14, color: colors.textSecondary }} />;
            case 'read':
                return <DoneAll sx={{ fontSize: 14, color: '#53bdeb' }} />;
            case 'error':
                return <ErrorIcon sx={{ fontSize: 14, color: '#f44336' }} />;
            default:
                return null;
        }
    };

    if (!activeChat) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    bgcolor: colors.background,
                    color: colors.textSecondary
                }}
            >
                <Typography variant="h6">Selecciona un chat para comenzar</Typography>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                width: '100%',
                bgcolor: colors.background,
                position: 'relative'
            }}
        >
            {/* HEADER - Fijo arriba */}
            <Paper
                elevation={1}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 2,
                    bgcolor: colors.header,
                    borderRadius: 0,
                    borderBottom: `1px solid ${colors.border}`,
                    minHeight: '70px',
                    maxHeight: '70px',
                    flexShrink: 0
                }}
            >
                {onBack && (
                    <IconButton onClick={onBack} sx={{ color: colors.text }}>
                        <ArrowBack />
                    </IconButton>
                )}

                <Badge
                    overlap="circular"
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    variant="dot"
                    sx={{
                        '& .MuiBadge-badge': {
                            backgroundColor: activeChat.isOnline ? '#25d366' : 'transparent',
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            border: `2px solid ${colors.header}`
                        }
                    }}
                >
                    <Avatar
                        src={activeChat.avatar}
                        sx={{
                            width: 45,
                            height: 45,
                            bgcolor: '#00a884'
                        }}
                    >
                        {activeChat.name?.charAt(0).toUpperCase()}
                    </Avatar>
                </Badge>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                        variant="h6"
                        sx={{
                            color: colors.text,
                            fontWeight: 600,
                            fontSize: '16px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {activeChat.name}
                    </Typography>
                    <Typography
                        variant="caption"
                        sx={{
                            color: colors.textSecondary,
                            fontSize: '13px'
                        }}
                    >
                        {activeChat.isOnline ? 'En línea' : 'Desconectado'}
                    </Typography>
                </Box>

                <IconButton sx={{ color: colors.text }}>
                    <Search />
                </IconButton>

                <IconButton
                    onClick={(e) => setMenuAnchor(e.currentTarget)}
                    sx={{ color: colors.text }}
                >
                    <MoreVert />
                </IconButton>

                <Menu
                    anchorEl={menuAnchor}
                    open={Boolean(menuAnchor)}
                    onClose={() => setMenuAnchor(null)}
                >
                    <MenuItem onClick={() => setMenuAnchor(null)}>Ver contacto</MenuItem>
                    <MenuItem onClick={() => setMenuAnchor(null)}>Buscar mensajes</MenuItem>
                    <Divider />
                    <MenuItem onClick={() => setMenuAnchor(null)}>Silenciar</MenuItem>
                    <MenuItem onClick={() => setMenuAnchor(null)}>Archivar</MenuItem>
                    <Divider />
                    <MenuItem onClick={() => setMenuAnchor(null)} sx={{ color: '#f44336' }}>
                        Eliminar chat
                    </MenuItem>
                </Menu>
            </Paper>

            {/* ÁREA DE MENSAJES - Con scroll */}
            <Box
                sx={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    p: 2,
                    bgcolor: colors.chatBg,
                    backgroundImage: isDarkMode
                        ? 'none'
                        : 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h100v100H0z\' fill=\'%23e5ddd5\'/%3E%3C/svg%3E")',
                    // Custom scrollbar
                    '&::-webkit-scrollbar': {
                        width: '6px'
                    },
                    '&::-webkit-scrollbar-track': {
                        bgcolor: 'transparent'
                    },
                    '&::-webkit-scrollbar-thumb': {
                        bgcolor: 'rgba(255,255,255,0.2)',
                        borderRadius: '10px',
                        '&:hover': {
                            bgcolor: 'rgba(255,255,255,0.3)'
                        }
                    }
                }}
            >
                {messages.length === 0 ? (
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            color: colors.textSecondary
                        }}
                    >
                        <Typography variant="body2">
                            No hay mensajes. Envía el primero!
                        </Typography>
                    </Box>
                ) : (
                    messages.map((msg, index) => {
                        // Evitar duplicados comparando ID
                        const isDuplicate = index > 0 && messages[index - 1].id === msg.id;
                        if (isDuplicate) return null;

                        return (
                            <Box
                                key={`${msg.id}-${index}`}
                                sx={{
                                    display: 'flex',
                                    justifyContent: msg.isFromMe ? 'flex-end' : 'flex-start',
                                    mb: 1
                                }}
                            >
                                <Paper
                                    elevation={1}
                                    sx={{
                                        maxWidth: '65%',
                                        p: 1.5,
                                        bgcolor: msg.isFromMe ? colors.myMessage : colors.theirMessage,
                                        borderRadius: '8px',
                                        position: 'relative',
                                        wordBreak: 'break-word',
                                        '&::before': msg.isFromMe
                                            ? {
                                                content: '""',
                                                position: 'absolute',
                                                right: -8,
                                                top: 0,
                                                width: 0,
                                                height: 0,
                                                borderLeft: `8px solid ${colors.myMessage}`,
                                                borderTop: '8px solid transparent'
                                            }
                                            : {
                                                content: '""',
                                                position: 'absolute',
                                                left: -8,
                                                top: 0,
                                                width: 0,
                                                height: 0,
                                                borderRight: `8px solid ${colors.theirMessage}`,
                                                borderTop: '8px solid transparent'
                                            }
                                    }}
                                >
                                    <Typography
                                        variant="body1"
                                        sx={{
                                            color: colors.text,
                                            fontSize: '14.2px',
                                            lineHeight: 1.5,
                                            mb: 0.5
                                        }}
                                    >
                                        {msg.message}
                                    </Typography>

                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'flex-end',
                                            gap: 0.5,
                                            mt: 0.5
                                        }}
                                    >
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                color: colors.textSecondary,
                                                fontSize: '11px'
                                            }}
                                        >
                                            {formatMessageTime(msg.timestamp)}
                                        </Typography>
                                        {msg.isFromMe && getStatusIcon(msg.status)}
                                    </Box>
                                </Paper>
                            </Box>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </Box>

            {/* BARRA DE ENTRADA - Fija abajo */}
            <Paper
                elevation={2}
                sx={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 1,
                    p: 1.5,
                    bgcolor: colors.header,
                    borderRadius: 0,
                    borderTop: `1px solid ${colors.border}`,
                    minHeight: '62px',
                    maxHeight: '150px',
                    flexShrink: 0
                }}
            >
                <IconButton
                    size="small"
                    sx={{
                        color: colors.textSecondary,
                        '&:hover': { color: colors.text }
                    }}
                >
                    <EmojiEmotions />
                </IconButton>

                <IconButton
                    size="small"
                    sx={{
                        color: colors.textSecondary,
                        '&:hover': { color: colors.text }
                    }}
                >
                    <AttachFile />
                </IconButton>

                <TextField
                    fullWidth
                    multiline
                    maxRows={4}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Escribe un mensaje"
                    disabled={isSending}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            bgcolor: colors.input,
                            color: colors.text,
                            borderRadius: '8px',
                            fontSize: '15px',
                            '& fieldset': {
                                borderColor: 'transparent'
                            },
                            '&:hover fieldset': {
                                borderColor: 'transparent'
                            },
                            '&.Mui-focused fieldset': {
                                borderColor: '#00a884',
                                borderWidth: '1px'
                            }
                        },
                        '& .MuiOutlinedInput-input': {
                            padding: '10px 14px',
                            '&::placeholder': {
                                color: colors.textSecondary,
                                opacity: 1
                            }
                        }
                    }}
                />

                <IconButton
                    onClick={handleSend}
                    disabled={!inputMessage.trim() || isSending}
                    sx={{
                        bgcolor: inputMessage.trim() ? '#00a884' : 'transparent',
                        color: inputMessage.trim() ? '#ffffff' : colors.textSecondary,
                        '&:hover': {
                            bgcolor: inputMessage.trim() ? '#008069' : colors.hover
                        },
                        '&.Mui-disabled': {
                            bgcolor: 'transparent',
                            color: colors.textSecondary
                        },
                        transition: 'all 0.2s ease'
                    }}
                >
                    {isSending ? <CircularProgress size={24} /> : <Send />}
                </IconButton>
            </Paper>
        </Box>
    );
};

export default ModernChatInterface;
