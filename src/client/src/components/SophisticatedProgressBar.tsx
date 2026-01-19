import React from 'react';
import { Box, LinearProgress, Typography, styled, keyframes } from '@mui/material';

const shimmer = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`;

const StyledProgressContainer = styled(Box)(({ theme }) => ({
    width: '100%',
    marginTop: '4px',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '4px',
    height: '6px',
    background: 'rgba(37, 211, 102, 0.1)',
    backdropFilter: 'blur(4px)',
}));

const SophisticatedBar = styled(Box)<{ progress: number }>(({ theme, progress }) => ({
    height: '100%',
    width: `${progress}%`,
    background: 'linear-gradient(90deg, #25D366 0%, #128C7E 50%, #25D366 100%)',
    backgroundSize: '200% 100%',
    animation: `${shimmer} 2s linear infinite`,
    borderRadius: '4px',
    transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 0 10px rgba(37, 211, 102, 0.5)',
}));

interface SophisticatedProgressBarProps {
    progress: number;
    message?: string;
    compact?: boolean;
}

const SophisticatedProgressBar: React.FC<SophisticatedProgressBarProps> = ({ progress, message, compact = false }) => {
    return (
        <Box sx={{ width: '100%', mb: compact ? 0 : 1 }}>
            {!compact && message && (
                <Typography variant="caption" sx={{ color: '#25D366', fontWeight: 500, fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                    {message} ({progress}%)
                </Typography>
            )}
            <StyledProgressContainer sx={{ height: compact ? '4px' : '6px' }}>
                <SophisticatedBar progress={progress} />
            </StyledProgressContainer>
        </Box>
    );
};

export default SophisticatedProgressBar;
