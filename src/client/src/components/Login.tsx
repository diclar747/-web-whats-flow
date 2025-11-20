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
  onLoginSuccess: (user: any, token: string) => void;
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

        // Llamar al callback con los datos de usuario
        onLoginSuccess(data.user, data.token);

        // SEGURIDAD: Ya no buscamos sesiones activas de otros usuarios
        // Cada usuario debe tener su propio sessionId vinculado a su cuenta
        const finalSessionId = data.sessionId || sessionStorage.getItem('whatsflow_session');

        if (finalSessionId) {
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
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        p: 2
      }}
    >
      <Card sx={{ maxWidth: 400, width: '100%', boxShadow: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <LoginIcon sx={{ fontSize: 40, color: 'white' }} />
            </Box>
            <Typography variant="h4" component="h1" gutterBottom>
              WhatsFlow
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Inicia sesión en tu cuenta
            </Typography>
          </Box>

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
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email />
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
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      disabled={loading}
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
              sx={{
                mt: 1,
                mb: 2,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)',
                },
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
