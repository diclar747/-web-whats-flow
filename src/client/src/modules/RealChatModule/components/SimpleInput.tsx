import React from 'react';
import { Box, IconButton, TextField } from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';

interface SimpleInputProps {
  isDarkMode: boolean;
  onSend: (message: string) => void;
  disabled?: boolean;
}

const SimpleInput: React.FC<SimpleInputProps> = ({ isDarkMode, onSend, disabled }) => {
  const [message, setMessage] = React.useState('');

  const handleSend = () => {
    if (message.trim()) {
      onSend(message);
      setMessage('');
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, p: 2, bgcolor: isDarkMode ? '#202c33' : '#f0f2f5' }}>
      <TextField
        fullWidth
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        placeholder="Escribe un mensaje"
        disabled={disabled}
        sx={{
          '& .MuiOutlinedInput-root': {
            bgcolor: isDarkMode ? '#2a3942' : '#fff',
            borderRadius: 3,
          }
        }}
      />
      <IconButton 
        onClick={handleSend}
        sx={{ 
          bgcolor: '#00a884', 
          color: 'white',
          '&:hover': { bgcolor: '#008f7a' }
        }}
      >
        <SendIcon />
      </IconButton>
    </Box>
  );
};

export default SimpleInput;
