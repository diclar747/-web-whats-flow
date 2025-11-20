import { createTheme, ThemeOptions } from '@mui/material/styles';

// Paleta de colores moderna estilo iOS/WhatsApp
const modernColors = {
  // WhatsApp Green (modernizado)
  primary: {
    main: '#25D366',
    light: '#4FE17C',
    dark: '#1DA851',
    gradient: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
  },
  // Teal para acentos
  secondary: {
    main: '#128C7E',
    light: '#26A69A',
    dark: '#0D6F63',
  },
  // Backgrounds modernos
  background: {
    light: {
      default: '#F0F2F5',
      paper: '#FFFFFF',
      chat: '#E5DDD5',
      glass: 'rgba(255, 255, 255, 0.85)',
      blur: 'rgba(255, 255, 255, 0.7)',
    },
    dark: {
      default: '#111B21',
      paper: '#202C33',
      chat: '#0B141A',
      glass: 'rgba(32, 44, 51, 0.85)',
      blur: 'rgba(32, 44, 51, 0.7)',
    },
  },
  // Burbujas de chat
  bubble: {
    outgoing: {
      light: '#D9FDD3',
      dark: '#005C4B',
    },
    incoming: {
      light: '#FFFFFF',
      dark: '#202C33',
    },
  },
  // Borders y dividers
  divider: {
    light: 'rgba(0, 0, 0, 0.06)',
    dark: 'rgba(255, 255, 255, 0.08)',
  },
};

// Tema moderno compartido
const modernThemeBase: ThemeOptions = {
  typography: {
    fontFamily: '"Segoe UI", "Roboto", "Helvetica Neue", sans-serif',
    h1: {
      fontWeight: 700,
      fontSize: '2.5rem',
    },
    h2: {
      fontWeight: 700,
      fontSize: '2rem',
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.75rem',
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.5rem',
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.25rem',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1rem',
    },
    body1: {
      fontSize: '0.9375rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.4,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: '10px 24px',
          boxShadow: 'none',
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            transform: 'translateY(-2px)',
          },
        },
        contained: {
          background: modernColors.primary.gradient,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backdropFilter: 'blur(20px)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12)',
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          marginBottom: 4,
          '&:hover': {
            transform: 'translateX(4px)',
          },
        },
      },
    },
  },
};

// Tema claro moderno
export const modernLightTheme = createTheme({
  ...modernThemeBase,
  palette: {
    mode: 'light',
    primary: {
      main: modernColors.primary.main,
      light: modernColors.primary.light,
      dark: modernColors.primary.dark,
    },
    secondary: {
      main: modernColors.secondary.main,
    },
    background: {
      default: modernColors.background.light.default,
      paper: modernColors.background.light.paper,
    },
  },
});

// Tema oscuro moderno
export const modernDarkTheme = createTheme({
  ...modernThemeBase,
  palette: {
    mode: 'dark',
    primary: {
      main: modernColors.primary.main,
    },
    secondary: {
      main: modernColors.secondary.main,
    },
    background: {
      default: modernColors.background.dark.default,
      paper: modernColors.background.dark.paper,
    },
  },
});

export { modernColors };
