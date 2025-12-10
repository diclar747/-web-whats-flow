import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Slide
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Close as CloseIcon
} from '@mui/icons-material';

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="down" ref={ref} {...props} />;
});

interface ModernAlertProps {
  open: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info' | 'confirm';
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'error' | 'warning' | 'success';
}

const ModernAlert: React.FC<ModernAlertProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  type = 'info',
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  confirmColor = 'primary'
}) => {
  const getIcon = () => {
    const iconStyle = {
      fontSize: 56,
      mb: 2
    };

    switch (type) {
      case 'success':
        return <CheckCircleIcon sx={{ ...iconStyle, color: '#10b981' }} />; // Green 500
      case 'error':
        return <ErrorIcon sx={{ ...iconStyle, color: '#ef4444' }} />; // Red 500
      case 'warning':
      case 'confirm':
        return <WarningIcon sx={{ ...iconStyle, color: '#f59e0b' }} />; // Amber 500
      case 'info':
      default:
        return <InfoIcon sx={{ ...iconStyle, color: '#6366f1' }} />; // Indigo 500
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return 'rgba(16, 185, 129, 0.1)'; // Green with transparency
      case 'error':
        return 'rgba(239, 68, 68, 0.1)'; // Red with transparency
      case 'warning':
      case 'confirm':
        return 'rgba(245, 158, 11, 0.1)'; // Amber with transparency
      case 'info':
      default:
        return 'rgba(99, 102, 241, 0.1)'; // Indigo with transparency
    }
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      TransitionComponent={Transition}
      keepMounted
      onClose={onClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      sx={{
        zIndex: 1600
      }}
      PaperProps={{
        sx: {
          borderRadius: 3,
          minWidth: 400,
          maxWidth: 500,
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', // Slate 800 to Deep Slate
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(255,255,255,0.1)'
        }
      }}
    >
      <IconButton
        aria-label="close"
        onClick={onClose}
        sx={{
          position: 'absolute',
          right: 8,
          top: 8,
          color: 'rgba(255,255,255,0.5)',
          '&:hover': {
            color: 'white',
            bgcolor: 'rgba(255,255,255,0.1)'
          }
        }}
      >
        <CloseIcon />
      </IconButton>

      <DialogTitle sx={{ pt: 4, pb: 1, textAlign: 'center' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {getIcon()}
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              fontSize: '1.25rem',
              color: '#f1f5f9' // Slate 100
            }}
          >
            {title}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box
          sx={{
            backgroundColor: getBackgroundColor(),
            borderRadius: 2,
            p: 2.5,
            textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.05)'
          }}
        >
          <Typography
            variant="body1"
            sx={{
              color: '#cbd5e1', // Slate 300
              fontSize: '1rem',
              lineHeight: 1.6
            }}
          >
            {message}
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'center', gap: 1.5 }}>
        {type === 'confirm' && (
          <Button
            onClick={onClose}
            variant="outlined"
            sx={{
              borderRadius: 2,
              px: 3,
              py: 1,
              textTransform: 'none',
              fontWeight: 600,
              borderColor: 'rgba(255,255,255,0.2)',
              color: '#94a3b8', // Slate 400
              '&:hover': {
                borderColor: 'rgba(255,255,255,0.4)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)'
              }
            }}
          >
            {cancelText}
          </Button>
        )}
        <Button
          onClick={handleConfirm}
          variant="contained"
          sx={{
            borderRadius: 2,
            px: 4,
            py: 1,
            textTransform: 'none',
            fontWeight: 600,
            bgcolor: '#6366f1', // Indigo 500
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
            '&:hover': {
              bgcolor: '#4f46e5', // Indigo 600
              boxShadow: '0 6px 16px rgba(99, 102, 241, 0.4)',
            }
          }}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ModernAlert;
