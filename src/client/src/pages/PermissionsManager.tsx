import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  FormControlLabel,
  Divider
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

interface Permission {
  id: number;
  name: string;
  description: string;
  module: string;
}

interface RolePermission {
  permission_id: number;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

const PermissionsManager: React.FC = () => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, RolePermission[]>>({
    admin: [],
    supervisor: [],
    agent: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'supervisor' | 'agent'>('agent');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/permissions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        setPermissions(data.permissions);
        await loadRolePermissions();
      }
    } catch (err) {
      console.error('Error loading permissions:', err);
      setError('Error cargando permisos');
    } finally {
      setLoading(false);
    }
  };

  const loadRolePermissions = async () => {
    // Cargar permisos actuales de cada rol
    // En producción, esto vendría de la API
    const roles: Array<'admin' | 'supervisor' | 'agent'> = ['admin', 'supervisor', 'agent'];
    const newRolePerms: Record<string, RolePermission[]> = {};

    for (const role of roles) {
      // Aquí cargarías de la API los permisos del rol
      // Por ahora, inicializamos vacío
      newRolePerms[role] = permissions.map(p => ({
        permission_id: p.id,
        can_view: role === 'admin', // Admin tiene todo por defecto
        can_create: role === 'admin',
        can_edit: role === 'admin',
        can_delete: role === 'admin'
      }));
    }

    setRolePermissions(newRolePerms);
  };

  const handlePermissionChange = (
    permissionId: number,
    action: 'can_view' | 'can_create' | 'can_edit' | 'can_delete',
    value: boolean
  ) => {
    setRolePermissions(prev => {
      const rolePerms = [...prev[selectedRole]];
      const index = rolePerms.findIndex(p => p.permission_id === permissionId);
      
      if (index !== -1) {
        rolePerms[index] = {
          ...rolePerms[index],
          [action]: value
        };
      }

      return {
        ...prev,
        [selectedRole]: rolePerms
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/roles/${selectedRole}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          permissions: rolePermissions[selectedRole]
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess('Permisos actualizados correctamente');
      } else {
        setError(data.error || 'Error actualizando permisos');
      }
    } catch (err) {
      console.error('Error saving permissions:', err);
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const getPermissionByModule = (module: string) => {
    return permissions.filter(p => p.module === module);
  };

  const modules = Array.from(new Set(permissions.map(p => p.module)));

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'error';
      case 'supervisor': return 'warning';
      case 'agent': return 'primary';
      default: return 'default';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return '👑 Administrador';
      case 'supervisor': return '👔 Supervisor';
      case 'agent': return '👤 Agente';
      default: return role;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Gestión de Permisos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configura los permisos por rol del sistema
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadPermissions}
          >
            Actualizar
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </Box>
      </Box>

      {/* Alertas */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Selector de Rol */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Seleccionar Rol
          </Typography>
          <Tabs
            value={selectedRole}
            onChange={(e, v) => setSelectedRole(v)}
            variant="fullWidth"
          >
            <Tab
              label={getRoleLabel('admin')}
              value="admin"
              icon={<Chip label="Full Access" color="error" size="small" />}
            />
            <Tab
              label={getRoleLabel('supervisor')}
              value="supervisor"
              icon={<Chip label="Management" color="warning" size="small" />}
            />
            <Tab
              label={getRoleLabel('agent')}
              value="agent"
              icon={<Chip label="Limited" color="primary" size="small" />}
            />
          </Tabs>
        </CardContent>
      </Card>

      {/* Tabla de Permisos por Módulo */}
      {modules.map((module) => {
        const modulePerms = getPermissionByModule(module);
        
        return (
          <Card key={module} sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ textTransform: 'capitalize' }}>
                📦 Módulo: {module}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Permiso</strong></TableCell>
                      <TableCell><strong>Descripción</strong></TableCell>
                      <TableCell align="center"><strong>Ver</strong></TableCell>
                      <TableCell align="center"><strong>Crear</strong></TableCell>
                      <TableCell align="center"><strong>Editar</strong></TableCell>
                      <TableCell align="center"><strong>Eliminar</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {modulePerms.map((permission) => {
                      const roleP = rolePermissions[selectedRole].find(
                        rp => rp.permission_id === permission.id
                      );

                      return (
                        <TableRow key={permission.id}>
                          <TableCell>
                            <Chip
                              label={permission.name}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {permission.description}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Switch
                              checked={roleP?.can_view || false}
                              onChange={(e) =>
                                handlePermissionChange(
                                  permission.id,
                                  'can_view',
                                  e.target.checked
                                )
                              }
                              disabled={selectedRole === 'admin'}
                              color="primary"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Switch
                              checked={roleP?.can_create || false}
                              onChange={(e) =>
                                handlePermissionChange(
                                  permission.id,
                                  'can_create',
                                  e.target.checked
                                )
                              }
                              disabled={selectedRole === 'admin'}
                              color="success"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Switch
                              checked={roleP?.can_edit || false}
                              onChange={(e) =>
                                handlePermissionChange(
                                  permission.id,
                                  'can_edit',
                                  e.target.checked
                                )
                              }
                              disabled={selectedRole === 'admin'}
                              color="warning"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Switch
                              checked={roleP?.can_delete || false}
                              onChange={(e) =>
                                handlePermissionChange(
                                  permission.id,
                                  'can_delete',
                                  e.target.checked
                                )
                              }
                              disabled={selectedRole === 'admin'}
                              color="error"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        );
      })}

      {/* Info Box */}
      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography variant="body2">
          <strong>Nota:</strong> Los permisos del Administrador no se pueden modificar ya que tienen acceso completo al sistema.
          Los cambios afectan a todos los usuarios con el rol seleccionado.
        </Typography>
      </Alert>
    </Box>
  );
};

export default PermissionsManager;
