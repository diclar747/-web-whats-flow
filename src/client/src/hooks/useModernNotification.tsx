import { useState, useCallback } from 'react';

interface NotificationState {
  open: boolean;
  message: string;
  title?: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface AlertState {
  open: boolean;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'confirm';
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'error' | 'warning' | 'success';
}

export const useModernNotification = () => {
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: '',
    type: 'success',
  });

  const [alert, setAlert] = useState<AlertState>({
    open: false,
    title: '',
    message: '',
    type: 'info',
  });

  const showNotification = useCallback((
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'success',
    title?: string,
    duration?: number
  ) => {
    setNotification({
      open: true,
      message,
      title,
      type,
      duration,
    });
  }, []);

  const showSuccess = useCallback((message: string, title?: string) => {
    showNotification(message, 'success', title);
  }, [showNotification]);

  const showError = useCallback((message: string, title?: string) => {
    showNotification(message, 'error', title);
  }, [showNotification]);

  const showWarning = useCallback((message: string, title?: string) => {
    showNotification(message, 'warning', title);
  }, [showNotification]);

  const showInfo = useCallback((message: string, title?: string) => {
    showNotification(message, 'info', title);
  }, [showNotification]);

  const showAlert = useCallback((
    title: string,
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' | 'confirm' = 'info',
    onConfirm?: () => void,
    confirmText?: string,
    cancelText?: string,
    confirmColor?: 'primary' | 'error' | 'warning' | 'success'
  ) => {
    setAlert({
      open: true,
      title,
      message,
      type,
      onConfirm,
      confirmText,
      cancelText,
      confirmColor,
    });
  }, []);

  const showConfirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText: string = 'Confirmar',
    cancelText: string = 'Cancelar'
  ) => {
    showAlert(title, message, 'confirm', onConfirm, confirmText, cancelText, 'error');
  }, [showAlert]);

  const closeNotification = useCallback(() => {
    setNotification((prev) => ({ ...prev, open: false }));
  }, []);

  const closeAlert = useCallback(() => {
    setAlert((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    notification,
    alert,
    showNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showAlert,
    showConfirm,
    closeNotification,
    closeAlert,
  };
};
