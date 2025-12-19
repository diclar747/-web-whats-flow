import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import './AuthPages.css';

const Login = () => {
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
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                // Guardar token y datos de usuario (COMPLETO)
                const storageData = [
                    { key: 'token', value: data.token },
                    { key: 'user', value: JSON.stringify(data.user) },
                    { key: 'userId', value: data.user.id.toString() },
                    { key: 'userName', value: data.user.full_name },
                    { key: 'userEmail', value: data.user.email },
                    { key: 'userRole', value: data.user.role },
                    { key: 'whatsflow_user_type', value: data.user.role === 'super_admin' ? 'admin' : 'agent' }
                ];

                // Guardar en AMBOS storages para persistencia
                storageData.forEach(({ key, value }) => {
                    localStorage.setItem(key, value);
                    sessionStorage.setItem(key, value);
                });

                console.log('✅ Login exitoso:', data.user.email);

                // Forzar recarga completa para que App.tsx cargue la sesión
                // navigate() no funciona porque el estado de App no se actualiza a tiempo
                window.location.href = '/dashboard';
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
                    <h1>WhatsFlow</h1>
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
