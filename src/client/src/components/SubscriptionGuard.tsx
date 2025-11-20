import React from 'react';
import { Alert, Box, Button, Chip, Paper, Typography } from '@mui/material';
import { Block, Lock, Star, Upgrade } from '@mui/icons-material';
import { useSubscription } from '../hooks/useSubscription';

interface SubscriptionGuardProps {
  children: React.ReactNode;
  feature: 'campaigns' | 'bots' | 'chat' | 'calendar' | 'contacts';
  fallbackMode?: 'hide' | 'blur' | 'message';
}

const featureLabels = {
  campaigns: 'Campañas',
  bots: 'Chatbots',
  chat: 'Chat en Vivo',
  calendar: 'Calendario',
  contacts: 'Contactos'
};

const featureIcons = {
  campaigns: '📢',
  bots: '🤖',
  chat: '💬',
  calendar: '📅',
  contacts: '👥'
};

export const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({
  children,
  feature,
  fallbackMode = 'blur'
}) => {
  const { hasActiveSubscription, isAdmin, loading, subscription } = useSubscription();
  
  // Bypass para usuarios admin detectados en sessionStorage
  const userTypeSession = sessionStorage.getItem('whatsflow_user_type');
  const isAdminBySession = userTypeSession === 'admin';

  console.log(`[SubscriptionGuard] ${feature}:`, {
    loading,
    hasActiveSubscription,
    isAdmin,
    isAdminBySession,
    userTypeSession,
    subscription_status: subscription?.subscription_status,
    subscription_is_admin: subscription?.is_admin,
    willAllow: hasActiveSubscription || isAdmin || isAdminBySession
  });

  if (loading) {
    // Durante carga, si es admin por session, permitir acceso inmediato
    if (isAdminBySession) {
      console.log(`[SubscriptionGuard] ⚡ Admin detectado, bypass durante carga`);
      return <>{children}</>;
    }
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Verificando suscripción...</Typography>
      </Box>
    );
  }

  // Si tiene acceso (suscripción activa, es admin, o admin por session), mostrar contenido normal
  if (hasActiveSubscription || isAdmin || isAdminBySession) {
    console.log(`[SubscriptionGuard] ✅ Permitiendo acceso a ${feature} (hasActive=${hasActiveSubscription}, isAdmin=${isAdmin}, isAdminSession=${isAdminBySession})`);
    return <>{children}</>;
  }

  console.log(`[SubscriptionGuard] ❌ Bloqueando acceso a ${feature} - No cumple requisitos`);

  // Si no tiene acceso, mostrar según el modo
  const featureName = featureLabels[feature];
  const featureIcon = featureIcons[feature];

  if (fallbackMode === 'hide') {
    return null;
  }

  const blockedMessage = (
    <Paper
      elevation={3}
      sx={{
        p: 4,
        textAlign: 'center',
        background: 'linear-gradient(135deg, #667eea20 0%, #764ba220 100%)',
        border: '2px solid #667eea40',
        borderRadius: 3,
        position: 'relative'
      }}
    >
      <Box sx={{ mb: 2 }}>
        <Lock sx={{ fontSize: 64, color: '#667eea', opacity: 0.7 }} />
      </Box>

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: '#1e293b' }}>
        {featureIcon} {featureName}
      </Typography>

      <Alert 
        severity="warning" 
        icon={<Star />}
        sx={{ 
          mb: 3,
          '& .MuiAlert-message': { width: '100%' }
        }}
      >
        <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
          Esta funcionalidad requiere un plan activo
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Actualmente puedes visualizar el sistema, pero necesitas un plan de suscripción activo para usar {featureName.toLowerCase()}.
        </Typography>
      </Alert>

      {subscription && (
        <Box sx={{ mb: 3 }}>
          <Chip
            label={`Plan Actual: ${subscription.subscription_plan || 'Sin Plan'}`}
            color="default"
            size="small"
            sx={{ mr: 1 }}
          />
          <Chip
            label={subscription.subscription_status === 'expired' ? 'Expirado' : 'Inactivo'}
            color="error"
            size="small"
          />
        </Box>
      )}

      <Button
        variant="contained"
        size="large"
        startIcon={<Upgrade />}
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #5568d3 0%, #653a8b 100%)'
          },
          fontWeight: 700,
          px: 4,
          py: 1.5
        }}
        onClick={() => {
          // Aquí puedes redirigir a la página de planes
          window.location.href = '/dashboard';
        }}
      >
        Ver Planes Disponibles
      </Button>

      <Typography variant="caption" display="block" sx={{ mt: 2, color: '#64748b' }}>
        Contacta al administrador para activar tu suscripción
      </Typography>
    </Paper>
  );

  if (fallbackMode === 'message') {
    return blockedMessage;
  }

  // Modo blur: mostrar contenido con overlay
  return (
    <Box sx={{ position: 'relative' }}>
      <Box
        sx={{
          filter: 'blur(8px)',
          pointerEvents: 'none',
          userSelect: 'none',
          opacity: 0.4
        }}
      >
        {children}
      </Box>
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          width: '90%',
          maxWidth: 600
        }}
      >
        {blockedMessage}
      </Box>
    </Box>
  );
};

// Hook para validación simple sin componente visual
export const useFeatureAccess = (feature: 'campaigns' | 'bots' | 'chat' | 'calendar' | 'contacts') => {
  const { hasActiveSubscription, isAdmin, loading } = useSubscription();
  
  return {
    hasAccess: hasActiveSubscription || isAdmin,
    loading,
    isBlocked: !hasActiveSubscription && !isAdmin
  };
};
