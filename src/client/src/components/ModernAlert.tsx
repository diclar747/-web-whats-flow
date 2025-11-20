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
        return <CheckCircleIcon sx={{ ...iconStyle, color: '#4CAF50' }} />;
      case 'error':
        return <ErrorIcon sx={{ ...iconStyle, color: '#F44336' }} />;
      case 'warning':
      case 'confirm':
        return <WarningIcon sx={{ ...iconStyle, color: '#FF9800' }} />;
      case 'info':
      default:
        return <InfoIcon sx={{ ...iconStyle, color: '#2196F3' }} />;
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return 'rgba(76, 175, 80, 0.05)';
      case 'error':
        return 'rgba(244, 67, 54, 0.05)';
      case 'warning':
      case 'confirm':
        return 'rgba(255, 152, 0, 0.05)';
      case 'info':
      default:
        return 'rgba(33, 150, 243, 0.05)';
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
          background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
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
          color: 'grey.500',
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
              color: '#1a1a1a'
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
            textAlign: 'center'
          }}
        >
          <Typography 
            variant="body1" 
            sx={{ 
              color: '#555',
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
              borderColor: '#ddd',
              color: '#666',
              '&:hover': {
                borderColor: '#999',
                backgroundColor: 'rgba(0, 0, 0, 0.04)'
              }
            }}
          >
            {cancelText}
          </Button>
        )}
        <Button
          onClick={handleConfirm}
          variant="contained"
          color={confirmColor}
          sx={{
            borderRadius: 2,
            px: 4,
            py: 1,
            textTransform: 'none',
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            '&:hover': {
              boxShadow: '0 6px 16px rgba(0, 0, 0, 0.2)',
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
