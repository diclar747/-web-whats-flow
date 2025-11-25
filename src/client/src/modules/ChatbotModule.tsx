import React, { useState, useEffect, useRef } from 'react';
import { getAPIBaseURL } from '../utils/socketConfig';
import { Box, Grid, Card, CardContent, Typography, Button, TextField, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Paper, FormControl, InputLabel, Select, MenuItem, Stack, Chip, Alert, Tabs, Tab, List, ListItem, ListItemText, Switch, FormControlLabel, Divider, Tooltip, CircularProgress, Popover, Snackbar, Radio, RadioGroup } from '@mui/material';
import { SmartToy, Add, Edit, Delete, Save, PlayArrow, Pause, Settings, Analytics, QuestionAnswer, Message, ExpandMore, Refresh, ContentCopy, Speed, CheckCircle, RestartAlt, EmojiEmotions, Close, Error as ErrorIcon, Warning as WarningIcon, Info as InfoIcon, Psychology, Code } from '@mui/icons-material';
import EmojiPicker from 'emoji-picker-react';
import { SubscriptionGuard } from '../components/SubscriptionGuard';

interface ChatbotModuleProps { sessionId: string; }
interface ChatbotFlow { id: string; name: string; description: string; active: boolean; flowType: 'ai' | 'programmed'; triggers: string[]; responses: Response[]; kanbanBoardId?: string | null; createdAt: string; stats: { totalTriggers: number; successRate: number; }; aiConfig?: { businessData: string; websiteUrl: string; scrapedContent: string; temperature: number; maxTokens: number; }; }
interface Response { id: string; type: 'text'|'menu'|'image'|'video'|'document'|'url'; content: string; delay?: number; options?: MenuOption[]; mediaUrl?: string; fileName?: string; }
interface MenuOption { id: string; text: string; action: 'reply'|'flow'|'agent'; value: string; }
interface BotSettings { enabled: boolean; }
interface KanbanBoard { id: string; name: string; color: string; is_default: boolean; }

const ChatbotModule: React.FC<ChatbotModuleProps> = ({ sessionId }) => {
  return <ChatbotModuleContent sessionId={sessionId} />;
};

const ChatbotModuleContent: React.FC<ChatbotModuleProps> = ({ sessionId }) => {
  const [flows, setFlows] = useState<ChatbotFlow[]>([]);
  const [selectedTab, setSelectedTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<ChatbotFlow|null>(null);
  const [createFlowType, setCreateFlowType] = useState<'ai' | 'programmed' | null>(null);
  const [newFlow, setNewFlow] = useState<Partial<ChatbotFlow>>({ 
    name: '', 
    description: '', 
    active: true, 
    flowType: 'programmed',
    triggers: [], 
    responses: [], 
    kanbanBoardId: null,
    aiConfig: { businessData: '', websiteUrl: '', scrapedContent: '', temperature: 0.7, maxTokens: 500 }
  });
  const [settings, setSettings] = useState<BotSettings>({ enabled: false });
  const [currentTrigger, setCurrentTrigger] = useState('');
  const [currentResponse, setCurrentResponse] = useState('');
  const [responseType, setResponseType] = useState<'text'|'menu'|'image'|'video'|'document'|'url'>('text');
  const [menuOptions, setMenuOptions] = useState<MenuOption[]>([]);
  const [newMenuOption, setNewMenuOption] = useState({ text: '', action: 'reply', value: '' });
  const [stats, setStats] = useState({ totalInteractions: 0, successfulResponses: 0, transferredToAgent: 0, avgResponseTime: 0 });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiAnchorEl, setEmojiAnchorEl] = useState<HTMLElement | null>(null);
  const [emojiTarget, setEmojiTarget] = useState<'trigger' | 'response' | 'business'>('response');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notification, setNotification] = useState<{open: boolean; message: string; severity: 'success'|'error'|'warning'|'info'}>({ open: false, message: '', severity: 'info' });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [flowToDelete, setFlowToDelete] = useState<string | null>(null);
  const [kanbanBoards, setKanbanBoards] = useState<KanbanBoard[]>([]);
  const [scrapingUrl, setScrapingUrl] = useState(false);

  useEffect(() => { loadFlows(); loadSettings(); loadStats(); loadKanbanBoards(); }, [sessionId]);

  const showNotification = (message: string, severity: 'success'|'error'|'warning'|'info' = 'info') => {
    setNotification({ open: true, message, severity });
  };

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  const loadFlows = async () => {
    try { 
      setLoading(true); 
      const response = await fetch(`${getAPIBaseURL()}/api/chatbot/flows/${sessionId}`); 
      const data = await response.json(); 
      if (data.success) {
        // Asegurar que cada flujo tenga flowType
        const flowsWithType = (data.flows || []).map((flow: any) => ({
          ...flow,
          flowType: flow.flowType || (flow.aiEnabled ? 'ai' : 'programmed'),
          aiConfig: flow.aiConfig || { businessData: '', websiteUrl: '', scrapedContent: '', temperature: 0.7, maxTokens: 500 }
        }));
        setFlows(flowsWithType);
      }
    } catch (error) { 
      console.error('Error:', error); 
    } finally { 
      setLoading(false); 
    }
  };

  const loadSettings = async () => {
    try { 
      const response = await fetch(`${getAPIBaseURL()}/api/chatbot/settings/${sessionId}`); 
      const data = await response.json(); 
      if (data.success && data.settings) {
        // Solo cargar enabled
        setSettings({ enabled: data.settings.enabled || false });
      }
    } catch (error) { 
      console.error('Error:', error); 
    }
  };

  const loadStats = async () => {
    try { 
      const response = await fetch(`${getAPIBaseURL()}/api/chatbot/stats/${sessionId}`); 
      const data = await response.json(); 
      if (data.success) setStats(data.stats || stats); 
    } catch (error) { 
      console.error('Error:', error); 
    }
  };

  const loadKanbanBoards = async () => {
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/kanban/boards/${sessionId}`);
      const data = await response.json();
      if (data.success) {
        setKanbanBoards(data.boards || []);
      }
    } catch (error) {
      console.error('Error cargando kanbans:', error);
    }
  };

  const handleCreateFlow = async () => {
    if (!newFlow.name) { 
      showNotification('⚠️ Ingresa un nombre para el flujo', 'warning'); 
      return; 
    }

    if (newFlow.flowType === 'programmed') {
      if (!newFlow.triggers?.length || !newFlow.responses?.length) { 
        showNotification('⚠️ Agrega al menos una palabra clave y una respuesta', 'warning'); 
        return; 
      }
    } else if (newFlow.flowType === 'ai') {
      if (!newFlow.aiConfig?.businessData && !newFlow.aiConfig?.scrapedContent) {
        showNotification('⚠️ Ingresa información del negocio o extrae desde una URL', 'warning');
        return;
      }
    }

    try { 
      setLoading(true); 
      const response = await fetch(`${getAPIBaseURL()}/api/chatbot/flows/${sessionId}`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          ...newFlow, 
          createdAt: new Date().toISOString(), 
          stats: { totalTriggers: 0, successRate: 0 } 
        }) 
      }); 
      const data = await response.json(); 
      if (data.success) { 
        await loadFlows(); 
        setShowCreateDialog(false); 
        setCreateFlowType(null);
        resetNewFlow(); 
        showNotification('✅ Flujo creado exitosamente', 'success'); 
      } 
    } catch (error) { 
      console.error('Error:', error); 
      showNotification('❌ Error al crear el flujo', 'error'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleUpdateFlow = async () => {
    if (!selectedFlow) return;
    try { 
      setLoading(true); 
      const response = await fetch(`${getAPIBaseURL()}/api/chatbot/flows/${sessionId}/${selectedFlow.id}`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(selectedFlow) 
      }); 
      const data = await response.json(); 
      if (data.success) { 
        await loadFlows(); 
        setShowEditDialog(false); 
        setSelectedFlow(null); 
        showNotification('✅ Flujo actualizado exitosamente', 'success'); 
      } 
    } catch (error) { 
      console.error('Error:', error); 
      showNotification('❌ Error al actualizar el flujo', 'error'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleDeleteFlow = (flowId: string) => {
    setFlowToDelete(flowId);
    setShowDeleteDialog(true);
  };

  const confirmDeleteFlow = async () => {
    if (!flowToDelete) return;
    try { 
      setLoading(true); 
      const response = await fetch(`${getAPIBaseURL()}/api/chatbot/flows/${sessionId}/${flowToDelete}`, { 
        method: 'DELETE' 
      }); 
      const data = await response.json(); 
      if (data.success) { 
        await loadFlows(); 
        showNotification('🗑️ Flujo eliminado correctamente', 'success'); 
      } 
    } catch (error) { 
      console.error('Error:', error); 
      showNotification('❌ Error al eliminar el flujo', 'error'); 
    } finally { 
      setLoading(false); 
      setShowDeleteDialog(false);
      setFlowToDelete(null);
    }
  };

  const handleToggleFlow = async (flowId: string, active: boolean) => {
    try { 
      const response = await fetch(`${getAPIBaseURL()}/api/chatbot/flows/${sessionId}/${flowId}/toggle`, { 
        method: 'PATCH', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ active }) 
      }); 
      const data = await response.json(); 
      if (data.success) await loadFlows(); 
    } catch (error) { 
      console.error('Error:', error); 
    }
  };

  const handleSaveSettings = async () => {
    try { 
      setLoading(true); 
      const response = await fetch(`${getAPIBaseURL()}/api/chatbot/settings/${sessionId}`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(settings) 
      }); 
      const data = await response.json(); 
      if (data.success) showNotification('💾 Configuración guardada exitosamente', 'success'); 
    } catch (error) { 
      console.error('Error:', error); 
      showNotification('❌ Error al guardar la configuración', 'error'); 
    } finally { 
      setLoading(false); 
    }
  };

  const addTrigger = () => {
    if (!currentTrigger.trim()) return;
    if (showCreateDialog) { 
      setNewFlow({ ...newFlow, triggers: [...(newFlow.triggers||[]), currentTrigger.toLowerCase().trim()] }); 
    } else if (selectedFlow) { 
      setSelectedFlow({ ...selectedFlow, triggers: [...selectedFlow.triggers, currentTrigger.toLowerCase().trim()] }); 
    }
    setCurrentTrigger('');
  };

  const removeTrigger = (trigger: string) => {
    if (showCreateDialog) { 
      setNewFlow({ ...newFlow, triggers: (newFlow.triggers||[]).filter(t => t !== trigger) }); 
    } else if (selectedFlow) { 
      setSelectedFlow({ ...selectedFlow, triggers: selectedFlow.triggers.filter(t => t !== trigger) }); 
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const maxSize = responseType === 'video' ? 16 * 1024 * 1024 : 5 * 1024 * 1024;
      if (file.size > maxSize) {
        showNotification(`❌ El archivo es demasiado grande. Máximo ${maxSize / (1024 * 1024)}MB`, 'error');
        event.target.value = '';
        return;
      }
      setSelectedFile(file);
    }
  };

  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sessionId', sessionId);
    
    const response = await fetch(`${getAPIBaseURL()}/api/chatbot/upload`, {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    if (!data.success) throw new Error('Error al subir archivo');
    return data.url;
  };

  const addResponse = async () => {
    const needsText = (responseType === 'text' || responseType === 'menu' || responseType === 'url');
    if (needsText && !currentResponse.trim()) return;
    if (!needsText && !selectedFile && !currentResponse.trim()) return;
    
    setUploadingFile(true);
    try {
      let mediaUrl = '';
      let fileName = '';
      
      if (selectedFile) {
        mediaUrl = await uploadFile(selectedFile);
        fileName = selectedFile.name;
      }
      
      const newResponse: Response = { 
        id: Date.now().toString(), 
        type: responseType, 
        content: currentResponse, 
        delay: 1000, 
        options: responseType === 'menu' ? menuOptions : undefined,
        mediaUrl: mediaUrl || undefined,
        fileName: fileName || undefined
      };
      
      if (showCreateDialog) { 
        setNewFlow({ ...newFlow, responses: [...(newFlow.responses||[]), newResponse] }); 
      } else if (selectedFlow) { 
        setSelectedFlow({ ...selectedFlow, responses: [...selectedFlow.responses, newResponse] }); 
      }
      
      setCurrentResponse(''); 
      setMenuOptions([]);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('Error agregando respuesta:', error);
      showNotification('❌ Error al subir el archivo. Intenta de nuevo.', 'error');
    } finally {
      setUploadingFile(false);
    }
  };

  const removeResponse = (responseId: string) => {
    if (showCreateDialog) { 
      setNewFlow({ ...newFlow, responses: (newFlow.responses||[]).filter(r => r.id !== responseId) }); 
    } else if (selectedFlow) { 
      setSelectedFlow({ ...selectedFlow, responses: selectedFlow.responses.filter(r => r.id !== responseId) }); 
    }
  };

  const addMenuOption = () => {
    if (!newMenuOption.text || !newMenuOption.value) return;
    setMenuOptions([...menuOptions, { id: Date.now().toString(), ...newMenuOption, action: newMenuOption.action as any }]);
    setNewMenuOption({ text: '', action: 'reply', value: '' });
  };

  const removeMenuOption = (optionId: string) => setMenuOptions(menuOptions.filter(o => o.id !== optionId));

  const resetNewFlow = () => { 
    setNewFlow({ 
      name: '', 
      description: '', 
      active: true, 
      flowType: 'programmed',
      triggers: [], 
      responses: [], 
      kanbanBoardId: null,
      aiConfig: { businessData: '', websiteUrl: '', scrapedContent: '', temperature: 0.7, maxTokens: 500 }
    }); 
    setCurrentTrigger(''); 
    setCurrentResponse(''); 
    setMenuOptions([]); 
  };

  const handleEmojiClick = (event: any, target: 'trigger' | 'response' | 'business') => {
    setEmojiAnchorEl(event.currentTarget);
    setEmojiTarget(target);
    setShowEmojiPicker(true);
  };
  
  const handleEmojiSelect = (emojiObject: any) => {
    if (emojiTarget === 'trigger') {
      setCurrentTrigger(currentTrigger + emojiObject.emoji);
    } else if (emojiTarget === 'response') {
      setCurrentResponse(currentResponse + emojiObject.emoji);
    } else if (emojiTarget === 'business' && newFlow.aiConfig) {
      setNewFlow({
        ...newFlow,
        aiConfig: {
          ...newFlow.aiConfig,
          businessData: (newFlow.aiConfig.businessData || '') + emojiObject.emoji
        }
      });
    }
    setShowEmojiPicker(false);
  };

  const handleScrapeUrl = async () => {
    const url = showCreateDialog ? newFlow.aiConfig?.websiteUrl : selectedFlow?.aiConfig?.websiteUrl;
    if (!url) {
      showNotification('⚠️ Ingresa una URL primero', 'warning');
      return;
    }

    setScrapingUrl(true);
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/chatbot/scrape-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await response.json();

      if (data.success) {
        if (showCreateDialog) {
          setNewFlow({
            ...newFlow,
            aiConfig: {
              ...newFlow.aiConfig!,
              scrapedContent: data.content
            }
          });
        } else if (selectedFlow) {
          setSelectedFlow({
            ...selectedFlow,
            aiConfig: {
              ...selectedFlow.aiConfig!,
              scrapedContent: data.content
            }
          });
        }
        showNotification(`✅ Contenido extraído: ${data.content.length} caracteres`, 'success');
      } else {
        showNotification('❌ ' + (data.error || 'Error al extraer contenido'), 'error');
      }
    } catch (error) {
      console.error('Error scraping:', error);
      showNotification('❌ Error de conexión al extraer contenido', 'error');
    } finally {
      setScrapingUrl(false);
    }
  };

  const handleOpenCreateDialog = () => {
    setShowCreateDialog(true);
    setCreateFlowType(null);
  };

  const handleSelectFlowType = (type: 'ai' | 'programmed') => {
    setCreateFlowType(type);
    setNewFlow({
      ...newFlow,
      flowType: type
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 3, p: 3 }}>
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>🤖 Chatbot Inteligente</Typography>
          <Typography variant="h6" sx={{ fontWeight: 300 }}>Respuestas Automáticas • Flujos Personalizados • IA</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Chip
            icon={settings.enabled ? <CheckCircle/> : <Pause/>}
            label={settings.enabled ? 'Activo' : 'Pausado'}
            color={settings.enabled ? 'success' : 'default'}
          />
          <Button
            variant="contained"
            startIcon={<Add/>}
            onClick={handleOpenCreateDialog}
            color="primary"
          >
            Crear Flujo
          </Button>
        </Box>
      </Box>

      {/* Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {[ 
          { value: stats.totalInteractions, label: 'Interacciones', icon: Message, color: '#667eea' }, 
          { value: stats.successfulResponses, label: 'Exitosas', icon: CheckCircle, color: '#10b981' }, 
          { value: stats.transferredToAgent, label: 'Transferencias', icon: QuestionAnswer, color: '#f59e0b' }, 
          { value: `${stats.avgResponseTime}s`, label: 'Tiempo Promedio', icon: Speed, color: '#8b5cf6' } 
        ].map((stat, i) => (
          <Grid item xs={12} md={3} key={i}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: stat.color }}>{stat.value}</Typography>
                    <Typography variant="body2" color="textSecondary">{stat.label}</Typography>
                  </Box>
                  <stat.icon sx={{ fontSize: 40, color: stat.color, opacity: 0.3 }}/>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={selectedTab} onChange={(_, val) => setSelectedTab(val)}>
          <Tab label="Flujos" icon={<SmartToy/>} iconPosition="start"/>
          <Tab label="Analytics" icon={<Analytics/>} iconPosition="start"/>
          <Tab label="Configuración" icon={<Settings/>} iconPosition="start"/>
        </Tabs>
      </Paper>

      {/* Tab 0: Flujos */}
      {selectedTab === 0 && (
        <Box>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress/>
            </Box>
          ) : flows.length === 0 ? (
            <Paper sx={{ p: 8, textAlign: 'center' }}>
              <SmartToy sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }}/>
              <Typography variant="h5" gutterBottom>No hay flujos creados</Typography>
              <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
                Crea tu primer flujo de conversación con IA o programado
              </Typography>
              <Button 
                variant="contained" 
                startIcon={<Add/>} 
                onClick={handleOpenCreateDialog} 
                size="large"
              >
                Crear Primer Flujo
              </Button>
            </Paper>
          ) : (
            <Grid container spacing={3}>
              {flows.map((flow) => (
                <Grid item xs={12} md={6} lg={4} key={flow.id}>
                  <Card 
                    elevation={0}
                    sx={{ 
                      border: flow.flowType === 'ai' 
                        ? '2px solid #10b981' 
                        : '2px solid #667eea',
                      borderRadius: 3,
                      background: flow.flowType === 'ai'
                        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0.1) 100%)'
                        : 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(102, 126, 234, 0.1) 100%)',
                      transition: 'all 0.3s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: flow.flowType === 'ai'
                          ? '0 12px 24px rgba(16, 185, 129, 0.3)'
                          : '0 12px 24px rgba(102, 126, 234, 0.3)'
                      }
                    }}
                  >
                    {/* Header colorido */}
                    <Box 
                      sx={{ 
                        background: flow.flowType === 'ai'
                          ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                          : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        p: 2,
                        color: 'white',
                        borderRadius: '10px 10px 0 0'
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {flow.flowType === 'ai' ? (
                            <Psychology sx={{ fontSize: 28 }}/>
                          ) : (
                            <Code sx={{ fontSize: 28 }}/>
                          )}
                          <Box>
                            <Typography variant="h6" fontWeight="bold" sx={{ fontSize: '1.1rem' }}>
                              {flow.name}
                            </Typography>
                            <Chip 
                              size="small" 
                              label={flow.flowType === 'ai' ? 'Inteligencia Artificial' : 'Flujo Programado'} 
                              sx={{ 
                                bgcolor: 'rgba(255,255,255,0.2)',
                                color: 'white',
                                fontSize: '0.7rem',
                                height: 20
                              }}
                            />
                          </Box>
                        </Box>
                        <Switch 
                          checked={flow.active} 
                          onChange={(e) => handleToggleFlow(flow.id, e.target.checked)}
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': {
                              color: 'white',
                            },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              backgroundColor: 'rgba(255,255,255,0.5)',
                            }
                          }}
                        />
                      </Box>
                    </Box>

                    {/* Body del card */}
                    <CardContent>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
                        {flow.description || 'Sin descripción'}
                      </Typography>
                      
                      {flow.flowType === 'programmed' && (
                        <>
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="caption" color="textSecondary">
                              Palabras clave ({flow.triggers?.length || 0}):
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                              {flow.triggers?.slice(0, 5).map(trigger => 
                                <Chip key={trigger} label={trigger} size="small"/>
                              )}
                              {(flow.triggers?.length || 0) > 5 && 
                                <Chip label={`+${(flow.triggers?.length || 0)-5}`} size="small"/>
                              }
                            </Box>
                          </Box>
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="caption" color="textSecondary">
                              Respuestas ({flow.responses?.length || 0}):
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                              {flow.responses?.map(r => 
                                <Chip key={r.id} icon={<Message/>} label={r.type} size="small" color="primary" variant="outlined"/>
                              )}
                            </Stack>
                          </Box>
                        </>
                      )}

                      {flow.flowType === 'ai' && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="caption" color="textSecondary">
                            Configuración IA:
                          </Typography>
                          <Box sx={{ mt: 1 }}>
                            <Chip 
                              size="small" 
                              label={`Datos: ${flow.aiConfig?.businessData ? '✓' : '✗'}`}
                              color={flow.aiConfig?.businessData ? 'success' : 'default'}
                              sx={{ mr: 1 }}
                            />
                            <Chip 
                              size="small" 
                              label={`Web: ${flow.aiConfig?.scrapedContent ? '✓' : '✗'}`}
                              color={flow.aiConfig?.scrapedContent ? 'success' : 'default'}
                            />
                          </Box>
                        </Box>
                      )}

                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography variant="caption" color="textSecondary">
                            {flow.stats?.totalTriggers || 0} activaciones
                          </Typography>
                          <Typography variant="caption" color="success.main" sx={{ ml: 2 }}>
                            {flow.stats?.successRate || 0}% éxito
                          </Typography>
                        </Box>
                        <Box>
                          <Tooltip title="Editar">
                            <IconButton 
                              size="small" 
                              onClick={() => { 
                                setSelectedFlow(flow); 
                                setShowEditDialog(true); 
                              }}
                            >
                              <Edit/>
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Duplicar">
                            <IconButton size="small">
                              <ContentCopy/>
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Eliminar">
                            <IconButton 
                              size="small" 
                              color="error" 
                              onClick={() => handleDeleteFlow(flow.id)}
                            >
                              <Delete/>
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* Tab 1: Analytics */}
      {selectedTab === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>📊 Rendimiento</Typography>
            <Alert severity="info" sx={{ mb: 3 }}>
              Las métricas se actualizan en tiempo real
            </Alert>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>Flujos Más Activos</Typography>
                  <List>
                    {flows
                      .sort((a,b) => (b.stats?.totalTriggers || 0) - (a.stats?.totalTriggers || 0))
                      .slice(0,5)
                      .map(flow => (
                        <ListItem key={flow.id}>
                          <ListItemText 
                            primary={flow.name} 
                            secondary={`${flow.stats?.totalTriggers || 0} activaciones - ${flow.stats?.successRate || 0}% éxito`}
                          />
                          <Chip 
                            label={flow.active ? 'Activo' : 'Pausado'} 
                            size="small" 
                            color={flow.active ? 'success' : 'default'}
                          />
                        </ListItem>
                      ))
                    }
                  </List>
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Tab 2: Configuración - SOLO ACTIVAR/DESACTIVAR */}
      {selectedTab === 2 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>⚙️ Configuración General</Typography>
            <Stack spacing={3} sx={{ mt: 3 }}>
              <FormControlLabel
                control={
                  <Switch 
                    checked={settings.enabled} 
                    onChange={(e) => setSettings({...settings, enabled: e.target.checked})}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1" fontWeight="bold">
                      Habilitar Chatbot
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Activa o desactiva el chatbot para esta sesión. Los flujos seguirán guardados.
                    </Typography>
                  </Box>
                }
              />

              <Divider/>

              <Alert severity="info">
                💡 <strong>Tip:</strong> Crea flujos desde la pestaña "Flujos" y elige entre IA o Programado al momento de crear.
              </Alert>

              <Button 
                variant="contained" 
                onClick={handleSaveSettings}
                disabled={loading}
                startIcon={<Save/>}
                size="large"
              >
                Guardar Configuración
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Dialog de Creación/Edición */}
      <Dialog 
        open={showCreateDialog || showEditDialog} 
        onClose={() => { 
          setShowCreateDialog(false); 
          setShowEditDialog(false); 
          setSelectedFlow(null); 
          setCreateFlowType(null);
          resetNewFlow(); 
        }} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
          color: 'white' 
        }}>
          {showCreateDialog ? '🤖 Crear Nuevo Flujo' : '✏️ Editar Flujo'}
        </DialogTitle>
        
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            {/* Selector de Tipo de Flujo - Solo en Creación */}
            {showCreateDialog && createFlowType === null && (
              <Box>
                <Typography variant="h6" gutterBottom textAlign="center" sx={{ mb: 3 }}>
                  Elige el tipo de flujo que deseas crear
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        border: '2px solid transparent',
                        transition: 'all 0.3s',
                        '&:hover': {
                          border: '2px solid #10b981',
                          boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)'
                        }
                      }}
                      onClick={() => handleSelectFlowType('ai')}
                    >
                      <CardContent sx={{ textAlign: 'center', py: 4 }}>
                        <Psychology sx={{ fontSize: 60, color: '#10b981', mb: 2 }}/>
                        <Typography variant="h5" fontWeight="bold" gutterBottom>
                          Bot con IA
                        </Typography>
                        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                          Respuestas inteligentes generadas automáticamente con DeepSeek AI
                        </Typography>
                        <Chip label="Recomendado" color="success" size="small"/>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        border: '2px solid transparent',
                        transition: 'all 0.3s',
                        '&:hover': {
                          border: '2px solid #667eea',
                          boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)'
                        }
                      }}
                      onClick={() => handleSelectFlowType('programmed')}
                    >
                      <CardContent sx={{ textAlign: 'center', py: 4 }}>
                        <Code sx={{ fontSize: 60, color: '#667eea', mb: 2 }}/>
                        <Typography variant="h5" fontWeight="bold" gutterBottom>
                          Flujo Programado
                        </Typography>
                        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                          Respuestas basadas en palabras clave predefinidas
                        </Typography>
                        <Chip label="Control Total" color="primary" size="small"/>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* Formulario Completo - Aparece después de elegir tipo o en edición */}
            {(createFlowType !== null || showEditDialog) && (
              <>
                <TextField 
                  fullWidth 
                  label="Nombre del Flujo" 
                  value={showCreateDialog ? newFlow.name : selectedFlow?.name} 
                  onChange={(e) => showCreateDialog 
                    ? setNewFlow({...newFlow, name: e.target.value}) 
                    : setSelectedFlow({...selectedFlow!, name: e.target.value})
                  } 
                  required
                  placeholder="Ej: Atención al Cliente, Preguntas Frecuentes, etc."
                />

                <TextField 
                  fullWidth 
                  label="Descripción" 
                  multiline 
                  rows={2} 
                  value={showCreateDialog ? newFlow.description : selectedFlow?.description} 
                  onChange={(e) => showCreateDialog 
                    ? setNewFlow({...newFlow, description: e.target.value}) 
                    : setSelectedFlow({...selectedFlow!, description: e.target.value})
                  }
                  placeholder="Breve descripción de para qué sirve este flujo"
                />

                <FormControl fullWidth>
                  <InputLabel>📋 Asignar a Kanban (Opcional)</InputLabel>
                  <Select 
                    value={showCreateDialog ? (newFlow.kanbanBoardId || '') : (selectedFlow?.kanbanBoardId || '')} 
                    label="📋 Asignar a Kanban (Opcional)" 
                    onChange={(e) => showCreateDialog 
                      ? setNewFlow({...newFlow, kanbanBoardId: e.target.value || null}) 
                      : setSelectedFlow({...selectedFlow!, kanbanBoardId: e.target.value || null})
                    }
                  >
                    <MenuItem value="">Ninguno</MenuItem>
                    {kanbanBoards.map(board => 
                      <MenuItem key={board.id} value={board.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: board.color }}/>
                          {board.name}
                        </Box>
                      </MenuItem>
                    )}
                  </Select>
                </FormControl>

                <Divider/>

                {/* Configuración según tipo de flujo */}
                {(showCreateDialog ? newFlow.flowType : selectedFlow?.flowType) === 'ai' ? (
                  // FORMULARIO PARA IA
                  <Box>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Psychology/> Configuración del Bot IA
                    </Typography>
                    
                    <Alert severity="info" sx={{ mb: 2 }}>
                      🤖 La IA aprenderá de la información que proporciones para responder automáticamente
                    </Alert>

                    <TextField
                      fullWidth
                      label="Información del Negocio"
                      multiline
                      rows={8}
                      value={showCreateDialog ? (newFlow.aiConfig?.businessData || '') : (selectedFlow?.aiConfig?.businessData || '')}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (showCreateDialog) {
                          setNewFlow({
                            ...newFlow,
                            aiConfig: { ...newFlow.aiConfig!, businessData: value }
                          });
                        } else if (selectedFlow) {
                          setSelectedFlow({
                            ...selectedFlow,
                            aiConfig: { ...selectedFlow.aiConfig!, businessData: value }
                          });
                        }
                      }}
                      placeholder="Ejemplo:&#10;Empresa: Mi Tienda Online&#10;Productos: Ropa, accesorios, calzado&#10;Horarios: Lunes a Viernes 9am-6pm, Sábados 10am-2pm&#10;Dirección: Calle Principal 123, Ciudad&#10;Políticas: Envíos gratis sobre $50, devoluciones 30 días&#10;Formas de pago: Efectivo, tarjetas, transferencia"
                      helperText="Ingresa toda la información relevante de tu negocio"
                      InputProps={{
                        endAdornment: (
                          <IconButton 
                            onClick={(e) => handleEmojiClick(e, 'business')} 
                            size="small"
                          >
                            <EmojiEmotions/>
                          </IconButton>
                        )
                      }}
                    />

                    {/* Campo de URL eliminado - Solo usar el prompt/información manual */}
                  </Box>
                ) : (
                  // FORMULARIO PARA PROGRAMADO
                  <>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Palabras Clave que Activarán el Flujo
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        <TextField 
                          fullWidth 
                          size="small" 
                          placeholder="Escribe una palabra clave..." 
                          value={currentTrigger} 
                          onChange={(e) => setCurrentTrigger(e.target.value)} 
                          onKeyPress={(e) => e.key === 'Enter' && addTrigger()} 
                          InputProps={{
                            endAdornment: (
                              <IconButton 
                                onClick={(e) => handleEmojiClick(e, 'trigger')} 
                                size="small"
                              >
                                <EmojiEmotions/>
                              </IconButton>
                            )
                          }}
                        />
                        <Button variant="contained" onClick={addTrigger}>
                          Agregar
                        </Button>
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                        {(showCreateDialog ? newFlow.triggers : selectedFlow?.triggers)?.map(t => 
                          <Chip 
                            key={t} 
                            label={t} 
                            onDelete={() => removeTrigger(t)} 
                            color="primary"
                          />
                        )}
                      </Box>
                    </Box>

                    <Divider/>

                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Respuestas Automáticas
                      </Typography>
                      
                      <FormControl fullWidth size="small" sx={{ mt: 2 }}>
                        <InputLabel>Tipo de Respuesta</InputLabel>
                        <Select 
                          value={responseType} 
                          label="Tipo de Respuesta" 
                          onChange={(e) => { 
                            setResponseType(e.target.value as any); 
                            setSelectedFile(null); 
                            setCurrentResponse(''); 
                          }}
                        >
                          <MenuItem value="text">📝 Texto</MenuItem>
                          <MenuItem value="menu">📋 Menú de Opciones</MenuItem>
                          <MenuItem value="image">🖼️ Imagen</MenuItem>
                          <MenuItem value="video">🎥 Video</MenuItem>
                          <MenuItem value="document">📄 Documento/PDF</MenuItem>
                          <MenuItem value="url">🔗 Enlace URL</MenuItem>
                        </Select>
                      </FormControl>

                      <Box sx={{ position: 'relative' }}>
                        <TextField 
                          fullWidth 
                          multiline 
                          rows={responseType === 'text' || responseType === 'menu' ? 4 : 2} 
                          placeholder={
                            responseType === 'url' ? 'https://ejemplo.com/enlace' : 
                            responseType === 'text' || responseType === 'menu' ? 'Escribe tu respuesta...' : 
                            'Caption o descripción (opcional)'
                          } 
                          value={currentResponse} 
                          onChange={(e) => setCurrentResponse(e.target.value)} 
                          sx={{ mt: 2 }} 
                          InputProps={{
                            endAdornment: (responseType === 'text' || responseType === 'menu' || responseType === 'url') && (
                              <IconButton 
                                onClick={(e) => handleEmojiClick(e, 'response')} 
                                size="small" 
                                sx={{ position: 'absolute', top: 8, right: 8 }}
                              >
                                <EmojiEmotions/>
                              </IconButton>
                            )
                          }}
                        />
                      </Box>

                      {(responseType === 'image' || responseType === 'video' || responseType === 'document') && (
                        <Box sx={{ mt: 2 }}>
                          <input 
                            ref={fileInputRef} 
                            type="file" 
                            accept={
                              responseType === 'image' ? 'image/*' : 
                              responseType === 'video' ? 'video/mp4,video/quicktime' : 
                              '.pdf,.doc,.docx'
                            } 
                            onChange={handleFileSelect} 
                            style={{ display: 'none' }} 
                            id="file-upload"
                          />
                          <label htmlFor="file-upload">
                            <Button variant="outlined" component="span" fullWidth>
                              {selectedFile 
                                ? `✅ ${selectedFile.name}` 
                                : `📁 Seleccionar ${
                                    responseType === 'image' ? 'Imagen' : 
                                    responseType === 'video' ? 'Video' : 
                                    'Documento'
                                  }`
                              }
                            </Button>
                          </label>
                          {selectedFile && (
                            <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                              Tamaño: {(selectedFile.size / 1024).toFixed(2)} KB
                            </Typography>
                          )}
                        </Box>
                      )}

                      <Button 
                        variant="contained" 
                        onClick={addResponse} 
                        sx={{ mt: 2 }} 
                        disabled={
                          uploadingFile || 
                          ((responseType === 'text' || responseType === 'menu' || responseType === 'url') 
                            ? !currentResponse.trim() 
                            : !selectedFile && !currentResponse.trim())
                        } 
                        startIcon={uploadingFile && <CircularProgress size={20}/>}
                        fullWidth
                      >
                        {uploadingFile ? 'Subiendo...' : 'Agregar Respuesta'}
                      </Button>

                      <List sx={{ mt: 2 }}>
                        {(showCreateDialog ? newFlow.responses : selectedFlow?.responses)?.map((r, idx) => (
                          <ListItem 
                            key={r.id} 
                            secondaryAction={
                              <IconButton edge="end" onClick={() => removeResponse(r.id)}>
                                <Delete/>
                              </IconButton>
                            }
                          >
                            <ListItemText 
                              primary={`${idx+1}. ${r.content.substring(0,50)}${r.content.length > 50 ? '...' : ''}`} 
                              secondary={
                                <Box>
                                  <Chip 
                                    size="small" 
                                    label={
                                      r.type === 'text' ? '📝 Texto' : 
                                      r.type === 'menu' ? '📋 Menú' : 
                                      r.type === 'image' ? '🖼️ Imagen' : 
                                      r.type === 'video' ? '🎥 Video' : 
                                      r.type === 'document' ? '📄 Documento' : 
                                      '🔗 URL'
                                    } 
                                    sx={{ mr: 1 }}
                                  />
                                  {r.fileName && (
                                    <Chip size="small" label={r.fileName} variant="outlined"/>
                                  )}
                                </Box>
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  </>
                )}
              </>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button 
            onClick={() => { 
              setShowCreateDialog(false); 
              setShowEditDialog(false); 
              setSelectedFlow(null); 
              setCreateFlowType(null);
              resetNewFlow(); 
            }}
          >
            Cancelar
          </Button>
          
          {createFlowType !== null || showEditDialog ? (
            <Button 
              variant="contained" 
              onClick={showCreateDialog ? handleCreateFlow : handleUpdateFlow} 
              disabled={loading}
              startIcon={<Save/>}
            >
              {showCreateDialog ? 'Crear Flujo' : 'Guardar Cambios'}
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>

      {/* Emoji Picker */}
      <Popover 
        open={showEmojiPicker} 
        anchorEl={emojiAnchorEl} 
        onClose={() => setShowEmojiPicker(false)} 
        anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
      >
        <EmojiPicker onEmojiClick={handleEmojiSelect} width={350} height={450}/>
      </Popover>

      {/* Snackbar de Notificaciones */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{ mt: 8 }}
      >
        <Alert 
          onClose={handleCloseNotification} 
          severity={notification.severity}
          variant="filled"
          icon={
            notification.severity === 'success' ? <CheckCircle /> :
            notification.severity === 'error' ? <ErrorIcon /> :
            notification.severity === 'warning' ? <WarningIcon /> :
            <InfoIcon />
          }
          sx={{ 
            width: '100%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            fontSize: '1rem',
            fontWeight: 500,
            '& .MuiAlert-icon': {
              fontSize: '1.5rem'
            }
          }}
        >
          {notification.message}
        </Alert>
      </Snackbar>

      {/* Dialog de Confirmación de Eliminación */}
      <Dialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}>
          <WarningIcon sx={{ fontSize: 32 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Eliminar Flujo
            </Typography>
            <Typography variant="caption">
              Esta acción no se puede deshacer
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 3 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
              ⚠️ ¿Estás seguro de eliminar este flujo?
            </Typography>
            <Typography variant="body2">
              Se eliminará permanentemente el flujo y todas sus configuraciones.
            </Typography>
          </Alert>
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            El chatbot dejará de responder según este flujo.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button
            onClick={() => setShowDeleteDialog(false)}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Cancelar
          </Button>
          <Button
            onClick={confirmDeleteFlow}
            variant="contained"
            color="error"
            startIcon={<Delete />}
            sx={{ 
              borderRadius: 2,
              background: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #d32f2f 0%, #c62828 100%)',
              }
            }}
          >
            Eliminar Flujo
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ChatbotModule;
