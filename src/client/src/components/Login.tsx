import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import {
  Email,
  Lock,
  Visibility,
  VisibilityOff,
  Login as LoginIcon
} from '@mui/icons-material';
import { getAPIBaseURL } from '../utils/socketConfig';
import { storageManager } from '../utils/storageManager';

interface LoginProps {
  onLoginSuccess: (user: any, token: string, sessionId?: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState(''); // Email como estaba antes
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true); // Default true para comodidad
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Generar deviceId único para este navegador/pestaña
      let deviceId = sessionStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('device_id', deviceId);
      }

      const API_BASE = getAPIBaseURL();
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, deviceId }) // Email como antes
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Login exitoso:', data);

        // SIEMPRE usar sessionStorage para sesiones únicas por pestaña
        // (ignorar rememberMe por seguridad)
        sessionStorage.setItem('token', data.token);
        sessionStorage.setItem('whatsflow_token', data.token);
        sessionStorage.setItem('userRole', data.user.role);
        sessionStorage.setItem('userName', data.user.name);
        sessionStorage.setItem('userId', data.user.id);
        sessionStorage.setItem('sessionToken', data.sessionToken);

        // Guardar permisos del usuario
        if (data.permissions) {
          sessionStorage.setItem('userPermissions', JSON.stringify(data.permissions));
          sessionStorage.setItem('permissionsByModule', JSON.stringify(data.permissionsByModule));
          console.log('✅ Permisos cargados:', data.permissions.length, 'permisos');
        }

        // Gestionar persistencia según "Recordar sesión"
        if (rememberMe) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('whatsflow_token', data.token);
          localStorage.setItem('userRole', data.user.role);
          localStorage.setItem('userName', data.user.name);
          localStorage.setItem('userId', data.user.id);
          localStorage.setItem('sessionToken', data.sessionToken);
          if (data.sessionId) {
            localStorage.setItem('whatsflow_session', data.sessionId);
          }
          if (data.permissions) {
            localStorage.setItem('userPermissions', JSON.stringify(data.permissions));
            localStorage.setItem('permissionsByModule', JSON.stringify(data.permissionsByModule));
          }
          console.log('✅ Sesión guardada en localStorage (Persistente)');
        } else {
          // Si no quiere recordar, limpiar localStorage
          localStorage.removeItem('token');
          localStorage.removeItem('whatsflow_token');
          localStorage.removeItem('userRole');
          localStorage.removeItem('userName');
          localStorage.removeItem('userId');
          localStorage.removeItem('whatsflow_session');
          localStorage.removeItem('userPermissions');
          localStorage.removeItem('permissionsByModule');
          console.log('🧹 localStorage limpio (Sesión temporal)');
        }

        console.log('📦 Sesión única guardada en sessionStorage');

        // IMPORTANTE: Si el backend devuelve sessionId, guardarlo
        if (data.sessionId) {
          sessionStorage.setItem('whatsflow_session', data.sessionId);
          console.log('✅ SessionId desde BD:', data.sessionId);
        }

        // Llamar al callback con los datos de usuario Y sessionId
        onLoginSuccess(data.user, data.token, data.sessionId);

        // SEGURIDAD: Ya no buscamos sesiones activas de otros usuarios
        // Cada usuario debe tener su propio sessionId vinculado a su cuenta
        const finalSessionId = data.sessionId || sessionStorage.getItem('whatsflow_session');

        // Redirigir según el rol del usuario
        const userRole = data.user?.role;

        if (userRole === 'agent' || userRole === 'supervisor') {
          console.log('✅ Navegando al dashboard de agente');
          navigate('/dashboard');  // El mismo /dashboard mostrará AgentDashboard según el rol
        } else if (finalSessionId) {
          console.log('✅ Navegando al dashboard con sessionId:', finalSessionId);
          navigate('/dashboard');
        } else {
          console.log('⚠️ Login exitoso pero sin sessionId - Usuario debe escanear QR');
          navigate('/dashboard');
        }
      } else {
        setError(data.error || 'Error en el login');
      }
    } catch (err) {
      console.error('Error en login:', err);
      setError('Error de conexión. Por favor, inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        bgcolor: '#d1d7db', // WhatsApp Web Gray Background
        fontFamily: '"Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif',
        zIndex: 0
      }}
    >
      {/* Green Header Bar */}
      <Box sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '220px',
        bgcolor: '#00a884', // WhatsApp Web Green
        zIndex: -1
      }}>
        <Box sx={{
          maxWidth: '1000px',
          margin: '0 auto',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          px: 4
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 8 }}>
            <Box
              component="img"
              src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
              sx={{ width: 35, height: 35 }}
            />
            <Typography sx={{
              color: 'white',
              fontWeight: 600,
              fontSize: '14px',
              letterSpacing: '1.5px',
              textTransform: 'uppercase'
            }}>
              WHATSFLOW WEB
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Main Content Card */}
      <Box sx={{
        maxWidth: '1000px',
        margin: '0 auto',
        pt: '100px',
        px: 2,
        height: 'calc(100vh - 40px)', // Full height minus margin
      }}>
        <Card sx={{
          height: '75vh',
          minHeight: '500px',
          boxShadow: '0 17px 50px 0 rgba(11,20,26,.19), 0 12px 15px 0 rgba(11,20,26,.24)', // WhatsApp Web Shadows
          borderRadius: 0,
          display: 'flex',
          overflow: 'hidden'
        }}>
          {/* Left Side (Info/Promo) -> Hidden on mobile */}
          <Box sx={{
            flex: 1,
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            justifyContent: 'center',
            p: 8,
            borderRight: '1px solid rgba(0,0,0,0.08)'
          }}>
            <Typography variant="h4" sx={{
              fontWeight: 300,
              color: '#41525d',
              mb: 4,
              fontSize: '28px'
            }}>
              Usa WhatsFlow en tu computadora
            </Typography>

            <Box component="ol" sx={{ pl: 3, mb: 6, color: '#3b4a54', fontSize: '18px', lineHeight: 1.6 }}>
              <li style={{ marginBottom: '15px' }}>Inicia sesión para gestionar tus agentes</li>
              <li style={{ marginBottom: '15px' }}>Supervisa conversaciones en tiempo real</li>
              <li style={{ marginBottom: '15px' }}>Configura bots y respuestas automáticas</li>
            </Box>

            <Typography sx={{ color: '#00a884', fontWeight: 500, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
              ¿Necesitas ayuda para iniciar sesión?
            </Typography>
          </Box>

          {/* Right Side (Login Form) */}
          <Box sx={{
            width: { xs: '100%', md: '450px' },
            p: 6,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            bgcolor: 'white'
          }}>
            <Typography variant="h5" sx={{ mb: 4, color: '#41525d', textAlign: 'center' }}>
              Iniciar Sesión
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 0 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleLogin}>
              <TextField
                fullWidth
                label="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                margin="normal"
                variant="outlined"
                size="small"
                InputProps={{
                  sx: { borderRadius: 0 }
                }}
              />
              <TextField
                fullWidth
                label="Contraseña"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
                variant="outlined"
                size="small"
                InputProps={{
                  sx: { borderRadius: 0 },
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        size="small"
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    color="primary"
                    size="small"
                    sx={{ color: '#00a884', '&.Mui-checked': { color: '#00a884' } }}
                  />
                }
                label={<Typography variant="body2" sx={{ color: '#8696a0' }}>Mantener sesión iniciada</Typography>}
                sx={{ mt: 2, mb: 3 }}
              />

              <Button
                fullWidth
                type="submit"
                variant="contained"
                disabled={loading}
                sx={{
                  bgcolor: '#00a884',
                  color: 'white',
                  py: 1.5,
                  borderRadius: 6,
                  textTransform: 'none',
                  fontSize: '16px',
                  fontWeight: 600,
                  boxShadow: 'none',
                  '&:hover': {
                    bgcolor: '#008f6f',
                    boxShadow: 'none'
                  }
                }}
              >
                {loading ? <CircularProgress size={24} sx={{ color: 'white' }} /> : 'Acceder'}
              </Button>
            </form>
          </Box>
        </Card>
      </Box>
    </Box>
  );
};

export default Login;
