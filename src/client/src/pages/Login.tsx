import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import WhinsapLogo from '../components/WhinsapLogo';
import './AuthPages.css';

interface LoginProps {
    onLoginSuccess?: (userData: any, authToken: string, sessionId?: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const successMessage = location.state?.message;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Generar o recuperar deviceId
            let deviceId = localStorage.getItem('deviceId') || sessionStorage.getItem('deviceId');
            if (!deviceId) {
                deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                localStorage.setItem('deviceId', deviceId);
                sessionStorage.setItem('deviceId', deviceId);
                localStorage.setItem('device_id', deviceId);
                sessionStorage.setItem('device_id', deviceId);
                localStorage.setItem('whinsap_device_id', deviceId);
                sessionStorage.setItem('whinsap_device_id', deviceId);
            }

            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ...formData, deviceId })
            });

            const data = await response.json();

            if (data.success) {
                const sessionIdFromLogin = data.sessionId || data.user?.session_id || data.user?.sessionId || '';
                const sessionToken = data.sessionToken || '';

                // Guardar token, datos de usuario y sesión (persistencia en ambos storages)
                const storageData = [
                    { key: 'token', value: data.token },
                    { key: 'user', value: JSON.stringify(data.user) },
                    { key: 'userId', value: data.user.id?.toString?.() || '' },
                    { key: 'userName', value: data.user.name || data.user.full_name || '' },
                    { key: 'userEmail', value: data.user.email || '' },
                    { key: 'userRole', value: data.user.role || 'admin' },
                    { key: 'whinsap_user_type', value: data.user.role === 'super_admin' ? 'admin' : 'agent' },
                    { key: 'whinsap_session', value: sessionIdFromLogin },
                    { key: 'sessionToken', value: sessionToken },
                    { key: 'whinsap_session_token', value: sessionToken },
                    { key: 'whinsap_session_device_id', value: deviceId }
                ];

                storageData.forEach(({ key, value }) => {
                    if (value !== undefined && value !== null) {
                        localStorage.setItem(key, value);
                        sessionStorage.setItem(key, value);
                    }
                });

                console.log('✅ Login exitoso:', data.user.email, 'sessionId:', sessionIdFromLogin);

                // Actualizar estado global en App.tsx antes de navegar
                if (onLoginSuccess) {
                    onLoginSuccess(data.user, data.token, sessionIdFromLogin);
                }

                // ✅ Usar navigate en lugar de window.location para NO perder el sessionStorage
                navigate('/dashboard');
            } else {
                setError(data.error || 'Error al iniciar sesión');
            }
        } catch (error) {
            console.error('Error:', error);
            setError('Error de conexión. Intente nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                        <WhinsapLogo sx={{ fontSize: 60 }} />
                    </Box>
                    <h1>Whinsap</h1>
                    <h2>Iniciar sesión</h2>
                </div>

                {successMessage && <div className="auth-success">{successMessage}</div>}
                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            placeholder="tu@email.com"
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <label>Contraseña</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            placeholder="Tu contraseña"
                            autoComplete="current-password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="auth-button"
                        disabled={loading}
                    >
                        {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>
                        ¿No tienes cuenta? <Link to="/register">Regístrate</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
