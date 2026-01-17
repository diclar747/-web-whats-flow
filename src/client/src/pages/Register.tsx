import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import WinsapLogo from '../components/WinsapLogo';
import FloatingWhatsAppButton from '../components/FloatingWhatsAppButton';
import { Box } from '@mui/material';
import './AuthPages.css';

const Register = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        phone: '+595',
        password: '',
        confirm_password: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [registeredEmail, setRegisteredEmail] = useState('');
    const [loading, setLoading] = useState(false);

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
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                // Registro exitoso, mostrar mensaje de verificación
                setSuccess(true);
                setRegisteredEmail(data.email || formData.email);
            } else {
                setError(data.error || 'Error al registrarse');
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
                        <WinsapLogo sx={{ fontSize: 60 }} />
                    </Box>
                    <h1>Winsap</h1>
                    <h2>Crear cuenta</h2>
                </div>

                {success ? (
                    <>
                        <div className="auth-success">
                            <h3 style={{ marginTop: 0 }}>✅ ¡Registro Exitoso!</h3>
                            <p>Te hemos enviado un correo a:</p>
                            <p style={{ fontSize: '16px', fontWeight: 'bold' }}>{registeredEmail}</p>
                            <p style={{ marginTop: '20px' }}>Por favor, <strong>activa tu cuenta</strong> desde el enlace del correo antes de iniciar sesión.</p>
                            <p style={{ fontSize: '14px', marginTop: '15px', color: '#93c5fd' }}>
                                📧 Revisa también tu carpeta de spam si no lo encuentras
                            </p>
                        </div>
                        <div className="auth-footer">
                            <p>
                                <Link to="/login">Ir a Iniciar Sesión</Link>
                            </p>
                        </div>
                    </>
                ) : (
                    <>
                        {error && <div className="auth-error">{error}</div>}

                        <form onSubmit={handleSubmit} className="auth-form">
                            <div className="form-group">
                                <label>Nombre completo</label>
                                <input
                                    type="text"
                                    name="full_name"
                                    value={formData.full_name}
                                    onChange={handleChange}
                                    required
                                    placeholder="Juan Pérez"
                                />
                            </div>

                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    placeholder="juan@example.com"
                                />
                            </div>

                            <div className="form-group">
                                <label>Teléfono</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    required
                                    placeholder="+595981234567"
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
                                    minLength={6}
                                    placeholder="Mínimo 6 caracteres"
                                />
                            </div>

                            <div className="form-group">
                                <label>Confirmar contraseña</label>
                                <input
                                    type="password"
                                    name="confirm_password"
                                    value={formData.confirm_password}
                                    onChange={handleChange}
                                    required
                                    placeholder="Repite tu contraseña"
                                />
                            </div>

                            <button
                                type="submit"
                                className="auth-button"
                                disabled={loading}
                            >
                                {loading ? 'Registrando...' : 'Registrarse'}
                            </button>
                        </form>

                        <div className="auth-footer">
                            <p>
                                ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Register;
