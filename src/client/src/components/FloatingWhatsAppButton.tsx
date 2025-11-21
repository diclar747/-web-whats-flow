import React, { useState } from 'react';
import { Box, Fab, Tooltip, Zoom, keyframes } from '@mui/material';
import { WhatsApp } from '@mui/icons-material';

// Animación de pulso
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
  const [isVisible, setIsVisible] = useState(true);

  const handleClick = () => {
    // Abrir WhatsApp en nueva pestaña
    window.open('https://wa.me/595994854167', '_blank', 'noopener,noreferrer');
  };

  if (!isVisible) return null;

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
              background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
              color: 'white',
              boxShadow: '0 6px 20px rgba(37, 211, 102, 0.4)',
              animation: `${pulse} 2s infinite`,
              transition: 'all 0.3s ease',
              '&:hover': {
                background: 'linear-gradient(135deg, #20BA5A 0%, #0E7A6E 100%)',
                transform: 'scale(1.1)',
                boxShadow: '0 8px 30px rgba(37, 211, 102, 0.6)',
              },
              '&:active': {
                transform: 'scale(0.95)',
              },
            }}
          >
            <WhatsApp sx={{ fontSize: 36 }} />
          </Fab>
        </Tooltip>
      </Box>
    </Zoom>
  );
};

export default FloatingWhatsAppButton;
