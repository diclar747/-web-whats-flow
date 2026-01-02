import React, { useState, useEffect, useCallback } from 'react';
import { getAPIBaseURL } from '../utils/socketConfig';
import { sessionFetch } from '../utils/sessionFetch';
import { useSocket } from '../context/SocketContext';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  LinearProgress,
  Alert,
  Stack,
  Tab,
  Tabs,
  Menu,
  MenuItem,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  Avatar,
  Badge,
  CircularProgress,
  TablePagination,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
} from '@mui/material';
import {
  PersonAdd,
  GroupAdd,
  Upload,
  Download,
  Delete,
  Edit,
  Person,
  Group,
  Phone,
  Search,
  MoreVert,
  Folder,
  Refresh,
  CheckCircle,
  Chat,
  WhatsApp,
  Send,
  EmojiEmotions,
  Close,
} from '@mui/icons-material';
import { useTheme } from '../contexts/ThemeContext';

interface Contact {
  id: string;
  phone: string;
  name: string;
  category: string;
  tags: string[];
  groupIds: string[];
  addedAt: string;
}

interface ContactGroup {
  id: string;
  name: string;
  description: string;
  contactIds: string[];
  createdAt: string;
  color: string;
}

interface ContactsManagerModuleProps {
  sessionId: string;
}

interface SyncedContact {
  id: string;
  jid: string;
  name: string;
  notify: string;
  avatar?: string;
  isGroup: boolean;
  isOnline?: boolean;
}

const ContactsManagerModule: React.FC<ContactsManagerModuleProps> = ({ sessionId }) => {
  const { isDarkMode } = useTheme();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [syncedContacts, setSyncedContacts] = useState<SyncedContact[]>([]);
  const [syncedGroups, setSyncedGroups] = useState<any[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [currentTab, setCurrentTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncGroupsLoading, setSyncGroupsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [syncStats, setSyncStats] = useState<any>(null);
  const [groupsSyncStats, setGroupsSyncStats] = useState<any>(null);

  // Kanban state
  const [boards, setBoards] = useState<any[]>([]);

  // Dialogs
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showKanbanDialog, setShowKanbanDialog] = useState(false);
  const [selectedContactForKanban, setSelectedContactForKanban] = useState<SyncedContact | null>(null);

  // Estados para editar nombre
  const [showEditNameDialog, setShowEditNameDialog] = useState(false);
  const [editingContactName, setEditingContactName] = useState('');
  const [contactToEdit, setContactToEdit] = useState<SyncedContact | null>(null);

  // Estados para ver miembros del grupo
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Estados para chat rápido
  const [showQuickChatDialog, setShowQuickChatDialog] = useState(false);
  const [quickChatContact, setQuickChatContact] = useState<SyncedContact | null>(null);
  const [quickChatMessage, setQuickChatMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Funciones de sincronización
  const handleSyncContacts = async () => {
    try {
      setSyncLoading(true);
      setError(null);
      console.log('🔄 Sincronizando contactos y avatares...');

      // Paso 1: Sincronizar contactos
      console.log('📥 Paso 1/2: Sincronizando contactos desde WhatsApp...');
      const contactsResponse = await fetch(`${getAPIBaseURL()}/api/sync/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });

      if (!contactsResponse.ok) {
        throw new Error(`HTTP ${contactsResponse.status}: ${contactsResponse.statusText}`);
      }

      const contentType = contactsResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await contactsResponse.text();
        console.error('Respuesta no JSON:', text.substring(0, 200));
        throw new Error('La respuesta del servidor no es JSON válido');
      }

      const contactsData = await contactsResponse.json();

      if (contactsData.success) {
        setSyncStats((prev: any) => ({ ...prev, contacts: contactsData.stats }));
        console.log('✅ Contactos sincronizados:', contactsData.stats);

        // Paso 2: Actualizar avatares
        console.log('🖼️ Paso 2/2: Actualizando avatares de contactos...');
        const avatarsResponse = await fetch(`${getAPIBaseURL()}/api/update-contacts-avatars/${sessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        const avatarsData = await avatarsResponse.json();

        if (avatarsData.success) {
          console.log('✅ Avatares actualizados:', avatarsData.stats);
          setSuccess(`✅ Sincronización completa: ${contactsData.stats.processedContacts} contactos y ${avatarsData.stats.updatedAvatars} avatares actualizados`);

          // Recargar contactos para mostrar los cambios
          await loadSyncedContacts();
        } else {
          console.error('⚠️ Error actualizando avatares:', avatarsData.error);
          setSuccess(`✅ Contactos sincronizados: ${contactsData.stats.processedContacts} contactos (avatares: ${avatarsData.error})`);
        }
      } else {
        console.error('Error sincronizando contactos:', contactsData.error);
        setError(`❌ Error: ${contactsData.error}`);
      }
    } catch (error) {
      console.error('Error en sincronización:', error);
      setError('❌ Error al sincronizar contactos');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleUpdateAvatars = async () => {
    try {
      setSyncLoading(true);
      setError(null);
      console.log('Actualizando avatares...');

      const response = await fetch(`${getAPIBaseURL()}/api/update-contacts-avatars/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        console.log('Avatares actualizados:', data.stats);
        setSuccess(`✅ Avatares actualizados: ${data.stats.updatedAvatars} de ${data.stats.totalContacts} contactos`);
      } else {
        console.error('Error actualizando avatares:', data.error);
        setError(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error actualizando avatares:', error);
      setError('❌ Error al actualizar avatares');
    } finally {
      setSyncLoading(false);
    }
  };

  // Función para enviar mensaje rápido
  const handleSendQuickMessage = async () => {
    if (!quickChatMessage.trim() || !quickChatContact) return;

    try {
      setSendingMessage(true);
      setError(null);

      const response = await fetch(`${getAPIBaseURL()}/api/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          to: quickChatContact.jid,
          message: quickChatMessage
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`✅ Mensaje enviado a ${quickChatContact.name || quickChatContact.jid}`);
        setQuickChatMessage('');
        setShowQuickChatDialog(false);
        setShowEmojiPicker(false);
      } else {
        setError(`❌ Error: ${data.error || 'No se pudo enviar el mensaje'}`);
      }
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      setError('❌ Error al enviar el mensaje');
    } finally {
      setSendingMessage(false);
    }
  };

  // Emojis comunes para selector rápido
  const commonEmojis = [
    '😊', '😂', '❤️', '👍', '🙏', '😍', '🎉', '✨',
    '🔥', '💪', '👏', '🤝', '💯', '⭐', '🎯', '✅',
    '📱', '💼', '🏆', '🎁', '☕', '🌟', '💡', '🚀'
  ];


  const handleSyncGroups = async () => {
    try {
      setSyncGroupsLoading(true);
      setError(null);
      console.log('Sincronizando grupos...');

      const response = await fetch(`${getAPIBaseURL()}/api/sync/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });

      const data = await response.json();

      if (data.success) {
        setGroupsSyncStats(data.stats);
        console.log('Grupos sincronizados:', data.stats);
        setSuccess(`✅ Grupos sincronizados: ${data.stats.groups} grupos, ${data.stats.totalMembers} miembros totales`);
        // Recargar grupos después de sincronizar
        loadSyncedGroups();
      } else {
        console.error('Error sincronizando grupos:', data.error);
        setError(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error en sincronización de grupos:', error);
      setError('❌ Error al sincronizar grupos');
    } finally {
      setSyncGroupsLoading(false);
    }
  };

  // Cargar contactos sincronizados al iniciar
  const loadSyncedContacts = useCallback(async () => {
    try {
      const response = await sessionFetch(`${getAPIBaseURL()}/api/contacts/${sessionId}`);
      const data = await response.json();

      if (data.success && data.contacts) {
        // Filtrar solo contactos individuales (no grupos)
        const individualContacts = data.contacts.filter((contact: SyncedContact) => !contact.isGroup);
        setSyncedContacts(individualContacts);
        console.log('Contactos sincronizados cargados:', individualContacts.length);
        console.log('Muestra de contactos:', individualContacts.slice(0, 3));

        // Los avatares ya vienen en la API, no necesitamos cargarlos por separado
      }
    } catch (error) {
      console.error('Error cargando contactos sincronizados:', error);
    }
  }, [sessionId]);


  // Cargar grupos sincronizados al iniciar
  const loadSyncedGroups = useCallback(async () => {
    try {
      const response = await sessionFetch(`${getAPIBaseURL()}/api/groups/${sessionId}`);
      const data = await response.json();

      if (data.success && data.groups) {
        setSyncedGroups(data.groups);
        console.log('Grupos sincronizados cargados:', data.groups.length);
      }
    } catch (error) {
      console.error('Error cargando grupos sincronizados:', error);
    }
  }, [sessionId]);

  useEffect(() => {
    loadSyncedContacts();
    loadSyncedGroups();
  }, [loadSyncedContacts, loadSyncedGroups]);

  // Escuchar evento de avatares descargados
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return;

    const handleAvatarsDownloaded = (data: any) => {
      console.log('🖼️ [ContactsManager] Avatares descargados evento recibido:', data);
      // Recargar contactos para mostrar los avatares recién descargados
      console.log('🔄 [ContactsManager] Recargando contactos para mostrar avatares actualizados...');
      loadSyncedContacts();
      loadSyncedGroups();
    };

    socket.on('avatars-downloaded', handleAvatarsDownloaded);

    return () => {
      socket.off('avatars-downloaded', handleAvatarsDownloaded);
    };
  }, [socket, loadSyncedContacts, loadSyncedGroups]);

  // Función para cargar miembros de un grupo
  const loadGroupMembers = async (group: any) => {
    try {
      setLoadingMembers(true);
      setSelectedGroup(group);
      setShowMembersDialog(true);

      console.log('[ContactsManager] Loading members for group:', group.id || group.jid);

      const response = await fetch(`${getAPIBaseURL()}/api/group/participants/${sessionId}/${group.id || group.jid}`);
      const data = await response.json();

      if (response.ok && data.success && data.participants) {
        console.log('[ContactsManager] Members loaded:', data.participants.length);
        setGroupMembers(data.participants);
      } else {
        console.error('[ContactsManager] Failed to load members:', data.error);
        setGroupMembers([]);
        setError('Error al cargar miembros del grupo');
      }
    } catch (error) {
      console.error('[ContactsManager] Error loading group members:', error);
      setGroupMembers([]);
      setError('Error al cargar miembros del grupo');
    } finally {
      setLoadingMembers(false);
    }
  };

  // Función para guardar el nombre editado
  const handleSaveEditedName = async () => {
    if (!contactToEdit || !editingContactName.trim()) {
      setError('El nombre no puede estar vacío');
      return;
    }

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/contacts/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          jid: contactToEdit.jid,
          name: editingContactName.trim()
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('✅ Contacto actualizado correctamente');
        setShowEditNameDialog(false);
        setContactToEdit(null);
        setEditingContactName('');
        loadSyncedContacts();
      } else {
        setError('Error: ' + data.error);
      }
    } catch (err) {
      setError('Error al actualizar contacto');
      console.error(err);
    }
  };

  const [showContactDialog, setShowContactDialog] = useState(false);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // Import states
  const [importText, setImportText] = useState('');
  const [importProgress, setImportProgress] = useState(0);
  const [selectedGroupIdForImport, setSelectedGroupIdForImport] = useState<string>('');

  // Form states
  const [contactForm, setContactForm] = useState({
    name: '',
    phone: '',
    category: 'cliente',
    tags: [] as string[]
  });

  const [groupForm, setGroupForm] = useState({
    name: '',
    description: '',
    color: '#00a884'
  });

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedContactMenu, setSelectedContactMenu] = useState<Contact | null>(null); // For regular contacts
  const [selectedSyncedContactMenu, setSelectedSyncedContactMenu] = useState<SyncedContact | null>(null); // For synced contacts

  // Pagination states
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(12);

  const loadContacts = useCallback(() => {
    try {
      const savedContacts = localStorage.getItem(`contacts_${sessionId}`);
      if (savedContacts) {
        const parsed = JSON.parse(savedContacts);
        // Filtrar solo contactos válidos (que tengan nombre y teléfono)
        const validContacts = parsed.filter((c: Contact) =>
          c.phone &&
          c.name &&
          c.name !== 'Sin categoría' &&
          c.addedAt &&
          c.addedAt !== 'Invalid Date'
        );
        setContacts(validContacts);
      }
    } catch (error) {
      console.error('Error cargando contactos:', error);
    }
  }, [sessionId]);

  const loadGroups = useCallback(() => {
    try {
      const savedGroups = localStorage.getItem(`groups_${sessionId}`);
      if (savedGroups) {
        setGroups(JSON.parse(savedGroups));
      }
    } catch (error) {
      console.error('Error cargando grupos:', error);
    }
  }, [sessionId]);

  // Function to load Kanban boards
  const loadKanbanBoards = async () => {
    try {
      console.log('[Kanban] Cargando tableros...');
      const response = await sessionFetch(`${getAPIBaseURL()}/api/kanban/boards/${sessionId}`);
      const data = await response.json();

      console.log('[Kanban] Respuesta del servidor:', data);

      if (data.success && data.boards) {
        console.log(`[Kanban] ✅ ${data.boards.length} tableros cargados`);
        setBoards(data.boards);

        // Cargar contactos de Kanban
        await loadKanbanContacts();
      } else {
        console.log('[Kanban] No se encontraron tableros');
        setBoards([]);
      }
    } catch (error) {
      console.error('[Kanban] Error loading boards:', error);
      setBoards([]);
    }
  };

  // Function to load Kanban contacts
  const loadKanbanContacts = async () => {
    try {
      console.log('[Kanban] Cargando contactos...');
      const response = await sessionFetch(`${getAPIBaseURL()}/api/kanban/contacts/${sessionId}`);
      const data = await response.json();

      console.log('[Kanban] Contactos recibidos:', data);

      if (data.success && data.contactsByBoard) {
        console.log(`[Kanban] ✅ ${data.totalContacts} contactos cargados`);
        // Aquí procesarías los contactos por board
      }
    } catch (error) {
      console.error('[Kanban] Error loading contacts:', error);
    }
  };

  // Load data on mount
  useEffect(() => {
    loadContacts();
    loadGroups();
    loadKanbanBoards(); // Load Kanban boards at startup
  }, [sessionId]); // Solo depender de sessionId, no de las funciones

  const saveContacts = (contactsToSave: Contact[]) => {
    console.log(`[ContactsManager] Attempting to save contacts for sessionId: ${sessionId}. Count: ${contactsToSave.length}`);
    if (!sessionId) {
      console.error('[ContactsManager] Cannot save contacts: sessionId is missing.');
      setError('Error interno: No se pudo identificar la sesión para guardar contactos.');
      return;
    }
    try {
      localStorage.setItem(`contacts_${sessionId}`, JSON.stringify(contactsToSave));
      console.log(`[ContactsManager] Contacts saved successfully for sessionId: ${sessionId}`);
    } catch (e) {
      console.error(`[ContactsManager] Error saving contacts to localStorage for session ${sessionId}:`, e);
      setError('Error al guardar contactos. El almacenamiento local podría estar lleno o inaccesible.');
    }
  };

  const saveGroups = (groupsToSave: ContactGroup[]) => {
    console.log(`[ContactsManager] Attempting to save groups for sessionId: ${sessionId}. Count: ${groupsToSave.length}`);
    if (!sessionId) {
      console.error('[ContactsManager] Cannot save groups: sessionId is missing.');
      setError('Error interno: No se pudo identificar la sesión para guardar grupos.');
      return;
    }
    try {
      localStorage.setItem(`groups_${sessionId}`, JSON.stringify(groupsToSave));
      console.log(`[ContactsManager] Groups saved successfully for sessionId: ${sessionId}`);
    } catch (e) {
      console.error(`[ContactsManager] Error saving groups to localStorage for session ${sessionId}:`, e);
      setError('Error al guardar grupos. El almacenamiento local podría estar lleno o inaccesible.');
    }
  };

  const handleBulkImport = async () => {
    if (!importText.trim()) {
      setError('Ingrese los contactos a importar');
      return;
    }

    setLoading(true);
    setImportProgress(0);

    try {
      const lines = importText.trim().split('\n');
      const newContacts: Contact[] = [];
      const newContactIdsForGroup: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim()) {
          const parts = line.split(',').map(p => p.trim());
          if (parts.length >= 2) {
            const phone = parts[0];
            const name = parts[1];
            const category = parts[2] || 'cliente';
            const tags = parts[3] ? parts[3].split(';').map(t => t.trim()) : [];

            if (phone.match(/^\+?[1-9]\d{1,14}$/)) {
              const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;

              const exists = contacts.find(c => c.phone === formattedPhone);
              if (!exists) {
                newContacts.push({
                  id: Date.now().toString() + i,
                  phone: formattedPhone,
                  name: name,
                  category: category,
                  tags: tags,
                  groupIds: selectedGroupIdForImport ? [selectedGroupIdForImport] : [],
                  addedAt: new Date().toISOString()
                });
                if (selectedGroupIdForImport) {
                  newContactIdsForGroup.push(Date.now().toString() + i);
                }
              }
            }
          }
        }

        setImportProgress(Math.round((i + 1) / lines.length * 100));
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const updatedContacts = [...contacts, ...newContacts];
      setContacts(updatedContacts);
      saveContacts(updatedContacts);

      if (selectedGroupIdForImport && newContactIdsForGroup.length > 0) {
        const updatedGroups = groups.map(group => {
          if (group.id === selectedGroupIdForImport) {
            return {
              ...group,
              contactIds: Array.from(new Set([...group.contactIds, ...newContactIdsForGroup]))
            };
          }
          return group;
        });
        setGroups(updatedGroups);
        saveGroups(updatedGroups);
        setSuccess(`Importados ${newContacts.length} contactos y añadidos al grupo seleccionado.`);
      } else {
        setSuccess(`Importados ${newContacts.length} contactos exitosamente.`);
      }

      setImportText('');
      setSelectedGroupIdForImport('');
      setShowImportDialog(false);

    } catch (error) {
      setError('Error durante la importación');
      console.error('Import error:', error);
    } finally {
      setLoading(false);
    }
  };

  const createContact = async () => {
    if (!contactForm.name || !contactForm.phone) {
      setError('Complete nombre y teléfono');
      return;
    }

    const formattedPhone = contactForm.phone.startsWith('+') ? contactForm.phone : `+${contactForm.phone}`;

    setLoading(true);
    setError(null);

    try {
      if (editingContact) {
        // Para edición, por ahora solo actualizar localStorage
        // TODO: Crear endpoint PUT /api/contacts/:id para edición en servidor
        const updatedContacts = contacts.map(c =>
          c.id === editingContact.id
            ? { ...c, ...contactForm, phone: formattedPhone }
            : c
        );
        setContacts(updatedContacts);
        saveContacts(updatedContacts);
        setSuccess('Contacto actualizado');
      } else {
        // Verificar si ya existe en localStorage
        const exists = contacts.find(c => c.phone === formattedPhone);
        if (exists) {
          setError('Ya existe un contacto con este número');
          return;
        }

        // Crear contacto en el servidor
        const response = await fetch(`${getAPIBaseURL()}/api/contacts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionId,
            name: contactForm.name,
            phone: formattedPhone,
            category: contactForm.category,
            tags: contactForm.tags
          })
        });

        const data = await response.json();

        if (data.success) {
          // Crear contacto local con el ID del servidor
          const newContact: Contact = {
            id: data.contactId?.toString() || Date.now().toString(),
            ...contactForm,
            phone: formattedPhone,
            groupIds: [],
            addedAt: new Date().toISOString()
          };

          const updatedContacts = [...contacts, newContact];
          setContacts(updatedContacts);
          saveContacts(updatedContacts);

          setSuccess('Contacto creado exitosamente en el servidor');
          console.log('Contacto creado en servidor:', data);
        } else {
          setError(`Error del servidor: ${data.error}`);
        }
      }

      setContactForm({ name: '', phone: '', category: 'cliente', tags: [] });
      setEditingContact(null);
      setShowContactDialog(false);
    } catch (error) {
      console.error('Error creando contacto:', error);
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const createGroup = () => {
    if (!groupForm.name) {
      setError('Ingrese el nombre del grupo');
      return;
    }

    const newGroup: ContactGroup = {
      id: Date.now().toString(),
      ...groupForm,
      contactIds: selectedContacts,
      createdAt: new Date().toISOString()
    };

    const updatedGroups = [...groups, newGroup];
    setGroups(updatedGroups);
    saveGroups(updatedGroups);
    setSuccess('Grupo creado exitosamente');

    setGroupForm({ name: '', description: '', color: '#00a884' });
    setShowGroupDialog(false);
    setSelectedContacts([]);
  };

  const deleteContact = (contactId: string) => {
    const updatedContacts = contacts.filter(c => c.id !== contactId);
    setContacts(updatedContacts);
    saveContacts(updatedContacts);
    setSuccess('Contacto eliminado');
  };

  const exportContacts = () => {
    const csvContent = contacts.map(contact =>
      `${contact.phone},${contact.name},${contact.category},${contact.tags.join(';')}`
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contactos_${sessionId}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    setSuccess('Contactos exportados exitosamente');
  };

  const filteredContacts = contacts.filter(contact =>
    (contact.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (contact.phone || '').includes(searchTerm)
  );

  const filteredGroups = groups.filter(group =>
    (group.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box sx={{ p: 3 }}>
      {/* Header Simplificado */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              📱 Gestión de Contactos
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Administra tus contactos de WhatsApp
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              startIcon={syncLoading ? <CircularProgress size={20} /> : <Refresh />}
              onClick={handleSyncContacts}
              disabled={syncLoading}
              sx={{ bgcolor: '#00a884', '&:hover': { bgcolor: '#008069' } }}
            >
              {syncLoading ? 'Sincronizando...' : 'Sincronizar Contactos'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<Person />}
              onClick={async () => {
                try {
                  setSyncLoading(true);
                  setError(null);
                  console.log('Actualizando avatares...');

                  const response = await fetch(`${getAPIBaseURL()}/api/update-contacts-avatars/${sessionId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                  });

                  const data = await response.json();

                  if (data.success) {
                    console.log('Avatares actualizados:', data.stats);
                    setSuccess(`✅ Avatares actualizados: ${data.stats.updatedAvatars} de ${data.stats.totalContacts} contactos`);
                    await loadSyncedContacts();
                  } else {
                    console.error('Error actualizando avatares:', data.error);
                    setError(`❌ Error: ${data.error}`);
                  }
                } catch (error) {
                  console.error('Error actualizando avatares:', error);
                  setError('❌ Error al actualizar avatares');
                } finally {
                  setSyncLoading(false);
                }
              }}
              disabled={syncLoading}
              sx={{ borderColor: '#ff9800', color: '#ff9800', '&:hover': { borderColor: '#f57c00', bgcolor: '#fff3e0' } }}
            >
              {syncLoading ? 'Actualizando...' : 'Actualizar Avatares'}
            </Button>
          </Stack>
        </Box>
      </Paper>

      {/* Alerts */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* Search */}
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ p: 2 }}>
          <TextField
            fullWidth
            placeholder="Buscar contactos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
            }}
          />
        </Box>
      </Paper>

      {/* Content: Synced Contacts Only */}
      <Box>
        <Grid container spacing={3}>
          {syncedContacts.length === 0 ? (
            <Grid item xs={12}>
              <Paper sx={{ p: 6, textAlign: 'center' }}>
                <Person sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No hay contactos sincronizados
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                  Sincroniza tus contactos desde WhatsApp para verlos aquí
                </Typography>
              </Paper>
            </Grid>
          ) : (
            syncedContacts
              .filter((contact) =>
                (contact.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (contact.jid || '').includes(searchTerm.toLowerCase())
              )
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((contact) => (
                <Grid item xs={12} sm={6} md={4} key={contact.jid}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Avatar
                          src={contact.avatar || `${getAPIBaseURL()}/api/avatar/${sessionId}/${contact.jid}` || undefined}
                          sx={{ width: 48, height: 48, bgcolor: '#00a884' }}
                        >
                          {(contact.name || contact.notify || contact.jid.split('@')[0]).charAt(0).toUpperCase()}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6" gutterBottom>
                            {contact.name || contact.notify || 'Sin nombre'}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            {contact.jid.split('@')[0]}
                          </Typography>
                        </Box>
                        <IconButton
                          onClick={(e) => {
                            setAnchorEl(e.currentTarget);
                            setSelectedSyncedContactMenu(contact);
                          }}
                        >
                          <MoreVert />
                        </IconButton>
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Chip
                          label="WhatsApp"
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<Chat />}
                          onClick={() => {
                            setQuickChatContact(contact);
                            setShowQuickChatDialog(true);
                          }}
                          sx={{
                            borderColor: isDarkMode ? '#00a884' : '#25d366',
                            color: isDarkMode ? '#00a884' : '#25d366',
                            '&:hover': {
                              borderColor: isDarkMode ? '#008069' : '#1da851',
                              bgcolor: isDarkMode ? 'rgba(0, 168, 132, 0.1)' : 'rgba(37, 211, 102, 0.1)'
                            }
                          }}
                        >
                          Chatear
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))
          )}
        </Grid>

        {/* Pagination for WhatsApp Contacts */}
        {syncedContacts.length > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <TablePagination
              component="div"
              count={syncedContacts.filter((contact) =>
                (contact.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (contact.jid || '').includes(searchTerm.toLowerCase())
              ).length}
              page={page}
              onPageChange={(event, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(event) => {
                setRowsPerPage(parseInt(event.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[12, 24, 48, 96]}
              labelRowsPerPage="Contactos por página:"
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
            />
          </Box>
        )}
      </Box>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => {
          setAnchorEl(null);
          setSelectedContactMenu(null);
          setSelectedSyncedContactMenu(null);
        }}
      >
        {/* Menu items for regular contacts */}
        {selectedContactMenu && !selectedSyncedContactMenu && (
          <>
            <MenuItem onClick={() => {
              if (selectedContactMenu) {
                setContactForm({
                  name: selectedContactMenu.name,
                  phone: selectedContactMenu.phone,
                  category: selectedContactMenu.category,
                  tags: selectedContactMenu.tags
                });
                setEditingContact(selectedContactMenu);
                setShowContactDialog(true);
              }
              setAnchorEl(null);
              setSelectedContactMenu(null);
            }}>
              <Edit sx={{ mr: 1 }} /> Editar
            </MenuItem>
            <MenuItem onClick={() => {
              if (selectedContactMenu) {
                deleteContact(selectedContactMenu.id);
              }
              setAnchorEl(null);
              setSelectedContactMenu(null);
            }}>
              <Delete sx={{ mr: 1 }} /> Eliminar
            </MenuItem>
          </>
        )}

        {/* Menu items for synced contacts (WhatsApp contacts) */}
        {selectedSyncedContactMenu && (
          <>
            <MenuItem onClick={async () => {
              if (selectedSyncedContactMenu) {
                try {
                  // Load boards first
                  await loadKanbanBoards();

                  // Buscar el tablero de "interesados" o crearlo si no existe
                  let interesadosBoard = boards.find((board: any) =>
                    board.name.toLowerCase().includes('interesado') || board.name.toLowerCase().includes('interesados'));

                  if (!interesadosBoard) {
                    // Crear el tablero de interesados si no existe

                    const createResponse = await fetch(`${getAPIBaseURL()}/api/kanban/boards`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        sessionId,
                        name: 'Interesados',
                        color: '#2196f3'
                      })
                    });
                    const createData = await createResponse.json();

                    if (createData.success) {
                      interesadosBoard = createData.data;
                      // Refresh boards after creating a new one
                      await loadKanbanBoards();
                    }
                  }

                  if (interesadosBoard) {
                    // Mover el contacto al tablero de interesados

                    const moveResponse = await fetch(`${getAPIBaseURL()}/api/kanban/move-contact`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        sessionId,
                        contactJid: selectedSyncedContactMenu.jid,
                        contactName: selectedSyncedContactMenu.name,
                        contactAvatar: selectedSyncedContactMenu.avatar,
                        boardId: interesadosBoard.id
                      })
                    });

                    const moveData = await moveResponse.json();

                    if (moveData.success) {
                      setSuccess(`Contacto enviado a "${interesadosBoard.name}"`);
                      setTimeout(() => setSuccess(null), 3000);
                    } else {
                      setError(`Error: ${moveData.error || 'No se pudo mover el contacto'}`);
                      setTimeout(() => setError(null), 3000);
                    }
                  } else {
                    setError('No se pudo encontrar o crear el tablero de interesados');
                    setTimeout(() => setError(null), 3000);
                  }
                } catch (error) {
                  console.error('Error al enviar contacto a Kanban:', error);
                  setError('Error al enviar contacto a Kanban');
                  setTimeout(() => setError(null), 3000);
                }

                setAnchorEl(null);
                setSelectedSyncedContactMenu(null);
              }
            }}>
              <Person sx={{ mr: 1 }} /> Enviar a Kanban (Interesados)
            </MenuItem>
            <MenuItem onClick={async () => {
              if (selectedSyncedContactMenu) {
                setSelectedContactForKanban(selectedSyncedContactMenu);
                setAnchorEl(null);
                setSelectedSyncedContactMenu(null);

                // Load boards before showing dialog
                await loadKanbanBoards();
                setShowKanbanDialog(true);
              }
            }}>
              <Folder sx={{ mr: 1 }} /> Enviar a otro tablero
            </MenuItem>
            <MenuItem onClick={() => {
              // Abrir chat con el contacto
              console.log('Iniciar chat con:', selectedSyncedContactMenu?.jid);
              setAnchorEl(null);
              setSelectedSyncedContactMenu(null);
            }}>
              <Chat sx={{ mr: 1 }} /> Chatear
            </MenuItem>
            <MenuItem onClick={() => {
              const contact = selectedSyncedContactMenu;
              if (contact) {
                setContactToEdit(contact);
                setEditingContactName(contact.name || contact.notify || '');
                setShowEditNameDialog(true);
              }
              setAnchorEl(null);
              setSelectedSyncedContactMenu(null);
            }}>
              <Edit sx={{ mr: 1 }} /> Editar Nombre
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onClose={() => setShowImportDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>📥 Importar Contactos Masivos</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Formato:</strong> numero,nombre,categoria,etiquetas<br />
              <strong>Ejemplo:</strong><br />
              +5491234567890,Juan Pérez,cliente,vip;importante<br />
              +5491234567891,María González,prospecto,nuevo<br />
              <br />
              <strong>Límite:</strong> Hasta 5000 contactos por importación
            </Typography>
          </Alert>

          <FormControl fullWidth sx={{ mt: 2, mb: 1 }}>
            <InputLabel id="import-to-group-label">Añadir al Grupo (Opcional)</InputLabel>
            <Select
              labelId="import-to-group-label"
              value={selectedGroupIdForImport}
              label="Añadir al Grupo (Opcional)"
              onChange={(e) => setSelectedGroupIdForImport(e.target.value as string)}
            >
              <MenuItem value="">
                <em>Ninguno</em>
              </MenuItem>
              {groups.map((group) => (
                <MenuItem key={group.id} value={group.id}>
                  {group.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            multiline
            rows={12}
            label="Contactos (uno por línea)"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="+5491234567890,Juan Pérez,cliente,vip&#10;+5491234567891,María González,prospecto,nuevo"
            helperText={`${importText.split('\n').filter(line => line.trim()).length} líneas ingresadas`}
          />

          {loading && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress variant="determinate" value={importProgress} />
              <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
                Importando... {importProgress}%
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowImportDialog(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleBulkImport}
            disabled={!importText.trim() || loading}
            variant="contained"
          >
            {loading ? 'Importando...' : 'Importar Contactos'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Contact Dialog */}
      <Dialog open={showContactDialog} onClose={() => setShowContactDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingContact ? '✏️ Editar Contacto' : '👤 Nuevo Contacto'}
        </DialogTitle>
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
              <InputLabel>Categoría</InputLabel>
              <Select
                value={contactForm.category}
                onChange={(e) => setContactForm(prev => ({ ...prev, category: e.target.value }))}
              >
                <MenuItem value="cliente">Cliente</MenuItem>
                <MenuItem value="prospecto">Prospecto</MenuItem>
                <MenuItem value="proveedor">Proveedor</MenuItem>
                <MenuItem value="colaborador">Colaborador</MenuItem>
                <MenuItem value="otro">Otro</MenuItem>
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
          <Button onClick={() => setShowContactDialog(false)}>
            Cancelar
          </Button>
          <Button onClick={createContact} variant="contained">
            {editingContact ? 'Actualizar' : 'Crear'} Contacto
          </Button>
        </DialogActions>
      </Dialog>

      {/* Group Dialog */}
      <Dialog open={showGroupDialog} onClose={() => setShowGroupDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          📁 Nuevo Grupo de Contactos
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Nombre del Grupo *"
              value={groupForm.name}
              onChange={(e) => setGroupForm(prev => ({ ...prev, name: e.target.value }))}
            />
            <TextField
              fullWidth
              label="Descripción"
              multiline
              rows={2}
              value={groupForm.description}
              onChange={(e) => setGroupForm(prev => ({ ...prev, description: e.target.value }))}
            />
            <TextField
              fullWidth
              label="Color"
              type="color"
              value={groupForm.color}
              onChange={(e) => setGroupForm(prev => ({ ...prev, color: e.target.value }))}
            />

            <Typography variant="subtitle2">
              Contactos Seleccionados: {selectedContacts.length}
            </Typography>
            {selectedContacts.length > 0 && (
              <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                {selectedContacts.map(contactId => {
                  const contact = contacts.find(c => c.id === contactId);
                  return contact ? (
                    <Chip
                      key={contactId}
                      label={contact.name}
                      onDelete={() => setSelectedContacts(prev => prev.filter(id => id !== contactId))}
                      sx={{ m: 0.5 }}
                    />
                  ) : null;
                })}
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowGroupDialog(false)}>
            Cancelar
          </Button>
          <Button onClick={createGroup} variant="contained">
            Crear Grupo
          </Button>
        </DialogActions>
      </Dialog>

      {/* Kanban Board Selection Dialog - MODERN VERSION */}
      <Dialog
        open={showKanbanDialog}
        onClose={() => setShowKanbanDialog(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Folder sx={{ color: '#00a884', fontSize: 28 }} />
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Enviar a Tablero Kanban
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {/* Contact Info */}
          {selectedContactForKanban && (
            <Paper
              elevation={0}
              sx={{
                mb: 3,
                p: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                bgcolor: isDarkMode ? 'rgba(0,168,132,0.1)' : 'rgba(0,168,132,0.05)',
                border: `2px solid ${isDarkMode ? 'rgba(0,168,132,0.3)' : 'rgba(0,168,132,0.2)'}`,
                borderRadius: 2
              }}
            >
              <Avatar
                src={selectedContactForKanban.avatar || `${getAPIBaseURL()}/api/avatar/${sessionId}/${selectedContactForKanban.jid}` || undefined}
                sx={{ width: 56, height: 56, bgcolor: '#00a884', fontSize: '1.5rem', fontWeight: 'bold' }}
              >
                {(selectedContactForKanban.name || selectedContactForKanban.notify || selectedContactForKanban.jid.split('@')[0]).charAt(0).toUpperCase()}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {selectedContactForKanban.name || selectedContactForKanban.notify || 'Sin nombre'}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  📱 {selectedContactForKanban.jid.split('@')[0]}
                </Typography>
              </Box>
            </Paper>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
              <CircularProgress size={48} />
            </Box>
          ) : (
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: 'text.secondary' }}>
                Selecciona un tablero:
              </Typography>

              {boards.length > 0 ? (
                <Grid container spacing={2}>
                  {boards.map((board: any) => (
                    <Grid item xs={12} sm={6} key={board.id}>
                      <Card
                        sx={{
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          border: '2px solid',
                          borderColor: 'transparent',
                          '&:hover': {
                            borderColor: board.color || '#00a884',
                            transform: 'translateY(-4px)',
                            boxShadow: `0 8px 24px ${board.color || '#00a884'}40`
                          }
                        }}
                        onClick={async () => {
                          if (selectedContactForKanban) {
                            try {
                              setLoading(true);

                              const response = await fetch(`${getAPIBaseURL()}/api/kanban/move-contact`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  sessionId,
                                  contactJid: selectedContactForKanban.jid,
                                  contactName: selectedContactForKanban.name,
                                  contactAvatar: selectedContactForKanban.avatar,
                                  boardId: board.id
                                })
                              });

                              const data = await response.json();

                              if (data.success) {
                                setSuccess(`✅ Contacto enviado a "${board.name}"`);
                                setTimeout(() => setSuccess(null), 3000);
                                setShowKanbanDialog(false);
                                setSelectedContactForKanban(null);
                              } else {
                                setError(`❌ Error: ${data.error || 'No se pudo mover el contacto'}`);
                                setTimeout(() => setError(null), 3000);
                              }
                            } catch (error) {
                              console.error('Error al enviar contacto a Kanban:', error);
                              setError('❌ Error de conexión');
                              setTimeout(() => setError(null), 3000);
                            } finally {
                              setLoading(false);
                            }
                          }
                        }}
                      >
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                            <Box
                              sx={{
                                width: 48,
                                height: 48,
                                borderRadius: 2,
                                bgcolor: board.color || '#00a884',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Folder sx={{ color: 'white', fontSize: 28 }} />
                            </Box>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                {board.name}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                {board.contacts?.length || 0} contactos
                              </Typography>
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Paper
                  elevation={0}
                  sx={{
                    p: 4,
                    textAlign: 'center',
                    bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                    borderRadius: 2
                  }}
                >
                  <Folder sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="h6" color="textSecondary" gutterBottom>
                    No hay tableros disponibles
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Crea un tablero en el módulo de Kanban primero
                  </Typography>
                </Paper>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={async () => {
              setLoading(true);
              await loadKanbanBoards();
              setLoading(false);
            }}
            startIcon={<Folder />}
            disabled={loading}
          >
            Actualizar Tableros
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            onClick={() => {
              setShowKanbanDialog(false);
              setSelectedContactForKanban(null);
            }}
            variant="outlined"
          >
            Cancelar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog para editar nombre */}
      <Dialog
        open={showEditNameDialog}
        onClose={() => {
          setShowEditNameDialog(false);
          setContactToEdit(null);
          setEditingContactName('');
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          }
        }}
      >
        <DialogTitle sx={{
          pb: 2,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <Edit />
          Editar Nombre del Contacto
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <TextField
            autoFocus
            fullWidth
            label="Nombre del Contacto"
            value={editingContactName}
            onChange={(e) => setEditingContactName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSaveEditedName();
              }
            }}
            variant="outlined"
            sx={{ mt: 1 }}
            placeholder="Ingrese el nombre completo"
            helperText={`Número: ${contactToEdit?.jid.split('@')[0] || ''}`}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => {
              setShowEditNameDialog(false);
              setContactToEdit(null);
              setEditingContactName('');
            }}
            variant="outlined"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSaveEditedName}
            variant="contained"
            disabled={!editingContactName.trim()}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)',
              }
            }}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal para ver miembros del grupo */}
      <Dialog
        open={showMembersDialog}
        onClose={() => setShowMembersDialog(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          }
        }}
      >
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #00a884 0%, #008c6f 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          pb: 2
        }}>
          <Group sx={{ fontSize: 32 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {selectedGroup?.name || 'Grupo'}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              {groupMembers.length} {groupMembers.length === 1 ? 'miembro' : 'miembros'}
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0, mt: 2 }}>
          {loadingMembers ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
              <CircularProgress sx={{ color: '#00a884' }} />
            </Box>
          ) : groupMembers.length === 0 ? (
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              py: 6,
              px: 3
            }}>
              <Group sx={{ fontSize: 64, color: '#ccc', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No se encontraron miembros
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Este grupo no tiene miembros o no se pudieron cargar
              </Typography>
            </Box>
          ) : (
            <List sx={{ px: 2 }}>
              {groupMembers.map((member, index) => (
                <ListItem
                  key={member.jid || member.id || index}
                  sx={{
                    borderRadius: 2,
                    mb: 1,
                    border: '1px solid #f0f0f0',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: '#f8f9fa',
                      transform: 'translateX(4px)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                    }
                  }}
                >
                  <ListItemAvatar>
                    <Avatar
                      src={member.avatar || member.profilePicUrl}
                      sx={{
                        width: 48,
                        height: 48,
                        bgcolor: '#00a884',
                        fontWeight: 600
                      }}
                    >
                      {(member.name || member.phone || '?')[0].toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {member.name || member.phone || 'Sin nombre'}
                        </Typography>
                        {member.isAdmin && (
                          <Chip
                            label={member.isSuperAdmin ? 'Super Admin' : 'Admin'}
                            size="small"
                            sx={{
                              bgcolor: member.isSuperAdmin ? '#ff6b6b' : '#ffa726',
                              color: 'white',
                              fontWeight: 600,
                              fontSize: '0.7rem',
                              height: 20
                            }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            color: member.phone ? '#00a884' : '#999',
                            fontFamily: 'monospace',
                            fontSize: '0.95rem',
                            fontWeight: 500
                          }}
                        >
                          <Phone sx={{ fontSize: 14 }} />
                          {member.phone || 'Número no disponible'}
                        </Typography>
                        {member.jid && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: '#999',
                              fontSize: '0.75rem',
                              display: 'block',
                              mt: 0.5
                            }}
                          >
                            JID: {member.jid}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <IconButton
                    href={`https://wa.me/${member.phone?.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    disabled={!member.phone}
                    sx={{
                      bgcolor: '#00a884',
                      color: 'white',
                      '&:hover': { bgcolor: '#008c6f' },
                      '&:disabled': { bgcolor: '#e0e0e0', color: '#999' }
                    }}
                  >
                    <WhatsApp />
                  </IconButton>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #f0f0f0' }}>
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
            {selectedGroup?.description || 'Grupo de WhatsApp'}
          </Typography>
          <Button
            onClick={() => setShowMembersDialog(false)}
            variant="contained"
            sx={{
              bgcolor: '#00a884',
              '&:hover': { bgcolor: '#008c6f' }
            }}
          >
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de Chat Rápido */}
      <Dialog
        open={showQuickChatDialog}
        onClose={() => {
          setShowQuickChatDialog(false);
          setQuickChatMessage('');
          setShowEmojiPicker(false);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: isDarkMode
              ? 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }
        }}
      >
        <DialogTitle
          sx={{
            background: 'linear-gradient(135deg, #00a884 0%, #008069 100%)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            py: 2.5,
            px: 3
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              src={quickChatContact?.avatar || (quickChatContact?.jid ? `${getAPIBaseURL()}/api/avatar/${sessionId}/${quickChatContact.jid}` : undefined)}
              sx={{
                width: 56,
                height: 56,
                border: '3px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                bgcolor: quickChatContact?.avatar ? 'transparent' : '#00a884',
                fontSize: '1.5rem',
                fontWeight: 600
              }}
            >
              {!quickChatContact?.avatar && (
                quickChatContact?.name
                  ? quickChatContact.name.substring(0, 2).toUpperCase()
                  : <Person sx={{ fontSize: 32 }} />
              )}
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                💬 Chat Rápido
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {quickChatContact?.name || quickChatContact?.jid?.split('@')[0]}
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={() => {
              setShowQuickChatDialog(false);
              setQuickChatMessage('');
              setShowEmojiPicker(false);
            }}
            sx={{ color: 'white' }}
          >
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          {/* Selector de Emojis */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: isDarkMode ? '#fff' : '#333' }}>
                Emojis rápidos
              </Typography>
              <IconButton
                size="small"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                sx={{
                  bgcolor: showEmojiPicker ? '#00a884' : 'transparent',
                  color: showEmojiPicker ? 'white' : '#00a884',
                  '&:hover': {
                    bgcolor: '#00a884',
                    color: 'white'
                  }
                }}
              >
                <EmojiEmotions />
              </IconButton>
            </Box>

            {showEmojiPicker && (
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 168, 132, 0.05)',
                  borderRadius: 2,
                  border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 168, 132, 0.2)'}`,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 1,
                  maxHeight: 200,
                  overflow: 'auto'
                }}
              >
                {commonEmojis.map((emoji, index) => (
                  <IconButton
                    key={index}
                    onClick={() => setQuickChatMessage(prev => prev + emoji)}
                    sx={{
                      fontSize: '1.5rem',
                      width: 45,
                      height: 45,
                      transition: 'all 0.2s',
                      '&:hover': {
                        transform: 'scale(1.3)',
                        bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 168, 132, 0.1)'
                      }
                    }}
                  >
                    {emoji}
                  </IconButton>
                ))}
              </Paper>
            )}
          </Box>

          {/* Área de texto del mensaje */}
          <TextField
            fullWidth
            multiline
            rows={6}
            value={quickChatMessage}
            onChange={(e) => setQuickChatMessage(e.target.value)}
            placeholder="Escribe tu mensaje aquí... 💬"
            variant="outlined"
            autoFocus
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendQuickMessage();
              }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'white',
                fontSize: '1rem',
                '& fieldset': {
                  borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#e0e0e0',
                  borderWidth: 2
                },
                '&:hover fieldset': {
                  borderColor: '#00a884'
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#00a884'
                }
              },
              '& .MuiInputBase-input': {
                color: isDarkMode ? '#fff' : '#333'
              }
            }}
          />

          {/* Contador de caracteres */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              {quickChatMessage.length} caracteres
            </Typography>
            <Typography variant="caption" sx={{ color: '#00a884', fontWeight: 600 }}>
              Presiona Enter para enviar
            </Typography>
          </Box>
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            py: 2.5,
            borderTop: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#f0f0f0'}`,
            gap: 2
          }}
        >
          <Button
            onClick={() => {
              setShowQuickChatDialog(false);
              setQuickChatMessage('');
              setShowEmojiPicker(false);
            }}
            variant="outlined"
            sx={{
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : '#e0e0e0',
              color: isDarkMode ? '#fff' : '#666',
              '&:hover': {
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : '#ccc',
                bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)'
              }
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSendQuickMessage}
            disabled={!quickChatMessage.trim() || sendingMessage}
            variant="contained"
            startIcon={sendingMessage ? <CircularProgress size={20} color="inherit" /> : <Send />}
            sx={{
              background: 'linear-gradient(135deg, #00a884 0%, #008069 100%)',
              color: 'white',
              px: 4,
              py: 1.2,
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(0, 168, 132, 0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #008069 0%, #006d57 100%)',
                boxShadow: '0 6px 16px rgba(0, 168, 132, 0.4)',
                transform: 'translateY(-2px)'
              },
              '&:disabled': {
                background: '#ccc',
                color: '#999'
              },
              transition: 'all 0.3s ease'
            }}
          >
            {sendingMessage ? 'Enviando...' : 'Enviar Mensaje'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ContactsManagerModule;
