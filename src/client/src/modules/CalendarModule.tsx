import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, momentLocalizer, View } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import 'moment/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import '../styles/calendar.css';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Chip,
  Typography,
  CircularProgress,
  Alert,
  Snackbar,
  Tabs,
  Tab,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Paper,
  Grid,
  Autocomplete
} from '@mui/material';
import {
  Add,
  Delete,
  CheckCircle,
  Error as ErrorIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  Category as CategoryIcon
} from '@mui/icons-material';
import { useWhatsApp } from '../context/WhatsAppContext';
import ModernAlert from '../components/ModernAlert';
import ModernNotification from '../components/ModernNotification';
import { useModernNotification } from '../hooks/useModernNotification';

moment.locale('es');
const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(Calendar as any);

interface Appointment {
  id: number;
  session_id: string;
  patient_name: string;
  patient_phone: string;
  appointment_date: string;
  appointment_time: string;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
  reminder_time?: number;
  notification_template?: string;
  category_id?: number;
  created_at: string;
  updated_at: string;
}

interface NotificationTemplate {
  id: string;
  name: string;
  message: string;
  is_default: boolean;
}

interface AppointmentCategory {
  id: number;
  name: string;
  color: string;
  icon: string;
  is_active: boolean;
}

interface CalendarModuleProps {
  sessionId?: string;
}

const CalendarModule: React.FC<CalendarModuleProps> = ({ sessionId }) => {
  return <CalendarModuleContent sessionId={sessionId} />;
};

const CalendarModuleContent: React.FC<CalendarModuleProps> = ({ sessionId: propSessionId }) => {
  const { session } = useWhatsApp();
  const sessionId = propSessionId || session?.sessionId;
  const {
    notification,
    alert,
    showSuccess,
    showError,
    showConfirm,
    closeNotification,
    closeAlert,
  } = useModernNotification();

  // Estados existentes
  const [events, setEvents] = useState<any[]>([]);
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());
  const [showDialog, setShowDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Appointment | null>(null);
  const [formData, setFormData] = useState<Partial<Appointment>>({
    status: 'scheduled',
    reminder_time: 60
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nuevos estados
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [settingsTab, setSettingsTab] = useState(0);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([
    {
      id: 'default',
      name: 'Recordatorio Básico',
      message: 'Hola {nombre}, le recordamos su cita el {fecha} a las {hora}. Confirme su asistencia.',
      is_default: true
    },
    {
      id: 'formal',
      name: 'Recordatorio Formal',
      message: 'Estimado/a {nombre}, le informamos que tiene programada una cita para el {fecha} a las {hora}. Por favor, confirme su asistencia.',
      is_default: false
    },
    {
      id: 'friendly',
      name: 'Recordatorio Amigable',
      message: '¡Hola {nombre}! 👋 Te recordamos tu cita del {fecha} a las {hora}. ¿Nos confirmas que vendrás? 😊',
      is_default: false
    }
  ]);
  const [newTemplate, setNewTemplate] = useState({ name: '', message: '' });
  const [reminderTimes] = useState([
    { value: 15, label: '15 minutos antes' },
    { value: 30, label: '30 minutos antes' },
    { value: 60, label: '1 hora antes' },
    { value: 120, label: '2 horas antes' },
    { value: 240, label: '4 horas antes' },
    { value: 1440, label: '1 día antes' },
    { value: 2880, label: '2 días antes' }
  ]);

  // Estados para categorías
  const [categories, setCategories] = useState<AppointmentCategory[]>([]);
  const [newCategory, setNewCategory] = useState({ name: '', color: '#1a73e8', icon: '📋' });
  const [searchingContact, setSearchingContact] = useState(false);
  
  // Estados para búsqueda de contactos por nombre
  const [contactOptions, setContactOptions] = useState<Array<{name: string, phone: string, jid: string}>>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  const getStatusColor = (status: string) => {
    const colors = {
      scheduled: '#FFB84D',
      confirmed: '#4CAF50',
      completed: '#2196F3',
      cancelled: '#F44336',
      overdue: '#9C27B0'
    };
    return colors[status as keyof typeof colors] || colors.scheduled;
  };

  const isOverdue = (appointment: Appointment) => {
    const now = moment();
    const appointmentDateTime = moment(`${appointment.appointment_date} ${appointment.appointment_time}`);
    return appointmentDateTime.isBefore(now) &&
           appointment.status !== 'completed' &&
           appointment.status !== 'cancelled';
  };

  // Cargar categorías
  const loadCategories = useCallback(async () => {
    if (!sessionId) return;

    try {
      const response = await fetch(`/api/appointment-categories/${sessionId}`);
      const data = await response.json();

      if (data.success) {
        setCategories(data.categories);
      }
    } catch (error) {
      console.error('Error cargando categorías:', error);
    }
  }, [sessionId]);

  const loadAppointments = useCallback(async () => {
    if (!sessionId) {
      console.log('No sessionId, skipping appointments load');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/appointments/${sessionId}`);
      const data = await response.json();

      if (data.success) {
        const calendarEvents = data.appointments.map((apt: Appointment) => {
          // Extraer solo la parte de la fecha sin la hora (formato YYYY-MM-DD)
          let dateStr = apt.appointment_date;
          if (typeof dateStr === 'string' && dateStr.includes('T')) {
            dateStr = dateStr.split('T')[0];
          }
          
          // Normalizar el tiempo - puede venir como HH:mm o HH:mm:ss
          const timeStr = apt.appointment_time.includes(':') ? apt.appointment_time.substring(0, 5) : apt.appointment_time;
          
          // Parsear fecha y hora manualmente para evitar conversiones de zona horaria
          const [year, month, day] = dateStr.split('-').map(Number);
          const [hour, minute] = timeStr.split(':').map(Number);
          
          // Crear Date en zona horaria local sin conversiones
          const startDateTime = new Date(year, month - 1, day, hour, minute);
          const endDateTime = new Date(year, month - 1, day, hour + 1, minute);

          console.log(`[CALENDAR] Loading event: ${apt.patient_name} - ${dateStr} ${timeStr} -> ${startDateTime.toLocaleString()}`);

          // Obtener categoría si existe
          const category = categories.find(c => c.id === apt.category_id);

          return {
            id: apt.id,
            title: `${category ? category.icon + ' ' : ''}${apt.patient_name}`,
            start: startDateTime,
            end: endDateTime,
            resource: apt,
            allDay: false
          };
        });

        setEvents(calendarEvents);
      } else {
        setError(data.error || 'Error cargando citas');
      }
    } catch (error) {
      console.error('Error cargando citas:', error);
      setError('Error de conexión al cargar citas');
    } finally {
      setLoading(false);
    }
  }, [sessionId, categories]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (categories.length > 0) {
      loadAppointments();
    }
  }, [loadAppointments, categories]);

  // Buscar contacto por teléfono
  const searchContactByPhone = async (phone: string) => {
    if (!sessionId || !phone || phone.length < 5) return;

    try {
      setSearchingContact(true);
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const response = await fetch(`/api/contacts/search/${sessionId}/${cleanPhone}`);
      const data = await response.json();

      if (data.success && data.contact) {
        setFormData({ ...formData, patient_name: data.contact.name, patient_phone: phone });
        showSuccess(`Contacto encontrado: ${data.contact.name}`, '✅ Contacto');
      }
    } catch (error) {
      console.error('Error buscando contacto:', error);
    } finally {
      setSearchingContact(false);
    }
  };

  // Buscar contactos por nombre
  const searchContactsByName = async (searchTerm: string) => {
    if (!sessionId || !searchTerm || searchTerm.length < 2) {
      setContactOptions([]);
      return;
    }

    try {
      setLoadingContacts(true);
      const response = await fetch(`/api/contacts/search-by-name/${sessionId}/${encodeURIComponent(searchTerm)}`);
      const data = await response.json();

      if (data.success && data.contacts) {
        setContactOptions(data.contacts.map((c: any) => ({
          name: c.name,
          phone: c.phone,
          jid: c.jid
        })));
      } else {
        setContactOptions([]);
      }
    } catch (error) {
      console.error('Error buscando contactos por nombre:', error);
      setContactOptions([]);
    } finally {
      setLoadingContacts(false);
    }
  };

  // Manejar cambio de teléfono
  const handlePhoneChange = (phone: string) => {
    setFormData({ ...formData, patient_phone: phone });

    // Buscar contacto después de 500ms de parar de escribir
    if (phone.length >= 5) {
      setTimeout(() => searchContactByPhone(phone), 500);
    }
  };

  const handleEventDrop = async ({ event, start, end }: any) => {
    const appointment = event.resource;
    
    // Extraer fecha y hora directamente sin conversiones de zona horaria
    const year = start.getFullYear();
    const month = String(start.getMonth() + 1).padStart(2, '0');
    const day = String(start.getDate()).padStart(2, '0');
    const hour = String(start.getHours()).padStart(2, '0');
    const minute = String(start.getMinutes()).padStart(2, '0');
    
    const newDate = `${year}-${month}-${day}`;
    const newTime = `${hour}:${minute}`;

    console.log('[CALENDAR] Event dropped:', { 
      newDate, 
      newTime, 
      original: start.toLocaleString() 
    });

    try {
      setSaving(true);
      const response = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...appointment,
          appointment_date: newDate,
          appointment_time: newTime
        })
      });

      const data = await response.json();

      if (data.success) {
        showSuccess('Cita movida exitosamente', '✅ Actualizado');
        loadAppointments();
      } else {
        showError('Error al mover la cita: ' + (data.error || 'Error desconocido'), '❌ Error');
      }
    } catch (error) {
      console.error('Error moviendo cita:', error);
      showError('Error al mover la cita', '❌ Error');
    } finally {
      setSaving(false);
    }
  };

  const eventStyleGetter = (event: any) => {
    const appointment = event.resource;
    const status = isOverdue(appointment) ? 'overdue' : appointment.status;

    // Usar color de la categoría si existe
    let backgroundColor = getStatusColor(status);
    if (appointment.category_id) {
      const category = categories.find(c => c.id === appointment.category_id);
      if (category) {
        backgroundColor = category.color;
      }
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '5px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block',
        fontSize: '13px',
        padding: '4px 6px',
        cursor: 'grab'
      }
    };
  };

  const handleSelectSlot = (slotInfo: any) => {
    // Extraer fecha y hora directamente del objeto Date sin usar moment para evitar conversiones
    const dateObj = slotInfo.start;
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hour = String(dateObj.getHours()).padStart(2, '0');
    const minute = String(dateObj.getMinutes()).padStart(2, '0');
    
    const selectedDate = `${year}-${month}-${day}`;
    const selectedTime = `${hour}:${minute}`;

    console.log('[CALENDAR] Slot selected:', { 
      selectedDate, 
      selectedTime, 
      original: slotInfo.start.toLocaleString(),
      iso: slotInfo.start.toISOString()
    });

    setFormData({
      appointment_date: selectedDate,
      appointment_time: selectedTime,
      status: 'scheduled',
      reminder_time: 60,
      notification_template: 'default',
      category_id: categories.length > 0 ? categories[0].id : undefined
    });
    setSelectedEvent(null);
    setShowDialog(true);
  };

  const handleSelectEvent = (event: any) => {
    setSelectedEvent(event.resource);
    setFormData(event.resource);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!sessionId) {
      console.error('No sessionId found');
      showError('No hay sesión activa', '❌ Error');
      return;
    }

    if (!formData.patient_name || !formData.patient_phone || !formData.appointment_date || !formData.appointment_time) {
      showError('Por favor completa: Nombre Completo, Teléfono, Fecha y Hora', '⚠️ Campos requeridos');
      return;
    }

    try {
      setSaving(true);
      const url = selectedEvent
        ? `/api/appointments/${selectedEvent.id}`
        : '/api/appointments';

      const method = selectedEvent ? 'PUT' : 'POST';

      // Asegurar que la fecha esté en formato YYYY-MM-DD y la hora en HH:mm
      let cleanDate = formData.appointment_date;
      if (cleanDate && cleanDate.includes('T')) {
        cleanDate = cleanDate.split('T')[0];
      }
      
      let cleanTime = formData.appointment_time;
      if (cleanTime && cleanTime.length > 5) {
        cleanTime = cleanTime.substring(0, 5);
      }

      const payload = {
        ...formData,
        appointment_date: cleanDate,
        appointment_time: cleanTime,
        session_id: sessionId
      };

      console.log('[CALENDAR] Saving appointment:', payload);

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        showSuccess(
          selectedEvent ? 'Cita actualizada exitosamente' : 'Cita creada exitosamente',
          selectedEvent ? '✅ Actualizado' : '✅ Creado'
        );

        setShowDialog(false);
        setFormData({ status: 'scheduled', reminder_time: 60 });
        setSelectedEvent(null);

        setTimeout(() => {
          loadAppointments();
        }, 300);
      } else {
        showError('Error al guardar: ' + (data.error || 'Error desconocido'), '❌ Error');
      }
    } catch (error) {
      console.error('Error guardando cita:', error);
      showError('Error al guardar la cita', '❌ Error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEvent) return;

    showConfirm(
      '¿Eliminar esta cita?',
      `¿Estás seguro de que deseas eliminar la cita de ${selectedEvent.patient_name}?`,
      async () => {
        try {
          setSaving(true);
          const response = await fetch(`/api/appointments/${selectedEvent.id}`, {
            method: 'DELETE'
          });

          const data = await response.json();

          if (data.success) {
            showSuccess('Cita eliminada exitosamente', '✅ Eliminado');
            setShowDialog(false);
            setSelectedEvent(null);

            setTimeout(() => {
              loadAppointments();
            }, 300);
          } else {
            showError('Error al eliminar: ' + (data.error || 'Error desconocido'), '❌ Error');
        }
      } catch (error) {
        console.error('Error eliminando cita:', error);
        showError('Error al eliminar la cita', '❌ Error');
      } finally {
        setSaving(false);
      }
    },
    'Sí, eliminar',
    'Cancelar'
    );
  };

  const handleAddTemplate = () => {
    if (!newTemplate.name || !newTemplate.message) {
      showError('Por favor completa el nombre y mensaje de la plantilla', '⚠️ Campos requeridos');
      return;
    }

    const template: NotificationTemplate = {
      id: `custom_${Date.now()}`,
      name: newTemplate.name,
      message: newTemplate.message,
      is_default: false
    };

    setTemplates([...templates, template]);
    setNewTemplate({ name: '', message: '' });

    showSuccess('Plantilla creada exitosamente', '✅ Creado');
  };

  const handleDeleteTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template?.is_default) {
      showError('No puedes eliminar plantillas predeterminadas', '⚠️ Advertencia');
      return;
    }

    setTemplates(templates.filter(t => t.id !== templateId));
    showSuccess('Plantilla eliminada', '✅ Eliminado');
  };

  // Manejo de categorías
  const handleAddCategory = async () => {
    if (!newCategory.name) {
      showError('Por favor ingresa el nombre de la categoría', '⚠️ Campo requerido');
      return;
    }

    try {
      const response = await fetch('/api/appointment-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          ...newCategory
        })
      });

      const data = await response.json();

      if (data.success) {
        showSuccess('Categoría creada exitosamente', '✅ Creado');
        setNewCategory({ name: '', color: '#1a73e8', icon: '📋' });
        loadCategories();
      }
    } catch (error) {
      console.error('Error creando categoría:', error);
      showError('Error al crear categoría', '❌ Error');
    }
  };

  const handleDeleteCategory = async (categoryId: number) => {
    showConfirm(
      '¿Eliminar categoría?',
      '¿Estás seguro de que deseas eliminar esta categoría?',
      async () => {
        try {
          const response = await fetch(`/api/appointment-categories/${categoryId}`, {
            method: 'DELETE'
          });

          const data = await response.json();

          if (data.success) {
            showSuccess('Categoría eliminada', '✅ Eliminado');
            loadCategories();
          }
        } catch (error) {
          console.error('Error eliminando categoría:', error);
          showError('Error al eliminar categoría', '❌ Error');
        }
      },
      'Sí, eliminar',
      'Cancelar'
    );
  };

  const previewTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return '';

    const preview = template.message
      .replace(/{nombre}/g, formData.patient_name || '[Nombre]')
      .replace(/{fecha}/g, formData.appointment_date ? moment(formData.appointment_date).format('DD/MM/YYYY') : '[Fecha]')
      .replace(/{hora}/g, formData.appointment_time || '[Hora]');

    return preview;
  };

  const messages = {
    allDay: 'Todo el día',
    previous: 'Anterior',
    next: 'Siguiente',
    today: 'Hoy',
    month: 'Mes',
    week: 'Semana',
    day: 'Día',
    agenda: 'Agenda',
    date: 'Fecha',
    time: 'Hora',
    event: 'Evento',
    showMore: (total: number) => `+ Ver más (${total})`
  };

  if (!session) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">Por favor inicia sesión para ver el calendario</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', p: 3, backgroundColor: '#f5f5f5' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 600, color: '#202124' }}>
          📅 Calendario de Citas
        </Typography>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => setShowSettingsDialog(true)}
            sx={{
              borderRadius: '24px',
              textTransform: 'none',
              fontWeight: 600,
              px: 3
            }}
          >
            Configuración
          </Button>

          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              // Obtener fecha y hora actual sin conversiones de zona horaria
              const now = new Date();
              const year = now.getFullYear();
              const month = String(now.getMonth() + 1).padStart(2, '0');
              const day = String(now.getDate()).padStart(2, '0');
              const hour = String(now.getHours()).padStart(2, '0');
              const minute = String(now.getMinutes()).padStart(2, '0');
              
              setFormData({
                status: 'scheduled',
                appointment_date: `${year}-${month}-${day}`,
                appointment_time: `${hour}:${minute}`,
                reminder_time: 60,
                notification_template: 'default',
                category_id: categories.length > 0 ? categories[0].id : undefined
              });
              setSelectedEvent(null);
              setShowDialog(true);
            }}
            sx={{
              backgroundColor: '#1a73e8',
              '&:hover': { backgroundColor: '#1557b0' },
              borderRadius: '24px',
              textTransform: 'none',
              fontWeight: 600,
              px: 3
            }}
          >
            Nueva Cita
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <Chip label="Programado" size="small" sx={{ backgroundColor: '#FFB84D', color: 'white', fontWeight: 500 }} />
        <Chip label="Confirmado" size="small" sx={{ backgroundColor: '#4CAF50', color: 'white', fontWeight: 500 }} />
        <Chip label="Completado" size="small" sx={{ backgroundColor: '#2196F3', color: 'white', fontWeight: 500 }} />
        <Chip label="Cancelado" size="small" sx={{ backgroundColor: '#F44336', color: 'white', fontWeight: 500 }} />
        <Chip label="Vencido" size="small" sx={{ backgroundColor: '#9C27B0', color: 'white', fontWeight: 500 }} />
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        💡 <strong>Tip:</strong> Puedes arrastrar y soltar las citas para cambiar su fecha/hora
      </Alert>

      <Box sx={{
        height: 'calc(100vh - 350px)',
        backgroundColor: 'white',
        borderRadius: 2,
        p: 2,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : (
          <DnDCalendar
            localizer={localizer}
            events={events}
            view={view}
            date={date}
            onView={setView}
            onNavigate={setDate}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            onEventDrop={handleEventDrop}
            eventPropGetter={eventStyleGetter}
            selectable
            messages={messages}
            style={{ height: '100%' }}
            views={['month', 'week', 'day', 'agenda']}
            draggableAccessor={() => true}
            step={30}
            timeslots={2}
            defaultView="month"
            scrollToTime={moment().startOf('day').add(8, 'hours').toDate()}
            formats={{
              agendaDateFormat: 'DD/MM/YYYY',
              agendaTimeFormat: 'HH:mm',
              agendaTimeRangeFormat: ({ start, end }: any) =>
                `${moment(start).format('HH:mm')} - ${moment(end).format('HH:mm')}`,
              agendaHeaderFormat: ({ start, end }: any) =>
                `${moment(start).format('DD/MM/YYYY')} - ${moment(end).format('DD/MM/YYYY')}`,
              dayFormat: 'DD ddd',
              weekdayFormat: 'dddd',
              monthHeaderFormat: 'MMMM YYYY',
              dayHeaderFormat: 'dddd DD MMMM YYYY',
              dayRangeHeaderFormat: ({ start, end }: any) =>
                `${moment(start).format('DD/MM/YYYY')} - ${moment(end).format('DD/MM/YYYY')}`
            }}
            length={30}
          />
        )}
      </Box>

      {/* Diálogo de edición/creación de cita - SIMPLIFICADO */}
      <Dialog open={showDialog} onClose={() => !saving && setShowDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1.5rem' }}>
          {selectedEvent ? '✏️ Editar Cita' : '➕ Nueva Cita'}
        </DialogTitle>

        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <Autocomplete
              freeSolo
              options={contactOptions}
              getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
              loading={loadingContacts}
              value={formData.patient_name || ''}
              onChange={(event, newValue) => {
                if (typeof newValue === 'object' && newValue !== null) {
                  // Seleccionó un contacto de la lista
                  setFormData({ 
                    ...formData, 
                    patient_name: newValue.name,
                    patient_phone: newValue.phone
                  });
                  showSuccess(`Contacto seleccionado: ${newValue.name}`, '✅ Contacto');
                } else {
                  // Escribió texto libre
                  setFormData({ ...formData, patient_name: newValue || '' });
                }
              }}
              onInputChange={(event, newInputValue) => {
                setFormData({ ...formData, patient_name: newInputValue });
                // Buscar contactos después de 300ms
                if (newInputValue.length >= 2) {
                  setTimeout(() => searchContactsByName(newInputValue), 300);
                } else {
                  setContactOptions([]);
                }
              }}
              renderOption={(props, option) => (
                <li {...props} key={option.jid}>
                  <Box>
                    <Typography variant="body1">{option.name}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      📱 {option.phone}
                    </Typography>
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Nombre Completo *"
                  required
                  fullWidth
                  helperText={loadingContacts ? "Buscando contactos..." : "Escribe el nombre para buscar"}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingContacts ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              disabled={saving}
            />

            <TextField
              label="Teléfono *"
              value={formData.patient_phone || ''}
              onChange={(e) => handlePhoneChange(e.target.value)}
              required
              fullWidth
              disabled={saving}
              placeholder="595XXX"
              helperText={searchingContact ? "Buscando contacto..." : "Número de teléfono del paciente"}
            />

            <FormControl fullWidth disabled={saving}>
              <InputLabel>Categoría de Consulta *</InputLabel>
              <Select
                value={formData.category_id || ''}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value as number })}
                label="Categoría de Consulta *"
              >
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Fecha *"
                  type="date"
                  value={formData.appointment_date || ''}
                  onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  required
                  fullWidth
                  disabled={saving}
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  label="Hora *"
                  type="time"
                  value={formData.appointment_time || ''}
                  onChange={(e) => setFormData({ ...formData, appointment_time: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  required
                  fullWidth
                  disabled={saving}
                />
              </Grid>
            </Grid>

            <FormControl fullWidth disabled={saving}>
              <InputLabel>Estado</InputLabel>
              <Select
                value={formData.status || 'scheduled'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                label="Estado"
              >
                <MenuItem value="scheduled">📋 Programado</MenuItem>
                <MenuItem value="confirmed">✅ Confirmado</MenuItem>
                <MenuItem value="completed">✔️ Completado</MenuItem>
                <MenuItem value="cancelled">❌ Cancelado</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth disabled={saving}>
              <InputLabel>Recordatorio</InputLabel>
              <Select
                value={formData.reminder_time || 60}
                onChange={(e) => setFormData({ ...formData, reminder_time: e.target.value as number })}
                label="Recordatorio"
              >
                {reminderTimes.map((time) => (
                  <MenuItem key={time.value} value={time.value}>
                    ⏰ {time.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth disabled={saving}>
              <InputLabel>Plantilla de Notificación</InputLabel>
              <Select
                value={formData.notification_template || 'default'}
                onChange={(e) => setFormData({ ...formData, notification_template: e.target.value })}
                label="Plantilla de Notificación"
              >
                {templates.map((template) => (
                  <MenuItem key={template.id} value={template.id}>
                    📝 {template.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {formData.notification_template && (
              <Paper sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Vista previa del mensaje:
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {previewTemplate(formData.notification_template)}
                </Typography>
              </Paper>
            )}

            <TextField
              label="Notas"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              multiline
              rows={2}
              fullWidth
              disabled={saving}
              placeholder="Notas adicionales..."
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2.5 }}>
          {selectedEvent && (
            <Button onClick={handleDelete} color="error" startIcon={<Delete />} disabled={saving}>
              Eliminar
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => setShowDialog(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de configuración con 3 tabs */}
      <Dialog
        open={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1.5rem' }}>
          ⚙️ Configuración del Calendario
        </DialogTitle>

        <Tabs value={settingsTab} onChange={(e, v) => setSettingsTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
          <Tab label="📝 Plantillas" />
          <Tab label="📁 Categorías" />
          <Tab label="⏰ Recordatorios" />
        </Tabs>

        <DialogContent sx={{ minHeight: 400 }}>
          {/* Tab 1: Plantillas */}
          {settingsTab === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Plantillas de Notificación
              </Typography>

              <Alert severity="info" sx={{ mb: 2 }}>
                Usa las siguientes variables: <code>{'{nombre}'}</code>, <code>{'{fecha}'}</code>, <code>{'{hora}'}</code>
              </Alert>

              <List>
                {templates.map((template) => (
                  <React.Fragment key={template.id}>
                    <ListItem>
                      <ListItemText
                        primary={template.name + (template.is_default ? ' (Predeterminada)' : '')}
                        secondary={template.message}
                      />
                      <ListItemSecondaryAction>
                        {!template.is_default && (
                          <IconButton
                            edge="end"
                            onClick={() => handleDeleteTemplate(template.id)}
                            color="error"
                          >
                            <Delete />
                          </IconButton>
                        )}
                      </ListItemSecondaryAction>
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>

              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                Nueva Plantilla
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Nombre de la plantilla"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  fullWidth
                />

                <TextField
                  label="Mensaje"
                  value={newTemplate.message}
                  onChange={(e) => setNewTemplate({ ...newTemplate, message: e.target.value })}
                  multiline
                  rows={4}
                  fullWidth
                  placeholder="Ej: Hola {nombre}, te recordamos tu cita del {fecha} a las {hora}"
                />

                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={handleAddTemplate}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Agregar Plantilla
                </Button>
              </Box>
            </Box>
          )}

          {/* Tab 2: Categorías */}
          {settingsTab === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Categorías de Consultas
              </Typography>

              <Alert severity="info" sx={{ mb: 2 }}>
                Crea categorías personalizadas para organizar tus citas
              </Alert>

              <List>
                {categories.map((category) => (
                  <React.Fragment key={category.id}>
                    <ListItem>
                      <Box
                        sx={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          backgroundColor: category.color,
                          mr: 2
                        }}
                      />
                      <ListItemText
                        primary={`${category.icon} ${category.name}`}
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => handleDeleteCategory(category.id)}
                          color="error"
                        >
                          <Delete />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>

              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                Nueva Categoría
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Nombre de la categoría"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  fullWidth
                  placeholder="Ej: Consulta General, Control, Urgencia"
                />

                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      label="Color"
                      type="color"
                      value={newCategory.color}
                      onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                      fullWidth
                    />
                  </Grid>

                  <Grid item xs={6}>
                    <TextField
                      label="Icono (emoji)"
                      value={newCategory.icon}
                      onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                      fullWidth
                      placeholder="📋"
                    />
                  </Grid>
                </Grid>

                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={handleAddCategory}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Agregar Categoría
                </Button>
              </Box>
            </Box>
          )}

          {/* Tab 3: Recordatorios */}
          {settingsTab === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Configuración de Recordatorios
              </Typography>

              <Alert severity="info" sx={{ mb: 3 }}>
                Los recordatorios se enviarán automáticamente por WhatsApp en los tiempos configurados
              </Alert>

              <List>
                {reminderTimes.map((time) => (
                  <ListItem key={time.value}>
                    <NotificationsIcon sx={{ mr: 2, color: '#1a73e8' }} />
                    <ListItemText
                      primary={time.label}
                      secondary={`El recordatorio se enviará ${time.label.toLowerCase()}`}
                    />
                    <Chip
                      label="Disponible"
                      size="small"
                      color="success"
                      variant="outlined"
                    />
                  </ListItem>
                ))}
              </List>

              <Divider sx={{ my: 3 }} />

              <Typography variant="subtitle1" gutterBottom>
                ℹ️ Información Adicional
              </Typography>

              <Typography variant="body2" color="text.secondary" paragraph>
                • Los recordatorios se envían automáticamente según el tiempo configurado
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                • Puedes personalizar el mensaje usando plantillas
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                • Los recordatorios solo se envían para citas con estado "Programado" o "Confirmado"
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setShowSettingsDialog(false)} variant="contained">
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <ModernNotification
        open={notification.open}
        onClose={closeNotification}
        message={notification.message}
        title={notification.title}
        type={notification.type}
        duration={notification.duration}
      />

      <ModernAlert
        open={alert.open}
        onClose={closeAlert}
        onConfirm={alert.onConfirm}
        title={alert.title}
        message={alert.message}
        type={alert.type}
        confirmText={alert.confirmText}
        cancelText={alert.cancelText}
        confirmColor={alert.confirmColor}
      />
    </Box>
  );
};

export default CalendarModule;
