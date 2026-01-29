import React from 'react';
import {
    ListItemButton,
    ListItemAvatar,
    Tooltip,
    Badge,
    Avatar,
    ListItemText,
    Box,
    Typography,
    Chip
} from '@mui/material';
import { People, Image as ImageIcon, Videocam, Mic } from '@mui/icons-material';
import { useDrag } from 'react-dnd';
import { getAPIBaseURL } from '../utils/socketConfig';
import { useWhatsApp } from '../context/WhatsAppContext';
import SophisticatedProgressBar from './SophisticatedProgressBar';

interface ChatListItemProps {
    chat: any;
    activeChatId?: string;
    chatListCollapsed: boolean;
    colors: any;
    onSelect: (chat: any) => void;
    formatTime: (date: string) => string;
    sessionId: string | null;
    typingStatus?: { [chatId: string]: string };
}

export const ChatListItem: React.FC<ChatListItemProps> = ({
    chat,
    activeChatId,
    chatListCollapsed,
    colors,
    onSelect,
    formatTime,
    sessionId,
    typingStatus
}) => {
    const { syncProgress } = useWhatsApp();
    const [{ isDragging }, drag] = useDrag(() => ({
        type: 'CHAT_ITEM',
        item: { chatJid: chat.id, chatName: chat.name },
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging(),
        })
    }));

    // Attach ref manually
    const dragRef = drag as unknown as (element: HTMLElement | null) => void;

    return (
        <Tooltip
            title={
                <Box sx={{ p: 0.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{chat.name || chat.id.split('@')[0]}</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.8, display: 'block' }}>{chat.id}</Typography>
                    {chat.lastMessage && (
                        <Box sx={{ mt: 1, pt: 0.5, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                            <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
                                {chat.lastMessageFromMe ? 'Tú: ' : ''}{chat.lastMessage}
                            </Typography>
                        </Box>
                    )}
                </Box>
            }
            placement="right"
            arrow
            disableHoverListener={chatListCollapsed}
        >
            <ListItemButton
                ref={dragRef}
                selected={activeChatId === chat.id}
                onClick={() => onSelect(chat)}
                sx={{
                    px: 2,
                    py: 1.5,
                    opacity: isDragging ? 0.5 : 1,
                    cursor: 'grab',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                    '&.Mui-selected': { backgroundColor: colors.selected },
                    '&:hover': { backgroundColor: colors.hover },
                    // 🟢 Animación de pulso cuando llega un mensaje
                    animation: chat.lastUpdate && (Date.now() - chat.lastUpdate < 3000) ? 'pulse-new 2s ease-out' : 'none',
                    '@keyframes pulse-new': {
                        '0%': { backgroundColor: 'transparent' },
                        '10%': { backgroundColor: '#25d36622' },
                        '100%': { backgroundColor: 'transparent' }
                    },
                    '@keyframes pulse-red': {
                        '0%': { transform: 'scale(1)', opacity: 1 },
                        '50%': { transform: 'scale(1.2)', opacity: 0.8 },
                        '100%': { transform: 'scale(1)', opacity: 1 }
                    }
                }}
            >
                {/* Indicador lateral de mensaje nuevo */}
                {chat.unreadCount > 0 && (
                    <Box sx={{
                        position: 'absolute',
                        left: 0,
                        top: '15%',
                        bottom: '15%',
                        width: 4,
                        bgcolor: '#f44336', // Red
                        borderRadius: '0 4px 4px 0'
                    }} />
                )}
                <ListItemAvatar sx={{ minWidth: chatListCollapsed ? 'auto' : 56, justifyContent: 'center', display: 'flex' }}>
                    <Tooltip title={chatListCollapsed ? chat.name : ''} placement="right">
                        <Badge
                            badgeContent={chat.unreadCount}
                            color="error" // 'error' is red in default MUI theme
                            invisible={!chat.unreadCount || chat.unreadCount === 0}
                            sx={{
                                '& .MuiBadge-badge': {
                                    backgroundColor: '#f44336', // Red
                                    color: 'white',
                                    fontWeight: 'bold',
                                    boxShadow: '0 0 0 2px #fff'
                                }
                            }}
                        >
                            <Box sx={{ position: 'relative' }}>
                                <Avatar
                                    src={chat.avatar || `${getAPIBaseURL()}/api/avatar/${sessionId}/${chat.id}`}
                                    imgProps={{
                                        onError: (e: any) => {
                                            e.target.src = '';
                                            e.target.onerror = null;
                                        }
                                    }}
                                    sx={{
                                        bgcolor: chat.isGroup ? '#9c27b0' : colors.primary,
                                        border: chat.unreadCount > 0 ? '2px solid #f44336' : 'none' // Red border for pending
                                    }}
                                >
                                    {chat.name ? chat.name.charAt(0).toUpperCase() : chat.id.split('@')[0].charAt(0)}
                                </Avatar>
                                {/* PUNTITO ROJO DE "PENDIENTE" sobre el avatar */}
                                {chat.unreadCount > 0 && (
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            bottom: 0,
                                            right: 0,
                                            width: 12,
                                            height: 12,
                                            borderRadius: '50%',
                                            bgcolor: '#f44336',
                                            border: '2px solid white',
                                            zIndex: 2,
                                            animation: 'pulse-red 1.5s infinite'
                                        }}
                                    />
                                )}
                            </Box>
                        </Badge>
                    </Tooltip>
                </ListItemAvatar>
                {!chatListCollapsed && (
                    <ListItemText
                        primary={
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    {chat.isGroup && <People sx={{ fontSize: 16, color: '#9c27b0' }} />}
                                    <Typography variant="body1" noWrap sx={{ fontWeight: chat.unreadCount ? 600 : 400, color: colors.text }}>
                                        {chat.name || chat.id.split('@')[0]}
                                    </Typography>
                                    {/* Etiqueta de Agente Asignado */}
                                    {chat.assigned_agent_name && (
                                        <Chip
                                            label={`Agente: ${chat.assigned_agent_name}`}
                                            size="small"
                                            sx={{
                                                ml: 1,
                                                height: 16,
                                                fontSize: '0.65rem',
                                                bgcolor: '#e3f2fd',
                                                color: '#1976d2',
                                                fontWeight: 600
                                            }}
                                        />
                                    )}
                                </Box>
                                <Typography variant="caption" sx={{ color: colors.textSecondary, ml: 1 }}>
                                    {chat.timestamp ? formatTime(chat.timestamp) : ''}
                                </Typography>
                            </Box>
                        }
                        secondary={
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    {chat.lastMessage?.includes('📷 Imagen') && <ImageIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.3 }} />}
                                    {chat.lastMessage?.includes('🎥 Video') && <Videocam sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.3 }} />}
                                    {chat.lastMessage?.includes('🔊 Audio') && <Mic sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.3 }} />}
                                    <Typography
                                        variant="body2"
                                        noWrap
                                        sx={{
                                            color: typingStatus?.[chat.id] ? '#25d366' : colors.textSecondary,
                                            fontWeight: (chat.unreadCount || typingStatus?.[chat.id]) ? 500 : 400,
                                            fontStyle: typingStatus?.[chat.id] ? 'italic' : 'normal',
                                            fontSize: '0.85rem',
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}
                                    >
                                        {typingStatus?.[chat.id] || (
                                            <>
                                                {chat.lastMessageFromMe && <span style={{ color: colors.primary, fontWeight: 600, marginRight: '4px' }}>Tú:</span>}
                                                {chat.lastMessage || 'Toca para chatear'}
                                            </>
                                        )}
                                    </Typography>
                                </Box>
                                {syncProgress?.status === 'syncing' && (
                                    <SophisticatedProgressBar progress={syncProgress.progress} compact />
                                )}
                            </Box>
                        }
                    />
                )}
            </ListItemButton>
        </Tooltip>
    );
};
