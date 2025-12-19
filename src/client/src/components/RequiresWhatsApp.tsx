import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { WhatsApp, QrCode } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface RequiresWhatsAppProps {
    sessionId?: string;
    children: React.ReactNode;
    moduleName?: string;
}

/**
 * Wrapper component that checks if WhatsApp is connected before showing module content
 * For JWT users without sessionId, shows a message to connect WhatsApp
 */
const RequiresWhatsApp: React.FC<RequiresWhatsAppProps> = ({
    sessionId,
    children,
    moduleName = 'este módulo'
}) => {
    const navigate = useNavigate();

    // If no sessionId, user needs to connect WhatsApp
    if (!sessionId || sessionId === '') {
        return (
            <Box sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '60vh',
                flexDirection: 'column',
                textAlign: 'center',
                p: 4
            }}>
                <WhatsApp sx={{ fontSize: 80, color: '#00a884', mb: 3, opacity: 0.6 }} />
                <Typography variant="h4" sx={{ mb: 2, color: '#e2e8f0', fontWeight: 600 }}>
                    WhatsApp no conectado
                </Typography>
                <Typography variant="body1" sx={{ mb: 3, color: '#94a3b8', maxWidth: 500 }}>
                    Para usar {moduleName}, necesitas conectar tu cuenta de WhatsApp escaneando el código QR.
                </Typography>
                <Button
                    variant="contained"
                    size="large"
                    startIcon={<QrCode />}
                    onClick={() => {
                        // Clear storage and redirect to home to show QR
                        navigate('/dashboard/settings?tab=whatsapp');
                    }}
                    sx={{
                        bgcolor: '#00a884',
                        '&:hover': { bgcolor: '#008069' },
                        px: 4,
                        py: 2,
                        textTransform: 'none',
                        fontSize: '16px',
                        fontWeight: 600
                    }}
                >
                    Conectar WhatsApp
                </Button>
            </Box>
        );
    }

    // SessionId exists, show module content
    return <>{children}</>;
};

export default RequiresWhatsApp;
