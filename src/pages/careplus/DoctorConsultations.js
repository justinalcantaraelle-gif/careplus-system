import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import {
    RiStethoscopeLine, RiAddLine, RiSearchLine, RiPrinterLine,
    RiFlaskLine, RiFileTextLine, RiCalendarLine, RiUserLine,
    RiHeartPulseLine, RiMedicineBottleLine, RiCloseLine, RiFilterLine,
    RiBuilding4Line, RiCheckLine
} from 'react-icons/ri';
import { readDatabase, writeDatabase, readSession } from '../../utils/storage';
import { CLINIC_BRANCHES, CLINIC_DOCTORS, LAB_TEST_CATALOG } from '../../utils/careplusData';
import { addAuditLog } from '../../services/auditLogger';

const DoctorConsultations = () => {
    const session = readSession() || {};
    const [db, setDb] = useState(() => readDatabase({}));
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBranch, setSelectedBranch] = useState('All');
    const [activeModal, setActiveModal] = useState(null); // 'new' | 'view'
    const [selectedConsultation, setSelectedConsultation] = useState(null);

    // Form state for New Consultation
    const [formData, setFormData] = useState({
        patientEmail: '',
        patientName: '',
        branch: session.branch || CLINIC_BRANCHES[0].name,
        doctorName: session.role === 'Doctor' ? session.fullName : (CLINIC_DOCTORS[0].name),
        doctorEmail: session.role === 'Doctor' ? session.email : (CLINIC_DOCTORS[0].email),
        date: new Date().toISOString().split('T')[0],
        vitals: {
            bloodPressure: '120/80 mmHg',
            heartRate: '75 bpm',
            respiratoryRate: '18 cpm',
            temperature: '36.6 °C',
            weight: '65 kg',
            height: '168 cm',
            bmi: '23.0 (Normal)'
        },
        chiefComplaint: '',
        symptoms: '',
        diagnosis: '',
        clinicalAdvice: '',
        prescription: [
            { medication: '', dosage: '', frequency: '', duration: '' }
        ],
        orderedLabs: []
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

    const consultations = useMemo(() => {
        return (db.consultations || []).filter(c => {
            const matchesBranch = selectedBranch === 'All' || c.branch === selectedBranch;
            const query = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm ||
                (c.patientName || '').toLowerCase().includes(query) ||
                (c.patientEmail || '').toLowerCase().includes(query) ||
                (c.diagnosis || '').toLowerCase().includes(query) ||
                (c.doctorName || '').toLowerCase().includes(query);
            return matchesBranch && matchesSearch;
        });
    }, [db.consultations, selectedBranch, searchTerm]);

    const patients = useMemo(() => {
        return (db.users || []).filter(u => (u.role || '').toLowerCase() === 'patient');
    }, [db.users]);

    const handlePatientSelect = (email) => {
        const p = patients.find(pat => pat.email === email);
        if (p) {
            setFormData(prev => ({
                ...prev,
                patientEmail: p.email,
                patientName: p.fullName || p.email,
                branch: p.branch || prev.branch
            }));
        }
    };

    const handleAddPrescriptionItem = () => {
        setFormData(prev => ({
            ...prev,
            prescription: [...prev.prescription, { medication: '', dosage: '', frequency: '', duration: '' }]
        }));
    };

    const handleRemovePrescriptionItem = (index) => {
        setFormData(prev => ({
            ...prev,
            prescription: prev.prescription.filter((_, i) => i !== index)
        }));
    };

    const handlePrescriptionChange = (index, field, value) => {
        setFormData(prev => {
            const updated = [...prev.prescription];
            updated[index][field] = value;
            return { ...prev, prescription: updated };
        });
    };

    const toggleLabTest = (testName) => {
        setFormData(prev => {
            const exists = prev.orderedLabs.includes(testName);
            return {
                ...prev,
                orderedLabs: exists ? prev.orderedLabs.filter(t => t !== testName) : [...prev.orderedLabs, testName]
            };
        });
    };

    const handleSubmitConsultation = (e) => {
        e.preventDefault();
        if (!formData.patientEmail || !formData.diagnosis || !formData.chiefComplaint) {
            Swal.fire('Missing Information', 'Please select a patient, enter chief complaint, and specify a clinical diagnosis.', 'warning');
            return;
        }

        const newId = `CONS-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
        const validRx = formData.prescription.filter(p => p.medication.trim() !== '');

        const newConsultation = {
            id: newId,
            ...formData,
            prescription: validRx,
            createdAt: new Date().toISOString()
        };

        const updatedConsultations = [newConsultation, ...(db.consultations || [])];

        // Also automatically create corresponding Laboratory Requests if doctor ordered any labs
        let updatedLabs = [...(db.laboratory_requests || [])];
        if (formData.orderedLabs.length > 0) {
            formData.orderedLabs.forEach((testName, idx) => {
                const labCatalogItem = LAB_TEST_CATALOG.find(l => l.name === testName || l.name.includes(testName));
                updatedLabs.unshift({
                    id: `LAB-${new Date().getFullYear()}-${String(Date.now() + idx).slice(-4)}`,
                    patientEmail: formData.patientEmail,
                    patientName: formData.patientName,
                    requestingDoctor: formData.doctorName,
                    branch: formData.branch,
                    testCategory: labCatalogItem ? labCatalogItem.category : 'General Diagnostics',
                    testName: testName,
                    requestDate: formData.date,
                    completionDate: null,
                    status: 'Requested',
                    technician: 'Assigned to Branch Laboratory',
                    specimen: 'Pending Collection',
                    results: [],
                    remarks: `Requisitioned during consultation ${newId}`
                });
            });
        }

        // Also generate preliminary billing item for consultation fee + ordered labs
        let updatedBilling = [...(db.billing_records || [])];
        const billingItems = [
            { description: `Physician Consultation Fee (${formData.doctorName})`, category: 'Professional Fee', amount: 800 }
        ];
        formData.orderedLabs.forEach(test => {
            const catalogItem = LAB_TEST_CATALOG.find(c => c.name === test);
            billingItems.push({
                description: `Lab Test: ${test}`,
                category: 'Laboratory Test',
                amount: catalogItem ? catalogItem.price : 450
            });
        });
        const subtotal = billingItems.reduce((acc, curr) => acc + curr.amount, 0);

        updatedBilling.unshift({
            id: `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
            invoiceNumber: `CP-INV-${String(Date.now()).slice(-4)}`,
            patientEmail: formData.patientEmail,
            patientName: formData.patientName,
            branch: formData.branch,
            date: formData.date,
            items: billingItems,
            subtotal,
            discountType: 'None',
            discountAmount: 0,
            tax: 0,
            totalAmount: subtotal,
            amountPaid: 0,
            paymentStatus: 'Unpaid',
            paymentMethod: 'Pending Billing Counter Checkout',
            receiptNumber: 'PENDING',
            cashier: 'Pending',
            createdAt: new Date().toISOString()
        });

        const newDb = {
            ...db,
            consultations: updatedConsultations,
            laboratory_requests: updatedLabs,
            billing_records: updatedBilling
        };

        writeDatabase(newDb);
        addAuditLog('Doctor Consultation Recorded', `Dr. ${formData.doctorName} recorded consultation for ${formData.patientName} at ${formData.branch}`);

        Swal.fire({
            icon: 'success',
            title: 'Consultation Recorded',
            html: `<p>Consultation Record <b>${newId}</b> has been saved.</p>` +
                (formData.orderedLabs.length > 0 ? `<p class="text-info small">✔ Automatically routed ${formData.orderedLabs.length} test order(s) to ${formData.branch} Laboratory.</p>` : ''),
            timer: 2500,
            showConfirmButton: true
        });

        setActiveModal(null);
    };

    const handlePrintPrescription = () => {
        window.print();
    };

    return (
        <div className="container-fluid p-3 p-md-4">
            {/* Header Banner */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 p-4 rounded-4 shadow-sm bg-white border">
                <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                        <span className="badge rounded-pill bg-primary bg-opacity-10 text-primary px-3 py-1 fw-bold">
                            <RiStethoscopeLine className="me-1" /> Clinical Care Module
                        </span>
                        <span className="badge rounded-pill bg-info bg-opacity-10 text-dark px-3 py-1">
                            CarePlus Multi-Branch
                        </span>
                    </div>
                    <h2 className="fw-bold mb-1 text-dark">Doctor Consultation Records</h2>
                    <p className="text-muted small mb-0">
                        Record patient chief complaints, vital signs, clinical diagnoses, electronic prescriptions (Rx), and order diagnostic laboratory requisitions.
                    </p>
                </div>
                <div className="d-flex gap-2 align-items-center">
                    <button
                        onClick={() => setActiveModal('new')}
                        className="btn btn-primary d-flex align-items-center gap-2 px-3 py-2 rounded-3 shadow-sm fw-semibold"
                    >
                        <RiAddLine size={18} /> New Consultation
                    </button>
                </div>
            </div>

            {/* Filter Controls */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-md-6 col-lg-4">
                    <div className="input-group bg-white rounded-3 shadow-sm border">
                        <span className="input-group-text bg-transparent border-0 text-muted">
                            <RiSearchLine />
                        </span>
                        <input
                            type="text"
                            className="form-control border-0 bg-transparent"
                            placeholder="Search patient, diagnosis, or doctor..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="col-12 col-md-6 col-lg-4">
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
                <div className="col-12 col-lg-4 d-flex justify-content-lg-end align-items-center">
                    <span className="badge bg-light text-secondary border px-3 py-2 rounded-3">
                        Total Consultations: <strong className="text-dark">{consultations.length}</strong>
                    </span>
                </div>
            </div>

            {/* Consultations Table */}
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                            <tr>
                                <th className="ps-4" style={{ whiteSpace: 'nowrap' }}>Record ID / Date</th>
                                <th style={{ whiteSpace: 'nowrap' }}>Patient Name</th>
                                <th style={{ whiteSpace: 'nowrap' }}>Branch</th>
                                <th style={{ whiteSpace: 'nowrap' }}>Attending Doctor</th>
                                <th>Clinical Diagnosis</th>
                                <th>Prescription / Labs</th>
                                <th className="text-end pe-4" style={{ whiteSpace: 'nowrap' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {consultations.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="text-center py-5 text-muted">
                                        <RiStethoscopeLine size={42} className="mb-2 text-secondary opacity-50" />
                                        <p className="mb-0">No consultation records found matching filter criteria.</p>
                                    </td>
                                </tr>
                            ) : (
                                consultations.map((cons) => (
                                    <tr key={cons.id}>
                                        <td className="ps-4">
                                            <div className="fw-bold text-dark">{cons.id}</div>
                                            <div className="small text-muted d-flex align-items-center gap-1">
                                                <RiCalendarLine /> {cons.date}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="fw-semibold text-dark">{cons.patientName}</div>
                                            <div className="small text-muted">{cons.patientEmail}</div>
                                        </td>
                                        <td>
                                            <span className={`badge rounded-pill ${cons.branch?.includes('Metro') ? 'bg-primary bg-opacity-10 text-primary' : 'bg-info bg-opacity-10 text-dark'}`}>
                                                <RiBuilding4Line className="me-1" />
                                                {cons.branch?.includes('Metro') ? 'Metro Branch' : 'Northside Branch'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="text-dark fw-medium">{cons.doctorName}</div>
                                        </td>
                                        <td>
                                            <div className="fw-semibold text-dark text-truncate" style={{ maxWidth: '240px' }}>
                                                {cons.diagnosis}
                                            </div>
                                            <div className="small text-muted text-truncate" style={{ maxWidth: '240px' }}>
                                                {cons.chiefComplaint}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="d-flex flex-wrap gap-1">
                                                {cons.prescription?.length > 0 && (
                                                    <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">
                                                        <RiMedicineBottleLine className="me-1" /> {cons.prescription.length} Rx Meds
                                                    </span>
                                                )}
                                                {cons.orderedLabs?.length > 0 && (
                                                    <span className="badge bg-warning bg-opacity-10 text-dark border border-warning border-opacity-25">
                                                        <RiFlaskLine className="me-1" /> {cons.orderedLabs.length} Labs
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="text-end pe-4">
                                            <button
                                                onClick={() => {
                                                    setSelectedConsultation(cons);
                                                    setActiveModal('view');
                                                }}
                                                className="btn btn-sm btn-outline-primary rounded-pill px-3"
                                            >
                                                View Rx & Summary
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal: New Consultation */}
            {activeModal === 'new' && createPortal(
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 9999 }}>
                    <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content rounded-4 border-0 shadow">
                            <div className="modal-header bg-primary text-white py-3">
                                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                                    <RiStethoscopeLine /> New Clinical Consultation & Prescription
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
                            </div>
                            <form onSubmit={handleSubmitConsultation}>
                                <div className="modal-body p-4">
                                    {/* Patient & Doctor Selection */}
                                    <div className="row g-3 mb-4">
                                        <div className="col-md-4">
                                            <label className="form-label fw-semibold small">Select Patient *</label>
                                            <select
                                                className="form-select"
                                                value={formData.patientEmail}
                                                onChange={(e) => handlePatientSelect(e.target.value)}
                                                required
                                            >
                                                <option value="">-- Choose Registered Patient --</option>
                                                {patients.map(p => (
                                                    <option key={p.email} value={p.email}>
                                                        {p.fullName || p.email} ({p.branch || 'CarePlus Patient'})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-md-4">
                                            <label className="form-label fw-semibold small">Clinic Branch *</label>
                                            <select
                                                className="form-select"
                                                value={formData.branch}
                                                onChange={(e) => setFormData(prev => ({ ...prev, branch: e.target.value }))}
                                                required
                                            >
                                                {CLINIC_BRANCHES.map(b => (
                                                    <option key={b.id} value={b.name}>{b.name} ({b.tag})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-md-4">
                                            <label className="form-label fw-semibold small">Attending Physician *</label>
                                            <select
                                                className="form-select"
                                                value={formData.doctorName}
                                                onChange={(e) => {
                                                    const doc = CLINIC_DOCTORS.find(d => d.name === e.target.value);
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        doctorName: e.target.value,
                                                        doctorEmail: doc ? doc.email : prev.doctorEmail
                                                    }));
                                                }}
                                                required
                                            >
                                                {CLINIC_DOCTORS.map(d => (
                                                    <option key={d.id} value={d.name}>{d.name} - {d.specialty}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Vital Signs Bar */}
                                    <div className="p-3 rounded-3 bg-light border mb-4">
                                        <h6 className="fw-bold mb-3 d-flex align-items-center gap-2 text-primary">
                                            <RiHeartPulseLine /> Patient Vital Signs & Triage Data
                                        </h6>
                                        <div className="row g-2">
                                            <div className="col-6 col-md-3">
                                                <label className="form-label small text-muted mb-1">Blood Pressure</label>
                                                <input
                                                    type="text"
                                                    className="form-control form-control-sm"
                                                    placeholder="120/80 mmHg"
                                                    value={formData.vitals.bloodPressure}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, vitals: { ...prev.vitals, bloodPressure: e.target.value } }))}
                                                />
                                            </div>
                                            <div className="col-6 col-md-2">
                                                <label className="form-label small text-muted mb-1">Heart Rate</label>
                                                <input
                                                    type="text"
                                                    className="form-control form-control-sm"
                                                    placeholder="75 bpm"
                                                    value={formData.vitals.heartRate}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, vitals: { ...prev.vitals, heartRate: e.target.value } }))}
                                                />
                                            </div>
                                            <div className="col-6 col-md-2">
                                                <label className="form-label small text-muted mb-1">Temperature</label>
                                                <input
                                                    type="text"
                                                    className="form-control form-control-sm"
                                                    placeholder="36.6 °C"
                                                    value={formData.vitals.temperature}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, vitals: { ...prev.vitals, temperature: e.target.value } }))}
                                                />
                                            </div>
                                            <div className="col-6 col-md-2">
                                                <label className="form-label small text-muted mb-1">Weight (kg)</label>
                                                <input
                                                    type="text"
                                                    className="form-control form-control-sm"
                                                    placeholder="65 kg"
                                                    value={formData.vitals.weight}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, vitals: { ...prev.vitals, weight: e.target.value } }))}
                                                />
                                            </div>
                                            <div className="col-6 col-md-3">
                                                <label className="form-label small text-muted mb-1">Height / BMI</label>
                                                <input
                                                    type="text"
                                                    className="form-control form-control-sm"
                                                    placeholder="170 cm / Normal"
                                                    value={formData.vitals.height}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, vitals: { ...prev.vitals, height: e.target.value } }))}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Clinical Assessment */}
                                    <div className="row g-3 mb-4">
                                        <div className="col-md-6">
                                            <label className="form-label fw-semibold small">Chief Complaint *</label>
                                            <textarea
                                                className="form-control"
                                                rows="2"
                                                placeholder="Primary symptom or reason for clinic consultation..."
                                                value={formData.chiefComplaint}
                                                onChange={(e) => setFormData(prev => ({ ...prev, chiefComplaint: e.target.value }))}
                                                required
                                            ></textarea>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label fw-semibold small">Physical Examination & Findings</label>
                                            <textarea
                                                className="form-control"
                                                rows="2"
                                                placeholder="Clinical exam, HEENT, chest/lungs, abdomen findings..."
                                                value={formData.symptoms}
                                                onChange={(e) => setFormData(prev => ({ ...prev, symptoms: e.target.value }))}
                                            ></textarea>
                                        </div>
                                        <div className="col-md-8">
                                            <label className="form-label fw-semibold small">Clinical Diagnosis (Primary Assessment) *</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="e.g. Essential Hypertension Stage 1 / Acute Bronchitis"
                                                value={formData.diagnosis}
                                                onChange={(e) => setFormData(prev => ({ ...prev, diagnosis: e.target.value }))}
                                                required
                                            />
                                        </div>
                                        <div className="col-md-4">
                                            <label className="form-label fw-semibold small">Consultation Date</label>
                                            <input
                                                type="date"
                                                className="form-control"
                                                value={formData.date}
                                                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* Prescription Items (Rx) */}
                                    <div className="p-3 rounded-3 bg-light border mb-4">
                                        <div className="d-flex justify-content-between align-items-center mb-3">
                                            <h6 className="fw-bold mb-0 d-flex align-items-center gap-2 text-success">
                                                <RiMedicineBottleLine /> Digital Prescription (Rx)
                                            </h6>
                                            <button
                                                type="button"
                                                onClick={handleAddPrescriptionItem}
                                                className="btn btn-sm btn-outline-success rounded-pill px-3"
                                            >
                                                <RiAddLine /> Add Medication
                                            </button>
                                        </div>

                                        {formData.prescription.map((rx, idx) => (
                                            <div key={idx} className="row g-2 align-items-center mb-2">
                                                <div className="col-md-4">
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-sm"
                                                        placeholder="Medication Name & Generic"
                                                        value={rx.medication}
                                                        onChange={(e) => handlePrescriptionChange(idx, 'medication', e.target.value)}
                                                    />
                                                </div>
                                                <div className="col-md-2">
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-sm"
                                                        placeholder="Dosage (e.g. 500mg)"
                                                        value={rx.dosage}
                                                        onChange={(e) => handlePrescriptionChange(idx, 'dosage', e.target.value)}
                                                    />
                                                </div>
                                                <div className="col-md-3">
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-sm"
                                                        placeholder="Sig: (e.g. 1 tab thrice daily after meals)"
                                                        value={rx.frequency}
                                                        onChange={(e) => handlePrescriptionChange(idx, 'frequency', e.target.value)}
                                                    />
                                                </div>
                                                <div className="col-md-2">
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-sm"
                                                        placeholder="Duration (e.g. 7 days)"
                                                        value={rx.duration}
                                                        onChange={(e) => handlePrescriptionChange(idx, 'duration', e.target.value)}
                                                    />
                                                </div>
                                                <div className="col-md-1 text-center">
                                                    {formData.prescription.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemovePrescriptionItem(idx)}
                                                            className="btn btn-sm btn-outline-danger border-0 p-1"
                                                        >
                                                            <RiCloseLine size={18} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Direct Laboratory Orders */}
                                    <div className="p-3 rounded-3 bg-light border mb-3">
                                        <h6 className="fw-bold mb-2 d-flex align-items-center gap-2 text-warning text-dark">
                                            <RiFlaskLine /> Requisition Diagnostic Laboratory Tests
                                        </h6>
                                        <p className="text-muted small mb-3">
                                            Select any diagnostic procedures or lab panels required for this patient. Orders will route automatically to the branch lab and billing.
                                        </p>
                                        <div className="row g-2">
                                            {LAB_TEST_CATALOG.map((test) => {
                                                const selected = formData.orderedLabs.includes(test.name);
                                                return (
                                                    <div key={test.code} className="col-md-6 col-lg-4">
                                                        <div
                                                            onClick={() => toggleLabTest(test.name)}
                                                            className={`p-2 rounded-2 border d-flex align-items-center justify-content-between cursor-pointer ${selected ? 'border-primary bg-primary bg-opacity-10 text-primary fw-semibold' : 'bg-white text-secondary'}`}
                                                            style={{ cursor: 'pointer' }}
                                                        >
                                                            <div className="small text-truncate me-2">
                                                                <span className="badge bg-secondary bg-opacity-10 text-dark me-1">{test.code}</span>
                                                                {test.name}
                                                            </div>
                                                            {selected ? <RiCheckLine className="text-primary flex-shrink-0" /> : <span className="small text-muted">₱{test.price}</span>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Clinical Advice */}
                                    <div>
                                        <label className="form-label fw-semibold small">Physician's Instructions & Follow-Up Advice</label>
                                        <textarea
                                            className="form-control"
                                            rows="2"
                                            placeholder="Dietary recommendations, lifestyle advice, precautions, and scheduled follow-up..."
                                            value={formData.clinicalAdvice}
                                            onChange={(e) => setFormData(prev => ({ ...prev, clinicalAdvice: e.target.value }))}
                                        ></textarea>
                                    </div>
                                </div>
                                <div className="modal-footer bg-light py-2">
                                    <button type="button" className="btn btn-secondary rounded-pill px-4" onClick={() => setActiveModal(null)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm">Save Consultation Record</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal: View Consultation & Printable Prescription (Rx) */}
            {activeModal === 'view' && selectedConsultation && createPortal(
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 9999 }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content rounded-4 border-0 shadow-lg">
                            <div className="modal-header border-bottom py-3 bg-light no-print">
                                <h5 className="modal-title fw-bold text-dark">
                                    Medical Consultation Sheet &amp; Prescription (Rx)
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
                            </div>
                            <div className="modal-body p-4 bg-white" id="printable-rx-sheet">
                                {/* Clinic Letterhead Table */}
                                <table className="table table-bordered mb-3 rx-print-table" style={{ borderColor: '#cbd5e1' }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ width: '65%', verticalAlign: 'middle' }}>
                                                <div className="fw-bold fs-5 text-primary" style={{ letterSpacing: '0.5px' }}>
                                                    CAREPLUS CLINIC MANAGEMENT SYSTEM
                                                </div>
                                                <div className="fw-semibold text-secondary small">
                                                    {selectedConsultation.branch || 'CarePlus Multi-Branch Health Network'}
                                                </div>
                                                <div className="text-muted small" style={{ fontSize: '11px' }}>
                                                    Ambulatory Medicine • Diagnostic Laboratory • Electronic Prescriptions (Rx)
                                                </div>
                                            </td>
                                            <td style={{ width: '35%', verticalAlign: 'middle', fontSize: '11px', background: '#f8fafc' }}>
                                                <div><strong>Consultation Ref:</strong> {selectedConsultation.id}</div>
                                                <div><strong>Date of Encounter:</strong> {selectedConsultation.date}</div>
                                                <div><strong>Attending Doctor:</strong> {selectedConsultation.doctorName}</div>
                                                <div><strong>PRC License No.:</strong> 0089281 • PTR Valid 2026</div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* Section 1: Patient Demographics Table */}
                                <div className="mb-3">
                                    <div className="fw-bold text-dark small text-uppercase mb-1">
                                        Section 1: Patient Information &amp; Encounter Details
                                    </div>
                                    <table className="table table-bordered table-sm mb-0 rx-print-table" style={{ borderColor: '#cbd5e1', fontSize: '12px' }}>
                                        <tbody>
                                            <tr>
                                                <th style={{ width: '20%', background: '#f1f5f9', color: '#334155' }}>Patient Name</th>
                                                <td style={{ width: '30%', fontWeight: 'bold' }}>{selectedConsultation.patientName}</td>
                                                <th style={{ width: '20%', background: '#f1f5f9', color: '#334155' }}>Encounter ID</th>
                                                <td style={{ width: '30%' }}>{selectedConsultation.id}</td>
                                            </tr>
                                            <tr>
                                                <th style={{ background: '#f1f5f9', color: '#334155' }}>Facility Branch</th>
                                                <td>{selectedConsultation.branch}</td>
                                                <th style={{ background: '#f1f5f9', color: '#334155' }}>Date of Consultation</th>
                                                <td>{selectedConsultation.date}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Section 2: Vital Signs & Baseline Table */}
                                {selectedConsultation.vitals && (
                                    <div className="mb-3">
                                        <div className="fw-bold text-dark small text-uppercase mb-1">
                                            Section 2: Vital Signs &amp; Baseline Measurements
                                        </div>
                                        <table className="table table-bordered table-sm text-center mb-0 rx-print-table" style={{ borderColor: '#cbd5e1', fontSize: '11.5px' }}>
                                            <thead style={{ background: '#f1f5f9' }}>
                                                <tr>
                                                    <th>Blood Pressure</th>
                                                    <th>Heart Rate</th>
                                                    <th>Temperature</th>
                                                    <th>Body Weight</th>
                                                    <th>BMI Index</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className="fw-semibold">
                                                    <td>{selectedConsultation.vitals.bloodPressure || '120/80 mmHg'}</td>
                                                    <td>{selectedConsultation.vitals.heartRate || '75 bpm'}</td>
                                                    <td>{selectedConsultation.vitals.temperature || '36.6 °C'}</td>
                                                    <td>{selectedConsultation.vitals.weight || '65 kg'}</td>
                                                    <td>{selectedConsultation.vitals.bmi || '22.5 (Normal)'}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Section 3: Clinical Findings & Diagnosis Table */}
                                <div className="mb-3">
                                    <div className="fw-bold text-dark small text-uppercase mb-1">
                                        Section 3: Clinical Assessment &amp; Primary Diagnosis
                                    </div>
                                    <table className="table table-bordered table-sm mb-0 rx-print-table" style={{ borderColor: '#cbd5e1', fontSize: '11.5px' }}>
                                        <tbody>
                                            <tr>
                                                <th style={{ width: '22%', background: '#f1f5f9', color: '#334155' }}>Chief Complaint</th>
                                                <td>{selectedConsultation.chiefComplaint || 'Routine medical evaluation'}</td>
                                            </tr>
                                            {selectedConsultation.symptoms && (
                                                <tr>
                                                    <th style={{ background: '#f1f5f9', color: '#334155' }}>Physical Exam Findings</th>
                                                    <td>{selectedConsultation.symptoms}</td>
                                                </tr>
                                            )}
                                            <tr>
                                                <th style={{ background: '#f1f5f9', color: '#334155' }}>Clinical Diagnosis</th>
                                                <td className="fw-bold text-primary" style={{ fontSize: '12.5px' }}>
                                                    {selectedConsultation.diagnosis}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Section 4: Official Prescription (Rx) Table */}
                                <div className="mb-3">
                                    <div className="d-flex align-items-center gap-2 mb-1">
                                        <span className="font-monospace text-primary fw-bold fs-5">℞</span>
                                        <div className="fw-bold text-dark small text-uppercase">
                                            Section 4: Electronic Prescription (Rx) &amp; Drug Regimen
                                        </div>
                                    </div>
                                    <table className="table table-bordered table-sm mb-0 rx-print-table" style={{ borderColor: '#cbd5e1', fontSize: '11.5px' }}>
                                        <thead style={{ background: '#f1f5f9' }}>
                                            <tr>
                                                <th style={{ width: '6%', textAlign: 'center' }}>#</th>
                                                <th style={{ width: '34%' }}>Medication &amp; Generic Formulation</th>
                                                <th style={{ width: '18%' }}>Dosage / Strength</th>
                                                <th style={{ width: '28%' }}>Instructions for Use (Sig.)</th>
                                                <th style={{ width: '14%', textAlign: 'center' }}>Duration / Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedConsultation.prescription && selectedConsultation.prescription.length > 0 ? (
                                                selectedConsultation.prescription.map((rx, idx) => (
                                                    <tr key={idx}>
                                                        <td className="text-center fw-bold">{idx + 1}</td>
                                                        <td className="fw-bold text-dark">{rx.medication}</td>
                                                        <td>{rx.dosage || 'As indicated'}</td>
                                                        <td>{rx.frequency || 'Follow physician advice'}</td>
                                                        <td className="text-center fw-semibold">{rx.duration || 'Standard'}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="text-center text-muted py-2">
                                                        No electronic prescription items prescribed for this encounter.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Section 5: Ordered Diagnostics Table (if any) */}
                                {selectedConsultation.orderedLabs?.length > 0 && (
                                    <div className="mb-3">
                                        <div className="fw-bold text-dark small text-uppercase mb-1">
                                            Section 5: Requisitioned Laboratory &amp; Diagnostic Procedures
                                        </div>
                                        <table className="table table-bordered table-sm mb-0 rx-print-table" style={{ borderColor: '#cbd5e1', fontSize: '11px' }}>
                                            <thead style={{ background: '#f1f5f9' }}>
                                                <tr>
                                                    <th style={{ width: '10%', textAlign: 'center' }}>Item</th>
                                                    <th style={{ width: '60%' }}>Requisitioned Diagnostic Procedure</th>
                                                    <th style={{ width: '30%', textAlign: 'center' }}>Target Laboratory Facility</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedConsultation.orderedLabs.map((lab, i) => (
                                                    <tr key={i}>
                                                        <td className="text-center fw-bold">{i + 1}</td>
                                                        <td className="fw-semibold text-dark">{lab}</td>
                                                        <td className="text-center">{selectedConsultation.branch} Diagnostic Laboratory</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Section 6: Instructions & Follow-up */}
                                {selectedConsultation.clinicalAdvice && (
                                    <div className="mb-3">
                                        <div className="fw-bold text-dark small text-uppercase mb-1">
                                            Section 6: Physician Advice, Precautions &amp; Follow-up
                                        </div>
                                        <table className="table table-bordered table-sm mb-0 rx-print-table" style={{ borderColor: '#cbd5e1', fontSize: '11px' }}>
                                            <tbody>
                                                <tr>
                                                    <td style={{ background: '#fffdf6', padding: '8px 12px' }}>
                                                        {selectedConsultation.clinicalAdvice}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Section 7: Attending Physician Licensure & Dual Signatures Table */}
                                <div className="mt-4 pt-1">
                                    <table className="table table-bordered mb-0 rx-print-table" style={{ borderColor: '#cbd5e1' }}>
                                        <tbody>
                                            <tr style={{ background: '#f8fafc' }}>
                                                <th style={{ width: '50%', textAlign: 'center' }}>Patient / Representative Verification</th>
                                                <th style={{ width: '50%', textAlign: 'center' }}>Attending Physician Certification &amp; Licensure</th>
                                            </tr>
                                            <tr>
                                                <td style={{ height: '80px', verticalAlign: 'bottom', textAlign: 'center', paddingBottom: '8px' }}>
                                                    <div className="border-top border-dark mx-auto" style={{ width: '75%' }}></div>
                                                    <div className="fw-bold text-dark small mt-1">{selectedConsultation.patientName}</div>
                                                    <div className="text-muted small" style={{ fontSize: '10px' }}>Patient / Authorized Signature</div>
                                                </td>
                                                <td style={{ height: '80px', verticalAlign: 'bottom', textAlign: 'center', paddingBottom: '8px' }}>
                                                    <div className="fw-bold text-primary mb-1" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '16px' }}>
                                                        {selectedConsultation.doctorName}
                                                    </div>
                                                    <div className="border-top border-dark mx-auto" style={{ width: '75%' }}></div>
                                                    <div className="fw-bold text-dark small mt-1">{selectedConsultation.doctorName}</div>
                                                    <div className="text-muted small" style={{ fontSize: '10px' }}>
                                                        PRC Lic. No. 0089281 • PTR Valid 2026 • S2 Reg.
                                                    </div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="modal-footer bg-light py-2 no-print">
                                <button type="button" className="btn btn-outline-secondary rounded-pill px-4" onClick={() => setActiveModal(null)}>Close</button>
                                <button type="button" className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm d-flex align-items-center gap-2" onClick={handlePrintPrescription}>
                                    <RiPrinterLine /> Print Prescription Sheet
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <style>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 10mm 12mm;
                    }
                    body, html {
                        background-color: #ffffff !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print, nav, .sidebar, .navbar, header, footer, .modal-backdrop, .modal-header, .modal-footer, .btn {
                        display: none !important;
                    }
                    .modal {
                        position: static !important;
                        display: block !important;
                        background: none !important;
                        padding: 0 !important;
                        overflow: visible !important;
                    }
                    .modal-dialog {
                        max-width: 100% !important;
                        width: 100% !important;
                        margin: 0 !important;
                        transform: none !important;
                    }
                    .modal-content {
                        border: none !important;
                        box-shadow: none !important;
                        border-radius: 0 !important;
                        padding: 0 !important;
                    }
                    #printable-rx-sheet {
                        width: 100% !important;
                        max-width: 100% !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .rx-print-table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        page-break-inside: avoid !important;
                        margin-bottom: 8px !important;
                    }
                    .rx-print-table th,
                    .rx-print-table td {
                        border: 1px solid #94a3b8 !important;
                        padding: 4px 8px !important;
                        color: #0f172a !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .rx-print-table th {
                        background-color: #f1f5f9 !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default DoctorConsultations;
