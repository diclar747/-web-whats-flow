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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar
} from '@mui/material';
import {
  ContentCopy,
  Delete,
  Add,
  PlayArrow,
  ExpandMore,
  Visibility,
  VisibilityOff,
  CheckCircle
} from '@mui/icons-material';

interface APIRestSettingsProps {
  userId: string;
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

const APIRestSettings: React.FC<APIRestSettingsProps> = ({ userId }) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyDescription, setNewKeyDescription] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [showKey, setShowKey] = useState<{ [key: number]: boolean }>({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' | 'info' });

  // Estados para probar API
  const [testEndpoint, setTestEndpoint] = useState('text');
  const [testTo, setTestTo] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testImageUrl, setTestImageUrl] = useState('');
  const [testFileUrl, setTestFileUrl] = useState('');
  const [testFilename, setTestFilename] = useState('');
  const [testFile, setTestFile] = useState<File | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState('');

  // Estados para nuevos tipos de mensajes
  const [testLatitude, setTestLatitude] = useState('-25.2819');
  const [testLongitude, setTestLongitude] = useState('-57.6350');
  const [testLocationName, setTestLocationName] = useState('Palacio de López');
  const [testLocationAddress, setTestLocationAddress] = useState('Paraguay, Asunción');
  const [testContactName, setTestContactName] = useState('Juan Pérez');
  const [testVCard, setTestVCard] = useState('BEGIN:VCARD\nVERSION:3.0\nFN:Juan Pérez\nTEL;TYPE=CELL:595981234567\nEND:VCARD');
  const [testStickerUrl, setTestStickerUrl] = useState('https://www.gstatic.com/webp/gallery/1.webp');
  const [testButtons, setTestButtons] = useState('[\n  {"id": "id1", "text": "Opción 1"},\n  {"id": "id2", "text": "Opción 2"}\n]');
  const [testList, setTestList] = useState('{\n  "title": "Selecciona una opción",\n  "buttonText": "Ver opciones",\n  "sections": [\n    {\n      "title": "Sección 1",\n      "rows": [\n        {"id": "row1", "title": "Fila 1", "description": "Descripción 1"},\n        {"id": "row2", "title": "Fila 2"}\n      ]\n    }\n  ]\n}');
  const [testTemplate, setTestTemplate] = useState('{\n  "templateId": "hello_world",\n  "language": "en_US",\n  "components": []\n}');

  // Estados para Webhooks
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>(['message.received', 'message.sent']);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [webhookLoading, setWebhookLoading] = useState(false);

  // Estados para Extended API
  const [extendedModule, setExtendedModule] = useState('account');
  const [extendedAction, setExtendedAction] = useState('info');
  const [extendedParams, setExtendedParams] = useState('{}');

  // Estado de WhatsApp
  const [whatsappStatus, setWhatsappStatus] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // 🧹 Limpiar userId
  const cleanUserId = userId?.toString();

  useEffect(() => {
    loadAPIKeys();
    checkWhatsAppStatus();

    // Verificar estado cada 10 segundos
    const interval = setInterval(checkWhatsAppStatus, 10000);
    return () => clearInterval(interval);
  }, [userId, cleanUserId]);

  const checkWhatsAppStatus = async () => {
    try {
      setStatusLoading(true);
      const response = await fetch(`${getAPIBaseURL()}/api/whatsapp-connected`);
      const data = await response.json();

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
      const response = await fetch(`${getAPIBaseURL()}/api/rest/keys/${cleanUserId}`);
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
          sessionId: cleanUserId, // Usamos userId en la BD (columna session_id)
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
        setSnackbar({ open: true, message: 'Error: ' + data.error, severity: 'error' });
      }
    } catch (error) {
      console.error('Error generating key:', error);
      setSnackbar({ open: true, message: 'Error al generar API Key', severity: 'error' });
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
        setSnackbar({ open: true, message: 'API Key desactivada correctamente', severity: 'success' });
      } else {
        setSnackbar({ open: true, message: 'Error: ' + data.error, severity: 'error' });
      }
    } catch (error) {
      console.error('Error deleting key:', error);
      setSnackbar({ open: true, message: 'Error al eliminar API Key', severity: 'error' });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSnackbar({ open: true, message: '✅ Copiado al portapapeles', severity: 'success' });
  };

  const handleTestAPI = async () => {
    if (!selectedApiKey) {
      setSnackbar({ open: true, message: 'Selecciona una API Key primero', severity: 'error' });
      return;
    }

    setTestLoading(true);
    setTestResult(null);

    try {
      let endpoint = '';
      let body: any = {};
      let isFormData = false;

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
        case 'file':
          if (!testFile) {
            setSnackbar({ open: true, message: 'Selecciona un archivo primero', severity: 'error' });
            setTestLoading(false);
            return;
          }
          endpoint = '/api/rest/send/file';
          const formData = new FormData();
          formData.append('file', testFile);
          formData.append('to', testTo);
          formData.append('caption', testMessage);
          body = formData;
          isFormData = true;
          break;
        case 'location':
          endpoint = '/api/rest/send/location';
          body = {
            to: testTo,
            latitude: parseFloat(testLatitude),
            longitude: parseFloat(testLongitude),
            name: testLocationName,
            address: testLocationAddress
          };
          break;
        case 'contact':
          endpoint = '/api/rest/send/contact';
          body = {
            to: testTo,
            contactName: testContactName,
            vcard: testVCard
          };
          break;
        case 'sticker':
          endpoint = '/api/rest/send/sticker';
          body = { to: testTo, sticker: testStickerUrl };
          break;
        case 'buttons':
          endpoint = '/api/rest/send/buttons';
          try {
            body = { to: testTo, text: testMessage, buttons: JSON.parse(testButtons) };
          } catch (e) {
            setSnackbar({ open: true, message: 'Error en formato JSON de botones', severity: 'error' });
            setTestLoading(false);
            return;
          }
          break;
        case 'list':
          endpoint = '/api/rest/send/list';
          try {
            const listData = JSON.parse(testList);
            body = { to: testTo, text: testMessage, ...listData };
          } catch (e) {
            setSnackbar({ open: true, message: 'Error en formato JSON de lista', severity: 'error' });
            setTestLoading(false);
            return;
          }
          break;
        case 'template':
          endpoint = '/api/rest/send/template';
          try {
            body = { to: testTo, ...JSON.parse(testTemplate) };
          } catch (e) {
            setSnackbar({ open: true, message: 'Error en formato JSON de plantilla', severity: 'error' });
            setTestLoading(false);
            return;
          }
          break;
        case 'webhook_register':
          endpoint = '/api/rest/webhooks/register';
          body = { url: webhookUrl, events: webhookEvents };
          break;
        case 'webhook_list':
          endpoint = '/api/rest/webhooks/list';
          break;
        case 'extended':
          endpoint = `/api/rest/extended/${extendedModule}/${extendedAction}`;
          try {
            body = JSON.parse(extendedParams);
          } catch (e) {
            setSnackbar({ open: true, message: 'Error en formato JSON de parámetros', severity: 'error' });
            setTestLoading(false);
            return;
          }
          break;
        case 'status':
          endpoint = `/api/rest/status/${cleanUserId}`;
          break;
      }

      const headers: any = {
        'X-API-Key': selectedApiKey
      };

      // No agregar Content-Type para FormData (el browser lo hace automático)
      if (!isFormData) {
        headers['Content-Type'] = 'application/json';
      }

      // Determinar método HTTP
      let method = 'POST';
      if (testEndpoint === 'status' || testEndpoint === 'webhook_list') {
        method = 'GET';
      } else if (testEndpoint === 'extended' && ['info', 'profile', 'list', 'flows', 'boards', 'columns', 'cards', 'statuses', 'agents', 'dashboard', 'messages', 'templates'].includes(extendedAction)) {
        method = 'GET';
      }

      const response = await fetch(`${getAPIBaseURL()}${endpoint}`, {
        method: method,
        headers: headers,
        body: method === 'GET' ? undefined : (isFormData ? body : JSON.stringify(body))
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
    curl_location: `curl -X POST "${getAPIBaseURL()}/api/rest/send/location" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "595981234567",
    "latitude": -25.2819,
    "longitude": -57.6350,
    "name": "Palacio de López",
    "address": "Asunción, Paraguay"
  }'`,
    curl_contact: `curl -X POST "${getAPIBaseURL()}/api/rest/send/contact" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "595981234567",
    "contactName": "Juan Pérez",
    "vcard": "BEGIN:VCARD\\nVERSION:3.0\\nFN:Juan Pérez\\nTEL;TYPE=CELL:595981234567\\nEND:VCARD"
  }'`,
    curl_sticker: `curl -X POST "${getAPIBaseURL()}/api/rest/send/sticker" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "595981234567",
    "sticker": "https://www.gstatic.com/webp/gallery/1.webp"
  }'`,
    curl_buttons: `curl -X POST "${getAPIBaseURL()}/api/rest/send/buttons" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "595981234567",
    "text": "Selecciona una opción",
    "buttons": [
      {"id": "btn1", "text": "Aceptar"},
      {"id": "btn2", "text": "Rechazar"}
    ]
  }'`,
    curl_list: `curl -X POST "${getAPIBaseURL()}/api/rest/send/list" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "595981234567",
    "text": "Nuestros productos",
    "title": "Catálogo",
    "buttonText": "Ver productos",
    "sections": [
      {
        "title": "Sección 1",
        "rows": [
          {"id": "p1", "title": "Producto 1", "description": "Precio: $10"},
          {"id": "p2", "title": "Producto 2", "description": "Precio: $20"}
        ]
      }
    ]
  }'`,
    curl_template: `curl -X POST "${getAPIBaseURL()}/api/rest/send/template" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "595981234567",
    "templateId": "hello_world",
    "language": "en_US",
    "components": []
  }'`,
    curl_webhook_reg: `curl -X POST "${getAPIBaseURL()}/api/rest/webhooks/register" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://tu-servidor.com/webhook",
    "events": ["message.received", "message.sent"]
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
    php: `<?php
$apiKey = 'YOUR_API_KEY';
$apiUrl = '${getAPIBaseURL()}/api/rest';

// ============================================
// ENVIAR MENSAJE DE TEXTO
// ============================================
function sendText($to, $message) {
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
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    return json_decode($response, true);
}

// ============================================
// ENVIAR IMAGEN (URL)
// ============================================
function sendImage($to, $imageUrl, $caption = '') {
    global $apiKey, $apiUrl;
    
    $ch = curl_init("$apiUrl/send/image");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "X-API-Key: $apiKey",
        "Content-Type: application/json"
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'to' => $to,
        'image' => $imageUrl,
        'caption' => $caption
    ]));
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    return json_decode($response, true);
}

// ============================================
// ENVIAR ARCHIVO (UPLOAD DIRECTO)
// ============================================
function sendFile($to, $filePath, $caption = '') {
    global $apiKey, $apiUrl;
    
    // Verificar que el archivo existe
    if (!file_exists($filePath)) {
        return ['success' => false, 'error' => 'Archivo no encontrado'];
    }
    
    $cfile = curl_file_create(
        $filePath,
        mime_content_type($filePath),
        basename($filePath)
    );
    
    $ch = curl_init("$apiUrl/send/file");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "X-API-Key: $apiKey"
        // NO incluir Content-Type, cURL lo maneja automático
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, [
        'file' => $cfile,
        'to' => $to,
        'caption' => $caption
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    return json_decode($response, true);
}

// ============================================
// VERIFICAR ESTADO DE CONEXIÓN
// ============================================
function checkStatus($sessionId) {
    global $apiKey, $apiUrl;
    
    $ch = curl_init("$apiUrl/status/$sessionId");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "X-API-Key: $apiKey"
    ]);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    return json_decode($response, true);
}

// ============================================
// MANEJO DE ERRORES
// ============================================
function handleAPIResponse($result) {
    if (!$result['success']) {
        switch ($result['error']) {
            case 'Sin mensajes disponibles en tu plan':
                echo "⛔ Sin saldo en tu plan\n";
                echo "Usados: {$result['used']}/{$result['limit']}\n";
                break;
            case 'API Key inválida o inactiva':
                echo "🔑 API Key incorrecta\n";
                break;
            default:
                echo "❌ Error: {$result['error']}\n";
        }
        return false;
    }
    
    echo "✅ Mensaje enviado: {$result['messageId']}\n";
    return true;
}

// ============================================
// EJEMPLOS DE USO
// ============================================

// Enviar texto
$result = sendText('595981234567', 'Hola desde PHP!');
handleAPIResponse($result);

// Enviar imagen
$result = sendImage(
    '595981234567',
    'https://example.com/imagen.jpg',
    'Mira esta imagen'
);
handleAPIResponse($result);

// Enviar archivo local
$result = sendFile(
    '595981234567',
    '/ruta/a/documento.pdf',
    'Aquí está el documento'
);
handleAPIResponse($result);

// Verificar conexión
$status = checkStatus('595985768793');
if ($status['connected']) {
    echo "✅ WhatsApp conectado: {$status['phoneNumber']}\n";
} else {
    echo "❌ WhatsApp desconectado\n";
}
?>`,
    python: `import requests
from pathlib import Path

api_key = 'YOUR_API_KEY'
api_url = '${getAPIBaseURL()}/api/rest'

# ============================================
# ENVIAR MENSAJE DE TEXTO
# ============================================
def send_text(to, message):
    response = requests.post(
        f'{api_url}/send/text',
        headers={'X-API-Key': api_key, 'Content-Type': 'application/json'},
        json={'to': to, 'message': message}
    )
    return response.json()

# ============================================
# ENVIAR IMAGEN (URL)
# ============================================
def send_image(to, image_url, caption=''):
    response = requests.post(
        f'{api_url}/send/image',
        headers={'X-API-Key': api_key, 'Content-Type': 'application/json'},
        json={'to': to, 'image': image_url, 'caption': caption}
    )
    return response.json()

# ============================================
# ENVIAR ARCHIVO (UPLOAD DIRECTO)
# ============================================
def send_file(to, file_path, caption=''):
    file_path = Path(file_path)
    
    if not file_path.exists():
        return {'success': False, 'error': 'Archivo no encontrado'}
    
    with open(file_path, 'rb') as f:
        files = {'file': (file_path.name, f, 'application/octet-stream')}
        data = {'to': to, 'caption': caption}
        
        response = requests.post(
            f'{api_url}/send/file',
            headers={'X-API-Key': api_key},
            files=files,
            data=data
        )
    
    return response.json()

# ============================================
# VERIFICAR ESTADO
# ============================================
def check_status(session_id):
    response = requests.get(
        f'{api_url}/status/{session_id}',
        headers={'X-API-Key': api_key}
    )
    return response.json()

# ============================================
# MANEJO DE ERRORES
# ============================================
def handle_response(result):
    if not result.get('success'):
        error = result.get('error', 'Error desconocido')
        
        if 'Sin mensajes disponibles' in error:
            print(f"⛔ Sin saldo: {result.get('used')}/{result.get('limit')}")
        elif 'API Key inválida' in error:
            print("🔑 API Key incorrecta")
        else:
            print(f"❌ Error: {error}")
        return False
    
    print(f"✅ Enviado: {result.get('messageId')}")
    return True

# ============================================
# EJEMPLOS DE USO
# ============================================
if __name__ == '__main__':
    # Enviar texto
    result = send_text('595981234567', 'Hola desde Python!')
    handle_response(result)
    
    # Enviar imagen
    result = send_image(
        '595981234567',
        'https://example.com/imagen.jpg',
        'Mira esta imagen'
    )
    handle_response(result)
    
    # Enviar archivo local
    result = send_file(
        '595981234567',
        '/ruta/a/documento.pdf',
        'Aquí está el documento'
    )
    handle_response(result)
    
    # Verificar conexión
    status = check_status('595985768793')
    if status.get('connected'):
        print(f"✅ Conectado: {status.get('phoneNumber')}")
    else:
        print("❌ Desconectado")`
  };

  return (
    <Box sx={{ bgcolor: '#0f1419', minHeight: '100vh', p: 3 }}>
      {/* Estado de WhatsApp */}
      <Alert severity="info" sx={{ mb: 3, bgcolor: '#1a2332', color: '#e3e8ef' }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          ✅ Estás conectado al sistema
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
          La API usará tu sesión actual automáticamente. Genera una API Key para comenzar.
        </Typography>
      </Alert>

      <Alert severity="info" sx={{ mb: 3, bgcolor: '#1a2332', color: '#e3e8ef' }}>
        <Typography variant="body2">
          <strong>🔐 API REST para WhatsApp</strong> - Envía y recibe mensajes, gestiona autenticación y más mediante API REST
        </Typography>
      </Alert>

      <Paper sx={{ mb: 3, bgcolor: '#1a2332' }}>
        <Tabs value={selectedTab} onChange={(_, v) => setSelectedTab(v)} sx={{ '& .MuiTab-root': { color: '#8b949e' }, '& .Mui-selected': { color: '#58a6ff' } }}>
          <Tab label="📋 Mis API Keys" />
          <Tab label="📚 Documentación" />
          <Tab label="🧪 Probar API" />
        </Tabs>
      </Paper>

      {/* Tab 0: Gestión de API Keys */}
      {selectedTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card sx={{ bgcolor: '#1a2332', color: '#e3e8ef' }}>
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
                  <Alert severity="info" sx={{ bgcolor: '#1a3a52', color: '#e3e8ef' }}>
                    No tienes API Keys generadas. Crea una para comenzar a usar la API.
                  </Alert>
                ) : (
                  <TableContainer sx={{ bgcolor: '#0f1419' }}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ color: '#8b949e', borderBottom: '1px solid #30363d' }}>Nombre</TableCell>
                          <TableCell sx={{ color: '#8b949e', borderBottom: '1px solid #30363d' }}>API Key</TableCell>
                          <TableCell sx={{ color: '#8b949e', borderBottom: '1px solid #30363d' }}>Estado</TableCell>
                          <TableCell sx={{ color: '#8b949e', borderBottom: '1px solid #30363d' }}>Solicitudes</TableCell>
                          <TableCell sx={{ color: '#8b949e', borderBottom: '1px solid #30363d' }}>Creada</TableCell>
                          <TableCell sx={{ color: '#8b949e', borderBottom: '1px solid #30363d' }}>Último Uso</TableCell>
                          <TableCell sx={{ color: '#8b949e', borderBottom: '1px solid #30363d' }}>Conectar</TableCell>
                          <TableCell sx={{ color: '#8b949e', borderBottom: '1px solid #30363d' }}>Acciones</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {apiKeys.map((key) => (
                          <TableRow key={key.id} sx={{ '&:hover': { bgcolor: '#161b22' } }}>
                            <TableCell sx={{ color: '#e3e8ef', borderBottom: '1px solid #30363d' }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {key.name}
                              </Typography>
                              {key.description && (
                                <Typography variant="caption" sx={{ color: '#8b949e' }}>
                                  {key.description}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell sx={{ color: '#e3e8ef', borderBottom: '1px solid #30363d' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <code style={{
                                  background: '#0d1117',
                                  padding: '4px 8px',
                                  borderRadius: 4,
                                  fontSize: '12px',
                                  color: '#58a6ff'
                                }}>
                                  {showKey[key.id] ? key.api_key : `${key.api_key.substring(0, 20)}...`}
                                </code>
                                <IconButton
                                  size="small"
                                  onClick={() => setShowKey({ ...showKey, [key.id]: !showKey[key.id] })}
                                  sx={{ color: '#8b949e' }}
                                >
                                  {showKey[key.id] ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => copyToClipboard(key.api_key)}
                                  sx={{ color: '#8b949e' }}
                                >
                                  <ContentCopy />
                                </IconButton>
                              </Box>
                            </TableCell>
                            <TableCell sx={{ borderBottom: '1px solid #30363d' }}>
                              <Chip
                                label={key.is_active ? 'Activa' : 'Inactiva'}
                                size="small"
                                color={key.is_active ? 'success' : 'default'}
                              />
                            </TableCell>
                            <TableCell sx={{ color: '#e3e8ef', borderBottom: '1px solid #30363d' }}>{key.request_count}</TableCell>
                            <TableCell sx={{ borderBottom: '1px solid #30363d' }}>
                              <Typography variant="caption" sx={{ color: '#8b949e' }}>
                                {new Date(key.created_at).toLocaleDateString()}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ borderBottom: '1px solid #30363d' }}>
                              <Typography variant="caption" sx={{ color: '#8b949e' }}>
                                {key.last_used_at
                                  ? new Date(key.last_used_at).toLocaleString()
                                  : 'Nunca'
                                }
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ borderBottom: '1px solid #30363d' }}>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<PlayArrow />}
                                onClick={() => window.open(`${getAPIBaseURL()}/api/rest/connect?api_key=${key.api_key}`, '_blank')}
                                sx={{
                                  color: '#25d366',
                                  borderColor: '#25d366',
                                  fontSize: '11px',
                                  '&:hover': { borderColor: '#1da851', bgcolor: 'rgba(37, 211, 102, 0.1)' }
                                }}
                              >
                                Conectar QR
                              </Button>
                            </TableCell>
                            <TableCell sx={{ borderBottom: '1px solid #30363d' }}>
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
            <Card sx={{ bgcolor: '#1a2332', color: '#e3e8ef' }}>
              <CardContent>
                <Typography variant="h5" gutterBottom>📚 Documentación de la API</Typography>
                <Typography variant="body2" paragraph sx={{ color: '#8b949e' }}>
                  Utiliza nuestra API REST para integrar WhatsApp en tus aplicaciones. Todos los endpoints requieren autenticación mediante API Key.
                </Typography>

                <Divider sx={{ my: 3, borderColor: '#30363d' }} />

                <Typography variant="h6" gutterBottom>🔐 Autenticación</Typography>
                <Typography variant="body2" paragraph sx={{ color: '#8b949e' }}>
                  Incluye tu API Key en cada solicitud usando el header <code style={{ background: '#0d1117', padding: '2px 6px', borderRadius: 3, color: '#58a6ff' }}>X-API-Key</code> o el parámetro de query <code style={{ background: '#0d1117', padding: '2px 6px', borderRadius: 3, color: '#58a6ff' }}>api_key</code>
                </Typography>

                <Box sx={{ bgcolor: '#0d1117', p: 2, borderRadius: 2, mb: 3, border: '1px solid #30363d' }}>
                  <pre style={{ margin: 0, fontSize: '13px', color: '#79c0ff' }}>
                    X-API-Key: wf_tu_api_key_aqui
                  </pre>
                </Box>

                <Divider sx={{ my: 3, borderColor: '#30363d' }} />

                <Typography variant="h6" gutterBottom>📡 Endpoints Disponibles</Typography>

                {/* 🆕 Conexión Masiva / API */}
                <Accordion sx={{ bgcolor: '#161b22', color: '#e3e8ef', mb: 1, border: '1px solid #25d366' }}>
                  <AccordionSummary expandIcon={<ExpandMore sx={{ color: '#8b949e' }} />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip label="GET" size="small" sx={{ bgcolor: '#2188ff', color: '#fff' }} />
                      <Typography variant="body1" sx={{ fontWeight: 600, color: '#25d366' }}>
                        /api/rest/connect
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#8b949e' }}>
                        - Generar conexión mediante QR (Vista Navegador)
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ bgcolor: '#0d1117' }}>
                    <Typography variant="body2" paragraph sx={{ color: '#e3e8ef' }}>
                      Este endpoint permite abrir una interfaz web para escanear el código QR y vincular una nueva línea de WhatsApp utilizando directamente una API Key.
                    </Typography>
                    <Typography variant="subtitle2" gutterBottom>URL de Conexión:</Typography>
                    <Box sx={{ bgcolor: '#161b22', p: 2, borderRadius: 2, mb: 2, border: '1px solid #30363d' }}>
                      <code style={{ fontSize: '12px', color: '#79c0ff', wordBreak: 'break-all' }}>
                        {`${getAPIBaseURL()}/api/rest/connect?api_key=wf_tu_api_key`}
                      </code>
                    </Box>
                    <Typography variant="body2" paragraph sx={{ color: '#8b949e', fontSize: '12px' }}>
                      <strong>Nota:</strong> Esta URL se puede abrir en cualquier navegador o enviarla a un cliente para que realice la vinculación por su cuenta. El sistema verificará automáticamente los límites de tu plan.
                    </Typography>
                  </AccordionDetails>
                </Accordion>

                {/* Enviar Mensaje de Texto */}
                <Accordion sx={{ bgcolor: '#161b22', color: '#e3e8ef', mb: 1 }}>
                  <AccordionSummary expandIcon={<ExpandMore sx={{ color: '#8b949e' }} />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip label="POST" size="small" sx={{ bgcolor: '#238636', color: '#fff' }} />
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        /api/rest/send/text
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#8b949e' }}>
                        - Enviar mensaje de texto
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ bgcolor: '#0d1117' }}>
                    <Typography variant="subtitle2" gutterBottom>Parámetros (JSON):</Typography>
                    <Box sx={{ bgcolor: '#161b22', p: 2, borderRadius: 2, mb: 2, border: '1px solid #30363d' }}>
                      <pre style={{ margin: 0, fontSize: '12px', color: '#79c0ff' }}>
                        {`{
  "to": "595981234567",        // Número de teléfono (con código de país)
  "message": "Hola desde API"  // Mensaje a enviar
}`}
                      </pre>
                    </Box>

                    <Typography variant="subtitle2" gutterBottom>Ejemplo cURL:</Typography>
                    <Box sx={{ bgcolor: '#0d1117', color: '#79c0ff', p: 2, borderRadius: 2, mb: 2, border: '1px solid #30363d' }}>
                      <pre style={{ margin: 0, fontSize: '11px', overflowX: 'auto' }}>
                        {codeExamples.curl_text}
                      </pre>
                    </Box>

                    <Button
                      size="small"
                      startIcon={<ContentCopy />}
                      onClick={() => copyToClipboard(codeExamples.curl_text)}
                      sx={{ color: '#58a6ff' }}
                    >
                      Copiar cURL
                    </Button>
                  </AccordionDetails>
                </Accordion>

                {/* Enviar Ubicación */}
                <Accordion sx={{ bgcolor: '#161b22', color: '#e3e8ef', mb: 1 }}>
                  <AccordionSummary expandIcon={<ExpandMore sx={{ color: '#8b949e' }} />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip label="POST" size="small" sx={{ bgcolor: '#238636', color: '#fff' }} />
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>/api/rest/send/location</Typography>
                      <Typography variant="body2" sx={{ color: '#8b949e' }}>- Enviar ubicación</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ bgcolor: '#0d1117' }}>
                    <Typography variant="subtitle2" gutterBottom>Parámetros (JSON):</Typography>
                    <Box sx={{ bgcolor: '#161b22', p: 2, borderRadius: 2, mb: 1, border: '1px solid #30363d' }}>
                      <pre style={{ margin: 0, fontSize: '11px', color: '#79c0ff' }}>{`{
  "to": "595981234567",
  "latitude": -25.2819,
  "longitude": -57.6350,
  "name": "Nombre",
  "address": "Dirección"
}`}</pre>
                    </Box>
                    <Button size="small" startIcon={<ContentCopy />} onClick={() => copyToClipboard(codeExamples.curl_location)} sx={{ color: '#58a6ff' }}>Copiar cURL</Button>
                  </AccordionDetails>
                </Accordion>

                {/* Enviar Contacto */}
                <Accordion sx={{ bgcolor: '#161b22', color: '#e3e8ef', mb: 1 }}>
                  <AccordionSummary expandIcon={<ExpandMore sx={{ color: '#8b949e' }} />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip label="POST" size="small" sx={{ bgcolor: '#238636', color: '#fff' }} />
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>/api/rest/send/contact</Typography>
                      <Typography variant="body2" sx={{ color: '#8b949e' }}>- Enviar contacto (vCard)</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ bgcolor: '#0d1117' }}>
                    <Typography variant="subtitle2" gutterBottom>Parámetros (JSON):</Typography>
                    <Box sx={{ bgcolor: '#161b22', p: 2, borderRadius: 2, mb: 1, border: '1px solid #30363d' }}>
                      <pre style={{ margin: 0, fontSize: '11px', color: '#79c0ff' }}>{`{
  "to": "595981234567",
  "contactName": "Juan Pérez",
  "vcard": "BEGIN:VCARD\\\\n..."
}`}</pre>
                    </Box>
                    <Button size="small" startIcon={<ContentCopy />} onClick={() => copyToClipboard(codeExamples.curl_contact)} sx={{ color: '#58a6ff' }}>Copiar cURL</Button>
                  </AccordionDetails>
                </Accordion>

                {/* Botones Interactivos */}
                <Accordion sx={{ bgcolor: '#161b22', color: '#e3e8ef', mb: 1 }}>
                  <AccordionSummary expandIcon={<ExpandMore sx={{ color: '#8b949e' }} />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip label="POST" size="small" sx={{ bgcolor: '#238636', color: '#fff' }} />
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>/api/rest/send/buttons</Typography>
                      <Typography variant="body2" sx={{ color: '#8b949e' }}>- Botones interactivos</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ bgcolor: '#0d1117' }}>
                    <Typography variant="subtitle2" gutterBottom>Ejemplo Body:</Typography>
                    <Box sx={{ bgcolor: '#161b22', p: 2, borderRadius: 2, mb: 1, border: '1px solid #30363d' }}>
                      <pre style={{ margin: 0, fontSize: '11px', color: '#79c0ff' }}>{`{
  "to": "number",
  "text": "mensaje",
  "buttons": [{"id":"1", "text":"Btn"}]
}`}</pre>
                    </Box>
                    <Button size="small" startIcon={<ContentCopy />} onClick={() => copyToClipboard(codeExamples.curl_buttons)} sx={{ color: '#58a6ff' }}>Copiar cURL</Button>
                  </AccordionDetails>
                </Accordion>

                {/* Sticker */}
                <Accordion sx={{ bgcolor: '#161b22', color: '#e3e8ef', mb: 1 }}>
                  <AccordionSummary expandIcon={<ExpandMore sx={{ color: '#8b949e' }} />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip label="POST" size="small" sx={{ bgcolor: '#238636', color: '#fff' }} />
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>/api/rest/send/sticker</Typography>
                      <Typography variant="body2" sx={{ color: '#8b949e' }}>- Enviar Sticker</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ bgcolor: '#0d1117' }}>
                    <Typography variant="subtitle2" gutterBottom>Parámetros (JSON):</Typography>
                    <Box sx={{ bgcolor: '#161b22', p: 2, borderRadius: 2, mb: 1, border: '1px solid #30363d' }}>
                      <pre style={{ margin: 0, fontSize: '11px', color: '#79c0ff' }}>{`{
  "to": "595981234567",
  "sticker": "https://example.com/sticker.webp"
}`}</pre>
                    </Box>
                    <Button size="small" startIcon={<ContentCopy />} onClick={() => copyToClipboard(codeExamples.curl_sticker)} sx={{ color: '#58a6ff' }}>Copiar cURL</Button>
                  </AccordionDetails>
                </Accordion>

                {/* Menú de Lista */}
                <Accordion sx={{ bgcolor: '#161b22', color: '#e3e8ef', mb: 1 }}>
                  <AccordionSummary expandIcon={<ExpandMore sx={{ color: '#8b949e' }} />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip label="POST" size="small" sx={{ bgcolor: '#238636', color: '#fff' }} />
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>/api/rest/send/list</Typography>
                      <Typography variant="body2" sx={{ color: '#8b949e' }}>- Menú de lista</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ bgcolor: '#0d1117' }}>
                    <Typography variant="subtitle2" gutterBottom>Parámetros (JSON):</Typography>
                    <Box sx={{ bgcolor: '#161b22', p: 2, borderRadius: 2, mb: 1, border: '1px solid #30363d' }}>
                      <pre style={{ margin: 0, fontSize: '11px', color: '#79c0ff' }}>{`{
  "to": "number",
  "text": "mensaje",
  "title": "título",
  "buttonText": "botón",
  "sections": [...]
}`}</pre>
                    </Box>
                    <Button size="small" startIcon={<ContentCopy />} onClick={() => copyToClipboard(codeExamples.curl_list)} sx={{ color: '#58a6ff' }}>Copiar cURL</Button>
                  </AccordionDetails>
                </Accordion>

                {/* Plantilla */}
                <Accordion sx={{ bgcolor: '#161b22', color: '#e3e8ef', mb: 1 }}>
                  <AccordionSummary expandIcon={<ExpandMore sx={{ color: '#8b949e' }} />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip label="POST" size="small" sx={{ bgcolor: '#238636', color: '#fff' }} />
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>/api/rest/send/template</Typography>
                      <Typography variant="body2" sx={{ color: '#8b949e' }}>- Enviar plantilla (Meta)</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ bgcolor: '#0d1117' }}>
                    <Typography variant="subtitle2" gutterBottom>Parámetros (JSON):</Typography>
                    <Box sx={{ bgcolor: '#161b22', p: 2, borderRadius: 2, mb: 1, border: '1px solid #30363d' }}>
                      <pre style={{ margin: 0, fontSize: '11px', color: '#79c0ff' }}>{`{
  "to": "number",
  "templateId": "name",
  "language": "en_US",
  "components": []
}`}</pre>
                    </Box>
                    <Button size="small" startIcon={<ContentCopy />} onClick={() => copyToClipboard(codeExamples.curl_template)} sx={{ color: '#58a6ff' }}>Copiar cURL</Button>
                  </AccordionDetails>
                </Accordion>

                {/* Webhooks Section */}
                <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>🔗 Webhooks</Typography>
                <Accordion sx={{ bgcolor: '#161b22', color: '#e3e8ef', mb: 1 }}>
                  <AccordionSummary expandIcon={<ExpandMore sx={{ color: '#8b949e' }} />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip label="POST" size="small" sx={{ bgcolor: '#238636', color: '#fff' }} />
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>/api/rest/webhooks/register</Typography>
                      <Typography variant="body2" sx={{ color: '#8b949e' }}>- Registrar webhook</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ bgcolor: '#0d1117' }}>
                    <Typography variant="body2" sx={{ mb: 2 }}>Registra una URL para recibir eventos en tiempo real (message.received, message.sent).</Typography>
                    <Button size="small" startIcon={<ContentCopy />} onClick={() => copyToClipboard(codeExamples.curl_webhook_reg)} sx={{ color: '#58a6ff' }}>Copiar cURL</Button>
                  </AccordionDetails>
                </Accordion>

                {/* Extended API Section */}
                <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>🚀 Extended API</Typography>
                <Typography variant="body2" sx={{ mb: 2, color: '#8b949e' }}>
                  Endpoints para gestionar todos los módulos del sistema (Grupos, Chatbot, Campañas, etc).
                  Formato: <code style={{ color: '#58a6ff' }}>/api/rest/extended/:module/:action</code>
                </Typography>
                <Box sx={{ bgcolor: '#0d1117', p: 2, borderRadius: 2, border: '1px solid #30363d', mb: 3 }}>
                  <Typography variant="caption" display="block" color="#8b949e">Ejemplos:</Typography>
                  <code style={{ fontSize: '12px', color: '#79c0ff' }}>
                    GET /api/rest/extended/account/info<br />
                    GET /api/rest/extended/groups<br />
                    POST /api/rest/extended/chatbot/flows (create)<br />
                    GET /api/rest/extended/analytics/dashboard
                  </code>
                </Box>

                <Divider sx={{ my: 3, borderColor: '#30363d' }} />

                <Typography variant="h6" gutterBottom>💻 Ejemplos de Código</Typography>

                <Accordion sx={{ bgcolor: '#161b22', color: '#e3e8ef' }}>
                  <AccordionSummary expandIcon={<ExpandMore sx={{ color: '#8b949e' }} />}>
                    <Typography variant="body1">JavaScript / Node.js</Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ bgcolor: '#0d1117' }}>
                    <Box sx={{ bgcolor: '#161b22', color: '#79c0ff', p: 2, borderRadius: 2, border: '1px solid #30363d' }}>
                      <pre style={{ margin: 0, fontSize: '12px', overflowX: 'auto' }}>
                        {codeExamples.javascript}
                      </pre>
                    </Box>
                    <Button
                      size="small"
                      startIcon={<ContentCopy />}
                      onClick={() => copyToClipboard(codeExamples.javascript)}
                      sx={{ mt: 1, color: '#58a6ff' }}
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
            <Card sx={{ bgcolor: '#1a2332', color: '#e3e8ef' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>🧪 Probar API en Vivo</Typography>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel sx={{ color: '#8b949e' }}>Selecciona API Key</InputLabel>
                  <Select
                    value={selectedApiKey}
                    onChange={(e) => setSelectedApiKey(e.target.value)}
                    label="Selecciona API Key"
                    sx={{ color: '#e3e8ef', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#30363d' } }}
                  >
                    {apiKeys.filter(k => k.is_active).map((key) => (
                      <MenuItem key={key.id} value={key.api_key} sx={{ bgcolor: '#0d1117', color: '#e3e8ef' }}>
                        {key.name} ({key.api_key.substring(0, 15)}...)
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel sx={{ color: '#8b949e' }}>Tipo de Mensaje</InputLabel>
                  <Select
                    value={testEndpoint}
                    onChange={(e) => setTestEndpoint(e.target.value)}
                    label="Tipo de Mensaje"
                    sx={{ color: '#e3e8ef', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#30363d' } }}
                  >
                    <MenuItem value="text" sx={{ bgcolor: '#0d1117', color: '#e3e8ef' }}>📝 Mensaje de Texto</MenuItem>
                    <MenuItem value="image" sx={{ bgcolor: '#0d1117', color: '#e3e8ef' }}>🖼️ Imagen (URL)</MenuItem>
                    <MenuItem value="location" sx={{ bgcolor: '#0d1117', color: '#e3e8ef' }}>📍 Ubicación</MenuItem>
                    <MenuItem value="contact" sx={{ bgcolor: '#0d1117', color: '#e3e8ef' }}>👤 Contacto (vCard)</MenuItem>
                    <MenuItem value="sticker" sx={{ bgcolor: '#0d1117', color: '#e3e8ef' }}>🎭 Sticker</MenuItem>
                    <MenuItem value="buttons" sx={{ bgcolor: '#0d1117', color: '#e3e8ef' }}>🔘 Botones Interactivos</MenuItem>
                    <MenuItem value="list" sx={{ bgcolor: '#0d1117', color: '#e3e8ef' }}>📜 Menú de Lista</MenuItem>
                    <MenuItem value="template" sx={{ bgcolor: '#0d1117', color: '#e3e8ef' }}>📄 Plantilla (Template)</MenuItem>
                    <MenuItem value="document" sx={{ bgcolor: '#0d1117', color: '#e3e8ef' }}>📎 Documento (URL)</MenuItem>
                    <MenuItem value="file" sx={{ bgcolor: '#0d1117', color: '#e3e8ef' }}>📤 Archivo (Upload)</MenuItem>
                    <MenuItem value="webhook_register" sx={{ bgcolor: '#0d1117', color: '#e3e8ef' }}>🔗 Registrar Webhook</MenuItem>
                    <MenuItem value="webhook_list" sx={{ bgcolor: '#0d1117', color: '#e3e8ef' }}>📋 Listar Webhooks</MenuItem>
                    <MenuItem value="extended" sx={{ bgcolor: '#0d1117', color: '#e3e8ef' }}>🚀 Extended API (Módulos)</MenuItem>
                    <MenuItem value="status" sx={{ bgcolor: '#0d1117', color: '#e3e8ef' }}>🔌 Estado de Conexión</MenuItem>
                  </Select>
                </FormControl>

                {testEndpoint !== 'status' && !testEndpoint.startsWith('webhook_') && testEndpoint !== 'extended' && (
                  <>
                    <TextField
                      fullWidth
                      label="Número de destino"
                      placeholder="595981234567"
                      value={testTo}
                      onChange={(e) => setTestTo(e.target.value)}
                      sx={{
                        mb: 2,
                        '& .MuiInputBase-input': { color: '#e3e8ef' },
                        '& .MuiInputLabel-root': { color: '#8b949e' },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#30363d' }
                      }}
                    />

                    {testEndpoint === 'image' && (
                      <TextField
                        fullWidth
                        label="URL de la Imagen"
                        placeholder="https://example.com/imagen.jpg"
                        value={testImageUrl}
                        onChange={(e) => setTestImageUrl(e.target.value)}
                        sx={{
                          mb: 2,
                          '& .MuiInputBase-input': { color: '#e3e8ef' },
                          '& .MuiInputLabel-root': { color: '#8b949e' },
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#30363d' }
                        }}
                      />
                    )}

                    {['text', 'image', 'buttons', 'list'].includes(testEndpoint) && (
                      <TextField
                        fullWidth
                        multiline
                        rows={testEndpoint === 'text' ? 4 : 2}
                        label={testEndpoint === 'image' ? "Pie de foto (Caption)" : "Mensaje / Caption"}
                        value={testMessage}
                        onChange={(e) => setTestMessage(e.target.value)}
                        sx={{
                          mb: 2,
                          '& .MuiInputBase-input': { color: '#e3e8ef' },
                          '& .MuiInputLabel-root': { color: '#8b949e' },
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#30363d' }
                        }}
                      />
                    )}

                    {testEndpoint === 'location' && (
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={6}>
                          <TextField fullWidth label="Latitud" value={testLatitude} onChange={(e) => setTestLatitude(e.target.value)} sx={{ '& .MuiInputBase-input': { color: '#e3e8ef' }, '& .MuiInputLabel-root': { color: '#8b949e' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#30363d' } }} />
                        </Grid>
                        <Grid item xs={6}>
                          <TextField fullWidth label="Longitud" value={testLongitude} onChange={(e) => setTestLongitude(e.target.value)} sx={{ '& .MuiInputBase-input': { color: '#e3e8ef' }, '& .MuiInputLabel-root': { color: '#8b949e' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#30363d' } }} />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField fullWidth label="Nombre del lugar" value={testLocationName} onChange={(e) => setTestLocationName(e.target.value)} sx={{ '& .MuiInputBase-input': { color: '#e3e8ef' }, '& .MuiInputLabel-root': { color: '#8b949e' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#30363d' } }} />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField fullWidth label="Dirección" value={testLocationAddress} onChange={(e) => setTestLocationAddress(e.target.value)} sx={{ '& .MuiInputBase-input': { color: '#e3e8ef' }, '& .MuiInputLabel-root': { color: '#8b949e' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#30363d' } }} />
                        </Grid>
                      </Grid>
                    )}

                    {testEndpoint === 'contact' && (
                      <>
                        <TextField fullWidth label="Nombre del contacto" value={testContactName} onChange={(e) => setTestContactName(e.target.value)} sx={{ mb: 2, '& .MuiInputBase-input': { color: '#e3e8ef' }, '& .MuiInputLabel-root': { color: '#8b949e' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#30363d' } }} />
                        <TextField fullWidth multiline rows={4} label="vCard (formato texto)" value={testVCard} onChange={(e) => setTestVCard(e.target.value)} sx={{ mb: 2, '& .MuiInputBase-input': { color: '#e3e8ef' }, '& .MuiInputLabel-root': { color: '#8b949e' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#30363d' } }} />
                      </>
                    )}

                    {testEndpoint === 'sticker' && (
                      <TextField fullWidth label="URL del Sticker (WebP)" value={testStickerUrl} onChange={(e) => setTestStickerUrl(e.target.value)} sx={{ mb: 2, '& .MuiInputBase-input': { color: '#e3e8ef' }, '& .MuiInputLabel-root': { color: '#8b949e' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#30363d' } }} />
                    )}

                    {testEndpoint === 'buttons' && (
                      <TextField fullWidth multiline rows={4} label="Botones (JSON Array)" value={testButtons} onChange={(e) => setTestButtons(e.target.value)} sx={{ mb: 2, '& .MuiInputBase-input': { color: '#e3e8ef' }, '& .MuiInputLabel-root': { color: '#8b949e' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#30363d' } }} />
                    )}

                    {testEndpoint === 'list' && (
                      <TextField fullWidth multiline rows={6} label="Datos de lista (JSON)" value={testList} onChange={(e) => setTestList(e.target.value)} sx={{ mb: 2, '& .MuiInputBase-input': { color: '#e3e8ef' }, '& .MuiInputLabel-root': { color: '#8b949e' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#30363d' } }} />
                    )}

                    {testEndpoint === 'template' && (
                      <TextField fullWidth multiline rows={6} label="Plantilla (JSON)" value={testTemplate} onChange={(e) => setTestTemplate(e.target.value)} sx={{ mb: 2, '& .MuiInputBase-input': { color: '#e3e8ef' }, '& .MuiInputLabel-root': { color: '#8b949e' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#30363d' } }} />
                    )}

                    {testEndpoint === 'document' && (
                      <TextField
                        fullWidth
                        label="URL de Documento"
                        placeholder="https://example.com/file.pdf"
                        value={testFileUrl}
                        onChange={(e) => setTestFileUrl(e.target.value)}
                        sx={{
                          mb: 2,
                          '& .MuiInputBase-input': { color: '#e3e8ef' },
                          '& .MuiInputLabel-root': { color: '#8b949e' },
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#30363d' }
                        }}
                      />
                    )}
                  </>
                )}

                {testEndpoint === 'webhook_register' && (
                  <>
                    <TextField fullWidth label="URL del Webhook" placeholder="https://mi-servidor.com/webhook" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} sx={{ mb: 2, '& .MuiInputBase-input': { color: '#e3e8ef' }, '& .MuiInputLabel-root': { color: '#8b949e' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#30363d' } }} />
                    <Typography variant="caption" sx={{ color: '#8b949e', mb: 1, display: 'block' }}>Eventos (JSON Array):</Typography>
                    <TextField fullWidth value={JSON.stringify(webhookEvents)} onChange={(e) => { try { setWebhookEvents(JSON.parse(e.target.value)); } catch (err) { } }} sx={{ mb: 2, '& .MuiInputBase-input': { color: '#e3e8ef' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#30363d' } }} />
                  </>
                )}

                {testEndpoint === 'extended' && (
                  <>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel sx={{ color: '#8b949e' }}>Módulo</InputLabel>
                      <Select value={extendedModule} onChange={(e) => setExtendedModule(e.target.value)} label="Módulo" sx={{ color: '#e3e8ef', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#30363d' } }}>
                        <MenuItem value="account">👤 Cuenta</MenuItem>
                        <MenuItem value="groups">👥 Grupos</MenuItem>
                        <MenuItem value="chatbot">🤖 Chatbot</MenuItem>
                        <MenuItem value="campaigns">📢 Campañas</MenuItem>
                        <MenuItem value="contacts">👥 Contactos</MenuItem>
                        <MenuItem value="kanban">📋 Kanban</MenuItem>
                        <MenuItem value="statuses">📱 Estados</MenuItem>
                        <MenuItem value="agents">🎧 Agentes</MenuItem>
                        <MenuItem value="analytics">📈 Analytics</MenuItem>
                      </Select>
                    </FormControl>
                    <TextField fullWidth label="Acción (Endpoint)" placeholder="info / list / create..." value={extendedAction} onChange={(e) => setExtendedAction(e.target.value)} sx={{ mb: 2, '& .MuiInputBase-input': { color: '#e3e8ef' }, '& .MuiInputLabel-root': { color: '#8b949e' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#30363d' } }} />
                    <TextField fullWidth multiline rows={4} label="Parámetros (JSON)" value={extendedParams} onChange={(e) => setExtendedParams(e.target.value)} sx={{ mb: 2, '& .MuiInputBase-input': { color: '#e3e8ef' }, '& .MuiInputLabel-root': { color: '#8b949e' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#30363d' } }} />
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
            <Card sx={{ bgcolor: '#1a2332', color: '#e3e8ef' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>📊 Resultado</Typography>

                {!testResult ? (
                  <Alert severity="info" sx={{ bgcolor: '#1a3a52', color: '#e3e8ef' }}>
                    Configura los parámetros y presiona "Probar API" para ver el resultado
                  </Alert>
                ) : (
                  <>
                    <Alert severity={testResult.success ? 'success' : 'error'} sx={{ mb: 2, bgcolor: testResult.success ? '#1a4d2e' : '#4d1a1a', color: '#e3e8ef' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {testResult.success ? '✅ Éxito' : '❌ Error'}
                      </Typography>
                    </Alert>

                    <Box sx={{ bgcolor: '#0d1117', color: '#79c0ff', p: 2, borderRadius: 2, border: '1px solid #30363d' }}>
                      <pre style={{ margin: 0, fontSize: '12px', overflowX: 'auto' }}>
                        {JSON.stringify(testResult, null, 2)}
                      </pre>
                    </Box>

                    <Button
                      size="small"
                      startIcon={<ContentCopy />}
                      onClick={() => copyToClipboard(JSON.stringify(testResult, null, 2))}
                      sx={{ mt: 1, color: '#58a6ff' }}
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

      {/* Dialog para generar nueva API Key - TEMA OSCURO ELEGANTE */}
      <Dialog
        open={showNewKeyDialog}
        onClose={() => setShowNewKeyDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1a2332',
            color: '#e3e8ef',
            backgroundImage: 'none'
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid #30363d' }}>🔑 Generar Nueva API Key</DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {generatedKey ? (
            <>
              <Alert severity="success" sx={{ mb: 2, bgcolor: '#1a4d2e', color: '#e3e8ef' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircle />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    API Key generada exitosamente
                  </Typography>
                </Box>
              </Alert>

              <Alert severity="warning" sx={{ mb: 2, bgcolor: '#4d3a1a', color: '#e3e8ef' }}>
                <Typography variant="body2">
                  ⚠️ Copia y guarda esta API Key en un lugar seguro. <strong>No podrás verla nuevamente.</strong>
                </Typography>
              </Alert>

              <Box sx={{
                bgcolor: '#0d1117',
                p: 2,
                borderRadius: 2,
                mb: 2,
                border: '2px solid #25d366',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <code style={{ flex: 1, fontSize: '13px', wordBreak: 'break-all', color: '#58a6ff' }}>
                  {generatedKey}
                </code>
                <IconButton onClick={() => copyToClipboard(generatedKey)} sx={{ color: '#25d366' }}>
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
                sx={{
                  mb: 2,
                  mt: 2,
                  '& .MuiInputBase-input': { color: '#e3e8ef' },
                  '& .MuiInputLabel-root': { color: '#8b949e' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#30363d' }
                }}
              />
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Descripción (opcional)"
                placeholder="Para integración con mi app..."
                value={newKeyDescription}
                onChange={(e) => setNewKeyDescription(e.target.value)}
                sx={{
                  '& .MuiInputBase-input': { color: '#e3e8ef' },
                  '& .MuiInputLabel-root': { color: '#8b949e' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#30363d' }
                }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid #30363d', pt: 2 }}>
          {generatedKey ? (
            <Button
              variant="contained"
              onClick={() => {
                setShowNewKeyDialog(false);
                setGeneratedKey('');
              }}
              sx={{ bgcolor: '#25d366', '&:hover': { bgcolor: '#1da851' } }}
            >
              Cerrar
            </Button>
          ) : (
            <>
              <Button onClick={() => setShowNewKeyDialog(false)} sx={{ color: '#8b949e' }}>Cancelar</Button>
              <Button
                variant="contained"
                onClick={handleGenerateKey}
                disabled={!newKeyName}
                sx={{ bgcolor: '#25d366', '&:hover': { bgcolor: '#1da851' } }}
              >
                Generar
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Snackbar para notificaciones */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{
            bgcolor: snackbar.severity === 'success' ? '#1a4d2e' : snackbar.severity === 'error' ? '#4d1a1a' : '#1a3a52',
            color: '#e3e8ef',
            '& .MuiAlert-icon': { color: '#e3e8ef' }
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default APIRestSettings;
