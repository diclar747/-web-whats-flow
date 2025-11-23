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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false); // Nueva opción
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
        body: JSON.stringify({ email, password, deviceId })
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

        // Limpiar localStorage para evitar sesiones compartidas
        localStorage.removeItem('token');
        localStorage.removeItem('whatsflow_token');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        localStorage.removeItem('userId');
        localStorage.removeItem('whatsflow_session');
        localStorage.removeItem('userPermissions');
        localStorage.removeItem('permissionsByModule');

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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #075E54 0%, #128C7E 50%, #25D366 100%)',
        p: 2,
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.05"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          opacity: 0.3
        }
      }}
    >
      <Card sx={{ 
        maxWidth: 480, 
        width: '100%', 
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        borderRadius: 4,
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Header con gradiente */}
        <Box sx={{
          background: 'linear-gradient(135deg, #075E54 0%, #128C7E 100%)',
          py: 5,
          px: 4,
          textAlign: 'center',
          position: 'relative',
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #25D366 0%, #128C7E 100%)'
          }
        }}>
          {/* Logo de WhatsApp */}
          <Box
            sx={{
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              border: '4px solid rgba(255,255,255,0.3)'
            }}
          >
            <Box
              component="img"
              src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
              alt="WhatsApp"
              sx={{ width: 60, height: 60 }}
            />
          </Box>
          
          {/* Título */}
          <Typography 
            variant="h3" 
            component="h1" 
            sx={{ 
              color: 'white',
              fontWeight: 800,
              mb: 1,
              textShadow: '0 2px 4px rgba(0,0,0,0.2)',
              letterSpacing: '-0.5px'
            }}
          >
            WhatsFlow
          </Typography>
          
          {/* Subtítulo */}
          <Typography 
            variant="h6" 
            sx={{ 
              color: 'rgba(255,255,255,0.95)',
              fontWeight: 500,
              letterSpacing: '0.5px'
            }}
          >
            Acceso Agente
          </Typography>
        </Box>

        <CardContent sx={{ p: 5 }}>
          <Typography 
            variant="body1" 
            sx={{ 
              textAlign: 'center',
              color: 'text.secondary',
              mb: 4,
              fontWeight: 500
            }}
          >
            Inicia sesión para gestionar tus conversaciones
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleLogin}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              required
              disabled={loading}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '&:hover fieldset': {
                    borderColor: '#25D366',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#25D366',
                  }
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: '#25D366'
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email sx={{ color: '#128C7E' }} />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Contraseña"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
              disabled={loading}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '&:hover fieldset': {
                    borderColor: '#25D366',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#25D366',
                  }
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: '#25D366'
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock sx={{ color: '#128C7E' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      disabled={loading}
                      sx={{ color: '#128C7E' }}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
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
                  disabled={loading}
                />
              }
              label={
                <Typography variant="body2" color="text.secondary">
                  Recordar mi sesión (mantener sesión activa al cerrar el navegador)
                </Typography>
              }
              sx={{ mt: 2, mb: 1 }}
            />

            <Alert severity="info" sx={{ mb: 2, fontSize: '0.875rem' }}>
              {rememberMe ? (
                <>
                  <strong>Sesión permanente:</strong> Tu sesión se mantendrá activa incluso después de cerrar el navegador.
                </>
              ) : (
                <>
                  <strong>Sesión temporal:</strong> Tu sesión se cerrará automáticamente al cerrar el navegador (más seguro).
                </>
              )}
            </Alert>

            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : <LoginIcon />}
              sx={{
                mt: 3,
                mb: 2,
                py: 1.8,
                fontSize: '1.1rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                color: 'white',
                textTransform: 'none',
                borderRadius: 3,
                boxShadow: '0 8px 20px rgba(37, 211, 102, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #20c55a 0%, #0f7a6b 100%)',
                  boxShadow: '0 12px 28px rgba(37, 211, 102, 0.4)',
                  transform: 'translateY(-2px)',
                },
                '&:disabled': {
                  background: 'linear-gradient(135deg, #90EE90 0%, #76c7c0 100%)',
                  color: 'white'
                },
                transition: 'all 0.3s ease'
              }}
            >
              {loading ? <CircularProgress size={24} /> : 'Iniciar Sesión'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Login;
