import React, { useState } from 'react';
import { Box, Fab, Tooltip, Zoom, keyframes } from '@mui/material';
import { Telegram } from '@mui/icons-material';

// Animación de pulso
const pulse = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(0, 136, 204, 0.7);
  }
  70% {
    box-shadow: 0 0 0 15px rgba(0, 136, 204, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(0, 136, 204, 0);
  }
`;

const FloatingWhatsAppButton: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);

  const handleClick = () => {
    // Abrir contacto (mantener wa.me si es el canal de soporte, o cambiar si el usuario indica telegram link. Asumimos mantener link pero cambiar UI por ahora)
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
          title="¿Necesitas ayuda? Escríbenos"
          placement="left"
          arrow
        >
          <Fab
            onClick={handleClick}
            sx={{
              width: 64,
              height: 64,
              background: 'linear-gradient(135deg, #0088cc 0%, #00a2ff 100%)', // Telegram Blue
              color: 'white',
              boxShadow: '0 6px 20px rgba(0, 136, 204, 0.4)',
              animation: `${pulse} 2s infinite`,
              transition: 'all 0.3s ease',
              '&:hover': {
                background: 'linear-gradient(135deg, #0077b5 0%, #0095e8 100%)',
                transform: 'scale(1.1)',
                boxShadow: '0 8px 30px rgba(0, 136, 204, 0.6)',
              },
              '&:active': {
                transform: 'scale(0.95)',
              },
            }}
          >
            <Telegram sx={{ fontSize: 36 }} />
          </Fab>
        </Tooltip>
      </Box>
    </Zoom>
  );
};

export default FloatingWhatsAppButton;
