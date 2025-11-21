import React, { useState, useEffect, useRef } from 'react';
import { getAPIBaseURL } from '../utils/socketConfig';
import { Box, Grid, Card, CardContent, Typography, Button, TextField, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Paper, FormControl, InputLabel, Select, MenuItem, Stack, Chip, Alert, Tabs, Tab, List, ListItem, ListItemText, Switch, FormControlLabel, Divider, Tooltip, CircularProgress, Popover, Snackbar } from '@mui/material';
import { SmartToy, Add, Edit, Delete, Save, PlayArrow, Pause, Settings, Analytics, QuestionAnswer, Message, ExpandMore, Refresh, ContentCopy, Speed, CheckCircle, RestartAlt, EmojiEmotions, Close, Error as ErrorIcon, Warning as WarningIcon, Info as InfoIcon } from '@mui/icons-material';
import EmojiPicker from 'emoji-picker-react';
import { SubscriptionGuard } from '../components/SubscriptionGuard';

interface ChatbotModuleProps { sessionId: string; }
interface ChatbotFlow { id: string; name: string; description: string; active: boolean; triggers: string[]; responses: Response[]; kanbanBoardId?: string | null; createdAt: string; stats: { totalTriggers: number; successRate: number; }; }
interface Response { id: string; type: 'text'|'menu'|'image'|'video'|'document'|'url'; content: string; delay?: number; options?: MenuOption[]; mediaUrl?: string; fileName?: string; }
interface MenuOption { id: string; text: string; action: 'reply'|'flow'|'agent'; value: string; }
interface BotSettings { enabled: boolean; workingHours: { enabled: boolean; start: string; end: string; days: number[]; }; fallbackMessage: string; transferToAgent: boolean; aiEnabled: boolean; responseDelay: number; }
interface KanbanBoard { id: string; name: string; color: string; is_default: boolean; }

const ChatbotModule: React.FC<ChatbotModuleProps> = ({ sessionId }) => {
  // SubscriptionGuard temporalmente deshabilitado para debugging
  return <ChatbotModuleContent sessionId={sessionId} />;
};

const ChatbotModuleContent: React.FC<ChatbotModuleProps> = ({ sessionId }) => {
  const [flows, setFlows] = useState<ChatbotFlow[]>([]);
  const [selectedTab, setSelectedTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<ChatbotFlow|null>(null);
  const [newFlow, setNewFlow] = useState<Partial<ChatbotFlow>>({ name: '', description: '', active: true, triggers: [], responses: [], kanbanBoardId: null });
  const [settings, setSettings] = useState<BotSettings>({ enabled: false, workingHours: { enabled: false, start: '09:00', end: '18:00', days: [1,2,3,4,5] }, fallbackMessage: 'Lo siento, no entiendo tu mensaje.', transferToAgent: true, aiEnabled: false, responseDelay: 1000 });
  const [currentTrigger, setCurrentTrigger] = useState('');
  const [currentResponse, setCurrentResponse] = useState('');
  const [responseType, setResponseType] = useState<'text'|'menu'|'image'|'video'|'document'|'url'>('text');
  const [menuOptions, setMenuOptions] = useState<MenuOption[]>([]);
  const [newMenuOption, setNewMenuOption] = useState({ text: '', action: 'reply', value: '' });
  const [stats, setStats] = useState({ totalInteractions: 0, successfulResponses: 0, transferredToAgent: 0, avgResponseTime: 0 });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiAnchorEl, setEmojiAnchorEl] = useState<HTMLElement | null>(null);
  const [emojiTarget, setEmojiTarget] = useState<'trigger' | 'response' | 'fallback'>('response');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notification, setNotification] = useState<{open: boolean; message: string; severity: 'success'|'error'|'warning'|'info'}>({
    open: false,
    message: '',
    severity: 'info'
  });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [flowToDelete, setFlowToDelete] = useState<string | null>(null);
  const [kanbanBoards, setKanbanBoards] = useState<KanbanBoard[]>([]);

  useEffect(() => { loadFlows(); loadSettings(); loadStats(); loadKanbanBoards(); }, [sessionId]);

  const showNotification = (message: string, severity: 'success'|'error'|'warning'|'info' = 'info') => {
    setNotification({ open: true, message, severity });
  };

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  const loadFlows = async () => {
    try { setLoading(true); const response = await fetch(`${getAPIBaseURL()}/api/chatbot/flows/${sessionId}`); const data = await response.json(); if (data.success) setFlows(data.flows || []); } catch (error) { console.error('Error:', error); } finally { setLoading(false); }
  };
  const loadSettings = async () => {
    try { const response = await fetch(`${getAPIBaseURL()}/api/chatbot/settings/${sessionId}`); const data = await response.json(); if (data.success && data.settings) setSettings(data.settings); } catch (error) { console.error('Error:', error); }
  };
  const loadStats = async () => {
    try { const response = await fetch(`${getAPIBaseURL()}/api/chatbot/stats/${sessionId}`); const data = await response.json(); if (data.success) setStats(data.stats || stats); } catch (error) { console.error('Error:', error); }
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
    if (!newFlow.name || !newFlow.triggers?.length || !newFlow.responses?.length) { 
      showNotification('⚠️ Completa todos los campos requeridos', 'warning'); 
      return; 
    }
    try { 
      setLoading(true); 
      const response = await fetch(`${getAPIBaseURL()}/api/chatbot/flows/${sessionId}`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ ...newFlow, createdAt: new Date().toISOString(), stats: { totalTriggers: 0, successRate: 0 } }) 
      }); 
      const data = await response.json(); 
      if (data.success) { 
        await loadFlows(); 
        setShowCreateDialog(false); 
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
    try { const response = await fetch(`${getAPIBaseURL()}/api/chatbot/flows/${sessionId}/${flowId}/toggle`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) }); const data = await response.json(); if (data.success) await loadFlows(); } catch (error) { console.error('Error:', error); }
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
    if (showCreateDialog) { setNewFlow({ ...newFlow, triggers: [...(newFlow.triggers||[]), currentTrigger.toLowerCase().trim()] }); } else if (selectedFlow) { setSelectedFlow({ ...selectedFlow, triggers: [...selectedFlow.triggers, currentTrigger.toLowerCase().trim()] }); }
    setCurrentTrigger('');
  };
  const removeTrigger = (trigger: string) => {
    if (showCreateDialog) { setNewFlow({ ...newFlow, triggers: (newFlow.triggers||[]).filter(t => t !== trigger) }); } else if (selectedFlow) { setSelectedFlow({ ...selectedFlow, triggers: selectedFlow.triggers.filter(t => t !== trigger) }); }
  };
  const addResponse = async () => {
    // Para archivos multimedia, el texto es opcional
    const needsText = (responseType === 'text' || responseType === 'menu' || responseType === 'url');
    if (needsText && !currentResponse.trim()) return;
    if (!needsText && !selectedFile && !currentResponse.trim()) return;
    
    setUploadingFile(true);
    try {
      let mediaUrl = '';
      let fileName = '';
      
      // Si hay archivo seleccionado, subirlo primero
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
    if (showCreateDialog) { setNewFlow({ ...newFlow, responses: (newFlow.responses||[]).filter(r => r.id !== responseId) }); } else if (selectedFlow) { setSelectedFlow({ ...selectedFlow, responses: selectedFlow.responses.filter(r => r.id !== responseId) }); }
  };
  const addMenuOption = () => {
    if (!newMenuOption.text || !newMenuOption.value) return;
    setMenuOptions([...menuOptions, { id: Date.now().toString(), ...newMenuOption, action: newMenuOption.action as any }]);
    setNewMenuOption({ text: '', action: 'reply', value: '' });
  };
  const removeMenuOption = (optionId: string) => setMenuOptions(menuOptions.filter(o => o.id !== optionId));
  const resetNewFlow = () => { setNewFlow({ name: '', description: '', active: true, triggers: [], responses: [], kanbanBoardId: null }); setCurrentTrigger(''); setCurrentResponse(''); setMenuOptions([]); };
  const dayNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  
  const handleEmojiClick = (event: any, target: 'trigger' | 'response' | 'fallback') => {
    setEmojiAnchorEl(event.currentTarget);
    setEmojiTarget(target);
    setShowEmojiPicker(true);
  };
  
  const handleEmojiSelect = (emojiObject: any) => {
    if (emojiTarget === 'trigger') {
      setCurrentTrigger(currentTrigger + emojiObject.emoji);
    } else if (emojiTarget === 'response') {
      setCurrentResponse(currentResponse + emojiObject.emoji);
    } else if (emojiTarget === 'fallback') {
      setSettings({...settings, fallbackMessage: settings.fallbackMessage + emojiObject.emoji});
    }
    setShowEmojiPicker(false);
  };
  
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar tamaño (máximo 10MB)
      if (file.size > 10 * 1024 * 1024) {
        showNotification('⚠️ El archivo es muy grande. Máximo 10MB', 'warning');
        return;
      }
      
      // Validar tipo según el tipo de respuesta seleccionado
      const validTypes: { [key: string]: string[] } = {
        image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        video: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
        document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      };
      
      if (responseType !== 'text' && responseType !== 'menu' && responseType !== 'url') {
        const allowed = validTypes[responseType] || [];
        if (!allowed.includes(file.type)) {
          showNotification(`⚠️ Tipo de archivo no válido para ${responseType}`, 'warning');
          return;
        }
      }
      
      setSelectedFile(file);
      // No agregar texto automático, dejar que el usuario decida
    }
  };
  
  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${getAPIBaseURL()}/api/upload`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error('Error subiendo archivo');
    }
    
    const data = await response.json();
    return data.url || data.path;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: 3, p: 3, color: 'white' }}>
        <Box><Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>🤖 Chatbot Inteligente</Typography><Typography variant="h6" sx={{ opacity: 0.9, fontWeight: 300 }}>Respuestas Automáticas • Flujos Personalizados • Analytics</Typography></Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}><Chip icon={settings.enabled ? <CheckCircle/> : <Pause/>} label={settings.enabled ? 'Activo' : 'Pausado'} color={settings.enabled ? 'success' : 'default'} sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}/><Button variant="contained" startIcon={<Add/>} onClick={() => setShowCreateDialog(true)} sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}>Nuevo Flujo</Button></Box>
      </Box>
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {[ { value: stats.totalInteractions, label: 'Interacciones', icon: Message, color: '#667eea' }, { value: stats.successfulResponses, label: 'Exitosas', icon: CheckCircle, color: '#10b981' }, { value: stats.transferredToAgent, label: 'Transferencias', icon: QuestionAnswer, color: '#f59e0b' }, { value: `${stats.avgResponseTime}s`, label: 'Tiempo Promedio', icon: Speed, color: '#8b5cf6' } ].map((stat, i) => (
          <Grid item xs={12} md={3} key={i}><Card><CardContent><Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><Box><Typography variant="h4" sx={{ fontWeight: 700, color: stat.color }}>{stat.value}</Typography><Typography variant="body2" color="textSecondary">{stat.label}</Typography></Box><stat.icon sx={{ fontSize: 40, color: stat.color, opacity: 0.3 }}/></Box></CardContent></Card></Grid>
        ))}
      </Grid>
      <Paper sx={{ mb: 3 }}><Tabs value={selectedTab} onChange={(_, val) => setSelectedTab(val)}><Tab label="Flujos" icon={<SmartToy/>} iconPosition="start"/><Tab label="Analytics" icon={<Analytics/>} iconPosition="start"/><Tab label="Configuración" icon={<Settings/>} iconPosition="start"/></Tabs></Paper>
      {selectedTab === 0 && (
        <Box>
          {loading ? (<Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress/></Box>) : flows.length === 0 ? (
            <Paper sx={{ p: 8, textAlign: 'center' }}><SmartToy sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }}/><Typography variant="h5" gutterBottom>No hay flujos creados</Typography><Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>Crea tu primer flujo de conversación</Typography><Button variant="contained" startIcon={<Add/>} onClick={() => setShowCreateDialog(true)} size="large">Crear Primer Flujo</Button></Paper>
          ) : (
            <Grid container spacing={3}>
              {flows.map((flow) => (
                <Grid item xs={12} md={6} key={flow.id}><Card elevation={3}><CardContent><Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}><Box sx={{ flex: 1 }}><Typography variant="h6" fontWeight="bold">{flow.name}</Typography><Typography variant="body2" color="textSecondary">{flow.description}</Typography></Box><FormControlLabel control={<Switch checked={flow.active} onChange={(e) => handleToggleFlow(flow.id, e.target.checked)}/>} label=""/></Box><Divider sx={{ my: 2 }}/><Box sx={{ mb: 2 }}><Typography variant="caption" color="textSecondary">Palabras clave ({flow.triggers.length}):</Typography><Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>{flow.triggers.slice(0, 5).map(trigger => <Chip key={trigger} label={trigger} size="small"/>)}{flow.triggers.length > 5 && <Chip label={`+${flow.triggers.length-5}`} size="small"/>}</Box></Box><Box sx={{ mb: 2 }}><Typography variant="caption" color="textSecondary">Respuestas ({flow.responses.length}):</Typography><Stack direction="row" spacing={1} sx={{ mt: 1 }}>{flow.responses.map(r => <Chip key={r.id} icon={<Message/>} label={r.type} size="small" color="primary" variant="outlined"/>)}</Stack></Box><Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between', alignItems: 'center' }}><Box><Typography variant="caption" color="textSecondary">{flow.stats.totalTriggers} activaciones</Typography><Typography variant="caption" color="success.main" sx={{ ml: 2 }}>{flow.stats.successRate}% éxito</Typography></Box><Box><Tooltip title="Editar"><IconButton size="small" onClick={() => { setSelectedFlow(flow); setShowEditDialog(true); }}><Edit/></IconButton></Tooltip><Tooltip title="Duplicar"><IconButton size="small"><ContentCopy/></IconButton></Tooltip><Tooltip title="Eliminar"><IconButton size="small" color="error" onClick={() => handleDeleteFlow(flow.id)}><Delete/></IconButton></Tooltip></Box></Box></CardContent></Card></Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}
      {selectedTab === 1 && (<Card><CardContent><Typography variant="h6" gutterBottom>📊 Rendimiento</Typography><Alert severity="info" sx={{ mb: 3 }}>Las métricas se actualizan en tiempo real</Alert><Grid container spacing={3}><Grid item xs={12} md={6}><Paper sx={{ p: 3 }}><Typography variant="subtitle2" gutterBottom>Flujos Más Activos</Typography><List>{flows.sort((a,b) => b.stats.totalTriggers - a.stats.totalTriggers).slice(0,5).map(flow => (<ListItem key={flow.id}><ListItemText primary={flow.name} secondary={`${flow.stats.totalTriggers} activaciones - ${flow.stats.successRate}% éxito`}/><Chip label={flow.active ? 'Activo' : 'Pausado'} size="small" color={flow.active ? 'success' : 'default'}/></ListItem>))}</List></Paper></Grid></Grid></CardContent></Card>)}
      {selectedTab === 2 && (<Card><CardContent><Typography variant="h6" gutterBottom>⚙️ Configuración</Typography><Stack spacing={3} sx={{ mt: 3 }}><FormControlLabel control={<Switch checked={settings.enabled} onChange={(e) => setSettings({...settings, enabled: e.target.checked})}/>} label={<Box><Typography variant="body1" fontWeight="bold">Habilitar Chatbot</Typography><Typography variant="caption" color="textSecondary">El bot responderá automáticamente</Typography></Box>}/><Divider/><Box><TextField fullWidth label="Mensaje de Fallback" multiline rows={3} value={settings.fallbackMessage} onChange={(e) => setSettings({...settings, fallbackMessage: e.target.value})} InputProps={{endAdornment: <IconButton onClick={(e) => handleEmojiClick(e, 'fallback')} size="small"><EmojiEmotions/></IconButton>}}/></Box><Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}><Button variant="outlined" startIcon={<RestartAlt/>}>Restablecer</Button><Button variant="contained" startIcon={<Save/>} onClick={handleSaveSettings} disabled={loading}>Guardar</Button></Box></Stack></CardContent></Card>)}
      <Dialog open={showCreateDialog || showEditDialog} onClose={() => { setShowCreateDialog(false); setShowEditDialog(false); setSelectedFlow(null); resetNewFlow(); }} maxWidth="md" fullWidth><DialogTitle>{showCreateDialog ? '🤖 Crear Flujo' : '✏️ Editar Flujo'}</DialogTitle><DialogContent><Stack spacing={3} sx={{ mt: 2 }}><TextField fullWidth label="Nombre" value={showCreateDialog ? newFlow.name : selectedFlow?.name} onChange={(e) => showCreateDialog ? setNewFlow({...newFlow, name: e.target.value}) : setSelectedFlow({...selectedFlow!, name: e.target.value})} required/><TextField fullWidth label="Descripción" multiline rows={2} value={showCreateDialog ? newFlow.description : selectedFlow?.description} onChange={(e) => showCreateDialog ? setNewFlow({...newFlow, description: e.target.value}) : setSelectedFlow({...selectedFlow!, description: e.target.value})}/><FormControl fullWidth><InputLabel>📋 Kanban (Opcional)</InputLabel><Select value={showCreateDialog ? (newFlow.kanbanBoardId || '') : (selectedFlow?.kanbanBoardId || '')} label="📋 Kanban (Opcional)" onChange={(e) => showCreateDialog ? setNewFlow({...newFlow, kanbanBoardId: e.target.value || null}) : setSelectedFlow({...selectedFlow!, kanbanBoardId: e.target.value || null})}><MenuItem value="">Ninguno</MenuItem>{kanbanBoards.map(board => <MenuItem key={board.id} value={board.id}><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: board.color }}/>{board.name}</Box></MenuItem>)}</Select></FormControl><Box><Typography variant="subtitle2" gutterBottom>Palabras Clave</Typography><Box sx={{ display: 'flex', gap: 1, mt: 1 }}><TextField fullWidth size="small" placeholder="palabra..." value={currentTrigger} onChange={(e) => setCurrentTrigger(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addTrigger()} InputProps={{endAdornment: <IconButton onClick={(e) => handleEmojiClick(e, 'trigger')} size="small"><EmojiEmotions/></IconButton>}}/><Button variant="contained" onClick={addTrigger}>Agregar</Button></Box><Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>{(showCreateDialog ? newFlow.triggers : selectedFlow?.triggers)?.map(t => <Chip key={t} label={t} onDelete={() => removeTrigger(t)} color="primary"/>)}</Box></Box><Divider/><Box><Typography variant="subtitle2" gutterBottom>Respuestas</Typography><FormControl fullWidth size="small" sx={{ mt: 2 }}><InputLabel>Tipo</InputLabel><Select value={responseType} label="Tipo" onChange={(e) => { setResponseType(e.target.value as any); setSelectedFile(null); setCurrentResponse(''); }}><MenuItem value="text">📝 Texto</MenuItem><MenuItem value="menu">📋 Menú</MenuItem><MenuItem value="image">🖼️ Imagen</MenuItem><MenuItem value="video">🎥 Video</MenuItem><MenuItem value="document">📄 Documento/PDF</MenuItem><MenuItem value="url">🔗 URL</MenuItem></Select></FormControl><Box sx={{ position: 'relative' }}><TextField fullWidth multiline rows={responseType === 'text' || responseType === 'menu' ? 4 : 2} placeholder={responseType === 'url' ? 'https://ejemplo.com/enlace' : responseType === 'text' || responseType === 'menu' ? 'Escribe tu respuesta...' : 'Caption o descripción (opcional - dejar vacío para enviar solo el archivo)'} value={currentResponse} onChange={(e) => setCurrentResponse(e.target.value)} sx={{ mt: 2 }} InputProps={{endAdornment: (responseType === 'text' || responseType === 'menu' || responseType === 'url') && <IconButton onClick={(e) => handleEmojiClick(e, 'response')} size="small" sx={{ position: 'absolute', top: 8, right: 8 }}><EmojiEmotions/></IconButton>}}/></Box>{(responseType === 'image' || responseType === 'video' || responseType === 'document') && (<Box sx={{ mt: 2 }}><input ref={fileInputRef} type="file" accept={responseType === 'image' ? 'image/*' : responseType === 'video' ? 'video/mp4,video/quicktime' : '.pdf,.doc,.docx'} onChange={handleFileSelect} style={{ display: 'none' }} id="file-upload"/><label htmlFor="file-upload"><Button variant="outlined" component="span" fullWidth>{selectedFile ? `✅ ${selectedFile.name}` : `📁 Seleccionar ${responseType === 'image' ? 'Imagen' : responseType === 'video' ? 'Video' : 'Documento'}`}</Button></label>{selectedFile && <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>Tamaño: {(selectedFile.size / 1024).toFixed(2)} KB</Typography>}</Box>)}<Button variant="contained" onClick={addResponse} sx={{ mt: 2 }} disabled={uploadingFile || ((responseType === 'text' || responseType === 'menu' || responseType === 'url') ? !currentResponse.trim() : !selectedFile && !currentResponse.trim())} startIcon={uploadingFile && <CircularProgress size={20}/>}>{uploadingFile ? 'Subiendo...' : 'Agregar Respuesta'}</Button><List sx={{ mt: 2 }}>{(showCreateDialog ? newFlow.responses : selectedFlow?.responses)?.map((r, idx) => (<ListItem key={r.id} secondaryAction={<IconButton edge="end" onClick={() => removeResponse(r.id)}><Delete/></IconButton>}><ListItemText primary={`${idx+1}. ${r.content.substring(0,50)}${r.content.length > 50 ? '...' : ''}`} secondary={<Box><Chip size="small" label={r.type === 'text' ? '📝 Texto' : r.type === 'menu' ? '📋 Menú' : r.type === 'image' ? '🖼️ Imagen' : r.type === 'video' ? '🎥 Video' : r.type === 'document' ? '📄 Documento' : '🔗 URL'} sx={{ mr: 1 }}/>{r.fileName && <Chip size="small" label={r.fileName} variant="outlined"/>}</Box>}/></ListItem>))}</List></Box></Stack></DialogContent><DialogActions><Button onClick={() => { setShowCreateDialog(false); setShowEditDialog(false); setSelectedFlow(null); resetNewFlow(); }}>Cancelar</Button><Button variant="contained" onClick={showCreateDialog ? handleCreateFlow : handleUpdateFlow} disabled={loading}>{showCreateDialog ? 'Crear' : 'Guardar'}</Button></DialogActions></Dialog>
      <Popover open={showEmojiPicker} anchorEl={emojiAnchorEl} onClose={() => setShowEmojiPicker(false)} anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}><EmojiPicker onEmojiClick={handleEmojiSelect} width={350} height={450}/></Popover>
      
      {/* Notificaciones Estilizadas */}
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
            El chatbot dejará de responder a las palabras clave asociadas a este flujo.
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
