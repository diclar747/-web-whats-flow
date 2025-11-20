import React from 'react';
import { Snackbar, Alert, AlertTitle, Slide, SlideProps } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';

function SlideTransition(props: SlideProps) {
  return <Slide {...props} direction="down" />;
}

interface ModernNotificationProps {
  open: boolean;
  onClose: () => void;
  message: string;
  title?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

const ModernNotification: React.FC<ModernNotificationProps> = ({
  open,
  onClose,
  message,
  title,
  type = 'success',
  duration = 4000
}) => {
  const getIcon = () => {
    const iconStyle = { fontSize: 24 };
    switch (type) {
      case 'success':
        return <CheckCircleIcon sx={iconStyle} />;
      case 'error':
        return <ErrorIcon sx={iconStyle} />;
      case 'warning':
        return <WarningIcon sx={iconStyle} />;
      case 'info':
      default:
        return <InfoIcon sx={iconStyle} />;
    }
  };

  return (
    <Snackbar
      open={open}
      autoHideDuration={duration}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      TransitionComponent={SlideTransition}
      sx={{
        top: '24px !important',
      }}
    >
      <Alert
        onClose={onClose}
        severity={type}
        icon={getIcon()}
        variant="filled"
        sx={{
          width: '100%',
          minWidth: 350,
          borderRadius: 2,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
          fontSize: '1rem',
          alignItems: 'center',
          '& .MuiAlert-icon': {
            fontSize: 28,
            marginRight: 1.5
          },
          '& .MuiAlert-message': {
            padding: '6px 0',
            width: '100%'
          },
          '& .MuiAlert-action': {
            paddingTop: '4px'
          },
          background: type === 'success' ? 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)' :
                     type === 'error' ? 'linear-gradient(135deg, #F44336 0%, #e53935 100%)' :
                     type === 'warning' ? 'linear-gradient(135deg, #FF9800 0%, #fb8c00 100%)' :
                     'linear-gradient(135deg, #2196F3 0%, #1976d2 100%)',
        }}
      >
        {title && (
          <AlertTitle sx={{ 
            fontWeight: 700, 
            fontSize: '1.1rem',
            marginBottom: 0.5
          }}>
            {title}
          </AlertTitle>
        )}
        {message}
      </Alert>
    </Snackbar>
  );
};

export default ModernNotification;
