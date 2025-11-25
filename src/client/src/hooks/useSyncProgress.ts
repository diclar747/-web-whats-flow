import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { getSocketURL } from '../utils/socketConfig';

interface SyncProgress {
  status: 'syncing' | 'completed' | 'idle';
  progress: number;
  message: string;
  contacts?: number;
  groups?: number;
  messages?: number;
}

export const useSyncProgress = (sessionId: string | null) => {
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    status: 'idle',
    progress: 0,
    message: ''
  });

  useEffect(() => {
    if (!sessionId) return;

    const socketUrl = getSocketURL();
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true
    });

    socket.on('connect', () => {
      socket.emit('join-session', { sessionId });
    });

    socket.on('sync-start', (data: any) => {
      setSyncProgress({
        status: 'syncing',
        progress: 0,
        message: 'Iniciando sincronización...',
        contacts: 0,
        groups: 0,
        messages: 0
      });
    });

    socket.on('sync-progress', (data: any) => {
      setSyncProgress(prev => ({
        ...prev,
        status: 'syncing',
        progress: data.progress || prev.progress,
        message: data.message || prev.message,
        contacts: data.contacts || prev.contacts,
        groups: data.groups || prev.groups,
        messages: data.messages || prev.messages
      }));
    });

    socket.on('sync-contacts', (data: any) => {
      setSyncProgress(prev => ({
        ...prev,
        status: 'syncing',
        progress: 33,
        message: `Sincronizando contactos...`,
        contacts: data.total || 0
      }));
    });

    socket.on('sync-groups', (data: any) => {
      setSyncProgress(prev => ({
        ...prev,
        status: 'syncing',
        progress: 66,
        message: `Sincronizando grupos...`,
        groups: data.total || 0
      }));
    });

    socket.on('sync-messages', (data: any) => {
      setSyncProgress(prev => ({
        ...prev,
        status: 'syncing',
        progress: 90,
        message: `Sincronizando mensajes...`,
        messages: data.total || 0
      }));
    });

    socket.on('sync-completed', (data: any) => {
      setSyncProgress({
        status: 'completed',
        progress: 100,
        message: '¡Sincronización completada!',
        contacts: data.contacts,
        groups: data.groups,
        messages: data.messages
      });

      // Volver a idle después de 3 segundos
      setTimeout(() => {
        setSyncProgress(prev => ({ ...prev, status: 'idle' }));
      }, 3000);
    });

    return () => {
      socket.off('sync-start');
      socket.off('sync-progress');
      socket.off('sync-contacts');
      socket.off('sync-groups');
      socket.off('sync-messages');
      socket.off('sync-completed');
      socket.disconnect();
    };
  }, [sessionId]);

  return syncProgress;
};
