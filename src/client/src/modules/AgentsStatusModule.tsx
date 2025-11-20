import React, { useState, useEffect } from 'react';
import { getAPIBaseURL } from '../utils/socketConfig';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Avatar,
  Chip,
  Badge,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  IconButton,
  Tooltip,
  Stack,
  Divider,
  Alert,
} from '@mui/material';
import {
  Person,
  Circle,
  SupervisorAccount,
  AdminPanelSettings,
  Refresh,
} from '@mui/icons-material';
import { io } from 'socket.io-client';
import { getSocketURL } from '../utils/socketConfig';

interface AgentsStatusModuleProps {
  sessionId: string;
  currentUser?: {
    id: number;
    name: string;
    role: string;
  };
}

interface OnlineAgent {
  userId: number;
  userName: string;
  role: string;
  connectedAt: string;
  socketId: string;
  status?: string;
  statusMessage?: string;
}

const AgentsStatusModule: React.FC<AgentsStatusModuleProps> = ({ sessionId, currentUser }) => {
  const [onlineAgents, setOnlineAgents] = useState<OnlineAgent[]>([]);
  const [socket, setSocket] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  useEffect(() => {
    // Conectar a Socket.IO
    const socketURL = getSocketURL();
    const newSocket = io(socketURL);
    setSocket(newSocket);

    // Si hay usuario actual, registrarse como agente en línea
    if (currentUser) {
      newSocket.emit('agent-online', {
        userId: currentUser.id,
        userName: currentUser.name,
        role: currentUser.role,
      });
    }

    // Escuchar actualizaciones de estado de agentes
    newSocket.on('agents-status-update', (agents: OnlineAgent[]) => {
      setOnlineAgents(agents);
      setLastUpdate(new Date().toLocaleTimeString());
    });

    // Cargar agentes en línea inicialmente
    loadOnlineAgents();

    return () => {
      newSocket.close();
    };
  }, [currentUser]);

  const loadOnlineAgents = async () => {
    
    try {
      const response = await fetch('${getAPIBaseURL()}/api/agents/online');
      const data = await response.json();
      if (data.success) {
        setOnlineAgents(data.agents);
        setLastUpdate(new Date().toLocaleTimeString());
      }
    } catch (error) {
      console.error('Error cargando agentes en línea:', error);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <AdminPanelSettings />;
      case 'supervisor':
        return <SupervisorAccount />;
      default:
        return <Person />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'error';
      case 'supervisor':
        return 'warning';
      default:
        return 'info';
    }
  };

  const getTimeConnected = (connectedAt: string) => {
    const now = new Date();
    const connected = new Date(connectedAt);
    const diff = now.getTime() - connected.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const agentsByRole = {
    admin: onlineAgents.filter(a => a.role === 'admin'),
    supervisor: onlineAgents.filter(a => a.role === 'supervisor'),
    agent: onlineAgents.filter(a => a.role === 'agent'),
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: '#1a1a1a' }}>
            Estado de Agentes
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Monitoreo en tiempo real de agentes conectados
          </Typography>
        </Box>
        <Tooltip title="Actualizar">
          <IconButton onClick={loadOnlineAgents} color="primary">
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Resumen de agentes */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: '#f3e5f5', borderLeft: '4px solid #9c27b0' }}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ bgcolor: '#9c27b0', width: 56, height: 56 }}>
                  <Person sx={{ fontSize: 32 }} />
                </Avatar>
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 700, color: '#9c27b0' }}>
                    {onlineAgents.length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total en línea
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: '#fff3e0', borderLeft: '4px solid #ff9800' }}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ bgcolor: '#ff9800', width: 56, height: 56 }}>
                  <SupervisorAccount sx={{ fontSize: 32 }} />
                </Avatar>
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 700, color: '#ff9800' }}>
                    {agentsByRole.supervisor.length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Supervisores
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: '#e3f2fd', borderLeft: '4px solid #2196f3' }}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ bgcolor: '#2196f3', width: 56, height: 56 }}>
                  <Person sx={{ fontSize: 32 }} />
                </Avatar>
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 700, color: '#2196f3' }}>
                    {agentsByRole.agent.length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Agentes
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {lastUpdate && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Última actualización: {lastUpdate}
        </Alert>
      )}

      {/* Lista de agentes por rol */}
      <Grid container spacing={3}>
        {/* Administradores */}
        {agentsByRole.admin.length > 0 && (
          <Grid item xs={12} md={6} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AdminPanelSettings color="error" />
                  Administradores ({agentsByRole.admin.length})
                </Typography>
                <Divider sx={{ my: 2 }} />
                <List>
                  {agentsByRole.admin.map((agent) => (
                    <ListItem key={agent.socketId}>
                      <ListItemAvatar>
                        <Badge
                          overlap="circular"
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                          badgeContent={
                            <Circle sx={{ fontSize: 12, color: '#4caf50' }} />
                          }
                        >
                          <Avatar sx={{ bgcolor: '#f44336' }}>
                            {getRoleIcon(agent.role)}
                          </Avatar>
                        </Badge>
                      </ListItemAvatar>
                      <ListItemText
                        primary={agent.userName}
                        secondary={`En línea: ${getTimeConnected(agent.connectedAt)}`}
                      />
                      <Chip
                        label={agent.role}
                        color={getRoleColor(agent.role) as any}
                        size="small"
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Supervisores */}
        {agentsByRole.supervisor.length > 0 && (
          <Grid item xs={12} md={6} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SupervisorAccount color="warning" />
                  Supervisores ({agentsByRole.supervisor.length})
                </Typography>
                <Divider sx={{ my: 2 }} />
                <List>
                  {agentsByRole.supervisor.map((agent) => (
                    <ListItem key={agent.socketId}>
                      <ListItemAvatar>
                        <Badge
                          overlap="circular"
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                          badgeContent={
                            <Circle sx={{ fontSize: 12, color: '#4caf50' }} />
                          }
                        >
                          <Avatar sx={{ bgcolor: '#ff9800' }}>
                            {getRoleIcon(agent.role)}
                          </Avatar>
                        </Badge>
                      </ListItemAvatar>
                      <ListItemText
                        primary={agent.userName}
                        secondary={`En línea: ${getTimeConnected(agent.connectedAt)}`}
                      />
                      <Chip
                        label={agent.role}
                        color={getRoleColor(agent.role) as any}
                        size="small"
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Agentes */}
        {agentsByRole.agent.length > 0 && (
          <Grid item xs={12} md={12} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Person color="info" />
                  Agentes ({agentsByRole.agent.length})
                </Typography>
                <Divider sx={{ my: 2 }} />
                <List>
                  {agentsByRole.agent.map((agent) => (
                    <ListItem key={agent.socketId}>
                      <ListItemAvatar>
                        <Badge
                          overlap="circular"
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                          badgeContent={
                            <Circle sx={{ fontSize: 12, color: '#4caf50' }} />
                          }
                        >
                          <Avatar sx={{ bgcolor: '#2196f3' }}>
                            {getRoleIcon(agent.role)}
                          </Avatar>
                        </Badge>
                      </ListItemAvatar>
                      <ListItemText
                        primary={agent.userName}
                        secondary={`En línea: ${getTimeConnected(agent.connectedAt)}`}
                      />
                      <Chip
                        label={agent.role}
                        color={getRoleColor(agent.role) as any}
                        size="small"
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {onlineAgents.length === 0 && (
        <Card sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="h6" color="textSecondary" gutterBottom>
            No hay agentes en línea
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Los agentes aparecerán aquí cuando se conecten al sistema
          </Typography>
        </Card>
      )}
    </Box>
  );
};

export default AgentsStatusModule;
