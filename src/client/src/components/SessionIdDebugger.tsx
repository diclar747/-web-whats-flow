import React, { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Button, Box, Alert } from '@mui/material';
import { getAPIBaseURL } from '../utils/socketConfig';

interface SessionIdDebuggerProps {
  sessionId: string;
}

const SessionIdDebugger: React.FC<SessionIdDebuggerProps> = ({ sessionId }) => {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkSessionId = async () => {
    setLoading(true);
    try {
      const API_BASE = getAPIBaseURL();
      console.log('🔍 Debug: SessionId recibido:', sessionId);

      // Verificar sessionId en localStorage
      const localStorageSessionId = sessionStorage.getItem('whinsap_session');
      console.log('🔍 Debug: SessionId en localStorage:', localStorageSessionId);

      // Primero intentar con el sessionId recibido
      let activeSessionId = sessionId;
      let sessionResponse = await fetch(`${API_BASE}/api/session/${sessionId}/status`);
      let sessionData = await sessionResponse.json();

      // Si la sesión recibida no está activa, intentar con la de localStorage
      if (!sessionData.success || !sessionData.isConnected) {
        if (localStorageSessionId && localStorageSessionId !== sessionId) {
          console.log('🔄 Probando con sessionId de localStorage:', localStorageSessionId);
          sessionResponse = await fetch(`${API_BASE}/api/session/${localStorageSessionId}/status`);
          sessionData = await sessionResponse.json();

          if (sessionData.success && sessionData.isConnected) {
            activeSessionId = localStorageSessionId;
            console.log('✅ Usando sessionId de localStorage:', activeSessionId);
          }
        }
      }

      console.log('🔍 Debug: Estado de sesión:', sessionData);

      // Verificar contactos con el sessionId activo
      const contactsResponse = await fetch(`${API_BASE}/api/contacts/${activeSessionId}`);
      const contactsData = await contactsResponse.json();
      console.log('🔍 Debug: Contactos:', contactsData);

      // Verificar historial con el sessionId activo
      const historyResponse = await fetch(`${API_BASE}/api/history/messages?sessionId=${activeSessionId}&limit=3`);
      const historyData = await historyResponse.json();
      console.log('🔍 Debug: Historial:', historyData);

      setDebugInfo({
        receivedSessionId: sessionId,
        localStorageSessionId: localStorageSessionId,
        activeSessionId: activeSessionId,
        sessionStatus: sessionData,
        contactsCount: contactsData.contacts?.length || 0,
        messagesCount: historyData.messages?.length || 0,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error en debug:', error);
      setDebugInfo({
        error: error instanceof Error ? error.message : String(error),
        receivedSessionId: sessionId,
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSessionId();
  }, [sessionId]);

  const fixSessionId = () => {
    // Usar el sessionId correcto de localStorage
    const correctSessionId = sessionStorage.getItem('whinsap_session');
    if (correctSessionId && correctSessionId !== sessionId) {
      console.log('🔧 SessionId correcto detectado:', correctSessionId);
      console.log('⚠️ Considera actualizar el estado sin recargar la página');
      // NO RECARGAR - el sistema debe funcionar en tiempo real
    } else if (debugInfo?.activeSessionId && debugInfo.activeSessionId !== sessionId) {
      console.log('🔧 SessionId activo detectado:', debugInfo.activeSessionId);
      sessionStorage.setItem('whinsap_session', debugInfo.activeSessionId);
      // NO RECARGAR - el sistema debe funcionar en tiempo real
    }
  };

  if (!debugInfo) {
    return (
      <Card sx={{ m: 2, border: '2px solid #2196f3' }}>
        <CardContent>
          <Typography variant="h6" sx={{ color: '#2196f3' }}>
            🔍 Cargando diagnóstico...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ m: 2, border: '2px solid #ff9800' }}>
      <CardContent>
        <Typography variant="h6" sx={{ color: '#ff9800', mb: 2 }}>
          🔧 DEBUGGER - Información de SessionId
        </Typography>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>SessionId recibido:</strong> {debugInfo.receivedSessionId || 'No definido'}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>SessionId en localStorage:</strong> {debugInfo.localStorageSessionId || 'No definido'}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Estado de sesión:</strong> {debugInfo.sessionStatus?.success ? 'Activa' : 'Inactiva'}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Contactos encontrados:</strong> {debugInfo.contactsCount}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Mensajes encontrados:</strong> {debugInfo.messagesCount}
          </Typography>
        </Box>

        {debugInfo.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Error: {debugInfo.error}
          </Alert>
        )}

        {debugInfo.receivedSessionId !== debugInfo.localStorageSessionId && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            ⚠️ El sessionId recibido ({debugInfo.receivedSessionId}) es diferente al de localStorage ({debugInfo.localStorageSessionId})
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            size="small"
            onClick={checkSessionId}
            disabled={loading}
          >
            {loading ? 'Verificando...' : 'Verificar'}
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={fixSessionId}
          >
            Aplicar SessionId Correcto
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              console.log('Información completa de debug:', debugInfo);
              navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
              alert('Debug info copiado al portapapeles');
            }}
          >
            Copiar Debug Info
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default SessionIdDebugger;