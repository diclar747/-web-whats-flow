import React from 'react';
import { Snackbar, Alert, AlertColor, Box, Typography, IconButton } from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';

interface CustomSnackbarProps {
  open: boolean;
  message: string;
  severity?: AlertColor;
  onClose: () => void;
  autoHideDuration?: number;
  icon?: React.ReactNode;
}

const CustomSnackbar: React.FC<CustomSnackbarProps> = ({
  open,
  message,
  severity = 'success',
  onClose,
  autoHideDuration = 4000,
  icon
}) => {
  const getIcon = () => {
    if (icon) return icon;

    switch (severity) {
      case 'success':
        return <SuccessIcon sx={{ fontSize: 24 }} />;
      case 'error':
        return <ErrorIcon sx={{ fontSize: 24 }} />;
      case 'warning':
        return <WarningIcon sx={{ fontSize: 24 }} />;
      case 'info':
        return <InfoIcon sx={{ fontSize: 24 }} />;
      default:
        return <SuccessIcon sx={{ fontSize: 24 }} />;
    }
  };

  const getColor = () => {
    switch (severity) {
      case 'success':
        return {
          bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          text: '#fff'
        };
      case 'error':
        return {
          bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          text: '#fff'
        };
      case 'warning':
        return {
          bg: 'linear-gradient(135deg, #fbc2eb 0%, #f6ad55 100%)',
          text: '#fff'
        };
      case 'info':
        return {
          bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          text: '#fff'
        };
      default:
        return {
          bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          text: '#fff'
        };
    }
  };

  const colors = getColor();

  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      sx={{ mt: 8 }}
    >
      <Box
        sx={{
          minWidth: 300,
          maxWidth: 500,
          background: colors.bg,
          borderRadius: 2,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
          backdropFilter: 'blur(10px)',
          padding: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          animation: 'slideInRight 0.3s ease-out',
          '@keyframes slideInRight': {
            from: {
              transform: 'translateX(100%)',
              opacity: 0
            },
            to: {
              transform: 'translateX(0)',
              opacity: 1
            }
          }
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: '50%',
            bgcolor: 'rgba(255, 255, 255, 0.2)',
            color: colors.text
          }}
        >
          {getIcon()}
        </Box>

        <Box sx={{ flex: 1 }}>
          <Typography
            variant="body1"
            sx={{
              color: colors.text,
              fontWeight: 600,
              fontSize: '0.95rem',
              lineHeight: 1.5
            }}
          >
            {message}
          </Typography>
        </Box>

        <IconButton
          size="small"
          onClick={onClose}
          sx={{
            color: colors.text,
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.1)'
            }
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </Snackbar>
  );
};

export default CustomSnackbar;
