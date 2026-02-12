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
        <Tooltip
            title={
                <Box sx={{ p: 0.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{chat.name || chat.id.split('@')[0]}</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.8, display: 'block' }}>{chat.id.split('@')[0]}</Typography>
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
                    px: 1.5,
                    py: 1,
                    opacity: isDragging ? 0.5 : 1,
                    cursor: 'grab',
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: '8px !important',
                    mx: 0.5,
                    mb: '2px !important',
                    '&.Mui-selected': {
                        backgroundColor: colors.selected,
                        borderLeft: `3px solid ${colors.primary} !important`,
                    },
                    '&:hover': { backgroundColor: colors.hover },
                }}
            >
                <ListItemAvatar sx={{ minWidth: chatListCollapsed ? 'auto' : 50, justifyContent: 'center', display: 'flex' }}>
                    <Tooltip title={chatListCollapsed ? chat.name : ''} placement="right">
                        <Badge
                            badgeContent={chat.unreadCount}
                            invisible={!chat.unreadCount || chat.unreadCount === 0}
                            sx={{
                                '& .MuiBadge-badge': {
                                    backgroundColor: '#ef4444',
                                    color: 'white',
                                    fontWeight: 700,
                                    fontSize: '0.65rem',
                                    minWidth: 18,
                                    height: 18,
                                    borderRadius: 9,
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
                                sx={{
                                    bgcolor: chat.isGroup ? '#7c3aed' : colors.primary,
                                    width: 42,
                                    height: 42,
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                }}
                            >
                                {chat.name ? chat.name.charAt(0).toUpperCase() : chat.id.split('@')[0].charAt(0)}
                            </Avatar>
                        </Badge>
                    </Tooltip>
                </ListItemAvatar>
                {!chatListCollapsed && (
                    <ListItemText
                        sx={{ my: 0, ml: 0.5 }}
                        primary={
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 0 }}>
                                    {chat.isGroup && <People sx={{ fontSize: 14, color: '#7c3aed', flexShrink: 0 }} />}
                                    <Typography variant="body2" noWrap sx={{
                                        fontWeight: chat.unreadCount ? 600 : 500,
                                        color: colors.text,
                                        fontSize: '0.875rem',
                                        lineHeight: 1.3
                                    }}>
                                        {chat.name || chat.id.split('@')[0]}
                                    </Typography>
                                    {chat.assigned_agent_name && (
                                        <Chip
                                            label={chat.assigned_agent_name}
                                            size="small"
                                            sx={{
                                                ml: 0.5,
                                                height: 16,
                                                fontSize: '0.6rem',
                                                bgcolor: `${colors.primary}20`,
                                                color: colors.primary,
                                                fontWeight: 600,
                                                '& .MuiChip-label': { px: 0.5 }
                                            }}
                                        />
                                    )}
                                </Box>
                                <Typography variant="caption" sx={{
                                    color: chat.unreadCount ? colors.primary : colors.textSecondary,
                                    fontWeight: chat.unreadCount ? 600 : 400,
                                    fontSize: '0.7rem',
                                    ml: 1,
                                    flexShrink: 0
                                }}>
                                    {chat.timestamp ? formatTime(chat.timestamp) : ''}
                                </Typography>
                            </Box>
                        }
                        secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2 }}>
                                {chat.lastMessage?.includes('📷 Imagen') && <ImageIcon sx={{ fontSize: 13, color: colors.textSecondary, flexShrink: 0 }} />}
                                {chat.lastMessage?.includes('🎥 Video') && <Videocam sx={{ fontSize: 13, color: colors.textSecondary, flexShrink: 0 }} />}
                                {chat.lastMessage?.includes('🔊 Audio') && <Mic sx={{ fontSize: 13, color: colors.textSecondary, flexShrink: 0 }} />}
                                <Typography
                                    variant="body2"
                                    noWrap
                                    sx={{
                                        color: typingStatus?.[chat.id] ? '#34d399' : colors.textSecondary,
                                        fontWeight: chat.unreadCount ? 500 : 400,
                                        fontStyle: typingStatus?.[chat.id] ? 'italic' : 'normal',
                                        fontSize: '0.8rem',
                                        lineHeight: 1.3,
                                        flex: 1
                                    }}
                                >
                                    {typingStatus?.[chat.id] || (
                                        <>
                                            {chat.lastMessageFromMe && <span style={{ color: colors.primary, fontWeight: 500, marginRight: '4px' }}>Tú:</span>}
                                            {chat.lastMessage || 'Toca para chatear'}
                                        </>
                                    )}
                                </Typography>
                                {chat.unreadCount > 0 && (
                                    <Box sx={{
                                        minWidth: 20,
                                        height: 20,
                                        borderRadius: 10,
                                        bgcolor: '#ef4444',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        <Typography sx={{ color: 'white', fontSize: '0.65rem', fontWeight: 700 }}>
                                            {chat.unreadCount}
                                        </Typography>
                                    </Box>
                                )}
                            </Box>
                        }
                    />
                )}
            </ListItemButton>
        </Tooltip>
    );
};
