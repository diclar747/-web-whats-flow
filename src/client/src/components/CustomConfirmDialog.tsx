import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Icon,
  useTheme,
  useMediaQuery,
  Slide,
  Divider
} from '@mui/material';
import {
  WarningAmber as WarningIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  HelpOutline as HelpIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// ==================== STYLED COMPONENTS ====================

const DialogWrapper = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: '16px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    overflow: 'hidden',
    minWidth: '320px',
    [theme.breakpoints.down('sm')]: {
      minWidth: '90vw',
    },
  },
}));

const DialogHeaderBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '16px',
  marginBottom: '16px',
}));

const IconWrapper = styled(Box)(({ theme, color = 'info' }: any) => {
  const colorMap: any = {
    warning: { bg: 'rgba(255, 193, 7, 0.1)', icon: '#FFC107' },
    error: { bg: 'rgba(244, 67, 54, 0.1)', icon: '#F44336' },
    success: { bg: 'rgba(76, 175, 80, 0.1)', icon: '#4CAF50' },
    info: { bg: 'rgba(33, 150, 243, 0.1)', icon: '#2196F3' },
    help: { bg: 'rgba(156, 39, 176, 0.1)', icon: '#9C27B0' },
  };

  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: colorMap[color]?.bg,
    flexShrink: 0,
    '& svg': {
      fontSize: '28px',
      color: colorMap[color]?.icon,
    },
  };
});

const TitleTypography = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: '20px',
  color: theme.palette.text.primary,
  marginBottom: '8px',
}));

const MessageTypography = styled(Typography)(({ theme }) => ({
  fontSize: '16px',
  color: theme.palette.text.secondary,
  lineHeight: '1.6',
  marginBottom: '16px',
}));

const ActionButtonsBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: '12px',
  justifyContent: 'flex-end',
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    '& button': {
      width: '100%',
    },
  },
}));

const CancelButton = styled(Button)(({ theme }) => ({
  textTransform: 'none',
  fontSize: '16px',
  fontWeight: '600',
  padding: '10px 24px',
  borderRadius: '8px',
  border: `2px solid ${theme.palette.divider}`,
  color: theme.palette.text.primary,
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
    borderColor: theme.palette.divider,
  },
  transition: 'all 0.3s ease',
}));

const ConfirmButton = styled(Button)(({ theme, variant = 'contained', color = 'primary' }: any) => ({
  textTransform: 'none',
  fontSize: '16px',
  fontWeight: '600',
  padding: '10px 24px',
  borderRadius: '8px',
  transition: 'all 0.3s ease',
  '&:disabled': {
    opacity: 0.6,
  },
}));

// ==================== INTERFACE ====================

interface CustomConfirmDialogProps {
  open: boolean;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'error' | 'success' | 'info' | 'help';
  variant?: 'contained' | 'outlined' | 'text';
  color?: 'primary' | 'error' | 'warning' | 'success' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  dangerousAction?: boolean;
  customIcon?: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

// ==================== COMPONENTE ====================

const CustomConfirmDialog: React.FC<CustomConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'info',
  variant = 'contained',
  color = 'primary',
  onConfirm,
  onCancel,
  loading = false,
  dangerousAction = false,
  customIcon,
  maxWidth = 'sm',
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const iconMap: any = {
    warning: <WarningIcon />,
    error: <ErrorIcon />,
    success: <SuccessIcon />,
    info: <InfoIcon />,
    help: <HelpIcon />,
  };

  const colorMap: any = {
    warning: 'warning',
    error: 'error',
    success: 'success',
    info: 'primary',
    help: 'help',
  };

  return (
    <DialogWrapper
      open={open}
      onClose={onCancel}
      maxWidth={maxWidth}
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: theme.palette.background.paper,
        },
      }}
      TransitionComponent={Slide}
      TransitionProps={{
        direction: 'up',
      } as any}
    >
      <DialogTitle sx={{ pb: 0, pt: 3, px: 3 }}>
        <DialogHeaderBox>
          <IconWrapper color={colorMap[type]}>
            {customIcon || iconMap[type]}
          </IconWrapper>
          <Box flex={1}>
            <TitleTypography>{title}</TitleTypography>
          </Box>
        </DialogHeaderBox>
      </DialogTitle>

      <DialogContent sx={{ pt: 2, px: 3 }}>
        <MessageTypography>
          {message}
        </MessageTypography>
      </DialogContent>

      <Divider sx={{ my: 2 }} />

      <DialogActions sx={{ p: 2, justifyContent: 'flex-end' }}>
        <ActionButtonsBox>
          <CancelButton
            onClick={onCancel}
            disabled={loading}
            variant="outlined"
          >
            {cancelText}
          </CancelButton>
          <ConfirmButton
            onClick={onConfirm}
            disabled={loading}
            variant={variant}
            color={dangerousAction ? 'error' : color}
            sx={{
              backgroundColor:
                dangerousAction
                  ? theme.palette.error.main
                  : variant === 'contained'
                  ? (theme.palette as any)[color]?.main
                  : 'transparent',
              color:
                dangerousAction && variant === 'contained'
                  ? 'white'
                  : 'inherit',
              '&:hover': {
                backgroundColor:
                  dangerousAction
                    ? theme.palette.error.dark
                    : variant === 'contained'
                    ? (theme.palette as any)[color]?.dark
                    : theme.palette.action.hover,
              },
            }}
          >
            {loading ? 'Procesando...' : confirmText}
          </ConfirmButton>
        </ActionButtonsBox>
      </DialogActions>
    </DialogWrapper>
  );
};

export default CustomConfirmDialog;
