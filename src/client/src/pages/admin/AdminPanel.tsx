import React, { useState } from 'react';
import { Box, Tabs, Tab, Typography, Paper } from '@mui/material';
import PlansManager from './PlansManager';
import ClientsManager from './ClientsManager';
import AdminChatMonitor from './AdminChatMonitor';

const AdminPanel: React.FC = () => {
    const [tabIndex, setTabIndex] = useState(0);

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabIndex(newValue);
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
                Panel de Administración (Super Admin)
            </Typography>

            <Paper sx={{ width: '100%', mb: 2 }}>
                <Tabs
                    value={tabIndex}
                    onChange={handleTabChange}
                    indicatorColor="primary"
                    textColor="primary"
                    centered
                >
                    <Tab label="Gestión de Clientes" />
                    <Tab label="Planes y Precios" />
                    <Tab label="Monitoreo de Chats" />
                </Tabs>
            </Paper>

            <Box sx={{ mt: 2 }}>
                {tabIndex === 0 && <ClientsManager />}
                {tabIndex === 1 && <PlansManager />}
                {tabIndex === 2 && <AdminChatMonitor />}
            </Box>
        </Box>
    );
};

export default AdminPanel;
