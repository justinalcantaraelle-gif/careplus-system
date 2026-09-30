import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { RiMailSendLine, RiArrowLeftLine, RiMailCheckLine, RiRefreshLine, RiShieldKeyholeLine } from 'react-icons/ri';
import { getApiBaseUrl } from '../../utils/storage';

const ForgotPassword = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const originMode = (queryParams.get('mode') || location.state?.mode || '').toLowerCase();

    const [email, setEmail] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [sentEmail, setSentEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    const colors = {
        gold: '#D4AF37',
        darkGold: '#B8860B',
        beige: '#F5F5DC',
        dark: '#1f1b18'
    };

    useEffect(() => {
        let timer;
        if (cooldown > 0) {
            timer = setInterval(() => {
                setCooldown(prev => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [cooldown]);

    const getLoginPath = () => {
        if (originMode === 'admin') return '/admin/login';
        if (originMode === 'superadmin') return '/superadmin/login';
        return '/login';
    };

    const handleSendResetLink = async (e) => {
        if (e) e.preventDefault();
        const normalizedEmail = email.trim().toLowerCase();

        if (!normalizedEmail) {
            return Swal.fire({
                title: 'Email Required',
                text: 'Please enter your registered email address.',
                icon: 'warning',
                confirmButtonColor: colors.darkGold
            });
        }

        setLoading(true);

        try {
            const apiBaseUrl = getApiBaseUrl();
            const response = await fetch(`${apiBaseUrl}/api/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: normalizedEmail })
            });
            const data = await response.json();

            setLoading(false);
            setSentEmail(normalizedEmail);
            setIsSubmitted(true);
            setCooldown(60);

            Swal.fire({
                title: 'Reset Link Dispatched',
                text: data.message || `If an account with ${normalizedEmail} exists, a password reset link has been dispatched.`,
                icon: 'success',
                confirmButtonColor: colors.darkGold
            });
        } catch (err) {
            console.error('Password reset dispatch error:', err);
            setLoading(false);
            Swal.fire('System Error', 'Unable to connect to the server. Please try again.', 'error');
        }
    };

    const backLink = getLoginPath();

    return (
        <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center py-4 animate__animated animate__fadeIn" style={{ backgroundColor: colors.beige }}>
            <div className="auth-small-card card shadow-lg border-0 p-4" style={{ borderRadius: '18px', maxWidth: '440px', width: '100%' }}>
                <Link to={backLink} className="text-decoration-none mb-3 d-inline-flex align-items-center gap-1 small fw-semibold" style={{ color: colors.darkGold }}>
                    <RiArrowLeftLine /> Back to Login
                </Link>

                {!isSubmitted ? (
                    <form onSubmit={handleSendResetLink}>
                        <div className="text-center mb-4">
                            <div className="d-inline-flex p-3 rounded-circle mb-3" style={{ backgroundColor: '#FCF8F0', border: `1.5px solid ${colors.gold}` }}>
                                <RiShieldKeyholeLine size={32} style={{ color: colors.darkGold }} />
                            </div>
                            <h4 className="fw-bold mb-1" style={{ color: colors.dark }}>Forgot Password?</h4>
                            <p className="text-muted small mb-0">
                                Enter your registered email address and we'll send you a secure link to reset your password.
                            </p>
                        </div>

                        <div className="mb-3">
                            <label className="form-label small fw-bold text-muted">Email Address</label>
                            <div className="input-group">
                                <span className="input-group-text bg-light border-0">
                                    <RiMailSendLine className="text-muted" />
                                </span>
                                <input
                                    type="email"
                                    className="form-control bg-light border-0 py-2"
                                    placeholder="Enter your registered email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onBlur={(e) => setEmail(e.target.value.trim())}
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-gold w-100 py-2 mt-2 fw-bold d-flex align-items-center justify-content-center gap-2"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                    Sending Reset Link...
                                </>
                            ) : (
                                'Send Reset Link'
                            )}
                        </button>

                        <div className="text-center mt-3">
                            <p className="text-muted small mb-0" style={{ fontSize: '12px' }}>
                                A single-use link with 15-minute expiration will be generated and delivered to your inbox.
                            </p>
                        </div>
                    </form>
                ) : (
                    <div className="text-center py-2 animate__animated animate__fadeIn">
                        <div className="d-inline-flex p-3 rounded-circle mb-3" style={{ backgroundColor: '#EBF8EE', border: '1.5px solid #28a745' }}>
                            <RiMailCheckLine size={38} className="text-success" />
                        </div>
                        <h4 className="fw-bold mb-2" style={{ color: colors.dark }}>Check Your Email</h4>
                        <p className="text-muted small mb-3">
                            We have sent a password reset link to:<br />
                            <strong className="text-dark fs-6">{sentEmail}</strong>
                        </p>

                        <div className="p-3 mb-4 rounded-3 text-start small" style={{ backgroundColor: '#FCF8F0', border: '1px solid #EBD9B6', color: '#666' }}>
                            <div className="fw-bold mb-1" style={{ color: '#775a18' }}>&#9432; Next Steps:</div>
                            <ul className="mb-0 ps-3">
                                <li>Click the <strong>"Reset Password"</strong> button in your email.</li>
                                <li>The reset link will expire in <strong>15 minutes</strong>.</li>
                                <li>Don't see it? Please check your <strong>Spam / Junk</strong> folder.</li>
                            </ul>
                        </div>

                        <button
                            type="button"
                            className="btn btn-outline-secondary w-100 py-2 mb-2 d-flex align-items-center justify-content-center gap-2"
                            onClick={() => handleSendResetLink()}
                            disabled={cooldown > 0 || loading}
                            style={{ borderRadius: '10px' }}
                        >
                            <RiRefreshLine />
                            {cooldown > 0 ? `Resend Email (${cooldown}s)` : 'Resend Reset Link'}
                        </button>

                        <Link
                            to={backLink}
                            className="btn btn-gold w-100 py-2 fw-bold text-decoration-none d-block mt-2"
                        >
                            Return to Login
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ForgotPassword;
