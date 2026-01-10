import React, { useState } from 'react';
import { Box, Fab, Tooltip, Zoom, keyframes } from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

// Animación de pulso (Verde WhatsApp)
const pulse = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.7);
  }
  70% {
    box-shadow: 0 0 0 15px rgba(37, 211, 102, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(37, 211, 102, 0);
  }
`;

const FloatingWhatsAppButton: React.FC = () => {
  const [isVisible] = useState(true);

  const handleClick = () => {
    window.open('https://wa.me/595994854167', '_blank', 'noopener,noreferrer');
  };

  return (
    <Zoom in={isVisible}>
      <Box
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
        }}
      >
        <Tooltip
          title="¿Necesitas ayuda? Escríbenos por WhatsApp"
          placement="left"
          arrow
        >
          <Fab
            onClick={handleClick}
            sx={{
              width: 64,
              height: 64,
              backgroundColor: '#25D366', // Verde WhatsApp Oficial
              color: 'white',
              boxShadow: '0 6px 20px rgba(37, 211, 102, 0.4)',
              animation: `${pulse} 2s infinite`,
              transition: 'all 0.3s ease',
              '&:hover': {
                backgroundColor: '#128C7E',
                transform: 'scale(1.1)',
                boxShadow: '0 8px 30px rgba(37, 211, 102, 0.6)',
              },
              '&:active': {
                transform: 'scale(0.95)',
              },
            }}
          >
            <WhatsAppIcon sx={{ fontSize: 36, color: 'white' }} />
          </Fab>
        </Tooltip>
      </Box>
    </Zoom>
  );
};

export default FloatingWhatsAppButton;
