import React, { useState } from 'react';
import {
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Chip
} from '@mui/material';
import {
  AdminPanelSettings,
  Email,
  Lock,
  Visibility,
  VisibilityOff,
  Business,
  Security,
  Analytics,
  People
} from '@mui/icons-material';
import { getAPIBaseURL } from '../../utils/socketConfig';

interface AdminLoginProps {
  onLogin: (adminData: any) => void;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleInputChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setCredentials(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!credentials.email || !credentials.password) {
      setError('Por favor ingresa email y contraseña');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onLogin({
          admin: data.admin,
          token: data.token
        });
      } else {
        setError(data.error || 'Credenciales inválidas');
      }
    } catch (err) {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSubmit(event as any);
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      p: 2
    }}>
      <Container maxWidth="sm">
        <Paper 
          elevation={24}
          sx={{ 
            p: 6,
            borderRadius: 4,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}
        >
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              mb: 3
            }}>
              <AdminPanelSettings sx={{ 
                fontSize: 60, 
                color: '#667eea',
                mr: 2
              }} />
              <Box>
                <Typography variant="h3" sx={{ 
                  fontWeight: 700, 
                  color: '#2d3748',
                  lineHeight: 1
                }}>
                  WhatsFlow
                </Typography>
                <Typography variant="h6" sx={{ 
                  color: '#667eea',
                  fontWeight: 500
                }}>
                  Panel de Administración
                </Typography>
              </Box>
            </Box>
            
            <Typography variant="body1" sx={{ 
              color: '#64748b',
              mb: 3
            }}>
              Accede al panel de control empresarial
            </Typography>

            {/* Features chips */}
            <Box sx={{ 
              display: 'flex', 
              gap: 1, 
              justifyContent: 'center',
              flexWrap: 'wrap',
              mb: 3
            }}>
              <Chip 
                icon={<Business />} 
                label="Gestión Empresarial" 
                size="small"
                sx={{ bgcolor: '#e6f3ff', color: '#0066cc' }}
              />
              <Chip 
                icon={<People />} 
                label="Control de Usuarios" 
                size="small"
                sx={{ bgcolor: '#f0f9ff', color: '#0284c7' }}
              />
              <Chip 
                icon={<Analytics />} 
                label="Analytics Avanzados" 
                size="small"
                sx={{ bgcolor: '#fef3e2', color: '#d97706' }}
              />
              <Chip 
                icon={<Security />} 
                label="Seguridad" 
                size="small"
                sx={{ bgcolor: '#f0fdf4', color: '#16a34a' }}
              />
            </Box>
          </Box>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                label="Email Administrador"
                type="email"
                value={credentials.email}
                onChange={handleInputChange('email')}
                onKeyPress={handleKeyPress}
                disabled={loading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email sx={{ color: '#667eea' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 3,
                    '& fieldset': {
                      borderColor: '#e2e8f0',
                    },
                    '&:hover fieldset': {
                      borderColor: '#667eea',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#667eea',
                    },
                  },
                }}
              />
            </Box>

            <Box sx={{ mb: 4 }}>
              <TextField
                fullWidth
                label="Contraseña"
                type={showPassword ? 'text' : 'password'}
                value={credentials.password}
                onChange={handleInputChange('password')}
                onKeyPress={handleKeyPress}
                disabled={loading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock sx={{ color: '#667eea' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={togglePasswordVisibility}
                        edge="end"
                        disabled={loading}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 3,
                    '& fieldset': {
                      borderColor: '#e2e8f0',
                    },
                    '&:hover fieldset': {
                      borderColor: '#667eea',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#667eea',
                    },
                  },
                }}
              />
            </Box>

            {error && (
              <Alert 
                severity="error" 
                sx={{ 
                  mb: 3,
                  borderRadius: 2
                }}
              >
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading || !credentials.email || !credentials.password}
              sx={{
                py: 2,
                borderRadius: 3,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                fontWeight: 600,
                fontSize: '1.1rem',
                textTransform: 'none',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 25px rgba(102, 126, 234, 0.3)'
                },
                '&:disabled': {
                  background: '#e2e8f0',
                  color: '#64748b'
                },
                transition: 'all 0.3s ease'
              }}
            >
              {loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CircularProgress size={20} color="inherit" />
                  Iniciando sesión...
                </Box>
              ) : (
                'Acceder al Panel'
              )}
            </Button>
          </form>

          {/* Footer */}
          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              WhatsFlow © 2025 - Plataforma Empresarial de Mensajería
            </Typography>
            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
              Versión 1.0.0 | Seguridad de nivel empresarial
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default AdminLogin; 