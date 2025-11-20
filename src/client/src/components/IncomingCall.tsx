import React from 'react';
import { Box, Typography, Button, Avatar } from '@mui/material';
import { Phone as PhoneIcon, Videocam as VideocamIcon } from '@mui/icons-material';

const IncomingCall: React.FC = () => {
  // Componente placeholder para llamadas entrantes
  // Por ahora no implementado completamente - solo muestra un indicador visual
  return null;

  // Código comentado para futura implementación:
  /*
  const { activeCall, rejectCall } = useWhatsApp();

  if (!activeCall) {
    return null;
  }

  const handleReject = () => {
    rejectCall(activeCall.id);
  };

  const handleAccept = () => {
    // For now, just closes the notification
    rejectCall(activeCall.id);
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 20,
        right: 20,
        p: 2,
        bgcolor: 'background.paper',
        borderRadius: 2,
        boxShadow: 8,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        gap: 2
      }}
    >
      <Avatar sx={{ bgcolor: 'primary.main' }}>
        {activeCall.isVideo ? <VideocamIcon /> : <PhoneIcon />}
      </Avatar>
      <Box>
        <Typography variant="subtitle1">Llamada entrante...</Typography>
        <Typography variant="body2">de {activeCall.from.split('@')[0]}</Typography>
      </Box>
      <Box>
        <Button variant="contained" color="success" onClick={handleAccept} sx={{ mr: 1 }}>
          Aceptar
        </Button>
        <Button variant="contained" color="error" onClick={handleReject}>
          Rechazar
        </Button>
      </Box>
    </Box>
  );
  */
};

export default IncomingCall;
