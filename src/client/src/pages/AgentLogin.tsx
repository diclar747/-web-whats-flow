import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Container,
  Avatar,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  Person as PersonIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff
} from '@mui/icons-material';

const AgentLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Generar un deviceId único para este navegador/pestaña
      let deviceId = sessionStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('device_id', deviceId);
      }

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, deviceId })
      });

      const data = await response.json();

      if (data.success && data.token) {
        // Guardar token y datos del usuario SOLO en sessionStorage (único por pestaña)
        sessionStorage.setItem('token', data.token);
        sessionStorage.setItem('userRole', data.user.role);
        sessionStorage.setItem('userName', data.user.name);
        sessionStorage.setItem('userId', data.user.id);
        sessionStorage.setItem('sessionToken', data.sessionToken); // Token único de sesión
        
        // Si es agente o supervisor y viene sessionId, guardarlo
        if ((data.user.role === 'agent' || data.user.role === 'supervisor') && data.sessionId) {
          sessionStorage.setItem('whatsflow_session', data.sessionId);
          sessionStorage.setItem('whatsflow_user_type', 'agent');
          console.log('✅ SessionId asignado:', data.sessionId);
        }
        
        // IMPORTANTE: Limpiar localStorage para evitar sesiones compartidas
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        localStorage.removeItem('userId');
        localStorage.removeItem('whatsflow_session');
        localStorage.removeItem('whatsflow_user_type');
        
        console.log('✅ Login exitoso (sesión única):', data.user);
        
        // Redirigir al dashboard principal (no a rutas separadas)
        navigate('/dashboard');
      } else {
        setError(data.error || 'Credenciales inválidas');
      }
    } catch (err) {
      console.error('Error en login:', err);
      setError('Error de conexión. Intenta nuevamente.');
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
        background: 'linear-gradient(135deg, #00a884 0%, #25d366 100%)',
        padding: 2
      }}
    >
      <Container maxWidth="sm">
        <Card elevation={10} sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 4 }}>
            {/* Logo/Header */}
            <Box display="flex" flexDirection="column" alignItems="center" mb={3}>
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: '#00a884',
                  mb: 2
                }}
              >
                <PersonIcon sx={{ fontSize: 50 }} />
              </Avatar>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                WhatsFlow
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Acceso para Agentes
              </Typography>
            </Box>

            {/* Error Alert */}
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon color="action" />
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
                required
                autoComplete="current-password"
                sx={{ mb: 3 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading || !email || !password}
                sx={{
                  py: 1.5,
                  bgcolor: '#00a884',
                  '&:hover': {
                    bgcolor: '#008f6f'
                  }
                }}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Iniciar Sesión'
                )}
              </Button>
            </form>

            {/* Footer */}
            <Box mt={3} textAlign="center">
              <Typography variant="body2" color="text.secondary">
                ¿Problemas para ingresar?
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Contacta al administrador
              </Typography>
            </Box>

            {/* Demo Credentials */}
            <Box mt={2} p={2} bgcolor="#f5f5f5" borderRadius={1}>
              <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                <strong>Credenciales de prueba:</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                Email: claudio@cnid.com.py
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                Password: agent123
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default AgentLogin;
