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
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(99, 102, 241, 0.3)',
            borderRadius: '16px',
            pointerEvents: 'auto',
            display: 'flex',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            overflow: 'hidden',
            animation: t.visible ? 'slideIn 0.3s ease-out' : 'slideOut 0.2s ease-in',
            backdropFilter: 'blur(10px)'
          }}
        >
          <div style={{ flex: '1', width: 0, padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{
                flexShrink: 0,
                paddingTop: '0.125rem',
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 16px rgba(99, 102, 241, 0.4)'
              }}>
                <span style={{ fontSize: '28px' }}>🔔</span>
              </div>
              <div style={{ marginLeft: '1rem', flex: 1 }}>
                <p style={{
                  fontSize: '0.95rem',
                  fontWeight: 'bold',
                  color: '#f1f5f9',
                  margin: 0,
                  letterSpacing: '0.02em'
                }}>
                  Nuevo Chat Asignado
                </p>
                <p style={{
                  marginTop: '0.5rem',
                  fontSize: '0.875rem',
                  color: '#cbd5e1',
                  margin: '0.5rem 0 0 0',
                  lineHeight: '1.5'
                }}>
                  Chat con: <strong style={{ color: '#e0e7ff', fontWeight: 600 }}>{data.chatName}</strong>
                </p>
                {data.note && (
                  <p style={{
                    marginTop: '0.75rem',
                    fontSize: '0.875rem',
                    color: '#a5b4fc',
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    padding: '0.625rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    margin: '0.75rem 0 0 0',
                    backdropFilter: 'blur(4px)'
                  }}>
                    📝 {data.note}
                  </p>
                )}
                <p style={{
                  marginTop: '0.5rem',
                  fontSize: '0.75rem',
                  color: '#94a3b8',
                  margin: '0.5rem 0 0 0'
                }}>
                  🔄 Transferido por Admin
                </p>
              </div>
            </div>

            {/* Botones Aceptar/Rechazar */}
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              marginTop: '1.25rem',
              paddingTop: '1rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <button
                onClick={async () => {
                  toast.dismiss(t.id);
                  try {
                    const apiBase = window.location.origin;
                    await fetch(`${apiBase}/api/agent/transfer/accept`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                      },
                      body: JSON.stringify({
                        chatJid: data.chatJid,
                        sessionId: data.sessionId
                      })
                    });
                    toast.success('✅ Transferencia aceptada');
                    window.dispatchEvent(new CustomEvent('reload-assigned-chats', {
                      detail: { chatJid: data.chatJid, navigateToChat: true }
                    }));
                  } catch (e) {
                    toast.error('Error al aceptar');
                  }
                }}
                style={{
                  flex: 1,
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.875rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#ffffff',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(16, 185, 129, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                }}
              >
                ✓ Aceptar
              </button>
              <button
                onClick={async () => {
                  toast.dismiss(t.id);
                  try {
                    const apiBase = window.location.origin;
                    await fetch(`${apiBase}/api/agent/transfer/reject`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                      },
                      body: JSON.stringify({
                        chatJid: data.chatJid,
                        sessionId: data.sessionId
                      })
                    });
                    toast.error('❌ Transferencia rechazada');
                  } catch (e) {
                    toast.error('Error al rechazar');
                  }
                }}
                style={{
                  flex: 1,
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.875rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#ffffff',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(239, 68, 68, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
                }}
              >
                ✕ Rechazar
              </button>
            </div>
          </div>
        </div>
      ),
      {
        duration: 30000,
        position: 'top-right',
      }
    );

    console.log('📩 Toast moderno mostrado en la app');
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
