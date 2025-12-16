import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getAPIBaseURL } from '../utils/socketConfig';
import AdminSubscriptionPanel from '../components/AdminSubscriptionPanel';
import APIRestSettings from '../components/APIRestSettings';
import PlanSelector from '../components/PlanSelector';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Avatar,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Tooltip,
  CircularProgress,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemIcon,
  LinearProgress,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Switch,
  FormControlLabel,
  ToggleButtonGroup,
  ToggleButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Badge,
  Menu,
  Checkbox,
  Alert,
  Slider,
  Radio,
  RadioGroup,
  FormGroup,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Snackbar
} from '@mui/material';
import {
  Settings,
  Security,
  People,
  Business,
  Notifications,
  Language,
  Palette,
  Code,
  CloudUpload,
  CloudDownload,
  VpnKey,
  Lock,
  Shield,
  AdminPanelSettings,
  SupervisorAccount,
  PersonAdd,
  Group,
  Edit,
  Delete,
  Visibility,
  VisibilityOff,
  Save,
  Cancel,
  Refresh,
  Download,
  Upload,
  Share,
  Link,
  Computer,
  Smartphone,
  Tablet,
  Storage,
  Memory,
  Speed,
  NetworkCheck,
  Wifi,
  Bluetooth,
  LocationOn,
  AccessTime,
  Schedule,
  CalendarToday,
  NotificationImportant,
  Email,
  Sms,
  WhatsApp,
  Telegram,
  Facebook,
  Twitter,
  Instagram,
  LinkedIn,
  YouTube,
  GitHub,
  Google,
  Microsoft,
  Apple,
  Amazon,
  Slack,
  Discord,
  Zoom,
  Teams,
  Dropbox,
  OneDrive,
  GoogleDrive,
  PayPal,
  Stripe,
  CreditCard,
  Payment,
  Receipt,
  AttachMoney,
  TrendingUp,
  Analytics,
  Assessment,
  Dashboard,
  Report,
  FileDownload,
  FileUpload,
  FolderOpen,
  Archive,
  Backup,
  Restore,
  History,
  Update,
  Build,
  BugReport,
  Feedback,
  HelpOutline,
  Support,
  ContactSupport,
  LiveHelp,
  Phone,
  MoreVert,
  ExpandMore,
  Add,
  Remove,
  Check,
  Close,
  Warning,
  Error as ErrorIcon,
  Info,
  Star,
  Flag,
  Label,
  Category,
  Tag,
  LocalOffer,
  Discount,
  Loyalty,
  CardGiftcard,
  Campaign,
  AutoAwesome,
  Psychology,
  SmartToy,
  Api,
  QrCode,
  Extension,
  Plugin,
  IntegrationInstructions,
  Webhook,
  Transform,
  DataUsage,
  Insights,
  Tune,
  FilterList,
  Sort,
  Search,
  FindReplace,
  Compare,
  SwapHoriz,
  ImportExport,
  SyncAlt,
  Loop,
  PlayArrow,
  Pause,
  Stop,
  Replay,
  SkipNext,
  SkipPrevious,
  FastForward,
  FastRewind,
  VolumeUp,
  VolumeDown,
  VolumeMute,
  Brightness4,
  Brightness7,
  DarkMode,
  LightMode,
  Contrast,
  InvertColors,
  FormatColorFill,
  ColorLens,
  Image,
  PhotoCamera,
  Videocam,
  Mic,
  MicOff,
  RecordVoiceOver,
  GraphicEq,
  Equalizer,
  QueueMusic,
  MusicNote,
  Album,
  LibraryMusic,
  Headset,
  Speaker,
  SurroundSound,
  HighQuality,
  Hd,
  FourK,
  VideoSettings,
  CameraEnhance,
  FlashOn,
  FlashOff,
  Timer,
  TimerOff,
  Alarm,
  AlarmOn,
  AlarmOff,
  Event,
  EventNote,
  Today,
  DateRange,
  Timeline,
  Gantt
} from '@mui/icons-material';

interface SettingsModuleProps {
  sessionId: string;
  onLogout?: () => void;
}

interface UserAccount {
  id: string;
  name: string;
  email: string;
  phone?: string; // 📱 Número de teléfono
  role: 'admin' | 'manager' | 'agent' | 'viewer';
  department: string;
  status: 'active' | 'inactive' | 'pending';
  avatar?: string;
  permissions: string[];
  lastLogin: string;
  createdAt: string;
  isOnline: boolean;
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    timezone: string;
    notifications: {
      email: boolean;
      push: boolean;
      sms: boolean;
      whatsapp: boolean;
    };
  };
}

interface SecuritySettings {
  twoFactorAuth: boolean;
  sessionTimeout: number;
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    expirationDays: number;
  };
  ipWhitelist: string[];
  apiRateLimit: {
    enabled: boolean;
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  auditLog: boolean;
  encryptionLevel: 'standard' | 'enhanced' | 'maximum';
  backupFrequency: 'daily' | 'weekly' | 'monthly';
}

interface Integration {
  id: string;
  name: string;
  type: 'crm' | 'payment' | 'analytics' | 'social' | 'storage' | 'communication' | 'automation';
  status: 'connected' | 'disconnected' | 'error';
  provider: string;
  description: string;
  icon: string;
  features: string[];
  config: Record<string, any>;
  isActive: boolean;
  lastSync?: string;
  errorMessage?: string;
}

interface SystemPreferences {
  general: {
    companyName: string;
    companyLogo?: string;
    timezone: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
    currency: string;
    language: string;
  };
  whatsapp: {
    autoReply: boolean;
    businessHours: {
      enabled: boolean;
      timezone: string;
      schedule: {
        monday: { start: string; end: string; enabled: boolean };
        tuesday: { start: string; end: string; enabled: boolean };
        wednesday: { start: string; end: string; enabled: boolean };
        thursday: { start: string; end: string; enabled: boolean };
        friday: { start: string; end: string; enabled: boolean };
        saturday: { start: string; end: string; enabled: boolean };
        sunday: { start: string; end: string; enabled: boolean };
      };
    };
    templates: {
      welcomeMessage: string;
      awayMessage: string;
      businessHoursMessage: string;
    };
  };
  notifications: {
    email: {
      enabled: boolean;
      smtp: {
        host: string;
        port: number;
        username: string;
        password: string;
        encryption: 'none' | 'tls' | 'ssl';
      };
    };
    webhook: {
      enabled: boolean;
      url: string;
      events: string[];
      retryAttempts: number;
    };
  };
  performance: {
    maxConcurrentChats: number;
    messageRetentionDays: number;
    autoDeleteInactiveChats: boolean;
    compressionLevel: 'low' | 'medium' | 'high';
    cacheDuration: number;
  };
}

interface BillingInfo {
  plan: 'basic' | 'professional' | 'enterprise';
  status: 'active' | 'cancelled' | 'past_due' | 'trial';
  nextBillingDate: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  usage: {
    messages: number;
    users: number;
    storage: number;
    apiCalls: number;
  };
  limits: {
    messages: number;
    users: number;
    storage: number;
    apiCalls: number;
  };
}

const SettingsModule: React.FC<SettingsModuleProps> = ({ sessionId, onLogout }) => {
  const location = useLocation();
  const [selectedTab, setSelectedTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [systemPreferences, setSystemPreferences] = useState<SystemPreferences | null>(null);
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [showIntegrationDialog, setShowIntegrationDialog] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [mySubscription, setMySubscription] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [syncPreference, setSyncPreference] = useState<any>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncHistoryOnConnect, setSyncHistoryOnConnect] = useState(() => {
    const saved = localStorage.getItem('whatsflow_sync_history');
    return saved === 'true';
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning' | 'info'
  });
  const [syncConfirmDialog, setSyncConfirmDialog] = useState(false);
  const [deleteUserDialog, setDeleteUserDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserAccount | null>(null);

  const [waSessions, setWaSessions] = useState<Array<{ sessionId: string; phoneNumber: string | null; ownerPhone?: string | null; isPrimary?: boolean; isConnected: boolean; name?: string; avatar?: string; hasAuth?: boolean }>>([]);
  const [waLoading, setWaLoading] = useState(false);
  const [waError, setWaError] = useState('');
  const [qrState, setQrState] = useState<{ sessionId: string; qrDataUrl: string; isLoading: boolean }>({ sessionId: '', qrDataUrl: '', isLoading: false });
  const qrPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [deviceId, setDeviceId] = useState('');

  // Estados para formulario de usuario
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'agent',
    department: '',
    phone: '',
    avatar_url: '' // 🖼️ Avatar del contacto
  });

  // Estados para búsqueda de contactos
  const [contactSearchOpen, setContactSearchOpen] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [availableContacts, setAvailableContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Estados para modal de permisos
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<UserAccount | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  // Lista de módulos disponibles
  const availableModules = [
    { id: 'dashboard', name: 'Dashboard', icon: '📊', description: 'Vista general del sistema' },
    { id: 'chats', name: 'Chats', icon: '💬', description: 'Gestión de conversaciones' },
    { id: 'contacts', name: 'Contactos', icon: '👥', description: 'Administrar contactos' },
    { id: 'campaigns', name: 'Campañas', icon: '📢', description: 'Crear y gestionar campañas' },
    { id: 'calendar', name: 'Calendario', icon: '📅', description: 'Gestión de citas' },
    { id: 'crm', name: 'CRM', icon: '📇', description: 'Gestión de relaciones' },
    { id: 'kanban', name: 'Kanban', icon: '📋', description: 'Tableros de contactos' },
    { id: 'chatbot', name: 'Chatbot', icon: '🤖', description: 'Automatización de respuestas' },
    { id: 'analytics', name: 'Analytics', icon: '📈', description: 'Estadísticas y reportes' },
    { id: 'settings', name: 'Configuración', icon: '⚙️', description: 'Ajustes del sistema' }
  ];

  const planMaxChannels = mySubscription?.plan_details?.max_channels ?? mySubscription?.plan_details?.max_sessions ?? Infinity;
  const normalizedMaxChannels = planMaxChannels && planMaxChannels > 0 ? planMaxChannels : Infinity;

  useEffect(() => {
    // Force admin/superadmin for specific number immediately
    if (sessionId?.includes('595994854167')) {
      console.log('👑 Super Admin detectado por número:', sessionId);
      setIsAdmin(true);
      setIsSuperAdmin(true);
    }
    loadSettingsData();
  }, [sessionId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    const openPlanFlag = sessionStorage.getItem('openPlanTab') === 'true';
    if (tabParam === 'plan' || openPlanFlag) {
      setSelectedTab(3);
      sessionStorage.removeItem('openPlanTab');
    }
  }, [location.search]);

  // 📱 Función para cargar contactos de WhatsApp
  const loadWhatsAppContacts = async () => {
    const currentSessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
    if (!currentSessionId) return;

    setLoadingContacts(true);
    try {
      const API_BASE = getAPIBaseURL();
      const response = await fetch(`${API_BASE}/api/contacts/${currentSessionId}`);
      const data = await response.json();

      if (data.success && data.contacts) {
        console.log('[CONTACTS] 📋 Contactos cargados:', data.contacts.length);
        setAvailableContacts(data.contacts);
      }
    } catch (error) {
      console.error('[CONTACTS] ❌ Error cargando contactos:', error);
    } finally {
      setLoadingContacts(false);
    }
  };

  const loadSettingsData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Cargar suscripción actual del usuario
      try {
        const subResponse = await fetch(`${getAPIBaseURL()}/api/subscriptions/my-subscription?phone=${sessionId}`);
        const subData = await subResponse.json();

        if (subData.success) {
          setMySubscription(subData.subscription);
          if (subData.subscription) {
            setIsAdmin(subData.subscription.is_admin || sessionId?.includes('595994854167'));
            setIsSuperAdmin(subData.subscription.is_super_admin || sessionId?.includes('595994854167'));
            const status = subData.subscription.subscription_status;
            const daysRemaining = subData.subscription.days_remaining ?? 0;
            if (status === 'expired' || status === 'inactive' || (status === 'trial' && daysRemaining <= 0)) {
              setSelectedTab(3);
            }
          } else {
            // Sin suscripción, verificar si es super admin por teléfono
            setIsAdmin(sessionId?.includes('595994854167') || false);
            setIsSuperAdmin(sessionId?.includes('595994854167') || false);
            setSelectedTab(3);
          }
        }
      } catch (error) {
        console.error('Error loading subscription:', error);
      }

      // Cargar preferencia de sincronización
      try {
        const syncResponse = await fetch(`${getAPIBaseURL()}/api/sync/preference/${sessionId}`);
        const syncData = await syncResponse.json();

        if (syncData.success) {
          console.log('[SYNC-LOAD] Preferencia cargada desde BD:', syncData);
          console.log('[SYNC-LOAD] auto_sync valor:', syncData.auto_sync);
          setSyncPreference(syncData);
        } else {
          console.log('[SYNC-LOAD] No se pudo cargar preferencia:', syncData);
        }
      } catch (error) {
        console.error('[SYNC-LOAD] Error loading sync preference:', error);
      }

      // Cargar usuarios reales desde la API
      try {
        const headers: any = {
          'Content-Type': 'application/json'
        };

        const actualSessionId = sessionId || sessionStorage.getItem('whatsflow_session') || sessionStorage.getItem('sessionId');

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        } else if (actualSessionId) {
          headers['X-Session-Id'] = actualSessionId;
        }

        const usersResponse = await fetch(`${getAPIBaseURL()}/api/users${actualSessionId ? `?sessionId=${actualSessionId}` : ''}`, {
          headers
        });
        const usersData = await usersResponse.json();

        if (usersData.success && usersData.users) {
          // Mapear usuarios de la BD al formato del frontend
          const mappedUsers: UserAccount[] = usersData.users.map((user: any) => ({
            id: user.id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department || 'Sin asignar',
            status: user.status,
            avatar: user.avatar_url,
            permissions: [],
            lastLogin: user.last_login,
            createdAt: user.created_at,
            isOnline: false,
            preferences: {
              theme: 'auto',
              language: 'es',
              timezone: 'America/Asuncion',
              notifications: {
                email: true,
                push: true,
                sms: false,
                whatsapp: true
              }
            }
          }));
          setUsers(mappedUsers);
        } else {
          setUsers([]);
        }
      } catch (error) {
        console.error('Error loading users:', error);
        setUsers([]);
      }

      // Mock Security Settings
      const mockSecuritySettings: SecuritySettings = {
        twoFactorAuth: true,
        sessionTimeout: 8,
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          expirationDays: 90
        },
        ipWhitelist: ['192.168.1.0/24', '10.0.0.0/8'],
        apiRateLimit: {
          enabled: true,
          requestsPerMinute: 100,
          requestsPerHour: 5000
        },
        auditLog: true,
        encryptionLevel: 'enhanced',
        backupFrequency: 'daily'
      };

      // Mock Integrations
      const mockIntegrations: Integration[] = [
        {
          id: 'hubspot_integration',
          name: 'HubSpot CRM',
          type: 'crm',
          status: 'connected',
          provider: 'HubSpot',
          description: 'Sincroniza contactos y deals automáticamente',
          icon: '🔗',
          features: ['Contactos', 'Deals', 'Notas', 'Actividades'],
          config: {
            apiKey: 'hs_***************',
            syncInterval: 15,
            autoCreateContacts: true
          },
          isActive: true,
          lastSync: '2024-01-20T14:25:00Z'
        },
        {
          id: 'stripe_integration',
          name: 'Stripe Payments',
          type: 'payment',
          status: 'connected',
          provider: 'Stripe',
          description: 'Procesa pagos y gestiona suscripciones',
          icon: '💳',
          features: ['Pagos', 'Suscripciones', 'Facturas', 'Webhooks'],
          config: {
            publishableKey: 'pk_***************',
            webhookUrl: 'https://api.whatsflow.com/webhooks/stripe'
          },
          isActive: true,
          lastSync: '2024-01-20T14:20:00Z'
        },
        {
          id: 'zapier_integration',
          name: 'Zapier Automation',
          type: 'automation',
          status: 'connected',
          provider: 'Zapier',
          description: 'Automatiza workflows con 5000+ aplicaciones',
          icon: '⚡',
          features: ['Triggers', 'Actions', 'Filters', 'Delays'],
          config: {
            webhookUrl: 'https://hooks.zapier.com/hooks/catch/***'
          },
          isActive: true,
          lastSync: '2024-01-20T14:15:00Z'
        },
        {
          id: 'slack_integration',
          name: 'Slack',
          type: 'communication',
          status: 'disconnected',
          provider: 'Slack',
          description: 'Recibe notificaciones en tu workspace',
          icon: '💬',
          features: ['Notificaciones', 'Comandos', 'Bot'],
          config: {},
          isActive: false
        },
        {
          id: 'google_analytics',
          name: 'Google Analytics',
          type: 'analytics',
          status: 'error',
          provider: 'Google',
          description: 'Tracking avanzado de conversiones',
          icon: '📊',
          features: ['Events', 'Goals', 'Ecommerce', 'Custom Dimensions'],
          config: {
            trackingId: 'GA-***************'
          },
          isActive: false,
          errorMessage: 'API key expirada'
        }
      ];

      // Mock System Preferences
      const mockSystemPreferences: SystemPreferences = {
        general: {
          companyName: 'Tu Empresa',
          timezone: 'America/Asuncion',
          dateFormat: 'DD/MM/YYYY',
          timeFormat: '24h',
          currency: 'PYG',
          language: 'es'
        },
        whatsapp: {
          autoReply: true,
          businessHours: {
            enabled: true,
            timezone: 'America/Asuncion',
            schedule: {
              monday: { start: '08:00', end: '17:00', enabled: true },
              tuesday: { start: '08:00', end: '17:00', enabled: true },
              wednesday: { start: '08:00', end: '17:00', enabled: true },
              thursday: { start: '08:00', end: '17:00', enabled: true },
              friday: { start: '08:00', end: '17:00', enabled: true },
              saturday: { start: '08:00', end: '12:00', enabled: false },
              sunday: { start: '08:00', end: '12:00', enabled: false }
            }
          },
          templates: {
            welcomeMessage: '¡Hola! Gracias por contactarnos. ¿En qué podemos ayudarte?',
            awayMessage: 'Actualmente no estamos disponibles. Te responderemos lo antes posible.',
            businessHoursMessage: 'Nuestro horario de atención es de lunes a viernes de 9:00 a 18:00.'
          }
        },
        notifications: {
          email: {
            enabled: true,
            smtp: {
              host: 'smtp.gmail.com',
              port: 587,
              username: 'notifications@whatsflow.com',
              password: '************',
              encryption: 'tls'
            }
          },
          webhook: {
            enabled: true,
            url: 'https://api.yourapp.com/webhooks/whatsflow',
            events: ['message.received', 'conversation.started', 'conversation.ended'],
            retryAttempts: 3
          }
        },
        performance: {
          maxConcurrentChats: 100,
          messageRetentionDays: 365,
          autoDeleteInactiveChats: false,
          compressionLevel: 'medium',
          cacheDuration: 3600
        }
      };

      // Mock Billing Info
      const mockBillingInfo: BillingInfo = {
        plan: 'enterprise',
        status: 'active',
        nextBillingDate: '2024-02-20',
        amount: 299,
        currency: 'EUR',
        paymentMethod: 'Visa **** 4242',
        usage: {
          messages: 245678,
          users: 45,
          storage: 25.6,
          apiCalls: 145000
        },
        limits: {
          messages: 500000,
          users: 100,
          storage: 100,
          apiCalls: 250000
        }
      };

      // Los usuarios ya fueron cargados arriba, no necesitamos setUsers(mockUsers)
      setSecuritySettings(mockSecuritySettings);
      setIntegrations(mockIntegrations);
      setSystemPreferences(mockSystemPreferences);
      setBillingInfo(mockBillingInfo);
    } catch (error) {
      console.error('Error loading settings data:', error);
    } finally {
      setLoading(false);
    }
  };

  const stopQrPolling = () => {
    if (qrPollRef.current) {
      clearInterval(qrPollRef.current);
      qrPollRef.current = null;
    }
  };

  const fetchActiveSessions = async () => {
    setWaLoading(true);
    setWaError('');

    try {
      // ✅ Enviar sessionId para filtrar sesiones del usuario autenticado
      const response = await fetch(`${getAPIBaseURL()}/api/sessions/active?sessionId=${encodeURIComponent(sessionId)}`);
      const data = await response.json();

      if (data.success) {
        setWaSessions(data.sessions || []);
      } else {
        setWaError(data.error || 'No se pudieron cargar las sesiones activas');
      }
    } catch (error) {
      console.error('[WHATSAPP] Error cargando sesiones activas:', error);
      setWaError('No se pudieron cargar las sesiones activas');
    } finally {
      setWaLoading(false);
    }
  };

  const pollSessionStatus = (targetSessionId: string) => {
    if (!targetSessionId) return;
    stopQrPolling();

    qrPollRef.current = setInterval(async () => {
      try {
        const resp = await fetch(`${getAPIBaseURL()}/api/session/${targetSessionId}/status?deviceId=${encodeURIComponent(deviceId)}`);
        const data = await resp.json();

        if (data.success && data.isConnected) {
          stopQrPolling();
          setQrState({ sessionId: '', qrDataUrl: '', isLoading: false });
          setSnackbar({ open: true, message: `Sesión ${data.phoneNumber || targetSessionId} conectada`, severity: 'success' });
          fetchActiveSessions();
        }
      } catch (err) {
        console.warn('[WHATSAPP] Error al verificar estado de sesión:', err);
      }
    }, 2000);
  };

  const startQrFlow = async () => {
    const ensuredDeviceId = deviceId || localStorage.getItem('whatsflow_device_id') || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    if (!deviceId) {
      setDeviceId(ensuredDeviceId);
      localStorage.setItem('whatsflow_device_id', ensuredDeviceId);
    }

    setWaError('');
    setQrState({ sessionId: '', qrDataUrl: '', isLoading: true });

    try {
      // Usar /api/qr-refresh para forzar regeneración de QR
      const response = await fetch(`${getAPIBaseURL()}/api/qr-refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: ensuredDeviceId,
          ownerPhone: sessionId
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'No se pudo generar el código QR');
      }

      setQrState({
        sessionId: data.sessionId,
        qrDataUrl: data.qrDataUrl || '',
        isLoading: false
      });

      if (data.sessionId) {
        pollSessionStatus(data.sessionId);
      }
    } catch (error: any) {
      console.error('[WHATSAPP] Error iniciando QR:', error);
      setWaError(error?.message || 'No se pudo iniciar la conexión');
      setQrState({ sessionId: '', qrDataUrl: '', isLoading: false });
      stopQrPolling();
    }
  };

  const disconnectSession = async (targetSessionId: string) => {
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/sessions/${targetSessionId}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerPhone: sessionId })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'No se pudo desconectar la sesión');
      }

      setSnackbar({ open: true, message: 'Sesión desconectada', severity: 'success' });
      fetchActiveSessions();
    } catch (error: any) {
      console.error('[WHATSAPP] Error desconectando sesión:', error);
      setWaError(error?.message || 'No se pudo desconectar la sesión');
    }
  };

  // Diálogo de confirmación para desconexión
  const [disconnectDialog, setDisconnectDialog] = useState<{ open: boolean; targetSessionId: string; isPrimary: boolean; hasSecondaries: boolean }>({ open: false, targetSessionId: '', isPrimary: false, hasSecondaries: false });

  const openDisconnectDialog = (targetSessionId: string) => {
    const targetSession = waSessions.find((s: any) => s.sessionId === targetSessionId);
    const isPrimary = targetSession?.isPrimary || targetSessionId === sessionId;
    const hasSecondaries = waSessions.filter((s: any) => s.ownerPhone === targetSession?.phoneNumber).length > 0;

    setDisconnectDialog({ open: true, targetSessionId, isPrimary, hasSecondaries });
  };

  const closeDisconnectDialog = () => {
    setDisconnectDialog({ open: false, targetSessionId: '', isPrimary: false, hasSecondaries: false });
  };

  const confirmDisconnect = async () => {
    const { targetSessionId, isPrimary } = disconnectDialog;
    closeDisconnectDialog();
    await disconnectSession(targetSessionId);

    if (isPrimary) {
      setSnackbar({ open: true, message: 'Se desconectó la línea principal. El sistema puede cerrar sesión.', severity: 'warning' });
      try {
        const resp = await fetch(`${getAPIBaseURL()}/api/logout-session`, { method: 'POST' });
        await resp.json().catch(() => { });
      } catch (e) {
        // Ignorar si no existe endpoint
      }
    }
  };

  const handleReconnectSession = async (targetSessionId: string) => {
    try {
      setSnackbar({ open: true, message: 'Reconectando sesión...', severity: 'info' });

      const response = await fetch(`${getAPIBaseURL()}/api/reconnect-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId: targetSessionId })
      });

      const data = await response.json();

      if (data.success) {
        setSnackbar({ open: true, message: 'Sesión reconectada exitosamente', severity: 'success' });
        fetchActiveSessions();
      } else {
        setSnackbar({ open: true, message: data.error || 'Error al reconectar sesión', severity: 'error' });
      }
    } catch (error) {
      console.error('[RECONNECT] Error:', error);
      setSnackbar({ open: true, message: 'Error al reconectar sesión', severity: 'error' });
    }
  };

  useEffect(() => {
    let storedDeviceId = localStorage.getItem('whatsflow_device_id');
    if (!storedDeviceId) {
      storedDeviceId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem('whatsflow_device_id', storedDeviceId);
    }
    setDeviceId(storedDeviceId);

    return () => {
      stopQrPolling();
    };
  }, []);

  useEffect(() => {
    if (selectedTab === 2 && sessionId) {
      console.log('[SETTINGS] Tab WhatsApp activa, cargando sesiones para:', sessionId);
      fetchActiveSessions();
    }
  }, [selectedTab, sessionId]);

  // ============== FUNCIONES CRUD DE USUARIOS ==============

  const handleOpenUserDialog = (user?: UserAccount) => {
    if (user) {
      setSelectedUser(user);
      setUserForm({
        name: user.name,
        email: user.email,
        password: '',
        role: user.role,
        department: user.department || '',
        phone: user.phone || '',
        avatar_url: user.avatar || ''
      });
    } else {
      setSelectedUser(null);
      setUserForm({
        name: '',
        email: '',
        password: '',
        role: 'agent',
        department: '',
        phone: '',
        avatar_url: ''
      });
    }
    setShowUserDialog(true);
  };

  const handleSaveUser = async () => {
    try {
      setSaveStatus('saving');
      const token = localStorage.getItem('token');

      if (selectedUser) {
        // Editar usuario existente
        const response = await fetch(`${getAPIBaseURL()}/api/users/${selectedUser.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(userForm)
        });

        const data = await response.json();
        if (data.success) {
          setSaveStatus('saved');
          setShowUserDialog(false);
          loadSettingsData(); // Recargar lista
          setTimeout(() => setSaveStatus('idle'), 2000);
        } else {
          throw new Error(data.error || 'Error al actualizar usuario');
        }
      } else {
        // Crear nuevo usuario
        if (!userForm.password) {
          alert('La contraseña es requerida para nuevos usuarios');
          setSaveStatus('idle');
          return;
        }

        const headers: any = {
          'Content-Type': 'application/json'
        };

        const actualSessionId = sessionId || sessionStorage.getItem('whatsflow_session') || sessionStorage.getItem('sessionId');

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        } else if (actualSessionId) {
          headers['X-Session-Id'] = actualSessionId;
        }

        const response = await fetch(`${getAPIBaseURL()}/api/users`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...userForm,
            sessionId: actualSessionId
          })
        });

        const data = await response.json();
        if (data.success) {
          setSaveStatus('saved');
          setShowUserDialog(false);
          loadSettingsData(); // Recargar lista
          setTimeout(() => setSaveStatus('idle'), 2000);
        } else {
          throw new Error(data.error || 'Error al crear usuario');
        }
      }
    } catch (error) {
      console.error('Error saving user:', error);
      alert((error as Error).message || 'Error al guardar usuario');
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const openDeleteUserConfirmation = (user: UserAccount) => {
    setUserToDelete(user);
    setDeleteUserDialog(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      const token = localStorage.getItem('token');
      const headers: any = {};

      const actualSessionId = sessionId || sessionStorage.getItem('whatsflow_session') || sessionStorage.getItem('sessionId');

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else if (actualSessionId) {
        headers['X-Session-Id'] = actualSessionId;
      }

      const response = await fetch(`${getAPIBaseURL()}/api/users/${userToDelete.id}${actualSessionId ? `?sessionId=${actualSessionId}` : ''}`, {
        method: 'DELETE',
        headers
      });

      const data = await response.json();
      if (data.success) {
        setSnackbar({
          open: true,
          message: 'Usuario eliminado exitosamente',
          severity: 'success'
        });
        setDeleteUserDialog(false);
        setUserToDelete(null);
        loadSettingsData(); // Recargar lista
      } else {
        throw new Error(data.error || 'Error al eliminar usuario');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert((error as Error).message || 'Error al eliminar usuario');
    }
  };

  // Funciones para gestionar permisos
  const handleOpenPermissionsDialog = (user: UserAccount) => {
    setSelectedUserForPermissions(user);
    setSelectedPermissions(user.permissions || []);
    setPermissionsDialogOpen(true);
  };

  const handleClosePermissionsDialog = () => {
    setPermissionsDialogOpen(false);
    setSelectedUserForPermissions(null);
    setSelectedPermissions([]);
  };

  const handleTogglePermission = (moduleId: string) => {
    setSelectedPermissions(prev =>
      prev.includes(moduleId)
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const handleSavePermissions = async () => {
    if (!selectedUserForPermissions) return;

    try {
      // Convertir permisos a formato esperado por el backend
      const permissionsFormatted = selectedPermissions.map(moduleId => ({
        permission_id: moduleId,
        can_view: true,
        can_create: true,
        can_edit: true,
        can_delete: false
      }));

      const response = await fetch(`${getAPIBaseURL()}/api/users/${selectedUserForPermissions.id}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ permissions: permissionsFormatted })
      });

      const data = await response.json();

      if (data.success) {
        setSnackbar({
          open: true,
          message: 'Permisos actualizados exitosamente',
          severity: 'success'
        });
        handleClosePermissionsDialog();
        loadSettingsData(); // Recargar lista
      } else {
        throw new Error(data.error || 'Error al actualizar permisos');
      }
    } catch (error) {
      console.error('Error updating permissions:', error);
      setSnackbar({
        open: true,
        message: (error as Error).message || 'Error al actualizar permisos',
        severity: 'error'
      });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <AdminPanelSettings sx={{ color: '#f44336' }} />;
      case 'manager': return <SupervisorAccount sx={{ color: '#ff9800' }} />;
      case 'agent': return <People sx={{ color: '#2196f3' }} />;
      case 'viewer': return <Visibility sx={{ color: '#9e9e9e' }} />;
      default: return <People />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#4caf50';
      case 'inactive': return '#9e9e9e';
      case 'pending': return '#ff9800';
      case 'connected': return '#4caf50';
      case 'disconnected': return '#9e9e9e';
      case 'error': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  const getIntegrationIcon = (type: string) => {
    switch (type) {
      case 'crm': return <Business />;
      case 'payment': return <Payment />;
      case 'analytics': return <Analytics />;
      case 'social': return <Share />;
      case 'storage': return <Storage />;
      case 'communication': return <Email />;
      case 'automation': return <AutoAwesome />;
      default: return <Extension />;
    }
  };

  const handleSaveSettings = async () => {
    setSaveStatus('saving');
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleToggleSyncHistory = (enabled: boolean) => {
    setSyncHistoryOnConnect(enabled);
    localStorage.setItem('whatsflow_sync_history', enabled.toString());
  };

  const handleToggleAutoSync = async (enabled: boolean) => {
    try {
      setSyncLoading(true);

      console.log(`[SYNC] Cambiando auto_sync a: ${enabled}`);

      const response = await fetch(`${getAPIBaseURL()}/api/sync/preference/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ auto_sync: enabled })
      });

      const data = await response.json();

      if (data.success) {
        // Actualizar el estado inmediatamente con el valor que devuelve el servidor
        const newPreference = {
          ...syncPreference,
          auto_sync: data.auto_sync !== undefined ? data.auto_sync : enabled
        };
        setSyncPreference(newPreference);

        console.log(`[SYNC] Estado actualizado en frontend:`, newPreference);
        console.log(`[SYNC] auto_sync guardado en BD:`, data.auto_sync);

        setSnackbar({
          open: true,
          message: data.message || (enabled
            ? '✅ Sincronización automática activada. Descargando datos...'
            : 'Sincronización automática desactivada'),
          severity: 'success'
        });

        // Si se activa, iniciar sincronización inmediata
        if (enabled) {
          console.log('[AUTO-SYNC] Iniciando sincronización automática inmediata...');
          // Esperar 1 segundo para que el snackbar se muestre
          setTimeout(() => {
            handleForceSync(true);
          }, 1000);
        }
      } else {
        setSnackbar({
          open: true,
          message: 'Error al actualizar preferencia: ' + data.error,
          severity: 'error'
        });
      }
    } catch (error) {
      console.error('Error toggling auto sync:', error);
      setSnackbar({
        open: true,
        message: 'Error al actualizar preferencia',
        severity: 'error'
      });
    } finally {
      setSyncLoading(false);
    }
  };

  const handleForceSync = async (silent: boolean = false) => {
    // Cerrar dialog si estaba abierto
    setSyncConfirmDialog(false);

    try {
      setSyncLoading(true);

      console.log('[FORCE-SYNC] Iniciando sincronización forzada...');
      console.log('[FORCE-SYNC] SessionId:', sessionId);
      console.log('[FORCE-SYNC] Silent:', silent);

      if (!silent) {
        setSnackbar({
          open: true,
          message: '🔄 Iniciando sincronización completa...',
          severity: 'info'
        });
      }

      const url = `${getAPIBaseURL()}/api/sync/force/${sessionId}`;
      console.log('[FORCE-SYNC] URL:', url);

      const response = await fetch(url, {
        method: 'POST'
      });

      console.log('[FORCE-SYNC] Response status:', response.status);
      const data = await response.json();
      console.log('[FORCE-SYNC] Response data:', data);

      if (data.success) {
        // Actualizar solo sync_completed y last_sync_date, NO tocar auto_sync
        setSyncPreference((prev: any) => ({
          ...prev,
          sync_completed: true,
          last_sync_date: new Date().toISOString()
        }));

        const totalSynced = (data.stats.chats || 0) + (data.stats.contacts || 0) + (data.stats.groups || 0);

        setSnackbar({
          open: true,
          message: `🎉 ¡Sincronización completa! Se descargaron ${data.stats.chats || 0} chats, ${data.stats.contacts || 0} contactos y ${data.stats.groups || 0} grupos (Total: ${totalSynced})`,
          severity: 'success'
        });
      } else {
        console.error('[FORCE-SYNC] Error:', data.error);
        setSnackbar({
          open: true,
          message: 'Error al sincronizar: ' + data.error,
          severity: 'error'
        });
      }
    } catch (error) {
      console.error('[FORCE-SYNC] Exception:', error);
      setSnackbar({
        open: true,
        message: 'Error al sincronizar. Verifica que WhatsApp esté conectado.',
        severity: 'error'
      });
    } finally {
      setSyncLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} sx={{ color: '#795548' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{
        mb: 4,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #795548 0%, #5d4037 100%)',
        borderRadius: 3,
        p: 3,
        color: 'white'
      }}>
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
            ⚙️ Configuración Enterprise
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9, fontWeight: 300 }}>
            General • Seguridad • WhatsApp • Mi Plan • API REST
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={saveStatus === 'saving' ? <CircularProgress size={16} /> : <Save />}
            onClick={handleSaveSettings}
            disabled={saveStatus === 'saving'}
            sx={{
              bgcolor: saveStatus === 'saved' ? '#4caf50' : saveStatus === 'error' ? '#f44336' : 'rgba(255,255,255,0.2)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
            }}
          >
            {saveStatus === 'saved' ? 'Guardado' : saveStatus === 'error' ? 'Error' : 'Guardar Cambios'}
          </Button>
          <Button
            variant="contained"
            startIcon={<Backup />}
            sx={{
              bgcolor: 'rgba(255,255,255,0.2)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
            }}
          >
            Backup
          </Button>
        </Box>
      </Box>

      {/* Tabs principales */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={selectedTab} onChange={(_, newValue) => setSelectedTab(newValue)}>
          <Tab label="General" />
          <Tab label="Seguridad" />
          <Tab label="WhatsApp" />
          <Tab label="Mi Plan" />
          <Tab label="🔌 API REST" />
          {isSuperAdmin && <Tab label="🔐 Panel Admin" />}
        </Tabs>
      </Paper>

      {/* Contenido de las tabs */}
      {selectedTab === 0 && systemPreferences && (
        <Grid container spacing={3}>
          {/* Configuración general */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>🏢 Información de la Empresa</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Nombre de la Empresa"
                      value={systemPreferences.general.companyName}
                      variant="outlined"
                      size="small"
                      placeholder="Ej: Mi Empresa SRL"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Dirección"
                      variant="outlined"
                      size="small"
                      placeholder="Ej: Av. Mariscal López 1234, Asunción"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Teléfono"
                      variant="outlined"
                      size="small"
                      placeholder="Ej: +595 21 123456"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Email"
                      variant="outlined"
                      size="small"
                      placeholder="Ej: contacto@miempresa.com.py"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Ciudad"
                      variant="outlined"
                      size="small"
                      value="Asunción"
                      placeholder="Asunción"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Zona Horaria</InputLabel>
                      <Select
                        value={systemPreferences.general.timezone}
                        label="Zona Horaria"
                        disabled
                      >
                        <MenuItem value="America/Asuncion">América/Asunción (Paraguay)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Moneda</InputLabel>
                      <Select
                        value={systemPreferences.general.currency}
                        label="Moneda"
                        disabled
                      >
                        <MenuItem value="PYG">Guaraní (₲)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Idioma</InputLabel>
                      <Select
                        value={systemPreferences.general.language}
                        label="Idioma"
                        disabled
                      >
                        <MenuItem value="es">Español</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Configuración de notificaciones */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>🔔 Notificaciones</Typography>
                <Box sx={{ mb: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={systemPreferences.notifications.email.enabled}
                        color="primary"
                      />
                    }
                    label="Notificaciones por Email"
                  />
                </Box>
                <Box sx={{ mb: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={systemPreferences.notifications.webhook.enabled}
                        color="primary"
                      />
                    }
                    label="Webhooks"
                  />
                </Box>
                {systemPreferences.notifications.webhook.enabled && (
                  <TextField
                    fullWidth
                    label="URL del Webhook"
                    value={systemPreferences.notifications.webhook.url}
                    variant="outlined"
                    size="small"
                    sx={{ mb: 2 }}
                  />
                )}
                <Typography variant="subtitle2" gutterBottom>Eventos del Webhook:</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {systemPreferences.notifications.webhook.events.map((event) => (
                    <Chip key={event} label={event} size="small" variant="outlined" />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Configuración de Sincronización */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>🔄 Sincronización de WhatsApp</Typography>
                <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
                  Controla cuándo sincronizar tus chats, contactos y grupos de WhatsApp.
                </Typography>

                <Alert severity="success" sx={{ mb: 3 }}>
                  <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
                    ✅ Sincronización Automática SIEMPRE Activa
                  </Typography>
                  <Typography variant="body2">
                    Al conectar WhatsApp (escanear QR), el sistema descargará automáticamente:
                  </Typography>
                  <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
                    <li>📱 Todos los chats individuales</li>
                    <li>👥 Todos los grupos</li>
                    <li>📞 Todos los contactos</li>
                    <li>💬 Historial de mensajes recientes</li>
                  </Box>
                  <Typography variant="caption" sx={{ mt: 1, display: 'block', fontStyle: 'italic' }}>
                    No necesitas hacer nada, la descarga inicia automáticamente.
                  </Typography>
                </Alert>


              </CardContent>
            </Card>
          </Grid>

          {/* Configuración de rendimiento */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>⚡ Rendimiento del Sistema</Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="Chats Concurrentes Máximos"
                      type="number"
                      value={systemPreferences.performance.maxConcurrentChats}
                      variant="outlined"
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="Retención de Mensajes (días)"
                      type="number"
                      value={systemPreferences.performance.messageRetentionDays}
                      variant="outlined"
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Nivel de Compresión</InputLabel>
                      <Select
                        value={systemPreferences.performance.compressionLevel}
                        label="Nivel de Compresión"
                      >
                        <MenuItem value="low">Bajo</MenuItem>
                        <MenuItem value="medium">Medio</MenuItem>
                        <MenuItem value="high">Alto</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="Duración de Caché (seg)"
                      type="number"
                      value={systemPreferences.performance.cacheDuration}
                      variant="outlined"
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={systemPreferences.performance.autoDeleteInactiveChats}
                          color="primary"
                        />
                      }
                      label="Eliminar automáticamente chats inactivos"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {selectedTab === 1 && securitySettings && (
        <Grid container spacing={3}>
          {/* Configuración de seguridad */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>🔐 Autenticación y Acceso</Typography>
                <Box sx={{ mb: 3 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={securitySettings.twoFactorAuth}
                        color="primary"
                      />
                    }
                    label="Autenticación de dos factores obligatoria"
                  />
                </Box>
                <TextField
                  fullWidth
                  label="Timeout de sesión (horas)"
                  type="number"
                  value={securitySettings.sessionTimeout}
                  variant="outlined"
                  size="small"
                  sx={{ mb: 2 }}
                />
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>Nivel de Encriptación</InputLabel>
                  <Select
                    value={securitySettings.encryptionLevel}
                    label="Nivel de Encriptación"
                  >
                    <MenuItem value="standard">Estándar</MenuItem>
                    <MenuItem value="enhanced">Mejorado</MenuItem>
                    <MenuItem value="maximum">Máximo</MenuItem>
                  </Select>
                </FormControl>
                <Box sx={{ mb: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={securitySettings.auditLog}
                        color="primary"
                      />
                    }
                    label="Registro de auditoría"
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Política de contraseñas */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>🔑 Política de Contraseñas</Typography>
                <TextField
                  fullWidth
                  label="Longitud mínima"
                  type="number"
                  value={securitySettings.passwordPolicy.minLength}
                  variant="outlined"
                  size="small"
                  sx={{ mb: 2 }}
                />
                <Box sx={{ mb: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={securitySettings.passwordPolicy.requireUppercase}
                      />
                    }
                    label="Requiere mayúsculas"
                  />
                </Box>
                <Box sx={{ mb: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={securitySettings.passwordPolicy.requireLowercase}
                      />
                    }
                    label="Requiere minúsculas"
                  />
                </Box>
                <Box sx={{ mb: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={securitySettings.passwordPolicy.requireNumbers}
                      />
                    }
                    label="Requiere números"
                  />
                </Box>
                <Box sx={{ mb: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={securitySettings.passwordPolicy.requireSpecialChars}
                      />
                    }
                    label="Requiere caracteres especiales"
                  />
                </Box>
                <TextField
                  fullWidth
                  label="Expiración (días)"
                  type="number"
                  value={securitySettings.passwordPolicy.expirationDays}
                  variant="outlined"
                  size="small"
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Rate limiting y whitelist */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>🛡️ Protección y Límites</Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ mb: 2 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={securitySettings.apiRateLimit.enabled}
                            color="primary"
                          />
                        }
                        label="Límite de velocidad API"
                      />
                    </Box>
                    {securitySettings.apiRateLimit.enabled && (
                      <>
                        <TextField
                          fullWidth
                          label="Requests por minuto"
                          type="number"
                          value={securitySettings.apiRateLimit.requestsPerMinute}
                          variant="outlined"
                          size="small"
                          sx={{ mb: 2 }}
                        />
                        <TextField
                          fullWidth
                          label="Requests por hora"
                          type="number"
                          value={securitySettings.apiRateLimit.requestsPerHour}
                          variant="outlined"
                          size="small"
                        />
                      </>
                    )}
                  </Grid>
                  <Grid item xs={12} md={8}>
                    <Typography variant="subtitle2" gutterBottom>Lista Blanca de IPs</Typography>
                    {securitySettings.ipWhitelist.map((ip, index) => (
                      <Chip
                        key={index}
                        label={ip}
                        onDelete={() => { }}
                        sx={{ mr: 1, mb: 1 }}
                      />
                    ))}
                    <TextField
                      fullWidth
                      label="Añadir IP o rango CIDR"
                      variant="outlined"
                      size="small"
                      sx={{ mt: 2 }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton size="small">
                              <Add />
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tab 3: WhatsApp - Configuración Avanzada */}
      {selectedTab === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>📡 Estado de WhatsApp</Typography>
                <Stack spacing={1}>
                  <Typography variant="body2" color="textSecondary">Límites del plan</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {Number.isFinite(normalizedMaxChannels)
                      ? `${waSessions.length}/${normalizedMaxChannels} líneas`
                      : `${waSessions.length} / Ilimitado`}
                  </Typography>
                  {Number.isFinite(normalizedMaxChannels) && (
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, (waSessions.length / (normalizedMaxChannels || 1)) * 100)}
                      sx={{ height: 8, borderRadius: 1 }}
                    />
                  )}
                  <Alert severity={Number.isFinite(normalizedMaxChannels) && waSessions.length >= normalizedMaxChannels ? 'warning' : 'info'}>
                    {Number.isFinite(normalizedMaxChannels)
                      ? `${Math.max(0, normalizedMaxChannels - waSessions.length)} slots disponibles`
                      : 'Slots ilimitados'}
                  </Alert>

                  {waError && (
                    <Alert severity="error" onClose={() => setWaError('')}>
                      {waError}
                    </Alert>
                  )}

                  <Button
                    variant="contained"
                    startIcon={<QrCode />}
                    onClick={startQrFlow}
                    disabled={qrState.isLoading || (Number.isFinite(normalizedMaxChannels) && waSessions.length >= normalizedMaxChannels)}
                  >
                    Conectar por QR
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Refresh />}
                    onClick={fetchActiveSessions}
                    disabled={waLoading}
                  >
                    Actualizar estado
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Escanear QR</Typography>
                {qrState.isLoading && <LinearProgress sx={{ mb: 2 }} />}

                {qrState.qrDataUrl ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 280 }}>
                    <Paper elevation={3} sx={{ p: 2, textAlign: 'center' }}>
                      <img src={qrState.qrDataUrl} alt="QR de WhatsApp" style={{ width: 240, height: 240 }} />
                      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                        Session ID: {qrState.sessionId}
                      </Typography>
                    </Paper>
                    <Button
                      variant="outlined"
                      startIcon={<Refresh />}
                      onClick={startQrFlow}
                      sx={{ mt: 2 }}
                      disabled={qrState.isLoading}
                    >
                      Actualizar QR
                    </Button>
                  </Box>
                ) : (
                  <Box sx={{ minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" color="textSecondary" align="center">
                      Presiona "Conectar por QR" para generar un código y vincular una nueva línea.
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="h6">Líneas conectadas</Typography>
                  {waLoading && <LinearProgress sx={{ width: 200 }} />}
                </Box>

                {!waLoading && waSessions.length === 0 && (
                  <Alert severity="info">No hay sesiones activas.</Alert>
                )}

                <List>
                  {waSessions.map((session: any) => {
                    // Solo la sesión que coincide con el sessionId del módulo es principal
                    const isPrimary = session.sessionId === sessionId;
                    const iconBg = isPrimary ? 'primary.main' : 'success.main';

                    return (
                      <ListItem key={session.sessionId} divider>
                        <ListItemAvatar>
                          <Avatar
                            src={session.avatar || undefined}
                            sx={{ bgcolor: !session.avatar ? iconBg : undefined }}
                          >
                            {!session.avatar && <Phone />}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box>
                              <Typography component="span" variant="subtitle1">
                                {session.name || session.phoneNumber || session.sessionId}
                              </Typography>
                              {isPrimary && (
                                <Chip
                                  label="👑 Principal"
                                  color="primary"
                                  size="small"
                                  sx={{ ml: 1 }}
                                />
                              )}
                              {!isPrimary && session.ownerPhone && (
                                <Chip
                                  label="Secundaria"
                                  color="success"
                                  variant="outlined"
                                  size="small"
                                  sx={{ ml: 1 }}
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            <>
                              <Typography component="span" variant="body2" display="block">
                                {session.phoneNumber || session.sessionId}
                              </Typography>
                              {session.isConnected ? '🟢 Conectado' : '🔴 Desconectado'}
                              {!isPrimary && session.ownerPhone && (
                                <Typography component="span" variant="caption" display="block" color="text.secondary">
                                  Relacionada con: {session.ownerPhone}
                                </Typography>
                              )}
                            </>
                          }
                        />
                        <Stack direction="row" spacing={1} alignItems="center">
                          {!session.isConnected && session.hasAuth && (
                            <Button
                              size="small"
                              color="success"
                              variant="contained"
                              onClick={() => handleReconnectSession(session.sessionId)}
                              startIcon={<Refresh />}
                            >
                              Reconectar
                            </Button>
                          )}
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            onClick={() => openDisconnectDialog(session.sessionId)}
                            startIcon={<Delete />}
                          >
                            {session.isConnected ? 'Desconectar' : 'Eliminar'}
                          </Button>
                        </Stack>
                      </ListItem>
                    );
                  })}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Diálogo de confirmación de desconexión */}
      <Dialog open={disconnectDialog.open} onClose={closeDisconnectDialog}>
        <DialogTitle>
          {disconnectDialog.isPrimary ? '⚠️ Desconectar línea principal' : 'Confirmar desconexión'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {disconnectDialog.isPrimary ? (
              <>
                <strong>Esta es la línea principal</strong> con la que iniciaste sesión en el sistema.
                <br /><br />
                Si desconectas esta línea:
                <ul style={{ marginTop: '8px', marginBottom: '8px' }}>
                  <li>Cerrarás tu sesión actual en el panel</li>
                  <li>El sistema puede cerrarse completamente</li>
                  <li>Perderás acceso hasta que vuelvas a conectar esta línea</li>
                  {disconnectDialog.hasSecondaries && (
                    <li><strong>Las líneas secundarias asociadas también pueden verse afectadas</strong></li>
                  )}
                </ul>
                ¿Estás seguro de continuar?
              </>
            ) : (
              <>
                Esta es una línea secundaria utilizada para campañas.
                <br /><br />
                ¿Seguro que deseas desconectarla? Podrás reconectarla más adelante escaneando un QR.
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDisconnectDialog}>Cancelar</Button>
          <Button onClick={confirmDisconnect} color="error" variant="contained">
            {disconnectDialog.isPrimary ? 'Sí, desconectar y cerrar sesión' : 'Desconectar'}
          </Button>
        </DialogActions>
      </Dialog>


      {/* Tab 4: Mi Plan */}
      {selectedTab === 3 && mySubscription && (
        <Grid container spacing={3}>
          {/* Plan actual */}
          <Grid item xs={12} md={6}>
            <Card sx={{
              background: mySubscription.subscription_status === 'active' || mySubscription.subscription_status === 'trial'
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : 'linear-gradient(135deg, #f44336 0%, #e91e63 100%)',
              color: 'white'
            }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>💎 Tu Plan Actual</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, textTransform: 'capitalize' }}>
                    {mySubscription.plan_details?.plan_display_name || mySubscription.subscription_plan}
                  </Typography>
                  <Chip
                    label={mySubscription.subscription_status.toUpperCase()}
                    size="small"
                    sx={{
                      ml: 2,
                      bgcolor: 'rgba(255,255,255,0.3)',
                      color: 'white',
                      fontWeight: 600
                    }}
                  />
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                  ${mySubscription.plan_details?.price || 0}
                </Typography>
                {mySubscription.subscription_end_date && (
                  <>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Fecha de inicio: {new Date(mySubscription.subscription_start_date).toLocaleDateString()}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Vencimiento: {new Date(mySubscription.subscription_end_date).toLocaleDateString()}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, mt: 2 }}>
                      {mySubscription.days_remaining > 0
                        ? `${mySubscription.days_remaining} días restantes`
                        : 'Plan expirado'
                      }
                    </Typography>
                  </>
                )}
                {!isAdmin && (
                  <Alert severity="info" sx={{ mt: 2, bgcolor: 'rgba(255,255,255,0.2)' }}>
                    <Typography variant="body2" sx={{ color: 'white' }}>
                      Para renovar tu plan, contacta al administrador
                    </Typography>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>


          {/* Características del plan - Desglose de Mensajes (Dark Mode Compacto) */}
          <Grid item xs={12} md={6}>
            <Card sx={{
              background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
              color: 'white'
            }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  📊 Control de Mensajes
                </Typography>
                {mySubscription.plan_details && (
                  <Box>
                    {/* Resumen compacto */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {mySubscription.plan_details.messages_sent_this_month.toLocaleString()} / {
                          mySubscription.plan_details.max_messages_per_month === 999999
                            ? '∞'
                            : mySubscription.plan_details.max_messages_per_month.toLocaleString()
                        }
                      </Typography>
                      {mySubscription.plan_details.max_messages_per_month !== 999999 && (
                        <>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(100, (mySubscription.plan_details.messages_sent_this_month / mySubscription.plan_details.max_messages_per_month) * 100)}
                            sx={{
                              mt: 1,
                              height: 8,
                              borderRadius: 1,
                              bgcolor: 'rgba(255,255,255,0.2)',
                              '& .MuiLinearProgress-bar': {
                                bgcolor: 'rgba(255,255,255,0.9)'
                              }
                            }}
                          />
                          <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
                            ✨ {Math.max(0, mySubscription.plan_details.max_messages_per_month - mySubscription.plan_details.messages_sent_this_month).toLocaleString()} disponibles
                          </Typography>
                        </>
                      )}
                    </Box>

                    {/* Grid horizontal de 3 tarjetas a la misma altura */}
                    <Grid container spacing={1.5}>
                      {/* Campañas (combina programadas + personalizadas) */}
                      <Grid item xs={4}>
                        <Box sx={{
                          p: 2,
                          bgcolor: 'rgba(255,255,255,0.15)',
                          borderRadius: 2,
                          border: '1px solid rgba(255,255,255,0.3)',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between'
                        }}>
                          <Box>
                            <Typography variant="h5" sx={{ mb: 1 }}>📅</Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                              {(mySubscription.plan_details.messages_scheduled || 0) + (mySubscription.plan_details.messages_personalized || 0)}
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 600 }}>
                            Campaña
                          </Typography>
                        </Box>
                      </Grid>

                      {/* API REST */}
                      <Grid item xs={4}>
                        <Box sx={{
                          p: 2,
                          bgcolor: 'rgba(255,255,255,0.15)',
                          borderRadius: 2,
                          border: '1px solid rgba(255,255,255,0.3)',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between'
                        }}>
                          <Box>
                            <Typography variant="h5" sx={{ mb: 1 }}>🔌</Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                              {mySubscription.plan_details.messages_api || 0}
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 600 }}>
                            API REST
                          </Typography>
                        </Box>
                      </Grid>

                      {/* Bot */}
                      <Grid item xs={4}>
                        <Box sx={{
                          p: 2,
                          bgcolor: 'rgba(255,255,255,0.15)',
                          borderRadius: 2,
                          border: '1px solid rgba(255,255,255,0.3)',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between'
                        }}>
                          <Box>
                            <Typography variant="h5" sx={{ mb: 1 }}>🤖</Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                              {mySubscription.plan_details.messages_chatbot || 0}
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 600 }}>
                            Bot
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>

                    {/* Nota compacta */}
                    <Typography variant="caption" sx={{ mt: 1.5, opacity: 0.7, display: 'block' }}>
                      ℹ️ Mensajes de chat no se cuentan
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Información adicional */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>ℹ️ Información Importante</Typography>
                <Typography variant="body2" paragraph>
                  Tu plan {mySubscription.plan_details?.plan_display_name} incluye todas las características necesarias
                  para gestionar tu comunicación por WhatsApp de manera profesional.
                </Typography>
                {mySubscription.subscription_status === 'expired' && (
                  <Alert severity="error">
                    Tu plan ha expirado. Por favor, contacta al administrador para renovar tu suscripción y seguir
                    utilizando el sistema.
                  </Alert>
                )}
                {mySubscription.subscription_status === 'trial' && (
                  <Alert severity="info">
                    Estás en período de prueba. Asegúrate de activar tu suscripción antes del vencimiento.
                  </Alert>
                )}
                {mySubscription.days_remaining > 0 && mySubscription.days_remaining < 7 && (
                  <Alert severity="warning">
                    Tu plan vence en {mySubscription.days_remaining} días. Contacta al administrador para renovarlo.
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Mostrar planes disponibles - siempre visible en tab Mi Plan */}
      {selectedTab === 3 && (
        <Box sx={{ mt: mySubscription ? 4 : 0 }}>
          <PlanSelector userPhone={sessionId} currentSubscription={mySubscription} />
        </Box>
      )}

      {/* Tab 6: API REST */}
      {/* Tab 5: API REST - ajustado de índice 6 a 5 */}
      {selectedTab === 4 && (
        <APIRestSettings sessionId={sessionId} />
      )}

      {/* Tab 8: Panel de Administrador (solo para admin) */}
      {/* Tab 6: Panel Admin - ajustado de índice 8 a 6 */}
      {isAdmin && selectedTab === 5 && (
        <AdminSubscriptionPanel sessionId={sessionId} userPhone={sessionId} />
      )}

      {/* Dialogs */}
      {/* Dialog de usuario */}
      <Dialog open={showUserDialog} onClose={() => setShowUserDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedUser ? 'Editar Usuario' : 'Nuevo Usuario'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* 📱 Botón para buscar en contactos (solo al crear nuevo) */}
            {!selectedUser && (
              <Grid item xs={12}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<Search />}
                  onClick={() => {
                    loadWhatsAppContacts();
                    setContactSearchOpen(true);
                  }}
                  sx={{
                    borderColor: '#25D366',
                    color: '#25D366',
                    '&:hover': {
                      borderColor: '#128C7E',
                      backgroundColor: 'rgba(37, 211, 102, 0.1)'
                    }
                  }}
                >
                  Buscar en Contactos de WhatsApp
                </Button>
              </Grid>
            )}

            {/* Vista previa del avatar seleccionado */}
            {userForm.avatar_url && (
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
                  <Avatar
                    src={userForm.avatar_url}
                    sx={{ width: 64, height: 64 }}
                  />
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      Foto de perfil cargada
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Esta imagen se mostrará en el perfil del agente
                    </Typography>
                  </Box>
                  <IconButton
                    onClick={() => setUserForm({ ...userForm, avatar_url: '' })}
                    size="small"
                  >
                    <Close />
                  </IconButton>
                </Box>
              </Grid>
            )}

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nombre completo"
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                variant="outlined"
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Número de Teléfono"
                type="tel"
                value={userForm.phone}
                onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                variant="outlined"
                required
                placeholder="595981234567"
                helperText="Número con código de país (ej: 595981234567)"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Phone sx={{ color: '#128C7E' }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                variant="outlined"
                required
                helperText="Se usará para iniciar sesión"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={selectedUser ? "Nueva Contraseña (dejar vacío para mantener la actual)" : "Contraseña"}
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                variant="outlined"
                required={!selectedUser}
                helperText={selectedUser ? "Solo ingresa una contraseña si deseas cambiarla" : "Requerida para nuevos usuarios"}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock sx={{ color: '#128C7E' }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Rol</InputLabel>
                <Select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  label="Rol"
                >
                  <MenuItem value="admin">Administrador</MenuItem>
                  <MenuItem value="supervisor">Supervisor</MenuItem>
                  <MenuItem value="agent">Agente</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Departamento (opcional)"
                value={userForm.department}
                onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
                variant="outlined"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowUserDialog(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSaveUser}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? 'Guardando...' : (selectedUser ? 'Actualizar' : 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 📱 Dialog de búsqueda de contactos */}
      <Dialog
        open={contactSearchOpen}
        onClose={() => setContactSearchOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Phone sx={{ color: '#25D366' }} />
            <Typography variant="h6">Seleccionar Contacto de WhatsApp</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            placeholder="Buscar por nombre..."
            value={contactSearchQuery}
            onChange={(e) => setContactSearchQuery(e.target.value)}
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />

          {loadingContacts ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <List sx={{ maxHeight: 400, overflow: 'auto' }}>
              {availableContacts
                .filter(contact =>
                  contact.name?.toLowerCase().includes(contactSearchQuery.toLowerCase()) ||
                  contact.notify_name?.toLowerCase().includes(contactSearchQuery.toLowerCase())
                )
                .map((contact) => (
                  <ListItem
                    key={contact.jid}
                    button
                    onClick={() => {
                      // Llenar el formulario con datos del contacto
                      setUserForm({
                        ...userForm,
                        name: contact.name || contact.notify_name || contact.jid.split('@')[0],
                        phone: contact.jid.split('@')[0],
                        avatar_url: contact.avatar_url || ''
                      });
                      setContactSearchOpen(false);
                      setContactSearchQuery('');
                    }}
                    sx={{
                      borderRadius: 2,
                      mb: 1,
                      '&:hover': {
                        backgroundColor: 'rgba(37, 211, 102, 0.1)'
                      }
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar
                        src={contact.avatar_url}
                        sx={{ bgcolor: '#25D366' }}
                      >
                        {(contact.name || contact.notify_name || 'U')[0].toUpperCase()}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={contact.name || contact.notify_name || contact.jid.split('@')[0]}
                      secondary={contact.jid.split('@')[0]}
                    />
                  </ListItem>
                ))}
              {availableContacts.filter(contact =>
                contact.name?.toLowerCase().includes(contactSearchQuery.toLowerCase()) ||
                contact.notify_name?.toLowerCase().includes(contactSearchQuery.toLowerCase())
              ).length === 0 && (
                  <Typography variant="body2" sx={{ textAlign: 'center', color: '#64748b', py: 3 }}>
                    {contactSearchQuery ? 'No se encontraron contactos' : 'No hay contactos disponibles'}
                  </Typography>
                )}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setContactSearchOpen(false)}>
            Cancelar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de cambio de contraseña */}
      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Cambiar Contraseña</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 3, color: '#64748b' }}>
            Usuario: {selectedUser?.name}
          </Typography>
          <TextField
            fullWidth
            label="Nueva contraseña"
            type="password"
            variant="outlined"
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Confirmar contraseña"
            type="password"
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained">Cambiar Contraseña</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de confirmación de sincronización */}
      <Dialog
        open={syncConfirmDialog}
        onClose={() => setSyncConfirmDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}>
          <Refresh sx={{ fontSize: 32 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Sincronizar Todo
            </Typography>
            <Typography variant="caption">
              Descarga completa de datos
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 3 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              🔄 Sincronización Completa de WhatsApp
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Esta acción descargará <strong>TODOS</strong> tus chats, contactos y grupos completos desde WhatsApp.
            </Typography>
          </Alert>
          <Typography variant="body1" sx={{ mb: 2, fontWeight: 600 }}>
            ¿Confirmas que deseas iniciar la sincronización completa?
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            ⏱️ <strong>Tiempo estimado:</strong> 1-5 minutos (depende de la cantidad de chats)<br />
            📱 <strong>Chats individuales:</strong> Se descargarán todos los contactos<br />
            👥 <strong>Grupos:</strong> Se descargarán todos los grupos y sus miembros<br />
            📞 <strong>Contactos:</strong> Se descargará tu lista completa de contactos<br />
            💾 <strong>Almacenamiento:</strong> Todo se guardará en la base de datos
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button
            onClick={() => setSyncConfirmDialog(false)}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => handleForceSync(false)}
            variant="contained"
            startIcon={<Refresh />}
            sx={{
              borderRadius: 2,
              background: 'linear-gradient(135deg, #25d366 0%, #1da851 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #1da851 0%, #128c7e 100%)',
              }
            }}
          >
            Sincronizar Ahora
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar para notificaciones */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
          sx={{
            width: '100%',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            borderRadius: 2
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Delete User Confirmation Dialog */}
      <Dialog
        open={deleteUserDialog}
        onClose={() => !loading && setDeleteUserDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{
          bgcolor: 'error.main',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <Delete />
          Confirmar Eliminación
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Esta acción no se puede deshacer
          </Alert>
          <Typography variant="body1" gutterBottom>
            ¿Estás seguro de eliminar este usuario?
          </Typography>
          {userToDelete && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Usuario a eliminar:
              </Typography>
              <Typography variant="h6" sx={{ mt: 1 }}>
                {userToDelete.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {userToDelete.email}
              </Typography>
              <Chip
                label={userToDelete.role}
                size="small"
                color="primary"
                sx={{ mt: 1 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setDeleteUserDialog(false)}
            disabled={loading}
            variant="outlined"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleDeleteUser}
            disabled={loading}
            variant="contained"
            color="error"
            startIcon={loading ? <CircularProgress size={20} /> : <Delete />}
          >
            {loading ? 'Eliminando...' : 'Eliminar Usuario'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de Permisos */}
      <Dialog
        open={permissionsDialogOpen}
        onClose={handleClosePermissionsDialog}
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
          pb: 2,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <Shield />
          Gestionar Privilegios - {selectedUserForPermissions?.name}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Selecciona los módulos a los que este agente tendrá acceso:
          </Typography>

          <Grid container spacing={2}>
            {availableModules.map((module) => (
              <Grid item xs={12} sm={6} key={module.id}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    border: selectedPermissions.includes(module.id)
                      ? '2px solid #667eea'
                      : '2px solid transparent',
                    bgcolor: selectedPermissions.includes(module.id)
                      ? 'rgba(102, 126, 234, 0.1)'
                      : 'transparent',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: 3
                    }
                  }}
                  onClick={() => handleTogglePermission(module.id)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Typography variant="h4" sx={{ mr: 1 }}>
                        {module.icon}
                      </Typography>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {module.name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {module.description}
                        </Typography>
                      </Box>
                      <Checkbox
                        checked={selectedPermissions.includes(module.id)}
                        color="primary"
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {selectedPermissions.length === 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              ⚠️ El agente debe tener acceso al menos a un módulo
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={handleClosePermissionsDialog}
            variant="outlined"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSavePermissions}
            variant="contained"
            disabled={selectedPermissions.length === 0}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)',
              }
            }}
          >
            Guardar Privilegios
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SettingsModule;
