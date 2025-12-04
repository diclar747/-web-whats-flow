import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Chip
} from '@mui/material';
import {
  ViewKanban as KanbanIcon,
  CheckCircle as CheckIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { getAPIBaseURL } from '../utils/socketConfig';

interface KanbanBoard {
  id: string;
  name: string;
  color: string;
  order: number;
  is_default?: boolean;
  user_count?: number;
}

interface Contact {
  jid: string;
  name: string;
  avatar?: string;
}

interface KanbanSelectorModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  contact?: Contact;
  contacts?: Contact[];
  onSuccess: (boardId: string, boardName: string) => void;
}

const KanbanSelectorModal: React.FC<KanbanSelectorModalProps> = ({
  open,
  onClose,
  sessionId,
  contact,
  contacts,
  onSuccess
}) => {
  const [boards, setBoards] = useState<KanbanBoard[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBulkMode = contacts && contacts.length > 0;
  const contactCount = isBulkMode ? contacts.length : 1;

  useEffect(() => {
    if (open && sessionId) {
      loadBoards();
    }
  }, [open, sessionId]);

  const loadBoards = async () => {
    setLoading(true);
    setError(null);

    try {
      const API_BASE = getAPIBaseURL();
      const response = await fetch(`${API_BASE}/api/kanban/boards/${sessionId}`);
      const data = await response.json();

      if (data.success && data.boards) {
        setBoards(data.boards);
      } else {
        setError('Error al cargar tableros Kanban');
      }
    } catch (err) {
      console.error('Error cargando tableros:', err);
      setError('Error de conexión al cargar tableros');
    } finally {
      setLoading(false);
    }
  };

  const handleBoardSelect = (boardId: string) => {
    setSelectedBoard(boardId);
  };

  const handleSubmit = async () => {
    if (!selectedBoard) return;

    setSubmitting(true);
    setError(null);

    try {
      const API_BASE = getAPIBaseURL();

      if (isBulkMode) {
        // Envío masivo para campañas
        const response = await fetch(`${API_BASE}/api/kanban/move-contacts-bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            contacts: contacts.map(c => ({
              jid: c.jid,
              name: c.name,
              avatar: c.avatar
            })),
            boardId: selectedBoard
          })
        });

        const data = await response.json();

        if (data.success) {
          const selectedBoardData = boards.find(b => b.id === selectedBoard);
          onSuccess(selectedBoard, selectedBoardData?.name || selectedBoard);
          onClose();
        } else {
          console.error('Error del servidor:', data);
          setError(`${data.error || 'Error al mover contactos'}${data.details ? ': ' + data.details : ''}`);
        }
      } else if (contact) {
        // Envío individual
        const response = await fetch(`${API_BASE}/api/kanban/move-contact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            contactJid: contact.jid,
            contactName: contact.name,
            contactAvatar: contact.avatar,
            boardId: selectedBoard
          })
        });

        const data = await response.json();

        if (data.success) {
          const selectedBoardData = boards.find(b => b.id === selectedBoard);
          onSuccess(selectedBoard, selectedBoardData?.name || selectedBoard);
          onClose();
        } else {
          console.error('Error del servidor:', data);
          setError(`${data.error || 'Error al mover contacto'}${data.details ? ': ' + data.details : ''}`);
        }
      }
    } catch (err) {
      console.error('Error moviendo a Kanban:', err);
      setError('Error de conexión al mover contacto');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <KanbanIcon sx={{ fontSize: 32, color: '#673ab7' }} />
          <Box>
            <Typography variant="h6">
              Enviar a Tablero Kanban
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {isBulkMode
                ? `Selecciona un tablero para ${contactCount} contactos`
                : `Selecciona un tablero para ${contact?.name || 'este contacto'}`
              }
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Información del contacto */}
        {contact && !isBulkMode && (
          <Box sx={{
            mb: 3,
            p: 2,
            bgcolor: '#f5f5f5',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}>
            <Avatar
              src={contact.avatar}
              sx={{ width: 48, height: 48, bgcolor: '#00a884' }}
            >
              {contact.name.charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {contact.name}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {contact.jid}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Información de contactos masivos */}
        {isBulkMode && (
          <Box sx={{
            mb: 3,
            p: 2,
            bgcolor: '#e8f5e8',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}>
            <PersonIcon sx={{ fontSize: 40, color: '#4caf50' }} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {contactCount} contactos seleccionados
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Se moverán todos los contactos al tablero seleccionado
              </Typography>
            </Box>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : boards.length === 0 ? (
          <Alert severity="info">
            No hay tableros Kanban disponibles. Se crearán tableros por defecto al confirmar.
          </Alert>
        ) : (
          <>
            <Typography variant="body2" sx={{ mb: 2, color: '#666' }}>
              Selecciona un tablero:
            </Typography>

            <List sx={{ border: '1px solid #e0e0e0', borderRadius: 2, p: 0 }}>
              {boards.map((board) => (
                <ListItem key={board.id} disablePadding>
                  <ListItemButton
                    selected={selectedBoard === board.id}
                    onClick={() => handleBoardSelect(board.id)}
                    sx={{
                      borderLeft: `4px solid ${board.color}`,
                      '&.Mui-selected': {
                        bgcolor: `${board.color}15`,
                        borderLeftWidth: '6px'
                      }
                    }}
                  >
                    <ListItemIcon>
                      {selectedBoard === board.id ? (
                        <CheckIcon sx={{ color: board.color }} />
                      ) : (
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            bgcolor: board.color,
                            opacity: 0.5
                          }}
                        />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography sx={{ fontWeight: selectedBoard === board.id ? 600 : 400 }}>
                              {board.name}
                            </Typography>
                            {board.is_default && (
                              <Chip label="Por defecto" size="small" sx={{ height: 20 }} />
                            )}
                          </Box>
                          <Chip
                            label={board.user_count || 0}
                            size="small"
                            sx={{
                              height: 20,
                              bgcolor: selectedBoard === board.id ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.05)',
                              fontWeight: 'bold'
                            }}
                          />
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={submitting}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!selectedBoard || submitting || loading}
          sx={{
            bgcolor: '#673ab7',
            '&:hover': { bgcolor: '#5e35b1' }
          }}
        >
          {submitting ? (
            <>
              <CircularProgress size={20} sx={{ mr: 1, color: 'white' }} />
              Enviando...
            </>
          ) : (
            `Enviar ${isBulkMode ? `${contactCount} contactos` : 'contacto'}`
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default KanbanSelectorModal;
