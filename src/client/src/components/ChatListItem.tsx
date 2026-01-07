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
                    bgcolor: '#25d366',
                    borderRadius: '0 4px 4px 0'
                }} />
            )}
            <ListItemAvatar sx={{ minWidth: chatListCollapsed ? 'auto' : 56, justifyContent: 'center', display: 'flex' }}>
                <Tooltip title={chatListCollapsed ? chat.name : ''} placement="right">
                    <Badge
                        badgeContent={chat.unreadCount}
                        color="error"
                        invisible={!chat.unreadCount || chat.unreadCount === 0}
                        sx={{
                            '& .MuiBadge-badge': {
                                backgroundColor: '#25d366',
                                color: 'white',
                                fontWeight: 'bold'
                            }
                        }}
                    >
                        <Avatar
                            src={chat.avatar || `${getAPIBaseURL()}/api/avatar/${sessionId}/${chat.id}`}
                            imgProps={{
                                onError: (e: any) => {
                                    e.target.src = '';
                                    e.target.onerror = null;
                                }
                            }}
                            sx={{ bgcolor: chat.isGroup ? '#9c27b0' : colors.primary }}
                        >
                            {chat.name ? chat.name.charAt(0).toUpperCase() : chat.id.split('@')[0].charAt(0)}
                        </Avatar>
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
                                    fontSize: '0.85rem'
                                }}
                            >
                                {typingStatus?.[chat.id] || chat.lastMessage || 'Toca para chatear'}
                            </Typography>
                        </Box>
                    }
                />
            )}
        </ListItemButton>
    );
};
