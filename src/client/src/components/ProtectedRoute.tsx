import React from 'react';
import { Navigate } from 'react-router-dom';
import { Box, Typography, Paper, Button } from '@mui/material';
import { Lock as LockIcon, ArrowBack } from '@mui/icons-material';
import { usePermissions } from '../hooks/usePermissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  module?: string; // Módulo requerido (ej: 'chat', 'campaign')
  action?: 'view' | 'create' | 'edit' | 'delete'; // Acción requerida
  requireAuth?: boolean; // Si requiere estar autenticado (default: true)
  canAccess?: boolean; // Condición personalizada de acceso
  redirectPath?: string; // Ruta de redirección si falla
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  module,
  action = 'view',
  requireAuth = true,
  canAccess,
  redirectPath
}) => {
  const { hasPermission, hasModuleAccess, userRole } = usePermissions();
  const token = sessionStorage.getItem('token');
  const sessionId = sessionStorage.getItem('whatsflow_session');

  // Verificar autenticación (token O sessionId de QR)
  if (requireAuth && !token && !sessionId) {
    return <Navigate to="/login" replace />;
  }

  // Verificar condición personalizada explícita si existe
  if (canAccess !== undefined) {
    if (!canAccess) {
      return redirectPath ? <Navigate to={redirectPath} replace /> : <Navigate to="/dashboard" replace />;
    }
    return <>{children}</>;
  }

  // Si no requiere módulo específico, mostrar contenido
  if (!module) {
    return <>{children}</>;
  }

  // Si tiene sessionId pero no userRole, es admin con QR - acceso completo
  if (sessionId && !userRole) {
    return <>{children}</>;
  }

  // Admin siempre tiene acceso
  if (userRole === 'admin') {
    return <>{children}</>;
  }

  // Verificar permisos del módulo
  const hasAccess = hasPermission(module, action);

  if (!hasAccess) {
    return (
      <Box
        sx={{
          minHeight: '80vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            maxWidth: 500,
            textAlign: 'center'
          }}
        >
          <LockIcon
            sx={{
              fontSize: 80,
              color: 'error.main',
              mb: 2
            }}
          />
          <Typography variant="h5" gutterBottom>
            Acceso Denegado
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            No tienes permisos para acceder a este módulo.
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Módulo: <strong>{module}</strong><br />
            Acción requerida: <strong>{action}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Si crees que deberías tener acceso, contacta al administrador.
          </Typography>
          <Button
            variant="contained"
            startIcon={<ArrowBack />}
            onClick={() => window.history.back()}
          >
            Volver
          </Button>
        </Paper>
      </Box>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
