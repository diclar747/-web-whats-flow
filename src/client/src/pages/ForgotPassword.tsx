import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Box } from '@mui/material';
import WinsapLogo from '../components/WinsapLogo';
import './AuthPages.css';

const ForgotPassword: React.FC = () => {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (data.success) {
                setSuccess(true);
            } else {
                setError(data.error || 'Error al enviar el correo');
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
                    <h2>Recuperar contraseña</h2>
                </div>

                {success ? (
                    <div className="auth-success">
                        <h3 style={{ marginTop: 0 }}>✅ Correo enviado</h3>
                        <p>Te hemos enviado un correo electrónico con instrucciones para recuperar tu contraseña.</p>
                        <p style={{ fontSize: '14px', marginTop: '15px' }}>
                            Revisa tu bandeja de entrada y sigue el enlace para establecer una nueva contraseña.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="auth-info">
                            <p>Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.</p>
                        </div>

                        {error && <div className="auth-error">{error}</div>}

                        <form onSubmit={handleSubmit} className="auth-form">
                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    placeholder="tu@email.com"
                                    autoComplete="email"
                                />
                            </div>

                            <button
                                type="submit"
                                className="auth-button"
                                disabled={loading}
                            >
                                {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                            </button>
                        </form>
                    </>
                )}

                <div className="auth-footer">
                    <p>
                        <Link to="/login">Volver a Iniciar sesión</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
