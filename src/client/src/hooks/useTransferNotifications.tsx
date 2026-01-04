import { useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';

interface TransferNotification {
  type: 'transfer';
  chatJid: string;
  sessionId: string;
  chatName: string;
  message: string;
  transferredFrom?: number;
  playSound: boolean;
  showNotification: boolean;
  timestamp: string;
  note?: string; // Nota opcional del admin
}

export const useTransferNotifications = (socket: any, userId?: number) => {
  // Reproducir sonido de notificación
  const playNotificationSound = useCallback(() => {
    try {
      // Crear un AudioContext para el sonido
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);

      console.log('🔊 Sonido de notificación reproducido');
    } catch (error) {
      console.error('Error reproduciendo sonido:', error);
    }
  }, []);

  // Mostrar notificación del navegador
  const showBrowserNotification = useCallback((data: TransferNotification) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('🔔 Nuevo Chat Asignado', {
        body: `Se te ha asignado el chat con: ${data.chatName}`,
        icon: '/logo192.png',
        tag: data.chatJid,
        requireInteraction: true,
        badge: '/logo192.png'
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      console.log('🔔 Notificación del navegador mostrada');
    } else if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          showBrowserNotification(data);
        }
      });
    }
  }, []);

  // Mostrar toast en la app
  const showToastNotification = useCallback((data: TransferNotification) => {
    toast.custom(
      (t) => (
        <div
          className={`${t.visible ? 'animate-enter' : 'animate-leave'
            } max-w-md w-full bg-white shadow-xl rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 overflow-hidden`}
          style={{
            animation: t.visible
              ? 'enter 0.3s ease-out'
              : 'leave 0.2s ease-in forwards',
          }}
        >
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <span style={{ fontSize: '32px' }}>📢</span>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-bold text-gray-900">
                  🔔 Nuevo Chat Asignado
                </p>
                <p className="mt-1 text-sm text-gray-700">
                  Chat con: <strong>{data.chatName}</strong>
                </p>
                {data.note && (
                  <p className="mt-2 text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                    📝 {data.note}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Transferido por Admin
                </p>
              </div>
            </div>
          </div>
          <div className="flex border-l border-gray-200">
            <button
              onClick={() => {
                toast.dismiss(t.id);
                // NO MÁS WINDOW.LOCATION.RELOAD! Usar evento personalizado para actualizar chats
                console.log('🔄 [NOTIFICATION] Solicitando actualización de chats sin recargar página');
                window.dispatchEvent(new CustomEvent('reload-assigned-chats', {
                  detail: { chatJid: data.chatJid, navigateToChat: true }
                }));
                // Navegar al chat sin recargar la página completa
                const chatUrl = `/dashboard/chat?chatId=${data.chatJid}&sessionId=${data.sessionId}`;
                window.history.pushState({}, '', chatUrl);
                // Forzar actualización del componente de chat actual
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                minWidth: '80px',
                background: 'linear-gradient(to bottom, #f9fafb, #f3f4f6)',
              }}
            >
              Ver Chat
            </button>
          </div>
        </div>
      ),
      {
        duration: 15000,
        position: 'top-right',
      }
    );

    console.log('📩 Toast mostrado en la app');
  }, []);

  useEffect(() => {
    if (!socket || !userId) {
      console.log('[NOTIFICATION] ⏸️ Socket o userId no disponible');
      return;
    }

    const eventName = `agent-${userId}-new-chat`;
    const requestEventName = `agent-${userId}-transfer-request`;
    const updateEventName = 'transfer-request-update';

    // 1. Manejar NUEVO CHAT ASIGNADO (Directo o aceptado)
    const handleTransferNotification = (data: TransferNotification) => {
      console.log('🎉 [NOTIFICATION] Chat transferido recibido:', data);
      if (data.playSound) playNotificationSound();
      if (data.showNotification) showBrowserNotification(data);
      showToastNotification(data);
      window.dispatchEvent(new CustomEvent('reload-assigned-chats', { detail: { chatJid: data.chatJid } }));
    };

    // 2. Manejar SOLICITUD DE TRANSFERENCIA (Requiere aceptación)
    const handleTransferRequest = (data: any) => {
      console.log('📨 [NOTIFICATION] Solicitud de transferencia recibida:', data);
      playNotificationSound();

      toast.custom((t) => (
        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-xl rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 overflow-hidden`}>
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <span style={{ fontSize: '32px' }}>🤔</span>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-bold text-gray-900">Solicitud de Transferencia</p>
                <p className="mt-1 text-sm text-gray-700">
                  <strong>{data.fromUserName}</strong> quiere transferirte un chat.
                </p>
                {data.reason && (
                  <p className="mt-2 text-sm text-gray-500 bg-gray-50 px-2 py-1 rounded">
                    "{data.reason}"
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex border-l border-gray-200 flex-col">
            <button
              onClick={async () => {
                toast.dismiss(t.id);
                try {
                  // Obtener API Base URL dinámicamente si es posible, o hardcoded relativo
                  const apiBase = window.location.origin;
                  await fetch(`${apiBase}/api/transfer-requests/${data.id}/respond`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                    body: JSON.stringify({ accept: true })
                  });
                  toast.success('Transferencia aceptada');
                } catch (e) { toast.error('Error al aceptar'); }
              }}
              className="w-full border-b border-gray-200 p-3 flex items-center justify-center text-sm font-medium text-green-600 hover:bg-green-50 focus:outline-none"
            >
              Aceptar
            </button>
            <button
              onClick={async () => {
                toast.dismiss(t.id);
                try {
                  const apiBase = window.location.origin;
                  await fetch(`${apiBase}/api/transfer-requests/${data.id}/respond`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                    body: JSON.stringify({ accept: false })
                  });
                  toast.error('Transferencia rechazada');
                } catch (e) { toast.error('Error al rechazar'); }
              }}
              className="w-full p-3 flex items-center justify-center text-sm font-medium text-red-600 hover:bg-red-50 focus:outline-none"
            >
              Rechazar
            </button>
          </div>
        </div>
      ), { duration: 30000, position: 'top-right' });
    };

    // 3. Manejar ACTUALIZACIÓN DE ESTADO (Para Admin/Supervisor)
    const handleTransferUpdate = (data: any) => {
      console.log('📢 [NOTIFICATION] Actualización de transferencia:', data);
      if (data.status === 'accepted') {
        toast.success(`✅ ${data.by} aceptó la transferencia de ${data.chatJid}`);
      } else if (data.status === 'rejected') {
        toast.error(`❌ ${data.by} rechazó la transferencia de ${data.chatJid}`);
      }
    };

    socket.on(eventName, handleTransferNotification);
    socket.on(requestEventName, handleTransferRequest);
    socket.on(updateEventName, handleTransferUpdate);

    return () => {
      socket.off(eventName, handleTransferNotification);
      socket.off(requestEventName, handleTransferRequest);
      socket.off(updateEventName, handleTransferUpdate);
    };
  }, [socket, userId, playNotificationSound, showBrowserNotification, showToastNotification]);

  // Solicitar permiso para notificaciones al montar
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log(`🔔 Permiso de notificaciones: ${permission}`);
      });
    }
  }, []);
};
