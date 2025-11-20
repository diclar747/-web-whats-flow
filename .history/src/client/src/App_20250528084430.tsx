import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';

// Componentes principales
import LandingPage from './components/LandingPage';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import WhatsFlowDashboard from './pages/WhatsFlowDashboard';

// Context providers
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { WhatsAppProvider } from './context/WhatsAppContext';
import { ThemeProvider as AppThemeProvider } from './contexts/ThemeContext';

// Tema personalizado de WhatsFlow
const whatsFlowTheme = createTheme({
  palette: {
    primary: {
      main: '#00a884', // WhatsApp Green
      dark: '#008069',
      light: '#25d366'
    },
    secondary: {
      main: '#667781', // WhatsApp Gray
      dark: '#54656f',
      light: '#8696a0'
    },
    background: {
      default: '#f0f2f5',
      paper: '#ffffff'
    }
  },
  typography: {
    fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
    h4: {
      fontWeight: 300
    },
    h6: {
      fontWeight: 500
    }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8
        }
      }
    }
  }
});

interface AppState {
  isAuthenticated: boolean;
  sessionId: string | null;
  userType: 'client' | 'admin' | null;
}

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({
    isAuthenticated: false,
    sessionId: null,
    userType: null
  });

  useEffect(() => {
    // Verificar si hay una sesión guardada
    const savedSession = localStorage.getItem('whatsflow_session');
    const savedUserType = localStorage.getItem('whatsflow_user_type');
    
    if (savedSession && savedUserType) {
      setAppState({
        isAuthenticated: true,
        sessionId: savedSession,
        userType: savedUserType as 'client' | 'admin'
      });
    }
  }, []);

  const handleQRSuccess = (sessionId: string) => {
    setAppState({
      isAuthenticated: true,
      sessionId,
      userType: 'client'
    });
    localStorage.setItem('whatsflow_session', sessionId);
    localStorage.setItem('whatsflow_user_type', 'client');
  };

  const handleAdminLogin = (adminData: any) => {
    setAppState({
      isAuthenticated: true,
      sessionId: adminData.sessionId,
      userType: 'admin'
    });
    localStorage.setItem('whatsflow_session', adminData.sessionId);
    localStorage.setItem('whatsflow_user_type', 'admin');
  };

  const handleLogout = () => {
    setAppState({
      isAuthenticated: false,
      sessionId: null,
      userType: null
    });
    localStorage.removeItem('whatsflow_session');
    localStorage.removeItem('whatsflow_user_type');
  };

  return (
    <ThemeProvider theme={whatsFlowTheme}>
      <CssBaseline />
      <AppThemeProvider>
        <AuthProvider>
        <SocketProvider>
          <WhatsAppProvider>
            <Router>
              <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
                <Routes>
                  {/* Ruta principal - Cliente */}
                  <Route 
                    path="/" 
                    element={
                      !appState.isAuthenticated || appState.userType !== 'client' ? (
                        <LandingPage onQRSuccess={handleQRSuccess} />
                      ) : (
                        <Navigate to="/dashboard" replace />
                      )
                    } 
                  />

                  {/* Dashboard principal de WhatsFlow */}
                  <Route 
                    path="/dashboard/*" 
                    element={
                      appState.isAuthenticated && appState.userType === 'client' ? (
                        <WhatsFlowDashboard 
                          sessionId={appState.sessionId!} 
                          onLogout={handleLogout}
                        />
                      ) : (
                        <Navigate to="/" replace />
                      )
                    } 
                  />

                  {/* Admin Routes */}
                  <Route 
                    path="/admin" 
                    element={
                      !appState.isAuthenticated || appState.userType !== 'admin' ? (
                        <AdminLogin onLogin={handleAdminLogin} />
                      ) : (
                        <Navigate to="/admin/dashboard" replace />
                      )
                    } 
                  />

                  <Route 
                    path="/admin/dashboard/*" 
                    element={
                      appState.isAuthenticated && appState.userType === 'admin' ? (
                        <AdminDashboard onLogout={handleLogout} />
                      ) : (
                        <Navigate to="/admin" replace />
                      )
                    } 
                  />

                  {/* Fallback */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Box>
            </Router>
          </WhatsAppProvider>
        </SocketProvider>
        </AuthProvider>
      </AppThemeProvider>
    </ThemeProvider>
  );
};

export default App;

