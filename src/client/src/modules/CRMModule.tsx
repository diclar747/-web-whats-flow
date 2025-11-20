import React, { useState, useEffect } from 'react';
import { getAPIBaseURL } from '../utils/socketConfig';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Badge,
  Stack,
  Tooltip,
  CircularProgress,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  LinearProgress,
  InputAdornment,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Rating,
  Switch,
  FormControlLabel,
  ButtonGroup,
  Menu,
  Checkbox,
  ToggleButtonGroup,
  ToggleButton,
  Pagination,
  TablePagination
} from '@mui/material';
import {
  Business,
  Search,
  Add,
  Edit,
  Delete,
  Person,
  Group,
  Star,
  TrendingUp,
  TrendingDown,
  Email,
  Phone,
  WhatsApp,
  LocationOn,
  CalendarToday,
  AttachMoney,
  Analytics,
  FilterList,
  Sort,
  MoreVert,
  Visibility,
  Send,
  Campaign,
  CheckCircle,
  Cancel,
  Refresh,
  Download,
  Upload,
  Share,
  Settings,
  Dashboard,
  PieChart,
  BarChart,
  ShowChart,
  Psychology,
  AutoAwesome,
  SmartToy,
  Autorenew,
  ExpandMore,
  Launch,
  Folder,
  FolderOpen,
  PersonAdd,
  GroupAdd,
  MonetizationOn,
  ShoppingCart,
  Receipt,
  Payment,
  AccountBalance,
  CreditCard,
  LocalOffer,
  Loyalty,
  DataUsage,
  Insights,
  Speed,
  Target,
  ThumbUp,
  ThumbDown,
  Mood,
  MoodBad,
  Warning,
  CheckBoxOutlineBlank,
  Assignment,
  Timeline,
  Schedule,
  Notifications,
  Label,
  Flag,
  Priority,
  Segment,
  Score
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';

interface CRMModuleProps {
  sessionId: string;
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  whatsapp: string;
  company?: string;
  position?: string;
  avatar?: string;
  status: 'lead' | 'prospect' | 'customer' | 'inactive';
  source: 'website' | 'whatsapp' | 'referral' | 'social' | 'campaign' | 'manual';
  tags: string[];
  score: number;
  value: number; // valor potencial/real
  stage: string;
  assignedAgent?: string;
  createdAt: string;
  lastContact: string;
  nextFollowUp?: string;
  notes: string;
  customFields: Record<string, any>;
  location?: {
    city: string;
    country: string;
    coordinates?: [number, number];
  };
  socialMedia?: {
    linkedin?: string;
    facebook?: string;
    instagram?: string;
  };
  preferences: {
    language: string;
    timezone: string;
    communicationChannel: 'whatsapp' | 'email' | 'phone';
    bestTimeToContact: string;
  };
  interactions: ContactInteraction[];
}

interface ContactInteraction {
  id: string;
  type: 'call' | 'email' | 'whatsapp' | 'meeting' | 'note' | 'campaign';
  description: string;
  outcome?: 'positive' | 'neutral' | 'negative';
  timestamp: string;
  agentName: string;
  duration?: number;
  followUpRequired: boolean;
  attachments?: string[];
}

interface SalesStage {
  id: string;
  name: string;
  order: number;
  color: string;
  probability: number;
  description: string;
  avgDuration: number; // días promedio
  isActive: boolean;
}

interface Deal {
  id: string;
  title: string;
  contactId: string;
  value: number;
  probability: number;
  stage: string;
  expectedCloseDate: string;
  assignedAgent: string;
  source: string;
  description: string;
  activities: DealActivity[];
  documents: string[];
  createdAt: string;
  updatedAt: string;
}

interface DealActivity {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'proposal' | 'contract' | 'payment';
  description: string;
  date: string;
  completed: boolean;
  agentName: string;
}

interface SegmentType {
  id: string;
  name: string;
  description: string;
  criteria: SegmentCriteria[];
  contactCount: number;
  createdAt: string;
  isActive: boolean;
  color: string;
}

interface SegmentCriteria {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
}

interface CRMAnalytics {
  totalContacts: number;
  totalDeals: number;
  totalValue: number;
  conversionRate: number;
  averageDealSize: number;
  salesCycle: number;
  pipelineHealth: {
    stage: string;
    count: number;
    value: number;
    probability: number;
  }[];
  leadSources: {
    source: string;
    count: number;
    value: number;
    conversionRate: number;
  }[];
  agentPerformance: {
    name: string;
    contacts: number;
    deals: number;
    revenue: number;
    conversionRate: number;
  }[];
  contactGrowth: {
    month: string;
    total: number;
    new: number;
    churned: number;
  }[];
}

const CRMModule: React.FC<CRMModuleProps> = ({ sessionId }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [segments, setSegments] = useState<SegmentType[]>([]);
  const [salesStages, setSalesStages] = useState<SalesStage[]>([]);
  const [analytics, setAnalytics] = useState<CRMAnalytics | null>(null);
  const [selectedTab, setSelectedTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [showDealDialog, setShowDealDialog] = useState(false);
  const [showSegmentDialog, setShowSegmentDialog] = useState(false);
  const [editingSegment, setEditingSegment] = useState<SegmentType | null>(null);
  const [newSegmentName, setNewSegmentName] = useState('');
  const [newSegmentDescription, setNewSegmentDescription] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table' | 'kanban'>('cards');
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [selectedStage, setSelectedStage] = useState('all');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [sortBy, setSortBy] = useState('lastContact');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  
  // Estados para editar contacto
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editContactDialog, setEditContactDialog] = useState(false);
  const [editContactName, setEditContactName] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');
  const [contactMenuAnchor, setContactMenuAnchor] = useState<null | HTMLElement>(null);

  // Pagination states
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(12);

  // WhatsApp synced data
  const [syncedContacts, setSyncedContacts] = useState<any[]>([]);
  const [syncedGroups, setSyncedGroups] = useState<any[]>([]);
  const [showOnlyNamed, setShowOnlyNamed] = useState(true); // Filtrar solo contactos con nombre real

  useEffect(() => {
    loadCRMData();
    loadWhatsAppData();
    loadSegments();
  }, [sessionId]);

  const loadSegments = async () => {
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/segments/${sessionId}`);
      const data = await response.json();
      
      if (data.success && data.segments) {
        const mappedSegments: SegmentType[] = data.segments.map((seg: any) => ({
          id: seg.id,
          name: seg.name,
          description: seg.description || '',
          criteria: [],
          contactCount: seg.contact_count || seg.count || 0,
          createdAt: seg.created_at,
          isActive: true,
          color: '#2196f3'
        }));
        setSegments(mappedSegments);
        console.log('[CRM] Segmentos cargados:', mappedSegments.length);
      }
    } catch (error) {
      console.error('[CRM] Error cargando segmentos:', error);
    }
  };

  const handleDeleteSegment = async (segmentId: string) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este grupo local?')) {
      return;
    }

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/segments/${segmentId}?sessionId=${sessionId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('✅ Grupo local eliminado exitosamente');
        loadSegments(); // Recargar la lista
      } else {
        alert('❌ Error al eliminar el grupo: ' + data.error);
      }
    } catch (error) {
      console.error('[CRM] Error eliminando segmento:', error);
      alert('❌ Error al eliminar el grupo');
    }
  };

  const handleCreateSegment = async () => {
    if (!newSegmentName.trim()) {
      alert('⚠️ Por favor ingresa un nombre para el grupo');
      return;
    }

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/segments/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          name: newSegmentName.trim(),
          description: newSegmentDescription.trim()
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('✅ Grupo local creado exitosamente');
        setShowSegmentDialog(false);
        setNewSegmentName('');
        setNewSegmentDescription('');
        loadSegments(); // Recargar la lista
      } else {
        alert('❌ Error al crear el grupo: ' + data.error);
      }
    } catch (error) {
      console.error('[CRM] Error creando segmento:', error);
      alert('❌ Error al crear el grupo');
    }
  };

  const handleEditSegment = (segment: SegmentType) => {
    setEditingSegment(segment);
    setNewSegmentName(segment.name);
    setNewSegmentDescription(segment.description || '');
    setShowSegmentDialog(true);
  };

  const handleUpdateSegment = async () => {
    if (!editingSegment) return;
    
    if (!newSegmentName.trim()) {
      alert('⚠️ Por favor ingresa un nombre para el grupo');
      return;
    }

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/segments/${editingSegment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          name: newSegmentName.trim(),
          description: newSegmentDescription.trim()
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('✅ Grupo local actualizado exitosamente');
        setShowSegmentDialog(false);
        setEditingSegment(null);
        setNewSegmentName('');
        setNewSegmentDescription('');
        loadSegments();
      } else {
        alert('❌ Error al actualizar el grupo: ' + data.error);
      }
    } catch (error) {
      console.error('[CRM] Error actualizando segmento:', error);
      alert('❌ Error al actualizar el grupo');
    }
  };

  const handleSaveSegment = () => {
    if (editingSegment) {
      handleUpdateSegment();
    } else {
      handleCreateSegment();
    }
  };

  const handleCloseSegmentDialog = () => {
    setShowSegmentDialog(false);
    setEditingSegment(null);
    setNewSegmentName('');
    setNewSegmentDescription('');
  };

  // Funciones para editar contacto
  const handleOpenContactMenu = (event: React.MouseEvent<HTMLElement>, contact: Contact) => {
    setContactMenuAnchor(event.currentTarget);
    setEditingContact(contact);
  };

  const handleCloseContactMenu = () => {
    setContactMenuAnchor(null);
  };

  const handleEditContact = () => {
    if (editingContact) {
      const contactAny = editingContact as any;
      setEditContactName(contactAny.name || contactAny.notify || '');
      setEditContactPhone(contactAny.jid ? contactAny.jid.split('@')[0] : contactAny.phone || '');
      setEditContactDialog(true);
      handleCloseContactMenu();
    }
  };

  const handleSaveContactEdit = async () => {
    if (!editingContact || !editContactName.trim()) {
      alert('El nombre es requerido');
      return;
    }

    try {
      const contactAny = editingContact as any;
      const response = await fetch(`${getAPIBaseURL()}/api/contacts/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          jid: contactAny.jid || contactAny.id,
          name: editContactName.trim(),
          phone: editContactPhone.trim()
        })
      });

      const data = await response.json();

      if (data.success) {
        // Actualizar contacto en la lista local
        const contactAny = editingContact as any;
        setContacts(contacts.map(c => {
          const cAny = c as any;
          return cAny.jid === contactAny.jid 
            ? { ...c, name: editContactName.trim() }
            : c;
        }));
        setEditContactDialog(false);
        setEditingContact(null);
        alert('✅ Contacto actualizado correctamente');
      } else {
        alert('Error al actualizar contacto: ' + data.error);
      }
    } catch (error) {
      console.error('Error actualizando contacto:', error);
      alert('Error al actualizar contacto');
    }
  };

  const handleCloseEditContactDialog = () => {
    setEditContactDialog(false);
    setEditingContact(null);
    setEditContactName('');
    setEditContactPhone('');
  };

  const loadWhatsAppData = async () => {
    try {
      console.log('[CRM] Loading WhatsApp data for sessionId:', sessionId);
      
      // Cargar contactos sincronizados de WhatsApp
      const contactsResponse = await fetch(`${getAPIBaseURL()}/api/contacts/${sessionId}`);
      const contactsData = await contactsResponse.json();
      
      console.log('[CRM] Contacts response:', contactsData);

      if (contactsData.success && contactsData.contacts) {
        // Filtrar solo contactos individuales (no grupos)
        const individualContacts = contactsData.contacts.filter((contact: any) => !contact.isGroup);
        console.log('[CRM] Individual contacts found:', individualContacts.length);
        setSyncedContacts(individualContacts);
      } else {
        console.error('[CRM] Failed to load contacts:', contactsData.error);
      }

      // Cargar grupos sincronizados de WhatsApp
      const groupsResponse = await fetch(`${getAPIBaseURL()}/api/groups/${sessionId}`);
      const groupsData = await groupsResponse.json();
      
      console.log('[CRM] Groups response:', groupsData);

      if (groupsData.success && groupsData.groups) {
        console.log('[CRM] Groups found:', groupsData.groups.length);
        setSyncedGroups(groupsData.groups);
      } else {
        console.error('[CRM] Failed to load groups:', groupsData.error);
      }
    } catch (error) {
      console.error('[CRM] Error loading WhatsApp data:', error);
    }
  };

  const loadCRMData = async () => {
    try {
      setLoading(true);

      // Mock data para CRM empresarial
      const mockSalesStages: SalesStage[] = [
        {
          id: 'lead',
          name: 'Lead',
          order: 1,
          color: '#9e9e9e',
          probability: 10,
          description: 'Contacto inicial identificado',
          avgDuration: 3,
          isActive: true
        },
        {
          id: 'qualified',
          name: 'Calificado',
          order: 2,
          color: '#2196f3',
          probability: 25,
          description: 'Lead calificado con necesidad confirmada',
          avgDuration: 7,
          isActive: true
        },
        {
          id: 'proposal',
          name: 'Propuesta',
          order: 3,
          color: '#ff9800',
          probability: 50,
          description: 'Propuesta enviada al prospecto',
          avgDuration: 10,
          isActive: true
        },
        {
          id: 'negotiation',
          name: 'Negociación',
          order: 4,
          color: '#9c27b0',
          probability: 75,
          description: 'En proceso de negociación',
          avgDuration: 5,
          isActive: true
        },
        {
          id: 'closed_won',
          name: 'Ganado',
          order: 5,
          color: '#4caf50',
          probability: 100,
          description: 'Venta cerrada exitosamente',
          avgDuration: 0,
          isActive: true
        },
        {
          id: 'closed_lost',
          name: 'Perdido',
          order: 6,
          color: '#f44336',
          probability: 0,
          description: 'Oportunidad perdida',
          avgDuration: 0,
          isActive: true
        }
      ];

      // Cargar contactos CRM desde la API
      let loadedContacts: Contact[] = [];
      try {
        const contactsResponse = await fetch(`/api/crm/contacts/${sessionId}`);
        if (contactsResponse.ok) {
          const contactsData = await contactsResponse.json();
          if (contactsData.success && contactsData.contacts) {
            loadedContacts = contactsData.contacts.map((c: any) => ({
              id: c.id,
              firstName: c.firstName || '',
              lastName: c.lastName || '',
              email: c.email || '',
              phone: c.phone || '',
              whatsapp: c.whatsapp || '',
              company: c.company,
              position: c.position,
              avatar: c.avatar,
              status: c.status || 'lead',
              source: c.source || 'manual',
              tags: c.tags || [],
              score: c.score || 0,
              value: c.value || 0,
              stage: c.stage || 'lead',
              assignedAgent: c.assignedAgent,
              createdAt: c.createdAt || new Date().toISOString(),
              lastContact: c.lastContact || new Date().toISOString(),
              nextFollowUp: c.nextFollowUp,
              notes: c.notes || '',
              customFields: c.customFields || {},
              location: c.location || { city: '', country: '' },
              socialMedia: {},
              preferences: c.preferences || {
                language: 'es',
                timezone: 'UTC',
                communicationChannel: 'whatsapp',
                bestTimeToContact: '9:00-17:00'
              },
              interactions: []
            }));
          }
        }
      } catch (error) {
        console.error('Error loading CRM contacts from API:', error);
      }

      const mockDeals: Deal[] = [
        {
          id: 'deal_1',
          title: 'Enterprise WhatsFlow - Empresa ABC',
          contactId: '1',
          value: 50000,
          probability: 50,
          stage: 'proposal',
          expectedCloseDate: '2024-02-15T00:00:00Z',
          assignedAgent: 'María González',
          source: 'website',
          description: 'Implementación completa de WhatsFlow para 500 agentes',
          activities: [
            {
              id: 'act_1',
              type: 'meeting',
              description: 'Demo personalizada con equipo directivo',
              date: '2024-01-25T10:00:00Z',
              completed: false,
              agentName: 'María González'
            }
          ],
          documents: ['proposal_v2.pdf', 'pricing_sheet.xlsx'],
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-20T14:30:00Z'
        },
        {
          id: 'deal_2',
          title: 'Growth Plan - StartupXYZ',
          contactId: '2',
          value: 120000,
          probability: 100,
          stage: 'closed_won',
          expectedCloseDate: '2023-11-20T00:00:00Z',
          assignedAgent: 'Carlos Rivera',
          source: 'referral',
          description: 'Plan de crecimiento anual con soporte premium',
          activities: [],
          documents: ['contract_signed.pdf', 'implementation_plan.pdf'],
          createdAt: '2023-11-01T09:00:00Z',
          updatedAt: '2023-11-20T17:00:00Z'
        }
      ];

      const mockSegments: SegmentType[] = [
        {
          id: 'seg_1',
          name: 'Clientes Enterprise',
          description: 'Empresas con más de 500 empleados y alto valor',
          criteria: [
            { field: 'customFields.employeeCount', operator: 'in', value: ['500-1000', '1000+'] },
            { field: 'value', operator: 'greater_than', value: 50000 }
          ],
          contactCount: 45,
          createdAt: '2024-01-01T00:00:00Z',
          isActive: true,
          color: '#2196f3'
        },
        {
          id: 'seg_2',
          name: 'Startups en Crecimiento',
          description: 'Startups con potencial de escalamiento',
          criteria: [
            { field: 'tags', operator: 'contains', value: 'startup' },
            { field: 'score', operator: 'greater_than', value: 70 }
          ],
          contactCount: 23,
          createdAt: '2024-01-01T00:00:00Z',
          isActive: true,
          color: '#4caf50'
        }
      ];

      const mockAnalytics: CRMAnalytics = {
        totalContacts: 1247,
        totalDeals: 89,
        totalValue: 2850000,
        conversionRate: 24.5,
        averageDealSize: 32022,
        salesCycle: 45,
        pipelineHealth: [
          { stage: 'Lead', count: 125, value: 250000, probability: 10 },
          { stage: 'Calificado', count: 78, value: 890000, probability: 25 },
          { stage: 'Propuesta', count: 34, value: 1200000, probability: 50 },
          { stage: 'Negociación', count: 12, value: 450000, probability: 75 },
          { stage: 'Ganado', count: 45, value: 2100000, probability: 100 }
        ],
        leadSources: [
          { source: 'Website', count: 456, value: 890000, conversionRate: 18.2 },
          { source: 'WhatsApp', count: 234, value: 650000, conversionRate: 32.1 },
          { source: 'Referidos', count: 189, value: 1200000, conversionRate: 45.6 },
          { source: 'Campañas', count: 368, value: 110000, conversionRate: 12.8 }
        ],
        agentPerformance: [
          { name: 'María González', contacts: 147, deals: 23, revenue: 850000, conversionRate: 28.5 },
          { name: 'Carlos Rivera', contacts: 132, deals: 19, revenue: 720000, conversionRate: 24.1 },
          { name: 'Ana Martínez', contacts: 118, deals: 15, revenue: 450000, conversionRate: 19.8 }
        ],
        contactGrowth: [
          { month: 'Ene', total: 1247, new: 89, churned: 12 },
          { month: 'Dic', total: 1170, new: 67, churned: 8 },
          { month: 'Nov', total: 1111, new: 78, churned: 15 }
        ]
      };

      setContacts(loadedContacts);
      setDeals(mockDeals);
      setSegments(mockSegments);
      setSalesStages(mockSalesStages);
      setAnalytics(mockAnalytics);
    } catch (error) {
      console.error('Error loading CRM data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'lead': return '#9e9e9e';
      case 'prospect': return '#2196f3';
      case 'customer': return '#4caf50';
      case 'inactive': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'lead': return <PersonAdd />;
      case 'prospect': return <Person />;
      case 'customer': return <CheckCircle />;
      case 'inactive': return <Cancel />;
      default: return <Person />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#4caf50';
    if (score >= 60) return '#ff9800';
    if (score >= 40) return '#2196f3';
    return '#f44336';
  };

  const getStageColor = (stageId: string) => {
    const stage = salesStages.find(s => s.id === stageId);
    return stage ? stage.color : '#9e9e9e';
  };

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = 
      contact.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.company?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSegment = selectedSegment === 'all' || contact.tags.includes(selectedSegment);
    const matchesStage = selectedStage === 'all' || contact.stage === selectedStage;
    const matchesAgent = selectedAgent === 'all' || contact.assignedAgent === selectedAgent;
    
    return matchesSearch && matchesSegment && matchesStage && matchesAgent;
  });

  const sortedContacts = [...filteredContacts].sort((a, b) => {
    const aValue = a[sortBy as keyof Contact] as any;
    const bValue = b[sortBy as keyof Contact] as any;

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  // Paginación
  const paginatedContacts = sortedContacts.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} sx={{ color: '#e91e63' }} />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ 
          mb: 4, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: 'linear-gradient(135deg, #e91e63 0%, #ad1457 100%)',
          borderRadius: 3,
          p: 3,
          color: 'white'
        }}>
          <Box>
            <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
              🎯 CRM Empresarial
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.9, fontWeight: 300 }}>
              Gestión Inteligente • Lead Scoring • Pipeline • Automatización • Analytics 360°
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              startIcon={<PersonAdd />}
              onClick={() => setShowContactDialog(true)}
              sx={{
                bgcolor: 'rgba(255,255,255,0.2)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
              }}
            >
              Nuevo Contacto
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setShowDealDialog(true)}
              sx={{
                bgcolor: 'rgba(255,255,255,0.2)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
              }}
            >
              Nueva Oportunidad
            </Button>
          </Box>
        </Box>

        {/* Contador de contactos y grupos sincronizados */}
        <Card sx={{ mb: 3, bgcolor: '#f8fafc' }}>
          <CardContent>
            <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar sx={{ bgcolor: '#2196f3', width: 40, height: 40 }}>
                  <Person />
                </Avatar>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#2196f3' }}>
                    {syncedContacts.length}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    contactos
                  </Typography>
                </Box>
              </Box>

              <Divider orientation="vertical" flexItem />

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar sx={{ bgcolor: '#ff9800', width: 40, height: 40 }}>
                  <Group />
                </Avatar>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#ff9800' }}>
                    {syncedGroups.length}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    grupos
                  </Typography>
                </Box>
              </Box>

              <Divider orientation="vertical" flexItem />

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar sx={{ bgcolor: '#4caf50', width: 40, height: 40 }}>
                  <Refresh />
                </Avatar>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#4caf50' }}>
                    {syncedContacts.length + syncedGroups.length}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    sincronizados
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ ml: 'auto', display: 'flex', gap: 2, alignItems: 'center' }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showOnlyNamed}
                      onChange={(e) => {
                        setShowOnlyNamed(e.target.checked);
                        setPage(0); // Reset pagination
                      }}
                      color="success"
                    />
                  }
                  label={
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      Solo con nombre
                    </Typography>
                  }
                />
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Refresh />}
                  onClick={loadWhatsAppData}
                  sx={{ borderColor: '#00a884', color: '#00a884' }}
                >
                  Actualizar
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Métricas principales */}
        {analytics && (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card elevation={3} sx={{ 
                borderRadius: 3,
                background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
                color: 'white'
              }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                    {analytics.totalContacts.toLocaleString()}
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9 }}>
                    Contactos Totales
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 1 }}>
                    <TrendingUp sx={{ fontSize: 16, mr: 0.5 }} />
                    <Typography variant="caption">+15.2% vs mes anterior</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card elevation={3} sx={{ 
                borderRadius: 3,
                background: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)',
                color: 'white'
              }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                    €{(analytics.totalValue / 1000000).toFixed(1)}M
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9 }}>
                    Pipeline Total
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 1 }}>
                    <TrendingUp sx={{ fontSize: 16, mr: 0.5 }} />
                    <Typography variant="caption">+28.5% vs mes anterior</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card elevation={3} sx={{ 
                borderRadius: 3,
                background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                color: 'white'
              }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                    {analytics.conversionRate}%
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9 }}>
                    Tasa Conversión
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 1 }}>
                    <TrendingUp sx={{ fontSize: 16, mr: 0.5 }} />
                    <Typography variant="caption">+3.8% vs mes anterior</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card elevation={3} sx={{ 
                borderRadius: 3,
                background: 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)',
                color: 'white'
              }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                    {analytics.salesCycle}d
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9 }}>
                    Ciclo de Venta
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 1 }}>
                    <TrendingDown sx={{ fontSize: 16, mr: 0.5 }} />
                    <Typography variant="caption">-5 días vs mes anterior</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Filtros y controles */}
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Buscar contactos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search sx={{ color: '#64748b' }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Segmento</InputLabel>
                  <Select
                    value={selectedSegment}
                    label="Segmento"
                    onChange={(e) => setSelectedSegment(e.target.value)}
                  >
                    <MenuItem value="all">Todos</MenuItem>
                    {segments.map(segment => (
                      <MenuItem key={segment.id} value={segment.name}>
                        {segment.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Etapa</InputLabel>
                  <Select
                    value={selectedStage}
                    label="Etapa"
                    onChange={(e) => setSelectedStage(e.target.value)}
                  >
                    <MenuItem value="all">Todas</MenuItem>
                    {salesStages.map(stage => (
                      <MenuItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Agente</InputLabel>
                  <Select
                    value={selectedAgent}
                    label="Agente"
                    onChange={(e) => setSelectedAgent(e.target.value)}
                  >
                    <MenuItem value="all">Todos</MenuItem>
                    <MenuItem value="María González">María González</MenuItem>
                    <MenuItem value="Carlos Rivera">Carlos Rivera</MenuItem>
                    <MenuItem value="Ana Martínez">Ana Martínez</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  onChange={(_, newValue) => newValue && setViewMode(newValue)}
                  size="small"
                  fullWidth
                >
                  <ToggleButton value="cards">
                    <Dashboard />
                  </ToggleButton>
                  <ToggleButton value="table">
                    <Assignment />
                  </ToggleButton>
                  <ToggleButton value="kanban">
                    <Timeline />
                  </ToggleButton>
                </ToggleButtonGroup>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Tabs principales */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={selectedTab} onChange={(_, newValue) => {
            setSelectedTab(newValue);
            setPage(0); // Reset pagination when changing tabs
          }}>
            <Tab label={`Contactos WhatsApp (${syncedContacts.length})`} />
            <Tab label={`Grupos WhatsApp (${syncedGroups.length})`} />
            <Tab label={`Pipeline (${deals.length})`} />
            <Tab label="Segmentos" />
            <Tab label="Analytics" />
          </Tabs>
        </Paper>

        {/* Contenido de las tabs */}
        {selectedTab === 0 && (
          <Box>
            {/* Contactos de WhatsApp sincronizados */}
            <Grid container spacing={3}>
              {syncedContacts
                .filter((contact: any) => {
                  // Filtro de búsqueda
                  const matchesSearch =
                    (contact.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (contact.jid || '').includes(searchTerm.toLowerCase());

                  // Filtro "Solo con nombre" - excluir contactos donde el nombre es solo un número
                  const phoneNumber = contact.jid.split('@')[0];
                  const hasRealName = showOnlyNamed ? (contact.name && contact.name !== phoneNumber && !/^\d+$/.test(contact.name)) : true;

                  return matchesSearch && hasRealName;
                })
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((contact: any) => (
                  <Grid item xs={12} md={6} lg={4} key={contact.jid}>
                    <Card elevation={3} sx={{
                      borderRadius: 3,
                      transition: 'all 0.3s ease',
                      border: '2px solid #00a88420',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 12px 30px rgba(0,0,0,0.15)',
                        borderColor: '#00a884'
                      }
                    }}>
                      <CardContent sx={{ p: 3 }}>
                        {/* Header del contacto de WhatsApp */}
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <Avatar
                            src={contact.avatar || `${getAPIBaseURL()}/api/avatar/${sessionId}/${contact.jid}`}
                            sx={{
                              width: 56,
                              height: 56,
                              mr: 2,
                              bgcolor: '#00a884'
                            }}
                          >
                            {(contact.name || contact.notify || contact.jid.split('@')[0]).charAt(0).toUpperCase()}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                              {contact.name || contact.notify || 'Sin nombre'}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#64748b', mb: 0.5 }}>
                              {contact.jid.split('@')[0]}
                            </Typography>
                            <Chip
                              icon={<WhatsApp />}
                              label="WhatsApp"
                              size="small"
                              sx={{
                                bgcolor: '#00a88420',
                                color: '#00a884',
                                fontWeight: 600,
                                fontSize: '0.7rem'
                              }}
                            />
                          </Box>
                          <IconButton 
                            size="small" 
                            sx={{ ml: 1 }}
                            onClick={(e) => handleOpenContactMenu(e, contact)}
                          >
                            <MoreVert />
                          </IconButton>
                        </Box>

                        {/* Estado online */}
                        {contact.isOnline && (
                          <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            mb: 2,
                            p: 1,
                            borderRadius: 2,
                            bgcolor: '#e8f5e9'
                          }}>
                            <CheckCircle sx={{ fontSize: 16, mr: 1, color: '#4caf50' }} />
                            <Typography variant="caption" sx={{ color: '#4caf50', fontWeight: 600 }}>
                              En línea
                            </Typography>
                          </Box>
                        )}

                        {/* Información del contacto */}
                        <Box sx={{ mb: 2, p: 2, borderRadius: 2, bgcolor: '#f8fafc' }}>
                          <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 0.5 }}>
                            <strong>JID:</strong> {contact.jid}
                          </Typography>
                          {contact.notify && (
                            <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                              <strong>Notify:</strong> {contact.notify}
                            </Typography>
                          )}
                        </Box>

                        {/* Acciones */}
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<WhatsApp />}
                            sx={{
                              flex: 1,
                              bgcolor: '#00a884',
                              '&:hover': { bgcolor: '#008069' }
                            }}
                          >
                            Chatear
                          </Button>
                          <IconButton
                            size="small"
                            sx={{
                              border: '1px solid #e0e0e0',
                              borderRadius: 1
                            }}
                          >
                            <Visibility />
                          </IconButton>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
            </Grid>

            {/* Paginación */}
            {syncedContacts.length > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <TablePagination
                  component="div"
                  count={syncedContacts.filter((contact: any) => {
                    const matchesSearch =
                      (contact.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (contact.jid || '').includes(searchTerm.toLowerCase());
                    const phoneNumber = contact.jid.split('@')[0];
                    const hasRealName = showOnlyNamed ? (contact.name && contact.name !== phoneNumber && !/^\d+$/.test(contact.name)) : true;
                    return matchesSearch && hasRealName;
                  }).length}
                  page={page}
                  onPageChange={handleChangePage}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  rowsPerPageOptions={[12, 24, 48, 96]}
                  labelRowsPerPage="Contactos por página:"
                  labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
                />
              </Box>
            )}
          </Box>
        )}

        {selectedTab === 1 && (
          <Box>
            {/* Grupos de WhatsApp sincronizados */}
            <Grid container spacing={3}>
              {syncedGroups
                .filter((group: any) =>
                  (group.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                  (group.id || '').includes(searchTerm.toLowerCase())
                )
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((group: any) => (
                  <Grid item xs={12} md={6} lg={4} key={group.id}>
                    <Card elevation={3} sx={{
                      borderRadius: 3,
                      transition: 'all 0.3s ease',
                      border: '2px solid #ff980020',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 12px 30px rgba(0,0,0,0.15)',
                        borderColor: '#ff9800'
                      }
                    }}>
                      <CardContent sx={{ p: 3 }}>
                        {/* Header del grupo */}
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <Avatar
                            src={group.avatar}
                            sx={{
                              width: 56,
                              height: 56,
                              mr: 2,
                              bgcolor: '#ff9800'
                            }}
                          >
                            <Group />
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                              {group.name || 'Sin nombre'}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#64748b', mb: 0.5 }}>
                              {group.memberCount || 0} miembros
                            </Typography>
                            <Chip
                              icon={<Group />}
                              label="Grupo WhatsApp"
                              size="small"
                              sx={{
                                bgcolor: '#ff980020',
                                color: '#ff9800',
                                fontWeight: 600,
                                fontSize: '0.7rem'
                              }}
                            />
                          </Box>
                          <IconButton size="small" sx={{ ml: 1 }}>
                            <MoreVert />
                          </IconButton>
                        </Box>

                        {/* Información del grupo */}
                        <Box sx={{ mb: 2, p: 2, borderRadius: 2, bgcolor: '#f8fafc' }}>
                          <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 0.5 }}>
                            <strong>ID:</strong> {group.id}
                          </Typography>
                          {group.description && (
                            <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                              <strong>Descripción:</strong> {group.description}
                            </Typography>
                          )}
                        </Box>

                        {/* Acciones */}
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<Group />}
                            sx={{
                              flex: 1,
                              bgcolor: '#ff9800',
                              '&:hover': { bgcolor: '#f57c00' }
                            }}
                          >
                            Ver Miembros
                          </Button>
                          <IconButton
                            size="small"
                            sx={{
                              border: '1px solid #e0e0e0',
                              borderRadius: 1
                            }}
                          >
                            <Visibility />
                          </IconButton>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
            </Grid>

            {/* Paginación grupos */}
            {syncedGroups.length > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <TablePagination
                  component="div"
                  count={syncedGroups.filter((group: any) =>
                    (group.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (group.id || '').includes(searchTerm.toLowerCase())
                  ).length}
                  page={page}
                  onPageChange={handleChangePage}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  rowsPerPageOptions={[12, 24, 48, 96]}
                  labelRowsPerPage="Grupos por página:"
                  labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
                />
              </Box>
            )}
          </Box>
        )}

        {selectedTab === 2 && (
          <Grid container spacing={3}>
            {/* Pipeline por etapas */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Pipeline de Ventas</Typography>
                  <Grid container spacing={2}>
                    {salesStages.filter(stage => stage.isActive).map((stage) => {
                      const stageDeals = deals.filter(deal => deal.stage === stage.id);
                      const stageValue = stageDeals.reduce((sum, deal) => sum + deal.value, 0);
                      
                      return (
                        <Grid item xs={12} md={2} key={stage.id}>
                          <Paper sx={{ 
                            p: 2, 
                            borderTop: `4px solid ${stage.color}`,
                            minHeight: 200
                          }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                              {stage.name}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
                              {stageDeals.length} oportunidades
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700, color: stage.color, mb: 2 }}>
                              €{(stageValue / 1000).toFixed(0)}K
                            </Typography>
                            
                            <Stack spacing={1}>
                              {stageDeals.slice(0, 3).map((deal) => (
                                <Paper key={deal.id} sx={{ p: 1, bgcolor: '#f8fafc' }}>
                                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                    {deal.title}
                                  </Typography>
                                  <Typography variant="caption" sx={{ display: 'block', color: '#64748b' }}>
                                    €{deal.value.toLocaleString()}
                                  </Typography>
                                </Paper>
                              ))}
                              {stageDeals.length > 3 && (
                                <Typography variant="caption" sx={{ color: '#64748b', textAlign: 'center' }}>
                                  +{stageDeals.length - 3} más
                                </Typography>
                              )}
                            </Stack>
                          </Paper>
                        </Grid>
                      );
                    })}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {selectedTab === 3 && (
          <Grid container spacing={3}>
            {/* Header de Segmentos */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  Grupos Locales
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setShowSegmentDialog(true)}
                >
                  Crear Grupo Local
                </Button>
              </Box>
            </Grid>

            {/* Lista de Segmentos */}
            {loading ? (
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              </Grid>
            ) : segments.length === 0 ? (
              <Grid item xs={12}>
                <Card>
                  <CardContent sx={{ textAlign: 'center', py: 6 }}>
                    <Folder sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" gutterBottom color="text.secondary">
                      No hay grupos locales creados
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Los grupos locales te permiten organizar tus contactos en categorías personalizadas
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={() => setShowSegmentDialog(true)}
                    >
                      Crear Primer Grupo
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ) : (
              segments.map((segment) => (
                <Grid item xs={12} sm={6} md={4} key={segment.id}>
                  <Card sx={{ 
                    height: '100%',
                    transition: 'all 0.3s',
                    '&:hover': { 
                      transform: 'translateY(-4px)',
                      boxShadow: 4
                    }
                  }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                        <Avatar 
                          sx={{ 
                            bgcolor: segment.color || '#2196f3',
                            mr: 2,
                            width: 48,
                            height: 48
                          }}
                        >
                          <Folder />
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="h6" noWrap sx={{ fontWeight: 600 }}>
                            {segment.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {segment.contactCount} contacto{segment.contactCount !== 1 ? 's' : ''}
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={() => handleEditSegment(segment)}
                          sx={{ color: 'primary.main', mr: 1 }}
                        >
                          <Edit />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteSegment(segment.id)}
                          sx={{ color: 'error.main' }}
                        >
                          <Delete />
                        </IconButton>
                      </Box>

                      {segment.description && (
                        <Typography 
                          variant="body2" 
                          color="text.secondary"
                          sx={{ 
                            mb: 2,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                        >
                          {segment.description}
                        </Typography>
                      )}

                      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                        <Chip
                          size="small"
                          label={new Date(segment.createdAt).toLocaleDateString()}
                          icon={<CalendarToday />}
                          variant="outlined"
                        />
                        {segment.isActive && (
                          <Chip
                            size="small"
                            label="Activo"
                            color="success"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))
            )}

            {/* Información adicional */}
            <Grid item xs={12}>
              <Card sx={{ bgcolor: '#f5f5f5' }}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    💡 <strong>Tip:</strong> Los grupos locales te permiten organizar tus contactos. 
                    Puedes usarlos para enviar campañas específicas a segmentos de tu audiencia.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {selectedTab === 4 && analytics && (
          <Grid container spacing={3}>
            {/* Gráficos de analytics detallados */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Fuentes de Leads</Typography>
                  {analytics.leadSources.map((source) => (
                    <Box key={source.source} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2">{source.source}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {source.count} ({source.conversionRate}%)
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(source.count / analytics.totalContacts) * 100}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Rendimiento de Agentes</Typography>
                  {analytics.agentPerformance.map((agent, index) => (
                    <Box key={agent.name} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Avatar sx={{ 
                          bgcolor: index === 0 ? '#ffc107' : '#e0e0e0',
                          width: 32,
                          height: 32,
                          mr: 2
                        }}>
                          {index + 1}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {agent.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b' }}>
                            {agent.deals} deals • €{(agent.revenue / 1000).toFixed(0)}K • {agent.conversionRate}%
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </Box>

      {/* Diálogo para crear/editar grupo local */}
      <Dialog 
        open={showSegmentDialog} 
        onClose={handleCloseSegmentDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Folder sx={{ color: 'primary.main' }} />
            {editingSegment ? 'Editar Grupo Local' : 'Crear Grupo Local'}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              label="Nombre del Grupo"
              fullWidth
              value={newSegmentName}
              onChange={(e) => setNewSegmentName(e.target.value)}
              placeholder="Ej: Clientes VIP, Equipo de Ventas, etc."
              sx={{ mb: 2 }}
              autoFocus
            />
            <TextField
              label="Descripción (opcional)"
              fullWidth
              multiline
              rows={3}
              value={newSegmentDescription}
              onChange={(e) => setNewSegmentDescription(e.target.value)}
              placeholder="Describe el propósito de este grupo..."
            />
            {!editingSegment && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                💡 Después de crear el grupo, podrás agregar contactos desde la pestaña de Contactos WhatsApp
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSegmentDialog}>
            Cancelar
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSaveSegment}
            disabled={!newSegmentName.trim()}
          >
            {editingSegment ? 'Actualizar' : 'Crear Grupo'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Menú contextual de contacto */}
      <Menu
        anchorEl={contactMenuAnchor}
        open={Boolean(contactMenuAnchor)}
        onClose={handleCloseContactMenu}
      >
        <MenuItem onClick={handleEditContact}>
          <Edit sx={{ mr: 1 }} fontSize="small" />
          Editar Contacto
        </MenuItem>
      </Menu>

      {/* Diálogo para editar contacto */}
      <Dialog 
        open={editContactDialog} 
        onClose={handleCloseEditContactDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Editar Contacto
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Nombre del Contacto"
              value={editContactName}
              onChange={(e) => setEditContactName(e.target.value)}
              sx={{ mb: 2 }}
              required
            />
            <TextField
              fullWidth
              label="Número de Teléfono"
              value={editContactPhone}
              onChange={(e) => setEditContactPhone(e.target.value)}
              disabled
              helperText="El número no se puede modificar"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditContactDialog}>
            Cancelar
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSaveContactEdit}
            disabled={!editContactName.trim()}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default CRMModule;