import { readDatabase, writeDatabase, getDatabase, deleteUserDirectly } from '../../utils/storage';
import React, { useState, useEffect } from 'react';
import { RiDeleteBin6Line, RiShieldKeyholeLine, RiCheckboxCircleLine, RiSearchLine, RiLockLine } from 'react-icons/ri';
import Swal from 'sweetalert2';
import { addAuditLog } from '../../services/auditLogger';
import { sendWelcomeEmail, sendPasswordResetLink } from '../../utils/emailService';
import { addUserNotification } from '../../utils/notificationStore';
import { generateDefaultPassword, validatePassword, passwordRequirementsHtml } from '../../utils/passwordRules';

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [showStaffForm, setShowStaffForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [newStaff, setNewStaff] = useState({
        fullName: '', email: '', password: '', role: 'Staff'
    });

    const colors = { gold: '#D4AF37', beige: '#F5F5DC', goldDark: '#B8860B' };

    useEffect(() => {
        loadData();

        window.addEventListener('storage', loadData);
        window.addEventListener('doc_dental_db_updated', loadData);
        return () => {
            window.removeEventListener('storage', loadData);
            window.removeEventListener('doc_dental_db_updated', loadData);
        };
    }, []);

    const loadData = async () => {
        const db = await getDatabase(true).catch(() => readDatabase() || {});
        setUsers(db.users || []);
    };

    const generateSecureTemporaryPassword = (name = '') => {
        return generateDefaultPassword(name);
    };

    const handleCreateStaff = async (e) => {
        e.preventDefault();
        let db = await getDatabase(true).catch(() => readDatabase() || { users: [], auditLogs: [] });
        if (!db.users) db.users = []; 
        
        const existingUser = db.users.find(u => (u.email || '').toLowerCase().trim() === newStaff.email.toLowerCase().trim());
        if (existingUser) {
            return Swal.fire({
                title: 'Email Already Registered',
                text: `The email "${newStaff.email}" is already registered in the system. Each email address can only be associated with one account.`,
                icon: 'error'
            });
        }

        const passwordToUse = generateSecureTemporaryPassword(newStaff.fullName);

        if (!validatePassword(passwordToUse)) {
            return Swal.fire({
                title: 'Security Requirement',
                html: `<div class="text-start small">
                    Generated password does not satisfy security rules:
                    <ul class="mb-0 mt-2">
                        ${passwordRequirementsHtml()}
                    </ul>
                </div>`,
                icon: 'warning'
            });
        }

        Swal.fire({
            title: 'Creating Account...',
            text: 'Creating account...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        // 1. Verify email existence & deliver credentials FIRST
        const emailRes = await sendWelcomeEmail(newStaff.email, newStaff.fullName, passwordToUse, newStaff.role || 'Staff');
        Swal.close();

        if (!emailRes.success) {
            Swal.fire({
                title: 'Email Verification Failed',
                html: `<div class="text-start">
                    <p class="mb-2 text-danger fw-bold"><i class="bi bi-exclamation-triangle-fill me-1"></i> Staff account was NOT created.</p>
                    <p class="mb-2">The email address <strong>"${newStaff.email}"</strong> could not be verified or does not exist.</p>
                    <div class="alert alert-danger p-2 small mb-2">
                        <strong>Reason:</strong> ${emailRes.reason || 'Invalid email domain or mail server rejected recipient.'}
                    </div>
                    <p class="small text-muted mb-0">Please verify that the staff member provided an active, existing email address and try again.</p>
                </div>`,
                icon: 'error',
                confirmButtonColor: colors.goldDark
            });
            return;
        }

        // 2. Email is verified! Proceed with creating user in database
        const newUser = { 
            ...newStaff, 
            password: passwordToUse,
            id: Date.now(), 
            createdAt: new Date().toISOString() 
        };
        db.users.push(newUser);
        db = addUserNotification(db, newStaff.email, {
            id: `welcome-staff-${Date.now()}`,
            title: 'Welcome to the Team',
            message: 'Your staff account has been set up successfully. Welcome to CarePlus Clinic Management System!',
            date: new Date().toISOString(),
            read: false,
            type: 'system_welcome'
        });

        // Notify superadmin & admins of new account creation
        const staffAdmins = (db.users || []).filter(u => u.role === 'Admin' || u.role === 'superadmin');
        staffAdmins.forEach(sa => {
            db = addUserNotification(db, sa.email, {
                id: `staff-created-${Date.now()}-${sa.email}`,
                title: 'Staff Account Created',
                message: `New ${newStaff.role || 'Staff'} account created for ${newStaff.fullName} (${newStaff.email}).`,
                date: new Date().toISOString(),
                read: false,
                type: 'account_created'
            });
        });

        await writeDatabase(db);
        setUsers([...db.users]);
        
        addAuditLog('Created Staff Account', `${newStaff.fullName} (${newStaff.email}) - ${newStaff.role}`);
        
        Swal.fire({
            title: 'Account Verified & Created!',
            text: `Staff account for ${newStaff.fullName} has been successfully verified and created. Login credentials have been sent.`,
            icon: 'success',
            confirmButtonColor: colors.goldDark
        });

        setNewStaff({ fullName: '', email: '', password: '', role: 'Staff' });
        setShowStaffForm(false);
        loadData();

    };

    const handleResendWelcomeEmail = async (staffMember) => {
        const staffName = staffMember.fullName || 'Staff Member';
        const emailNorm = (staffMember.email || '').toLowerCase().trim();

        const confirm = await Swal.fire({
            title: `Resend Staff Credentials?`,
            html: `<div class="text-start">
                <p class="mb-2">Send portal login credentials to <strong>${staffName}</strong> at <strong>${emailNorm}</strong>?</p>
                <p class="small text-muted mb-0">This will email their account login link and credentials via clinic SMTP.</p>
            </div>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: colors.goldDark,
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, Send Email',
            cancelButtonText: 'Cancel'
        });

        if (!confirm.isConfirmed) return;

        Swal.fire({
            title: 'Sending Welcome Email...',
            text: 'Delivering credentials email via SMTP, please wait...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        let passwordToSend = staffMember.password;
        if (!passwordToSend) {
            const db = await getDatabase(true).catch(() => readDatabase() || {});
            const found = (db.users || []).find(u => (u.email || '').toLowerCase().trim() === emailNorm);
            passwordToSend = found?.password;
        }

        if (!passwordToSend) {
            passwordToSend = generateDefaultPassword(staffName);
            let db = await getDatabase(true).catch(() => readDatabase() || { users: [] });
            db.users = (db.users || []).map(u => {
                if ((u.email || '').toLowerCase().trim() === emailNorm) {
                    return { ...u, password: passwordToSend };
                }
                return u;
            });
            await writeDatabase(db);
        }

        const res = await sendWelcomeEmail(emailNorm, staffName, passwordToSend, staffMember.role || 'Staff');
        Swal.close();

        if (res.success) {
            addAuditLog('Resent Account Credentials Email', `Staff: ${staffName} (${emailNorm})`);
            Swal.fire({
                title: 'Email Delivered!',
                text: 'Welcome credentials email has been successfully sent.',
                icon: 'success',
                confirmButtonColor: colors.goldDark
            });
        } else {
            Swal.fire({
                title: 'Email Delivery Notice',
                html: `<div class="text-start">
                    <p>Could not deliver email: <strong>${res.reason || 'Server SMTP offline'}</strong></p>
                    <div class="alert alert-info p-2 small mb-0">
                        Temporary Password on file: <strong><code class="user-select-all">${passwordToSend}</code></strong>
                    </div>
                </div>`,
                icon: 'warning',
                confirmButtonColor: colors.goldDark
            });
        }
    };


    const handleDelete = async (id, name, email, role) => {
        const result = await Swal.fire({
            title: `Delete ${role}?`,
            text: `Are you sure you want to permanently remove ${name} (${email})?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, Delete'
        });

        if (result.isConfirmed) {
            Swal.fire({
                title: 'Deleting...',
                text: 'Removing account from database...',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // 1. Direct atomic deletion from MySQL database
            await deleteUserDirectly(id, email);

            // 2. Remove from local memory state and sync
            let db = await getDatabase(true).catch(() => readDatabase() || { users: [] });
            if (db.users) {
                db.users = db.users.filter(u => String(u.id) !== String(id) && (u.email || '').toLowerCase().trim() !== (email || '').toLowerCase().trim());
                await writeDatabase(db);
            }

            addAuditLog(`Permanently Deleted ${role}`, `${name} (${email})`);
            setUsers(prev => prev.filter(u => String(u.id) !== String(id) && (u.email || '').toLowerCase().trim() !== (email || '').toLowerCase().trim()));
            await loadData();
            Swal.close();

            Swal.fire({
                title: 'Account Deleted',
                text: `${role} account for ${name} has been removed permanently from MySQL database.`,
                icon: 'success',
                confirmButtonColor: colors.goldDark
            });
        }
    };

    const sendUserResetLink = async (email) => {
        const db = await getDatabase(true).catch(() => readDatabase() || { users: [] });
        if (!db.users) return;

        const userIndex = db.users.findIndex(u => u.email === email);
        if (userIndex === -1) return;

        const targetUser = db.users[userIndex];
        const token = (typeof window !== 'undefined' && window.crypto?.randomUUID) 
            ? window.crypto.randomUUID().replace(/-/g, '') 
            : 'rst_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
        
        db.users[userIndex].reset_token = token;
        db.users[userIndex].reset_token_expires = Date.now() + 15 * 60 * 1000; // 15 minutes
        delete db.users[userIndex].temp_otp;
        delete db.users[userIndex].otp_status;
        await writeDatabase(db);

        addAuditLog('Sent Password Reset Link', email);
        
        Swal.fire({
            title: 'Sending Reset Link...',
            text: 'Delivering secure password reset link to user email.',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        // Dispatch Reset Link Email to the user
        const res = await sendPasswordResetLink(targetUser.email, targetUser.fullName || targetUser.name || 'User', token);
        Swal.close();

        if (res.success) {
            Swal.fire({
                title: 'Reset Link Sent',
                html: `A secure password reset link has been dispatched to <b>${targetUser.email}</b>.`,
                icon: 'success'
            });
        } else {
            const fallbackLink = res.resetLink || `${window.location.origin}/reset-password?token=${token}&email=${encodeURIComponent(targetUser.email)}`;
            Swal.fire({
                title: 'Email Delivery Note',
                html: `
                    <div class="text-start">
                        <p class="text-muted small">We attempted to email the link (${res.reason || 'offline'}).</p>
                        <p class="mb-1"><strong>Direct Reset Link:</strong></p>
                        <a href="${fallbackLink}" class="small text-break" target="_blank" rel="noopener noreferrer">${fallbackLink}</a>
                    </div>
                `,
                icon: 'info'
            });
        }
        loadData();
    };

    const isSuperAdminUser = (u) => {
        if (!u) return false;
        const normRole = (u.role || '').toLowerCase().trim();
        return normRole === 'superadmin' || normRole === 'super_admin';
    };

    const renderRoleBadge = (u) => {
        if (isSuperAdminUser(u)) {
            return (
                <span 
                    className="badge rounded-pill px-3 py-2 shadow-sm d-inline-flex align-items-center gap-2 fw-bold"
                    style={{ 
                        background: 'linear-gradient(135deg, #181512 0%, #3a3022 100%)', 
                        color: '#ffe58f', 
                        border: '1.5px solid #d4af37',
                        fontSize: '12.5px',
                        letterSpacing: '0.4px',
                        boxShadow: '0 3px 10px rgba(212, 175, 55, 0.35)'
                    }}
                >
                    👑 SUPER ADMIN
                </span>
            );
        }

        // Staff and Admin are the same role (Admin)
        return (
            <span 
                className="badge rounded-pill px-3 py-2 text-white shadow-sm d-inline-flex align-items-center gap-1 fw-bold"
                style={{ 
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', 
                    fontSize: '12px',
                    letterSpacing: '0.3px',
                    boxShadow: '0 3px 8px rgba(37, 99, 235, 0.3)'
                }}
            >
                🛡️ ADMIN
            </span>
        );
    };

    const filteredUsers = users.filter(u => {
        const isNotPatient = u.role !== 'Patient';
        const query = searchTerm.toLowerCase();
        const matchesSearch = searchTerm 
            ? String(u.fullName || '').toLowerCase().startsWith(query)
            : true;
        return isNotPatient && matchesSearch;
    });

    return (
        <div className="p-4 p-md-5 w-100" style={{ backgroundColor: '#F4F7F6', minHeight: '100vh' }}>
            
            {/* Header */}
            <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center mb-5 gap-3">
                <h2 className="fw-bold mb-0 text-dark">Staff & Admin Accounts</h2>
                <div className="input-group bg-white rounded shadow-sm" style={{ width: 'min(100%, 300px)' }}>
                    <span className="input-group-text bg-transparent border-0 text-muted"><RiSearchLine /></span>
                    <input 
                        type="text" 
                        className="form-control border-0 shadow-none bg-transparent" 
                        placeholder="Search email or name..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)} 
                    />
                </div>
            </div>

            {/* Create Account Button */}
            <div className="d-flex justify-content-end mb-4">
                <button 
                    className="doc-btn doc-btn-gold-solid px-4" 
                    onClick={() => setShowStaffForm(!showStaffForm)}
                >
                    {showStaffForm ? 'Close Form' : 'Create Staff Admin Account'}
                </button>
            </div>

            {/* Registration Form */}
            {showStaffForm && (
                <div className="card border-0 shadow-sm mb-4 p-4 rounded-4 animate__animated animate__fadeIn">
                    <form onSubmit={handleCreateStaff} className="row g-3 align-items-center">
                        <div className="col-md-4">
                            <input 
                                type="text" 
                                className="form-control border-light shadow-sm" 
                                placeholder="Full Name" 
                                required 
                                value={newStaff.fullName} 
                                onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })} 
                            />
                        </div>
                        <div className="col-md-4">
                            <input type="email" className="form-control border-light shadow-sm" placeholder="Email" required value={newStaff.email} onChange={(e) => setNewStaff({...newStaff, email: e.target.value})} />
                        </div>
                        <div className="col-md-4">
                            <input 
                                type="password" 
                                className="form-control border-light shadow-sm bg-light text-muted" 
                                value="********" 
                                readOnly 
                                disabled
                            />
                        </div>
                        <div className="col-12 mt-2 d-flex justify-content-between align-items-center">
                            <small className="text-muted"><RiLockLine /> <strong>Security Protection:</strong> Password is censored with asterisks (*) and delivered directly to the staff member's email address.</small>
                            <button type="submit" className="doc-btn doc-btn-primary-solid px-4">Register Staff</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Content Table Card */}
            <div className="bg-white rounded-4 shadow-sm border border-light p-4">
                <div className="row mb-4">
                    <div className="col-md-6 col-lg-4">
                        <div className="input-group">
                            <span className="input-group-text bg-light border-end-0 rounded-start-pill ps-3 text-muted">
                                <RiSearchLine />
                            </span>
                            <input 
                                type="text" 
                                className="form-control bg-light border-start-0 rounded-end-pill py-2" 
                                placeholder="Search by name or email..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                            <tr>
                                <th className="p-3 border-0 text-muted small fw-bold">Employee Name</th>
                                <th className="p-3 border-0 text-muted small fw-bold">Role &amp; Access</th>
                                <th className="p-3 border-0 text-muted small fw-bold">Email Address</th>
                                <th className="p-3 border-0 text-muted small fw-bold">Authentication Status</th>
                                <th className="p-3 border-0 text-muted small fw-bold text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(u => {
                                const isSuper = isSuperAdminUser(u);
                                const isAdm = (u.role || '').toLowerCase() === 'admin';

                                return (
                                    <tr key={u.id}>
                                        <td className="p-3 fw-bold text-dark">
                                            {u.fullName || 'User'}
                                        </td>
                                        <td className="p-3">
                                            {renderRoleBadge(u)}
                                        </td>
                                        <td className="p-3 text-secondary">{u.email}</td>
                                        <td className="p-3">
                                            {u.reset_token || u.otp_status === 'PENDING' ? 
                                                <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-3 py-2 rounded-pill"><RiShieldKeyholeLine className="me-1" /> Reset Pending</span> : 
                                                <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2 rounded-pill"><RiCheckboxCircleLine className="me-1" /> Secured</span>
                                            }
                                        </td>
                                        <td className="text-center">
                                            {!isSuper && (
                                                <div className="d-flex align-items-center justify-content-center gap-1">
                                                    <button 
                                                        className="doc-btn doc-btn-warning doc-btn-sm" 
                                                        title="Send Password Reset Link"
                                                        onClick={() => sendUserResetLink(u.email)}
                                                    >
                                                        Send Reset Link
                                                    </button>
                                                    <button 
                                                        className="doc-btn doc-btn-danger doc-btn-sm p-1" 
                                                        title="Delete Account"
                                                        onClick={() => handleDelete(u.id, u.fullName, u.email, 'Admin')}
                                                    >
                                                        <RiDeleteBin6Line size={15} />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="text-center p-5 text-muted">No accounts found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default UserManagement;
