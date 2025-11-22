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
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ mt: 2 }}
    >
      <Box
        sx={{
          minWidth: 320,
          maxWidth: 600,
          background: colors.bg,
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
          backdropFilter: 'blur(10px)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          animation: 'slideInDown 0.3s ease-out',
          '@keyframes slideInDown': {
            from: {
              transform: 'translateY(-100%)',
              opacity: 0
            },
            to: {
              transform: 'translateY(0)',
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
