import React, { useState, useEffect } from 'react';
import { getAPIBaseURL } from '../utils/socketConfig';
import { sessionFetch } from '../utils/sessionFetch';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Stack,
  Badge,
  Tooltip,
  Alert,
  TextField,
  InputAdornment,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  Snackbar,
} from '@mui/material';
import {
  Person,
  Phone,
  Message,
  Star,
  TrendingUp,
  Group,
  Category as CategoryIcon,
  Search,
  Refresh,
  Add,
  MoreVert,
  Edit,
  Delete,
  Palette,
  ArrowForward,
  Close,
  Send,
  EmojiEmotions,
  Upload,
  ViewKanban,
} from '@mui/icons-material';

interface KanbanContactsModuleProps {
  sessionId: string;
}

interface Contact {
  id: string;
  jid?: string;
  name: string;
  phone: string;
  category?: string;
  tags?: string;
  last_message_time?: string;
  avatar?: string;
  avatarUrl?: string;
}

interface KanbanBoard {
  id: string;
  name: string;
  color: string;
  order: number;
  is_default: boolean;
}

const KanbanContactsModule: React.FC<KanbanContactsModuleProps> = ({ sessionId }) => {
  const [boards, setBoards] = useState<KanbanBoard[]>([]);
  const [contacts, setContacts] = useState<{ [key: string]: Contact[] }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedContact, setDraggedContact] = useState<Contact | null>(null);
  const [draggedFromBoard, setDraggedFromBoard] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Estados para búsqueda global
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState<any[]>([]);
  const [searchingGlobal, setSearchingGlobal] = useState(false);
  const [selectedBoardForAdd, setSelectedBoardForAdd] = useState<string>('');
  const [contactMenuAnchor, setContactMenuAnchor] = useState<{ [key: string]: HTMLElement | null }>({});
  const [addingContactToBoard, setAddingContactToBoard] = useState<{ [key: string]: string | null }>({});

  // Estados para dialogs
  const [createBoardDialog, setCreateBoardDialog] = useState(false);
  const [editBoardDialog, setEditBoardDialog] = useState(false);
  const [createContactDialog, setCreateContactDialog] = useState(false);
  const [deleteBoardDialog, setDeleteBoardDialog] = useState(false);
  const [boardToDelete, setBoardToDelete] = useState<KanbanBoard | null>(null);
  const [selectedBoard, setSelectedBoard] = useState<KanbanBoard | null>(null);
  const [boardName, setBoardName] = useState('');
  const [boardColor, setBoardColor] = useState('#607d8b');

  // Estados para importar masivo
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importText, setImportText] = useState<string>('');
  const [importBoardId, setImportBoardId] = useState<string>('');

  // Estados para chat rápido
  const [quickChatOpen, setQuickChatOpen] = useState(false);
  const [quickChatContact, setQuickChatContact] = useState<Contact | null>(null);
  const [quickChatMessage, setQuickChatMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Estados para formulario de contacto
  const [contactForm, setContactForm] = useState({
    name: '',
    phone: '',
    category: 'sin_categoria',
    tags: [] as string[]
  });

  // Menu contextual
  const [menuAnchor, setMenuAnchor] = useState<{ element: HTMLElement; board: KanbanBoard } | null>(null);

  // 📜 Estado para Paginación / Scroll Infinito
  const [boardPagination, setBoardPagination] = useState<{ [boardId: string]: { page: number, hasMore: boolean } }>({});
  const [loadingBoard, setLoadingBoard] = useState<{ [boardId: string]: boolean }>({});

  const handleColumnScroll = (e: React.UIEvent<HTMLDivElement>, boardId: string) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

    // Si estamos cerca del final (a 50px)
    if (scrollHeight - scrollTop - clientHeight < 50) {
      loadMoreContacts(boardId);
    }
  };

  const loadMoreContacts = async (boardId: string) => {
    // Evitar múltiples cargas simultáneas o si no hay más datos
    if (loadingBoard[boardId]) return;

    const currentPagination = boardPagination[boardId] || { page: 1, hasMore: true };
    if (!currentPagination.hasMore) return;

    try {
      setLoadingBoard(prev => ({ ...prev, [boardId]: true }));
      const nextPage = currentPagination.page + 1;

      console.log(`[Kanban-Scroll] 📜 Cargando página ${nextPage} para tablero ${boardId}`);

      const response = await fetch(`${getAPIBaseURL()}/api/kanban/contacts/${sessionId}?boardId=${boardId}&page=${nextPage}&limit=25`);
      const data = await response.json();

      if (data.success && data.contacts) {
        if (data.contacts.length > 0) {
          // Agregar nuevos contactos al estado existente
          setContacts(prev => ({
            ...prev,
            [boardId]: [...(prev[boardId] || []), ...data.contacts]
          }));

          // Actualizar paginación
          setBoardPagination(prev => ({
            ...prev,
            [boardId]: { page: nextPage, hasMore: data.hasMore }
          }));
        } else {
          // No hay más datos
          setBoardPagination(prev => ({
            ...prev,
            [boardId]: { ...currentPagination, hasMore: false }
          }));
        }
      }
    } catch (error) {
      console.error('Error cargando más contactos:', error);
    } finally {
      setLoadingBoard(prev => ({ ...prev, [boardId]: false }));
    }
  };

  useEffect(() => {
    loadBoards();
    loadContacts();
  }, [sessionId]);

  const loadBoards = async () => {
    try {
      const response = await sessionFetch(`${getAPIBaseURL()}/api/kanban/boards/${sessionId}`);
      const data = await response.json();
      if (data.success) {
        setBoards(data.boards || []);
      }
    } catch (error) {
      console.error('Error cargando tableros:', error);
    }
  };

  const loadContacts = async (searchTerm?: string) => {
    try {
      setLoading(true);
      console.log('[Kanban] Cargando contactos del tablero...', searchTerm ? `búsqueda: "${searchTerm}"` : '');

      // Si hay búsqueda, cargar todos los contactos que coincidan
      let url = `${getAPIBaseURL()}/api/kanban/contacts/${sessionId}`;
      if (searchTerm && searchTerm.trim()) {
        // Cargar solo contactos que coincidan con la búsqueda
        url += `?search=${encodeURIComponent(searchTerm)}`;
      }

      const response = await sessionFetch(url);
      const data = await response.json();

      console.log('[Kanban] Respuesta de contactos:', data);

      if (data.success && data.contactsByBoard) {
        console.log(`[Kanban] ✅ ${data.totalContacts} contactos cargados`);
        setContacts(data.contactsByBoard || {});
        setError(null);
      } else {
        console.error('[Kanban] Error en respuesta:', data.error);
        setError(data.error || 'No se pudieron cargar los contactos');
        setContacts({});
      }
    } catch (error) {
      console.error('[Kanban] Error cargando contactos:', error);
      setError('Error cargando contactos del tablero');
      setContacts({});
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBoard = async () => {
    if (!boardName.trim()) return;

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/kanban/boards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          name: boardName,
          color: boardColor,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSuccess('Tablero creado exitosamente');
        setCreateBoardDialog(false);
        setBoardName('');
        setBoardColor('#607d8b');
        loadBoards();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error);
      }
    } catch (error) {
      console.error('Error creando tablero:', error);
      setError('Error creando tablero');
    }
  };

  const handleUpdateBoard = async () => {
    if (!selectedBoard || !boardName.trim()) return;

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/kanban/boards/${selectedBoard.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: boardName,
          color: boardColor,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSuccess('Tablero actualizado');
        setEditBoardDialog(false);
        setSelectedBoard(null);
        loadBoards();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error);
      }
    } catch (error) {
      console.error('Error actualizando tablero:', error);
      setError('Error actualizando tablero');
    }
  };

  const confirmDeleteBoard = (board: KanbanBoard) => {
    setBoardToDelete(board);
    setDeleteBoardDialog(true);
    setMenuAnchor(null);
  };

  const handleDeleteBoard = async () => {
    if (!boardToDelete) return;

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/kanban/boards/${boardToDelete.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        setSuccess('Tablero eliminado exitosamente');
        setDeleteBoardDialog(false);
        setBoardToDelete(null);
        loadBoards();
        loadContacts();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error);
      }
    } catch (error) {
      console.error('Error eliminando tablero:', error);
      setError('Error eliminando tablero');
    }
  };

  const handleCreateContact = async () => {
    if (!contactForm.name || !contactForm.phone) {
      setError('Complete nombre y teléfono');
      return;
    }

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          name: contactForm.name,
          phone: contactForm.phone,
          category: contactForm.category,
          tags: contactForm.tags
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Contacto creado exitosamente');
        setCreateContactDialog(false);
        setContactForm({ name: '', phone: '', category: 'sin_categoria', tags: [] });
        loadContacts(); // Recargar contactos
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error);
      }
    } catch (error) {
      console.error('Error creando contacto:', error);
      setError('Error creando contacto');
    }
  };

  const handleDragStart = (contact: Contact, boardId: string) => {
    setDraggedContact(contact);
    setDraggedFromBoard(boardId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetBoardId: string) => {
    console.log('🎯 handleDrop llamado:', { targetBoardId, draggedContact, draggedFromBoard });

    if (!draggedContact || !draggedFromBoard) {
      console.warn('⚠️ No hay contacto arrastrado');
      return;
    }

    if (draggedFromBoard === targetBoardId) {
      console.log('ℹ️ Mismo tablero, cancelando');
      setDraggedContact(null);
      setDraggedFromBoard(null);
      return;
    }

    // Construir el JID correctamente
    const contactJid = draggedContact.jid || `${draggedContact.phone}@s.whatsapp.net`;

    const payload = {
      sessionId,
      contactJid: contactJid,
      contactName: draggedContact.name,
      contactAvatar: draggedContact.avatar || draggedContact.avatarUrl,
      boardId: targetBoardId,
    };

    console.log('📤 Enviando request:', payload);

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/kanban/move-contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      console.log('📥 Response status:', response.status);
      const data = await response.json();
      console.log('📥 Response data:', data);

      if (data.success) {
        console.log('✅ Contacto movido exitosamente');

        // Actualizar estado local
        setContacts(prev => {
          const newContacts = { ...prev };

          // Remover de tablero anterior
          if (newContacts[draggedFromBoard]) {
            newContacts[draggedFromBoard] = newContacts[draggedFromBoard].filter(
              c => c.id !== draggedContact.id
            );
          }

          // Agregar a nuevo tablero
          if (!newContacts[targetBoardId]) {
            newContacts[targetBoardId] = [];
          }
          newContacts[targetBoardId] = [
            ...newContacts[targetBoardId],
            { ...draggedContact, category: targetBoardId }
          ];

          return newContacts;
        });

        const targetBoard = boards.find(b => b.id === targetBoardId);
        setSuccess(`Contacto movido a ${targetBoard?.name || 'otro tablero'}`);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error);
      }
    } catch (error) {
      console.error('Error categorizando contacto:', error);
      setError('Error categorizando contacto');
    }

    setDraggedContact(null);
    setDraggedFromBoard(null);
  };

  const filterContacts = (boardContacts: Contact[]) => {
    // Ya no necesitamos filtrar aquí porque la búsqueda se hace en el servidor
    return boardContacts;
  };

  // Búsqueda global en toda la BD
  const handleImportCSV = async () => {
    if (!importText.trim()) {
      setError('Pega la lista de contactos');
      return;
    }

    if (!importBoardId) {
      setError('Selecciona un tablero Kanban');
      return;
    }

    try {
      setLoading(true);
      const lines = importText.split('\n').filter(line => line.trim());

      const contactsList = lines.map(line => {
        const [name, phone] = line.split(',').map(s => s.trim());
        return { name, phone };
      });

      let successCount = 0;
      let errorCount = 0;

      for (const contact of contactsList) {
        if (!contact.name || !contact.phone) continue;

        try {
          const contactJid = `${contact.phone}@s.whatsapp.net`;

          const response = await fetch(`${getAPIBaseURL()}/api/kanban/contacts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              boardId: importBoardId,
              contactJid: contactJid,
              notes: `Nombre: ${contact.name}`
            })
          });

          const data = await response.json();
          if (data.success) successCount++;
          else errorCount++;
        } catch (err) {
          errorCount++;
        }
      }

      setSuccess(`✅ Importación completada: ${successCount} contactos agregados, ${errorCount} errores`);
      setShowImportDialog(false);
      setImportText('');
      setImportBoardId('');
      loadContacts();
    } catch (error) {
      console.error('Error importando contactos:', error);
      setError('Error al importar contactos');
    } finally {
      setLoading(false);
    }
  };

  const handleGlobalSearch = async (query: string) => {
    setGlobalSearchQuery(query);

    if (!query || query.trim().length < 2) {
      setGlobalSearchResults([]);
      return;
    }

    try {
      setSearchingGlobal(true);
      const response = await fetch(
        `${getAPIBaseURL()}/api/kanban/search-all-contacts/${sessionId}?search=${encodeURIComponent(query)}`
      );
      const data = await response.json();

      if (data.success) {
        setGlobalSearchResults(data.contacts || []);
        console.log(`[Kanban] 🔍 ${data.totalContacts} contactos encontrados en BD completa`);
      } else {
        setError(data.error);
      }
    } catch (error) {
      console.error('[Kanban] Error en búsqueda global:', error);
      setError('Error buscando contactos');
    } finally {
      setSearchingGlobal(false);
    }
  };

  // Agregar contacto a tablero desde búsqueda
  const handleAddContactToBoard = async (contact: any, boardId: string) => {
    // Protección contra doble clic
    const uniqueKey = `${contact.jid}-${boardId}`;
    if (addingContactToBoard[uniqueKey] === boardId) {
      console.log('[Kanban] ⚠️ Ya hay una solicitud en progreso para este contacto');
      return;
    }

    try {
      setAddingContactToBoard(prev => ({ ...prev, [uniqueKey]: boardId }));

      const response = await fetch(`${getAPIBaseURL()}/api/kanban/move-contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          contactJid: contact.jid || contact.id || `${contact.phone?.replace('@s.whatsapp.net', '')}@s.whatsapp.net`,
          contactName: contact.name,
          contactAvatar: contact.avatarUrl,
          boardId: boardId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        const board = boards.find(b => b.id === boardId);
        setSuccess(`✅ ${contact.name} agregado a ${board?.name || 'tablero'}`);
        console.log(`[Kanban] ✅ Contacto agregado exitosamente a tablero`);

        // Cerrar menú del contacto
        setContactMenuAnchor(prev => ({ ...prev, [contact.jid]: null }));

        // Recargar datos
        await loadContacts();

        // Mantener el modal abierto y buscar de nuevo para actualizar estados
        if (globalSearchQuery.length >= 2) {
          handleGlobalSearch(globalSearchQuery);
        }

        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error);
      }
    } catch (error) {
      console.error('[Kanban] Error agregando contacto:', error);
      setError('Error agregando contacto al tablero');
    } finally {
      setAddingContactToBoard(prev => {
        const newState = { ...prev };
        delete newState[uniqueKey];
        return newState;
      });
    }
  };

  const openEditDialog = (board: KanbanBoard) => {
    setSelectedBoard(board);
    setBoardName(board.name);
    setBoardColor(board.color);
    setEditBoardDialog(true);
    setMenuAnchor(null);
  };

  const getBoardIcon = (boardId: string) => {
    switch (boardId) {
      case 'cliente':
        return <Star />;
      case 'prospecto':
        return <TrendingUp />;
      case 'interesado':
        return <Person />;
      default:
        return <Group />;
    }
  };

  const handleSyncAllContacts = async () => {
    try {
      setSyncing(true);
      setError(null);
      console.log('[Kanban] Iniciando sincronización de todos los contactos...');

      const response = await fetch(`${getAPIBaseURL()}/api/kanban/sync-all-contacts/${sessionId}`, {
        method: 'POST',
      });

      const data = await response.json();
      console.log('[Kanban] Respuesta de sincronización:', data);

      if (data.success) {
        setSuccess(`✅ ${data.syncedCount} contactos sincronizados correctamente`);
        loadContacts(); // Recargar contactos
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(data.error || 'Error al sincronizar contactos');
      }
    } catch (error) {
      console.error('[Kanban] Error sincronizando contactos:', error);
      setError('Error al sincronizar contactos');
    } finally {
      setSyncing(false);
    }
  };

  const cleanPhoneNumber = (phone: string) => {
    // Limpiar el número de WhatsApp para mostrar solo el número
    return phone.replace('@s.whatsapp.net', '').replace('@g.us', '');
  };

  const handleOpenQuickChat = (contact: Contact, e: React.MouseEvent) => {
    e.stopPropagation();
    setQuickChatContact(contact);
    setQuickChatMessage('');
    setQuickChatOpen(true);
    setShowEmojiPicker(false);
  };

  const handleSendQuickMessage = async () => {
    if (!quickChatContact || !quickChatMessage.trim()) return;

    setSendingMessage(true);
    try {
      const phone = quickChatContact.jid || quickChatContact.phone;
      const cleanPhone = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;

      const response = await fetch(`${getAPIBaseURL()}/api/send/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId,
          number: cleanPhone,
          message: quickChatMessage,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('✅ Mensaje enviado correctamente');
        setQuickChatOpen(false);
        setQuickChatMessage('');
      } else {
        setError('❌ Error al enviar mensaje: ' + (result.error || 'Error desconocido'));
      }
    } catch (error) {
      console.error('[Kanban] Error enviando mensaje rápido:', error);
      setError('❌ Error al enviar mensaje');
    } finally {
      setSendingMessage(false);
    }
  };

  const insertEmoji = (emoji: string) => {
    console.log('[Emoji] Insertando emoji:', emoji);
    setQuickChatMessage(prev => {
      const newMessage = prev + emoji;
      console.log('[Emoji] Nuevo mensaje:', newMessage);
      return newMessage;
    });
    // No cerrar el picker automáticamente para poder agregar múltiples emojis
    // setShowEmojiPicker(false);
  };

  const getContactAvatar = (contact: Contact) => {
    // Si tiene avatar, usarlo
    if (contact.avatar) {
      return contact.avatar;
    }
    // Si tiene phone, construir la URL del avatar desde la API
    if (contact.phone) {
      const cleanPhone = cleanPhoneNumber(contact.phone);
      return `${getAPIBaseURL()}/api/avatar/${sessionId}/${cleanPhone}@s.whatsapp.net`;
    }
    return undefined;
  };

  const renderContactCard = (contact: Contact, boardId: string) => {
    // Manejar valores nulos o vacíos
    const displayName = contact.name || contact.phone || 'Sin nombre';
    const avatarLetter = displayName.charAt(0).toUpperCase();

    return (
      <Card
        key={contact.id}
        draggable
        onDragStart={() => handleDragStart(contact, boardId)}
        sx={{
          mb: 2,
          cursor: 'grab',
          bgcolor: '#334155', // Slate 700 - Darker Card
          color: 'white',
          '&:active': { cursor: 'grabbing' },
          transition: 'all 0.2s',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            bgcolor: '#475569' // Hover lighten
          },
        }}
      >
        <CardContent sx={{ p: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar
              src={getContactAvatar(contact)}
              sx={{ bgcolor: boards.find(b => b.id === boardId)?.color || '#999' }}
            >
              {avatarLetter}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {displayName}
              </Typography>
              {contact.phone && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Phone sx={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }} />
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                    {cleanPhoneNumber(contact.phone)}
                  </Typography>
                </Stack>
              )}
              {contact.last_message_time && (
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                  Último mensaje: {new Date(contact.last_message_time).toLocaleDateString()}
                </Typography>
              )}
            </Box>
            <Tooltip title="Chat rápido">
              <IconButton
                size="small"
                onClick={(e) => handleOpenQuickChat(contact, e)}
                sx={{
                  bgcolor: 'rgba(99, 102, 241, 0.2)',
                  color: '#818cf8',
                  '&:hover': {
                    bgcolor: 'rgba(99, 102, 241, 0.4)',
                    transform: 'scale(1.1)',
                  },
                  transition: 'all 0.2s',
                }}
              >
                <Message fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </CardContent>
      </Card>
    );
  };

  const renderColumn = (board: KanbanBoard) => {
    const boardContacts = filterContacts(contacts[board.id] || []);

    return (
      <Grid item xs={12} sm={6} md={4} lg={2.4} key={board.id}>
        <Box
          onDragOver={handleDragOver}
          onDrop={() => handleDrop(board.id)}
          sx={{
            height: '100%',
            minHeight: 500,
            bgcolor: '#1e293b', // Slate 800 Back
            borderRadius: 3,
            p: 2,
            border: draggedFromBoard !== board.id ? `2px dashed ${board.color}40` : '2px solid transparent', // Lower opacity border
            transition: 'all 0.3s',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        >
          {/* Header de columna */}
          <Box
            sx={{
              bgcolor: board.color, // Mantener color del tablero
              color: 'white',
              p: 2,
              borderRadius: 2,
              mb: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              {getBoardIcon(board.id)}
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {board.name}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Badge badgeContent={boardContacts.length > 0 ? boardContacts.length : null} color="error">
                <CategoryIcon />
              </Badge>
              {!board.is_default && (
                <IconButton
                  size="small"
                  onClick={(e) => setMenuAnchor({ element: e.currentTarget, board })}
                  sx={{ color: 'white' }}
                >
                  <MoreVert fontSize="small" />
                </IconButton>
              )}
            </Stack>
          </Box>

          {/* Lista de contactos */}
          <Box
            sx={{ overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}
            onScroll={(e) => handleColumnScroll(e, board.id)}
          >
            {boardContacts.length === 0 ? (
              <Card sx={{ p: 4, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', borderRadius: 2 }}>
                <Typography variant="body2">
                  Arrastra contactos aquí
                </Typography>
              </Card>
            ) : (
              <>
                {boardContacts.map(contact => renderContactCard(contact, board.id))}
                {loadingBoard[board.id] && (
                  <Box sx={{ p: 2, textAlign: 'center', color: 'gray' }}>
                    <Typography variant="caption">Cargando más...</Typography>
                  </Box>
                )}
              </>
            )}
          </Box>
        </Box>
      </Grid>
    );
  };

  const colorOptions = [
    '#9e9e9e', '#f44336', '#e91e63', '#9c27b0', '#673ab7',
    '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688',
    '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107',
    '#ff9800', '#ff5722', '#795548', '#607d8b'
  ];

  return (
    <Box sx={{ p: 3, width: '100%', maxWidth: '100%' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <ViewKanban sx={{ fontSize: 40, color: '#9c27b0' }} />
          Gestión de Contactos Kanban
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Arrastra y suelta contactos para categorizarlos y gestionar tu pipeline
        </Typography>
      </Box>

      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          {/* Espacio reservado para futuros filtros o estadísticas */}
        </Box>
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            startIcon={<Search />}
            onClick={() => setSearchDialogOpen(true)}
            sx={{
              bgcolor: '#ff9800',
              '&:hover': { bgcolor: '#f57c00' },
            }}
          >
            Buscar en BD Completa
          </Button>
          <Button
            variant="contained"
            startIcon={syncing ? <Refresh className="spin" /> : <Refresh />}
            onClick={handleSyncAllContacts}
            disabled={syncing}
            sx={{
              bgcolor: '#2196f3',
              '&:hover': { bgcolor: '#1976d2' },
              '& .spin': {
                animation: 'spin 1s linear infinite',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' },
                },
              },
            }}
          >
            {syncing ? 'Sincronizando...' : 'Sincronizar Todos'}
          </Button>
          <Button
            variant="contained"
            startIcon={<Person />}
            onClick={() => {
              setContactForm({ name: '', phone: '', category: 'sin_categoria', tags: [] });
              setCreateContactDialog(true);
            }}
            sx={{ bgcolor: '#00a884', '&:hover': { bgcolor: '#008069' } }}
          >
            Nuevo Contacto
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              setBoardName('');
              setBoardColor('#607d8b');
              setCreateBoardDialog(true);
            }}
            sx={{ bgcolor: '#9c27b0', '&:hover': { bgcolor: '#7b1fa2' } }}
          >
            Nuevo Tablero
          </Button>
          <Button
            variant="contained"
            startIcon={<Upload />}
            onClick={() => setShowImportDialog(true)}
            sx={{ bgcolor: '#ff9800', '&:hover': { bgcolor: '#f57c00' } }}
          >
            Importar CSV
          </Button>
        </Stack>
      </Box>

      {/* Barra de acciones */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }} justifyContent="flex-end">
        <Tooltip title="Recargar tableros">
          <IconButton onClick={() => { loadBoards(); loadContacts(); }} color="primary">
            <Refresh />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Columnas Kanban */}
      <Grid container spacing={2} sx={{ width: '100%', maxWidth: '100%', m: 0 }}>
        {boards.map(board => renderColumn(board))}
      </Grid>

      {/* Menu contextual de tablero */}
      <Menu
        anchorEl={menuAnchor?.element}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => openEditDialog(menuAnchor!.board)}>
          <Edit sx={{ mr: 1 }} fontSize="small" />
          Editar
        </MenuItem>
        <MenuItem onClick={() => confirmDeleteBoard(menuAnchor!.board)}>
          <Delete sx={{ mr: 1 }} fontSize="small" />
          Eliminar
        </MenuItem>
      </Menu>

      {/* Dialog de confirmación para eliminar tablero */}
      <Dialog
        open={deleteBoardDialog}
        onClose={() => setDeleteBoardDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Delete color="error" />
            <Typography variant="h6">Eliminar Tablero</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Esta acción no se puede deshacer
          </Alert>
          <Typography variant="body1" gutterBottom>
            ¿Estás seguro de eliminar el tablero <strong>"{boardToDelete?.name}"</strong>?
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
            Los contactos asociados a este tablero se eliminarán de la categorización.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button
            onClick={() => setDeleteBoardDialog(false)}
            variant="outlined"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleDeleteBoard}
            variant="contained"
            color="error"
            startIcon={<Delete />}
          >
            Eliminar Tablero
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de crear tablero */}
      <Dialog open={createBoardDialog} onClose={() => setCreateBoardDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Crear Nuevo Tablero</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nombre del Tablero"
            value={boardName}
            onChange={(e) => setBoardName(e.target.value)}
            sx={{ mt: 2, mb: 3 }}
          />

          <Typography variant="subtitle2" gutterBottom>
            <Palette sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
            Color del Tablero
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {colorOptions.map(color => (
              <Box
                key={color}
                onClick={() => setBoardColor(color)}
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: color,
                  borderRadius: 1,
                  cursor: 'pointer',
                  border: boardColor === color ? '3px solid #000' : '1px solid #ddd',
                  '&:hover': { transform: 'scale(1.1)' },
                  transition: 'all 0.2s',
                }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateBoardDialog(false)}>Cancelar</Button>
          <Button onClick={handleCreateBoard} variant="contained" disabled={!boardName.trim()}>
            Crear
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de editar tablero */}
      <Dialog open={editBoardDialog} onClose={() => setEditBoardDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Editar Tablero</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nombre del Tablero"
            value={boardName}
            onChange={(e) => setBoardName(e.target.value)}
            sx={{ mt: 2, mb: 3 }}
          />

          <Typography variant="subtitle2" gutterBottom>
            <Palette sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
            Color del Tablero
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {colorOptions.map(color => (
              <Box
                key={color}
                onClick={() => setBoardColor(color)}
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: color,
                  borderRadius: 1,
                  cursor: 'pointer',
                  border: boardColor === color ? '3px solid #000' : '1px solid #ddd',
                  '&:hover': { transform: 'scale(1.1)' },
                  transition: 'all 0.2s',
                }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditBoardDialog(false)}>Cancelar</Button>
          <Button onClick={handleUpdateBoard} variant="contained" disabled={!boardName.trim()}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de crear contacto */}
      <Dialog open={createContactDialog} onClose={() => setCreateContactDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Crear Nuevo Contacto</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Nombre *"
              value={contactForm.name}
              onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
            />
            <TextField
              fullWidth
              label="Teléfono *"
              value={contactForm.phone}
              onChange={(e) => setContactForm(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="+5491234567890"
            />
            <FormControl fullWidth>
              <InputLabel>Categoría Inicial</InputLabel>
              <Select
                value={contactForm.category}
                onChange={(e: SelectChangeEvent) => setContactForm(prev => ({ ...prev, category: e.target.value }))}
                label="Categoría Inicial"
              >
                {boards.map(board => (
                  <MenuItem key={board.id} value={board.id}>
                    {board.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Etiquetas (separadas por coma)"
              value={contactForm.tags.join(', ')}
              onChange={(e) => setContactForm(prev => ({
                ...prev,
                tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag)
              }))}
              placeholder="vip, importante, nuevo"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateContactDialog(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreateContact} variant="contained">
            Crear Contacto
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de búsqueda global en BD completa */}
      <Dialog
        open={searchDialogOpen}
        onClose={() => {
          setSearchDialogOpen(false);
          setGlobalSearchQuery('');
          setGlobalSearchResults([]);
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box
                sx={{
                  bgcolor: 'primary.main',
                  borderRadius: 2,
                  p: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Search sx={{ color: 'white', fontSize: 24 }} />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={600}>
                  Búsqueda Completa
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Buscar en toda la base de datos ({globalSearchResults.length > 0 ? `${globalSearchResults.length} encontrados` : 'escribe para buscar'})
                </Typography>
              </Box>
            </Stack>
            <IconButton
              onClick={() => {
                setSearchDialogOpen(false);
                setGlobalSearchQuery('');
                setGlobalSearchResults([]);
              }}
              size="small"
            >
              <Close />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            autoFocus
            fullWidth
            placeholder="Nombre, teléfono o cualquier dato del contacto..."
            value={globalSearchQuery}
            onChange={(e) => {
              const query = e.target.value;
              setGlobalSearchQuery(query);
              if (query.length >= 2) {
                // Debounce búsqueda
                if ((window as any).globalSearchTimeout) {
                  clearTimeout((window as any).globalSearchTimeout);
                }
                (window as any).globalSearchTimeout = setTimeout(() => {
                  handleGlobalSearch(query);
                }, 500);
              } else {
                setGlobalSearchResults([]);
              }
            }}
            sx={{
              mb: 3,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                bgcolor: 'background.default',
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search color="action" />
                </InputAdornment>
              ),
            }}
          />

          {searchingGlobal && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                🔍 Buscando en toda la base de datos...
              </Typography>
            </Box>
          )}

          {globalSearchResults.length > 0 && (
            <Box>
              <Stack spacing={1.5}>
                {globalSearchResults.map((contact) => (
                  <Card
                    key={contact.jid}
                    sx={{
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      transition: 'all 0.2s',
                      '&:hover': {
                        borderColor: 'primary.main',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        transform: 'translateY(-2px)',
                      }
                    }}
                  >
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Avatar
                          src={contact.avatarUrl}
                          sx={{
                            width: 48,
                            height: 48,
                            border: '2px solid',
                            borderColor: 'background.paper',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                          }}
                        >
                          {contact.name[0]}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.25 }}>
                            {contact.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Phone sx={{ fontSize: 14 }} />
                            {contact.phone}
                          </Typography>
                          {contact.inKanban && (
                            <Chip
                              label={`📋 ${contact.currentBoardName}`}
                              size="small"
                              color="success"
                              variant="outlined"
                              sx={{ mt: 1, fontWeight: 500 }}
                            />
                          )}
                        </Box>
                        <Button
                          variant="contained"
                          size="medium"
                          disabled={Object.values(addingContactToBoard).length > 0}
                          endIcon={<ArrowForward />}
                          onClick={(e) => setContactMenuAnchor(prev => ({ ...prev, [contact.jid]: e.currentTarget }))}
                          sx={{
                            borderRadius: 2,
                            textTransform: 'none',
                            px: 2.5,
                            boxShadow: 'none',
                            '&:hover': {
                              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            }
                          }}
                        >
                          Agregar a Tablero
                        </Button>
                        <Menu
                          anchorEl={contactMenuAnchor[contact.jid]}
                          open={Boolean(contactMenuAnchor[contact.jid])}
                          onClose={() => setContactMenuAnchor(prev => ({ ...prev, [contact.jid]: null }))}
                          PaperProps={{
                            sx: {
                              borderRadius: 2,
                              mt: 1,
                              minWidth: 200,
                              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                            }
                          }}
                        >
                          {boards.map((board) => (
                            <MenuItem
                              key={board.id}
                              disabled={addingContactToBoard[`${contact.jid}-${board.id}`] === board.id}
                              onClick={() => handleAddContactToBoard(contact, board.id)}
                              sx={{
                                py: 1.5,
                                px: 2,
                                borderRadius: 1,
                                mx: 0.5,
                                '&:hover': {
                                  bgcolor: 'action.hover',
                                }
                              }}
                            >
                              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ width: '100%' }}>
                                <Box
                                  sx={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: '50%',
                                    bgcolor: board.color || '#607d8b',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                  }}
                                />
                                <Typography variant="body2" fontWeight={500}>
                                  {board.name}
                                </Typography>
                              </Stack>
                            </MenuItem>
                          ))}
                        </Menu>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          )}

          {globalSearchQuery.length >= 2 && !searchingGlobal && globalSearchResults.length === 0 && (
            <Alert
              severity="info"
              sx={{
                borderRadius: 2,
                '& .MuiAlert-icon': {
                  fontSize: 24,
                }
              }}
            >
              No se encontraron contactos con <strong>"{globalSearchQuery}"</strong>
            </Alert>
          )}

          {globalSearchQuery.length < 2 && !searchingGlobal && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                💡 Escribe al menos 2 caracteres para buscar en toda la base de datos
              </Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo de Chat Rápido */}

      <Dialog
        open={quickChatOpen}
        onClose={() => setQuickChatOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          style: {
            borderRadius: 16,
            overflow: 'visible',
            backgroundColor: '#1e293b', // Fondo oscuro principal
            color: '#f1f5f9', // Texto claro
            border: '1px solid #334155' // Borde sutil
          }
        }}
        BackdropProps={{
          style: {
            backdropFilter: 'blur(3px)',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
          }
        }}
      >
        <DialogTitle
          sx={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            color: 'white',
            borderBottom: '1px solid #334155',
            p: 2.5,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ position: 'relative' }}>
                <Avatar
                  src={quickChatContact ? getContactAvatar(quickChatContact) : undefined}
                  sx={{
                    width: 50,
                    height: 50,
                    border: '3px solid #3b82f6',
                    bgcolor: '#334155',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                  }}
                >
                  <Message />
                </Avatar>
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    bgcolor: '#22c55e',
                    border: '2px solid #1e293b'
                  }}
                />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  Chat Rápido
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TrendingUp sx={{ fontSize: 14 }} />
                  Enviar mensaje a {quickChatContact?.name || quickChatContact?.phone || '...'}
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={() => setQuickChatOpen(false)} sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', color: 'white' } }}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 3, bgcolor: '#1e293b' }}>
          <Box sx={{ mt: 1, position: 'relative' }}>
            <TextField
              fullWidth
              multiline
              rows={4}
              variant="outlined"
              value={quickChatMessage}
              onChange={(e) => setQuickChatMessage(e.target.value)}
              placeholder="Escribe tu mensaje aquí..."
              disabled={sendingMessage}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey && !sendingMessage) {
                  handleSendQuickMessage();
                }
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 3,
                  bgcolor: '#0f172a', // Fondo input muy oscuro
                  color: '#f8fafc', // Texto blanco
                  fontSize: '1rem',
                  '& fieldset': {
                    borderColor: '#334155',
                    borderWidth: 1,
                  },
                  '&:hover fieldset': {
                    borderColor: '#475569',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#3b82f6', // Azul focus
                  },
                },
                '& .MuiInputBase-input': {
                  '&::placeholder': {
                    color: '#64748b',
                    opacity: 1,
                  },
                },
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title={showEmojiPicker ? "Cerrar emojis" : "Agregar emoji"}>
                      <IconButton
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowEmojiPicker(!showEmojiPicker);
                        }}
                        disabled={sendingMessage}
                        sx={{
                          color: showEmojiPicker ? '#3b82f6' : '#94a3b8',
                          '&:hover': {
                            bgcolor: 'rgba(59, 130, 246, 0.1)',
                            color: '#3b82f6',
                          }
                        }}
                      >
                        <EmojiEmotions />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                )
              }}
            />

            {showEmojiPicker && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 'calc(100% + 8px)',
                  right: 0,
                  bgcolor: '#1e293b', // Fondo picker oscuro
                  borderRadius: 3,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  border: '1px solid #334155',
                  zIndex: 9999,
                  maxWidth: 360,
                }}
              >
                <Box sx={{
                  p: 1.5,
                  borderBottom: '1px solid #334155',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#f1f5f9' }}>
                    😊 Selecciona un emoji
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => setShowEmojiPicker(false)}
                    sx={{ p: 0.5, color: '#94a3b8' }}
                  >
                    <Close fontSize="small" />
                  </IconButton>
                </Box>
                <Box sx={{
                  p: 2,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(8, 1fr)',
                  gap: 1.5,
                }}>
                  {['😀', '😃', '😄', '😁', '😊', '😍', '🥰', '😘', '😂', '🤣', '😉', '😎', '🤔', '🤗', '🙌', '👍',
                    '👋', '🙏', '💪', '✨', '🎉', '🎊', '❤️', '💚', '💙', '💜', '🔥', '⭐', '✅', '❌', '📱', '💻'].map((emoji, index) => (
                      <Box
                        key={`${emoji}-${index}`}
                        onClick={() => insertEmoji(emoji)}
                        sx={{
                          fontSize: '1.8rem',
                          cursor: 'pointer',
                          textAlign: 'center',
                          p: 1,
                          borderRadius: 2,
                          transition: 'all 0.2s',
                          // bgcolor: 'rgba(255,255,255,0.02)',
                          '&:hover': {
                            bgcolor: 'rgba(59, 130, 246, 0.2)',
                            transform: 'scale(1.25)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                          },
                          '&:active': {
                            transform: 'scale(0.95)',
                          }
                        }}
                      >
                        {emoji}
                      </Box>
                    ))}
                </Box>
              </Box>
            )}
          </Box>

          <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#94a3b8' }}>
            💡 Presiona Ctrl + Enter para enviar rápidamente
          </Typography>
        </DialogContent>

        <DialogActions
          sx={{
            bgcolor: '#1e293b',
            borderTop: '1px solid #334155',
            p: 2,
            gap: 1,
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 16,
          }}
        >
          <Button
            onClick={() => setQuickChatOpen(false)}
            disabled={sendingMessage}
            variant="outlined"
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              px: 3,
              borderColor: '#475569',
              color: '#94a3b8',
              '&:hover': {
                borderColor: '#64748b',
                bgcolor: 'rgba(255,255,255,0.05)',
                color: '#f1f5f9'
              }
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSendQuickMessage}
            disabled={sendingMessage || !quickChatMessage.trim()}
            variant="contained"
            startIcon={sendingMessage ? null : <Send />}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              px: 3,
              background: 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)', // Verde WhatsApp
              boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)',
              color: '#fff',
              fontWeight: 600,
              '&:hover': {
                background: 'linear-gradient(135deg, #20bd5a 0%, #0e7a6d 100%)',
                boxShadow: '0 6px 16px rgba(37, 211, 102, 0.4)',
                transform: 'translateY(-2px)',
              },
              '&:disabled': {
                background: '#334155',
                color: '#64748b',
                boxShadow: 'none'
              },
              transition: 'all 0.2s',
            }}
          >
            {sendingMessage ? 'Enviando...' : 'Enviar Mensaje'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog para importar masivo */}
      <Dialog
        open={showImportDialog}
        onClose={() => {
          setShowImportDialog(false);
          setImportText('');
          setImportBoardId('');
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Importar Contactos Masivos</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="info">
              <Typography variant="body2">
                Pega tu lista aquí. <strong>Formato: Nombre,Teléfono</strong> (uno por línea)
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                Ejemplo:<br />
                Juan Perez,595123456789<br />
                Maria Lopez,595987654321
              </Typography>
            </Alert>

            <TextField
              multiline
              rows={10}
              fullWidth
              placeholder="Pega aquí tu lista...&#10;Juan Perez,595123456789&#10;Maria Lopez,595987654321"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              sx={{
                '& .MuiInputBase-root': {
                  fontFamily: 'monospace',
                  fontSize: '0.9rem'
                }
              }}
            />

            {importText && (
              <Typography variant="caption" color="success.main">
                ✓ {importText.split('\n').filter(l => l.trim()).length} contactos detectados
              </Typography>
            )}

            <FormControl fullWidth required>
              <InputLabel>Tablero Kanban *</InputLabel>
              <Select
                value={importBoardId}
                label="Tablero Kanban *"
                onChange={(e) => setImportBoardId(e.target.value)}
              >
                {boards.map((board) => (
                  <MenuItem key={board.id} value={board.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          bgcolor: board.color
                        }}
                      />
                      {board.name}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Typography variant="caption" color="info.main">
              💡 Todos los contactos se agregarán al tablero seleccionado
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowImportDialog(false);
            setImportText('');
            setImportBoardId('');
          }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleImportCSV}
            disabled={!importText.trim() || !importBoardId || loading}
          >
            {loading ? 'Importando...' : 'Importar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notificaciones modernas con Snackbar */}
      <Snackbar
        open={Boolean(success)}
        autoHideDuration={4000}
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSuccess(null)} severity="success" variant="filled" sx={{ width: '100%' }}>
          {success}
        </Alert>
      </Snackbar>

      <Snackbar
        open={Boolean(error)}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setError(null)} severity="error" variant="filled" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box >
  );
};

export default KanbanContactsModule;
