import React from 'react';
import { Alert, AlertTitle, Button, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface PlanRequiredAlertProps {
    feature: string;
    compact?: boolean;
    onClose?: () => void;
}

export const PlanRequiredAlert: React.FC<PlanRequiredAlertProps> = ({
    feature,
    compact = false,
    onClose
}) => {
    const navigate = useNavigate();

    const handleGoToPlans = () => {
        navigate('/settings?tab=plan');
    };

    if (compact) {
        return (
            <Alert
                severity="warning"
                icon={<WarningAmberIcon />}
                sx={{ mb: 2 }}
                onClose={onClose}
            >
                Para usar {feature} necesitas un plan activo.{' '}
                <Button
                    size="small"
                    onClick={handleGoToPlans}
                    sx={{ textTransform: 'none', p: 0, minWidth: 'auto', textDecoration: 'underline' }}
                >
                    Ver Planes
                </Button>
            </Alert>
        );
    }

    return (
        <Alert
            severity="warning"
            icon={<WarningAmberIcon fontSize="large" />}
            sx={{
                mb: 3,
                '& .MuiAlert-message': {
                    width: '100%'
                }
            }}
        >
            <AlertTitle sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                ⚠️ Plan Requerido
            </AlertTitle>
            <Box sx={{ mb: 2 }}>
                Para usar <strong>{feature}</strong> necesitas un plan activo.
            </Box>
            <Box sx={{ mb: 1 }}>
                Ve a <strong>Configuraciones → Pestaña "Mi Plan"</strong> y elige un plan.
            </Box>
            <Box sx={{ mt: 2 }}>
                <Button
                    variant="contained"
                    color="warning"
                    onClick={handleGoToPlans}
                    size="small"
                >
                    Ir a Planes
                </Button>
                {onClose && (
                    <Button
                        onClick={onClose}
                        size="small"
                        sx={{ ml: 1 }}
                    >
                        Cerrar
                    </Button>
                )}
            </Box>
        </Alert>
    );
};

export default PlanRequiredAlert;
