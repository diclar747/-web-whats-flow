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
  Login as LoginIcon,
  WhatsApp
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
        sessionStorage.setItem('whinsap_token', data.token);
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
          localStorage.setItem('whinsap_token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user)); // 🔐 Guardar usuario completo para verificación de rol
          localStorage.setItem('userRole', data.user.role);
          localStorage.setItem('userName', data.user.name);
          localStorage.setItem('userId', data.user.id);
          localStorage.setItem('sessionToken', data.sessionToken);
          if (data.sessionId) {
            localStorage.setItem('whinsap_session', data.sessionId);
          }
          if (data.permissions) {
            localStorage.setItem('userPermissions', JSON.stringify(data.permissions));
            localStorage.setItem('permissionsByModule', JSON.stringify(data.permissionsByModule));
          }
          console.log('✅ Sesión guardada en localStorage (Persistente)');
          console.log('👤 Usuario guardado:', data.user.email, '| Rol:', data.user.role);
        } else {
          // Si no quiere recordar, limpiar localStorage
          localStorage.removeItem('token');
          localStorage.removeItem('whinsap_token');
          localStorage.removeItem('user');
          localStorage.removeItem('userRole');
          localStorage.removeItem('userName');
          localStorage.removeItem('userId');
          localStorage.removeItem('whinsap_session');
          localStorage.removeItem('userPermissions');
          localStorage.removeItem('permissionsByModule');
          console.log('🧹 localStorage limpio (Sesión temporal)');
        }

        console.log('📦 Sesión única guardada en sessionStorage');

        // IMPORTANTE: Si el backend devuelve sessionId o whatsappSessionId, guardarlo
        const whatsappSession = data.whatsappSessionId || data.sessionId || data.user.id.toString();
        if (whatsappSession) {
          sessionStorage.setItem('whinsap_session', whatsappSession);
          if (rememberMe) {
            localStorage.setItem('whinsap_session', whatsappSession);
          }
          console.log('✅ WhatsApp SessionId guardado:', whatsappSession, '(userId por defecto)');
        }

        // Llamar al callback con los datos de usuario Y sessionId
        onLoginSuccess(data.user, data.token, whatsappSession);

        // Verificar estado de suscripción y redirigir a Mi Plan si corresponde
        try {
          // Usar whatsappSession si existe, sino usar phone del usuario
          const identifierForSub = whatsappSession || data.user?.phone;
          if (identifierForSub) {
            const subResp = await fetch(`${getAPIBaseURL()}/api/subscriptions/my-subscription?phone=${encodeURIComponent(identifierForSub)}`);
            const subData = await subResp.json();
            const subscription = subData?.subscription || null;
            const status = subscription?.subscription_status || 'inactive';
            const daysRemaining = subscription?.days_remaining ?? 0;
            const mustGoToPlan = !subscription || status === 'expired' || status === 'inactive' || (status === 'trial' && daysRemaining <= 0);
            if (mustGoToPlan) {
              sessionStorage.setItem('openPlanTab', 'true');
              navigate('/dashboard/settings?tab=plan');
              return;
            }
          }
        } catch (e) {
          console.warn('[LOGIN] No se pudo verificar suscripción, continuando al dashboard:', e);
        }

        // Fallback: Redirigir según el rol del usuario
        const finalSessionId = data.sessionId || sessionStorage.getItem('whinsap_session');
        const userRole = data.user?.role;
        if (userRole === 'agent' || userRole === 'supervisor') {
          navigate('/dashboard');
        } else if (finalSessionId) {
          navigate('/dashboard');
        } else {
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
        bgcolor: '#0f172a', // Dark mode background
        fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif',
        zIndex: 0
      }}
    >
      {/* Gradient Background */}
      <Box sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '100%',
        background: 'radial-gradient(circle at top right, #1e293b 0%, #0f172a 50%)',
        zIndex: -1
      }}
      />

      {/* Main Content Card */}
      <Box sx={{
        maxWidth: '1000px',
        margin: '0 auto',
        pt: '100px',
        px: 2,
        height: 'calc(100vh - 40px)',
      }}>
        <Card sx={{
          height: '75vh',
          minHeight: '500px',
          background: 'rgba(30, 41, 59, 0.6)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          borderRadius: 4,
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
            borderRight: '1px solid rgba(255,255,255,0.1)'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 16px rgba(79, 70, 229, 0.3)'
                }}
              >
                <WhatsApp sx={{ color: 'white', fontSize: 24 }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.02em', color: 'white' }}>
                Winsap
              </Typography>
            </Box>

            <Typography variant="h4" sx={{
              fontWeight: 700,
              color: 'white',
              mb: 4,
              fontSize: '28px',
              lineHeight: 1.3
            }}>
              Panel de Agentes
            </Typography>

            <Box component="ol" sx={{ pl: 3, mb: 6, color: '#cbd5e1', fontSize: '16px', lineHeight: 1.8 }}>
              <li style={{ marginBottom: '15px' }}>Gestiona conversaciones en tiempo real</li>
              <li style={{ marginBottom: '15px' }}>Accede a tu panel de control</li>
              <li style={{ marginBottom: '15px' }}>Supervisa métricas y rendimiento</li>
            </Box>

            <Typography sx={{ color: '#6366f1', fontWeight: 500, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
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
            bgcolor: 'rgba(15, 23, 42, 0.8)'
          }}>
            <Typography variant="h5" sx={{ mb: 4, color: 'white', textAlign: 'center', fontWeight: 600 }}>
              Iniciar Sesión
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2, bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
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
                  sx: {
                    borderRadius: 2,
                    bgcolor: 'rgba(30, 41, 59, 0.5)',
                    color: 'white',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: '#6366f1' },
                    '&.Mui-focused fieldset': { borderColor: '#6366f1' }
                  }
                }}
                InputLabelProps={{
                  sx: { color: '#94a3b8' }
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
                  sx: {
                    borderRadius: 2,
                    bgcolor: 'rgba(30, 41, 59, 0.5)',
                    color: 'white',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: '#6366f1' },
                    '&.Mui-focused fieldset': { borderColor: '#6366f1' }
                  },
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        size="small"
                        sx={{ color: '#94a3b8' }}
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                InputLabelProps={{
                  sx: { color: '#94a3b8' }
                }}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    color="primary"
                    size="small"
                    sx={{ color: '#6366f1', '&.Mui-checked': { color: '#6366f1' } }}
                  />
                }
                label={<Typography variant="body2" sx={{ color: '#94a3b8' }}>Mantener sesión iniciada</Typography>}
                sx={{ mt: 2, mb: 3 }}
              />

              <Button
                fullWidth
                type="submit"
                variant="contained"
                disabled={loading}
                sx={{
                  bgcolor: '#6366f1',
                  color: 'white',
                  py: 1.5,
                  borderRadius: 3,
                  textTransform: 'none',
                  fontSize: '16px',
                  fontWeight: 600,
                  boxShadow: '0 8px 16px rgba(99, 102, 241, 0.3)',
                  '&:hover': {
                    bgcolor: '#4f46e5',
                    boxShadow: '0 12px 24px rgba(99, 102, 241, 0.4)'
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
