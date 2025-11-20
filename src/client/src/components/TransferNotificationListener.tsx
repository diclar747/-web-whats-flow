import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useTransferNotifications } from '../hooks/useTransferNotifications';

export const TransferNotificationListener: React.FC = () => {
  const { user } = useAuth();
  const socket = useSocket();

  // Activar hook de notificaciones - convertir id a número
  const userId = user?.id ? (typeof user.id === 'string' ? parseInt(user.id) : user.id) : undefined;
  useTransferNotifications(socket, userId);

  useEffect(() => {
    if (user) {
      console.log(`🎧 [LISTENER] Iniciado para usuario: ${user.name} (ID: ${user.id})`);
    }
  }, [user]);

  return null; // Componente invisible
};
