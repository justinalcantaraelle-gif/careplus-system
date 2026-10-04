import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import {
    RiMoneyDollarCircleLine, RiAddLine, RiSearchLine, RiPrinterLine,
    RiFileTextLine, RiBuilding4Line, RiCheckDoubleLine, RiTimeLine,
    RiBankCardLine, RiCloseLine, RiCoinsLine, RiPercentLine, RiUserLine,
    RiQrCodeLine, RiSmartphoneLine, RiCheckLine, RiShieldCheckLine
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
    const [qrSimulated, setQrSimulated] = useState(false);

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
        setQrSimulated(false);
        setActiveModal('pay');
    };

    const handleSimulateQrPayment = () => {
        const mockTrace = `QRPH-BSP-${Math.floor(100000 + Math.random() * 900000)}`;
        setPaymentForm(prev => ({
            ...prev,
            referenceNo: mockTrace
        }));
        setQrSimulated(true);

        Swal.fire({
            icon: 'success',
            title: 'QR Ph Scan Detected!',
            html: `<div class="text-start small p-3 bg-light rounded border mt-2">
                     <div class="mb-1"><strong>Merchant:</strong> CarePlus Health Systems Inc.</div>
                     <div class="mb-1"><strong>Branch:</strong> ${selectedInvoice?.branch || 'Metro Branch'}</div>
                     <div class="mb-1"><strong>Terminal ID:</strong> <code>CP-QRPH-94021</code></div>
                     <div class="mb-1"><strong>Amount Received:</strong> ₱${Number(paymentForm.amountTendered || 0).toLocaleString()}</div>
                     <div class="mb-2"><strong>Gateway Trace No:</strong> <code class="text-primary fw-bold">${mockTrace}</code></div>
                     <div class="text-success fw-bold d-flex align-items-center gap-1">
                       <span>✓</span> National QR Ph authorization confirmed via customer mobile wallet.
                     </div>
                   </div>`,
            timer: 2400,
            showConfirmButton: false
        });
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
        <div className="container-fluid p-3 p-md-4">
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
            {activeModal === 'create' && createPortal(
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 9999 }}>
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
                </div>,
                document.body
            )}

            {/* Modal: Process Payment */}
            {activeModal === 'pay' && selectedInvoice && createPortal(
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 9999 }}>
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
                                            className="form-select fw-semibold"
                                            value={paymentForm.paymentMethod}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setPaymentForm(prev => ({
                                                    ...prev,
                                                    paymentMethod: val,
                                                    referenceNo: val.includes('QR') && !prev.referenceNo ? `QRPH-${Math.floor(100000 + Math.random() * 900000)}` : prev.referenceNo
                                                }));
                                            }}
                                            required
                                        >
                                            <option value="Cash">💵 Cash (Billing Counter)</option>
                                            <option value="QR Ph">📱 QR Ph (GCash, Maya, ShopeePay, Mobile Banks)</option>
                                            <option value="Credit / Debit Card">💳 Credit / Debit Card (POS Terminal)</option>
                                            <option value="HMO / Insurance Guarantee">🏥 HMO / Corporate Insurance Guarantee</option>
                                        </select>
                                    </div>

                                    {/* DECOY QR PH CODE SECTION */}
                                    {(paymentForm.paymentMethod === 'QR Ph' || paymentForm.paymentMethod.includes('QR')) && (
                                        <div className="p-3 mb-3 rounded-4 border bg-white shadow-sm text-center animate__animated animate__fadeIn">
                                            {/* Official QR Ph Banner */}
                                            <div 
                                                className="d-flex align-items-center justify-content-between p-2 px-3 rounded-3 mb-3 text-white shadow-sm"
                                                style={{ background: 'linear-gradient(135deg, #0284c7 0%, #1e40af 50%, #b91c1c 100%)' }}
                                            >
                                                <div className="d-flex align-items-center gap-2 text-start">
                                                    <div className="bg-white text-primary p-1 px-2 rounded-2 fw-black" style={{ fontSize: '12px', fontWeight: '900', letterSpacing: '0.5px' }}>
                                                        QR Ph
                                                    </div>
                                                    <div>
                                                        <div className="fw-bold small mb-0 lh-1">National QR Code Standard</div>
                                                        <div className="text-white-50" style={{ fontSize: '10px' }}>BSP Circular No. 1055 Compliant</div>
                                                    </div>
                                                </div>
                                                <span className="badge bg-warning text-dark font-monospace fw-bold" style={{ fontSize: '10px' }}>
                                                    DECOY MERCHANT
                                                </span>
                                            </div>

                                            {/* Decoy QR Code Matrix SVG */}
                                            <div className="p-3 bg-light rounded-4 d-inline-block border mb-2 position-relative shadow-sm" style={{ width: '220px' }}>
                                                <svg width="180" height="180" viewBox="0 0 180 180" className="mx-auto" style={{ display: 'block' }}>
                                                    {/* Background */}
                                                    <rect width="180" height="180" fill="#ffffff" rx="10" />
                                                    
                                                    {/* Top-Left Finder */}
                                                    <rect x="15" y="15" width="40" height="40" fill="#0f172a" rx="4" />
                                                    <rect x="21" y="21" width="28" height="28" fill="#ffffff" rx="2" />
                                                    <rect x="27" y="27" width="16" height="16" fill="#0284c7" rx="2" />

                                                    {/* Top-Right Finder */}
                                                    <rect x="125" y="15" width="40" height="40" fill="#0f172a" rx="4" />
                                                    <rect x="131" y="21" width="28" height="28" fill="#ffffff" rx="2" />
                                                    <rect x="137" y="27" width="16" height="16" fill="#0284c7" rx="2" />

                                                    {/* Bottom-Left Finder */}
                                                    <rect x="15" y="125" width="40" height="40" fill="#0f172a" rx="4" />
                                                    <rect x="21" y="131" width="28" height="28" fill="#ffffff" rx="2" />
                                                    <rect x="27" y="137" width="16" height="16" fill="#0284c7" rx="2" />

                                                    {/* Alignment Pattern */}
                                                    <rect x="125" y="125" width="24" height="24" fill="#0f172a" rx="3" />
                                                    <rect x="129" y="129" width="16" height="16" fill="#ffffff" rx="1" />
                                                    <rect x="133" y="133" width="8" height="8" fill="#dc2626" rx="1" />

                                                    {/* Timing Pattern Lines */}
                                                    <line x1="60" y1="35" x2="120" y2="35" stroke="#334155" strokeWidth="4" strokeDasharray="5,5" />
                                                    <line x1="35" y1="60" x2="35" y2="120" stroke="#334155" strokeWidth="4" strokeDasharray="5,5" />

                                                    {/* Dense Matrix Modules */}
                                                    <rect x="65" y="18" width="6" height="6" fill="#0f172a" />
                                                    <rect x="75" y="18" width="6" height="6" fill="#0f172a" />
                                                    <rect x="85" y="18" width="6" height="6" fill="#0f172a" />
                                                    <rect x="105" y="18" width="6" height="6" fill="#0f172a" />
                                                    <rect x="65" y="28" width="6" height="6" fill="#0f172a" />
                                                    <rect x="95" y="28" width="6" height="6" fill="#0f172a" />
                                                    <rect x="115" y="28" width="6" height="6" fill="#0f172a" />
                                                    
                                                    <rect x="60" y="45" width="6" height="6" fill="#0f172a" />
                                                    <rect x="72" y="45" width="6" height="6" fill="#0f172a" />
                                                    <rect x="84" y="45" width="6" height="6" fill="#0f172a" />
                                                    <rect x="96" y="45" width="6" height="6" fill="#0f172a" />
                                                    <rect x="110" y="45" width="6" height="6" fill="#0f172a" />
                                                    <rect x="130" y="60" width="6" height="6" fill="#0f172a" />
                                                    <rect x="145" y="60" width="6" height="6" fill="#0f172a" />
                                                    <rect x="160" y="60" width="6" height="6" fill="#0f172a" />

                                                    <rect x="18" y="65" width="6" height="6" fill="#0f172a" />
                                                    <rect x="18" y="80" width="6" height="6" fill="#0f172a" />
                                                    <rect x="18" y="95" width="6" height="6" fill="#0f172a" />
                                                    <rect x="18" y="110" width="6" height="6" fill="#0f172a" />
                                                    
                                                    <rect x="45" y="70" width="6" height="6" fill="#0f172a" />
                                                    <rect x="55" y="85" width="6" height="6" fill="#0f172a" />
                                                    <rect x="45" y="100" width="6" height="6" fill="#0f172a" />
                                                    
                                                    <rect x="120" y="75" width="6" height="6" fill="#0f172a" />
                                                    <rect x="135" y="75" width="6" height="6" fill="#0f172a" />
                                                    <rect x="150" y="75" width="6" height="6" fill="#0f172a" />
                                                    <rect x="125" y="90" width="6" height="6" fill="#0f172a" />
                                                    <rect x="140" y="90" width="6" height="6" fill="#0f172a" />
                                                    <rect x="155" y="90" width="6" height="6" fill="#0f172a" />

                                                    <rect x="65" y="125" width="6" height="6" fill="#0f172a" />
                                                    <rect x="80" y="125" width="6" height="6" fill="#0f172a" />
                                                    <rect x="95" y="125" width="6" height="6" fill="#0f172a" />
                                                    <rect x="110" y="125" width="6" height="6" fill="#0f172a" />
                                                    <rect x="70" y="140" width="6" height="6" fill="#0f172a" />
                                                    <rect x="85" y="140" width="6" height="6" fill="#0f172a" />
                                                    <rect x="100" y="140" width="6" height="6" fill="#0f172a" />
                                                    <rect x="65" y="155" width="6" height="6" fill="#0f172a" />
                                                    <rect x="80" y="155" width="6" height="6" fill="#0f172a" />
                                                    <rect x="95" y="155" width="6" height="6" fill="#0f172a" />
                                                    <rect x="110" y="155" width="6" height="6" fill="#0f172a" />
                                                    <rect x="155" y="130" width="6" height="6" fill="#0f172a" />
                                                    <rect x="155" y="145" width="6" height="6" fill="#0f172a" />
                                                    <rect x="155" y="160" width="6" height="6" fill="#0f172a" />

                                                    {/* Central Official QR Ph Emblem Badge */}
                                                    <rect x="66" y="66" width="48" height="48" fill="#ffffff" rx="8" stroke="#cbd5e1" strokeWidth="2" />
                                                    <rect x="70" y="70" width="40" height="40" fill="#0284c7" rx="6" />
                                                    <text x="90" y="86" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">QR</text>
                                                    <text x="90" y="99" fill="#fde047" fontSize="10" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">Ph</text>
                                                    <rect x="82" y="102" width="16" height="2" fill="#ef4444" rx="1" />
                                                </svg>

                                                <div className="small fw-bold text-dark mt-2 mb-0">
                                                    CarePlus Healthcare
                                                </div>
                                                <div className="text-muted" style={{ fontSize: '11px' }}>
                                                    {selectedInvoice.branch || 'CarePlus Metro Branch'}
                                                </div>
                                                <div className="text-muted font-monospace" style={{ fontSize: '10px' }}>
                                                    MID: CP-QRPH-94021
                                                </div>
                                            </div>

                                            {/* Dynamic Payable Badge */}
                                            <div className="p-2 px-3 bg-success bg-opacity-10 border border-success border-opacity-25 rounded-3 mb-2 d-flex justify-content-between align-items-center">
                                                <span className="small text-muted fw-semibold">Payable via QR:</span>
                                                <span className="fs-5 fw-bold text-success font-monospace">
                                                    ₱{Number(paymentForm.amountTendered || selectedInvoice.totalAmount || 0).toLocaleString()}
                                                </span>
                                            </div>

                                            {/* Supported Mobile Banking Apps */}
                                            <div className="small text-muted mb-1" style={{ fontSize: '11px' }}>
                                                Scan using GCash, Maya, ShopeePay, GoTyme, BPI, BDO Pay or any bank:
                                            </div>
                                            <div className="d-flex flex-wrap justify-content-center gap-1 mb-3">
                                                {['GCash', 'Maya', 'GoTyme', 'BDO Pay', 'BPI Mobile', 'UnionBank', 'ShopeePay'].map(app => (
                                                    <span key={app} className="badge bg-light text-secondary border px-2 py-1" style={{ fontSize: '10px' }}>
                                                        {app}
                                                    </span>
                                                ))}
                                            </div>

                                            {/* Simulation Action Box */}
                                            <div className="p-2 px-3 bg-light rounded-3 border d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2 text-start">
                                                <div>
                                                    <div className="small fw-semibold text-dark d-flex align-items-center gap-1">
                                                        <span className={`spinner-grow spinner-grow-sm ${qrSimulated ? 'text-success' : 'text-warning'}`} role="status" style={{ width: '8px', height: '8px' }}></span>
                                                        <span>{qrSimulated ? 'Payment Verified by QR Ph Gateway' : 'Decoy Standby: Ready for Scan'}</span>
                                                    </div>
                                                    <div className="text-muted" style={{ fontSize: '11px' }}>
                                                        {qrSimulated ? `Trace Code: ${paymentForm.referenceNo}` : 'Click simulate below to autofill mock e-wallet reference'}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleSimulateQrPayment}
                                                    className="btn btn-sm btn-outline-success rounded-pill px-3 fw-semibold text-nowrap shadow-sm"
                                                >
                                                    ⚡ Simulate Patient Scanned &amp; Paid
                                                </button>
                                            </div>
                                        </div>
                                    )}

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
                </div>,
                document.body
            )}

            {/* Modal: Official Receipt (OR) View */}
            {activeModal === 'receipt' && selectedInvoice && createPortal(
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 9999 }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content rounded-4 border-0 shadow-lg">
                            <div className="modal-header border-bottom py-3 bg-light no-print">
                                <h5 className="modal-title fw-bold text-dark">
                                    CarePlus Official Billing Statement &amp; Payment Receipt
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
                            </div>
                            <div className="modal-body p-4 bg-white" id="printable-receipt">
                                {/* Facility Header Table */}
                                <table className="table table-bordered mb-3 billing-print-table" style={{ borderColor: '#cbd5e1' }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ width: '65%', verticalAlign: 'middle' }}>
                                                <div className="fw-bold fs-5 text-primary" style={{ letterSpacing: '0.5px' }}>
                                                    CAREPLUS CLINIC MANAGEMENT SYSTEM
                                                </div>
                                                <div className="fw-semibold text-secondary small">
                                                    {selectedInvoice.branch || 'CarePlus Multi-Branch Clinical Network'}
                                                </div>
                                                <div className="text-muted small" style={{ fontSize: '11px' }}>
                                                    Hospital &amp; Ambulatory Care Accounts • VAT-Exempt Healthcare Services
                                                </div>
                                            </td>
                                            <td style={{ width: '35%', verticalAlign: 'middle', fontSize: '11px', background: '#f8fafc' }}>
                                                <div><strong>Invoice No:</strong> {selectedInvoice.invoiceNumber}</div>
                                                <div><strong>Official Receipt (OR):</strong> <span className="fw-bold text-success">{selectedInvoice.receiptNumber || 'OR-PENDING'}</span></div>
                                                <div><strong>Billing Date:</strong> {selectedInvoice.date}</div>
                                                <div><strong>Status:</strong> <span className="fw-bold text-uppercase">{selectedInvoice.paymentStatus}</span></div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* Section 1: Patient & Billing Demographics Table */}
                                <div className="mb-3">
                                    <div className="fw-bold text-dark small text-uppercase mb-1">
                                        Section 1: Patient Account &amp; Transaction Particulars
                                    </div>
                                    <table className="table table-bordered table-sm mb-0 billing-print-table" style={{ borderColor: '#cbd5e1', fontSize: '12px' }}>
                                        <tbody>
                                            <tr>
                                                <th style={{ width: '20%', background: '#f1f5f9', color: '#334155' }}>Billed To (Patient)</th>
                                                <td style={{ width: '30%', fontWeight: 'bold' }}>{selectedInvoice.patientName}</td>
                                                <th style={{ width: '20%', background: '#f1f5f9', color: '#334155' }}>Patient Email</th>
                                                <td style={{ width: '30%' }}>{selectedInvoice.patientEmail}</td>
                                            </tr>
                                            <tr>
                                                <th style={{ background: '#f1f5f9', color: '#334155' }}>Facility Location</th>
                                                <td>{selectedInvoice.branch}</td>
                                                <th style={{ background: '#f1f5f9', color: '#334155' }}>Payment Method</th>
                                                <td className="fw-semibold">
                                                    {selectedInvoice.paymentMethod || 'Counter Cash/Card'}
                                                    {selectedInvoice.paymentMethod?.includes('QR') && (
                                                        <span className="badge bg-primary bg-opacity-10 text-primary ms-2 small">
                                                            ✓ QR Ph Verified
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Section 2: Itemized Statement of Services Table */}
                                <div className="mb-3">
                                    <div className="fw-bold text-dark small text-uppercase mb-1">
                                        Section 2: Itemized Clinical Services, Laboratory &amp; Pharmacy
                                    </div>
                                    <table className="table table-bordered table-sm mb-0 billing-print-table" style={{ borderColor: '#cbd5e1', fontSize: '11.5px' }}>
                                        <thead style={{ background: '#f1f5f9' }}>
                                            <tr>
                                                <th style={{ width: '6%', textAlign: 'center' }}>#</th>
                                                <th style={{ width: '48%' }}>Item / Clinical Service Description</th>
                                                <th style={{ width: '26%' }}>Department / Category</th>
                                                <th style={{ width: '20%', textAlign: 'end' }}>Amount (₱)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedInvoice.items && selectedInvoice.items.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td className="text-center fw-bold">{idx + 1}</td>
                                                    <td className="fw-semibold text-dark">{item.description}</td>
                                                    <td className="text-muted small">{item.category}</td>
                                                    <td className="text-end fw-bold">₱{Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Section 3: Financial Settlement & Totals Table */}
                                <div className="mb-3">
                                    <div className="fw-bold text-dark small text-uppercase mb-1">
                                        Section 3: Summary of Charges &amp; Settlement
                                    </div>
                                    <table className="table table-bordered table-sm mb-0 billing-print-table" style={{ borderColor: '#cbd5e1', fontSize: '12px' }}>
                                        <tbody>
                                            <tr>
                                                <td style={{ width: '70%', textAlign: 'end', background: '#f8fafc', fontWeight: '600' }}>Gross Subtotal:</td>
                                                <td style={{ width: '30%', textAlign: 'end', fontWeight: 'bold' }}>
                                                    ₱{(selectedInvoice.subtotal || selectedInvoice.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                            {selectedInvoice.discountAmount > 0 && (
                                                <tr className="text-success">
                                                    <td style={{ textAlign: 'end', background: '#f8fafc', fontWeight: '600' }}>
                                                        Applied Discount ({selectedInvoice.discountType || 'Mandatory PWD/Senior'}):
                                                    </td>
                                                    <td style={{ textAlign: 'end', fontWeight: 'bold' }}>
                                                        -₱{selectedInvoice.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            )}
                                            <tr style={{ background: '#eff6ff' }}>
                                                <td style={{ textAlign: 'end', fontWeight: 'bold', color: '#1e40af' }}>Final Net Amount Due:</td>
                                                <td style={{ textAlign: 'end', fontWeight: 'bold', color: '#1e40af', fontSize: '13px' }}>
                                                    ₱{(selectedInvoice.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                            <tr style={{ background: '#f0fdf4' }}>
                                                <td style={{ textAlign: 'end', fontWeight: 'bold', color: '#166534' }}>Total Amount Paid / Settled:</td>
                                                <td style={{ textAlign: 'end', fontWeight: 'bold', color: '#166534', fontSize: '13px' }}>
                                                    ₱{(selectedInvoice.amountPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style={{ textAlign: 'end', background: '#f8fafc', fontWeight: '600' }}>Balance Outstanding:</td>
                                                <td style={{ textAlign: 'end', fontWeight: 'bold' }}>
                                                    ₱{Math.max(0, (selectedInvoice.totalAmount || 0) - (selectedInvoice.amountPaid || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Section 4: Dual Verification & Signatures Table */}
                                <div className="mt-4 pt-1">
                                    <table className="table table-bordered mb-0 billing-print-table" style={{ borderColor: '#cbd5e1' }}>
                                        <tbody>
                                            <tr style={{ background: '#f8fafc' }}>
                                                <th style={{ width: '50%', textAlign: 'center' }}>Patient / Payor Acknowledgment</th>
                                                <th style={{ width: '50%', textAlign: 'center' }}>Authorized Cashier / Finance Desk</th>
                                            </tr>
                                            <tr>
                                                <td style={{ height: '75px', verticalAlign: 'bottom', textAlign: 'center', paddingBottom: '8px' }}>
                                                    <div className="border-top border-dark mx-auto" style={{ width: '75%' }}></div>
                                                    <div className="fw-bold text-dark small mt-1">{selectedInvoice.patientName}</div>
                                                    <div className="text-muted small" style={{ fontSize: '10px' }}>Patient / Payor Signature</div>
                                                </td>
                                                <td style={{ height: '75px', verticalAlign: 'bottom', textAlign: 'center', paddingBottom: '8px' }}>
                                                    <div className="border-top border-dark mx-auto" style={{ width: '75%' }}></div>
                                                    <div className="fw-bold text-dark small mt-1">{selectedInvoice.cashier || 'Authorized Cashier'}</div>
                                                    <div className="text-muted small" style={{ fontSize: '10px' }}>
                                                        CarePlus Cashier Desk • Valid Clinical Official Receipt
                                                    </div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="modal-footer bg-light py-2 no-print">
                                <button type="button" className="btn btn-outline-secondary rounded-pill px-4" onClick={() => setActiveModal(null)}>Close</button>
                                <button type="button" className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm d-flex align-items-center gap-2" onClick={() => window.print()}>
                                    <RiPrinterLine /> Print Official Statement
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
                    .no-print, nav, .sidebar, .app-sidebar, .navbar, .app-navbar, header, footer, .modal-backdrop, .modal-header, .modal-footer, .btn {
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
                    #printable-receipt {
                        width: 100% !important;
                        max-width: 100% !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .billing-print-table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        page-break-inside: avoid !important;
                        margin-bottom: 8px !important;
                    }
                    .billing-print-table th,
                    .billing-print-table td {
                        border: 1px solid #94a3b8 !important;
                        padding: 4px 8px !important;
                        color: #0f172a !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .billing-print-table th {
                        background-color: #f1f5f9 !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default BillingManagement;
