import React, { useState, useEffect, useRef } from 'react';
import { getAPIBaseURL } from '../utils/socketConfig';
import { Box, Grid, Card, CardContent, Typography, Button, TextField, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Paper, FormControl, InputLabel, Select, MenuItem, Stack, Chip, Alert, Tabs, Tab, List, ListItem, ListItemText, Switch, FormControlLabel, Divider, Tooltip, CircularProgress, Popover, Snackbar } from '@mui/material';
import { SmartToy, Add, Edit, Delete, Save, PlayArrow, Pause, Settings, Analytics, QuestionAnswer, Message, ExpandMore, Refresh, ContentCopy, Speed, CheckCircle, RestartAlt, EmojiEmotions, Close, Error as ErrorIcon, Warning as WarningIcon, Info as InfoIcon, Psychology } from '@mui/icons-material';
import EmojiPicker from 'emoji-picker-react';
import { SubscriptionGuard } from '../components/SubscriptionGuard';

interface ChatbotModuleProps { sessionId: string; }
interface ChatbotFlow { id: string; name: string; description: string; active: boolean; triggers: string[]; responses: Response[]; kanbanBoardId?: string | null; createdAt: string; stats: { totalTriggers: number; successRate: number; }; }
interface Response { id: string; type: 'text'|'menu'|'image'|'video'|'document'|'url'; content: string; delay?: number; options?: MenuOption[]; mediaUrl?: string; fileName?: string; }
interface MenuOption { id: string; text: string; action: 'reply'|'flow'|'agent'; value: string; }
interface BotSettings {
  enabled: boolean;
  workingHours: { enabled: boolean; start: string; end: string; days: number[]; };
  fallbackMessage: string;
  transferToAgent: boolean;
  aiEnabled: boolean;
  responseDelay: number;
  botMode: 'flows' | 'ai';
  aiConfig?: {
    businessData: string;
    websiteUrl: string;
    scrapedContent: string;
    temperature: number;
    maxTokens: number;
  };
}
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
  const [newFlow, setNewFlow] = useState<Partial<ChatbotFlow>>({ name: '', description: '', active: true, triggers: [], responses: [], kanbanBoardId: null });
  const [settings, setSettings] = useState<BotSettings>({
    enabled: false,
    workingHours: { enabled: false, start: '09:00', end: '18:00', days: [1,2,3,4,5] },
    fallbackMessage: 'Lo siento, no entiendo tu mensaje.',
    transferToAgent: true,
    aiEnabled: false,
    responseDelay: 1000,
    botMode: 'flows',
    aiConfig: {
      businessData: '',
      websiteUrl: '',
      scrapedContent: '',
      temperature: 0.7,
      maxTokens: 500
    }
  });
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
  const [scrapingUrl, setScrapingUrl] = useState(false);

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
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/chatbot/settings/${sessionId}`);
      const data = await response.json();
      if (data.success && data.settings) setSettings(data.settings);
    } catch (error) {
      console.error('Error:', error);
    }
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

  const handleScrapeUrl = async () => {
    if (!settings.aiConfig?.websiteUrl) {
      showNotification('⚠️ Ingresa una URL válida', 'warning');
      return;
    }

    setScrapingUrl(true);
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/chatbot/scrape-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: settings.aiConfig.websiteUrl })
      });

      const data = await response.json();
      if (data.success) {
        setSettings({
          ...settings,
          aiConfig: {
            ...settings.aiConfig!,
            scrapedContent: data.content
          }
        });
        showNotification('✅ Contenido extraído exitosamente', 'success');
      } else {
        showNotification('❌ Error al extraer contenido', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showNotification('❌ Error al procesar la URL', 'error');
    } finally {
      setScrapingUrl(false);
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

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: 3, p: 3, color: 'white' }}>
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>🤖 Chatbot Inteligente</Typography>
          <Typography variant="h6" sx={{ opacity: 0.9, fontWeight: 300 }}>
            {settings.botMode === 'ai' ? 'Respuestas con IA • DeepSeek • Analytics' : 'Respuestas Automáticas • Flujos Personalizados • Analytics'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Chip
            icon={settings.enabled ? <CheckCircle/> : <Pause/>}
            label={settings.enabled ? 'Activo' : 'Pausado'}
            color={settings.enabled ? 'success' : 'default'}
            sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}
          />
          {settings.botMode === 'ai' && (
            <Chip
              icon={<Psychology/>}
              label="Modo IA"
              color="success"
              sx={{ bgcolor: 'rgba(16, 185, 129, 0.3)' }}
            />
          )}
        </Box>
      </Box>

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

      <Paper sx={{ mb: 3 }}>
        <Tabs value={selectedTab} onChange={(_, val) => setSelectedTab(val)}>
          <Tab label="Configuración" icon={<Settings/>} iconPosition="start"/>
          <Tab label="Flujos" icon={<SmartToy/>} iconPosition="start" disabled={settings.botMode === 'ai'}/>
          <Tab label="Analytics" icon={<Analytics/>} iconPosition="start"/>
        </Tabs>
      </Paper>

      {selectedTab === 0 && (
        <Card elevation={3}>
          <CardContent>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
              ⚙️ Configuración del Chatbot
            </Typography>

            <Stack spacing={4} sx={{ mt: 3 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.enabled}
                    onChange={(e) => setSettings({...settings, enabled: e.target.checked})}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1" fontWeight="bold">Habilitar Chatbot</Typography>
                    <Typography variant="caption" color="textSecondary">
                      El bot responderá automáticamente a los mensajes
                    </Typography>
                  </Box>
                }
              />

              <Divider />

              <Box>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  🤖 Modo del Chatbot
                </Typography>
                <Paper sx={{ p: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Paper
                        elevation={settings.botMode === 'flows' ? 3 : 0}
                        sx={{
                          p: 3,
                          cursor: 'pointer',
                          border: settings.botMode === 'flows' ? '2px solid #667eea' : '2px solid transparent',
                          bgcolor: settings.botMode === 'flows' ? '#f0f4ff' : 'white',
                          transition: 'all 0.3s',
                          '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 }
                        }}
                        onClick={() => setSettings({...settings, botMode: 'flows'})}
                      >
                        <Box sx={{ textAlign: 'center' }}>
                          <SmartToy sx={{ fontSize: 48, color: settings.botMode === 'flows' ? '#667eea' : '#94a3b8', mb: 1 }} />
                          <Typography variant="h6" fontWeight="bold">Flujos Programados</Typography>
                          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                            Respuestas basadas en palabras clave y flujos predefinidos
                          </Typography>
                        </Box>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Paper
                        elevation={settings.botMode === 'ai' ? 3 : 0}
                        sx={{
                          p: 3,
                          cursor: 'pointer',
                          border: settings.botMode === 'ai' ? '2px solid #10b981' : '2px solid transparent',
                          bgcolor: settings.botMode === 'ai' ? '#f0fdf4' : 'white',
                          transition: 'all 0.3s',
                          '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 }
                        }}
                        onClick={() => setSettings({...settings, botMode: 'ai'})}
                      >
                        <Box sx={{ textAlign: 'center' }}>
                          <Psychology sx={{ fontSize: 48, color: settings.botMode === 'ai' ? '#10b981' : '#94a3b8', mb: 1 }} />
                          <Typography variant="h6" fontWeight="bold">Bot con IA</Typography>
                          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                            Respuestas inteligentes generadas por DeepSeek IA
                          </Typography>
                        </Box>
                      </Paper>
                    </Grid>
                  </Grid>
                </Paper>
              </Box>

              {settings.botMode === 'ai' && (
                <Box>
                  <Alert severity="info" sx={{ mb: 3 }}>
                    <Typography variant="body2" fontWeight="bold" gutterBottom>
                      🚀 Modo Inteligencia Artificial Activado
                    </Typography>
                    <Typography variant="body2">
                      El bot utilizará DeepSeek IA para generar respuestas contextuales basadas en la información de tu negocio.
                    </Typography>
                  </Alert>

                  <Stack spacing={3}>
                    <Box>
                      <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        📝 Información de tu Negocio
                        <Chip label="Recomendado" size="small" color="primary" />
                      </Typography>
                      <TextField
                        fullWidth
                        multiline
                        rows={8}
                        placeholder={`Pega aquí toda la información de tu negocio:
• Nombre y descripción de la empresa
• Productos o servicios que ofreces
• Horarios de atención
• Políticas de devolución/garantía
• Precios y promociones
• Datos de contacto
• Preguntas frecuentes
• Cualquier información que quieras que el bot sepa...`}
                        value={settings.aiConfig?.businessData || ''}
                        onChange={(e) => setSettings({
                          ...settings,
                          aiConfig: { ...settings.aiConfig!, businessData: e.target.value }
                        })}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            fontFamily: 'monospace',
                            fontSize: '0.9rem'
                          }
                        }}
                      />
                      <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                        💡 Cuanta más información proporciones, mejores serán las respuestas del bot
                      </Typography>
                    </Box>

                    <Divider>O</Divider>

                    <Box>
                      <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        🌐 URL de tu Sitio Web
                        <Chip label="Opcional" size="small" variant="outlined" />
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField
                          fullWidth
                          placeholder="https://www.tu-empresa.com"
                          value={settings.aiConfig?.websiteUrl || ''}
                          onChange={(e) => setSettings({
                            ...settings,
                            aiConfig: { ...settings.aiConfig!, websiteUrl: e.target.value }
                          })}
                          helperText="El bot extraerá automáticamente la información de tu sitio web"
                        />
                        <Button
                          variant="contained"
                          onClick={handleScrapeUrl}
                          disabled={scrapingUrl || !settings.aiConfig?.websiteUrl}
                          startIcon={scrapingUrl ? <CircularProgress size={20} /> : <Refresh />}
                          sx={{ minWidth: 150 }}
                        >
                          {scrapingUrl ? 'Extrayendo...' : 'Extraer Info'}
                        </Button>
                      </Box>
                      {settings.aiConfig?.scrapedContent && (
                        <Alert severity="success" sx={{ mt: 2 }}>
                          ✅ Contenido extraído: {settings.aiConfig.scrapedContent.length} caracteres
                        </Alert>
                      )}
                    </Box>

                    <Box>
                      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                        ⚙️ Configuración Avanzada
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Creatividad (Temperature)"
                            value={settings.aiConfig?.temperature || 0.7}
                            onChange={(e) => setSettings({
                              ...settings,
                              aiConfig: { ...settings.aiConfig!, temperature: parseFloat(e.target.value) }
                            })}
                            inputProps={{ min: 0, max: 1, step: 0.1 }}
                            helperText="0 = más preciso, 1 = más creativo"
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Tokens Máximos"
                            value={settings.aiConfig?.maxTokens || 500}
                            onChange={(e) => setSettings({
                              ...settings,
                              aiConfig: { ...settings.aiConfig!, maxTokens: parseInt(e.target.value) }
                            })}
                            inputProps={{ min: 100, max: 2000, step: 100 }}
                            helperText="Longitud máxima de respuesta"
                          />
                        </Grid>
                      </Grid>
                    </Box>
                  </Stack>
                </Box>
              )}

              <Divider />

              <Box>
                <TextField
                  fullWidth
                  label="Mensaje de Fallback"
                  multiline
                  rows={3}
                  value={settings.fallbackMessage}
                  onChange={(e) => setSettings({...settings, fallbackMessage: e.target.value})}
                  helperText={settings.botMode === 'ai'
                    ? "Este mensaje se enviará si la IA no puede generar una respuesta"
                    : "Este mensaje se enviará si no se encuentra un flujo correspondiente"
                  }
                  InputProps={{
                    endAdornment: (
                      <IconButton onClick={(e) => handleEmojiClick(e, 'fallback')} size="small">
                        <EmojiEmotions />
                      </IconButton>
                    )
                  }}
                />
              </Box>

              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', pt: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<RestartAlt />}
                  onClick={() => loadSettings()}
                >
                  Descartar Cambios
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={handleSaveSettings}
                  disabled={loading}
                  size="large"
                  sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)'
                    }
                  }}
                >
                  {loading ? 'Guardando...' : 'Guardar Configuración'}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      )}

      {selectedTab === 1 && (
        <Box>
          <Typography variant="h6">Flujos de Chatbot (Solo disponible en modo Flujos)</Typography>
        </Box>
      )}

      {selectedTab === 2 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>📊 Analíticas</Typography>
            <Alert severity="info" sx={{ mb: 3 }}>Las métricas se actualizan en tiempo real</Alert>
          </CardContent>
        </Card>
      )}

      <Popover open={showEmojiPicker} anchorEl={emojiAnchorEl} onClose={() => setShowEmojiPicker(false)} anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}>
        <EmojiPicker onEmojiClick={handleEmojiSelect} width={350} height={450}/>
      </Popover>

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
            fontWeight: 500
          }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ChatbotModule;
