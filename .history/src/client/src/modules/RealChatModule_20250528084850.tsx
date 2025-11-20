import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface RealChatModuleProps {
  sessionId: string;
}

const RealChatModule: React.FC<RealChatModuleProps> = ({ sessionId }) => {
  const { isDarkMode } = useTheme();

  return (
    <div style={{ 
      padding: '1rem',
      backgroundColor: isDarkMode ? '#333' : '#fff',
      color: isDarkMode ? '#fff' : '#333'
    }}>
      <h2>Chat Module</h2>
      <p>Session ID: {sessionId}</p>
    </div>
  );
};

export default RealChatModule;