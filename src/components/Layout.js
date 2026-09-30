import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
    RiLogoutBoxRLine, RiMenuFoldLine, RiMenuUnfoldLine, RiSearchLine,
    RiUser3Line, RiDashboardLine, RiCalendarCheckLine, RiFileTextLine,
    RiPriceTag3Line, RiGroupLine, RiUserHeartLine, RiFileList3Line,
    RiLockLine, RiBuilding4Line, RiStethoscopeLine, RiFlaskLine,
    RiMoneyDollarCircleLine, RiNodeTree, RiShieldCheckLine, RiFileChartLine,
    RiUserAddLine
} from 'react-icons/ri';
import Swal from 'sweetalert2';
import Notifications from './Notification';
import {
    readDatabase, readSession, writeSession, clearSession,
    readProfilePic, writeProfilePic, touchSession,
    getLastSessionActivity, INACTIVITY_TIMEOUT_MS
} from '../utils/storage';
import { CLINIC_BRANCHES } from '../utils/careplusData';
import { addAuditLog } from '../services/auditLogger';

const getInitials = (name = 'User') => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (name[0] || 'U').toUpperCase();
};

const Layout = ({ children, role }) => {
    const [collapsed, setCollapsed] = useState(window.innerWidth < 992);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [profilePic, setProfilePic] = useState(null);
    const [globalSearch, setGlobalSearch] = useState('');
    const [selectedBranch, setSelectedBranch] = useState('All Branches');
    const navigate = useNavigate();
    const location = useLocation();
    const session = readSession() || {};

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 992) {
                setCollapsed(true);
            } else {
                setCollapsed(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 10-Minute Activity Timer
    useEffect(() => {
        let isLoggedOut = false;
        let lastTouchTime = Date.now();

        const performAutoLogout = () => {
            if (isLoggedOut) return;
            isLoggedOut = true;
            clearSession();
            writeSession(null);
            Swal.fire({
                title: 'Session Expired',
                text: 'You have been automatically logged out due to inactivity.',
                icon: 'warning',
                confirmButtonColor: '#0284c7'
            }).then(() => {
                window.location.href = '/login';
            });
        };

        const handleUserActivity = () => {
            const now = Date.now();
            if (now - lastTouchTime > 2000) {
                lastTouchTime = now;
                touchSession();
            }
        };

        touchSession();
        const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
        activityEvents.forEach(event => {
            window.addEventListener(event, handleUserActivity, { passive: true });
        });

        const checkInterval = setInterval(() => {
            const lastActive = getLastSessionActivity() || lastTouchTime;
            const idleTime = Date.now() - lastActive;
            if (idleTime >= INACTIVITY_TIMEOUT_MS) {
                performAutoLogout();
            }
        }, 5000);

        return () => {
            clearInterval(checkInterval);
            activityEvents.forEach(event => {
                window.removeEventListener(event, handleUserActivity);
            });
        };
    }, []);

    const menuConfigs = {
        patient: [
            { path: '/patient', icon: <RiDashboardLine />, label: 'Dashboard' },
            { path: '/patient/book', icon: <RiCalendarCheckLine />, label: 'Book Appointment' },
            { path: '/patient/consultations', icon: <RiStethoscopeLine />, label: 'Doctor Consultations & Rx' },
            { path: '/patient/laboratory', icon: <RiFlaskLine />, label: 'My Lab Results' },
            { path: '/patient/billing', icon: <RiMoneyDollarCircleLine />, label: 'Billing & Receipts' },
            { path: '/patient/medical', icon: <RiFileTextLine />, label: 'Medical History' },
            { path: '/patient/ea-blueprint', icon: <RiNodeTree />, label: 'EA Blueprint (ENTARC)' }
        ],
        staff: [
            { path: '/staff', icon: <RiDashboardLine />, label: 'Clinic Dashboard' },
            { path: '/staff/registration', icon: <RiUserAddLine />, label: 'Patient Registration' },
            { path: '/staff/book', icon: <RiCalendarCheckLine />, label: 'Appointment Scheduling' },
            { path: '/staff/consultations', icon: <RiStethoscopeLine />, label: 'Doctor Consultations' },
            { path: '/staff/laboratory', icon: <RiFlaskLine />, label: 'Laboratory & Results' },
            { path: '/staff/billing', icon: <RiMoneyDollarCircleLine />, label: 'Billing & Payments' },
            { path: '/staff/medical-reports', icon: <RiFileChartLine />, label: 'Medical Reports' },
            { path: '/staff/patients', icon: <RiUserHeartLine />, label: 'Patient Master Roster' },
            { path: '/staff/ea-blueprint', icon: <RiNodeTree />, label: 'EA Blueprint (ENTARC)' }
        ],
        admin: [
            { path: '/admin', icon: <RiDashboardLine />, label: 'Executive Dashboard' },
            { path: '/admin/registration', icon: <RiUserAddLine />, label: 'Patient Registration' },
            { path: '/admin/book', icon: <RiCalendarCheckLine />, label: 'Appointment Scheduling' },
            { path: '/admin/consultations', icon: <RiStethoscopeLine />, label: 'Doctor Consultations' },
            { path: '/admin/laboratory', icon: <RiFlaskLine />, label: 'Laboratory & Results' },
            { path: '/admin/billing', icon: <RiMoneyDollarCircleLine />, label: 'Billing & Payments' },
            { path: '/admin/medical-reports', icon: <RiFileChartLine />, label: 'Medical Reports' },
            { path: '/admin/users', icon: <RiGroupLine />, label: 'User Roles & Security' },
            { path: '/admin/audit-logs', icon: <RiFileList3Line />, label: 'Compliance Audit Logs' },
            { path: '/admin/ea-blueprint', icon: <RiNodeTree />, label: 'EA Blueprint (ENTARC)' }
        ]
    };

    const currentMenu = menuConfigs[role?.toLowerCase()] || menuConfigs.staff;

    const globalSearchResults = currentMenu.filter((item) => {
        const query = globalSearch.toLowerCase();
        return item.label.toLowerCase().includes(query) || item.path.toLowerCase().includes(query);
    });

    const handleGlobalSearchSelect = (path) => {
        setGlobalSearch('');
        navigate(path);
    };

    useEffect(() => {
        if (session?.email) {
            const savedPic = readProfilePic(session.email);
            if (savedPic) setProfilePic(savedPic);
        }
    }, [session?.email]);

    const handleLogout = () => {
        Swal.fire({
            title: 'Sign Out?',
            text: 'Are you sure you want to exit CarePlus Portal?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#0284c7',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, Sign Out'
        }).then((result) => {
            if (result.isConfirmed) {
                addAuditLog('User Logout', `${session.fullName || session.email} signed out.`);
                clearSession();
                writeSession(null);
                window.location.href = '/login';
            }
        });
    };

    return (
        <div className="d-flex overflow-hidden bg-light" style={{ height: '100vh', width: '100vw' }}>
            {/* Mobile backdrop */}
            {!collapsed && (
                <div
                    className="d-lg-none position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 animate__animated animate__fadeIn"
                    style={{ zIndex: 1040 }}
                    onClick={() => setCollapsed(true)}
                />
            )}

            {/* SIDEBAR */}
            <div
                className={`d-flex flex-column bg-white border-end shadow-sm ${!collapsed ? 'position-fixed position-lg-relative h-100' : ''}`}
                style={{
                    width: collapsed ? '80px' : '265px',
                    minWidth: collapsed ? '80px' : '265px',
                    transition: 'all 0.25s ease-in-out',
                    zIndex: 1050,
                    height: '100vh'
                }}
            >
                {/* Brand Header */}
                <div className="p-3 border-bottom d-flex align-items-center gap-3" style={{ height: '72px' }}>
                    <div className="p-2 rounded-3 bg-primary text-white d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '40px', height: '40px' }}>
                        <RiBuilding4Line size={24} />
                    </div>
                    {!collapsed && (
                        <div className="overflow-hidden">
                            <h6 className="fw-bold mb-0 text-dark text-truncate">CarePlus Clinic</h6>
                            <span className="text-muted text-uppercase small" style={{ fontSize: '10px', letterSpacing: '1px' }}>
                                Multi-Branch System
                            </span>
                        </div>
                    )}
                </div>

                {/* Navigation Items */}
                <div className="flex-grow-1 py-3 px-2 overflow-auto">
                    {currentMenu.map((item, idx) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={idx}
                                to={item.path}
                                onClick={() => {
                                    if (window.innerWidth < 992) setCollapsed(true);
                                }}
                                className={`d-flex align-items-center gap-3 px-3 py-2 mb-1 rounded-3 text-decoration-none transition ${isActive ? 'bg-primary text-white shadow-sm' : 'text-secondary hover-bg-light'}`}
                                style={{
                                    fontWeight: isActive ? '600' : '500',
                                    fontSize: '0.92rem'
                                }}
                                title={item.label}
                            >
                                <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{item.icon}</span>
                                {!collapsed && <span className="text-truncate">{item.label}</span>}
                            </Link>
                        );
                    })}
                </div>

                {/* Sidebar Footer with Branch Tag */}
                {!collapsed && (
                    <div className="p-3 border-top bg-light small">
                        <div className="d-flex align-items-center gap-2 mb-1">
                            <span className="badge bg-success bg-opacity-10 text-success rounded-pill px-2">Online</span>
                            <span className="text-muted fw-semibold">CarePlus Network</span>
                        </div>
                        <div className="text-muted" style={{ fontSize: '11px' }}>
                            Metro & Northside Branches Connected
                        </div>
                    </div>
                )}
            </div>

            {/* MAIN VIEW AREA */}
            <div className="flex-grow-1 d-flex flex-column overflow-hidden h-100">
                {/* TOP NAVIGATION BAR */}
                <nav className="navbar navbar-expand bg-white border-bottom px-3 px-md-4 shadow-sm" style={{ height: '72px', flexShrink: 0 }}>
                    <div className="container-fluid p-0 d-flex justify-content-between align-items-center">
                        {/* Left: Sidebar Toggle & Branch Selector */}
                        <div className="d-flex align-items-center gap-3">
                            <button
                                className="btn btn-light border d-flex align-items-center justify-content-center p-2 rounded-3"
                                onClick={() => setCollapsed(!collapsed)}
                                title="Toggle Sidebar"
                            >
                                {collapsed ? <RiMenuUnfoldLine size={20} /> : <RiMenuFoldLine size={20} />}
                            </button>

                            {/* Branch Selector Switcher */}
                            <div className="d-none d-md-flex align-items-center gap-2 bg-light border px-3 py-1 rounded-pill">
                                <RiBuilding4Line className="text-primary" />
                                <span className="small text-muted fw-semibold">Active Facility:</span>
                                <select
                                    className="form-select form-select-sm border-0 bg-transparent fw-bold text-dark py-0"
                                    style={{ width: 'auto', cursor: 'pointer' }}
                                    value={selectedBranch}
                                    onChange={(e) => setSelectedBranch(e.target.value)}
                                >
                                    <option value="All Branches">CarePlus HQ (All Branches)</option>
                                    {CLINIC_BRANCHES.map(b => (
                                        <option key={b.id} value={b.name}>{b.shortName}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Center Search for Quick Jump */}
                        <div className="d-none d-lg-block position-relative" style={{ width: '320px' }}>
                            <div className="input-group input-group-sm">
                                <span className="input-group-text bg-light border-0"><RiSearchLine className="text-muted" /></span>
                                <input
                                    type="text"
                                    className="form-control bg-light border-0 shadow-none py-2"
                                    placeholder="Quick feature jump..."
                                    value={globalSearch}
                                    onChange={(e) => setGlobalSearch(e.target.value)}
                                />
                            </div>
                            {globalSearch && (
                                <div className="position-absolute start-0 end-0 mt-2 bg-white border shadow-lg rounded-3" style={{ zIndex: 1060 }}>
                                    {globalSearchResults.map(item => (
                                        <button
                                            key={item.path}
                                            type="button"
                                            className="btn w-100 text-start d-flex align-items-center gap-2 px-3 py-2 border-0 hover-bg-light small"
                                            onClick={() => handleGlobalSearchSelect(item.path)}
                                        >
                                            <span className="text-primary">{item.icon}</span>
                                            <span className="fw-semibold">{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Right: Notifications & User Profile Menu */}
                        <div className="d-flex align-items-center gap-3">
                            <Notifications />

                            {/* User Profile Badge */}
                            <div className="d-flex align-items-center gap-2 border-start ps-3">
                                <div className="d-none d-sm-block text-end">
                                    <div className="fw-bold text-dark small leading-tight">
                                        {session?.fullName || session?.email?.split('@')[0] || 'User'}
                                    </div>
                                    <span className="badge rounded-pill bg-primary bg-opacity-10 text-primary" style={{ fontSize: '10px' }}>
                                        {session?.role || role || 'User'}
                                    </span>
                                </div>

                                <div className="position-relative">
                                    <div
                                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                                        className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold shadow-sm cursor-pointer"
                                        style={{ width: '40px', height: '40px', cursor: 'pointer' }}
                                    >
                                        {getInitials(session?.fullName || 'User')}
                                    </div>

                                    {showProfileMenu && (
                                        <div
                                            className="position-absolute end-0 mt-2 bg-white border shadow-lg rounded-4 p-3 animate__animated animate__fadeIn"
                                            style={{ width: '240px', zIndex: 1070 }}
                                        >
                                            <div className="border-bottom pb-2 mb-2">
                                                <div className="fw-bold text-dark">{session?.fullName || 'CarePlus User'}</div>
                                                <div className="text-muted small text-truncate">{session?.email}</div>
                                                <div className="badge bg-light text-secondary border mt-1">{session?.branch || 'CarePlus Network'}</div>
                                            </div>
                                            <button
                                                onClick={handleLogout}
                                                className="btn btn-outline-danger btn-sm w-100 rounded-pill d-flex align-items-center justify-content-center gap-2"
                                            >
                                                <RiLogoutBoxRLine /> Sign Out
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </nav>

                {/* SCROLLABLE ROUTE CONTENT */}
                <main className="flex-grow-1 overflow-auto bg-light">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default Layout;
