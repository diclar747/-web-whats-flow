import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Box } from '@mui/material';
import WinsapLogo from '../components/WinsapLogo';
import './AuthPages.css';

const AccountActivation: React.FC = () => {
    const navigate = useNavigate();
    const { token } = useParams<{ token: string }>();
    const [status, setStatus] = useState<'validating' | 'success' | 'error'>('validating');
    const [message, setMessage] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [expired, setExpired] = useState(false);

    // Validar token al cargar la página
    useEffect(() => {
        const activateAccount = async () => {
            if (!token) {
                setStatus('error');
                setMessage('Token de activación no válido');
                return;
            }

            try {
                const response = await fetch(`/api/auth/activate/${token}`);
                const data = await response.json();

                if (data.success) {
                    setStatus('success');
                    setMessage(data.message);
                    setUserEmail(data.email);

                    // Redirigir al login después de 3 segundos
                    setTimeout(() => {
                        navigate('/login', {
                            state: { message: '¡Cuenta activada! Ya puedes iniciar sesión.' }
                        });
                    }, 3000);
                } else {
                    setStatus('error');
                    setMessage(data.error || 'Error al activar la cuenta');
                    setExpired(data.expired || false);
                    if (data.email) setUserEmail(data.email);
                }
            } catch (error) {
                console.error('Error:', error);
                setStatus('error');
                setMessage('Error de conexión. Intente nuevamente.');
            }
        };

        activateAccount();
    }, [token, navigate]);

    const handleResendActivation = async () => {
        if (!userEmail) return;

        try {
            const response = await fetch('/api/auth/resend-activation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: userEmail })
            });

            const data = await response.json();

            if (data.success) {
                setMessage('Te hemos enviado un nuevo correo de activación. Revisa tu bandeja de entrada.');
                setExpired(false);
            } else {
                setMessage(data.error || 'Error al reenviar el correo');
            }
        } catch (error) {
            console.error('Error:', error);
            setMessage('Error de conexión. Intente nuevamente.');
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
                    <h2>Activación de Cuenta</h2>
                </div>

                {status === 'validating' && (
                    <div className="auth-info">
                        <p>Validando tu cuenta...</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="auth-success">
                        <h3 style={{ marginTop: 0 }}>✅ ¡Cuenta Activada!</h3>
                        <p>{message}</p>
                        {userEmail && (
                            <p style={{ fontSize: '14px', marginTop: '15px' }}>
                                Cuenta: <strong>{userEmail}</strong>
                            </p>
                        )}
                        <p style={{ fontSize: '14px', marginTop: '15px' }}>
                            Serás redirigido al inicio de sesión en unos segundos...
                        </p>
                    </div>
                )}

                {status === 'error' && (
                    <>
                        <div className="auth-error">
                            {message}
                        </div>

                        {expired && userEmail && (
                            <div style={{ textAlign: 'center', marginTop: '20px' }}>
                                <button
                                    onClick={handleResendActivation}
                                    className="auth-button"
                                >
                                    Solicitar Nuevo Enlace
                                </button>
                            </div>
                        )}
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

export default AccountActivation;
