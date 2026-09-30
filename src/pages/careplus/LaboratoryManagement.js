import React, { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import {
    RiFlaskLine, RiAddLine, RiSearchLine, RiPrinterLine,
    RiFileTextLine, RiCalendarLine, RiUserLine, RiBuilding4Line,
    RiCheckDoubleLine, RiTimeLine, RiAlertLine, RiCloseLine, RiCheckboxCircleLine
} from 'react-icons/ri';
import { readDatabase, writeDatabase, readSession } from '../../utils/storage';
import { CLINIC_BRANCHES, CLINIC_DOCTORS, LAB_TEST_CATALOG } from '../../utils/careplusData';
import { addAuditLog } from '../../services/auditLogger';

const LaboratoryManagement = () => {
    const session = readSession() || {};
    const [db, setDb] = useState(() => readDatabase({}));
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBranch, setSelectedBranch] = useState('All');
    const [selectedStatus, setSelectedStatus] = useState('All');
    const [activeModal, setActiveModal] = useState(null); // 'order' | 'enterResults' | 'viewReport'
    const [selectedLabOrder, setSelectedLabOrder] = useState(null);

    // New Order Form
    const [orderForm, setOrderForm] = useState({
        patientEmail: '',
        patientName: '',
        requestingDoctor: CLINIC_DOCTORS[0].name,
        branch: session.branch || CLINIC_BRANCHES[1].name, // Northside has diagnostic center
        testName: LAB_TEST_CATALOG[0].name,
        testCategory: LAB_TEST_CATALOG[0].category,
        specimen: 'Venous Blood / Serum',
        clinicalNotes: ''
    });

    // Enter Results Form
    const [resultRows, setResultRows] = useState([]);
    const [resultRemarks, setResultRemarks] = useState('');
    const [technicianName, setTechnicianName] = useState(session.fullName || 'Ronald David, RMT');

    useEffect(() => {
        const sync = () => setDb(readDatabase({}));
        window.addEventListener('careplus_db_updated', sync);
        window.addEventListener('storage', sync);
        return () => {
            window.removeEventListener('careplus_db_updated', sync);
            window.removeEventListener('storage', sync);
        };
    }, []);

    const labOrders = useMemo(() => {
        return (db.laboratory_requests || []).filter(item => {
            const matchesBranch = selectedBranch === 'All' || item.branch === selectedBranch;
            const matchesStatus = selectedStatus === 'All' || item.status === selectedStatus;
            const query = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm ||
                (item.patientName || '').toLowerCase().includes(query) ||
                (item.testName || '').toLowerCase().includes(query) ||
                (item.id || '').toLowerCase().includes(query) ||
                (item.requestingDoctor || '').toLowerCase().includes(query);
            return matchesBranch && matchesStatus && matchesSearch;
        });
    }, [db.laboratory_requests, selectedBranch, selectedStatus, searchTerm]);

    const patients = useMemo(() => {
        return (db.users || []).filter(u => (u.role || '').toLowerCase() === 'patient');
    }, [db.users]);

    const handlePatientChange = (email) => {
        const p = patients.find(pat => pat.email === email);
        if (p) {
            setOrderForm(prev => ({
                ...prev,
                patientEmail: p.email,
                patientName: p.fullName || p.email,
                branch: p.branch || prev.branch
            }));
        }
    };

    const handleTestSelect = (testName) => {
        const catalog = LAB_TEST_CATALOG.find(t => t.name === testName);
        if (catalog) {
            setOrderForm(prev => ({
                ...prev,
                testName: catalog.name,
                testCategory: catalog.category,
                specimen: catalog.category === 'Hematology' ? 'Whole Blood (EDTA Purple Top)' :
                          catalog.category === 'Clinical Microscopy' ? 'Clean Catch Midstream Urine / Stool' :
                          catalog.category === 'Imaging' ? 'Digital Radiography (X-Ray)' : 'Serum (Venipuncture)'
            }));
        }
    };

    const handleCreateOrder = (e) => {
        e.preventDefault();
        if (!orderForm.patientEmail) {
            Swal.fire('Error', 'Please select a patient.', 'warning');
            return;
        }

        const newId = `LAB-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
        const catalogItem = LAB_TEST_CATALOG.find(t => t.name === orderForm.testName);

        const newOrder = {
            id: newId,
            ...orderForm,
            requestDate: new Date().toISOString().split('T')[0],
            completionDate: null,
            status: 'Requested',
            technician: 'Pending Assignment',
            results: [],
            remarks: orderForm.clinicalNotes || 'Diagnostic order received at branch laboratory.'
        };

        // Also add billing item automatically
        const billingRecord = {
            id: `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
            invoiceNumber: `CP-INV-${String(Date.now()).slice(-4)}`,
            patientEmail: orderForm.patientEmail,
            patientName: orderForm.patientName,
            branch: orderForm.branch,
            date: new Date().toISOString().split('T')[0],
            items: [
                { description: `Diagnostic Laboratory: ${orderForm.testName}`, category: 'Laboratory Test', amount: catalogItem ? catalogItem.price : 400 }
            ],
            subtotal: catalogItem ? catalogItem.price : 400,
            discountType: 'None',
            discountAmount: 0,
            tax: 0,
            totalAmount: catalogItem ? catalogItem.price : 400,
            amountPaid: 0,
            paymentStatus: 'Unpaid',
            paymentMethod: 'Pending Billing Counter Checkout',
            receiptNumber: 'PENDING',
            cashier: 'Pending',
            createdAt: new Date().toISOString()
        };

        const newDb = {
            ...db,
            laboratory_requests: [newOrder, ...(db.laboratory_requests || [])],
            billing_records: [billingRecord, ...(db.billing_records || [])]
        };

        writeDatabase(newDb);
        addAuditLog('Laboratory Order Created', `Ordered ${orderForm.testName} for ${orderForm.patientName} at ${orderForm.branch}`);

        Swal.fire({
            icon: 'success',
            title: 'Lab Order Requisitioned',
            text: `Order ${newId} registered. Billed to patient account.`,
            timer: 2000,
            showConfirmButton: false
        });

        setActiveModal(null);
    };

    const openEnterResults = (order) => {
        setSelectedLabOrder(order);
        setResultRemarks(order.remarks || 'Specimen processed and verified according to standard clinical laboratory protocols.');
        setTechnicianName(order.technician && order.technician !== 'Pending Assignment' ? order.technician : (session.fullName || 'Ronald David, RMT'));

        // Pre-fill parameters if exists, or generate template based on test
        if (order.results && order.results.length > 0) {
            setResultRows([...order.results]);
        } else if (order.testName.includes('Lipid')) {
            setResultRows([
                { parameter: 'Total Cholesterol', value: '195', unit: 'mg/dL', normalRange: '< 200 mg/dL', flag: 'Normal' },
                { parameter: 'Triglycerides', value: '135', unit: 'mg/dL', normalRange: '< 150 mg/dL', flag: 'Normal' },
                { parameter: 'HDL Cholesterol', value: '55', unit: 'mg/dL', normalRange: '> 40 mg/dL', flag: 'Normal' },
                { parameter: 'LDL Cholesterol', value: '113', unit: 'mg/dL', normalRange: '< 100 mg/dL', flag: 'High' }
            ]);
        } else if (order.testName.includes('Blood Count') || order.testName.includes('CBC')) {
            setResultRows([
                { parameter: 'Hemoglobin', value: '14.0', unit: 'g/dL', normalRange: '12.0 - 16.0 g/dL', flag: 'Normal' },
                { parameter: 'Hematocrit', value: '42.0', unit: '%', normalRange: '37.0 - 47.0 %', flag: 'Normal' },
                { parameter: 'WBC Count', value: '7,800', unit: '/uL', normalRange: '4,500 - 11,000 /uL', flag: 'Normal' },
                { parameter: 'Platelet Count', value: '250,000', unit: '/uL', normalRange: '150,000 - 450,000 /uL', flag: 'Normal' }
            ]);
        } else if (order.testName.includes('Urinalysis')) {
            setResultRows([
                { parameter: 'Color / Transparency', value: 'Light Yellow / Clear', unit: '', normalRange: 'Straw-Amber / Clear', flag: 'Normal' },
                { parameter: 'Specific Gravity', value: '1.020', unit: '', normalRange: '1.005 - 1.030', flag: 'Normal' },
                { parameter: 'pH', value: '6.0', unit: '', normalRange: '5.0 - 8.0', flag: 'Normal' },
                { parameter: 'Protein / Albumin', value: 'Negative', unit: '', normalRange: 'Negative', flag: 'Normal' },
                { parameter: 'Glucose', value: 'Negative', unit: '', normalRange: 'Negative', flag: 'Normal' },
                { parameter: 'RBC / WBC', value: '0-2 / hpf', unit: '', normalRange: '0-3 / hpf', flag: 'Normal' }
            ]);
        } else {
            setResultRows([
                { parameter: 'Diagnostic Finding / Value', value: 'Normal limits', unit: '', normalRange: 'Normal / Negative', flag: 'Normal' },
                { parameter: 'Clinical Impression', value: 'No acute abnormal pathology identified', unit: '', normalRange: 'Non-reactive', flag: 'Normal' }
            ]);
        }
        setActiveModal('enterResults');
    };

    const handleSaveResults = (e) => {
        e.preventDefault();
        if (!selectedLabOrder) return;

        const updatedOrders = (db.laboratory_requests || []).map(item => {
            if (item.id === selectedLabOrder.id) {
                return {
                    ...item,
                    status: 'Completed',
                    completionDate: new Date().toISOString().split('T')[0],
                    technician: technicianName,
                    results: resultRows,
                    remarks: resultRemarks
                };
            }
            return item;
        });

        const newDb = { ...db, laboratory_requests: updatedOrders };
        writeDatabase(newDb);
        addAuditLog('Laboratory Results Released', `Released results for ${selectedLabOrder.testName} (${selectedLabOrder.id})`);

        Swal.fire({
            icon: 'success',
            title: 'Results Published',
            text: `Lab findings for ${selectedLabOrder.patientName} have been recorded and marked Completed.`,
            timer: 2000,
            showConfirmButton: false
        });

        setActiveModal(null);
    };

    const handleAddResultRow = () => {
        setResultRows(prev => [...prev, { parameter: '', value: '', unit: '', normalRange: '', flag: 'Normal' }]);
    };

    const handleRemoveResultRow = (idx) => {
        setResultRows(prev => prev.filter((_, i) => i !== idx));
    };

    const handleResultFieldChange = (idx, field, val) => {
        setResultRows(prev => {
            const copy = [...prev];
            copy[idx][field] = val;
            return copy;
        });
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Completed':
                return <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-1"><RiCheckDoubleLine className="me-1" /> Completed</span>;
            case 'Processing':
                return <span className="badge bg-warning bg-opacity-10 text-dark border border-warning border-opacity-25 px-3 py-1"><RiTimeLine className="me-1" /> Processing</span>;
            case 'Requested':
            default:
                return <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-3 py-1"><RiAlertLine className="me-1" /> Requested</span>;
        }
    };

    return (
        <div className="container-fluid p-3 p-md-4 animate__animated animate__fadeIn">
            {/* Header Banner */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 p-4 rounded-4 shadow-sm bg-white border">
                <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                        <span className="badge rounded-pill bg-info bg-opacity-10 text-primary px-3 py-1 fw-bold">
                            <RiFlaskLine className="me-1" /> Laboratory & Diagnostics Module
                        </span>
                        <span className="badge rounded-pill bg-light text-secondary border px-3 py-1">
                            CarePlus Diagnostic Network
                        </span>
                    </div>
                    <h2 className="fw-bold mb-1 text-dark">Laboratory Requests & Results</h2>
                    <p className="text-muted small mb-0">
                        Order diagnostic tests, track specimen processing across Metro and Northside branches, record clinical laboratory findings, and generate official result slips.
                    </p>
                </div>
                <div className="d-flex gap-2">
                    <button
                        onClick={() => setActiveModal('order')}
                        className="btn btn-primary d-flex align-items-center gap-2 px-3 py-2 rounded-3 shadow-sm fw-semibold"
                    >
                        <RiAddLine size={18} /> New Lab Order
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-md-4">
                    <div className="input-group bg-white rounded-3 shadow-sm border">
                        <span className="input-group-text bg-transparent border-0 text-muted">
                            <RiSearchLine />
                        </span>
                        <input
                            type="text"
                            className="form-control border-0 bg-transparent"
                            placeholder="Search patient, test, doctor, or ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="col-12 col-md-4">
                    <div className="input-group bg-white rounded-3 shadow-sm border">
                        <span className="input-group-text bg-transparent border-0 text-muted">
                            <RiBuilding4Line />
                        </span>
                        <select
                            className="form-select border-0 bg-transparent"
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                        >
                            <option value="All">All Laboratory Branches</option>
                            {CLINIC_BRANCHES.map(b => (
                                <option key={b.id} value={b.name}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="col-12 col-md-4">
                    <div className="input-group bg-white rounded-3 shadow-sm border">
                        <span className="input-group-text bg-transparent border-0 text-muted">
                            <RiCheckboxCircleLine />
                        </span>
                        <select
                            className="form-select border-0 bg-transparent"
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                        >
                            <option value="All">All Statuses</option>
                            <option value="Requested">Requested (Pending Collection)</option>
                            <option value="Processing">In Processing / Analysis</option>
                            <option value="Completed">Completed & Verified</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Laboratory Orders Table */}
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0" style={{ minWidth: '850px' }}>
                        <thead className="table-light">
                            <tr>
                                <th className="ps-4" style={{ whiteSpace: 'nowrap' }}>Order ID &amp; Date</th>
                                <th style={{ whiteSpace: 'nowrap' }}>Patient Name</th>
                                <th style={{ whiteSpace: 'nowrap' }}>Test Ordered</th>
                                <th style={{ whiteSpace: 'nowrap' }}>Branch</th>
                                <th style={{ whiteSpace: 'nowrap' }}>Requesting Doctor</th>
                                <th style={{ whiteSpace: 'nowrap' }}>Status</th>
                                <th className="text-end pe-4" style={{ whiteSpace: 'nowrap' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {labOrders.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="text-center py-5 text-muted">
                                        <RiFlaskLine size={42} className="mb-2 text-secondary opacity-50" />
                                        <p className="mb-0">No laboratory orders match your criteria.</p>
                                    </td>
                                </tr>
                            ) : (
                                labOrders.map((order) => (
                                    <tr key={order.id}>
                                        <td className="ps-4">
                                            <div className="fw-bold text-dark">{order.id}</div>
                                            <div className="small text-muted">{order.requestDate}</div>
                                        </td>
                                        <td>
                                            <div className="fw-semibold text-dark">{order.patientName}</div>
                                            <div className="small text-muted">{order.patientEmail}</div>
                                        </td>
                                        <td>
                                            <div className="fw-semibold text-primary">{order.testName}</div>
                                            <div className="small text-muted">{order.testCategory} • {order.specimen}</div>
                                        </td>
                                        <td>
                                            <span className={`badge rounded-pill ${order.branch?.includes('Metro') ? 'bg-primary bg-opacity-10 text-primary' : 'bg-info bg-opacity-10 text-dark'}`}>
                                                {order.branch?.includes('Metro') ? 'Metro Branch' : 'Northside Branch'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="small text-dark">{order.requestingDoctor}</div>
                                        </td>
                                        <td>{getStatusBadge(order.status)}</td>
                                        <td className="text-end pe-4">
                                            <div className="btn-group">
                                                {order.status !== 'Completed' ? (
                                                    <button
                                                        onClick={() => openEnterResults(order)}
                                                        className="btn btn-sm btn-primary rounded-pill px-3"
                                                    >
                                                        Enter Results
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedLabOrder(order);
                                                            setActiveModal('viewReport');
                                                        }}
                                                        className="btn btn-sm btn-outline-success rounded-pill px-3"
                                                    >
                                                        <RiFileTextLine className="me-1" /> View Lab Slip
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal: New Lab Order */}
            {activeModal === 'order' && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered">
                        <div className="modal-content rounded-4 border-0 shadow">
                            <div className="modal-header bg-primary text-white py-3">
                                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                                    <RiFlaskLine /> Requisition Laboratory Procedure
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
                            </div>
                            <form onSubmit={handleCreateOrder}>
                                <div className="modal-body p-4">
                                    <div className="row g-3">
                                        <div className="col-md-6">
                                            <label className="form-label small fw-semibold">Patient *</label>
                                            <select
                                                className="form-select"
                                                value={orderForm.patientEmail}
                                                onChange={(e) => handlePatientChange(e.target.value)}
                                                required
                                            >
                                                <option value="">-- Choose Patient --</option>
                                                {patients.map(p => (
                                                    <option key={p.email} value={p.email}>
                                                        {p.fullName || p.email} ({p.branch || 'Patient'})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small fw-semibold">Performing Branch Laboratory *</label>
                                            <select
                                                className="form-select"
                                                value={orderForm.branch}
                                                onChange={(e) => setOrderForm(prev => ({ ...prev, branch: e.target.value }))}
                                                required
                                            >
                                                {CLINIC_BRANCHES.map(b => (
                                                    <option key={b.id} value={b.name}>{b.name} ({b.tag})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small fw-semibold">Laboratory Procedure *</label>
                                            <select
                                                className="form-select"
                                                value={orderForm.testName}
                                                onChange={(e) => handleTestSelect(e.target.value)}
                                                required
                                            >
                                                {LAB_TEST_CATALOG.map(t => (
                                                    <option key={t.code} value={t.name}>
                                                        [{t.category}] {t.name} - ₱{t.price}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small fw-semibold">Requesting Physician *</label>
                                            <select
                                                className="form-select"
                                                value={orderForm.requestingDoctor}
                                                onChange={(e) => setOrderForm(prev => ({ ...prev, requestingDoctor: e.target.value }))}
                                                required
                                            >
                                                {CLINIC_DOCTORS.map(d => (
                                                    <option key={d.id} value={d.name}>{d.name} ({d.specialty})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-md-12">
                                            <label className="form-label small fw-semibold">Specimen Requirements & Handling</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={orderForm.specimen}
                                                onChange={(e) => setOrderForm(prev => ({ ...prev, specimen: e.target.value }))}
                                            />
                                        </div>
                                        <div className="col-md-12">
                                            <label className="form-label small fw-semibold">Clinical Indications / Physician Remarks</label>
                                            <textarea
                                                className="form-control"
                                                rows="2"
                                                placeholder="e.g. Fasting confirmed; evaluate for dyslipidemia or routine employment check..."
                                                value={orderForm.clinicalNotes}
                                                onChange={(e) => setOrderForm(prev => ({ ...prev, clinicalNotes: e.target.value }))}
                                            ></textarea>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer bg-light py-2">
                                    <button type="button" className="btn btn-secondary rounded-pill px-4" onClick={() => setActiveModal(null)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary rounded-pill px-4 fw-bold">Submit Requisition</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Enter Results */}
            {activeModal === 'enterResults' && selectedLabOrder && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
                    <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content rounded-4 border-0 shadow">
                            <div className="modal-header bg-success text-white py-3">
                                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                                    <RiFlaskLine /> Clinical Laboratory Result Encoding ({selectedLabOrder.id})
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
                            </div>
                            <form onSubmit={handleSaveResults}>
                                <div className="modal-body p-4">
                                    <div className="p-3 bg-light rounded-3 mb-3 border d-flex flex-wrap justify-content-between gap-3">
                                        <div>
                                            <span className="small text-muted">Patient:</span> <strong>{selectedLabOrder.patientName}</strong>
                                        </div>
                                        <div>
                                            <span className="small text-muted">Test:</span> <strong className="text-primary">{selectedLabOrder.testName}</strong>
                                        </div>
                                        <div>
                                            <span className="small text-muted">Branch:</span> <strong>{selectedLabOrder.branch}</strong>
                                        </div>
                                        <div>
                                            <span className="small text-muted">Physician:</span> <strong>{selectedLabOrder.requestingDoctor}</strong>
                                        </div>
                                    </div>

                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <h6 className="fw-bold mb-0 text-dark">Quantitative & Qualitative Parameters</h6>
                                        <button
                                            type="button"
                                            onClick={handleAddResultRow}
                                            className="btn btn-sm btn-outline-success rounded-pill px-3"
                                        >
                                            <RiAddLine /> Add Parameter Row
                                        </button>
                                    </div>

                                    <div className="table-responsive mb-3">
                                        <table className="table table-bordered align-middle">
                                            <thead className="table-light small">
                                                <tr>
                                                    <th>Parameter / Analyte</th>
                                                    <th>Measured Value</th>
                                                    <th>Unit</th>
                                                    <th>Reference Range</th>
                                                    <th>Clinical Flag</th>
                                                    <th style={{ width: '40px' }}></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {resultRows.map((row, idx) => (
                                                    <tr key={idx}>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="form-control form-control-sm"
                                                                value={row.parameter}
                                                                onChange={(e) => handleResultFieldChange(idx, 'parameter', e.target.value)}
                                                                required
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="form-control form-control-sm fw-bold"
                                                                value={row.value}
                                                                onChange={(e) => handleResultFieldChange(idx, 'value', e.target.value)}
                                                                required
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="form-control form-control-sm"
                                                                value={row.unit}
                                                                placeholder="e.g. mg/dL"
                                                                onChange={(e) => handleResultFieldChange(idx, 'unit', e.target.value)}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="form-control form-control-sm"
                                                                value={row.normalRange}
                                                                placeholder="e.g. 70 - 100"
                                                                onChange={(e) => handleResultFieldChange(idx, 'normalRange', e.target.value)}
                                                            />
                                                        </td>
                                                        <td>
                                                            <select
                                                                className={`form-select form-select-sm fw-bold ${row.flag === 'High' ? 'text-danger' : row.flag === 'Low' ? 'text-warning' : 'text-success'}`}
                                                                value={row.flag}
                                                                onChange={(e) => handleResultFieldChange(idx, 'flag', e.target.value)}
                                                            >
                                                                <option value="Normal">Normal</option>
                                                                <option value="High">High</option>
                                                                <option value="Low">Low</option>
                                                                <option value="Critical">Critical</option>
                                                            </select>
                                                        </td>
                                                        <td className="text-center">
                                                            {resultRows.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveResultRow(idx)}
                                                                    className="btn btn-sm btn-link text-danger p-0"
                                                                >
                                                                    <RiCloseLine size={18} />
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="row g-3">
                                        <div className="col-md-6">
                                            <label className="form-label small fw-semibold">Medical Technologist / Pathologist Name *</label>
                                            <input
                                                type="text"
                                                className="form-control form-control-sm"
                                                value={technicianName}
                                                onChange={(e) => setTechnicianName(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small fw-semibold">Completion Date</label>
                                            <input
                                                type="text"
                                                className="form-control form-control-sm bg-light"
                                                value={new Date().toISOString().split('T')[0]}
                                                readOnly
                                            />
                                        </div>
                                        <div className="col-12">
                                            <label className="form-label small fw-semibold">Pathologist Remarks / Technical Comments</label>
                                            <textarea
                                                className="form-control form-control-sm"
                                                rows="2"
                                                value={resultRemarks}
                                                onChange={(e) => setResultRemarks(e.target.value)}
                                            ></textarea>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer bg-light py-2">
                                    <button type="button" className="btn btn-secondary rounded-pill px-4" onClick={() => setActiveModal(null)}>Cancel</button>
                                    <button type="submit" className="btn btn-success rounded-pill px-4 fw-bold">Verify & Release Results</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: View Official Lab Report Slip */}
            {activeModal === 'viewReport' && selectedLabOrder && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1050 }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content rounded-4 border-0 shadow-lg">
                            <div className="modal-header border-bottom py-3 bg-light">
                                <h5 className="modal-title fw-bold text-dark">
                                    Official Diagnostic Laboratory Examination Report
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
                            </div>
                            <div className="modal-body p-4 bg-white" id="printable-lab-report">
                                {/* Header */}
                                <div className="text-center border-bottom pb-3 mb-3">
                                    <h4 className="fw-bold mb-0 text-primary">CarePlus Diagnostic Laboratory</h4>
                                    <div className="fw-semibold text-secondary small">{selectedLabOrder.branch}</div>
                                    <div className="text-muted small">Department of Pathology & Clinical Laboratory Services</div>
                                    <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 mt-1">
                                        Accredited Clinical Testing Facility
                                    </span>
                                </div>

                                {/* Patient Information */}
                                <div className="row g-2 mb-3 p-3 bg-light rounded-3 border small">
                                    <div className="col-6 col-md-3">
                                        <span className="text-muted">Patient Name:</span>
                                        <div className="fw-bold text-dark">{selectedLabOrder.patientName}</div>
                                    </div>
                                    <div className="col-6 col-md-3">
                                        <span className="text-muted">Laboratory ID:</span>
                                        <div className="fw-bold text-dark">{selectedLabOrder.id}</div>
                                    </div>
                                    <div className="col-6 col-md-3">
                                        <span className="text-muted">Date Requisitioned:</span>
                                        <div className="fw-bold text-dark">{selectedLabOrder.requestDate}</div>
                                    </div>
                                    <div className="col-6 col-md-3">
                                        <span className="text-muted">Date Released:</span>
                                        <div className="fw-bold text-success">{selectedLabOrder.completionDate || 'Same Day'}</div>
                                    </div>
                                    <div className="col-6 col-md-6">
                                        <span className="text-muted">Requesting Physician:</span>
                                        <div className="fw-semibold text-dark">{selectedLabOrder.requestingDoctor}</div>
                                    </div>
                                    <div className="col-6 col-md-6">
                                        <span className="text-muted">Specimen Type:</span>
                                        <div className="fw-semibold text-dark">{selectedLabOrder.specimen}</div>
                                    </div>
                                </div>

                                <div className="mb-2">
                                    <h5 className="fw-bold text-dark mb-1">{selectedLabOrder.testName}</h5>
                                    <span className="badge bg-secondary bg-opacity-10 text-secondary mb-3">{selectedLabOrder.testCategory}</span>
                                </div>

                                {/* Results Table */}
                                <div className="table-responsive mb-4">
                                    <table className="table table-sm table-bordered">
                                        <thead className="table-light">
                                            <tr className="small">
                                                <th>Parameter / Test</th>
                                                <th>Result</th>
                                                <th>Unit</th>
                                                <th>Reference Range</th>
                                                <th>Flag</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedLabOrder.results && selectedLabOrder.results.length > 0 ? (
                                                selectedLabOrder.results.map((r, i) => (
                                                    <tr key={i}>
                                                        <td className="fw-semibold text-dark">{r.parameter}</td>
                                                        <td className="fw-bold">{r.value}</td>
                                                        <td className="small text-muted">{r.unit}</td>
                                                        <td className="small">{r.normalRange}</td>
                                                        <td>
                                                            <span className={`badge ${r.flag === 'High' ? 'bg-danger' : r.flag === 'Low' ? 'bg-warning text-dark' : 'bg-success'}`}>
                                                                {r.flag || 'Normal'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="text-center text-muted">No individual parameter entries.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Remarks */}
                                {selectedLabOrder.remarks && (
                                    <div className="p-3 bg-light rounded-3 border mb-4 small">
                                        <strong>Technician Remarks:</strong> {selectedLabOrder.remarks}
                                    </div>
                                )}

                                {/* Signatures */}
                                <div className="row text-center mt-5 pt-3">
                                    <div className="col-6">
                                        <div className="border-bottom pb-1 fw-bold text-dark">{selectedLabOrder.technician || 'Ronald David, RMT'}</div>
                                        <div className="small text-muted">Medical Technologist</div>
                                        <div className="small text-muted">PRC Lic. No. 0048191</div>
                                    </div>
                                    <div className="col-6">
                                        <div className="border-bottom pb-1 fw-bold text-dark">Dr. Elena Cruz, MD, FPSP</div>
                                        <div className="small text-muted">Clinical Pathologist</div>
                                        <div className="small text-muted">PRC Lic. No. 0039281</div>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer bg-light py-2">
                                <button type="button" className="btn btn-outline-secondary rounded-pill px-4" onClick={() => setActiveModal(null)}>Close</button>
                                <button type="button" className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm d-flex align-items-center gap-2" onClick={() => window.print()}>
                                    <RiPrinterLine /> Print Official Report
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LaboratoryManagement;
