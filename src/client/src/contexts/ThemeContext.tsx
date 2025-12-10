import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';
import { modernLightTheme, modernDarkTheme } from '../theme/modernTheme';

type ThemeContextType = {
  theme: 'light' | 'dark';
  isDarkMode: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return {
    ...context,
    isDarkMode: context.theme === 'dark'
  };
}

type ThemeProviderProps = {
  children: React.ReactNode;
};

function ThemeProvider({ children }: ThemeProviderProps) {
  // Cargar preferencia guardada, por defecto modo claro
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('whatsflow-theme');
    if (saved === 'light' || saved === 'dark') return saved;

    // Por defecto modo oscuro "Lead Wave"
    return 'dark';
  });

  const toggleTheme = () => {
    setTheme(prev => {
      const newTheme = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('whatsflow-theme', newTheme);
      return newTheme;
    });
  };

  // Aplicar tema moderno de MUI según el modo
  const muiTheme = useMemo(() => {
    return theme === 'dark' ? modernDarkTheme : modernLightTheme;
  }, [theme]);

  // Actualizar clase en body y atributo data-theme para estilos globales
  useEffect(() => {
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${theme}`);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const value = {
    theme,
    isDarkMode: theme === 'dark',
    toggleTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}

export { ThemeContext, useTheme, ThemeProvider };