import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { 
    RiLockPasswordLine, 
    RiEyeLine, 
    RiEyeOffLine, 
    RiCheckLine, 
    RiCloseLine, 
    RiErrorWarningLine, 
    RiArrowLeftLine,
    RiShieldCheckLine 
} from 'react-icons/ri';
import { getApiBaseUrl } from '../../utils/storage';
import { passwordRules, validatePassword } from '../../utils/passwordRules';

const ResetPassword = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);

    const token = queryParams.get('token') || '';
    const emailParam = queryParams.get('email') || '';

    const [loading, setLoading] = useState(true);
    const [tokenValid, setTokenValid] = useState(false);
    const [userRecord, setUserRecord] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const colors = {
        gold: '#D4AF37',
        darkGold: '#B8860B',
        beige: '#F5F5DC',
        dark: '#1f1b18'
    };

    useEffect(() => {
        const validateToken = async () => {
            if (!token || !emailParam) {
                setErrorMessage('No valid reset token or email address was found in the link.');
                setTokenValid(false);
                setLoading(false);
                return;
            }

            try {
                const apiBaseUrl = getApiBaseUrl();
                const response = await fetch(`${apiBaseUrl}/api/auth/verify-reset-token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailParam.trim().toLowerCase(), token })
                });
                const data = await response.json();

                if (!response.ok || !data.valid) {
                    setErrorMessage(data.error || 'This password reset link is invalid or has expired.');
                    setTokenValid(false);
                    setLoading(false);
                    return;
                }

                setUserRecord({ email: data.email, role: data.role });
                setTokenValid(true);
                setLoading(false);
            } catch (err) {
                console.error('Token validation error:', err);
                setErrorMessage('Failed to connect to verification server.');
                setTokenValid(false);
                setLoading(false);
            }
        };

        validateToken();
    }, [token, emailParam]);

    const getLoginPath = () => {
        if (!userRecord) return '/login';
        const role = (userRecord.role || '').toLowerCase().replace(/\s+/g, '');
        if (role === 'admin' || role === 'staff') return '/admin/login';
        if (role === 'superadmin' || role === 'super_admin') return '/superadmin/login';
        return '/login';
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();

        if (!validatePassword(newPassword)) {
            return Swal.fire({
                title: 'Password Requirements Not Met',
                text: 'Please make sure your password satisfies all the complexity rules below.',
                icon: 'warning',
                confirmButtonColor: colors.darkGold
            });
        }

        if (newPassword !== confirmPassword) {
            return Swal.fire({
                title: 'Passwords Do Not Match',
                text: 'The confirmation password does not match your new password.',
                icon: 'error',
                confirmButtonColor: colors.darkGold
            });
        }

        setSubmitting(true);

        try {
            const apiBaseUrl = getApiBaseUrl();
            const normalizedEmail = (userRecord?.email || emailParam).trim().toLowerCase();

            const response = await fetch(`${apiBaseUrl}/api/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: normalizedEmail, token, newPassword })
            });
            const data = await response.json();
            setSubmitting(false);

            if (!response.ok || !data.success) {
                return Swal.fire('Error', data.error || 'Failed to update password.', 'error');
            }

            const loginPath = getLoginPath();

            Swal.fire({
                title: 'Password Updated!',
                text: 'Your password has been changed successfully. You can now log in with your new password.',
                icon: 'success',
                confirmButtonColor: colors.darkGold
            }).then(() => {
                navigate(loginPath);
            });
        } catch (err) {
            console.error('Password reset submit error:', err);
            setSubmitting(false);
            Swal.fire('Error', 'Failed to update password. Please try again.', 'error');
        }
    };

    if (loading) {
        return (
            <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center py-4 animate__animated animate__fadeIn" style={{ backgroundColor: colors.beige }}>
                <div className="card shadow-lg border-0 p-4 text-center" style={{ borderRadius: '18px', maxWidth: '420px', width: '100%' }}>
                    <div className="spinner-border text-warning mx-auto mb-3" role="status" style={{ width: '2.5rem', height: '2.5rem' }}>
                        <span className="visually-hidden">Validating Link...</span>
                    </div>
                    <h5 className="fw-bold mb-1" style={{ color: colors.dark }}>Verifying Reset Link...</h5>
                    <p className="text-muted small mb-0">Please wait while we validate your security token.</p>
                </div>
            </div>
        );
    }

    if (!tokenValid) {
        return (
            <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center py-4 animate__animated animate__fadeIn" style={{ backgroundColor: colors.beige }}>
                <div className="card shadow-lg border-0 p-4 text-center" style={{ borderRadius: '18px', maxWidth: '440px', width: '100%' }}>
                    <div className="d-inline-flex p-3 rounded-circle mx-auto mb-3" style={{ backgroundColor: '#FDF2F2', border: '1.5px solid #DC3545' }}>
                        <RiErrorWarningLine size={40} className="text-danger" />
                    </div>
                    <h4 className="fw-bold mb-2 text-danger">Invalid or Expired Link</h4>
                    <p className="text-muted small mb-4">
                        {errorMessage || 'This password reset link is invalid, expired, or has already been used.'}
                    </p>
                    <Link
                        to="/forgot-password"
                        className="btn btn-gold w-100 py-2 fw-bold text-decoration-none mb-2"
                    >
                        REQUEST NEW RESET LINK
                    </Link>
                    <Link
                        to="/login"
                        className="btn btn-light w-100 py-2 text-muted small text-decoration-none"
                    >
                        Return to Login
                    </Link>
                </div>
            </div>
        );
    }

    const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;

    return (
        <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center py-4 animate__animated animate__fadeIn" style={{ backgroundColor: colors.beige }}>
            <div className="auth-small-card card shadow-lg border-0 p-4" style={{ borderRadius: '18px', maxWidth: '460px', width: '100%' }}>
                <Link to={getLoginPath()} className="text-decoration-none mb-3 d-inline-flex align-items-center gap-1 small fw-semibold" style={{ color: colors.darkGold }}>
                    <RiArrowLeftLine /> Back to Login
                </Link>

                <div className="text-center mb-4">
                    <div className="d-inline-flex p-3 rounded-circle mb-3" style={{ backgroundColor: '#FCF8F0', border: `1.5px solid ${colors.gold}` }}>
                        <RiShieldCheckLine size={32} style={{ color: colors.darkGold }} />
                    </div>
                    <h4 className="fw-bold mb-1" style={{ color: colors.dark }}>Set New Password</h4>
                    <p className="text-muted small mb-0">
                        Account: <strong className="text-dark">{userRecord?.email || emailParam}</strong>
                    </p>
                </div>

                <form onSubmit={handleResetPassword}>
                    {/* New Password */}
                    <div className="mb-3">
                        <label className="form-label small fw-bold text-muted">New Password</label>
                        <div className="input-group">
                            <span className="input-group-text bg-light border-0">
                                <RiLockPasswordLine className="text-muted" />
                            </span>
                            <input
                                type={showNewPassword ? 'text' : 'password'}
                                className="form-control bg-light border-0 py-2"
                                placeholder="Enter new password"
                                required
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                className="input-group-text bg-light border-0"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                            >
                                {showNewPassword ? <RiEyeOffLine /> : <RiEyeLine />}
                            </button>
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div className="mb-3">
                        <label className="form-label small fw-bold text-muted">Confirm New Password</label>
                        <div className="input-group">
                            <span className="input-group-text bg-light border-0">
                                <RiLockPasswordLine className="text-muted" />
                            </span>
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                className="form-control bg-light border-0 py-2"
                                placeholder="Re-enter new password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                className="input-group-text bg-light border-0"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                                {showConfirmPassword ? <RiEyeOffLine /> : <RiEyeLine />}
                            </button>
                        </div>
                    </div>

                    {/* Password Rules Checklist */}
                    <div className="p-3 mb-3 rounded-3" style={{ backgroundColor: '#FCF8F0', border: '1px solid #EBD9B6' }}>
                        <div className="small fw-bold mb-2" style={{ color: '#775a18' }}>Password Requirements:</div>
                        <ul className="list-unstyled mb-0" style={{ fontSize: '12px' }}>
                            {passwordRules.map((rule, idx) => {
                                const passed = rule.test(newPassword);
                                return (
                                    <li key={idx} className={`d-flex align-items-center gap-2 mb-1 ${passed ? 'text-success fw-semibold' : 'text-muted'}`}>
                                        {passed ? <RiCheckLine className="text-success" /> : <RiCloseLine className="text-secondary" />}
                                        <span>{rule.label}</span>
                                    </li>
                                );
                            })}
                            <li className={`d-flex align-items-center gap-2 mt-1 ${passwordsMatch ? 'text-success fw-semibold' : 'text-muted'}`}>
                                {passwordsMatch ? <RiCheckLine className="text-success" /> : <RiCloseLine className="text-secondary" />}
                                <span>Passwords match</span>
                            </li>
                        </ul>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-gold w-100 py-2 fw-bold d-flex align-items-center justify-content-center gap-2"
                        disabled={submitting || !validatePassword(newPassword) || !passwordsMatch}
                    >
                        {submitting ? (
                            <>
                                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                Updating Password...
                            </>
                        ) : (
                            'Reset Password'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ResetPassword;
