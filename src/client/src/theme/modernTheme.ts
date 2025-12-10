import { createTheme, alpha } from '@mui/material/styles';

// Colores inspirados en "Lead Wave" / Cyber SaaS
const colors = {
  background: {
    default: '#0f172a', // Slate 900 - Fondo principal profundo
    paper: '#1e293b',   // Slate 800 - Tarjetas y paneles
    sidebar: '#0f172a', // Mismo que background o ligeramente diferente
  },
  primary: {
    main: '#6366f1', // Indigo - Color principal vibrante
    light: '#818cf8',
    dark: '#4f46e5',
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#ec4899', // Pink/Neon - Para acentos y gradientes
    light: '#f472b6',
    dark: '#db2777',
    contrastText: '#ffffff',
  },
  text: {
    primary: '#f8fafc', // Slate 50 - Texto principal muy claro
    secondary: '#94a3b8', // Slate 400 - Texto secundario
    disabled: '#64748b',
  },
  success: {
    main: '#10b981', // Emerald
    light: '#34d399',
    dark: '#059669',
  },
  info: {
    main: '#3b82f6', // Blue
    light: '#60a5fa',
    dark: '#2563eb',
  },
  warning: {
    main: '#f59e0b', // Amber
    light: '#fbbf24',
    dark: '#d97706',
  },
  error: {
    main: '#ef4444', // Red
    light: '#f87171',
    dark: '#dc2626',
  },
  action: {
    active: '#94a3b8',
    hover: alpha('#94a3b8', 0.08),
    selected: alpha('#6366f1', 0.12),
    disabled: alpha('#94a3b8', 0.3),
    disabledBackground: alpha('#94a3b8', 0.12),
  },
  divider: 'rgba(148, 163, 184, 0.12)', // Sutil
};

// Tema Oscuro (Lead Wave Style)
export const modernDarkTheme = createTheme({
  palette: {
    mode: 'dark', // Importante para que MUI ajuste automáticos
    background: {
      default: colors.background.default,
      paper: colors.background.paper,
    },
    primary: colors.primary,
    secondary: colors.secondary,
    text: colors.text,
    success: colors.success,
    info: colors.info,
    warning: colors.warning,
    error: colors.error,
    divider: colors.divider,
    action: colors.action,
  },
  shape: {
    borderRadius: 16, // Bordes más redondeados para un look moderno
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, fontSize: '2.5rem', letterSpacing: '-0.02em' },
    h2: { fontWeight: 700, fontSize: '2rem', letterSpacing: '-0.01em' },
    h3: { fontWeight: 600, fontSize: '1.75rem' },
    h4: { fontWeight: 600, fontSize: '1.5rem' },
    h5: { fontWeight: 600, fontSize: '1.25rem' },
    h6: { fontWeight: 600, fontSize: '1rem' },
    button: { textTransform: 'none', fontWeight: 600 },
    body1: { fontSize: '0.95rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', lineHeight: 1.57 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: colors.background.default,
          scrollbarColor: '#334155 #0f172a',
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
            backgroundColor: '#0f172a',
          },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
            borderRadius: 8,
            backgroundColor: '#334155',
            minHeight: 24,
            border: '2px solid #0f172a',
          },
          '&::-webkit-scrollbar-thumb:focus, & *::-webkit-scrollbar-thumb:focus': {
            backgroundColor: '#475569',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${alpha(colors.text.secondary, 0.1)}`,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: '8px 16px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          },
        },
        containedPrimary: {
          background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.primary.dark} 100%)`,
          '&:hover': {
            background: `linear-gradient(135deg, ${colors.primary.light} 0%, ${colors.primary.main} 100%)`,
          },
        },
        containedSecondary: {
          background: `linear-gradient(135deg, ${colors.secondary.main} 0%, ${colors.secondary.dark} 100%)`,
        }
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          overflow: 'visible',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12, // Items de lista redondeados (como sidebar)
          marginBottom: 4,
          '&.Mui-selected': {
            backgroundColor: alpha(colors.primary.main, 0.15),
            color: colors.primary.light,
            '&:hover': {
              backgroundColor: alpha(colors.primary.main, 0.25),
            },
            '& .MuiListItemIcon-root': {
              color: colors.primary.light,
            }
          },
          '&:hover': {
            backgroundColor: alpha(colors.text.secondary, 0.08),
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          minWidth: 40,
          color: colors.text.secondary,
        }
      }
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            backgroundColor: alpha('#000000', 0.2),
            '& fieldset': {
              borderColor: alpha(colors.text.secondary, 0.2),
            },
            '&:hover fieldset': {
              borderColor: alpha(colors.text.secondary, 0.4),
            },
            '&.Mui-focused fieldset': {
              borderColor: colors.primary.main,
              borderWidth: 2,
            },
          }
        }
      }
    }
  },
});

export const modernLightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: colors.primary,
    secondary: colors.secondary,
    background: {
      default: '#f1f5f9', // Slate 100
      paper: '#ffffff',
    },
  },
  // ... (Mantener estructura simple para light mode por ahora)
});
