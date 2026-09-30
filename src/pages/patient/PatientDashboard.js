import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    RiCalendarCheckLine, RiStethoscopeLine, RiFlaskLine,
    RiMoneyDollarCircleLine, RiTimeLine, RiBuilding4Line,
    RiFileTextLine, RiUserHeartLine, RiHeartPulseLine,
    RiAlertLine, RiCheckDoubleLine, RiArrowRightLine,
    RiHospitalLine, RiDownloadLine, RiQrCodeLine
} from 'react-icons/ri';
import { readDatabase, readSession } from '../../utils/storage';

const PatientDashboard = () => {
    const navigate = useNavigate();
    const session = readSession() || {};
    const [dbData, setDbData] = useState({
        appointments: [],
        consultations: [],
        laboratory_requests: [],
        billing_records: []
    });

    const loadData = useCallback(() => {
        const db = readDatabase() || {};
        setDbData({
            appointments: db.appointments || [],
            consultations: db.consultations || [],
            laboratory_requests: db.laboratory_requests || [],
            billing_records: db.billing_records || []
        });
    }, []);

    useEffect(() => {
        loadData();
        const handleUpdate = () => loadData();
        window.addEventListener('storage', handleUpdate);
        window.addEventListener('careplus_db_updated', handleUpdate);
        return () => {
            window.removeEventListener('storage', handleUpdate);
            window.removeEventListener('careplus_db_updated', handleUpdate);
        };
    }, [loadData]);

    const userEmail = (session.email || '').toLowerCase();
    const userName = session.fullName || session.name || 'Valued Patient';

    // Filter patient-specific records
    const myAppointments = useMemo(() => {
        return (dbData.appointments || []).filter(a => {
            if (!a || a.status === 'Deleted') return false;
            const appEmail = (a.patientEmail || a.email || '').toLowerCase();
            const appName = (a.patientName || a.fullName || '').toLowerCase();
            return appEmail === userEmail || appName === userName.toLowerCase() || (!userEmail && true);
        });
    }, [dbData.appointments, userEmail, userName]);

    const myConsultations = useMemo(() => {
        return (dbData.consultations || []).filter(c => {
            const cEmail = (c.patientEmail || '').toLowerCase();
            const cName = (c.patientName || '').toLowerCase();
            return cEmail === userEmail || cName === userName.toLowerCase() || (!userEmail && true);
        });
    }, [dbData.consultations, userEmail, userName]);

    const myLabRequests = useMemo(() => {
        return (dbData.laboratory_requests || []).filter(l => {
            const lEmail = (l.patientEmail || '').toLowerCase();
            const lName = (l.patientName || '').toLowerCase();
            return lEmail === userEmail || lName === userName.toLowerCase() || (!userEmail && true);
        });
    }, [dbData.laboratory_requests, userEmail, userName]);

    const myBilling = useMemo(() => {
        return (dbData.billing_records || []).filter(b => {
            const bEmail = (b.patientEmail || '').toLowerCase();
            const bName = (b.patientName || '').toLowerCase();
            return bEmail === userEmail || bName === userName.toLowerCase() || (!userEmail && true);
        });
    }, [dbData.billing_records, userEmail, userName]);

    const nextUpcomingAppt = useMemo(() => {
        const upcoming = myAppointments.filter(a => a.status === 'Approved' || a.status === 'Pending');
        return upcoming[0] || null;
    }, [myAppointments]);

    return (
        <div className="p-3 p-md-4 w-100" style={{ maxWidth: '1400px', margin: '0 auto' }}>
            {/* Patient Hero Profile Card */}
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4 bg-white">
                <div className="p-4 bg-primary text-white" style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' }}>
                    <div className="row align-items-center">
                        <div className="col-12 col-md-8">
                            <div className="d-flex align-items-center gap-2 mb-2">
                                <span className="badge bg-white bg-opacity-25 rounded-pill px-3 py-1">
                                    CarePlus Patient Portal
                                </span>
                                <span className="badge bg-success rounded-pill px-3 py-1">
                                    Active EHR Connected
                                </span>
                            </div>
                            <h2 className="fw-bold mb-1">Hello, {userName}!</h2>
                            <p className="mb-0 text-white-50 small">
                                Access your clinical consultation records, laboratory results, and appointment schedules across Metro & Northside clinics.
                            </p>
                        </div>
                        <div className="col-12 col-md-4 text-md-end mt-3 mt-md-0">
                            <button
                                onClick={() => navigate('/patient/book')}
                                className="btn btn-light fw-bold px-4 py-2 rounded-pill shadow-sm"
                            >
                                <RiCalendarCheckLine className="me-1" /> Book New Visit
                            </button>
                        </div>
                    </div>
                </div>

                {/* Health Information Quick Badges */}
                <div className="p-3 bg-light border-top d-flex flex-wrap align-items-center justify-content-between gap-3 text-dark small">
                    <div className="d-flex align-items-center gap-2">
                        <RiBuilding4Line className="text-primary fs-5" />
                        <span>Registered Branch: <strong>{session.branch || 'Metro Branch'}</strong></span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <RiHeartPulseLine className="text-danger fs-5" />
                        <span>Blood Type: <strong>O+ Positive</strong></span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <RiAlertLine className="text-warning fs-5" />
                        <span>Allergies: <strong className="text-success">None Reported</strong></span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <RiCheckDoubleLine className="text-success fs-5" />
                        <span>PhilHealth / HMO: <strong>Active Coverage</strong></span>
                    </div>
                </div>
            </div>

            {/* Core Stats Overview */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <div
                        onClick={() => navigate('/patient/book')}
                        className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100 transition-hover border-start border-primary border-4 cursor-pointer"
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="text-muted small fw-bold text-uppercase">Appointments</span>
                            <div className="p-2 rounded-3 bg-primary bg-opacity-10 text-primary">
                                <RiCalendarCheckLine size={22} />
                            </div>
                        </div>
                        <h2 className="fw-bold mb-1 text-dark">{myAppointments.length}</h2>
                        <div className="d-flex align-items-center justify-content-between text-muted small">
                            <span>Next: {nextUpcomingAppt ? nextUpcomingAppt.date : 'None'}</span>
                            <span className="text-primary fw-semibold">View &rarr;</span>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div
                        onClick={() => navigate('/patient/laboratory')}
                        className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100 transition-hover border-start border-warning border-4 cursor-pointer"
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="text-muted small fw-bold text-uppercase">Lab Results</span>
                            <div className="p-2 rounded-3 bg-warning bg-opacity-10 text-warning">
                                <RiFlaskLine size={22} />
                            </div>
                        </div>
                        <h2 className="fw-bold mb-1 text-dark">{myLabRequests.length}</h2>
                        <div className="d-flex align-items-center justify-content-between text-muted small">
                            <span>Ready: <strong className="text-success">{myLabRequests.filter(l => l.status === 'Completed').length}</strong></span>
                            <span className="text-warning fw-semibold">Slips &rarr;</span>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div
                        onClick={() => navigate('/patient/consultations')}
                        className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100 transition-hover border-start border-success border-4 cursor-pointer"
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="text-muted small fw-bold text-uppercase">Doctor Notes &amp; Rx</span>
                            <div className="p-2 rounded-3 bg-success bg-opacity-10 text-success">
                                <RiStethoscopeLine size={22} />
                            </div>
                        </div>
                        <h2 className="fw-bold mb-1 text-dark">{myConsultations.length}</h2>
                        <div className="d-flex align-items-center justify-content-between text-muted small">
                            <span>Prescriptions Recorded</span>
                            <span className="text-success fw-semibold">View Rx &rarr;</span>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div
                        onClick={() => navigate('/patient/billing')}
                        className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100 transition-hover border-start border-info border-4 cursor-pointer"
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="text-muted small fw-bold text-uppercase">Invoices &amp; Receipts</span>
                            <div className="p-2 rounded-3 bg-info bg-opacity-10 text-info">
                                <RiMoneyDollarCircleLine size={22} />
                            </div>
                        </div>
                        <h2 className="fw-bold mb-1 text-dark">{myBilling.length}</h2>
                        <div className="d-flex align-items-center justify-content-between text-muted small">
                            <span>Settled: <strong className="text-success">{myBilling.filter(b => b.status === 'Paid').length}</strong></span>
                            <span className="text-info fw-semibold">ORs &rarr;</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Next Upcoming Appointment Alert */}
            {nextUpcomingAppt && (
                <div className="card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white border-start border-primary border-4">
                    <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
                        <div className="d-flex align-items-center gap-3">
                            <div className="p-3 rounded-circle bg-primary bg-opacity-10 text-primary">
                                <RiCalendarCheckLine size={28} />
                            </div>
                            <div>
                                <div className="badge bg-primary bg-opacity-10 text-primary mb-1">
                                    Upcoming CarePlus Appointment
                                </div>
                                <h5 className="fw-bold text-dark mb-0">{nextUpcomingAppt.service || 'Doctor Consultation'}</h5>
                                <div className="text-muted small">
                                    {nextUpcomingAppt.date} at {nextUpcomingAppt.time} &bull; {nextUpcomingAppt.branch || 'Metro Branch'} &bull; {nextUpcomingAppt.doctor || 'Attending Physician'}
                                </div>
                            </div>
                        </div>
                        <span className="badge bg-warning text-dark px-3 py-2 rounded-pill">
                            Status: {nextUpcomingAppt.status}
                        </span>
                    </div>
                </div>
            )}

            {/* Two Column Layout: Lab Diagnostics + Past Schedules */}
            <div className="row g-4">
                {/* Left: Diagnostic Laboratory Results */}
                <div className="col-12 col-lg-6">
                    <div className="card border-0 shadow-sm rounded-4 bg-white h-100 overflow-hidden">
                        <div className="p-3 border-bottom d-flex align-items-center justify-content-between">
                            <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                                <RiFlaskLine className="text-warning" /> My Diagnostic Laboratory Orders
                            </h6>
                            <button
                                onClick={() => navigate('/patient/laboratory')}
                                className="btn btn-outline-warning btn-sm rounded-pill"
                            >
                                View All
                            </button>
                        </div>
                        <div className="p-3 d-flex flex-column gap-2">
                            {myLabRequests.length > 0 ? (
                                myLabRequests.map(lab => (
                                    <div key={lab.id} className="p-3 border rounded-3 bg-light d-flex align-items-center justify-content-between">
                                        <div>
                                            <div className="fw-bold text-dark">{lab.testName}</div>
                                            <div className="text-muted small">
                                                {lab.date} &bull; {lab.branch} &bull; Ref: #{lab.id}
                                            </div>
                                        </div>
                                        <div className="d-flex align-items-center gap-2">
                                            <span className={`badge rounded-pill ${
                                                lab.status === 'Completed' ? 'bg-success text-white' : 'bg-warning text-dark'
                                            }`}>
                                                {lab.status}
                                            </span>
                                            <button
                                                onClick={() => navigate('/patient/laboratory')}
                                                className="btn btn-light border btn-sm"
                                                title="View Official Diagnostic Result"
                                            >
                                                <RiFileTextLine />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-4 text-muted">
                                    <RiFlaskLine size={32} className="opacity-25 mb-2" />
                                    <p className="mb-0 small">No laboratory orders recorded yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Doctor Consultations & Digital Prescriptions */}
                <div className="col-12 col-lg-6">
                    <div className="card border-0 shadow-sm rounded-4 bg-white h-100 overflow-hidden">
                        <div className="p-3 border-bottom d-flex align-items-center justify-content-between">
                            <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                                <RiStethoscopeLine className="text-success" /> Doctor Consultations &amp; Rx
                            </h6>
                            <button
                                onClick={() => navigate('/patient/consultations')}
                                className="btn btn-outline-success btn-sm rounded-pill"
                            >
                                View Prescriptions
                            </button>
                        </div>
                        <div className="p-3 d-flex flex-column gap-2">
                            {myConsultations.length > 0 ? (
                                myConsultations.map(c => (
                                    <div key={c.id} className="p-3 border rounded-3 bg-light">
                                        <div className="d-flex align-items-center justify-content-between mb-1">
                                            <div className="fw-bold text-dark">{c.diagnosis || 'Clinical Consultation'}</div>
                                            <span className="badge bg-success bg-opacity-10 text-success rounded-pill">
                                                {c.branch}
                                            </span>
                                        </div>
                                        <div className="text-muted small mb-2">
                                            Dr. {c.doctorName || 'Robert Chen, MD'} &bull; {c.date}
                                        </div>
                                        {c.prescriptions && c.prescriptions.length > 0 && (
                                            <div className="p-2 rounded-2 bg-white border text-muted small">
                                                <strong>Rx:</strong> {c.prescriptions.map(p => `${p.medicine} (${p.dosage})`).join(', ')}
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-4 text-muted">
                                    <RiStethoscopeLine size={32} className="opacity-25 mb-2" />
                                    <p className="mb-0 small">No consultation records on file.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PatientDashboard;