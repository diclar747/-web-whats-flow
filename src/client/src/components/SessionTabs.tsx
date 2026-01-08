import React from 'react';
import { Tabs, Tab, Box, Badge, Chip, Tooltip } from '@mui/material';
import { CheckCircle, Warning, Star } from '@mui/icons-material';

export interface SessionTab {
  sessionId: string;
  phoneNumber: string;
  isPrimary: boolean;
  name?: string;
  isActive: boolean;
  unreadCount?: number;
}

interface SessionTabsProps {
  sessions: SessionTab[];
  activeSessionId: string;
  onSessionChange: (sessionId: string) => void;
  isDarkMode?: boolean;
}

const SessionTabs: React.FC<SessionTabsProps> = ({ 
  sessions, 
  activeSessionId, 
  onSessionChange,
  isDarkMode = false 
}) => {
  // Si solo hay una sesión, no mostrar tabs
  if (sessions.length <= 1) {
    return null;
  }

  return (
    <Box sx={{ 
      borderBottom: 1, 
      borderColor: isDarkMode ? '#303d45' : 'divider',
      backgroundColor: isDarkMode ? '#202c33' : '#f0f2f5',
      px: 2
    }}>
      <Tabs 
        value={activeSessionId} 
        onChange={(e, value) => onSessionChange(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          '& .MuiTab-root': {
            minHeight: 48,
            textTransform: 'none',
            color: isDarkMode ? '#aebac1' : '#667781',
            '&.Mui-selected': {
              color: '#00a884'
            }
          },
          '& .MuiTabs-indicator': {
            backgroundColor: '#00a884',
            height: 3
          }
        }}
      >
        {sessions.map((session) => (
          <Tab
            key={session.sessionId}
            value={session.sessionId}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {/* Icono principal */}
                {session.isPrimary ? (
                  <Tooltip title="Número Principal">
                    <Star sx={{ fontSize: 18, color: '#FFD700' }} />
                  </Tooltip>
                ) : (
                  <Tooltip title="Número Adicional">
                    <span style={{ fontSize: 18 }}>📱</span>
                  </Tooltip>
                )}

                {/* Número de teléfono */}
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  {session.name || session.phoneNumber}
                </span>

                {/* Badge de mensajes no leídos */}
                {session.unreadCount && session.unreadCount > 0 && (
                  <Badge 
                    badgeContent={session.unreadCount > 99 ? '99+' : session.unreadCount}
                    color="error"
                    sx={{ ml: 1 }}
                  />
                )}

                {/* Indicador de estado */}
                {session.isActive ? (
                  <Tooltip title="Conectado">
                    <CheckCircle sx={{ fontSize: 16, color: '#00a884' }} />
                  </Tooltip>
                ) : (
                  <Tooltip title="Desconectado">
                    <Warning sx={{ fontSize: 16, color: '#f44336' }} />
                  </Tooltip>
                )}
              </Box>
            }
          />
        ))}
      </Tabs>
    </Box>
  );
};

export default SessionTabs;
