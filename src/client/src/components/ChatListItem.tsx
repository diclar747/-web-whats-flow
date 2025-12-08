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
import { People } from '@mui/icons-material';
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
}

export const ChatListItem: React.FC<ChatListItemProps> = ({
    chat,
    activeChatId,
    chatListCollapsed,
    colors,
    onSelect,
    formatTime,
    sessionId
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
                '&.Mui-selected': { backgroundColor: colors.selected },
                '&:hover': { backgroundColor: colors.hover }
            }}
        >
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
                        <Typography
                            variant="body2"
                            noWrap
                            sx={{
                                color: colors.textSecondary,
                                fontWeight: chat.unreadCount ? 500 : 400
                            }}
                        >
                            {chat.lastMessage || 'Toca para chatear'}
                        </Typography>
                    }
                />
            )}
        </ListItemButton>
    );
};
