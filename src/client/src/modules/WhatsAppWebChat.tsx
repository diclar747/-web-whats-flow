import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useWhatsApp } from '../context/WhatsAppContext';
import { getAPIBaseURL } from '../utils/socketConfig';
import { io } from 'socket.io-client';
import {
  Box,
  TextField,
  IconButton,
  Avatar,
  Typography,
  Paper,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Badge,
  Menu,
  MenuItem,
  Divider,
  InputAdornment,
  Tooltip,
  CircularProgress,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  Popover,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Search,
  MoreVert,
  Message,
  People,
  WhatsApp,
  InsertEmoticon,
  AttachFile,
  Mic,
  Send,
  Close,
  Done,
  DoneAll,
  AccessTime,
  ChevronLeft,
  ChevronRight,
  Print,
  Error,
  Reply,
  Forward,
  Delete,
  Star,
  ViewKanban,
  Info,
  VolumeOff,
  Archive,
  DeleteOutline,
  PlayArrow,
  Download,
  Description,
  Image as ImageIcon,
  PictureAsPdf,
  FilterList
} from '@mui/icons-material';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import KanbanSelectorModal from '../components/KanbanSelectorModal';
import CustomSnackbar from '../components/CustomSnackbar';

interface WhatsAppWebChatProps {
  sessionId: string;
}

const WhatsAppWebChat: React.FC<WhatsAppWebChatProps> = ({ sessionId }) => {
  // Log solo en primera montura
  const mountedRef = useRef(false);
  if (!mountedRef.current) {
    console.log('🚀 [WhatsAppWebChat] Componente montado INICIAL con sessionId:', sessionId);
    mountedRef.current = true;
  }

  // 🌞 MODO CLARO FIJO - Sistema de modo oscuro eliminado completamente

  const {
    chats = [],
    activeChat,
    messages = [],
    isLoading,
    loadChats,
    loadMessages,
    sendMessage,
    setActiveChat,
    replyMessage,
    setReplyMessage,
    markChatAsRead
  } = useWhatsApp();

  // Estados
  const [searchTerm, setSearchTerm] = useState('');
  const [messageText, setMessageText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState(0); // ✅ 0: Todo por defecto
  const [chatListCollapsed, setChatListCollapsed] = useState(true); // ✅ Colapsado por defecto
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [connectionChecking, setConnectionChecking] = useState(true);
  const [chatMenuAnchor, setChatMenuAnchor] = useState<null | HTMLElement>(null);
  const [messageMenuAnchor, setMessageMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [showReactionMenu, setShowReactionMenu] = useState<{ messageId: string; anchorEl: HTMLElement } | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [messageToForward, setMessageToForward] = useState<any | null>(null);
  const [selectedChatForForward, setSelectedChatForForward] = useState('');
  const [showKanbanModal, setShowKanbanModal] = useState(false);
  const [transferAgentDialogOpen, setTransferAgentDialogOpen] = useState(false);
  const [selectedAgentForTransfer, setSelectedAgentForTransfer] = useState('');
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info' }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<{ id: string; isFromMe: boolean } | null>(null);
  const [showSearchBar, setShowSearchBar] = useState(true); // ✅ Abierto por defecto
  const [dateFilter, setDateFilter] = useState('');
  const [quickFilter, setQuickFilter] = useState('');


  // Estados para multimedia
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<any>(null);

  const commonReactions = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏', '✅', '❌'];

  // ⚡ OPTIMIZACIÓN: Memoizar mensajes filtrados con caché inteligente
  const filteredMessages = useMemo(() => {
    if (!messages || messages.length === 0) return [];

    console.log(`[PERFORMANCE] Filtrando ${messages.length} mensajes con filtros:`, { dateFilter, quickFilter });

    const filtered = messages.filter(msg => {
      // Filtrar por fecha si está seleccionada
      if (!dateFilter) return true;
      const msgDate = new Date(msg.timestamp).toISOString().split('T')[0];
      // Si hay un filtro rápido, mostrar desde esa fecha hasta hoy
      if (quickFilter) {
        return msgDate >= dateFilter;
      }
      // Si es fecha específica, solo ese día
      return msgDate === dateFilter;
    });

    console.log(`[PERFORMANCE] Mensajes después del filtro: ${filtered.length}`);
    return filtered;
  }, [messages, dateFilter, quickFilter]);

  // ⚡ OPTIMIZACIÓN: Memoizar funciones estables para evitar re-crear en cada render
  // Helper para formatear nombre en respuestas citadas
  const getQuotedSenderName = useCallback((quotedSender: string): string => {
    if (!quotedSender) return 'Tú';

    // Si es el número del usuario actual, mostrar "Tú"
    const currentUserNumber = sessionId; // Usar sessionId como referencia
    if (quotedSender.includes(currentUserNumber)) {
      return 'Tú';
    }

    // Extraer solo el número del JID (antes del @)
    const phoneNumber = quotedSender.split('@')[0];

    // Buscar en los chats si hay un nombre guardado
    const chat = chats.find(c => c.id.includes(phoneNumber));
    if (chat && chat.name && chat.name !== phoneNumber) {
      return chat.name;
    }

    // Si no se encuentra, usar el número formateado
    return `+${phoneNumber}`;
  }, [chats, sessionId]);

  // Función para normalizar números de teléfono (eliminar sufijos como :0, :82, etc.)
  const normalizePhoneNumber = useCallback((phone: string): string => {
    if (!phone) return phone;
    // Eliminar sufijos como :0, :82, etc. que WhatsApp agrega para hilos/dispositivos
    return phone.split(':')[0];
  }, []);

  // 👤 Helper para obtener el nombre del remitente de forma inteligente
  const getSenderName = useCallback((msg: any): string => {
    // Si el mensaje NO es de nosotros (from_me = false), mostrar nombre del contacto
    if (!msg.isFromMe && !msg.fromMe) {
      return activeChat?.name || msg.from?.split('@')[0] || 'Contacto';
    }

    // Si el mensaje ES de nosotros (from_me = true)
    // Verificar si fue enviado por un agente
    if (msg.agent_id && msg.agent_id !== 0) {
      // Tiene agent_id válido, mostrar nombre del agente
      return msg.agent_name || msg.agentName || `Agente ${msg.agent_id}`;
    }

    // Si no tiene agent_id o es 0, es el Admin
    return 'Admin';
  }, [activeChat]);

  // Helper para procesar URLs de medios
  const getMediaUrl = useCallback((mediaUrl: string | null | undefined): string => {
    if (!mediaUrl) {
      console.warn('[getMediaUrl] mediaUrl está vacío o undefined');
      return '';
    }

    // Si ya es una URL completa (data: o http), retornarla tal cual
    if (mediaUrl.startsWith('data:') || mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
      console.log('[getMediaUrl] URL completa detectada:', mediaUrl.substring(0, 50));
      return mediaUrl;
    }

    // Si es una ruta relativa, agregar el base URL
    const cleanPath = mediaUrl.startsWith('/') ? mediaUrl : `/${mediaUrl}`;
    const fullUrl = `${getAPIBaseURL()}${cleanPath}`;
    console.log('[getMediaUrl] URL procesada:', mediaUrl, '→', fullUrl);
    return fullUrl;
  }, []);

  // Helper: obtener JID del remitente de un mensaje
  const getSenderJidForMessage = useCallback((msg: any): string | null => {
    if (!msg) return null;
    if (msg.isFromMe) {
      // Si el mensaje es mío, usar mi propio JID (sessionId)
      return sessionId ? `${sessionId}@s.whatsapp.net` : null;
    }
    // Para mensajes entrantes, usar senderJid (grupos) o from (individuales) o chatJid
    return msg.senderJid || msg.from || msg.chatJid || activeChat?.id || null;
  }, [activeChat, sessionId]);

  // Helper: construir URL de avatar para un JID
  const getAvatarUrlForJid = useCallback((jid?: string | null): string => {
    if (!jid) return '';
    return `${getAPIBaseURL()}/api/avatar/${sessionId}/${jid}`;
  }, [sessionId]);

  // ⚡ OPTIMIZACIÓN: Verificar conexión de WhatsApp cada 30s (antes 10s)
  useEffect(() => {
    const checkConnection = async () => {
      try {
        console.log('[WhatsAppWebChat] 🔍 Verificando conexión para sessionId:', sessionId);
        const response = await fetch(`${getAPIBaseURL()}/api/session/${sessionId}/status`);
        const data = await response.json();
        console.log('[WhatsAppWebChat] 📡 Estado de conexión recibido:', {
          success: data.success,
          isConnected: data.isConnected,
          phoneNumber: data.phoneNumber
        });
        setWhatsappConnected(data.success && data.isConnected);
        setConnectionChecking(false);
      } catch (error) {
        console.error('[WhatsAppWebChat] ❌ Error verificando conexión:', error);
        setWhatsappConnected(false);
        setConnectionChecking(false);
      }
    };

    checkConnection();
    // Reducido de 10s a 30s para disminuir carga
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, [sessionId]);

  // ✅ RECARGA AUTOMÁTICA DESACTIVADA - El sistema ya usa Socket.IO para tiempo real
  // WhatsAppContext maneja automáticamente los mensajes en tiempo real vía Socket.IO

  // Socket.IO: DESHABILITADO - WhatsAppContext ya maneja la conexión Socket.IO
  // Tener múltiples conexiones causa conflictos y desconexiones
  // WhatsAppContext ya escucha 'message' y actualiza en tiempo real
  /*
  useEffect(() => {
    if (!sessionId || !whatsappConnected) return;

    // Crear conexión Socket.IO con query
    const socket = io(getAPIBaseURL(), {
      query: { sessionId }
    });
    socketRef.current = socket;
    
    // Listener de conexión
    socket.on('connect', () => {
      console.log(`🔌 Socket.IO conectado para sesión: ${sessionId}`);
      socket.emit('join-session', sessionId);
    });
    
    // Listener de desconexión
    socket.on('disconnect', (reason: string) => {
      console.log('🔌 Socket.IO desconectado:', reason);
    });
    
    // Escuchar actualizaciones de estado de mensajes
    socket.on('message-status-update', (data: any) => {
      console.log('📨 Estado de mensaje actualizado:', data);
      // ✅ WhatsAppContext ya actualiza el estado en tiempo real (línea 184-197)
      // ✅ NO llamamos loadMessages() - confiamos en el contexto
    });
    
    // Escuchar nuevos mensajes (el servidor emite 'message')
    socket.on('message', (data: any) => {
      console.log('📩 Nuevo mensaje recibido:', data);
      // ✅ WhatsAppContext ya agrega el mensaje en tiempo real (línea 143-165)
      // ✅ NO llamamos loadMessages() - confiamos en el contexto
    });
    
    // Cleanup al desmontar
    return () => {
      console.log('🔌 Desconectando Socket.IO');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId, whatsappConnected, activeChat, loadChats, loadMessages]);
  */

  // Sincronización automática DESHABILITADA - Solo manual desde configuración
  // useEffect(() => {
  //   if (!whatsappConnected || !sessionId) return;

  const performFullSync = async () => {
    try {
      // Sincronización automática deshabilitada - Solo manual desde configuración
      console.log('ℹ️ Sincronización automática deshabilitada. Use el botón "Sincronizar" en Configuración.');
      return;
    } catch (error) {
      console.error('❌ Error en sincronización:', error);
      setSnackbar({
        open: true,
        message: '⚠️ Error en sincronización automática',
        severity: 'error'
      });
    }
  };

  // Ejecutar sincronización al conectar (con delay de 2 segundos)
  // const initialSyncTimeout = setTimeout(performFullSync, 2000);

  // Repetir sincronización cada 5 minutos
  // const syncInterval = setInterval(performFullSync, 5 * 60 * 1000);

  // return () => {
  //   clearTimeout(initialSyncTimeout);
  //   clearInterval(syncInterval);
  // };
  // }, [whatsappConnected, sessionId, loadChats]);

  // Cargar chats
  useEffect(() => {
    console.log('[WhatsAppWebChat] 📋 useEffect loadChats ejecutado:', {
      whatsappConnected,
      sessionId,
      loadChatsExists: !!loadChats,
      chatsLength: chats?.length || 0,
      connectionChecking
    });

    // Si todavía estamos verificando la conexión, esperar
    if (connectionChecking) {
      console.log('[WhatsAppWebChat] ⏳ Todavía verificando conexión, esperando...');
      return;
    }

    if (whatsappConnected && loadChats) {
      console.log('[WhatsAppWebChat] 🔄 Llamando a loadChats para sessionId:', sessionId, 'con filter: all');
      loadChats(sessionId, 'all'); // Cambiar de 'today' (default) a 'all'
    } else {
      console.warn('[WhatsAppWebChat] ⚠️ No se puede cargar chats:', {
        whatsappConnected,
        loadChatsExists: !!loadChats,
        sessionId,
        reason: !whatsappConnected ? 'WhatsApp desconectado' : 'loadChats no disponible'
      });

      // Mostrar mensaje al usuario
      if (!whatsappConnected && !connectionChecking) {
        console.error('[WhatsAppWebChat] ❌ WhatsApp NO está conectado. Por favor, escanea el código QR.');
      }
    }
  }, [whatsappConnected, sessionId, loadChats, connectionChecking]);

  // Los mensajes se cargan automáticamente desde WhatsAppContext cuando cambia activeChat
  // No necesitamos useEffect aquí para evitar loops infinitos

  // 🎯 FASE 3: Auto-scroll optimizado con requestAnimationFrame
  useEffect(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end'
      });
    });
  }, [messages]);

  // Cargar agentes disponibles para esta sesión
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const response = await fetch(`${getAPIBaseURL()}/api/agents/available?sessionId=${sessionId}`);
        const data = await response.json();
        if (data.success && data.agents) {
          setAvailableAgents(data.agents);
          console.log(`✅ ${data.agents.length} agentes disponibles cargados para sesión ${sessionId}`);
        } else {
          console.log('⚠️ No hay agentes disponibles para esta sesión');
          setAvailableAgents([]);
        }
      } catch (error) {
        console.error('Error cargando agentes:', error);
        setAvailableAgents([]);
      }
    };

    if (sessionId) {
      loadAgents();
    }
  }, [sessionId]);

  // Escuchar cambios de estado de agentes en tiempo real
  useEffect(() => {
    const socket = io(getAPIBaseURL());

    socket.on('agent-status-changed', (data: { agentId: string; status: string }) => {
      console.log('🔔 [WhatsAppWebChat] Estado de agente actualizado:', data);
      setAvailableAgents(prevAgents =>
        prevAgents.map(agent =>
          String(agent.id) === String(data.agentId)
            ? { ...agent, status: data.status }
            : agent
        )
      );
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Funciones
  const handleSendMessage = async () => {
    if (!messageText.trim() && !selectedFile) return;
    if (!activeChat) return;

    try {
      if (selectedFile) {
        // Comprimir imágenes antes de enviar para evitar 413
        let fileToSend = selectedFile;

        if (selectedFile.type.startsWith('image/')) {
          try {
            // Comprimir imagen si es mayor a 5MB
            if (selectedFile.size > 5 * 1024 * 1024) {
              console.log(`Comprimiendo imagen de ${(selectedFile.size / 1024 / 1024).toFixed(2)}MB...`);

              const compressedFile = await new Promise<File>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                  const img = new Image();
                  img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Redimensionar si es muy grande
                    const maxDimension = 1920;
                    if (width > maxDimension || height > maxDimension) {
                      if (width > height) {
                        height = (height * maxDimension) / width;
                        width = maxDimension;
                      } else {
                        width = (width * maxDimension) / height;
                        height = maxDimension;
                      }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                      if (blob) {
                        const compressed = new File([blob], selectedFile.name, {
                          type: 'image/jpeg',
                          lastModified: Date.now()
                        });
                        console.log(`Imagen comprimida: ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
                        resolve(compressed);
                      } else {
                        reject(new Error('Error comprimiendo imagen'));
                      }
                    }, 'image/jpeg', 0.85);
                  };
                  img.src = e.target?.result as string;
                };
                reader.onerror = reject;
                reader.readAsDataURL(selectedFile);
              });

              fileToSend = compressedFile;
            }
          } catch (compressError) {
            console.warn('Error comprimiendo imagen, enviando original:', compressError);
          }
        }

        // Validar tamaño después de compresión (máx 90MB para dejar margen)
        const maxSize = 90 * 1024 * 1024;
        if (fileToSend.size > maxSize) {
          setSnackbar({
            open: true,
            message: `El archivo es demasiado grande (${(fileToSend.size / 1024 / 1024).toFixed(2)}MB). Máximo: 90MB`,
            severity: 'error'
          });
          return;
        }

        // Enviar archivo (unificado) usando /api/send/media
        // El backend espera 'file' con multer y maneja imagen, video, audio, documento
        const formData = new FormData();
        formData.append('sessionId', sessionId);
        formData.append('number', activeChat.id);
        formData.append('caption', messageText.trim() || '');
        formData.append('file', fileToSend);
        const endpoint = '/api/send/media';

        const response = await fetch(`${getAPIBaseURL()}${endpoint}`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const text = await response.text();
          let errorMsg = 'Error enviando archivo';
          try {
            const errorData = JSON.parse(text);
            errorMsg = errorData.error || errorMsg;
          } catch {
            errorMsg = response.status === 413 ? 'Archivo demasiado grande' : text.substring(0, 100);
          }
          throw new Error(errorMsg);
        }

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Error enviando archivo');
        }

        console.log('✅ Archivo enviado:', data);
        setSelectedFile(null);
        setFilePreview(null);
        // ✅ WhatsAppContext recibirá el mensaje vía Socket.IO y lo agregará automáticamente
      } else if (messageText.trim() && sendMessage) {
        const contextInfo = replyMessage ? {
          id: replyMessage.id,
          message: replyMessage.message,
          from: replyMessage.from
        } : undefined;

        await sendMessage(activeChat.id, messageText, contextInfo);
      }

      setMessageText('');
      setReplyMessage?.(null);
      setShowEmojiPicker(false);
      // ✅ WhatsAppContext recibirá el mensaje vía Socket.IO y lo agregará automáticamente

      // ✅ Enfocar el cuadro de texto después de enviar
      setTimeout(() => {
        messageInputRef.current?.focus();
      }, 100);

    } catch (error) {
      console.error('Error enviando mensaje:', error);
      setSnackbar({
        open: true,
        message: `Error al enviar mensaje: ${error}`,
        severity: 'error'
      });
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const reader = new FileReader();
        reader.onload = (e) => setFilePreview(e.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
  };

  const handleEmojiClick = (emojiData: any) => {
    setMessageText(prev => prev + emojiData.emoji);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    // Si es hoy, mostrar solo hora
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    }
    // Si es ayer, mostrar "Ayer"
    else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ayer ' + date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    }
    // Si es esta semana, mostrar día de la semana
    else if (now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return date.toLocaleDateString('es', { weekday: 'short' }) + ' ' +
        date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    }
    // Sino, mostrar fecha completa
    else {
      return date.toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' +
        date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    }
  };

  const handleReactToMessage = async (messageId: string, emoji: string) => {
    if (!activeChat) return;

    try {

      const response = await fetch(`${getAPIBaseURL()}/api/message/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId,
          chatJid: activeChat.id,
          messageId: messageId,
          emoji: emoji
        })
      });

      const data = await response.json();
      if (data.success) {
        console.log('✅ Reacción enviada');
        setShowReactionMenu(null);
        // ✅ WhatsAppContext actualizará el mensaje vía Socket.IO
      }
    } catch (error) {
      console.error('Error enviando reacción:', error);
    }
  };

  const handleDeleteMessage = async () => {
    if (!activeChat || !messageToDelete) return;

    try {
      await fetch(`${getAPIBaseURL()}/api/message/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId,
          chatJid: activeChat.id,
          messageId: messageToDelete.id,
          fromMe: messageToDelete.isFromMe
        })
      });

      setSnackbar({
        open: true,
        message: '✅ Mensaje eliminado correctamente',
        severity: 'success'
      });

      setDeleteConfirmOpen(false);
      setMessageToDelete(null);
      // ✅ WhatsAppContext actualizará los mensajes vía Socket.IO
    } catch (error) {
      console.error('Error eliminando mensaje:', error);
      setSnackbar({
        open: true,
        message: '❌ Error al eliminar el mensaje',
        severity: 'error'
      });
    }
  };

  const openDeleteConfirm = (messageId: string, isFromMe: boolean) => {
    setMessageToDelete({ id: messageId, isFromMe });
    setDeleteConfirmOpen(true);
    setMessageMenuAnchor(null);
  };

  const handleForwardMessage = async () => {
    if (!messageToForward || !selectedChatForForward) return;

    try {

      const response = await fetch(`${getAPIBaseURL()}/api/message/forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId,
          messageId: messageToForward.id,
          fromJid: activeChat?.id,
          toJid: selectedChatForForward,
          message: messageToForward.message
        })
      });

      const data = await response.json();
      if (data.success) {
        setSnackbar({
          open: true,
          message: 'Mensaje reenviado exitosamente',
          severity: 'success'
        });
        setForwardDialogOpen(false);
        setMessageToForward(null);
        setSelectedChatForForward('');
      }
    } catch (error) {
      console.error('Error reenviando mensaje:', error);
    }
  };

  const handleKanbanSuccess = (boardId: string, boardName: string) => {
    setSnackbar({
      open: true,
      message: `Contacto enviado exitosamente a "${boardName}"`,
      severity: 'success'
    });
  };

  const handleTransferToAgent = async () => {
    if (!selectedAgentForTransfer || !activeChat) return;

    // Validar estado del agente
    const agent = availableAgents.find(a => String(a.id) === String(selectedAgentForTransfer));
    if (agent && (agent.status === 'offline' || !agent.status)) {
      setSnackbar({
        open: true,
        message: '⛔ No puedes transferir el chat a un agente desconectado',
        severity: 'warning'
      });
      return;
    }

    try {

      const response = await fetch(`${getAPIBaseURL()}/api/chats/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId,
          chatJid: activeChat.id, // El ID es el JID en WhatsApp
          toAgentId: selectedAgentForTransfer,
          fromAgentId: null // Puede ser null si no se sabe quién lo transfiere
        })
      });

      const data = await response.json();
      if (data.success) {
        setSnackbar({
          open: true,
          message: 'Chat transferido exitosamente al agente',
          severity: 'success'
        });
        setTransferAgentDialogOpen(false);
        setSelectedAgentForTransfer('');
      } else {
        throw new Error(data.error || 'Error transfiriendo chat');
      }
    } catch (error) {
      console.error('Error transfiriendo a agente:', error);
      setSnackbar({
        open: true,
        message: `Error al transferir chat: ${error}`,
        severity: 'error'
      });
    }
  };

  // Funciones multimedia
  const handleImageClick = (imageUrl: string) => {
    setLightboxImage(imageUrl);
    setLightboxOpen(true);
  };

  const handlePlayAudio = (audioId: string, audioUrl: string) => {
    // Si ya hay un audio reproduciéndose, detenerlo
    if (playingAudio && playingAudio !== audioId) {
      const prevAudio = audioRefs.current[playingAudio];
      if (prevAudio) {
        prevAudio.pause();
        prevAudio.currentTime = 0;
      }
    }

    // Crear o obtener el elemento de audio
    if (!audioRefs.current[audioId]) {
      const audio = new Audio(audioUrl);
      audioRefs.current[audioId] = audio;

      audio.onended = () => {
        setPlayingAudio(null);
      };

      audio.onerror = () => {
        console.error('Error cargando audio');
        setPlayingAudio(null);
        setSnackbar({
          open: true,
          message: 'Error al reproducir audio',
          severity: 'error'
        });
      };
    }

    const audio = audioRefs.current[audioId];

    if (playingAudio === audioId) {
      // Pausar si ya está reproduciéndose
      audio.pause();
      setPlayingAudio(null);
    } else {
      // Reproducir
      audio.play().then(() => {
        setPlayingAudio(audioId);
      }).catch((error) => {
        console.error('Error al reproducir:', error);
        setSnackbar({
          open: true,
          message: 'Error al reproducir audio',
          severity: 'error'
        });
      });
    }
  };

  // 🚀 FASE 2: Filtrado optimizado con useMemo y caché inteligente
  const filteredChats = useMemo(() => {
    console.log('[PERFORMANCE] 🔍 Calculando filteredChats:', {
      totalChats: chats.length,
      filterTab,
      searchTerm,
      hasGroups: chats.some(c => c.isGroup)
    });

    // Caché simple para evitar cálculos repetidos con mismos datos
    const cacheKey = `${chats.length}-${filterTab}-${searchTerm}`;
    const cachedResult = sessionStorage.getItem(`chatFilter-${cacheKey}`);
    
    if (cachedResult) {
      try {
        const parsed = JSON.parse(cachedResult);
        console.log('[PERFORMANCE] ✅ Usando caché de filtros');
        return parsed;
      } catch (e) {
        console.warn('[PERFORMANCE] ❌ Error parseando caché, recalculando...');
      }
    }

    const filtered = chats.filter(chat => {
      const chatName = chat.name || chat.id.split('@')[0] || 'Desconocido';

      // Filtrar status broadcasts
      if (chatName === 'status' || chat.id.includes('status@broadcast')) {
        return false;
      }

      // ⚠️ IMPORTANTE: FILTRAR GRUPOS - NO mostrarlos NUNCA
      if (chat.isGroup) {
        return false;
      }

      const matchesSearch = chatName.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      // Filtrado por pestañas (SOLO contactos individuales, SIN grupos)
      if (filterTab === 0) return true; // Todo (todos los chats individuales)
      if (filterTab === 1) {
        // Enviados: chats donde el último mensaje es de nosotros
        return chat.lastMessageFromMe === true;
      }
      if (filterTab === 2) {
        // Recibidos: chats donde el último mensaje NO es de nosotros
        return chat.lastMessageFromMe === false;
      }
      if (filterTab === 3) {
        // Pendientes: chats con mensajes sin leer
        return chat.unreadCount && chat.unreadCount > 0;
      }
      return true;
    });

    const groupCount = chats.filter(c => c.isGroup).length;
    console.log(`[PERFORMANCE] 🔍 Filtro: Tab ${filterTab}, Total: ${chats.length}, Filtrados: ${filtered.length}, Grupos ocultos: ${groupCount}`);

    // Guardar en caché por 30 segundos
    try {
      sessionStorage.setItem(`chatFilter-${cacheKey}`, JSON.stringify(filtered));
      sessionStorage.setItem(`chatFilter-time-${cacheKey}`, Date.now().toString());
    } catch (e) {
      console.warn('[PERFORMANCE] ⚠️ No se pudo guardar en caché, sessionStorage lleno');
    }

    return filtered;
  }, [chats, searchTerm, filterTab]);

  // 🚀 Estadísticas de chats (SIN grupos)
  const chatStats = useMemo(() => {
    const individualChats = chats.filter(c => !c.isGroup);
    return {
      total: individualChats.length,
      sent: individualChats.filter(c => c.lastMessageFromMe === true).length,
      received: individualChats.filter(c => c.lastMessageFromMe === false).length,
      pending: individualChats.filter(c => c.unreadCount && c.unreadCount > 0).length
    };
  }, [chats]);

  // Colores exactos de WhatsApp Web
  // 🎨 FASE 1: Colores modernos y profesionales
  // 🌞 Colores en modo claro fijo (modo oscuro eliminado)
  const colors = {
    primary: '#00a884',
    primaryLight: '#25d366',
    primaryDark: '#008069',
    secondary: '#667781',
    accent: '#00bfa5',

    background: '#f5f7fa',
    sidebar: '#ffffff',
    header: '#f8f9fa',
    chatBg: '#e5ddd5',

    myMessage: '#ffffff',
    myMessageHover: '#f5f6f6',
    theirMessage: '#ffffff',
    theirMessageHover: '#f5f6f6',

    text: '#111b21',
    textSecondary: '#667781',
    textTertiary: '#8696a0',

    divider: '#e9edef',
    hover: '#f0f2f5',
    hoverStrong: '#e9edef',
    inputBg: '#ffffff',
    selected: '#e6f7ff',

    shadow: '0 1px 2px rgba(0,0,0,0.1)',
    shadowStrong: '0 2px 8px rgba(0,0,0,0.15)',

    success: '#25d366',
    error: '#f44336',
    warning: '#ff9800',
    info: '#2196f3'
  };

  if (connectionChecking) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!whatsappConnected) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 3, p: 4 }}>
        <WhatsApp sx={{ fontSize: 100, color: colors.textSecondary, opacity: 0.3 }} />
        <Typography variant="h5" sx={{ fontWeight: 600, color: colors.text }}>
          WhatsApp no está conectado
        </Typography>
        <Button
          variant="contained"
          startIcon={<WhatsApp />}
          onClick={() => window.location.href = '/'}
          sx={{ bgcolor: colors.primary, '&:hover': { bgcolor: '#008069' } }}
        >
          Conectar WhatsApp
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', bgcolor: colors.background }}>
      {/* ============ SIDEBAR DE CHATS ============ */}
      <Box sx={{
        width: chatListCollapsed ? 80 : 420,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: colors.sidebar,
        borderRight: `1px solid ${colors.divider}`,
        boxShadow: '2px 0 8px rgba(0,0,0,0.04)',
        transition: 'width 0.3s ease'
      }}>
        {/* Header del sidebar */}
        <Box sx={{
          height: 60,
          bgcolor: '#f8f9fa', // 🌞 Forzar modo claro
          display: 'flex',
          alignItems: 'center',
          px: 2,
          gap: 1,
          borderBottom: `1px solid ${colors.divider}`,
          justifyContent: chatListCollapsed ? 'center' : 'space-between'
        }}>
          {!chatListCollapsed && (
            <Typography variant="h6" sx={{ flex: 1, fontWeight: 600, color: colors.text }}>
              Chats
            </Typography>
          )}

          {/* Botón minimizar/maximizar */}
          <Tooltip title={chatListCollapsed ? "Expandir lista" : "Minimizar lista"}>
            <IconButton
              onClick={() => setChatListCollapsed(!chatListCollapsed)}
              sx={{
                color: colors.textSecondary,
                transition: 'all 0.2s ease',
                '&:hover': { color: colors.text, bgcolor: colors.hover }
              }}
            >
              {chatListCollapsed ? <ChevronRight /> : <ChevronLeft />}
            </IconButton>
          </Tooltip>
        </Box>

        {/* Buscador - Ocultar si está colapsado */}
        {!chatListCollapsed && (
          <Box sx={{ p: 2, bgcolor: colors.sidebar }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar o empezar un chat nuevo"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: colors.background,
                  borderRadius: '10px',
                  fontSize: '14px',
                  transition: 'all 0.2s ease',
                  '& fieldset': {
                    border: `1px solid ${colors.divider}`
                  },
                  '&:hover': {
                    bgcolor: colors.hover,
                    '& fieldset': {
                      borderColor: colors.primary
                    }
                  },
                  '&.Mui-focused': {
                    bgcolor: colors.inputBg,
                    boxShadow: `0 0 0 2px ${colors.primary}25`,
                    '& fieldset': {
                      borderColor: colors.primary
                    }
                  },
                  '& input': {
                    padding: '10px 12px'
                  }
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: colors.textSecondary, fontSize: 20 }} />
                  </InputAdornment>
                )
              }}
            />
          </Box>
        )}

        {/* PESTAÑAS: Todos / No leídos / Grupos - Ocultar si está colapsado */}
        {!chatListCollapsed && (
          <Tabs
            value={filterTab}
            onChange={(e, newValue) => setFilterTab(newValue)}
            sx={{
              minHeight: 40,
              bgcolor: colors.sidebar,
              '& .MuiTab-root': {
                minHeight: 40,
                textTransform: 'none',
                color: colors.textSecondary,
                fontSize: '0.9rem'
              },
              '& .Mui-selected': {
                color: colors.primary
              },
              '& .MuiTabs-indicator': {
                bgcolor: colors.primary
              }
            }}
          >
            <Tab label={`Todo (${chatStats.total})`} />
            <Tab label={`Enviados (${chatStats.sent})`} />
            <Tab label={`Recibidos (${chatStats.received})`} />
            <Tab label={`Sin leer (${chatStats.pending})`} />
          </Tabs>
        )}

        {/* Lista de chats - Mostrar solo avatares si está colapsado */}
        <List sx={{ flex: 1, overflow: 'auto', p: 0 }}>
          {filteredChats.map((chat) => (
            <ListItemButton
              key={chat.id}
              selected={activeChat?.id === chat.id}
              onClick={async () => {
                // Fijar el chat activo
                setActiveChat?.(chat);
                // Cargar el historial del chat seleccionado
                if (loadMessages) {
                  await loadMessages(chat.id);
                }
                // Marcar como leído si corresponde
                if (chat.unreadCount && chat.unreadCount > 0 && markChatAsRead) {
                  markChatAsRead(chat.id);
                }
              }}
              sx={{
                px: 2,
                py: 1.5,
                '&.Mui-selected': { backgroundColor: colors.selected },
                '&:hover': { backgroundColor: colors.hover }
              }}
            >
              <ListItemAvatar sx={{ minWidth: chatListCollapsed ? 'auto' : 56, justifyContent: 'center', display: 'flex' }}>
                <Tooltip title={chatListCollapsed ? chat.name : ''} placement="right">
                  <Badge
                    badgeContent={chat.unreadCount}
                    color="error"
                    invisible={!chat.unreadCount || chat.unreadCount === 0}
                    sx={{
                      '& .MuiBadge-badge': {
                        backgroundColor: '#25d366',
                        color: 'white',
                        fontWeight: 'bold'
                      }
                    }}
                  >
                    <Avatar
                      src={chat.avatar || `${getAPIBaseURL()}/api/avatar/${sessionId}/${chat.id}`}
                      imgProps={{
                        onError: (e: any) => {
                          e.target.src = '';
                          e.target.onerror = null;
                        }
                      }}
                      sx={{ bgcolor: chat.isGroup ? '#9c27b0' : colors.primary }}
                    >
                      {chat.name ? chat.name.charAt(0).toUpperCase() : chat.id.split('@')[0].charAt(0)}
                    </Avatar>
                  </Badge>
                </Tooltip>
              </ListItemAvatar>
              {!chatListCollapsed && (
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {chat.isGroup && <People sx={{ fontSize: 16, color: '#9c27b0' }} />}
                        <Typography variant="body1" noWrap sx={{ fontWeight: chat.unreadCount ? 600 : 400, color: colors.text }}>
                          {chat.name || chat.id.split('@')[0]}
                        </Typography>
                        {/* Etiqueta de Agente Asignado */}
                        {(chat as any).assigned_agent_name && (
                          <Chip
                            label={`Agente: ${chat.assigned_agent_name}`}
                            size="small"
                            sx={{
                              ml: 1,
                              height: 16,
                              fontSize: '0.65rem',
                              bgcolor: '#e3f2fd',
                              color: '#1976d2',
                              fontWeight: 600
                            }}
                          />
                        )}
                      </Box>
                      <Typography variant="caption" sx={{ color: colors.textSecondary, ml: 1 }}>
                        {chat.timestamp ? formatTime(chat.timestamp) : ''}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Typography
                      variant="body2"
                      noWrap
                      sx={{
                        color: colors.textSecondary,
                        fontWeight: chat.unreadCount ? 500 : 400
                      }}
                    >
                      {chat.lastMessage || 'Toca para chatear'}
                    </Typography>
                  }
                />
              )}
            </ListItemButton>
          ))}
        </List>
      </Box>

      {/* ============ ÁREA DE CHAT ============ */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {activeChat ? (
          <>
            {/* Header del chat */}
            <Box sx={{
              height: 70,
              bgcolor: '#f8f9fa', // 🌞 Forzar modo claro
              display: 'flex',
              alignItems: 'center',
              px: 3,
              gap: 2,
              borderBottom: `1px solid ${colors.divider}`,
              position: 'relative',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              backdropFilter: 'blur(10px)'
            }}>
              <Avatar
                src={activeChat.avatar || `${getAPIBaseURL()}/api/avatar/${sessionId}/${activeChat.id}`}
                imgProps={{
                  onError: (e: any) => {
                    e.target.src = '';
                    e.target.onerror = null;
                  }
                }}
                sx={{
                  bgcolor: activeChat.isGroup ? '#9c27b0' : colors.primary,
                  width: 45,
                  height: 45,
                  border: `2px solid ${colors.divider}`,
                  transition: 'transform 0.2s ease',
                  '&:hover': {
                    transform: 'scale(1.05)',
                    cursor: 'pointer'
                  }
                }}
              >
                {activeChat.name ? activeChat.name.charAt(0).toUpperCase() : activeChat.id.split('@')[0].charAt(0)}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {activeChat.isGroup && <People sx={{ fontSize: 18, color: '#9c27b0' }} />}
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 600,
                      color: colors.text,
                      fontSize: '16px',
                      letterSpacing: '0.01em'
                    }}
                  >
                    {activeChat.name || normalizePhoneNumber(activeChat.id.split('@')[0])}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.3 }}>
                  <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '12.5px' }}>
                    {activeChat.isGroup ? `Grupo · ${messages.length} mensajes` : `${normalizePhoneNumber(activeChat.id.split('@')[0])}`}
                  </Typography>
                  {activeChat.unreadCount && activeChat.unreadCount > 0 && (
                    <Chip
                      label={`${activeChat.unreadCount} sin leer`}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '10px',
                        fontWeight: 600,
                        bgcolor: colors.primary,
                        color: 'white',
                        '& .MuiChip-label': { px: 1 }
                      }}
                    />
                  )}
                </Box>
              </Box>



              <Tooltip title="Buscar por fecha">
                <IconButton
                  onClick={() => setShowSearchBar(!showSearchBar)}
                  sx={{
                    color: showSearchBar ? colors.primary : colors.textSecondary,
                    transition: 'all 0.2s ease',
                    '&:hover': { color: colors.text, bgcolor: colors.hover }
                  }}
                >
                  <Search />
                </IconButton>
              </Tooltip>

              {/* Botón Imprimir - TEST */}
              <Tooltip title="Imprimir conversación">
                <IconButton
                  onClick={() => window.print()}
                  disabled={!activeChat}
                  sx={{
                    color: colors.textSecondary,
                    transition: 'all 0.2s ease',
                    '&:hover': { color: colors.text, bgcolor: colors.hover }
                  }}
                >
                  <Print />
                </IconButton>
              </Tooltip>
              <Tooltip title="Más opciones">
                <IconButton
                  onClick={(e) => setChatMenuAnchor(e.currentTarget)}
                  sx={{
                    color: colors.textSecondary,
                    transition: 'all 0.2s ease',
                    '&:hover': { color: colors.text, bgcolor: colors.hover }
                  }}
                >
                  <MoreVert />
                </IconButton>
              </Tooltip>
            </Box>

            {/* Menú de opciones del chat */}
            <Menu
              anchorEl={chatMenuAnchor}
              open={Boolean(chatMenuAnchor)}
              onClose={() => setChatMenuAnchor(null)}
            >
              <MenuItem onClick={() => { setShowKanbanModal(true); setChatMenuAnchor(null); }}>
                <ViewKanban sx={{ mr: 2, color: '#673ab7' }} /> Enviar a Kanban
              </MenuItem>
              <MenuItem onClick={() => { setTransferAgentDialogOpen(true); setChatMenuAnchor(null); }}>
                <People sx={{ mr: 2, color: '#2196f3' }} /> Enviar a agente
              </MenuItem>
              <Divider />
              <MenuItem onClick={() => setChatMenuAnchor(null)}>
                <Archive sx={{ mr: 2 }} /> Archivar chat
              </MenuItem>
              <Divider />
              <MenuItem onClick={() => setChatMenuAnchor(null)} sx={{ color: '#f44336' }}>
                <DeleteOutline sx={{ mr: 2 }} /> Eliminar chat
              </MenuItem>
            </Menu>

            {/* Barra de búsqueda por fecha */}
            {showSearchBar && (
              <Box sx={{
                p: 2,
                bgcolor: colors.header,
                borderBottom: `1px solid ${colors.divider}`,
                display: 'flex',
                gap: 2,
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Filtro rápido</InputLabel>
                  <Select
                    value={quickFilter}
                    label="Filtro rápido"
                    onChange={(e) => {
                      const value = e.target.value;
                      setQuickFilter(value);

                      // Calcular fecha según filtro
                      const now = new Date();
                      let filterDate = '';

                      switch (value) {
                        case 'today':
                          filterDate = now.toISOString().split('T')[0];
                          break;
                        case 'yesterday':
                          const yesterday = new Date(now);
                          yesterday.setDate(yesterday.getDate() - 1);
                          filterDate = yesterday.toISOString().split('T')[0];
                          break;
                        case 'week':
                          const weekAgo = new Date(now);
                          weekAgo.setDate(weekAgo.getDate() - 7);
                          filterDate = weekAgo.toISOString().split('T')[0];
                          break;
                        case '15days':
                          const days15 = new Date(now);
                          days15.setDate(days15.getDate() - 15);
                          filterDate = days15.toISOString().split('T')[0];
                          break;
                        case 'month':
                          const monthAgo = new Date(now);
                          monthAgo.setMonth(monthAgo.getMonth() - 1);
                          filterDate = monthAgo.toISOString().split('T')[0];
                          break;
                        case '3months':
                          const months3 = new Date(now);
                          months3.setMonth(months3.getMonth() - 3);
                          filterDate = months3.toISOString().split('T')[0];
                          break;
                        case '6months':
                          const months6 = new Date(now);
                          months6.setMonth(months6.getMonth() - 6);
                          filterDate = months6.toISOString().split('T')[0];
                          break;
                        case 'year':
                          const yearAgo = new Date(now);
                          yearAgo.setFullYear(yearAgo.getFullYear() - 1);
                          filterDate = yearAgo.toISOString().split('T')[0];
                          break;
                      }

                      setDateFilter(filterDate);
                    }}
                  >
                    <MenuItem value="">Sin filtro</MenuItem>
                    <MenuItem value="today">Hoy</MenuItem>
                    <MenuItem value="yesterday">Ayer</MenuItem>
                    <MenuItem value="week">Última semana</MenuItem>
                    <MenuItem value="15days">Últimos 15 días</MenuItem>
                    <MenuItem value="month">Último mes</MenuItem>
                    <MenuItem value="3months">Últimos 3 meses</MenuItem>
                    <MenuItem value="6months">Últimos 6 meses</MenuItem>
                    <MenuItem value="year">Último año</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  type="date"
                  label="Fecha específica"
                  value={dateFilter}
                  onChange={(e) => {
                    setDateFilter(e.target.value);
                    setQuickFilter(''); // Limpiar filtro rápido
                  }}
                  size="small"
                  sx={{ minWidth: 180 }}
                  InputLabelProps={{
                    shrink: true,
                  }}
                />

                {(dateFilter || quickFilter) && (
                  <Button
                    onClick={() => {
                      setDateFilter('');
                      setQuickFilter('');
                    }}
                    variant="outlined"
                    size="small"
                    startIcon={<Close />}
                  >
                    Limpiar
                  </Button>
                )}

                <Button
                  onClick={async () => {
                    if (!activeChat) return;

                    // Generar PDF con jsPDF
                    const { jsPDF } = await import('jspdf');
                    const doc = new jsPDF();

                    // Título
                    doc.setFontSize(16);
                    doc.text(`Chat con ${activeChat.name}`, 20, 20);
                    doc.setFontSize(10);
                    doc.text(`Exportado: ${new Date().toLocaleString('es')}`, 20, 30);

                    let y = 40;
                    const filteredMessages = messages.filter(msg => {
                      if (!dateFilter) return true;
                      const msgDate = new Date(msg.timestamp).toISOString().split('T')[0];
                      return msgDate >= dateFilter;
                    });

                    filteredMessages.forEach((msg, index) => {
                      if (y > 270) {
                        doc.addPage();
                        y = 20;
                      }

                      const time = new Date(msg.timestamp).toLocaleString('es');
                      const sender = msg.isFromMe ? 'Yo' : activeChat.name;
                      const text = msg.message || 'Media';

                      doc.setFontSize(8);
                      doc.setTextColor(100);
                      doc.text(`[${time}] ${sender}:`, 20, y);
                      y += 5;

                      doc.setFontSize(10);
                      doc.setTextColor(0);
                      const lines = doc.splitTextToSize(text, 170);
                      doc.text(lines, 20, y);
                      y += lines.length * 5 + 3;
                    });

                    doc.save(`chat-${activeChat.name}-${new Date().toISOString().split('T')[0]}.pdf`);
                  }}
                  variant="contained"
                  size="small"
                  startIcon={<PictureAsPdf />}
                  disabled={!activeChat || messages.length === 0}
                  sx={{ ml: 'auto' }}
                >
                  Exportar PDF
                </Button>

                {/* Botón Imprimir */}
                <Button
                  onClick={() => window.print()}
                  variant="outlined"
                  size="small"
                  startIcon={<Print />}
                  disabled={!activeChat || messages.length === 0}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    borderColor: colors.primary,
                    color: colors.primary,
                    '&:hover': {
                      borderColor: colors.primary,
                      bgcolor: `${colors.primary}10`
                    }
                  }}
                >
                  Imprimir
                </Button>
              </Box>
            )}

            {/* Mensajes */}
            <Box
              data-messages-container
              sx={{
                flex: 1,
                overflow: 'auto',
                backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
                backgroundColor: colors.chatBg,
                p: 3,
                position: 'relative',
                // Custom scrollbar
                '&::-webkit-scrollbar': {
                  width: '6px'
                },
                '&::-webkit-scrollbar-track': {
                  bgcolor: 'transparent'
                },
                '&::-webkit-scrollbar-thumb': {
                  bgcolor: colors.divider,
                  borderRadius: '10px',
                  transition: 'background-color 0.2s ease',
                  '&:hover': {
                    bgcolor: colors.textSecondary
                  }
                }
              }}
            >
              {/* Indicador de carga */}
              {isLoading && messages.length === 0 ? (
                <Box sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  gap: 2
                }}>
                  <CircularProgress size={40} sx={{ color: colors.primary }} />
                  <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                    Cargando mensajes...
                  </Typography>
                </Box>
              ) : messages.length === 0 ? (
                <Box sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  gap: 2
                }}>
                  <Message sx={{ fontSize: 60, color: colors.textSecondary, opacity: 0.3 }} />
                  <Typography variant="body1" sx={{ color: colors.textSecondary }}>
                    No hay mensajes en este chat
                  </Typography>
                  <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                    Envía un mensaje para comenzar
                  </Typography>
                </Box>
              ) : (
                // ⚡ OPTIMIZACIÓN: Usar mensajes filtrados memoizados
                filteredMessages.map((msg, index) => (
                  <Box
                    key={msg.id}
                    className="message-container"
                    sx={{
                      display: 'flex',
                      justifyContent: msg.isFromMe ? 'flex-end' : 'flex-start',
                      mb: 1,
                      position: 'relative',
                      // ⚡ OPTIMIZACIÓN: Sin animación para mejor rendimiento
                      opacity: 1
                    }}
                  >
                    {/* Acciones dentro del mensaje ahora estarán debajo del contenido */}

                    <Paper
                      elevation={0}
                      sx={{
                        maxWidth: '65%',
                        bgcolor: msg.isFromMe ? colors.myMessage : colors.theirMessage,
                        p: '10px 12px 10px 12px',
                        borderRadius: msg.isFromMe
                          ? '12px 12px 4px 12px'  // Esquina inferior derecha más pequeña
                          : '12px 12px 12px 4px', // Esquina inferior izquierda más pequeña
                        position: 'relative',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        // 🎨 Hover effect mejorado
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          bgcolor: msg.isFromMe ? colors.myMessageHover : colors.theirMessageHover,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                          transform: 'translateY(-2px)'
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSelectedMessage(msg);
                        setMessageMenuAnchor(e.currentTarget);
                      }}
                    >
                      {/* Nombre del remitente - Siempre visible */}
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          color: msg.isFromMe
                            ? '#075E54'  // Verde oscuro para mensajes propios
                            : '#00897B', // Teal para mensajes recibidos
                          display: 'block',
                          mb: 0.5,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}
                      >
                        {getSenderName(msg)}
                      </Typography>

                      {/* 👤 Chip con nombre del agente/admin - Solo para mensajes propios */}
                      {msg.isFromMe && (
                        <Chip
                          label={msg.agent_id && msg.agent_id !== 0 ? `👤 ${msg.agent_name || 'Agente'}` : '👑 Admin'}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            mb: 0.5,
                            bgcolor: msg.agent_id && msg.agent_id !== 0 ? '#00a884' : '#075E54',
                            color: 'white',
                            '& .MuiChip-label': {
                              px: 1,
                              py: 0
                            }
                          }}
                        />
                      )}

                      {/* Respuesta citada */}
                      {msg.contextInfo && (
                        <Box sx={{ bgcolor: 'rgba(0,0,0,0.1)', p: 1, mb: 1, borderRadius: 1, borderLeft: '4px solid #06cf9c' }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: '#06cf9c' }}>
                            {getQuotedSenderName(msg.contextInfo.quotedMessageSender || '')}
                          </Typography>
                          <Typography variant="body2" noWrap sx={{ color: colors.textSecondary }}>
                            {msg.contextInfo.quotedMessageText}
                          </Typography>
                        </Box>
                      )}

                      {/* Contenido según tipo */}
                      {(() => {
                        // Debug log
                        if (msg.mediaUrl) {
                          console.log(`[CHAT-DEBUG] Mensaje ID: ${msg.id}, Tipo: ${msg.type}, mediaUrl: ${msg.mediaUrl}, mediaMimeType: ${msg.mediaMimeType}`);
                        }
                        return null;
                      })()}

                      {msg.type === 'image' && msg.mediaUrl ? (
                        <Box sx={{ mb: 1 }}>
                          <Box
                            sx={{
                              maxWidth: '300px',
                              maxHeight: '300px',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              cursor: 'pointer',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                              transition: 'transform 0.2s ease-in-out',
                              '&:hover': {
                                transform: 'scale(1.02)',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                              }
                            }}
                            onClick={() => handleImageClick(msg.mediaUrl!)}
                          >
                            <img
                              src={getMediaUrl(msg.mediaUrl)}
                              alt="Imagen"
                              loading="lazy"
                              style={{
                                maxWidth: '100%',
                                maxHeight: '300px',
                                display: 'block',
                                objectFit: 'cover'
                              }}
                              onError={(e) => {
                                console.error('Error cargando imagen. URL original:', msg.mediaUrl, 'URL procesada:', getMediaUrl(msg.mediaUrl));
                                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="300"%3E%3Crect width="300" height="300" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3EImagen no disponible%3C/text%3E%3C/svg%3E';
                              }}
                            />
                          </Box>
                        </Box>
                      ) : msg.type === 'video' && msg.mediaUrl ? (
                        <Box sx={{ mb: 1 }}>
                          <video
                            controls
                            style={{
                              maxWidth: '300px',
                              maxHeight: '300px',
                              borderRadius: '8px',
                              display: 'block',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                            }}
                            onError={(e) => {
                              console.error('Error cargando video:', msg.mediaUrl);
                            }}
                          >
                            <source src={getMediaUrl(msg.mediaUrl)} type={msg.mediaMimeType || 'video/mp4'} />
                            Tu navegador no soporta la reproducción de videos.
                          </video>
                        </Box>
                      ) : msg.type === 'audio' && msg.mediaUrl ? (
                        <Box sx={{ mb: 1 }}>
                          <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            backgroundColor: msg.isFromMe ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.05)',
                            p: 1.5,
                            borderRadius: 2,
                            minWidth: 250,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                          }}>
                            <Avatar
                              src={getAvatarUrlForJid(getSenderJidForMessage(msg) || '')}
                              sx={{ width: 32, height: 32 }}
                            >
                              {(activeChat?.name || (getSenderJidForMessage(msg) || 'U').split('@')[0]).charAt(0).toUpperCase()}
                            </Avatar>
                            <IconButton
                              size="small"
                              onClick={() => handlePlayAudio(msg.id, msg.mediaUrl!)}
                              sx={{
                                width: 36,
                                height: 36,
                                bgcolor: colors.primary,
                                color: 'white',
                                '&:hover': {
                                  bgcolor: '#008069'
                                }
                              }}
                            >
                              {playingAudio === msg.id ? (
                                <Box sx={{ width: 12, height: 12, bgcolor: 'white', borderRadius: '2px' }} />
                              ) : (
                                <PlayArrow sx={{ fontSize: 20 }} />
                              )}
                            </IconButton>
                            <Box sx={{ flex: 1 }}>
                              <Box sx={{ height: 28, display: 'flex', alignItems: 'center', gap: 0.3 }}>
                                {[...Array(40)].map((_, i) => (
                                  <Box
                                    key={i}
                                    sx={{
                                      width: 2,
                                      height: Math.random() * 20 + 8,
                                      bgcolor: playingAudio === msg.id ? colors.primary : colors.textSecondary,
                                      opacity: playingAudio === msg.id ? 0.8 : 0.5,
                                      borderRadius: 1,
                                      transition: 'all 0.2s ease'
                                    }}
                                  />
                                ))}
                              </Box>
                            </Box>
                            <Typography variant="caption" sx={{ color: colors.textSecondary, minWidth: 35, fontSize: '0.75rem', fontWeight: 500 }}>
                              {playingAudio === msg.id ? '▶ ' : ''}
                              <audio
                                ref={(el) => {
                                  if (el && !audioRefs.current[msg.id]) {
                                    audioRefs.current[msg.id] = el;
                                  }
                                }}
                                src={getMediaUrl(msg.mediaUrl)}
                                style={{ display: 'none' }}
                              />
                              Audio
                            </Typography>
                          </Box>
                        </Box>
                      ) : msg.type === 'document' && msg.mediaUrl ? (
                        <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: msg.isFromMe ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)', borderRadius: 2, maxWidth: '300px' }}>
                          <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                            <Description sx={{ fontSize: 20 }} />
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {msg.message || 'Documento.pdf'}
                            </Typography>
                            <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                              Documento
                            </Typography>
                          </Box>
                          <IconButton size="small" onClick={() => window.open(msg.mediaUrl, '_blank')} sx={{ color: colors.textSecondary }}>
                            <Download fontSize="small" />
                          </IconButton>
                        </Box>
                      ) : msg.type === 'sticker' && msg.mediaUrl ? (
                        // Sticker
                        <Box sx={{ mb: 1 }}>
                          <Box
                            sx={{
                              maxWidth: '150px',
                              maxHeight: '150px',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              cursor: 'pointer',
                              transition: 'transform 0.2s ease-in-out',
                              '&:hover': {
                                transform: 'scale(1.1)'
                              }
                            }}
                            onClick={() => handleImageClick(msg.mediaUrl!)}
                          >
                            <img
                              src={getMediaUrl(msg.mediaUrl)}
                              alt="Sticker"
                              loading="lazy"
                              style={{
                                maxWidth: '100%',
                                maxHeight: '150px',
                                display: 'block',
                                objectFit: 'contain',
                                backgroundColor: 'transparent'
                              }}
                              onError={(e) => {
                                console.error('Error cargando sticker:', msg.mediaUrl);
                                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect width="150" height="150" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3ESticker no disponible%3C/text%3E%3C/svg%3E';
                              }}
                            />
                          </Box>
                        </Box>
                      ) : (msg.type === 'image' || msg.type === 'video' || msg.type === 'audio' || msg.type === 'document' || msg.type === 'sticker') && !msg.mediaUrl ? (
                        // Fallback para multimedia sin URL
                        <Box sx={{ mb: 1, p: 1.5, bgcolor: 'rgba(255,152,0,0.1)', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Error sx={{ color: '#ff9800', fontSize: 20 }} />
                          <Box>
                            <Typography variant="body2" sx={{ color: colors.text, fontWeight: 500 }}>
                              {msg.type === 'image' ? '🖼️ Imagen' : msg.type === 'video' ? '🎥 Video' : msg.type === 'audio' ? '🔊 Audio' : msg.type === 'sticker' ? '🎨 Sticker' : '📄 Documento'}
                            </Typography>
                            <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                              {msg.message || 'Multimedia no disponible'}
                            </Typography>
                          </Box>
                        </Box>
                      ) : (
                        <Typography
                          variant="body2"
                          component="div"
                          sx={{
                            color: colors.text,
                            wordBreak: 'break-word',
                            lineHeight: 1.5,
                            fontSize: '14.5px',
                            fontWeight: 400,
                            letterSpacing: '0.01em',
                            '& a': {
                              color: msg.isFromMe ? '#4fc3f7' : '#00a884',
                              textDecoration: 'none',
                              fontWeight: 500,
                              wordBreak: 'break-all',
                              display: 'inline-block',
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                textDecoration: 'underline',
                                opacity: 0.8
                              }
                            }
                          }}
                          dangerouslySetInnerHTML={{
                            __html: msg.message
                              ? msg.message
                                // Detectar URLs y convertirlas en enlaces clicables
                                .replace(
                                  /(https?:\/\/[^\s]+)/g,
                                  '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
                                )
                                // Detectar emails
                                .replace(
                                  /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi,
                                  '<a href="mailto:$1">$1</a>'
                                )
                                // Saltos de línea
                                .replace(/\n/g, '<br/>')
                              : ''
                          }}
                        />
                      )}

                      {/* Hora y estado */}
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: 0.3,
                        mt: 0.5,
                        minWidth: '60px'
                      }}>
                        <Typography
                          variant="caption"
                          sx={{
                            color: msg.isFromMe ? '#667d6f' : colors.textSecondary,
                            fontSize: '11px',
                            lineHeight: 1
                          }}
                        >
                          {formatTime(msg.timestamp)}
                        </Typography>
                        {msg.isFromMe && (
                          <>
                            {msg.status === 'sending' && (
                              <AccessTime sx={{ fontSize: 16, color: '#667d6f', ml: 0.3 }} />
                            )}
                            {msg.status === 'sent' && (
                              <Done sx={{ fontSize: 16, color: '#667d6f' }} />
                            )}
                            {msg.status === 'delivered' && (
                              <DoneAll sx={{ fontSize: 16, color: '#667d6f' }} />
                            )}
                            {msg.status === 'read' && (
                              <DoneAll sx={{ fontSize: 16, color: '#53bdeb' }} />
                            )}
                            {msg.status === 'failed' && (
                              <Error sx={{ fontSize: 16, color: '#f44336' }} />
                            )}
                          </>
                        )}
                      </Box>
                    </Paper>

                    {/* ⚡ OPTIMIZACIÓN: Botón de opciones con CSS hover puro (sin estado React) */}
                    <Box sx={{
                      ml: msg.isFromMe ? 0 : 1,
                      mr: msg.isFromMe ? 1 : 0,
                      display: 'flex',
                      alignItems: 'flex-start',
                      opacity: 0,
                      transition: 'opacity 0.2s ease',
                      // Mostrar en hover del mensaje (CSS puro, sin estado)
                      '.message-container:hover &': {
                        opacity: 1
                      }
                    }}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMessage(msg);
                          setMessageMenuAnchor(e.currentTarget);
                        }}
                        sx={{
                          bgcolor: colors.hover,
                          color: colors.textSecondary,
                          padding: '6px',
                          transition: 'all 0.2s ease',
                          boxShadow: colors.shadow,
                          '&:hover': {
                            bgcolor: colors.hoverStrong,
                            color: colors.text,
                            transform: 'scale(1.1)',
                            boxShadow: colors.shadowStrong
                          }
                        }}
                      >
                        <MoreVert sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                  </Box>
                )))}
              <div ref={messagesEndRef} />
            </Box>

            {/* Barra de respuesta */}
            {replyMessage && (
              <Box sx={{ bgcolor: colors.header, p: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Reply sx={{ color: colors.primary }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" sx={{ color: colors.primary, fontWeight: 600 }}>
                    Respondiendo a {replyMessage.from === 'me' ? 'ti mismo' : replyMessage.from}
                  </Typography>
                  <Typography variant="body2" noWrap sx={{ color: colors.textSecondary }}>
                    {replyMessage.message}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => setReplyMessage?.(null)}>
                  <Close fontSize="small" />
                </IconButton>
              </Box>
            )}

            {/* Vista previa de archivo */}
            {selectedFile && (
              <Box sx={{ bgcolor: colors.header, p: 2, display: 'flex', alignItems: 'center', gap: 2, borderTop: `1px solid ${colors.divider}` }}>
                {filePreview ? (
                  selectedFile.type.startsWith('image/') ? (
                    <img src={filePreview} alt="Preview" style={{ maxWidth: '100px', maxHeight: '100px', borderRadius: '8px', objectFit: 'cover' }} />
                  ) : selectedFile.type.startsWith('video/') ? (
                    <video src={filePreview} style={{ maxWidth: '100px', maxHeight: '100px', borderRadius: '8px', objectFit: 'cover' }} />
                  ) : null
                ) : (
                  <Box sx={{ width: 60, height: 60, backgroundColor: colors.primary, borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Description sx={{ color: 'white', fontSize: 30 }} />
                  </Box>
                )}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ color: colors.text, fontWeight: 600 }}>
                    {selectedFile.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => { setSelectedFile(null); setFilePreview(null); }} sx={{ color: colors.textSecondary }}>
                  <Close />
                </IconButton>
              </Box>
            )}

            {/* Emoji Picker */}
            {showEmojiPicker && (
              <Box sx={{
                position: 'absolute',
                bottom: 70,
                left: 20,
                zIndex: 1000,
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                borderRadius: 2
              }}>
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  theme={Theme.LIGHT as Theme}
                  width={350}
                  height={400}
                />
              </Box>
            )}

            {/* Barra de entrada */}
            <Box sx={{
              bgcolor: colors.header,
              p: '12px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              borderTop: `1px solid ${colors.divider}`,
              boxShadow: '0 -1px 3px rgba(0,0,0,0.06)'
            }}>
              <Tooltip title="Emojis">
                <IconButton
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  sx={{
                    color: colors.textSecondary,
                    p: '8px',
                    '&:hover': {
                      color: colors.primary,
                      bgcolor: colors.hover
                    }
                  }}
                >
                  <InsertEmoticon />
                </IconButton>
              </Tooltip>

              <Tooltip title="Adjuntar">
                <IconButton
                  onClick={() => fileInputRef.current?.click()}
                  sx={{
                    color: colors.textSecondary,
                    p: '8px',
                    '&:hover': {
                      color: colors.primary,
                      bgcolor: colors.hover
                    }
                  }}
                >
                  <AttachFile />
                </IconButton>
              </Tooltip>

              <input
                ref={fileInputRef}
                type="file"
                hidden
                onChange={handleFileSelect}
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
              />

              <TextField
                inputRef={messageInputRef}
                fullWidth
                multiline
                maxRows={5}
                placeholder="Escribe un mensaje aquí"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: colors.theirMessage, // Mismo color que mensajes recibidos
                    borderRadius: '10px',
                    fontSize: '15px',
                    fontWeight: 400,
                    transition: 'all 0.2s ease',
                    '& fieldset': {
                      border: `1px solid ${colors.divider}`,
                      transition: 'all 0.2s ease'
                    },
                    '&:hover': {
                      bgcolor: colors.theirMessageHover, // Mismo hover que mensajes
                      '& fieldset': {
                        borderColor: colors.divider,
                        borderWidth: '1px'
                      }
                    },
                    '&.Mui-focused': {
                      bgcolor: colors.theirMessage, // Mantener mismo color al escribir
                      boxShadow: `0 0 0 2px ${colors.divider}`,
                      '& fieldset': {
                        borderColor: colors.textSecondary,
                        borderWidth: '1px'
                      }
                    },
                    '& textarea': {
                      padding: '11px 14px',
                      lineHeight: 1.5,
                      letterSpacing: '0.01em'
                    }
                  }
                }}
              />

              {messageText.trim() || selectedFile ? (
                <Tooltip title="Enviar">
                  <IconButton
                    onClick={handleSendMessage}
                    sx={{
                      bgcolor: colors.primary,
                      color: 'white',
                      p: '8px',
                      // 🎨 FASE 1: Botón de envío mejorado
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        bgcolor: colors.primaryDark,
                        transform: 'scale(1.1)',
                        boxShadow: colors.shadowStrong
                      },
                      '&:active': {
                        transform: 'scale(0.95)'
                      }
                    }}
                  >
                    <Send />
                  </IconButton>
                </Tooltip>
              ) : (
                <Tooltip title="Grabar audio">
                  <IconButton
                    sx={{
                      color: colors.textSecondary,
                      p: '8px',
                      '&:hover': {
                        color: colors.primary,
                        bgcolor: colors.hover
                      }
                    }}
                  >
                    <Mic />
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            {/* Menú contextual de mensajes - Popover mejorado */}
            <Popover
              anchorEl={messageMenuAnchor}
              open={Boolean(messageMenuAnchor)}
              onClose={() => setMessageMenuAnchor(null)}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              slotProps={{
                paper: {
                  elevation: 8,
                  sx: {
                    minWidth: 220,
                    borderRadius: '12px',
                    bgcolor: colors.sidebar,
                    border: `1px solid ${colors.divider}`,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                    overflow: 'visible',
                    mt: 1,
                    '&::before': {
                      content: '""',
                      display: 'block',
                      position: 'absolute',
                      top: -8,
                      right: 14,
                      width: 16,
                      height: 16,
                      bgcolor: colors.sidebar,
                      border: `1px solid ${colors.divider}`,
                      borderBottom: 'none',
                      borderRight: 'none',
                      transform: 'rotate(45deg)',
                      zIndex: 0,
                    }
                  }
                }
              }}
            >
              <Box sx={{ py: 1 }}>
                <MenuItem
                  onClick={() => { setReplyMessage?.(selectedMessage); setMessageMenuAnchor(null); }}
                  sx={{
                    px: 2,
                    py: 1.2,
                    borderRadius: '8px',
                    mx: 1,
                    my: 0.3,
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: colors.hover,
                      transform: 'translateX(4px)'
                    }
                  }}
                >
                  <Reply sx={{ mr: 1.5, fontSize: 20, color: colors.primary }} /> Responder
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setMessageToForward(selectedMessage);
                    setForwardDialogOpen(true);
                    setMessageMenuAnchor(null);
                  }}
                  sx={{
                    px: 2,
                    py: 1.2,
                    borderRadius: '8px',
                    mx: 1,
                    my: 0.3,
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: colors.hover,
                      transform: 'translateX(4px)'
                    }
                  }}
                >
                  <Forward sx={{ mr: 1.5, fontSize: 20, color: '#2196f3' }} /> Reenviar
                </MenuItem>
                <Divider sx={{ my: 0.5 }} />
                <MenuItem
                  onClick={() => { setShowKanbanModal(true); setMessageMenuAnchor(null); }}
                  sx={{
                    px: 2,
                    py: 1.2,
                    borderRadius: '8px',
                    mx: 1,
                    my: 0.3,
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: colors.hover,
                      transform: 'translateX(4px)'
                    }
                  }}
                >
                  <ViewKanban sx={{ mr: 1.5, fontSize: 20, color: '#673ab7' }} /> Enviar a Kanban
                </MenuItem>
                <MenuItem
                  onClick={() => { setTransferAgentDialogOpen(true); setMessageMenuAnchor(null); }}
                  sx={{
                    px: 2,
                    py: 1.2,
                    borderRadius: '8px',
                    mx: 1,
                    my: 0.3,
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: colors.hover,
                      transform: 'translateX(4px)'
                    }
                  }}
                >
                  <People sx={{ mr: 1.5, fontSize: 20, color: '#ff9800' }} /> Transferir a Agente
                </MenuItem>
                <Divider sx={{ my: 0.5 }} />
                <MenuItem
                  onClick={() => setMessageMenuAnchor(null)}
                  sx={{
                    px: 2,
                    py: 1.2,
                    borderRadius: '8px',
                    mx: 1,
                    my: 0.3,
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: colors.hover,
                      transform: 'translateX(4px)'
                    }
                  }}
                >
                  <Star sx={{ mr: 1.5, fontSize: 20, color: '#ffc107' }} /> Destacar
                </MenuItem>
                {selectedMessage?.isFromMe && (
                  <>
                    <Divider sx={{ my: 0.5 }} />
                    <MenuItem
                      onClick={() => {
                        if (selectedMessage) {
                          openDeleteConfirm(selectedMessage.id, selectedMessage.isFromMe);
                        }
                      }}
                      sx={{
                        px: 2,
                        py: 1.2,
                        borderRadius: '8px',
                        mx: 1,
                        my: 0.3,
                        fontSize: '14px',
                        color: '#f44336',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: 'rgba(244, 67, 54, 0.1)',
                          transform: 'translateX(4px)'
                        }
                      }}
                    >
                      <Delete sx={{ mr: 1.5, fontSize: 20 }} /> Eliminar
                    </MenuItem>
                  </>
                )}
              </Box>
            </Popover>

            {/* Diálogo de reenvío */}
            <Dialog
              open={forwardDialogOpen}
              onClose={() => setForwardDialogOpen(false)}
              maxWidth="sm"
              fullWidth
            >
              <DialogTitle sx={{ bgcolor: colors.header, color: colors.text }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Forward sx={{ color: colors.primary }} />
                  <Typography variant="h6">Reenviar mensaje</Typography>
                </Box>
              </DialogTitle>
              <DialogContent sx={{ bgcolor: colors.background, pt: 3 }}>
                <Typography variant="body2" sx={{ mb: 2, color: colors.textSecondary }}>
                  Selecciona un chat para reenviar este mensaje:
                </Typography>
                <TextField
                  select
                  fullWidth
                  value={selectedChatForForward}
                  onChange={(e) => setSelectedChatForForward(e.target.value)}
                  label="Seleccionar chat"
                  sx={{ '& .MuiOutlinedInput-root': { bgcolor: colors.sidebar } }}
                >
                  {chats
                    .filter(chat => chat.id !== activeChat?.id)
                    .map((chat) => (
                      <MenuItem key={chat.id} value={chat.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar src={`${getAPIBaseURL()}/api/avatar/${sessionId}/${chat.id}`} sx={{ width: 32, height: 32 }}>
                            {chat.name.charAt(0).toUpperCase()}
                          </Avatar>
                          <Typography variant="body2">{chat.name}</Typography>
                        </Box>
                      </MenuItem>
                    ))}
                </TextField>
              </DialogContent>
              <DialogActions sx={{ bgcolor: colors.background, p: 2 }}>
                <Button onClick={() => setForwardDialogOpen(false)} sx={{ color: colors.textSecondary }}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleForwardMessage}
                  variant="contained"
                  disabled={!selectedChatForForward}
                  sx={{ bgcolor: colors.primary, '&:hover': { bgcolor: '#008069' } }}
                >
                  Reenviar
                </Button>
              </DialogActions>
            </Dialog>

            {/* Diálogo de transferir a agente */}
            <Dialog
              open={transferAgentDialogOpen}
              onClose={() => setTransferAgentDialogOpen(false)}
              maxWidth="sm"
              fullWidth
            >
              <DialogTitle sx={{ bgcolor: colors.header, color: colors.text }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <People sx={{ color: '#ff9800' }} />
                  <Typography variant="h6">Transferir chat a agente</Typography>
                </Box>
              </DialogTitle>
              <DialogContent sx={{ bgcolor: colors.background, pt: 3 }}>
                <Typography variant="body2" sx={{ mb: 2, color: colors.textSecondary }}>
                  Selecciona un agente para transferir este chat:
                </Typography>
                <TextField
                  select
                  fullWidth
                  value={selectedAgentForTransfer}
                  onChange={(e) => setSelectedAgentForTransfer(e.target.value)}
                  label="Seleccionar agente"
                  sx={{ '& .MuiOutlinedInput-root': { bgcolor: colors.sidebar } }}
                >
                  {availableAgents.length > 0 ? (
                    availableAgents.map((agent) => (
                      <MenuItem key={agent.id} value={agent.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: '#ff9800' }}>
                            {agent.name?.charAt(0).toUpperCase() || 'A'}
                          </Avatar>
                          <Box>
                            <Typography variant="body2">{agent.name}</Typography>
                            <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                              {agent.email} • {
                                agent.status === 'online' ? '🟢 En línea' :
                                  agent.status === 'busy' ? '🔴 Ocupado' :
                                    agent.status === 'paused' ? '🟡 En pausa' :
                                      '⚫ Desconectado'
                              }
                            </Typography>
                          </Box>
                        </Box>
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem disabled>
                      <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                        No hay agentes disponibles
                      </Typography>
                    </MenuItem>
                  )}
                </TextField>
                {activeChat && (
                  <Paper sx={{ mt: 2, p: 2, bgcolor: '#f0f2f5' }}>
                    <Typography variant="caption" color="textSecondary">Chat a transferir:</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      <Avatar src={`${getAPIBaseURL()}/api/avatar/${sessionId}/${activeChat.id}`} sx={{ width: 32, height: 32 }}>
                        {activeChat.name?.charAt(0).toUpperCase()}
                      </Avatar>
                      <Typography variant="body2" sx={{ color: colors.text }}>
                        {activeChat.name || normalizePhoneNumber(activeChat.id.split('@')[0])}
                      </Typography>
                    </Box>
                  </Paper>
                )}
              </DialogContent>
              <DialogActions sx={{ bgcolor: colors.background, p: 2 }}>
                <Button onClick={() => setTransferAgentDialogOpen(false)} sx={{ color: colors.textSecondary }}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleTransferToAgent}
                  variant="contained"
                  disabled={!selectedAgentForTransfer}
                  sx={{ bgcolor: '#ff9800', '&:hover': { bgcolor: '#f57c00' } }}
                >
                  Transferir
                </Button>
              </DialogActions>
            </Dialog>

            {/* Diálogo de confirmación de eliminación */}
            <Dialog
              open={deleteConfirmOpen}
              onClose={() => setDeleteConfirmOpen(false)}
              maxWidth="xs"
              fullWidth
              PaperProps={{
                sx: {
                  borderRadius: '16px',
                  bgcolor: colors.sidebar
                }
              }}
            >
              <DialogTitle sx={{
                bgcolor: colors.header,
                color: colors.text,
                pb: 2
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    bgcolor: 'rgba(244, 67, 54, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Delete sx={{ color: '#f44336', fontSize: 22 }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Eliminar mensaje
                  </Typography>
                </Box>
              </DialogTitle>

              <DialogContent sx={{ bgcolor: colors.background, pt: 3, pb: 2 }}>
                <Typography variant="body1" sx={{ color: colors.text, mb: 1 }}>
                  ¿Estás seguro de que deseas eliminar este mensaje?
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  Esta acción no se puede deshacer.
                </Typography>
              </DialogContent>

              <DialogActions sx={{ bgcolor: colors.background, p: 2, gap: 1 }}>
                <Button
                  onClick={() => {
                    setDeleteConfirmOpen(false);
                    setMessageToDelete(null);
                  }}
                  sx={{
                    color: colors.textSecondary,
                    textTransform: 'none',
                    px: 3,
                    borderRadius: '8px',
                    '&:hover': {
                      bgcolor: colors.hover
                    }
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleDeleteMessage}
                  variant="contained"
                  sx={{
                    bgcolor: '#f44336',
                    textTransform: 'none',
                    px: 3,
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(244, 67, 54, 0.3)',
                    '&:hover': {
                      bgcolor: '#d32f2f',
                      boxShadow: '0 4px 12px rgba(244, 67, 54, 0.4)'
                    }
                  }}
                >
                  Eliminar
                </Button>
              </DialogActions>
            </Dialog>

            {/* Modal de Kanban */}
            {activeChat && (
              <KanbanSelectorModal
                open={showKanbanModal}
                onClose={() => setShowKanbanModal(false)}
                sessionId={sessionId}
                contact={{
                  jid: activeChat.id,
                  name: activeChat.name,
                  avatar: activeChat.avatar
                }}
                onSuccess={handleKanbanSuccess}
              />
            )}
          </>
        ) : (
          /* Pantalla vacía cuando no hay chat seleccionado */
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            gap: 2,
            bgcolor: colors.background
          }}>
            <WhatsApp sx={{ fontSize: 120, color: colors.textSecondary, opacity: 0.15 }} />
            <Typography variant="h5" sx={{ color: colors.text, fontWeight: 300, mt: 2 }}>
              WhatsApp Web
            </Typography>
            <Typography variant="body2" sx={{ color: colors.textSecondary, textAlign: 'center', maxWidth: 440, px: 4 }}>
              Envía y recibe mensajes sin mantener tu teléfono conectado.
              <br />
              Selecciona un chat para empezar a conversar.
            </Typography>
          </Box>
        )}
      </Box>

      {/* Notificación personalizada */}
      <CustomSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      />

      {/* Lightbox para imágenes */}
      <Dialog
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        maxWidth="lg"
        PaperProps={{
          sx: {
            bgcolor: 'transparent',
            boxShadow: 'none',
            overflow: 'hidden'
          }
        }}
        onClick={() => setLightboxOpen(false)}
      >
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '80vh',
            p: 2
          }}
        >
          <IconButton
            onClick={() => setLightboxOpen(false)}
            sx={{
              position: 'absolute',
              top: 10,
              right: 10,
              bgcolor: 'rgba(0,0,0,0.5)',
              color: 'white',
              '&:hover': {
                bgcolor: 'rgba(0,0,0,0.7)'
              },
              zIndex: 1
            }}
          >
            <Close />
          </IconButton>
          {lightboxImage && (
            <img
              src={lightboxImage}
              alt="Imagen ampliada"
              style={{
                maxWidth: '90vw',
                maxHeight: '90vh',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
              }}
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </Box>
      </Dialog>
    </Box>
  );
};

// Memoizar el componente para evitar re-renders innecesarios
export default React.memo(WhatsAppWebChat, (prevProps, nextProps) => {
  // Solo re-renderizar si cambia el sessionId
  return prevProps.sessionId === nextProps.sessionId;
});
