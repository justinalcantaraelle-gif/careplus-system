import { readDatabase, readSession } from '../../utils/storage';
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    RiArrowLeftLine, RiPrinterLine, RiCalendarLine,
    RiCheckDoubleLine, RiSearchLine, RiCloseLine, RiDownloadLine
} from 'react-icons/ri';
import Swal from 'sweetalert2';
import { sortAppointmentsBySchedule } from '../../utils/appointmentSort';
import { addAuditLog } from '../../services/auditLogger';
import { exportHtmlToPdf } from '../../utils/pdfExport';

const ReportsDashboard = () => {
    const navigate = useNavigate();

    const colors = {
        gold: '#D8B03B',
        goldDark: '#B48A18',
        goldLight: '#FDF7E7',
        beige: '#F8F7F2',
        textDark: '#333'
    };

    const session = readSession() || {};
    const rolePath = session?.role?.toLowerCase() === 'admin' ? '/admin' : '/staff';

    const toDateInputValue = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const [fromDate, setFromDate] = useState(() => {
        const today = new Date();
        return toDateInputValue(today);
    });
    const [toDate, setToDate] = useState(() => {
        const today = new Date();
        return toDateInputValue(today);
    });
    const [appointments, setAppointments] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const handleFromDateChange = (newFrom) => {
        setFromDate(newFrom);
        if (newFrom > toDate) {
            setToDate(newFrom);
        }
    };

    const handleToDateChange = (newTo) => {
        if (newTo < fromDate) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'info',
                title: '"To" date cannot be before "From" date',
                showConfirmButton: false,
                timer: 2000
            });
            setToDate(fromDate);
        } else {
            setToDate(newTo);
        }
    };

    useEffect(() => {
        const loadAppointments = () => {
            const db = readDatabase() || { appointments: [] };
            const allAppts = [...(db.appointments || [])];
            const filteredData = sortAppointmentsBySchedule(allAppts.filter(appt => {
                if (!appt.date) return false;
                return appt.date >= fromDate && appt.date <= toDate;
            }));
            setAppointments(filteredData);
        };

        loadAppointments();

        window.addEventListener('storage', loadAppointments);
        window.addEventListener('doc_dental_db_updated', loadAppointments);
        return () => {
            window.removeEventListener('storage', loadAppointments);
            window.removeEventListener('doc_dental_db_updated', loadAppointments);
        };
    }, [fromDate, toDate]);

    const summary = useMemo(() => {
        return appointments.reduce((acc, curr) => {
            acc.total++;
            if (curr.status === 'Completed' || curr.status === 'Done') acc.done++;
            return acc;
        }, { total: 0, done: 0 });
    }, [appointments]);

    const searchedAppointments = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        if (!query) return appointments;

        return appointments.filter((appt) => {
            const name = String(appt.patientName || appt.fullName || appt.name || '').toLowerCase();
            const service = String(appt.service || appt.treatment || '').toLowerCase();
            const status = String(appt.status || '').toLowerCase();
            const date = String(appt.date || '').toLowerCase();

            return name.includes(query) ||
                   service.includes(query) ||
                   status.includes(query) ||
                   date.includes(query);
        });
    }, [appointments, searchTerm]);

    const generateReportHtml = () => {
        const rowsHtml = searchedAppointments.map(appt => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-size: 12px; font-weight: 600;">${appt.date || ''} | ${appt.time || ''}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-size: 12px; font-weight: bold; color: #111827;">${appt.patientName || appt.fullName || appt.name || 'Patient'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-size: 12px; color: #4b5563;">${appt.service || appt.treatment || 'General Consultation'}</td>
                <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 11px; text-align: center;">${(appt.status === 'Done' || appt.status === 'Completed') ? '<span style="color: #059669; font-weight: bold;">Completed</span>' : '<span style="color: #64748b;">Pending</span>'}</td>
                <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">
                    <span style="padding: 3px 8px; border-radius: 4px; background: ${(appt.status === 'Done' || appt.status === 'Completed') ? '#dcfce7; color: #166534;' : appt.status === 'Approved' ? '#e0f2fe; color: #0369a1;' : appt.status === 'Cancelled' ? '#fee2e2; color: #991b1b;' : '#fef3c7; color: #92400e;'}; font-size: 10px; font-weight: bold;">${(appt.status || 'PENDING').toUpperCase()}</span>
                </td>
            </tr>
        `).join('');

        const completionRate = summary.total > 0 ? ((summary.done / summary.total) * 100).toFixed(1) : '0.0';
        const pendingCount = Math.max(0, summary.total - summary.done);

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>CarePlus Clinic - Clinical Performance &amp; Operations Report</title>
                <style>
                    @page { size: A4 landscape; margin: 12mm 15mm; }
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 20px; color: #0f172a; line-height: 1.4; background: #ffffff; font-size: 12px; }
                    .rpt-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
                    .rpt-table th, .rpt-table td { border: 1px solid #94a3b8; padding: 6px 10px; vertical-align: middle; }
                    .rpt-table th { background-color: #f1f5f9; color: #334155; font-size: 11px; text-transform: uppercase; font-weight: bold; }
                    @media print {
                        body { margin: 0; }
                        .rpt-table th { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background-color: #f1f5f9 !important; }
                    }
                </style>
            </head>
            <body>
                <!-- Header Table -->
                <table class="rpt-table">
                    <tbody>
                        <tr>
                            <td style="width: 65%;">
                                <div style="font-size: 20px; font-weight: 800; color: #0369a1; letter-spacing: 0.5px;">CAREPLUS CLINIC MANAGEMENT SYSTEM</div>
                                <div style="font-weight: 600; color: #475569; font-size: 13px;">Clinical Operations &amp; Appointment Performance Analytics</div>
                                <div style="font-size: 11px; color: #64748b;">Integrated Multi-Branch Healthcare Network • Performance &amp; Audit Trail</div>
                            </td>
                            <td style="width: 35%; background: #f8fafc; font-size: 11px;">
                                <div><strong>Reporting Period:</strong> ${fromDate} to ${toDate}</div>
                                <div><strong>Generated By:</strong> ${session.fullName || session.name || 'Authorized Clinical Staff'}</div>
                                <div><strong>Generation Date:</strong> ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</div>
                                <div><strong>Classification:</strong> Official Operational Record</div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <!-- Executive Summary Table -->
                <div style="font-weight: bold; font-size: 11.5px; text-transform: uppercase; margin-bottom: 5px; color: #0369a1;">
                    Executive Summary &amp; Key Performance Indicators (KPI)
                </div>
                <table class="rpt-table" style="text-align: center;">
                    <thead>
                        <tr>
                            <th style="width: 25%;">Total Appointments</th>
                            <th style="width: 25%;">Completed Transactions</th>
                            <th style="width: 25%;">Pending / In-Progress</th>
                            <th style="width: 25%;">Clinical Completion Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="font-size: 16px; font-weight: bold;">
                            <td style="color: #0369a1;">${summary.total}</td>
                            <td style="color: #166534;">${summary.done}</td>
                            <td style="color: #d97706;">${pendingCount}</td>
                            <td style="color: #166534;">${completionRate}%</td>
                        </tr>
                    </tbody>
                </table>

                <!-- Detailed Records Table -->
                <div style="font-weight: bold; font-size: 11.5px; text-transform: uppercase; margin-bottom: 5px; color: #0369a1;">
                    Detailed Clinical Appointment &amp; Encounter Ledger (${searchedAppointments.length} Record${searchedAppointments.length === 1 ? '' : 's'})
                </div>
                <table class="rpt-table">
                    <thead>
                        <tr>
                            <th style="width: 18%;">Date &amp; Time</th>
                            <th style="width: 28%;">Patient Name &amp; Contact</th>
                            <th style="width: 26%;">Service / Treatment Category</th>
                            <th style="width: 14%; text-align: center;">Transaction Status</th>
                            <th style="width: 14%; text-align: center;">Clinical Attendance</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml || '<tr><td colspan="5" style="text-align:center; padding: 25px; color: #94a3b8;">No appointment records found for the selected reporting period.</td></tr>'}
                    </tbody>
                </table>

                <!-- Attestation Signatures Table -->
                <table class="rpt-table" style="margin-top: 25px; page-break-inside: avoid;">
                    <tbody>
                        <tr style="background: #f8fafc;">
                            <th style="width: 50%; text-align: center;">Prepared &amp; Verified By</th>
                            <th style="width: 50%; text-align: center;">Medical Director / Clinical Operations Endorsement</th>
                        </tr>
                        <tr>
                            <td style="height: 65px; vertical-align: bottom; text-align: center; padding-bottom: 8px;">
                                <div style="border-top: 1px solid #0f172a; width: 70%; margin: 0 auto;"></div>
                                <div style="font-weight: bold; font-size: 11.5px; margin-top: 4px;">${session.fullName || session.name || 'Authorized Staff'}</div>
                                <div style="font-size: 10px; color: #64748b;">Clinical Operations &amp; Records Officer</div>
                            </td>
                            <td style="height: 65px; vertical-align: bottom; text-align: center; padding-bottom: 8px;">
                                <div style="border-top: 1px solid #0f172a; width: 70%; margin: 0 auto;"></div>
                                <div style="font-weight: bold; font-size: 11.5px; margin-top: 4px;">Dr. Elena Cruz, MD / Medical Director</div>
                                <div style="font-size: 10px; color: #64748b;">CarePlus Multi-Branch Clinical Governance</div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </body>
            </html>
        `;
    };

    const handlePrint = () => {
        addAuditLog('Printed Performance Report', `Printed clinic performance report for period ${fromDate} to ${toDate}.`);
        const printHtml = generateReportHtml();

        const printWindow = window.open('', '_blank', 'width=950,height=750');
        if (printWindow) {
            printWindow.document.write(printHtml + '<script>window.onload = function() { window.print(); };</script>');
            printWindow.document.close();
        } else {
            let iframe = document.getElementById('printable_report_frame');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'printable_report_frame';
                iframe.style.position = 'fixed';
                iframe.style.right = '0';
                iframe.style.bottom = '0';
                iframe.style.width = '0';
                iframe.style.height = '0';
                iframe.style.border = '0';
                document.body.appendChild(iframe);
            }
            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(printHtml + '<script>window.onload = function() { window.print(); };</script>');
            doc.close();
            setTimeout(() => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            }, 300);
        }
    };

    const handleDownload = async () => {
        addAuditLog('Downloaded Performance Report', `Downloaded clinic performance report for period ${fromDate} to ${toDate}.`);
        const printHtml = generateReportHtml();
        const filename = `CarePlus_Clinic_Performance_Report_${fromDate}_to_${toDate}.pdf`;
        await exportHtmlToPdf(printHtml, filename, { orientation: 'landscape', width: '950px' });
    };

    return (
        <div className="report-container p-3 p-md-4 p-lg-5 animate__animated animate__fadeIn" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', width: '100%' }}>
            <style>{`
                @media print {
                    @page { size: A4 landscape; margin: 10mm; }
                    body { background-color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .d-print-none, nav, .sidebar, .navbar, header, footer, .doc-btn-toolbar, .doc-btn { display: none !important; }
                    .report-container {
                        position: static !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        background-color: white !important;
                    }
                    .card { border: 1px solid #cbd5e1 !important; box-shadow: none !important; }
                    .table { width: 100% !important; border-collapse: collapse !important; }
                    .table th, .table td { border: 1px solid #cbd5e1 !important; }
                }
            `}</style>

            {/* Print Header */}
            <div className="d-none d-print-block text-center mb-4 pb-3" style={{ borderBottom: '2px solid #0284c7' }}>
                <h2 className="fw-bold" style={{ color: '#0369a1', margin: '0 0 5px 0', fontSize: '26pt' }}>CAREPLUS CLINIC MANAGEMENT SYSTEM</h2>
                <h5 className="text-uppercase px-4 py-1 d-inline-block mt-1" style={{ backgroundColor: colors.goldLight, borderRadius: '5px', fontSize: '13pt' }}>
                    Report from {fromDate} to {toDate}
                </h5>
                <div className="d-flex justify-content-between mt-4 px-2" style={{ fontSize: '10pt' }}>
                    <span><strong>Issued By:</strong> {session.fullName || session.name || 'Authorized Personnel'}</span>
                    <span><strong>Date:</strong> {new Date().toLocaleDateString()}</span>
                </div>
            </div>

            {/* Screen Header */}
            <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3 mb-4 d-print-none">
                <div className="d-flex align-items-center">
                    <button
                        className="doc-btn doc-btn-neutral shadow-sm me-3"
                        style={{ width: '40px', height: '40px', padding: 0 }}
                        onClick={() => navigate(rolePath)}
                        title="Back to Dashboard"
                    >
                        <RiArrowLeftLine size={20} />
                    </button>
                    <div>
                        <h2 className="fw-bold mb-0" style={{ color: colors.goldDark }}>Report Analytics</h2>
                        <p className="text-muted small mb-0">Clinic Performance &amp; Schedule Overview</p>
                    </div>
                </div>
                <div className="doc-btn-toolbar">
                    <button
                        className="doc-btn doc-btn-neutral"
                        onClick={handlePrint}
                        title="Print Report"
                    >
                        <RiPrinterLine size={18} /> Print Report
                    </button>
                    <button
                        className="doc-btn doc-btn-gold-solid"
                        onClick={handleDownload}
                        title="Download Report as PDF"
                    >
                        <RiDownloadLine size={18} /> Download Report
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="row g-3 mb-4 d-print-none">
                <div className="col-12 col-sm-6 col-md-4">
                    <div className="card p-3 d-flex flex-row align-items-center gap-3 border-0 shadow-sm rounded-4 card-hover-lift">
                        <div className="p-3 rounded-3" style={{ backgroundColor: '#EBF4FF', color: '#2563EB' }}>
                            <RiCalendarLine size={24} />
                        </div>
                        <div>
                            <h6 className="mb-0 text-muted fw-bold small text-uppercase">Total Patients</h6>
                            <h3 className="fw-bold mb-0 text-dark">{summary.total}</h3>
                        </div>
                    </div>
                </div>
                <div className="col-12 col-sm-6 col-md-4">
                    <div className="card p-3 d-flex flex-row align-items-center gap-3 border-0 shadow-sm rounded-4 card-hover-lift">
                        <div className="p-3 rounded-3" style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
                            <RiCheckDoubleLine size={24} />
                        </div>
                        <div>
                            <h6 className="mb-0 text-muted fw-bold small text-uppercase">Completed Transactions</h6>
                            <h3 className="fw-bold mb-0 text-success">{summary.done}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter and Search Toolbar */}
            <div className="card border-0 shadow-sm p-3 mb-4 rounded-4 bg-white d-print-none">
                <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
                    <div className="d-flex flex-wrap align-items-center gap-2">
                        <span className="small fw-bold text-muted text-uppercase">Date Range:</span>
                        <div className="d-flex align-items-center gap-2">
                            <label className="small text-muted mb-0">From</label>
                            <input
                                type="date"
                                className="form-control form-control-sm"
                                style={{ width: '150px' }}
                                value={fromDate}
                                onChange={e => handleFromDateChange(e.target.value)}
                            />
                        </div>
                        <div className="d-flex align-items-center gap-2">
                            <label className="small text-muted mb-0">To</label>
                            <input
                                type="date"
                                className="form-control form-control-sm"
                                style={{ width: '150px' }}
                                value={toDate}
                                onChange={e => handleToDateChange(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="input-group" style={{ maxWidth: '340px' }}>
                        <span className="input-group-text bg-light border-0"><RiSearchLine className="text-muted" /></span>
                        <input
                            type="text"
                            className="form-control bg-light border-0 shadow-none"
                            placeholder="Search by patient, procedure..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                className="btn btn-light border-0"
                                type="button"
                                onClick={() => setSearchTerm('')}
                                title="Clear Search"
                            >
                                <RiCloseLine />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Records Table */}
            <div className="card border-0 shadow-sm overflow-hidden rounded-4 bg-white">
                <div className="table-responsive">
                    <table className="table table-hover mb-0 align-middle">
                        <thead className="bg-light">
                            <tr>
                                <th className="p-3 border-0 text-muted fw-bold small">Date &amp; Time</th>
                                <th className="border-0 text-muted fw-bold small">Patient Name</th>
                                <th className="border-0 text-muted fw-bold small">Treatment</th>
                                <th className="border-0 text-muted fw-bold small">Transaction Status</th>
                                <th className="border-0 text-muted fw-bold text-center small">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {searchedAppointments.length > 0 ? (
                                searchedAppointments.map((appt, index) => (
                                    <tr key={index}>
                                        <td className="p-3 fw-bold text-dark small">
                                            {appt.date} <span className="text-muted fw-normal">|</span> {appt.time}
                                        </td>
                                        <td className="fw-semibold text-dark small">{appt.patientName || appt.fullName || 'Patient'}</td>
                                        <td className="text-muted small">{appt.service || appt.treatment || 'General Consultation'}</td>
                                        <td className="small">
                                            {(appt.status === 'Done' || appt.status === 'Completed') ? (
                                                <span className="badge rounded-pill bg-success-subtle text-success px-2 py-1">Completed</span>
                                            ) : (
                                                <span className="badge rounded-pill bg-secondary-subtle text-secondary px-2 py-1">Pending</span>
                                            )}
                                        </td>
                                        <td className="text-center">
                                            <span className={`badge rounded-pill px-3 py-2 print-badge ${
                                                appt.status === 'Approved' ? 'badge-status-approved' :
                                                appt.status === 'Done' || appt.status === 'Completed' ? 'badge-status-completed' :
                                                appt.status === 'Cancelled' || appt.status === 'Declined' ? 'badge-status-cancelled' :
                                                'badge-status-pending'
                                            }`}>
                                                {appt.status || 'Pending'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="text-center py-5 text-muted small">
                                        {searchTerm ? (
                                            <div>
                                                <p className="mb-2 fw-medium">No appointments match "{searchTerm}".</p>
                                                <button className="doc-btn doc-btn-neutral doc-btn-sm" onClick={() => setSearchTerm('')}>Clear Search</button>
                                            </div>
                                        ) : (
                                            `No appointments found between ${fromDate} and ${toDate}.`
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
};

export default ReportsDashboard;
