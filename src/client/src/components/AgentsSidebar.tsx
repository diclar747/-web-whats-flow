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
    Chip
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useDrop } from 'react-dnd';
import { Person, Circle } from '@mui/icons-material';

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
        boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
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
        case 'online': return 'success';
        case 'busy': return 'error';
        case 'away': return 'warning';
        default: return 'default'; // gray
    }
};

// Draggable Drop Target Item for Agent
const AgentItem: React.FC<{
    agent: Agent;
    onDrop: (item: any) => void;
    isCurrentUser: boolean;
    onClick?: () => void;
}> = ({ agent, onDrop, isCurrentUser, onClick }) => {
    const [{ isOver, canDrop }, drop] = useDrop(() => ({
        accept: 'CHAT_ITEM',
        drop: (item: any) => onDrop(item),
        canDrop: () => !isCurrentUser && agent.status !== 'offline', // Cannot transfer to self or offline
        collect: (monitor) => ({
            isOver: !!monitor.isOver(),
            canDrop: !!monitor.canDrop(),
        }),
    }));

    // Attach ref to element
    // useDrop returns a connector function which must be used
    // We cast to any to avoid complex RefObject typing issues with MUI components
    const dropRef = drop as unknown as (element: HTMLElement | null) => void;

    if (isCurrentUser) return null; // Hide self? Or show as "You" disabled. Let's show as disabled.

    const isActive = isOver && canDrop;

    return (
        <ListItem
            ref={dropRef}
            sx={{
                mb: 1,
                borderRadius: 2,
                bgcolor: isActive ? 'action.hover' : 'background.paper',
                border: isActive ? '2px dashed primary.main' : '1px solid transparent',
                opacity: agent.status === 'offline' ? 0.6 : 1,
                transition: 'all 0.2s',
                cursor: canDrop ? 'pointer' : 'default',
                '&:hover': {
                    bgcolor: canDrop ? 'action.selected' : 'background.paper',
                    transform: canDrop ? 'scale(1.02)' : 'none'
                }
            }}
            onClick={onClick}
        >
            <ListItemAvatar>
                <StyledBadge
                    overlap="circular"
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    variant="dot"
                    color={getStatusColor(agent.status) as any}
                >
                    <Avatar alt={agent.name} src={agent.avatar_url}>
                        {agent.name.charAt(0)}
                    </Avatar>
                </StyledBadge>
            </ListItemAvatar>
            <ListItemText
                primary={
                    <Typography variant="subtitle2" noWrap>
                        {agent.name}
                    </Typography>
                }
                secondary={
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                            <Circle sx={{ fontSize: 10, color: `${getStatusColor(agent.status)}.main` }} />
                            {agent.status === 'online' ? 'En línea' : agent.status}
                        </Typography>
                        {agent.active_chats_count !== undefined && (
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                                📥 {agent.active_chats_count} chats activos
                            </Typography>
                        )}
                    </Box>
                }
            />
        </ListItem >
    );
};

export const AgentsSidebar: React.FC<AgentsSidebarProps> = ({ agents, onTransfer, currentUserId, onAgentClick }) => {
    const onlineAgents = agents.filter(a => a.status !== 'offline');
    const offlineAgents = agents.filter(a => a.status === 'offline');

    return (
        <Box sx={{ width: 280, borderLeft: '1px solid', borderColor: 'divider', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
            <Box sx={{ p: 2, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Person fontSize="small" /> Agentes Disponibles
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    Arrastra un chat aquí para transferir
                </Typography>
            </Box>

            <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
                <List subheader={<Typography variant="overline" sx={{ px: 2 }}>En Línea ({onlineAgents.length})</Typography>}>
                    {onlineAgents.map(agent => (
                        <AgentItem
                            key={agent.id}
                            agent={agent}
                            isCurrentUser={String(agent.id) === String(currentUserId)}
                            onDrop={(item) => onTransfer(String(agent.id), item.chatJid)}
                            onClick={() => onAgentClick && onAgentClick(agent)}
                        />
                    ))}
                    {onlineAgents.length === 0 && (
                        <Typography variant="body2" sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                            No hay agentes en línea
                        </Typography>
                    )}
                </List>

                <Divider sx={{ my: 1 }} />

                <List subheader={<Typography variant="overline" sx={{ px: 2 }}>Desconectados ({offlineAgents.length})</Typography>}>
                    {offlineAgents.map(agent => (
                        <AgentItem
                            key={agent.id}
                            agent={agent}
                            isCurrentUser={String(agent.id) === String(currentUserId)}
                            onDrop={() => { }} // Disabled
                            onClick={() => onAgentClick && onAgentClick(agent)}
                        />
                    ))}
                </List>
            </Box>
        </Box>
    );
};
