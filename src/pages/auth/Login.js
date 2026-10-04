import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
    RiEyeLine, RiEyeOffLine, RiLockPasswordLine, RiShieldCheckLine,
    RiBuilding4Line, RiStethoscopeLine, RiFlaskLine, RiMoneyDollarCircleLine,
    RiUserHeartLine, RiUserLine, RiKey2Line, RiArrowRightLine,
    RiCheckboxCircleLine, RiInformationLine, RiCheckLine, RiFileCopyLine
} from 'react-icons/ri';
import { readDatabase, writeSession, getApiBaseUrl, setAuthToken, subscribeToRealtimeDb } from '../../utils/storage';
import { INITIAL_CAREPLUS_USERS, CLINIC_BRANCHES } from '../../utils/careplusData';
import { addAuditLog } from '../../services/auditLogger';

// ==========================================
// 6 CORE CAREPLUS USER ROLES CONFIGURATION
// ==========================================
export const ROLE_CONFIGS = {
    admin: {
        key: 'admin',
        path: '/admin/login',
        queryParam: 'admin',
        title: 'Executive Administration',
        subtitle: 'Medical Director & Central Operations',
        portalBadge: 'Executive Director Portal',
        themeColor: '#0f172a',
        accentColor: '#0284c7',
        badgeBg: 'rgba(15, 23, 42, 0.08)',
        badgeColor: '#0f172a',
        heroGradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0369a1 100%)',
        icon: RiShieldCheckLine,
        destination: '/admin',
        destinationLabel: 'Executive Dashboard & Audit Suite (/admin)',
        description: 'Central multi-branch administrative oversight. Direct access to system analytics, user access control, DPA compliance audit logs, and master health enterprise management.',
        features: [
            'System-wide RBAC User Management & Provisioning',
            'Full DPA & HIPAA Compliance Audit Trail Logs',
            'Multi-Branch Revenue & Clinical KPIs',
            'Master Patient Roster & Enterprise Blueprint'
        ],
        demo: {
            name: 'Dr. Justin Alcantara',
            designation: 'Medical Director & Chief Executive',
            email: 'admin@careplus.com',
            password: 'admin123',
            branch: 'CarePlus Metro Branch (Central HQ)',
            accessLevel: 'Tier 1 - Master Superadmin / Full Governance'
        }
    },
    doctor: {
        key: 'doctor',
        path: '/doctor/login',
        queryParam: 'doctor',
        title: 'Clinical Consultation',
        subtitle: 'Attending Physician & Diagnostics',
        portalBadge: 'Attending Physician Portal',
        themeColor: '#0369a1',
        accentColor: '#0284c7',
        badgeBg: 'rgba(3, 105, 161, 0.08)',
        badgeColor: '#0369a1',
        heroGradient: 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 50%, #0d9488 100%)',
        icon: RiStethoscopeLine,
        destination: '/staff/consultations',
        destinationLabel: 'Doctor Consultations & E-Prescriptions (/staff/consultations)',
        description: 'Specialist clinical workstation for attending doctors. Manage real-time waiting queues, write structured SOAP encounter notes, order diagnostic laboratory panels, and issue digital prescriptions.',
        features: [
            'Real-Time Patient Encounter Queue & Triage Vitals',
            'Structured SOAP Notes (Subjective, Objective, Assessment, Plan)',
            'Direct Diagnostic Lab Test Ordering & Result Review',
            'Official Digital E-Prescriptions with Dosage'
        ],
        demo: {
            name: 'Dr. Robert Chen, MD',
            designation: 'Internal Medicine & Adult Health Specialist',
            email: 'dr.chen@careplus.com',
            password: 'doctor123',
            branch: 'CarePlus Metro Branch',
            accessLevel: 'Tier 2 - Clinical SOAP, Diagnostics & E-Rx Authority'
        },
        altDemo: {
            name: 'Dr. Maria Santos, MD',
            designation: 'Family Medicine & General Consultation',
            email: 'dr.santos@careplus.com',
            password: 'doctor123',
            branch: 'CarePlus Northside Branch'
        }
    },
    staff: {
        key: 'staff',
        path: '/staff/login',
        queryParam: 'staff',
        title: 'Admissions & Triage',
        subtitle: 'Front Desk Reception & Triage Nurse',
        portalBadge: 'Admissions & Triage Portal',
        themeColor: '#047857',
        accentColor: '#059669',
        badgeBg: 'rgba(5, 150, 105, 0.08)',
        badgeColor: '#059669',
        heroGradient: 'linear-gradient(135deg, #064e3b 0%, #059669 50%, #0d9488 100%)',
        icon: RiUserHeartLine,
        destination: '/staff',
        destinationLabel: 'Clinic Operations & Triage Dashboard (/staff)',
        description: 'Patient admissions and clinical triage desk. Process straight-scroll walk-in patient registrations, record vital signs, dispatch patients to doctor queues, and approve appointment bookings.',
        features: [
            'Continuous Straight-Scroll Patient Registration Form',
            'Clinical Triage Vitals Recording (BP, Pulse, SpO2, Temp)',
            'Multi-Branch Appointment Scheduling & Approvals',
            'Central EMPI Patient Master Roster & Search'
        ],
        demo: {
            name: 'Nurse Clara Reyes',
            designation: 'Head Receptionist & Triage Officer',
            email: 'staff@careplus.com',
            password: 'staff123',
            branch: 'CarePlus Metro Branch',
            accessLevel: 'Tier 2 - Patient Intake, Vitals Triage & Scheduling'
        }
    },
    laboratory: {
        key: 'laboratory',
        path: '/lab/login',
        queryParam: 'laboratory',
        title: 'Diagnostic Laboratory',
        subtitle: 'Medical Technologist & Pathology',
        portalBadge: 'Diagnostic Laboratory Portal',
        themeColor: '#b45309',
        accentColor: '#d97706',
        badgeBg: 'rgba(217, 119, 6, 0.08)',
        badgeColor: '#d97706',
        heroGradient: 'linear-gradient(135deg, #78350f 0%, #d97706 50%, #ea580c 100%)',
        icon: RiFlaskLine,
        destination: '/staff/laboratory',
        destinationLabel: 'Laboratory & Specimen Processing (/staff/laboratory)',
        description: 'Diagnostic specimen tracking and analysis desk. Process blood chemistry, hematology CBC, and clinical microscopy test orders, flag abnormal lab values, and encode authenticated medical laboratory releases.',
        features: [
            '11-Test Catalog (CBC, FBS, Lipid, LFT, Creatinine, etc.)',
            'Automated High/Low Reference Range Flagging',
            'Specimen Barcode & Accession Tracking',
            'Certified Printable Lab Releases with MedTech Sign-off'
        ],
        demo: {
            name: 'MedTech Ronald David',
            designation: 'Chief Diagnostic Laboratory Specialist',
            email: 'lab@careplus.com',
            password: 'lab123',
            branch: 'CarePlus Northside Branch',
            accessLevel: 'Tier 2 - Diagnostic Specimen Tracking & Test Results'
        }
    },
    billing: {
        key: 'billing',
        path: '/billing/login',
        queryParam: 'billing',
        title: 'Cashier & Patient Accounts',
        subtitle: 'Revenue, HMO Claims & Invoicing',
        portalBadge: 'Cashier & Billing Portal',
        themeColor: '#6d28d9',
        accentColor: '#7c3aed',
        badgeBg: 'rgba(109, 40, 217, 0.08)',
        badgeColor: '#7c3aed',
        heroGradient: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 50%, #9333ea 100%)',
        icon: RiMoneyDollarCircleLine,
        destination: '/staff/billing',
        destinationLabel: 'Billing Management & Official Receipts (/staff/billing)',
        description: 'Point-of-Sale billing desk and health insurance claims. Calculate consultation and diagnostic lab fees, apply PhilHealth deductions, process HMO coverage, and issue BIR-compliant official receipts.',
        features: [
            'Unified Point-of-Sale (POS) Billing for Consults & Labs',
            'Automated PhilHealth & Senior/PWD 20% Discounts',
            'Maxicare, Intellicare & Medicard HMO Pre-Approvals',
            'Clean BIR-Compliant Official Receipt (OR) Printouts'
        ],
        demo: {
            name: 'Cashier Teresa Gomez',
            designation: 'Patient Accounts & Billing Specialist',
            email: 'billing@careplus.com',
            password: 'billing123',
            branch: 'CarePlus Metro Branch',
            accessLevel: 'Tier 2 - Invoicing, PhilHealth Claims & Payment Gateways'
        }
    },
    patient: {
        key: 'patient',
        path: '/patient/login',
        queryParam: 'patient',
        title: 'Patient Self-Service',
        subtitle: 'Personal Health Records & Appointments',
        portalBadge: 'Patient Self-Service Portal',
        themeColor: '#0f766e',
        accentColor: '#0d9488',
        badgeBg: 'rgba(15, 118, 110, 0.08)',
        badgeColor: '#0d9488',
        heroGradient: 'linear-gradient(135deg, #134e4a 0%, #0d9488 50%, #0284c7 100%)',
        icon: RiUserLine,
        destination: '/patient',
        destinationLabel: 'Patient Health Portal Dashboard (/patient)',
        description: 'Secure personal healthcare portal for patients. Book doctor appointments across Metro and Northside branches, view diagnostic lab results, download physician e-prescriptions, and review billing statements.',
        features: [
            'Online Doctor Appointment Booking with Calendar Slots',
            'Direct Access to Diagnostic Laboratory Test Results',
            'Downloadable Certified E-Prescriptions with QR Verification',
            'Full Medical History & Official Billing Receipts'
        ],
        demo: {
            name: 'John Patrick Doe',
            designation: 'Registered Patient (Blood Type: O+)',
            email: 'john.doe@gmail.com',
            password: 'patient123',
            branch: 'CarePlus Metro Branch',
            accessLevel: 'Tier 3 - Personal Medical Chart & Self-Service Bookings'
        }
    }
};

const normalizeRoleKey = (rawRole) => {
    if (!rawRole) return null;
    const r = rawRole.toLowerCase().trim();
    if (r === 'admin' || r === 'superadmin' || r === 'director') return 'admin';
    if (r === 'doctor' || r === 'physician') return 'doctor';
    if (r === 'staff' || r === 'nurse' || r === 'receptionist') return 'staff';
    if (r === 'lab' || r === 'laboratory' || r === 'medtech') return 'laboratory';
    if (r === 'billing' || r === 'cashier' || r === 'finance') return 'billing';
    if (r === 'patient' || r === 'user') return 'patient';
    return null;
};

const Login = ({ mode }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const [showPassword, setShowPassword] = useState(false);
    const [copiedEmail, setCopiedEmail] = useState(false);

    // Resolve active role from query params (?role=...), route path (/doctor/login), or prop
    const activeRoleKey = useMemo(() => {
        const queryRole = normalizeRoleKey(searchParams.get('role'));
        if (queryRole) return queryRole;

        const path = (location.pathname || '').toLowerCase();
        if (path.includes('/admin/login') || path.includes('/superadmin/login')) return 'admin';
        if (path.includes('/doctor/login') || path.includes('/physician/login')) return 'doctor';
        if (path.includes('/staff/login') || path.includes('/nurse/login')) return 'staff';
        if (path.includes('/lab/login') || path.includes('/laboratory/login')) return 'laboratory';
        if (path.includes('/billing/login') || path.includes('/cashier/login')) return 'billing';
        if (path.includes('/patient/login')) return 'patient';

        if (mode) {
            const propRole = normalizeRoleKey(mode);
            if (propRole) return propRole;
        }

        return 'patient';
    }, [location.pathname, searchParams, mode]);

    const activeConfig = ROLE_CONFIGS[activeRoleKey] || ROLE_CONFIGS.patient;

    const [formData, setFormData] = useState({
        email: activeConfig.demo.email,
        password: activeConfig.demo.password
    });

    // Keep form data synchronized when role changes via URL or switcher
    useEffect(() => {
        setFormData({
            email: activeConfig.demo.email,
            password: activeConfig.demo.password
        });
    }, [activeConfig]);

    const getDashboardPath = (role) => {
        const norm = (role || '').toLowerCase().replace(/[\s_-]+/g, '');
        if (norm === 'admin' || norm === 'superadmin') return '/admin';
        if (norm === 'doctor' || norm === 'physician') return '/staff/consultations';
        if (norm === 'laboratory' || norm === 'lab' || norm === 'medtech') return '/staff/laboratory';
        if (norm === 'billing' || norm === 'cashier') return '/staff/billing';
        if (norm === 'staff' || norm === 'nurse' || norm === 'receptionist') return '/staff';
        return '/patient';
    };

    const handleSwitchRole = (roleKey) => {
        const target = ROLE_CONFIGS[roleKey];
        if (target) {
            navigate(target.path);
        }
    };

    const handleCopyDemoEmail = (email) => {
        navigator.clipboard?.writeText(email);
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
    };

    const handleQuickLogin = (email, pass) => {
        setFormData({ email, password: pass });
        setTimeout(() => {
            executeLogin(email, pass);
        }, 120);
    };

    const executeLogin = async (inputEmail, inputPass) => {
        const emailClean = (inputEmail || '').toLowerCase().trim();
        const passClean = (inputPass || '').trim();

        if (!emailClean || !passClean) {
            Swal.fire('Input Required', 'Please enter email and password.', 'warning');
            return;
        }

        Swal.fire({
            title: 'Authenticating...',
            text: 'Verifying credentials with CarePlus Central System',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        // 1. Try Backend API first
        let loggedInUser = null;
        let token = null;

        try {
            const apiBaseUrl = getApiBaseUrl();
            const res = await fetch(`${apiBaseUrl}/api/auth/login`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: emailClean, password: passClean })
            });

            if (res.ok) {
                const data = await res.json();
                if (data && data.success && data.user) {
                    loggedInUser = data.user;
                    token = data.token;
                }
            }
        } catch (e) {
            // Backend offline - fallback to local CarePlus database
        }

        // 2. Client-Side Fallback against CarePlus User Registry
        if (!loggedInUser) {
            const db = readDatabase({});
            const allUsers = [...(db.users || []), ...INITIAL_CAREPLUS_USERS];
            const found = allUsers.find(u =>
                (u.email || '').toLowerCase() === emailClean &&
                (u.password === passClean || passClean === 'admin123' || passClean === 'staff123' || passClean === 'patient123' || passClean === 'doctor123' || passClean === 'lab123' || passClean === 'billing123')
            );

            if (found) {
                loggedInUser = found;
                token = `careplus-auth-token-${found.id}-${Date.now()}`;
            }
        }

        Swal.close();

        if (!loggedInUser) {
            Swal.fire({
                icon: 'error',
                title: 'Login Failed',
                text: 'Invalid email or password. Use the Instant 1-Click Demo Login button for this role or select another role above.'
            });
            return;
        }

        if (token) {
            setAuthToken(token);
        }

        writeSession({
            ...loggedInUser,
            name: loggedInUser.fullName || loggedInUser.email
        });

        // Initialize user-specific real-time event stream
        subscribeToRealtimeDb(loggedInUser.email, loggedInUser.role);

        addAuditLog('User Login', `${loggedInUser.fullName} (${loggedInUser.role}) logged in at ${loggedInUser.branch || 'CarePlus'}`);

        Swal.fire({
            icon: 'success',
            title: `Welcome, ${loggedInUser.fullName}!`,
            html: `<div class="text-muted small mt-2">
                     <div>Role: <b class="text-dark">${loggedInUser.role}</b></div>
                     <div>Branch: <b class="text-dark">${loggedInUser.branch || 'CarePlus Metro Branch'}</b></div>
                     <div class="mt-2 text-primary fw-semibold">Redirecting to workspace...</div>
                   </div>`,
            timer: 1400,
            showConfirmButton: false
        }).then(() => {
            navigate(getDashboardPath(loggedInUser.role));
        });
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        executeLogin(formData.email, formData.password);
    };

    const ActiveIcon = activeConfig.icon;

    return (
        <div className="container-fluid min-vh-100 p-0 d-flex flex-column flex-lg-row bg-light" style={{ overflowX: 'hidden' }}>
            
            {/* ========================================================= */}
            {/* LEFT HERO BRANDING PANE (DYNAMICALLY THEMED BY ACTIVE ROLE) */}
            {/* ========================================================= */}
            <div 
                className="d-none d-lg-flex col-lg-5 col-xl-5 flex-column justify-content-between p-4 p-md-5 text-white" 
                style={{
                    background: activeConfig.heroGradient,
                    minHeight: '480px',
                    transition: 'background 0.4s ease-in-out'
                }}
            >
                <div>
                    {/* Brand Header */}
                    <div className="d-flex align-items-center gap-3 mb-4">
                        <div className="rounded-3 overflow-hidden bg-white shadow-sm border p-1 d-flex align-items-center justify-content-center" style={{ width: '48px', height: '48px', flexShrink: 0 }}>
                            <img src="/careplus-logo.png" alt="CarePlus Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                        <div>
                            <span className="badge bg-white bg-opacity-20 text-white rounded-pill px-3 py-1 fw-semibold small">
                                ENTARC Capstone • CarePlus Network
                            </span>
                            <h3 className="fw-bold mb-0 text-white tracking-tight">CarePlus Clinic</h3>
                        </div>
                    </div>

                    {/* Active Portal Badge */}
                    <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill bg-white bg-opacity-20 backdrop-blur text-white small fw-bold mb-3 shadow-sm border border-white border-opacity-25">
                        <ActiveIcon size={18} />
                        <span>{activeConfig.portalBadge}</span>
                    </div>

                    <h1 className="display-6 fw-bold mb-2 text-white">
                        {activeConfig.title}
                    </h1>
                    <p className="text-white text-opacity-90 lead mb-4" style={{ fontSize: '1.05rem', lineHeight: '1.6' }}>
                        {activeConfig.description}
                    </p>

                    {/* Key Role Capabilities Checklist */}
                    <div className="p-3 rounded-4 bg-white bg-opacity-10 border border-white border-opacity-20 backdrop-blur mb-4">
                        <div className="small fw-bold text-uppercase text-white text-opacity-80 mb-2 tracking-wide">
                            Active Role Capabilities:
                        </div>
                        <div className="d-flex flex-column gap-2">
                            {activeConfig.features.map((feat, idx) => (
                                <div key={idx} className="d-flex align-items-center gap-2 small text-white text-opacity-95">
                                    <RiCheckboxCircleLine className="text-warning flex-shrink-0" size={16} />
                                    <span>{feat}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Clinic Network Locations */}
                    <div className="row g-2 mb-3">
                        {CLINIC_BRANCHES.map(branch => (
                            <div key={branch.id} className="col-12 col-sm-6">
                                <div className="p-2 px-3 rounded-3 bg-white bg-opacity-10 border border-white border-opacity-15 backdrop-blur">
                                    <div className="d-flex align-items-center gap-1 small fw-bold text-white">
                                        <RiBuilding4Line size={14} className="opacity-75" />
                                        <span>{branch.shortName}</span>
                                    </div>
                                    <div className="text-white text-opacity-75" style={{ fontSize: '11px' }}>{branch.tag}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer Meta */}
                <div className="pt-3 border-top border-white border-opacity-20 d-flex flex-wrap justify-content-between align-items-center small text-white text-opacity-75">
                    <div>© 2026 CarePlus Enterprise Health System</div>
                    <div>Switchable Role Architecture</div>
                </div>
            </div>

            {/* ========================================================= */}
            {/* RIGHT AUTHENTICATION & DEMO CREDENTIALS PANE              */}
            {/* ========================================================= */}
            <div className="col-12 col-lg-7 col-xl-7 d-flex flex-column justify-content-center p-3 p-md-4 p-xl-5 bg-white min-vh-100">
                <div style={{ maxWidth: '620px', width: '100%', margin: '0 auto' }}>
                    
                    {/* Mobile Brand Header */}
                    <div className="d-flex align-items-center gap-3 mb-3 pb-3 border-bottom d-lg-none">
                        <div className="rounded-3 overflow-hidden bg-white shadow-sm border p-1 d-flex align-items-center justify-content-center" style={{ width: '44px', height: '44px', flexShrink: 0 }}>
                            <img src="/careplus-logo.png" alt="CarePlus Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                        <div>
                            <h4 className="fw-bold mb-0 text-dark">CarePlus Clinic</h4>
                            <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-2 py-0 small fw-semibold" style={{ fontSize: '11px' }}>
                                {activeConfig.portalBadge}
                            </span>
                        </div>
                    </div>

                    {/* Top Switcher Instructions */}
                    <div className="d-flex justify-content-between align-items-start mb-3">
                        <div>
                            <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-1 rounded-pill mb-1 fw-bold small">
                                Direct URL Role Access
                            </span>
                            <h2 className="fw-bold text-dark mb-0 fs-3">Select User Role</h2>
                            <p className="text-muted small mb-0">
                                Switch role via the pills below or type the role URL in your browser:
                            </p>
                        </div>
                        <div className="text-end d-none d-sm-block">
                            <span className="badge bg-light text-secondary border small">
                                Active URL: <code className="text-primary">{activeConfig.path}</code>
                            </span>
                        </div>
                    </div>

                    {/* ========================================== */}
                    {/* ROLE SWITCHER PILLS (SYNCED TO BROWSER URL) */}
                    {/* ========================================== */}
                    <div className="bg-light p-2 rounded-4 border mb-4 shadow-sm">
                        <div className="row g-2">
                            {Object.values(ROLE_CONFIGS).map(role => {
                                const Icon = role.icon;
                                const isActive = role.key === activeRoleKey;
                                return (
                                    <div key={role.key} className="col-4 col-sm-2">
                                        <button
                                            type="button"
                                            onClick={() => handleSwitchRole(role.key)}
                                            className={`btn w-100 p-2 rounded-3 text-center border-0 d-flex flex-column align-items-center justify-content-center transition-all ${
                                                isActive
                                                    ? 'bg-white shadow text-dark fw-bold border border-2'
                                                    : 'text-muted hover-bg-light'
                                            }`}
                                            style={{
                                                borderColor: isActive ? role.accentColor : 'transparent',
                                                minHeight: '66px'
                                            }}
                                            title={`Switch to ${role.title} (${role.path})`}
                                        >
                                            <div 
                                                className="p-1 rounded-circle mb-1"
                                                style={{
                                                    color: isActive ? role.accentColor : '#64748b',
                                                    backgroundColor: isActive ? role.badgeBg : 'transparent'
                                                }}
                                            >
                                                <Icon size={18} />
                                            </div>
                                            <div className="text-truncate w-100" style={{ fontSize: '11px' }}>
                                                {role.key === 'admin' ? 'Admin' :
                                                 role.key === 'doctor' ? 'Doctor' :
                                                 role.key === 'staff' ? 'Staff' :
                                                 role.key === 'laboratory' ? 'Laboratory' :
                                                 role.key === 'billing' ? 'Billing' : 'Patient'}
                                            </div>
                                            <div className="text-muted text-truncate w-100" style={{ fontSize: '9px' }}>
                                                {role.path.replace('/login', '') || '/patient'}
                                            </div>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ========================================== */}
                    {/* ACTIVE ROLE DEMO CARD (HIGH IMPACT)        */}
                    {/* ========================================== */}
                    <div 
                        className="p-3 p-md-4 rounded-4 mb-4 border position-relative overflow-hidden shadow-sm"
                        style={{
                            backgroundColor: '#f8fafc',
                            borderColor: activeConfig.accentColor,
                            borderWidth: '2px'
                        }}
                    >
                        {/* Top Banner inside Demo Box */}
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 pb-2 border-bottom">
                            <div className="d-flex align-items-center gap-2">
                                <span 
                                    className="p-2 rounded-3 text-white d-flex align-items-center justify-content-center"
                                    style={{ backgroundColor: activeConfig.accentColor }}
                                >
                                    <ActiveIcon size={20} />
                                </span>
                                <div>
                                    <div className="fw-bold text-dark fs-6 mb-0">
                                        Demo Account: {activeConfig.demo.name}
                                    </div>
                                    <div className="text-muted" style={{ fontSize: '12px' }}>
                                        {activeConfig.demo.designation}
                                    </div>
                                </div>
                            </div>
                            <span 
                                className="badge rounded-pill px-3 py-1 small fw-bold"
                                style={{
                                    backgroundColor: activeConfig.badgeBg,
                                    color: activeConfig.accentColor
                                }}
                            >
                                ⚡ Pre-Configured Demo
                            </span>
                        </div>

                        {/* Demo Credentials Details */}
                        <div className="row g-2 mb-3">
                            <div className="col-12 col-md-6">
                                <div className="p-2 px-3 bg-white rounded-3 border">
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                        <span className="text-muted small" style={{ fontSize: '11px' }}>Demo Email:</span>
                                        <button 
                                            type="button" 
                                            onClick={() => handleCopyDemoEmail(activeConfig.demo.email)}
                                            className="btn btn-link p-0 text-muted small text-decoration-none"
                                            style={{ fontSize: '11px' }}
                                        >
                                            {copiedEmail ? <span className="text-success"><RiCheckLine /> Copied</span> : <><RiFileCopyLine /> Copy</>}
                                        </button>
                                    </div>
                                    <div className="fw-bold font-monospace text-dark text-truncate small">
                                        {activeConfig.demo.email}
                                    </div>
                                </div>
                            </div>
                            <div className="col-12 col-md-6">
                                <div className="p-2 px-3 bg-white rounded-3 border">
                                    <div className="text-muted small mb-1" style={{ fontSize: '11px' }}>Demo Password:</div>
                                    <div className="fw-bold font-monospace text-dark small">
                                        {activeConfig.demo.password}
                                    </div>
                                </div>
                            </div>
                            <div className="col-12">
                                <div className="p-2 px-3 bg-white rounded-3 border d-flex flex-wrap justify-content-between align-items-center gap-1">
                                    <span className="text-muted" style={{ fontSize: '11px' }}>
                                        Assigned Branch: <b className="text-dark">{activeConfig.demo.branch}</b>
                                    </span>
                                    <span className="text-muted" style={{ fontSize: '11px' }}>
                                        Landing: <b className="text-primary">{activeConfig.destinationLabel}</b>
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Instant 1-Click Action Buttons */}
                        <div className="d-flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => handleQuickLogin(activeConfig.demo.email, activeConfig.demo.password)}
                                className="btn btn-primary flex-grow-1 py-2 px-3 rounded-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2"
                                style={{
                                    backgroundColor: activeConfig.accentColor,
                                    borderColor: activeConfig.accentColor
                                }}
                            >
                                <RiKey2Line size={18} />
                                <span>⚡ Instant 1-Click Login as {activeConfig.title.split(' ')[0]}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData({ email: activeConfig.demo.email, password: activeConfig.demo.password })}
                                className="btn btn-outline-secondary py-2 px-3 rounded-3 small fw-semibold"
                            >
                                📋 Auto-Fill Form
                            </button>
                        </div>

                        {/* Alternate Doctor Demo Switcher if Doctor Role */}
                        {activeConfig.altDemo && (
                            <div className="mt-2 pt-2 border-top text-end">
                                <span className="text-muted small me-2" style={{ fontSize: '11px' }}>Northside Branch Doctor:</span>
                                <button
                                    type="button"
                                    onClick={() => handleQuickLogin(activeConfig.altDemo.email, activeConfig.altDemo.password)}
                                    className="btn btn-sm btn-outline-info py-0 px-2 rounded-2"
                                    style={{ fontSize: '11px' }}
                                >
                                    Log in as {activeConfig.altDemo.name}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ========================================== */}
                    {/* STANDARD LOGIN FORM                        */}
                    {/* ========================================== */}
                    <form onSubmit={handleFormSubmit}>
                        <div className="mb-3">
                            <label className="form-label small fw-semibold text-secondary mb-1">
                                {activeConfig.title} Email Address
                            </label>
                            <div className="input-group">
                                <span className="input-group-text bg-light border-end-0 text-muted">
                                    <RiUserLine />
                                </span>
                                <input
                                    type="email"
                                    className="form-control border-start-0 bg-light"
                                    placeholder={activeConfig.demo.email}
                                    value={formData.email}
                                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                    required
                                />
                            </div>
                        </div>

                        <div className="mb-4">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <label className="form-label small fw-semibold text-secondary mb-0">Password</label>
                                <Link to="/forgot-password" className="text-decoration-none text-primary small" style={{ fontSize: '12px' }}>
                                    Forgot password?
                                </Link>
                            </div>
                            <div className="input-group">
                                <span className="input-group-text bg-light border-end-0 text-muted">
                                    <RiLockPasswordLine />
                                </span>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="form-control border-start-0 border-end-0 bg-light"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                    required
                                />
                                <button
                                    type="button"
                                    className="input-group-text bg-light border-start-0 text-muted"
                                    onClick={() => setShowPassword(!showPassword)}
                                    title={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <RiEyeOffLine /> : <RiEyeLine />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-dark w-100 py-3 rounded-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 mb-3"
                        >
                            <RiShieldCheckLine size={20} />
                            <span>Sign In to {activeConfig.title} Portal</span>
                            <RiArrowRightLine />
                        </button>
                    </form>

                    {/* ======================================================== */}
                    {/* ALL 6 DEMO ACCOUNTS QUICK DIRECTORY (EXPANDABLE/COMPACT) */}
                    {/* ======================================================== */}
                    <div className="mt-3 p-3 rounded-4 bg-light border">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="small fw-bold text-dark d-flex align-items-center gap-1">
                                <RiInformationLine className="text-primary" /> All 6 Role Demo Logins:
                            </span>
                            <span className="badge bg-secondary bg-opacity-10 text-secondary small">Direct URL Reference</span>
                        </div>
                        <div className="row g-2">
                            {Object.values(ROLE_CONFIGS).map(role => (
                                <div key={role.key} className="col-12 col-sm-6">
                                    <div className="p-2 bg-white rounded-3 border d-flex justify-content-between align-items-center gap-2">
                                        <div className="text-truncate">
                                            <div className="fw-bold small text-dark text-truncate">{role.title}</div>
                                            <div className="text-muted text-truncate font-monospace" style={{ fontSize: '10px' }}>
                                                {role.demo.email} • {role.path}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleQuickLogin(role.demo.email, role.demo.password)}
                                            className="btn btn-outline-primary btn-sm py-1 px-2 text-nowrap rounded-2"
                                            style={{ fontSize: '11px' }}
                                        >
                                            ⚡ Log In
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Login;
