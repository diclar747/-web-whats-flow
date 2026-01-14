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
  // Reproducir sonido de notificación - DESACTIVADO A PETICIÓN DEL USUARIO
  const playNotificationSound = useCallback(() => {
    // Sonido eliminado para evitar errores de AudioContext y por petición del usuario
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
          style={{
            maxWidth: '420px',
            width: '100%',
            backgroundColor: '#ffffff',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            borderRadius: '0.5rem',
            pointerEvents: 'auto',
            display: 'flex',
            border: '1px solid rgba(0, 0, 0, 0.05)',
            overflow: 'hidden',
            animation: t.visible ? 'slideIn 0.3s ease-out' : 'slideOut 0.2s ease-in'
          }}
        >
          <div style={{ flex: '1', width: 0, padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{ flexShrink: 0, paddingTop: '0.125rem' }}>
                <span style={{ fontSize: '32px' }}>🔔</span>
              </div>
              <div style={{ marginLeft: '0.75rem', flex: 1 }}>
                <p style={{
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                  color: '#111827',
                  margin: 0
                }}>
                  Nuevo Chat Asignado
                </p>
                <p style={{
                  marginTop: '0.25rem',
                  fontSize: '0.875rem',
                  color: '#374151',
                  margin: '0.25rem 0 0 0'
                }}>
                  Chat con: <strong style={{ color: '#1f2937' }}>{data.chatName}</strong>
                </p>
                {data.note && (
                  <p style={{
                    marginTop: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#2563eb',
                    backgroundColor: '#eff6ff',
                    padding: '0.5rem',
                    borderRadius: '0.25rem',
                    border: '1px solid #bfdbfe',
                    margin: '0.5rem 0 0 0'
                  }}>
                    📝 {data.note}
                  </p>
                )}
                <p style={{
                  marginTop: '0.25rem',
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  margin: '0.25rem 0 0 0'
                }}>
                  Transferido por Admin
                </p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', borderLeft: '1px solid #e5e7eb' }}>
            <button
              onClick={() => {
                toast.dismiss(t.id);
                console.log('🔄 [NOTIFICATION] Solicitando actualización de chats sin recargar página');
                window.dispatchEvent(new CustomEvent('reload-assigned-chats', {
                  detail: { chatJid: data.chatJid, navigateToChat: true }
                }));
                const chatUrl = `/dashboard/chat?chatId=${data.chatJid}&sessionId=${data.sessionId}`;
                window.history.pushState({}, '', chatUrl);
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              style={{
                width: '100%',
                border: 'none',
                borderRadius: '0',
                borderTopRightRadius: '0.5rem',
                borderBottomRightRadius: '0.5rem',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#2563eb',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                minWidth: '80px',
                transition: 'background-color 0.2s ease',
                boxShadow: 'inset 0 0 0 1px transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f0f9ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
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
