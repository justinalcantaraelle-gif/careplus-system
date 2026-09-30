import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
    RiUserAddLine, RiSearchLine, RiBuilding4Line, RiUserHeartLine,
    RiCalendarCheckLine, RiStethoscopeLine, RiFlaskLine, RiMoneyDollarCircleLine,
    RiFileTextLine, RiPhoneLine, RiMailLine, RiMapPinLine, RiHeartPulseLine,
    RiShieldCheckLine, RiCheckLine
} from 'react-icons/ri';
import { readDatabase, writeDatabase, readSession } from '../../utils/storage';
import { CLINIC_BRANCHES } from '../../utils/careplusData';
import { addAuditLog } from '../../services/auditLogger';

const PatientRegistration = () => {
    const navigate = useNavigate();
    const session = readSession() || {};
    const [db, setDb] = useState(() => readDatabase({}));
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBranch, setSelectedBranch] = useState('All');
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [selectedPatientDetails, setSelectedPatientDetails] = useState(null);

    // Registration Form
    const [regForm, setRegForm] = useState({
        fullName: '',
        email: '',
        phone: '',
        birthdate: '',
        gender: 'Female',
        address: '',
        bloodType: 'O+',
        emergencyContact: '',
        branch: session.branch || CLINIC_BRANCHES[0].name,
        patient_type: 'Regular Patient',
        insuranceProvider: 'None (Self-Pay)',
        allergies: 'None known',
        chronicConditions: 'None reported'
    });

    useEffect(() => {
        const sync = () => setDb(readDatabase({}));
        window.addEventListener('careplus_db_updated', sync);
        window.addEventListener('storage', sync);
        return () => {
            window.removeEventListener('careplus_db_updated', sync);
            window.removeEventListener('storage', sync);
        };
    }, []);

    const patients = useMemo(() => {
        return (db.users || []).filter(u => {
            const isPatient = (u.role || '').toLowerCase() === 'patient';
            if (!isPatient) return false;
            const matchesBranch = selectedBranch === 'All' || u.branch === selectedBranch;
            const query = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm ||
                (u.fullName || '').toLowerCase().includes(query) ||
                (u.email || '').toLowerCase().includes(query) ||
                (u.phone || '').toLowerCase().includes(query) ||
                (u.insuranceProvider || '').toLowerCase().includes(query);
            return matchesBranch && matchesSearch;
        });
    }, [db.users, selectedBranch, searchTerm]);

    const handleRegisterPatient = (e) => {
        e.preventDefault();
        if (!regForm.fullName || !regForm.email || !regForm.phone) {
            Swal.fire('Error', 'Please provide full name, email, and phone number.', 'warning');
            return;
        }

        const emailLower = regForm.email.toLowerCase().trim();
        const exists = (db.users || []).some(u => (u.email || '').toLowerCase() === emailLower);
        if (exists) {
            Swal.fire('Duplicate Email', 'A patient with this email already exists in the CarePlus registry.', 'warning');
            return;
        }

        const newId = Date.now();
        const newUser = {
            id: newId,
            email: emailLower,
            password: 'patient123', // default registration password
            role: 'Patient',
            fullName: regForm.fullName.trim(),
            phone: regForm.phone.trim(),
            birthdate: regForm.birthdate,
            gender: regForm.gender,
            address: regForm.address,
            bloodType: regForm.bloodType,
            emergencyContact: regForm.emergencyContact,
            branch: regForm.branch,
            patient_type: regForm.patient_type,
            insuranceProvider: regForm.insuranceProvider,
            otp_status: 'Verified',
            created_at: new Date().toISOString()
        };

        // Create initial medical history record
        const newMedicalRecords = {
            ...(db.medical_records || {}),
            [emailLower]: {
                allergies: regForm.allergies ? [regForm.allergies] : [],
                conditions: regForm.chronicConditions ? [regForm.chronicConditions] : [],
                bloodType: regForm.bloodType,
                emergencyContact: regForm.emergencyContact,
                hasConsented: true,
                consentTimestamp: new Date().toLocaleDateString()
            }
        };

        const newDb = {
            ...db,
            users: [newUser, ...(db.users || [])],
            medical_records: newMedicalRecords
        };

        writeDatabase(newDb);
        addAuditLog('Patient Registered', `Registered patient ${newUser.fullName} (${newUser.email}) at ${newUser.branch}`);

        Swal.fire({
            icon: 'success',
            title: 'Patient Registered!',
            html: `<p><b>${newUser.fullName}</b> has been admitted to the <b>${newUser.branch}</b> roster.</p>
                   <p class="small text-muted">A medical chart and portal credentials have been provisioned.</p>`,
            confirmButtonText: 'Great!'
        });

        setShowRegisterModal(false);
        setRegForm({
            fullName: '',
            email: '',
            phone: '',
            birthdate: '',
            gender: 'Female',
            address: '',
            bloodType: 'O+',
            emergencyContact: '',
            branch: session.branch || CLINIC_BRANCHES[0].name,
            patient_type: 'Regular Patient',
            insuranceProvider: 'None (Self-Pay)',
            allergies: 'None known',
            chronicConditions: 'None reported'
        });
    };

    return (
        <div className="container-fluid p-3 p-md-4 animate__animated animate__fadeIn">
            {/* Header Banner */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 p-4 rounded-4 shadow-sm bg-white border">
                <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                        <span className="badge rounded-pill bg-primary bg-opacity-10 text-primary px-3 py-1 fw-bold">
                            <RiUserHeartLine className="me-1" /> Patient Administration Module
                        </span>
                        <span className="badge rounded-pill bg-light text-secondary border px-3 py-1">
                            CarePlus Central Patient Registry
                        </span>
                    </div>
                    <h2 className="fw-bold mb-1 text-dark">Patient Registration & Roster</h2>
                    <p className="text-muted small mb-0">
                        Admit walk-in and online patients across Metro and Northside branches. Manage demographic information, emergency contacts, insurance coverage, and quick-action clinical shortcuts.
                    </p>
                </div>
                <div>
                    <button
                        onClick={() => setShowRegisterModal(true)}
                        className="btn btn-primary d-flex align-items-center gap-2 px-3 py-2 rounded-3 shadow-sm fw-semibold"
                    >
                        <RiUserAddLine size={18} /> Register New Patient
                    </button>
                </div>
            </div>

            {/* Filter Controls */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-md-6">
                    <div className="input-group bg-white rounded-3 shadow-sm border">
                        <span className="input-group-text bg-transparent border-0 text-muted">
                            <RiSearchLine />
                        </span>
                        <input
                            type="text"
                            className="form-control border-0 bg-transparent"
                            placeholder="Search patient name, email, phone, or insurance..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="col-12 col-md-6">
                    <div className="input-group bg-white rounded-3 shadow-sm border">
                        <span className="input-group-text bg-transparent border-0 text-muted">
                            <RiBuilding4Line />
                        </span>
                        <select
                            className="form-select border-0 bg-transparent"
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                        >
                            <option value="All">All CarePlus Branches</option>
                            {CLINIC_BRANCHES.map(b => (
                                <option key={b.id} value={b.name}>{b.name} ({b.tag})</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Patient Directory Table */}
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                            <tr>
                                <th className="ps-4">Patient Name & ID</th>
                                <th>Contact Information</th>
                                <th>Registered Branch</th>
                                <th>Demographics & Blood Type</th>
                                <th>Category / Insurance</th>
                                <th className="text-end pe-4">Clinical Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {patients.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-5 text-muted">
                                        <RiUserHeartLine size={42} className="mb-2 text-secondary opacity-50" />
                                        <p className="mb-0">No registered patients found matching your search.</p>
                                    </td>
                                </tr>
                            ) : (
                                patients.map((pat) => (
                                    <tr key={pat.id}>
                                        <td className="ps-4">
                                            <div className="fw-bold text-dark">{pat.fullName}</div>
                                            <div className="small text-muted font-monospace">PID-{String(pat.id).slice(-4)}</div>
                                        </td>
                                        <td>
                                            <div className="small text-dark d-flex align-items-center gap-1">
                                                <RiPhoneLine className="text-muted" /> {pat.phone || 'No phone'}
                                            </div>
                                            <div className="small text-muted d-flex align-items-center gap-1">
                                                <RiMailLine className="text-muted" /> {pat.email}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge rounded-pill ${pat.branch?.includes('Metro') ? 'bg-primary bg-opacity-10 text-primary' : 'bg-info bg-opacity-10 text-dark'}`}>
                                                <RiBuilding4Line className="me-1" />
                                                {pat.branch?.includes('Metro') ? 'Metro Branch' : 'Northside Branch'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="small text-dark">
                                                {pat.gender || 'N/A'} • {pat.birthdate || 'N/A'}
                                            </div>
                                            <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2">
                                                Type {pat.bloodType || 'O+'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="badge bg-secondary bg-opacity-10 text-dark">
                                                {pat.patient_type || 'Regular Patient'}
                                            </span>
                                            <div className="small text-muted text-truncate" style={{ maxWidth: '180px' }}>
                                                {pat.insuranceProvider || 'Self-Pay'}
                                            </div>
                                        </td>
                                        <td className="text-end pe-4">
                                            <div className="btn-group">
                                                <button
                                                    onClick={() => setSelectedPatientDetails(pat)}
                                                    className="btn btn-sm btn-outline-primary rounded-pill px-3"
                                                >
                                                    View Chart
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal: Register Patient */}
            {showRegisterModal && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content rounded-4 border-0 shadow">
                            <div className="modal-header bg-primary text-white py-3">
                                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                                    <RiUserAddLine /> Walk-in & New Patient Registration
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowRegisterModal(false)}></button>
                            </div>
                            <form onSubmit={handleRegisterPatient}>
                                <div className="modal-body p-4">
                                    {/* Personal Info */}
                                    <h6 className="fw-bold mb-3 text-primary border-bottom pb-2">1. Personal & Contact Details</h6>
                                    <div className="row g-3 mb-4">
                                        <div className="col-md-6">
                                            <label className="form-label small fw-semibold">Full Legal Name *</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="e.g. John Patrick Doe"
                                                value={regForm.fullName}
                                                onChange={(e) => setRegForm(prev => ({ ...prev, fullName: e.target.value }))}
                                                required
                                            />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small fw-semibold">Email Address (Portal ID) *</label>
                                            <input
                                                type="email"
                                                className="form-control"
                                                placeholder="e.g. john.doe@email.com"
                                                value={regForm.email}
                                                onChange={(e) => setRegForm(prev => ({ ...prev, email: e.target.value }))}
                                                required
                                            />
                                        </div>
                                        <div className="col-md-4">
                                            <label className="form-label small fw-semibold">Mobile Number *</label>
                                            <input
                                                type="tel"
                                                className="form-control"
                                                placeholder="0917-000-0000"
                                                value={regForm.phone}
                                                onChange={(e) => setRegForm(prev => ({ ...prev, phone: e.target.value }))}
                                                required
                                            />
                                        </div>
                                        <div className="col-md-4">
                                            <label className="form-label small fw-semibold">Date of Birth</label>
                                            <input
                                                type="date"
                                                className="form-control"
                                                value={regForm.birthdate}
                                                onChange={(e) => setRegForm(prev => ({ ...prev, birthdate: e.target.value }))}
                                            />
                                        </div>
                                        <div className="col-md-4">
                                            <label className="form-label small fw-semibold">Gender</label>
                                            <select
                                                className="form-select"
                                                value={regForm.gender}
                                                onChange={(e) => setRegForm(prev => ({ ...prev, gender: e.target.value }))}
                                            >
                                                <option value="Female">Female</option>
                                                <option value="Male">Male</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                        <div className="col-md-8">
                                            <label className="form-label small fw-semibold">Residential Address</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="House/Street, Barangay, City/Province"
                                                value={regForm.address}
                                                onChange={(e) => setRegForm(prev => ({ ...prev, address: e.target.value }))}
                                            />
                                        </div>
                                        <div className="col-md-4">
                                            <label className="form-label small fw-semibold">Blood Type</label>
                                            <select
                                                className="form-select"
                                                value={regForm.bloodType}
                                                onChange={(e) => setRegForm(prev => ({ ...prev, bloodType: e.target.value }))}
                                            >
                                                <option value="O+">O Positive (O+)</option>
                                                <option value="O-">O Negative (O-)</option>
                                                <option value="A+">A Positive (A+)</option>
                                                <option value="A-">A Negative (A-)</option>
                                                <option value="B+">B Positive (B+)</option>
                                                <option value="B-">B Negative (B-)</option>
                                                <option value="AB+">AB Positive (AB+)</option>
                                                <option value="AB-">AB Negative (AB-)</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Branch & Insurance */}
                                    <h6 className="fw-bold mb-3 text-primary border-bottom pb-2">2. Clinic Branch & Health Insurance</h6>
                                    <div className="row g-3 mb-4">
                                        <div className="col-md-4">
                                            <label className="form-label small fw-semibold">Preferred Branch *</label>
                                            <select
                                                className="form-select"
                                                value={regForm.branch}
                                                onChange={(e) => setRegForm(prev => ({ ...prev, branch: e.target.value }))}
                                                required
                                            >
                                                {CLINIC_BRANCHES.map(b => (
                                                    <option key={b.id} value={b.name}>{b.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-md-4">
                                            <label className="form-label small fw-semibold">Patient Classification</label>
                                            <select
                                                className="form-select"
                                                value={regForm.patient_type}
                                                onChange={(e) => setRegForm(prev => ({ ...prev, patient_type: e.target.value }))}
                                            >
                                                <option value="Regular Patient">Regular Patient</option>
                                                <option value="Senior Citizen">Senior Citizen (OSCA 20%)</option>
                                                <option value="PWD">Person with Disability (PWD 20%)</option>
                                                <option value="Pediatric">Pediatric Patient</option>
                                                <option value="Corporate Partner">Corporate HMO Account</option>
                                            </select>
                                        </div>
                                        <div className="col-md-4">
                                            <label className="form-label small fw-semibold">Insurance / HMO Details</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="e.g. Maxicare / PhilHealth PIN"
                                                value={regForm.insuranceProvider}
                                                onChange={(e) => setRegForm(prev => ({ ...prev, insuranceProvider: e.target.value }))}
                                            />
                                        </div>
                                        <div className="col-md-12">
                                            <label className="form-label small fw-semibold">Emergency Contact Name & Phone</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="e.g. Mary Doe (Spouse) - 0922-999-0001"
                                                value={regForm.emergencyContact}
                                                onChange={(e) => setRegForm(prev => ({ ...prev, emergencyContact: e.target.value }))}
                                            />
                                        </div>
                                    </div>

                                    {/* Medical Baseline */}
                                    <h6 className="fw-bold mb-3 text-primary border-bottom pb-2">3. Initial Medical Baseline</h6>
                                    <div className="row g-3">
                                        <div className="col-md-6">
                                            <label className="form-label small fw-semibold">Known Drug / Food Allergies</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="e.g. Penicillin, Sulfa, Seafood (or None)"
                                                value={regForm.allergies}
                                                onChange={(e) => setRegForm(prev => ({ ...prev, allergies: e.target.value }))}
                                            />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small fw-semibold">Pre-existing Chronic Conditions</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="e.g. Hypertension, Diabetes, Asthma (or None)"
                                                value={regForm.chronicConditions}
                                                onChange={(e) => setRegForm(prev => ({ ...prev, chronicConditions: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer bg-light py-2">
                                    <button type="button" className="btn btn-secondary rounded-pill px-4" onClick={() => setShowRegisterModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary rounded-pill px-4 fw-bold">Complete Patient Registration</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Patient Chart Details */}
            {selectedPatientDetails && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1050 }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content rounded-4 border-0 shadow">
                            <div className="modal-header bg-light border-bottom py-3">
                                <h5 className="modal-title fw-bold text-dark">
                                    Patient Master Chart: {selectedPatientDetails.fullName}
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setSelectedPatientDetails(null)}></button>
                            </div>
                            <div className="modal-body p-4 bg-white">
                                <div className="row g-3 mb-4 p-3 bg-light rounded-3 border">
                                    <div className="col-6 col-md-4">
                                        <span className="small text-muted">Email (ID):</span>
                                        <div className="fw-semibold text-dark">{selectedPatientDetails.email}</div>
                                    </div>
                                    <div className="col-6 col-md-4">
                                        <span className="small text-muted">Phone:</span>
                                        <div className="fw-semibold text-dark">{selectedPatientDetails.phone}</div>
                                    </div>
                                    <div className="col-6 col-md-4">
                                        <span className="small text-muted">Branch:</span>
                                        <div><span className="badge bg-primary bg-opacity-10 text-primary">{selectedPatientDetails.branch}</span></div>
                                    </div>
                                    <div className="col-6 col-md-4">
                                        <span className="small text-muted">Blood Type:</span>
                                        <div className="fw-bold text-danger">{selectedPatientDetails.bloodType || 'O+'}</div>
                                    </div>
                                    <div className="col-6 col-md-4">
                                        <span className="small text-muted">Category:</span>
                                        <div className="fw-semibold text-dark">{selectedPatientDetails.patient_type || 'Regular Patient'}</div>
                                    </div>
                                    <div className="col-6 col-md-4">
                                        <span className="small text-muted">Insurance:</span>
                                        <div className="fw-semibold text-dark">{selectedPatientDetails.insuranceProvider || 'None'}</div>
                                    </div>
                                    <div className="col-12">
                                        <span className="small text-muted">Emergency Contact:</span>
                                        <div className="fw-semibold text-dark">{selectedPatientDetails.emergencyContact || 'None provided'}</div>
                                    </div>
                                </div>

                                <h6 className="fw-bold mb-3 text-dark">Quick Clinical Shortcuts for this Patient:</h6>
                                <div className="row g-2">
                                    <div className="col-6 col-md-3">
                                        <button
                                            onClick={() => {
                                                setSelectedPatientDetails(null);
                                                navigate(`/${(session.role || 'staff').toLowerCase()}/consultations`);
                                            }}
                                            className="btn btn-outline-primary w-100 py-3 rounded-3 d-flex flex-column align-items-center gap-1"
                                        >
                                            <RiStethoscopeLine size={24} />
                                            <span className="small fw-semibold">Consultations</span>
                                        </button>
                                    </div>
                                    <div className="col-6 col-md-3">
                                        <button
                                            onClick={() => {
                                                setSelectedPatientDetails(null);
                                                navigate(`/${(session.role || 'staff').toLowerCase()}/laboratory`);
                                            }}
                                            className="btn btn-outline-info w-100 py-3 rounded-3 d-flex flex-column align-items-center gap-1"
                                        >
                                            <RiFlaskLine size={24} />
                                            <span className="small fw-semibold">Lab Orders</span>
                                        </button>
                                    </div>
                                    <div className="col-6 col-md-3">
                                        <button
                                            onClick={() => {
                                                setSelectedPatientDetails(null);
                                                navigate(`/${(session.role || 'staff').toLowerCase()}/billing`);
                                            }}
                                            className="btn btn-outline-success w-100 py-3 rounded-3 d-flex flex-column align-items-center gap-1"
                                        >
                                            <RiMoneyDollarCircleLine size={24} />
                                            <span className="small fw-semibold">Invoices & Bills</span>
                                        </button>
                                    </div>
                                    <div className="col-6 col-md-3">
                                        <button
                                            onClick={() => {
                                                setSelectedPatientDetails(null);
                                                navigate(`/${(session.role || 'staff').toLowerCase()}/book`);
                                            }}
                                            className="btn btn-outline-warning text-dark w-100 py-3 rounded-3 d-flex flex-column align-items-center gap-1"
                                        >
                                            <RiCalendarCheckLine size={24} />
                                            <span className="small fw-semibold">Appointments</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer bg-light py-2">
                                <button type="button" className="btn btn-secondary rounded-pill px-4" onClick={() => setSelectedPatientDetails(null)}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatientRegistration;
