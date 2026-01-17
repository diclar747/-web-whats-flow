import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Box } from '@mui/material';
import WinsapLogo from '../components/WinsapLogo';
import './AuthPages.css';

const ResetPassword: React.FC = () => {
    const navigate = useNavigate();
    const { token } = useParams<{ token: string }>();
    const [formData, setFormData] = useState({
        newPassword: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const [validatingToken, setValidatingToken] = useState(true);
    const [tokenValid, setTokenValid] = useState(false);
    const [userEmail, setUserEmail] = useState('');

    // Validar token al cargar la página
    useEffect(() => {
        const validateToken = async () => {
            if (!token) {
                setError('Token de recuperación no válido');
                setValidatingToken(false);
                return;
            }

            try {
                const response = await fetch(`/api/auth/verify-reset-token/${token}`);
                const data = await response.json();

                if (data.success) {
                    setTokenValid(true);
                    setUserEmail(data.email || '');
                } else {
                    setError(data.error || 'El enlace de recuperación no es válido o ha expirado');
                }
            } catch (error) {
                console.error('Error:', error);
                setError('Error al validar el enlace. Intente nuevamente.');
            } finally {
                setValidatingToken(false);
            }
        };

        validateToken();
    }, [token]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');

        // Validaciones
        if (formData.newPassword !== formData.confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        if (formData.newPassword.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    token,
                    newPassword: formData.newPassword,
                    confirmPassword: formData.confirmPassword
                })
            });

            const data = await response.json();

            if (data.success) {
                setSuccess(true);
                // Redirigir al login después de 3 segundos
                setTimeout(() => {
                    navigate('/login', {
                        state: { message: 'Tu contraseña ha sido actualizada con éxito. Por favor, inicia sesión.' }
                    });
                }, 3000);
            } else {
                setError(data.error || 'Error al actualizar la contraseña');
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
                    <h2>Restablecer contraseña</h2>
                </div>

                {validatingToken ? (
                    <div className="auth-info">
                        <p>Validando enlace de recuperación...</p>
                    </div>
                ) : success ? (
                    <div className="auth-success">
                        <h3 style={{ marginTop: 0 }}>✅ Contraseña actualizada</h3>
                        <p>Tu contraseña ha sido actualizada con éxito.</p>
                        <p style={{ fontSize: '14px', marginTop: '15px' }}>
                            Serás redirigido al inicio de sesión en unos segundos...
                        </p>
                    </div>
                ) : !tokenValid ? (
                    <>
                        <div className="auth-error">
                            {error || 'El enlace de recuperación no es válido o ha expirado'}
                        </div>
                        <div className="auth-footer">
                            <p>
                                <Link to="/forgot-password">Solicitar nuevo enlace</Link>
                            </p>
                            <p>
                                <Link to="/login">Volver a Iniciar sesión</Link>
                            </p>
                        </div>
                    </>
                ) : (
                    <>
                        {userEmail && (
                            <div className="auth-info">
                                <p>Estableciendo nueva contraseña para: <strong>{userEmail}</strong></p>
                            </div>
                        )}

                        {error && <div className="auth-error">{error}</div>}

                        <form onSubmit={handleSubmit} className="auth-form">
                            <div className="form-group">
                                <label>Nueva contraseña</label>
                                <input
                                    type="password"
                                    name="newPassword"
                                    value={formData.newPassword}
                                    onChange={handleChange}
                                    required
                                    placeholder="Mínimo 6 caracteres"
                                    autoComplete="new-password"
                                />
                            </div>

                            <div className="form-group">
                                <label>Confirmar contraseña</label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    required
                                    placeholder="Repite tu nueva contraseña"
                                    autoComplete="new-password"
                                />
                            </div>

                            <button
                                type="submit"
                                className="auth-button"
                                disabled={loading}
                            >
                                {loading ? 'Actualizando...' : 'Cambiar contraseña'}
                            </button>
                        </form>

                        <div className="auth-footer">
                            <p>
                                <Link to="/login">Volver a Iniciar sesión</Link>
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ResetPassword;
