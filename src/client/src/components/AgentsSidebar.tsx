import React, { useState } from 'react';
import {
    Box,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Avatar,
    Typography,
    Badge,
    Paper,
    Divider,
    Chip,
    IconButton,
    Tooltip
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useDrop } from 'react-dnd';
import { Person, Circle, ChevronLeft, ChevronRight } from '@mui/icons-material';

interface Agent {
    id: string | number;
    name: string;
    email: string;
    status: 'online' | 'offline' | 'busy' | 'away';
    role?: string;
    avatar_url?: string;
    active_chats_count?: number;
}

interface AgentsSidebarProps {
    agents: Agent[];
    onTransfer: (agentId: string, chatJid: string) => void;
    currentUserId: string | number | null;
    onAgentClick?: (agent: Agent) => void;
}

// Styled Badge for Status
const StyledBadge = styled(Badge)(({ theme }) => ({
    '& .MuiBadge-badge': {
        boxShadow: `0 0 0 2px #1e293b`, // Slate 800
        '&::after': {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            border: '1px solid currentColor',
            content: '""',
        },
    },
}));

const getStatusColor = (status: string) => {
    switch (status) {
        case 'online': return '#10b981'; // Green 500
        case 'busy': return '#ef4444';   // Red 500
        case 'away': return '#f59e0b';   // Amber 500
        default: return '#64748b';       // Slate 500
    }
};

// Draggable Drop Target Item for Agent
const AgentItem: React.FC<{
    agent: Agent;
    onDrop: (item: any) => void;
    isCurrentUser: boolean;
    onClick?: () => void;
    isMinimized: boolean;
}> = ({ agent, onDrop, isCurrentUser, onClick, isMinimized }) => {
    const [{ isOver, canDrop }, drop] = useDrop(() => ({
        accept: 'CHAT_ITEM',
        drop: (item: any) => onDrop(item),
        canDrop: () => !isCurrentUser && agent.status !== 'offline',
        collect: (monitor) => ({
            isOver: !!monitor.isOver(),
            canDrop: !!monitor.canDrop(),
        }),
    }));

    const dropRef = drop as unknown as (element: HTMLElement | null) => void;

    if (isCurrentUser) return null;

    const isActive = isOver && canDrop;

    return (
        <ListItem
            ref={dropRef}
            sx={{
                mb: 1,
                borderRadius: 2,
                bgcolor: isActive ? 'rgba(99, 102, 241, 0.15)' : '#1e293b', // Slate 800
                border: isActive ? '2px dashed #6366f1' : '1px solid rgba(255,255,255,0.05)',
                opacity: agent.status === 'offline' ? 0.5 : 1,
                transition: 'all 0.2s',
                cursor: canDrop ? 'pointer' : 'default',
                justifyContent: isMinimized ? 'center' : 'initial',
                px: isMinimized ? 1 : 2,
                '&:hover': {
                    bgcolor: canDrop ? 'rgba(99, 102, 241, 0.2)' : '#334155', // Slate 700
                    transform: canDrop ? 'scale(1.02)' : 'none'
                }
            }}
            onClick={onClick}
        >
            <ListItemAvatar sx={{ minWidth: isMinimized ? 'auto' : 56 }}>
                <StyledBadge
                    overlap="circular"
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    variant="dot"
                    sx={{
                        '& .MuiBadge-dot': {
                            backgroundColor: getStatusColor(agent.status)
                        }
                    }}
                >
                    <Avatar alt={agent.name} src={agent.avatar_url} sx={{ bgcolor: '#6366f1' }}>
                        {agent.name.charAt(0)}
                    </Avatar>
                </StyledBadge>
            </ListItemAvatar>
            {!isMinimized && (
                <ListItemText
                    primary={
                        <Typography variant="subtitle2" noWrap sx={{ color: '#f1f5f9' }}>
                            {agent.name}
                        </Typography>
                    }
                    secondary={
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Typography variant="caption" sx={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Circle sx={{ fontSize: 10, color: getStatusColor(agent.status) }} />
                                {agent.status === 'online' ? 'En línea' : agent.status}
                            </Typography>
                            {agent.active_chats_count !== undefined && (
                                <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                                    📥 {agent.active_chats_count} chats activos
                                </Typography>
                            )}
                        </Box>
                    }
                />
            )}
        </ListItem >
    );
};

export const AgentsSidebar: React.FC<AgentsSidebarProps> = ({ agents, onTransfer, currentUserId, onAgentClick }) => {
    const [isMinimized, setIsMinimized] = useState(true); // ✅ Minimizado por defecto
    const onlineAgents = agents.filter(a => a.status !== 'offline');
    const offlineAgents = agents.filter(a => a.status === 'offline');

    return (
        <Box sx={{
            width: isMinimized ? 80 : 280,
            borderLeft: '1px solid rgba(255,255,255,0.05)',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: '#0f172a', // Deep Slate
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
            {/* Header con botón minimizar */}
            <Box sx={{
                p: 2,
                bgcolor: '#1e293b', // Slate 800
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                {!isMinimized && (
                    <Box>
                        <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1, color: '#f1f5f9' }}>
                            <Person fontSize="small" /> Agentes Disponibles
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                            Arrastra un chat aquí para transferir
                        </Typography>
                    </Box>
                )}
                <Tooltip title={isMinimized ? "Expandir" : "Minimizar"} placement="left">
                    <IconButton
                        onClick={() => setIsMinimized(!isMinimized)}
                        sx={{
                            color: 'rgba(255,255,255,0.7)',
                            '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.05)' }
                        }}
                    >
                        {isMinimized ? <ChevronLeft /> : <ChevronRight />}
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Lista de agentes */}
            <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', p: 1 }}>
                {!isMinimized && (
                    <Typography variant="overline" sx={{ px: 2, color: '#94a3b8' }}>
                        En Línea ({onlineAgents.length})
                    </Typography>
                )}
                <List>
                    {onlineAgents.map(agent => (
                        <AgentItem
                            key={agent.id}
                            agent={agent}
                            isCurrentUser={String(agent.id) === String(currentUserId)}
                            onDrop={(item) => onTransfer(String(agent.id), item.chatJid)}
                            onClick={() => onAgentClick && onAgentClick(agent)}
                            isMinimized={isMinimized}
                        />
                    ))}
                    {onlineAgents.length === 0 && !isMinimized && (
                        <Typography variant="body2" sx={{ p: 2, textAlign: 'center', color: '#94a3b8' }}>
                            No hay agentes en línea
                        </Typography>
                    )}
                </List>

                {!isMinimized && <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.05)' }} />}

                {!isMinimized && (
                    <Typography variant="overline" sx={{ px: 2, color: '#94a3b8' }}>
                        Desconectados ({offlineAgents.length})
                    </Typography>
                )}
                <List>
                    {offlineAgents.map(agent => (
                        <AgentItem
                            key={agent.id}
                            agent={agent}
                            isCurrentUser={String(agent.id) === String(currentUserId)}
                            onDrop={() => { }} // Disabled
                            onClick={() => onAgentClick && onAgentClick(agent)}
                            isMinimized={isMinimized}
                        />
                    ))}
                </List>
            </Box>
        </Box>
    );
};
