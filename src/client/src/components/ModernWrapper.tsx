import React from 'react';
import { Box, styled } from '@mui/material';

// Wrapper con estilos modernos aplicados globalmente
const ModernBox = styled(Box)(({ theme }) => ({
  // Aplicar estilos modernos a todos los hijos
  '& .MuiPaper-root': {
    borderRadius: 16,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: theme.palette.mode === 'dark' 
      ? '0 4px 16px rgba(0, 0, 0, 0.3)'
      : '0 2px 8px rgba(0, 0, 0, 0.04)',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: theme.palette.mode === 'dark'
        ? '0 8px 24px rgba(0, 0, 0, 0.4)'
        : '0 4px 16px rgba(0, 0, 0, 0.08)',
    },
  },
  
  '& .MuiCard-root': {
    borderRadius: 16,
    backdropFilter: 'blur(20px)',
    border: theme.palette.mode === 'dark'
      ? '1px solid rgba(255, 255, 255, 0.1)'
      : '1px solid rgba(0, 0, 0, 0.05)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: theme.palette.mode === 'dark'
        ? '0 12px 32px rgba(0, 0, 0, 0.5)'
        : '0 8px 24px rgba(0, 0, 0, 0.12)',
    },
  },

  '& .MuiButton-root': {
    borderRadius: 12,
    textTransform: 'none',
    fontWeight: 500,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
      transform: 'translateY(-2px)',
    },
  },

  '& .MuiButton-contained': {
    background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
    boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)',
    '&:hover': {
      background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
      filter: 'brightness(1.1)',
      boxShadow: '0 6px 16px rgba(37, 211, 102, 0.4)',
    },
  },

  '& .MuiChip-root': {
    borderRadius: 8,
    fontWeight: 500,
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
      transform: 'scale(1.05)',
    },
  },

  '& .MuiAvatar-root': {
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
      transform: 'scale(1.1)',
      boxShadow: '0 0 0 3px rgba(37, 211, 102, 0.3)',
    },
  },

  '& .MuiListItemButton-root': {
    borderRadius: 12,
    marginBottom: 4,
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
      transform: 'translateX(4px)',
      backgroundColor: 'rgba(37, 211, 102, 0.08)',
    },
    '&.Mui-selected': {
      backgroundColor: 'rgba(37, 211, 102, 0.12)',
      borderLeft: '4px solid #25D366',
      '&:hover': {
        backgroundColor: 'rgba(37, 211, 102, 0.15)',
      },
    },
  },

  '& .MuiTextField-root': {
    '& .MuiOutlinedInput-root': {
      borderRadius: 12,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      '&:hover': {
        transform: 'translateY(-1px)',
      },
      '&.Mui-focused': {
        boxShadow: '0 4px 12px rgba(37, 211, 102, 0.2)',
      },
    },
  },

  '& .MuiAppBar-root': {
    backdropFilter: 'blur(20px) saturate(180%)',
    backgroundColor: theme.palette.mode === 'dark'
      ? 'rgba(32, 44, 51, 0.8)'
      : 'rgba(255, 255, 255, 0.8)',
    borderBottom: theme.palette.mode === 'dark'
      ? '1px solid rgba(255, 255, 255, 0.08)'
      : '1px solid rgba(0, 0, 0, 0.05)',
  },

  '& .MuiDrawer-paper': {
    backdropFilter: 'blur(20px) saturate(180%)',
    backgroundColor: theme.palette.mode === 'dark'
      ? 'rgba(32, 44, 51, 0.95)'
      : 'rgba(255, 255, 255, 0.95)',
    borderRight: theme.palette.mode === 'dark'
      ? '1px solid rgba(255, 255, 255, 0.08)'
      : '1px solid rgba(0, 0, 0, 0.05)',
  },

  '& .MuiTableContainer-root': {
    borderRadius: 16,
    '& .MuiTableHead-root': {
      '& .MuiTableCell-root': {
        fontWeight: 600,
        backgroundColor: theme.palette.mode === 'dark'
          ? 'rgba(37, 211, 102, 0.1)'
          : 'rgba(37, 211, 102, 0.05)',
      },
    },
    '& .MuiTableRow-root': {
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      '&:hover': {
        backgroundColor: theme.palette.mode === 'dark'
          ? 'rgba(255, 255, 255, 0.05)'
          : 'rgba(0, 0, 0, 0.02)',
        transform: 'scale(1.001)',
      },
    },
  },

  '& .MuiDialog-paper': {
    borderRadius: 16,
    backdropFilter: 'blur(20px)',
  },

  '& .MuiBadge-badge': {
    animation: 'pulse 2s ease-in-out infinite',
    boxShadow: '0 0 0 2px rgba(37, 211, 102, 0.3)',
  },

  // Scroll suave
  scrollBehavior: 'smooth',
  
  // Transiciones para todo
  '& *': {
    transition: 'background-color 0.3s ease, color 0.3s ease',
  },
}));

interface ModernWrapperProps {
  children: React.ReactNode;
}

const ModernWrapper: React.FC<ModernWrapperProps> = ({ children }) => {
  return (
    <ModernBox sx={{ width: '100%', height: '100%' }}>
      {children}
    </ModernBox>
  );
};

export default ModernWrapper;
