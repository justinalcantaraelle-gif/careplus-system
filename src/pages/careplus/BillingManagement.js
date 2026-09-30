import React, { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import {
    RiMoneyDollarCircleLine, RiAddLine, RiSearchLine, RiPrinterLine,
    RiFileTextLine, RiBuilding4Line, RiCheckDoubleLine, RiTimeLine,
    RiBankCardLine, RiCloseLine, RiCoinsLine, RiPercentLine, RiUserLine
} from 'react-icons/ri';
import { readDatabase, writeDatabase, readSession } from '../../utils/storage';
import { CLINIC_BRANCHES, LAB_TEST_CATALOG } from '../../utils/careplusData';
import { addAuditLog } from '../../services/auditLogger';

const BillingManagement = () => {
    const session = readSession() || {};
    const [db, setDb] = useState(() => readDatabase({}));
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBranch, setSelectedBranch] = useState('All');
    const [selectedStatus, setSelectedStatus] = useState('All');
    const [activeModal, setActiveModal] = useState(null); // 'create' | 'pay' | 'receipt'
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    // Create Invoice Form State
    const [invoiceForm, setInvoiceForm] = useState({
        patientEmail: '',
        patientName: '',
        branch: session.branch || CLINIC_BRANCHES[0].name,
        date: new Date().toISOString().split('T')[0],
        items: [
            { description: 'Physician Consultation Fee', category: 'Professional Fee', amount: 800 }
        ],
        discountType: 'None',
        discountPercentage: 0
    });

    // Payment Processing Form State
    const [paymentForm, setPaymentForm] = useState({
        paymentMethod: 'Cash',
        amountTendered: 0,
        referenceNo: ''
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

    const invoices = useMemo(() => {
        return (db.billing_records || []).filter(inv => {
            const matchesBranch = selectedBranch === 'All' || inv.branch === selectedBranch;
            const matchesStatus = selectedStatus === 'All' || inv.paymentStatus === selectedStatus;
            const query = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm ||
                (inv.patientName || '').toLowerCase().includes(query) ||
                (inv.invoiceNumber || '').toLowerCase().includes(query) ||
                (inv.receiptNumber || '').toLowerCase().includes(query);
            return matchesBranch && matchesStatus && matchesSearch;
        });
    }, [db.billing_records, selectedBranch, selectedStatus, searchTerm]);

    const patients = useMemo(() => {
        return (db.users || []).filter(u => (u.role || '').toLowerCase() === 'patient');
    }, [db.users]);

    const handlePatientChange = (email) => {
        const p = patients.find(pat => pat.email === email);
        if (p) {
            let defaultDiscount = 'None';
            let defaultPerc = 0;
            if (p.patient_type === 'Senior Citizen' || p.insuranceProvider?.includes('Senior')) {
                defaultDiscount = 'Senior Citizen (20%)';
                defaultPerc = 20;
            } else if (p.insuranceProvider?.includes('PhilHealth')) {
                defaultDiscount = 'PhilHealth Benefit';
                defaultPerc = 15;
            }

            setInvoiceForm(prev => ({
                ...prev,
                patientEmail: p.email,
                patientName: p.fullName || p.email,
                branch: p.branch || prev.branch,
                discountType: defaultDiscount,
                discountPercentage: defaultPerc
            }));
        }
    };

    const handleAddItem = () => {
        setInvoiceForm(prev => ({
            ...prev,
            items: [...prev.items, { description: '', category: 'Medical Service', amount: 0 }]
        }));
    };

    const handleRemoveItem = (idx) => {
        setInvoiceForm(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== idx)
        }));
    };

    const handleItemChange = (idx, field, value) => {
        setInvoiceForm(prev => {
            const updated = [...prev.items];
            updated[idx][field] = field === 'amount' ? (Number(value) || 0) : value;
            return { ...prev, items: updated };
        });
    };

    const handleDiscountChange = (type) => {
        let perc = 0;
        if (type === 'Senior Citizen (20%)' || type === 'PWD (20%)') perc = 20;
        else if (type === 'PhilHealth Benefit') perc = 15;
        else if (type === 'CarePlus Employee Discount') perc = 25;

        setInvoiceForm(prev => ({
            ...prev,
            discountType: type,
            discountPercentage: perc
        }));
    };

    const formSubtotal = useMemo(() => {
        return invoiceForm.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    }, [invoiceForm.items]);

    const formDiscountAmount = useMemo(() => {
        return Math.round((formSubtotal * invoiceForm.discountPercentage) / 100);
    }, [formSubtotal, invoiceForm.discountPercentage]);

    const formTotal = useMemo(() => {
        return Math.max(0, formSubtotal - formDiscountAmount);
    }, [formSubtotal, formDiscountAmount]);

    const handleCreateInvoice = (e) => {
        e.preventDefault();
        if (!invoiceForm.patientEmail) {
            Swal.fire('Error', 'Please select a patient.', 'warning');
            return;
        }

        const validItems = invoiceForm.items.filter(i => i.description.trim() !== '' && i.amount > 0);
        if (validItems.length === 0) {
            Swal.fire('Error', 'Please add at least one billed charge item.', 'warning');
            return;
        }

        const invNum = `CP-INV-${String(Date.now()).slice(-4)}`;
        const newInvoice = {
            id: `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
            invoiceNumber: invNum,
            patientEmail: invoiceForm.patientEmail,
            patientName: invoiceForm.patientName,
            branch: invoiceForm.branch,
            date: invoiceForm.date,
            items: validItems,
            subtotal: formSubtotal,
            discountType: invoiceForm.discountType,
            discountAmount: formDiscountAmount,
            tax: 0,
            totalAmount: formTotal,
            amountPaid: 0,
            paymentStatus: 'Unpaid',
            paymentMethod: 'Pending Billing Counter Checkout',
            receiptNumber: 'PENDING',
            cashier: session.fullName || 'Billing Officer',
            createdAt: new Date().toISOString()
        };

        const newDb = {
            ...db,
            billing_records: [newInvoice, ...(db.billing_records || [])]
        };

        writeDatabase(newDb);
        addAuditLog('Billing Invoice Created', `Created invoice ${invNum} for ${invoiceForm.patientName} (₱${formTotal.toLocaleString()})`);

        Swal.fire({
            icon: 'success',
            title: 'Invoice Generated',
            text: `Invoice ${invNum} for ₱${formTotal.toLocaleString()} created successfully.`,
            timer: 2000,
            showConfirmButton: false
        });

        setActiveModal(null);
    };

    const openPaymentModal = (invoice) => {
        setSelectedInvoice(invoice);
        setPaymentForm({
            paymentMethod: 'Cash',
            amountTendered: invoice.totalAmount - (invoice.amountPaid || 0),
            referenceNo: ''
        });
        setActiveModal('pay');
    };

    const handleProcessPayment = (e) => {
        e.preventDefault();
        if (!selectedInvoice) return;

        const orNumber = `OR-CP-${Math.floor(10000 + Math.random() * 90000)}`;
        const totalDue = selectedInvoice.totalAmount;
        const currentPaid = selectedInvoice.amountPaid || 0;
        const newlyPaid = Number(paymentForm.amountTendered) || 0;
        const updatedPaid = currentPaid + newlyPaid;
        const newStatus = updatedPaid >= totalDue ? 'Paid' : 'Partial';

        const updatedRecords = (db.billing_records || []).map(inv => {
            if (inv.id === selectedInvoice.id) {
                return {
                    ...inv,
                    amountPaid: updatedPaid,
                    paymentStatus: newStatus,
                    paymentMethod: paymentForm.paymentMethod + (paymentForm.referenceNo ? ` (${paymentForm.referenceNo})` : ''),
                    receiptNumber: orNumber,
                    cashier: session.fullName || 'Teresa Gomez (Cashier)',
                    paymentDate: new Date().toISOString().split('T')[0]
                };
            }
            return inv;
        });

        const newDb = { ...db, billing_records: updatedRecords };
        writeDatabase(newDb);
        addAuditLog('Payment Processed', `Received ₱${newlyPaid.toLocaleString()} for Invoice ${selectedInvoice.invoiceNumber} via ${paymentForm.paymentMethod}`);

        Swal.fire({
            icon: 'success',
            title: 'Payment Received!',
            html: `Official Receipt <b>${orNumber}</b> generated.<br>Payment status is now <b>${newStatus}</b>.`,
            showConfirmButton: true,
            confirmButtonText: 'View Official Receipt'
        }).then((result) => {
            if (result.isConfirmed) {
                const refreshed = updatedRecords.find(i => i.id === selectedInvoice.id);
                setSelectedInvoice(refreshed);
                setActiveModal('receipt');
            } else {
                setActiveModal(null);
            }
        });
    };

    const totalRevenue = useMemo(() => {
        return (db.billing_records || [])
            .filter(i => i.paymentStatus === 'Paid')
            .reduce((sum, i) => sum + (Number(i.amountPaid) || 0), 0);
    }, [db.billing_records]);

    const totalUnpaid = useMemo(() => {
        return (db.billing_records || [])
            .filter(i => i.paymentStatus !== 'Paid')
            .reduce((sum, i) => sum + ((Number(i.totalAmount) || 0) - (Number(i.amountPaid) || 0)), 0);
    }, [db.billing_records]);

    return (
        <div className="container-fluid p-3 p-md-4 animate__animated animate__fadeIn">
            {/* Header Banner */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 p-4 rounded-4 shadow-sm bg-white border">
                <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                        <span className="badge rounded-pill bg-success bg-opacity-10 text-success px-3 py-1 fw-bold">
                            <RiMoneyDollarCircleLine className="me-1" /> Financial & Billing Module
                        </span>
                        <span className="badge rounded-pill bg-light text-secondary border px-3 py-1">
                            CarePlus Revenue Cycle
                        </span>
                    </div>
                    <h2 className="fw-bold mb-1 text-dark">Billing & Payments Management</h2>
                    <p className="text-muted small mb-0">
                        Itemized invoicing for consultations, diagnostics, and laboratory procedures. Apply statutory discounts (Senior/PWD/PhilHealth), process multi-channel payments, and issue official receipts.
                    </p>
                </div>
                <div>
                    <button
                        onClick={() => setActiveModal('create')}
                        className="btn btn-primary d-flex align-items-center gap-2 px-3 py-2 rounded-3 shadow-sm fw-semibold"
                    >
                        <RiAddLine size={18} /> Create Patient Invoice
                    </button>
                </div>
            </div>

            {/* Financial Overview Cards */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-md-4">
                    <div className="p-3 bg-white rounded-4 shadow-sm border border-success border-opacity-25 d-flex align-items-center gap-3">
                        <div className="p-3 rounded-3 bg-success bg-opacity-10 text-success fs-3">
                            <RiCoinsLine />
                        </div>
                        <div>
                            <div className="text-muted small">Total Collections (Paid)</div>
                            <h4 className="fw-bold text-dark mb-0">₱{totalRevenue.toLocaleString()}</h4>
                        </div>
                    </div>
                </div>
                <div className="col-12 col-md-4">
                    <div className="p-3 bg-white rounded-4 shadow-sm border border-warning border-opacity-25 d-flex align-items-center gap-3">
                        <div className="p-3 rounded-3 bg-warning bg-opacity-10 text-warning text-dark fs-3">
                            <RiTimeLine />
                        </div>
                        <div>
                            <div className="text-muted small">Outstanding Receivables (Unpaid)</div>
                            <h4 className="fw-bold text-danger mb-0">₱{totalUnpaid.toLocaleString()}</h4>
                        </div>
                    </div>
                </div>
                <div className="col-12 col-md-4">
                    <div className="p-3 bg-white rounded-4 shadow-sm border d-flex align-items-center gap-3">
                        <div className="p-3 rounded-3 bg-primary bg-opacity-10 text-primary fs-3">
                            <RiFileTextLine />
                        </div>
                        <div>
                            <div className="text-muted small">Total Invoices Issued</div>
                            <h4 className="fw-bold text-dark mb-0">{(db.billing_records || []).length} Invoices</h4>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-md-4">
                    <div className="input-group bg-white rounded-3 shadow-sm border">
                        <span className="input-group-text bg-transparent border-0 text-muted">
                            <RiSearchLine />
                        </span>
                        <input
                            type="text"
                            className="form-control border-0 bg-transparent"
                            placeholder="Search patient, invoice no, receipt..."
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
                            <option value="All">All CarePlus Branches</option>
                            {CLINIC_BRANCHES.map(b => (
                                <option key={b.id} value={b.name}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="col-12 col-md-4">
                    <div className="input-group bg-white rounded-3 shadow-sm border">
                        <span className="input-group-text bg-transparent border-0 text-muted">
                            <RiBankCardLine />
                        </span>
                        <select
                            className="form-select border-0 bg-transparent"
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                        >
                            <option value="All">All Payment Statuses</option>
                            <option value="Paid">Paid in Full</option>
                            <option value="Unpaid">Unpaid (Awaiting Payment)</option>
                            <option value="Partial">Partial Payment</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Invoices Table */}
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                            <tr>
                                <th className="ps-4">Invoice No / Date</th>
                                <th>Patient Name</th>
                                <th>Branch</th>
                                <th>Total Due</th>
                                <th>Amount Paid</th>
                                <th>Status</th>
                                <th className="text-end pe-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="text-center py-5 text-muted">
                                        <RiMoneyDollarCircleLine size={42} className="mb-2 text-secondary opacity-50" />
                                        <p className="mb-0">No billing records found matching your filters.</p>
                                    </td>
                                </tr>
                            ) : (
                                invoices.map((inv) => (
                                    <tr key={inv.id}>
                                        <td className="ps-4">
                                            <div className="fw-bold text-dark">{inv.invoiceNumber}</div>
                                            <div className="small text-muted">{inv.date}</div>
                                        </td>
                                        <td>
                                            <div className="fw-semibold text-dark">{inv.patientName}</div>
                                            <div className="small text-muted">{inv.patientEmail}</div>
                                        </td>
                                        <td>
                                            <span className={`badge rounded-pill ${inv.branch?.includes('Metro') ? 'bg-primary bg-opacity-10 text-primary' : 'bg-info bg-opacity-10 text-dark'}`}>
                                                {inv.branch?.includes('Metro') ? 'Metro Branch' : 'Northside Branch'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="fw-bold text-dark">₱{(inv.totalAmount || 0).toLocaleString()}</div>
                                            {inv.discountAmount > 0 && (
                                                <div className="small text-success">-{inv.discountType}</div>
                                            )}
                                        </td>
                                        <td>
                                            <div className="fw-semibold text-dark">₱{(inv.amountPaid || 0).toLocaleString()}</div>
                                            {inv.paymentMethod && inv.paymentMethod !== 'Pending Billing Counter Checkout' && (
                                                <div className="small text-muted">{inv.paymentMethod}</div>
                                            )}
                                        </td>
                                        <td>
                                            {inv.paymentStatus === 'Paid' ? (
                                                <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-1">
                                                    <RiCheckDoubleLine className="me-1" /> Paid
                                                </span>
                                            ) : inv.paymentStatus === 'Partial' ? (
                                                <span className="badge bg-warning bg-opacity-10 text-dark border border-warning border-opacity-25 px-3 py-1">
                                                    Partial
                                                </span>
                                            ) : (
                                                <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-3 py-1">
                                                    Unpaid
                                                </span>
                                            )}
                                        </td>
                                        <td className="text-end pe-4">
                                            <div className="btn-group">
                                                {inv.paymentStatus !== 'Paid' && (
                                                    <button
                                                        onClick={() => openPaymentModal(inv)}
                                                        className="btn btn-sm btn-success rounded-pill px-3 me-2"
                                                    >
                                                        Collect Payment
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setSelectedInvoice(inv);
                                                        setActiveModal('receipt');
                                                    }}
                                                    className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                                                >
                                                    <RiPrinterLine className="me-1" /> Receipt
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

            {/* Modal: Create Invoice */}
            {activeModal === 'create' && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content rounded-4 border-0 shadow">
                            <div className="modal-header bg-primary text-white py-3">
                                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                                    <RiMoneyDollarCircleLine /> Generate New Patient Billing Invoice
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
                            </div>
                            <form onSubmit={handleCreateInvoice}>
                                <div className="modal-body p-4">
                                    <div className="row g-3 mb-4">
                                        <div className="col-md-6">
                                            <label className="form-label small fw-semibold">Patient *</label>
                                            <select
                                                className="form-select"
                                                value={invoiceForm.patientEmail}
                                                onChange={(e) => handlePatientChange(e.target.value)}
                                                required
                                            >
                                                <option value="">-- Select Patient --</option>
                                                {patients.map(p => (
                                                    <option key={p.email} value={p.email}>
                                                        {p.fullName || p.email} ({p.insuranceProvider || 'No Insurance'})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small fw-semibold">CarePlus Clinic Branch *</label>
                                            <select
                                                className="form-select"
                                                value={invoiceForm.branch}
                                                onChange={(e) => setInvoiceForm(prev => ({ ...prev, branch: e.target.value }))}
                                                required
                                            >
                                                {CLINIC_BRANCHES.map(b => (
                                                    <option key={b.id} value={b.name}>{b.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Line Items */}
                                    <div className="mb-4">
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <h6 className="fw-bold mb-0 text-dark">Itemized Clinical Services & Charges</h6>
                                            <button
                                                type="button"
                                                onClick={handleAddItem}
                                                className="btn btn-sm btn-outline-primary rounded-pill px-3"
                                            >
                                                <RiAddLine /> Add Charge Item
                                            </button>
                                        </div>

                                        {invoiceForm.items.map((item, idx) => (
                                            <div key={idx} className="row g-2 align-items-center mb-2">
                                                <div className="col-md-6">
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-sm"
                                                        placeholder="Service description (e.g. CBC, Ultrasound, Meds)"
                                                        value={item.description}
                                                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                                        required
                                                    />
                                                </div>
                                                <div className="col-md-3">
                                                    <select
                                                        className="form-select form-select-sm"
                                                        value={item.category}
                                                        onChange={(e) => handleItemChange(idx, 'category', e.target.value)}
                                                    >
                                                        <option value="Professional Fee">Professional Fee</option>
                                                        <option value="Laboratory Test">Laboratory Test</option>
                                                        <option value="Imaging">Imaging / X-Ray</option>
                                                        <option value="Supplies">Supplies / Meds</option>
                                                        <option value="Facility Fee">Facility Fee</option>
                                                    </select>
                                                </div>
                                                <div className="col-md-2">
                                                    <div className="input-group input-group-sm">
                                                        <span className="input-group-text">₱</span>
                                                        <input
                                                            type="number"
                                                            className="form-control form-control-sm fw-bold text-end"
                                                            value={item.amount}
                                                            onChange={(e) => handleItemChange(idx, 'amount', e.target.value)}
                                                            min="0"
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                                <div className="col-md-1 text-center">
                                                    {invoiceForm.items.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveItem(idx)}
                                                            className="btn btn-sm btn-link text-danger p-0"
                                                        >
                                                            <RiCloseLine size={18} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Discount & Totals Section */}
                                    <div className="p-3 bg-light rounded-3 border">
                                        <div className="row g-3 align-items-center">
                                            <div className="col-md-6">
                                                <label className="form-label small fw-semibold">Statutory Discount / Benefit</label>
                                                <select
                                                    className="form-select form-select-sm"
                                                    value={invoiceForm.discountType}
                                                    onChange={(e) => handleDiscountChange(e.target.value)}
                                                >
                                                    <option value="None">None (Standard Retail)</option>
                                                    <option value="Senior Citizen (20%)">Senior Citizen (20% Statutory)</option>
                                                    <option value="PWD (20%)">Person with Disability (20% PWD)</option>
                                                    <option value="PhilHealth Benefit">PhilHealth Ambulatory Benefit (15%)</option>
                                                    <option value="CarePlus Employee Discount">Employee / Family Courtesy (25%)</option>
                                                </select>
                                            </div>
                                            <div className="col-md-6 text-end">
                                                <div className="small text-muted mb-1">Subtotal: <strong>₱{formSubtotal.toLocaleString()}</strong></div>
                                                {formDiscountAmount > 0 && (
                                                    <div className="small text-success mb-1">
                                                        Discount ({invoiceForm.discountPercentage}%): <strong>-₱{formDiscountAmount.toLocaleString()}</strong>
                                                    </div>
                                                )}
                                                <div className="fs-5 fw-bold text-primary">
                                                    Net Total Due: ₱{formTotal.toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer bg-light py-2">
                                    <button type="button" className="btn btn-secondary rounded-pill px-4" onClick={() => setActiveModal(null)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary rounded-pill px-4 fw-bold">Generate Invoice</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Process Payment */}
            {activeModal === 'pay' && selectedInvoice && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
                    <div className="modal-dialog modal-md modal-dialog-centered">
                        <div className="modal-content rounded-4 border-0 shadow">
                            <div className="modal-header bg-success text-white py-3">
                                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                                    <RiCoinsLine /> Collect Payment: {selectedInvoice.invoiceNumber}
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
                            </div>
                            <form onSubmit={handleProcessPayment}>
                                <div className="modal-body p-4">
                                    <div className="p-3 bg-light rounded-3 border mb-3">
                                        <div className="d-flex justify-content-between mb-1">
                                            <span className="text-muted small">Patient:</span>
                                            <strong className="text-dark">{selectedInvoice.patientName}</strong>
                                        </div>
                                        <div className="d-flex justify-content-between mb-1">
                                            <span className="text-muted small">Branch:</span>
                                            <span>{selectedInvoice.branch}</span>
                                        </div>
                                        <div className="d-flex justify-content-between border-top pt-2 mt-2">
                                            <span className="fw-semibold">Total Amount Due:</span>
                                            <span className="fs-5 fw-bold text-primary">
                                                ₱{((selectedInvoice.totalAmount || 0) - (selectedInvoice.amountPaid || 0)).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Payment Method *</label>
                                        <select
                                            className="form-select"
                                            value={paymentForm.paymentMethod}
                                            onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                                            required
                                        >
                                            <option value="Cash">Cash (Billing Counter)</option>
                                            <option value="Credit / Debit Card">Credit / Debit Card (POS)</option>
                                            <option value="GCash / Maya">GCash / Maya (QR Ph)</option>
                                            <option value="HMO / Insurance Guarantee">HMO / Corporate Insurance Guarantee</option>
                                        </select>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Amount Tendered / Paid (₱) *</label>
                                        <input
                                            type="number"
                                            className="form-control form-control-lg fw-bold text-success text-end"
                                            value={paymentForm.amountTendered}
                                            onChange={(e) => setPaymentForm(prev => ({ ...prev, amountTendered: Number(e.target.value) }))}
                                            min="1"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="form-label small fw-semibold">Transaction Reference / Approval Code</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. Card Trace No / GCash Ref No / Letter of Authority"
                                            value={paymentForm.referenceNo}
                                            onChange={(e) => setPaymentForm(prev => ({ ...prev, referenceNo: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                <div className="modal-footer bg-light py-2">
                                    <button type="button" className="btn btn-secondary rounded-pill px-4" onClick={() => setActiveModal(null)}>Cancel</button>
                                    <button type="submit" className="btn btn-success rounded-pill px-4 fw-bold">Confirm & Print Official Receipt</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Official Receipt (OR) View */}
            {activeModal === 'receipt' && selectedInvoice && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1050 }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content rounded-4 border-0 shadow-lg">
                            <div className="modal-header border-bottom py-3 bg-light">
                                <h5 className="modal-title fw-bold text-dark">
                                    CarePlus Official Billing Statement & Payment Receipt
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
                            </div>
                            <div className="modal-body p-4 bg-white" id="printable-receipt">
                                {/* Header */}
                                <div className="text-center border-bottom pb-3 mb-3">
                                    <h4 className="fw-bold mb-0 text-primary">CarePlus Clinic Management System</h4>
                                    <div className="fw-semibold text-secondary small">{selectedInvoice.branch}</div>
                                    <div className="text-muted small">Official Clinical Billing Statement & Cashier Receipt</div>
                                    <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 mt-1">
                                        VAT-Exempt Healthcare Services
                                    </span>
                                </div>

                                <div className="row g-2 mb-3 p-3 bg-light rounded-3 border small">
                                    <div className="col-6 col-md-3">
                                        <span className="text-muted">Invoice No:</span>
                                        <div className="fw-bold text-dark">{selectedInvoice.invoiceNumber}</div>
                                    </div>
                                    <div className="col-6 col-md-3">
                                        <span className="text-muted">Official Receipt (OR):</span>
                                        <div className="fw-bold text-success">{selectedInvoice.receiptNumber || 'PENDING'}</div>
                                    </div>
                                    <div className="col-6 col-md-3">
                                        <span className="text-muted">Date:</span>
                                        <div className="fw-bold text-dark">{selectedInvoice.date}</div>
                                    </div>
                                    <div className="col-6 col-md-3">
                                        <span className="text-muted">Payment Status:</span>
                                        <div className="fw-bold text-primary">{selectedInvoice.paymentStatus}</div>
                                    </div>
                                    <div className="col-6 col-md-6">
                                        <span className="text-muted">Billed To (Patient):</span>
                                        <div className="fw-bold text-dark">{selectedInvoice.patientName}</div>
                                        <div className="text-muted">{selectedInvoice.patientEmail}</div>
                                    </div>
                                    <div className="col-6 col-md-6">
                                        <span className="text-muted">Payment Method:</span>
                                        <div className="fw-semibold text-dark">{selectedInvoice.paymentMethod || 'Pending Counter Checkout'}</div>
                                    </div>
                                </div>

                                {/* Items Breakdown */}
                                <div className="table-responsive mb-3">
                                    <table className="table table-bordered">
                                        <thead className="table-light small">
                                            <tr>
                                                <th>Item Description</th>
                                                <th>Category</th>
                                                <th className="text-end">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedInvoice.items && selectedInvoice.items.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td className="fw-semibold text-dark">{item.description}</td>
                                                    <td className="small text-muted">{item.category}</td>
                                                    <td className="text-end fw-bold">₱{Number(item.amount).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="table-light">
                                            <tr>
                                                <td colSpan="2" className="text-end fw-semibold">Subtotal:</td>
                                                <td className="text-end fw-bold">₱{(selectedInvoice.subtotal || selectedInvoice.totalAmount).toLocaleString()}</td>
                                            </tr>
                                            {selectedInvoice.discountAmount > 0 && (
                                                <tr className="text-success">
                                                    <td colSpan="2" className="text-end small">
                                                        Less: {selectedInvoice.discountType}
                                                    </td>
                                                    <td className="text-end fw-bold">-₱{selectedInvoice.discountAmount.toLocaleString()}</td>
                                                </tr>
                                            )}
                                            <tr className="fs-6">
                                                <td colSpan="2" className="text-end fw-bold text-primary">Final Net Amount Due:</td>
                                                <td className="text-end fw-bold text-primary">₱{(selectedInvoice.totalAmount || 0).toLocaleString()}</td>
                                            </tr>
                                            <tr className="bg-success bg-opacity-10">
                                                <td colSpan="2" className="text-end fw-bold text-success">Total Amount Paid:</td>
                                                <td className="text-end fw-bold text-success">₱{(selectedInvoice.amountPaid || 0).toLocaleString()}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                <div className="d-flex justify-content-between align-items-end mt-4 pt-3 border-top small">
                                    <div>
                                        <div className="text-muted">Prepared By: <strong>{selectedInvoice.cashier || 'Cashier Desk'}</strong></div>
                                        <div className="text-muted">System Stamp: CarePlus Central Financial System (Valid Receipt)</div>
                                    </div>
                                    <div className="text-center" style={{ width: '200px' }}>
                                        <div className="border-bottom pb-1 fw-bold">{selectedInvoice.cashier || 'Authorized Cashier'}</div>
                                        <div className="text-muted">Authorized Signature</div>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer bg-light py-2">
                                <button type="button" className="btn btn-outline-secondary rounded-pill px-4" onClick={() => setActiveModal(null)}>Close</button>
                                <button type="button" className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm d-flex align-items-center gap-2" onClick={() => window.print()}>
                                    <RiPrinterLine /> Print Official Statement
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BillingManagement;
