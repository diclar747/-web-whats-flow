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
  IconButton,
  Alert,
  Chip,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Tooltip,
  CircularProgress,
  Divider,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  VpnKey,
  ContentCopy,
  Delete,
  Add,
  PlayArrow,
  ExpandMore,
  Visibility,
  VisibilityOff,
  Api,
  Image,
  AttachFile,
  AudioFile,
  VideoFile,
  QrCode,
  Send,
  Refresh
} from '@mui/icons-material';

interface APIRestSettingsProps {
  sessionId: string;
}

interface APIKey {
  id: number;
  api_key: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  request_count: number;
}

const APIRestSettings: React.FC<APIRestSettingsProps> = ({ sessionId }) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyDescription, setNewKeyDescription] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [showKey, setShowKey] = useState<{ [key: number]: boolean }>({});

  // Estados para probar API
  const [testEndpoint, setTestEndpoint] = useState('text');
  const [testTo, setTestTo] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testImageUrl, setTestImageUrl] = useState('');
  const [testFileUrl, setTestFileUrl] = useState('');
  const [testFilename, setTestFilename] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState('');

  // Estado de WhatsApp
  const [whatsappStatus, setWhatsappStatus] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // 🧹 Sanitizar sessionId (eliminar sufijos :1, etc)
  const cleanSessionId = sessionId?.split(':')[0] || sessionId;

  useEffect(() => {
    loadAPIKeys();
    checkWhatsAppStatus();

    // Verificar estado cada 10 segundos
    const interval = setInterval(checkWhatsAppStatus, 10000);
    return () => clearInterval(interval);
  }, [sessionId, cleanSessionId]);

  const checkWhatsAppStatus = async () => {
    try {
      setStatusLoading(true);
      // Usar endpoint más confiable que verifica desde la BD
      const response = await fetch(`${getAPIBaseURL()}/api/whatsapp-connected`);
      const data = await response.json();

      // Transformar formato para compatibilidad
      setWhatsappStatus({
        isConnected: data.connected,
        sessionId: data.sessionId,
        phoneNumber: data.phoneNumber
      });
    } catch (error) {
      console.error('Error checking WhatsApp status:', error);
      setWhatsappStatus({ isConnected: false });
    } finally {
      setStatusLoading(false);
    }
  };

  const loadAPIKeys = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${getAPIBaseURL()}/api/rest/keys/${cleanSessionId}`);
      const data = await response.json();

      if (data.success) {
        setApiKeys(data.keys);
        if (data.keys.length > 0 && !selectedApiKey) {
          setSelectedApiKey(data.keys[0].api_key);
        }
      }
    } catch (error) {
      console.error('Error loading API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateKey = async () => {
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/rest/keys/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: cleanSessionId,
          name: newKeyName,
          description: newKeyDescription
        })
      });

      const data = await response.json();

      if (data.success) {
        setGeneratedKey(data.api_key);
        setNewKeyName('');
        setNewKeyDescription('');
        await loadAPIKeys();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error generating key:', error);
      alert('Error al generar API Key');
    }
  };

  const handleDeleteKey = async (keyId: number) => {
    if (!window.confirm('¿Estás seguro de desactivar esta API Key?')) {
      return;
    }

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/rest/keys/${keyId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        await loadAPIKeys();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting key:', error);
      alert('Error al eliminar API Key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copiado al portapapeles');
  };

  const handleTestAPI = async () => {
    if (!selectedApiKey) {
      alert('Selecciona una API Key primero');
      return;
    }

    setTestLoading(true);
    setTestResult(null);

    try {
      let endpoint = '';
      let body: any = {};

      switch (testEndpoint) {
        case 'text':
          endpoint = '/api/rest/send/text';
          body = { to: testTo, message: testMessage };
          break;
        case 'image':
          endpoint = '/api/rest/send/image';
          body = { to: testTo, image: testImageUrl, caption: testMessage };
          break;
        case 'document':
          endpoint = '/api/rest/send/document';
          body = { to: testTo, document: testFileUrl, filename: testFilename, caption: testMessage };
          break;
        case 'status':
          endpoint = `/api/rest/status/${cleanSessionId}`;
          break;
      }

      const response = await fetch(`${getAPIBaseURL()}${endpoint}`, {
        method: testEndpoint === 'status' ? 'GET' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': selectedApiKey
        },
        body: testEndpoint === 'status' ? undefined : JSON.stringify(body)
      });

      const data = await response.json();
      setTestResult(data);
    } catch (error: any) {
      setTestResult({ success: false, error: error.message });
    } finally {
      setTestLoading(false);
    }
  };

  const codeExamples = {
    curl_text: `curl -X POST "${getAPIBaseURL()}/api/rest/send/text" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "595981234567",
    "message": "Hola desde la API!"
  }'`,
    curl_image: `curl -X POST "${getAPIBaseURL()}/api/rest/send/image" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "595981234567",
    "image": "https://example.com/image.jpg",
    "caption": "Mira esta imagen"
  }'`,
    curl_document: `curl -X POST "${getAPIBaseURL()}/api/rest/send/document" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "595981234567",
    "document": "https://example.com/file.pdf",
    "filename": "documento.pdf",
    "mimetype": "application/pdf"
  }'`,
    javascript: `const apiKey = 'YOUR_API_KEY';
const apiUrl = '${getAPIBaseURL()}/api/rest';

// Enviar mensaje de texto
async function sendMessage(to, message) {
  const response = await fetch(\`\${apiUrl}/send/text\`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ to, message })
  });
  
  return await response.json();
}

// Usar
const result = await sendMessage('595981234567', 'Hola!');
console.log(result);`,
    python: `import requests

api_key = 'YOUR_API_KEY'
api_url = '${getAPIBaseURL()}/api/rest'

# Enviar mensaje de texto
def send_message(to, message):
    response = requests.post(
        f'{api_url}/send/text',
        headers={
            'X-API-Key': api_key,
            'Content-Type': 'application/json'
        },
        json={
            'to': to,
            'message': message
        }
    )
    return response.json()

# Usar
result = send_message('595981234567', 'Hola desde Python!')
print(result)`,
    php: `<?php
$apiKey = 'YOUR_API_KEY';
$apiUrl = '${getAPIBaseURL()}/api/rest';

// Enviar mensaje de texto
function sendMessage($to, $message) {
    global $apiKey, $apiUrl;
    
    $ch = curl_init("$apiUrl/send/text");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "X-API-Key: $apiKey",
        "Content-Type: application/json"
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'to' => $to,
        'message' => $message
    ]));
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    return json_decode($response, true);
}

// Usar
$result = sendMessage('595981234567', 'Hola desde PHP!');
var_dump($result);
?>`
  };

  return (
    <Box>
      {/* Estado de WhatsApp - SIMPLIFICADO */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          ✅ Estás conectado al sistema
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
          La API usará tu sesión actual automáticamente. Genera una API Key para comenzar.
        </Typography>
      </Alert>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>🔐 API REST para WhatsApp</strong> - Envía y recibe mensajes, gestiona autenticación y más mediante API REST
        </Typography>
      </Alert>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={selectedTab} onChange={(_, v) => setSelectedTab(v)}>
          <Tab label="📋 Mis API Keys" />
          <Tab label="📚 Documentación" />
          <Tab label="🧪 Probar API" />
        </Tabs>
      </Paper>

      {/* Tab 0: Gestión de API Keys */}
      {selectedTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6">🔑 Gestión de API Keys</Typography>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setShowNewKeyDialog(true)}
                    sx={{ bgcolor: '#25d366', '&:hover': { bgcolor: '#1da851' } }}
                  >
                    Generar Nueva API Key
                  </Button>
                </Box>

                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : apiKeys.length === 0 ? (
                  <Alert severity="info">
                    No tienes API Keys generadas. Crea una para comenzar a usar la API.
                  </Alert>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Nombre</TableCell>
                          <TableCell>API Key</TableCell>
                          <TableCell>Estado</TableCell>
                          <TableCell>Solicitudes</TableCell>
                          <TableCell>Creada</TableCell>
                          <TableCell>Último Uso</TableCell>
                          <TableCell>Acciones</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {apiKeys.map((key) => (
                          <TableRow key={key.id}>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {key.name}
                              </Typography>
                              {key.description && (
                                <Typography variant="caption" sx={{ color: '#64748b' }}>
                                  {key.description}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <code style={{
                                  background: '#f5f5f5',
                                  padding: '4px 8px',
                                  borderRadius: 4,
                                  fontSize: '12px'
                                }}>
                                  {showKey[key.id] ? key.api_key : `${key.api_key.substring(0, 20)}...`}
                                </code>
                                <IconButton
                                  size="small"
                                  onClick={() => setShowKey({ ...showKey, [key.id]: !showKey[key.id] })}
                                >
                                  {showKey[key.id] ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => copyToClipboard(key.api_key)}
                                >
                                  <ContentCopy />
                                </IconButton>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={key.is_active ? 'Activa' : 'Inactiva'}
                                size="small"
                                color={key.is_active ? 'success' : 'default'}
                              />
                            </TableCell>
                            <TableCell>{key.request_count}</TableCell>
                            <TableCell>
                              <Typography variant="caption">
                                {new Date(key.created_at).toLocaleDateString()}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption">
                                {key.last_used_at
                                  ? new Date(key.last_used_at).toLocaleString()
                                  : 'Nunca'
                                }
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Tooltip title="Desactivar">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDeleteKey(key.id)}
                                  disabled={!key.is_active}
                                >
                                  <Delete />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tab 1: Documentación */}
      {selectedTab === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h5" gutterBottom>📚 Documentación de la API</Typography>
                <Typography variant="body2" paragraph sx={{ color: '#64748b' }}>
                  Utiliza nuestra API REST para integrar WhatsApp en tus aplicaciones. Todos los endpoints requieren autenticación mediante API Key.
                </Typography>

                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" gutterBottom>🔐 Autenticación</Typography>
                <Typography variant="body2" paragraph>
                  Incluye tu API Key en cada solicitud usando el header <code>X-API-Key</code> o el parámetro de query <code>api_key</code>
                </Typography>

                <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 2, mb: 3 }}>
                  <pre style={{ margin: 0, fontSize: '13px' }}>
                    X-API-Key: wf_tu_api_key_aqui
                  </pre>
                </Box>

                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" gutterBottom>📡 Endpoints Disponibles</Typography>

                {/* Enviar Mensaje de Texto */}
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip label="POST" size="small" color="primary" />
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        /api/rest/send/text
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        - Enviar mensaje de texto
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="subtitle2" gutterBottom>Parámetros (JSON):</Typography>
                    <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 2, mb: 2 }}>
                      <pre style={{ margin: 0, fontSize: '12px' }}>
                        {`{
  "to": "595981234567",        // Número de teléfono (con código de país)
  "message": "Hola desde API"  // Mensaje a enviar
}`}
                      </pre>
                    </Box>

                    <Typography variant="subtitle2" gutterBottom>Ejemplo cURL:</Typography>
                    <Box sx={{ bgcolor: '#1e1e1e', color: '#fff', p: 2, borderRadius: 2, mb: 2 }}>
                      <pre style={{ margin: 0, fontSize: '11px', overflowX: 'auto' }}>
                        {codeExamples.curl_text}
                      </pre>
                    </Box>

                    <Button
                      size="small"
                      startIcon={<ContentCopy />}
                      onClick={() => copyToClipboard(codeExamples.curl_text)}
                    >
                      Copiar cURL
                    </Button>
                  </AccordionDetails>
                </Accordion>

                {/* Enviar Imagen */}
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip label="POST" size="small" color="primary" />
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        /api/rest/send/image
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        - Enviar imagen
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="subtitle2" gutterBottom>Parámetros (JSON):</Typography>
                    <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 2, mb: 2 }}>
                      <pre style={{ margin: 0, fontSize: '12px' }}>
                        {`{
  "to": "595981234567",
  "image": "https://example.com/imagen.jpg",  // URL de la imagen
  "caption": "Mira esta imagen" (opcional)
}`}
                      </pre>
                    </Box>

                    <Box sx={{ bgcolor: '#1e1e1e', color: '#fff', p: 2, borderRadius: 2, mb: 2 }}>
                      <pre style={{ margin: 0, fontSize: '11px', overflowX: 'auto' }}>
                        {codeExamples.curl_image}
                      </pre>
                    </Box>

                    <Button
                      size="small"
                      startIcon={<ContentCopy />}
                      onClick={() => copyToClipboard(codeExamples.curl_image)}
                    >
                      Copiar cURL
                    </Button>
                  </AccordionDetails>
                </Accordion>

                {/* Enviar Documento */}
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip label="POST" size="small" color="primary" />
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        /api/rest/send/document
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        - Enviar archivo/documento
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="subtitle2" gutterBottom>Parámetros (JSON):</Typography>
                    <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 2, mb: 2 }}>
                      <pre style={{ margin: 0, fontSize: '12px' }}>
                        {`{
  "to": "595981234567",
  "document": "https://example.com/doc.pdf",  // URL del archivo
  "filename": "documento.pdf",                // Nombre del archivo
  "mimetype": "application/pdf" (opcional),
  "caption": "Adjunto documento" (opcional)
}`}
                      </pre>
                    </Box>

                    <Box sx={{ bgcolor: '#1e1e1e', color: '#fff', p: 2, borderRadius: 2, mb: 2 }}>
                      <pre style={{ margin: 0, fontSize: '11px', overflowX: 'auto' }}>
                        {codeExamples.curl_document}
                      </pre>
                    </Box>

                    <Button
                      size="small"
                      startIcon={<ContentCopy />}
                      onClick={() => copyToClipboard(codeExamples.curl_document)}
                    >
                      Copiar cURL
                    </Button>
                  </AccordionDetails>
                </Accordion>

                {/* Otros Endpoints */}
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip label="POST" size="small" color="primary" />
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        /api/rest/send/audio
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        - Enviar audio
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" paragraph>
                      Parámetros: <code>to</code>, <code>audio</code> (URL), <code>ptt</code> (boolean, para nota de voz)
                    </Typography>
                  </AccordionDetails>
                </Accordion>

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip label="POST" size="small" color="primary" />
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        /api/rest/send/video
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        - Enviar video
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" paragraph>
                      Parámetros: <code>to</code>, <code>video</code> (URL), <code>caption</code> (opcional)
                    </Typography>
                  </AccordionDetails>
                </Accordion>

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip label="GET" size="small" color="success" />
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        /api/rest/status/:sessionId
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        - Estado de conexión
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" paragraph>
                      Verifica si la sesión de WhatsApp está conectada y autenticada
                    </Typography>
                  </AccordionDetails>
                </Accordion>

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip label="GET" size="small" color="success" />
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        /api/rest/messages/:sessionId
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        - Obtener mensajes
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" paragraph>
                      Query params: <code>limit</code> (default: 50), <code>offset</code>, <code>chat</code> (filtrar por JID)
                    </Typography>
                  </AccordionDetails>
                </Accordion>

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip label="GET" size="small" color="success" />
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        /api/rest/chats/:sessionId
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        - Listar chats
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" paragraph>
                      Obtiene la lista de chats con información de último mensaje y contador
                    </Typography>
                  </AccordionDetails>
                </Accordion>

                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" gutterBottom>💻 Ejemplos de Código</Typography>

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="body1">JavaScript / Node.js</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ bgcolor: '#1e1e1e', color: '#fff', p: 2, borderRadius: 2 }}>
                      <pre style={{ margin: 0, fontSize: '12px', overflowX: 'auto' }}>
                        {codeExamples.javascript}
                      </pre>
                    </Box>
                    <Button
                      size="small"
                      startIcon={<ContentCopy />}
                      onClick={() => copyToClipboard(codeExamples.javascript)}
                      sx={{ mt: 1 }}
                    >
                      Copiar código
                    </Button>
                  </AccordionDetails>
                </Accordion>

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="body1">Python</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ bgcolor: '#1e1e1e', color: '#fff', p: 2, borderRadius: 2 }}>
                      <pre style={{ margin: 0, fontSize: '12px', overflowX: 'auto' }}>
                        {codeExamples.python}
                      </pre>
                    </Box>
                    <Button
                      size="small"
                      startIcon={<ContentCopy />}
                      onClick={() => copyToClipboard(codeExamples.python)}
                      sx={{ mt: 1 }}
                    >
                      Copiar código
                    </Button>
                  </AccordionDetails>
                </Accordion>

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="body1">PHP</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ bgcolor: '#1e1e1e', color: '#fff', p: 2, borderRadius: 2 }}>
                      <pre style={{ margin: 0, fontSize: '12px', overflowX: 'auto' }}>
                        {codeExamples.php}
                      </pre>
                    </Box>
                    <Button
                      size="small"
                      startIcon={<ContentCopy />}
                      onClick={() => copyToClipboard(codeExamples.php)}
                      sx={{ mt: 1 }}
                    >
                      Copiar código
                    </Button>
                  </AccordionDetails>
                </Accordion>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tab 2: Probar API */}
      {selectedTab === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>🧪 Probar API en Vivo</Typography>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Selecciona API Key</InputLabel>
                  <Select
                    value={selectedApiKey}
                    onChange={(e) => setSelectedApiKey(e.target.value)}
                    label="Selecciona API Key"
                  >
                    {apiKeys.filter(k => k.is_active).map((key) => (
                      <MenuItem key={key.id} value={key.api_key}>
                        {key.name} ({key.api_key.substring(0, 15)}...)
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Tipo de Mensaje</InputLabel>
                  <Select
                    value={testEndpoint}
                    onChange={(e) => setTestEndpoint(e.target.value)}
                    label="Tipo de Mensaje"
                  >
                    <MenuItem value="text">📝 Mensaje de Texto</MenuItem>
                    <MenuItem value="image">🖼️ Imagen</MenuItem>
                    <MenuItem value="document">📎 Documento</MenuItem>
                    <MenuItem value="status">🔌 Estado de Conexión</MenuItem>
                  </Select>
                </FormControl>

                {testEndpoint !== 'status' && (
                  <>
                    <TextField
                      fullWidth
                      label="Número de destino"
                      placeholder="595981234567"
                      value={testTo}
                      onChange={(e) => setTestTo(e.target.value)}
                      sx={{ mb: 2 }}
                    />

                    {testEndpoint === 'text' && (
                      <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label="Mensaje"
                        value={testMessage}
                        onChange={(e) => setTestMessage(e.target.value)}
                        sx={{ mb: 2 }}
                      />
                    )}

                    {testEndpoint === 'image' && (
                      <>
                        <TextField
                          fullWidth
                          label="URL de la imagen"
                          placeholder="https://example.com/imagen.jpg"
                          value={testImageUrl}
                          onChange={(e) => setTestImageUrl(e.target.value)}
                          sx={{ mb: 2 }}
                        />
                        <TextField
                          fullWidth
                          label="Caption (opcional)"
                          value={testMessage}
                          onChange={(e) => setTestMessage(e.target.value)}
                          sx={{ mb: 2 }}
                        />
                      </>
                    )}

                    {testEndpoint === 'document' && (
                      <>
                        <TextField
                          fullWidth
                          label="URL del archivo"
                          placeholder="https://example.com/documento.pdf"
                          value={testFileUrl}
                          onChange={(e) => setTestFileUrl(e.target.value)}
                          sx={{ mb: 2 }}
                        />
                        <TextField
                          fullWidth
                          label="Nombre del archivo"
                          placeholder="documento.pdf"
                          value={testFilename}
                          onChange={(e) => setTestFilename(e.target.value)}
                          sx={{ mb: 2 }}
                        />
                      </>
                    )}
                  </>
                )}

                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  startIcon={testLoading ? <CircularProgress size={20} color="inherit" /> : <PlayArrow />}
                  onClick={handleTestAPI}
                  disabled={testLoading || !selectedApiKey}
                  sx={{ bgcolor: '#25d366', '&:hover': { bgcolor: '#1da851' } }}
                >
                  {testLoading ? 'Enviando...' : 'Probar API'}
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>📊 Resultado</Typography>

                {!testResult ? (
                  <Alert severity="info">
                    Configura los parámetros y presiona "Probar API" para ver el resultado
                  </Alert>
                ) : (
                  <>
                    <Alert severity={testResult.success ? 'success' : 'error'} sx={{ mb: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {testResult.success ? '✅ Éxito' : '❌ Error'}
                      </Typography>
                    </Alert>

                    <Box sx={{ bgcolor: '#1e1e1e', color: '#fff', p: 2, borderRadius: 2 }}>
                      <pre style={{ margin: 0, fontSize: '12px', overflowX: 'auto' }}>
                        {JSON.stringify(testResult, null, 2)}
                      </pre>
                    </Box>

                    <Button
                      size="small"
                      startIcon={<ContentCopy />}
                      onClick={() => copyToClipboard(JSON.stringify(testResult, null, 2))}
                      sx={{ mt: 1 }}
                    >
                      Copiar respuesta
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Dialog para generar nueva API Key */}
      <Dialog open={showNewKeyDialog} onClose={() => setShowNewKeyDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>🔑 Generar Nueva API Key</DialogTitle>
        <DialogContent>
          {generatedKey ? (
            <>
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  ✅ API Key generada exitosamente
                </Typography>
              </Alert>

              <Typography variant="body2" sx={{ mb: 1 }}>
                Copia y guarda esta API Key en un lugar seguro. No podrás verla nuevamente.
              </Typography>

              <Box sx={{
                bgcolor: '#f5f5f5',
                p: 2,
                borderRadius: 2,
                mb: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <code style={{ flex: 1, fontSize: '13px', wordBreak: 'break-all' }}>
                  {generatedKey}
                </code>
                <IconButton onClick={() => copyToClipboard(generatedKey)}>
                  <ContentCopy />
                </IconButton>
              </Box>
            </>
          ) : (
            <>
              <TextField
                fullWidth
                label="Nombre de la API Key"
                placeholder="Mi API Key"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                sx={{ mb: 2, mt: 2 }}
              />
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Descripción (opcional)"
                placeholder="Para integración con mi app..."
                value={newKeyDescription}
                onChange={(e) => setNewKeyDescription(e.target.value)}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          {generatedKey ? (
            <Button
              variant="contained"
              onClick={() => {
                setShowNewKeyDialog(false);
                setGeneratedKey('');
              }}
            >
              Cerrar
            </Button>
          ) : (
            <>
              <Button onClick={() => setShowNewKeyDialog(false)}>Cancelar</Button>
              <Button
                variant="contained"
                onClick={handleGenerateKey}
                disabled={!newKeyName}
              >
                Generar
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default APIRestSettings;
