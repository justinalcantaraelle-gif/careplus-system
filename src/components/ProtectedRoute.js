import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { readDatabase, readSession, getAuthToken, clearAuthToken, clearSession, getApiBaseUrl } from '../utils/storage';
import { getPatientIntakeStatus } from '../utils/patientIntake';

const ProtectedRoute = ({ children, requiredRole }) => {
    const location = useLocation();
    const session = readSession();
    const token = getAuthToken();
    const db = readDatabase({ consent_records: [], medical_records: {} });
    const [authFailed, setAuthFailed] = useState(false);

    useEffect(() => {
        let isMounted = true;
        if (token && !token.startsWith('careplus-auth-token-')) {
            fetch(`${getApiBaseUrl()}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` },
                credentials: 'include'
            }).then(res => {
                if (!res.ok && isMounted) {
                    clearAuthToken();
                    clearSession();
                    setAuthFailed(true);
                }
            }).catch(() => {
                // Ignore transient network errors
            });
        }
        return () => { isMounted = false; };
    }, [token]);

    if (!session || (!token && !session.email) || authFailed) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    const normalizeRole = (role) => {
        const normalizedRole = (role || '').toLowerCase().replace(/\s+/g, '');
        if (normalizedRole === 'superadmin') return 'admin';
        if (normalizedRole === 'doctor' || normalizedRole === 'laboratory' || normalizedRole === 'billing') return 'staff';
        return normalizedRole;
    };

    const userRole = normalizeRole(session.role);
    const targetRole = requiredRole.toLowerCase();

    // Admins have umbrella access to staff screens
    if (userRole !== targetRole && !(userRole === 'admin' && targetRole === 'staff')) {
        return <Navigate to={`/${userRole}`} replace />;
    }

    if (userRole === 'patient') {
        const intake = getPatientIntakeStatus(db, session);

        // Step 1: Force Consent Form first if not signed
        if (!intake.hasSigned) {
            const isAllowed = location.pathname === '/patient' || location.pathname.includes('/patient/consent');
            if (!isAllowed) {
                return <Navigate to="/patient/consent" replace />;
            }
        } else if (!intake.hasMedicalRecord) {
            // Step 2: Force Medical Records next if consent is signed but medical records incomplete
            const isAllowed = location.pathname === '/patient' || location.pathname.includes('/patient/medical');
            if (!isAllowed) {
                return <Navigate to="/patient/medical" replace />;
            }
        }
    }

    return children;
};

export default ProtectedRoute;
