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
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-size: 12px; text-align: center;">${(appt.status === 'Done' || appt.status === 'Completed') ? '<span style="color: #059669; font-weight: 600;">Completed</span>' : '<span style="color: #6b7280;">Pending</span>'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">
                    <span style="padding: 4px 10px; border-radius: 9999px; background: ${(appt.status === 'Done' || appt.status === 'Completed') ? '#D1FAE5' : appt.status === 'Approved' ? '#D4EFDF' : appt.status === 'Cancelled' ? '#FADBD8' : '#FEF3C7'}; font-size: 10px; font-weight: bold; color: #111827;">${(appt.status || '').toUpperCase()}</span>
                </td>
            </tr>
        `).join('');

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Doc Dental Clinic - Performance Report</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 30px; color: #1f2937; line-height: 1.5; background: #ffffff; }
                    .header { text-align: center; border-bottom: 2px solid #D8B03B; padding-bottom: 15px; margin-bottom: 20px; }
                    .header h1 { color: #B48A18; margin: 0 0 5px 0; font-size: 26px; font-weight: 800; letter-spacing: 1px; }
                    .header .period { background-color: #FDF7E7; display: inline-block; padding: 6px 18px; border-radius: 6px; font-size: 13px; font-weight: 600; color: #854d0e; margin-top: 8px; }
                    .meta { display: flex; justify-content: space-between; font-size: 11px; color: #4b5563; margin-top: 15px; border-top: 1px solid #f3f4f6; padding-top: 10px; }
                    .summary-grid { display: flex; gap: 15px; margin: 20px 0; }
                    .summary-card { flex: 1; padding: 12px 18px; background: #f9fafb; border-radius: 10px; border: 1px solid #e5e7eb; }
                    .summary-card .label { font-size: 10px; text-transform: uppercase; color: #6b7280; font-weight: bold; margin-bottom: 4px; }
                    .summary-card .val { font-size: 22px; font-weight: 800; color: #111827; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th { background-color: #f9fafb; text-align: left; padding: 10px; font-size: 10px; text-transform: uppercase; color: #6b7280; font-weight: bold; border-bottom: 1.5px solid #e5e7eb; }
                    @media print {
                        body { margin: 15px; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>DOC DENTAL CLINIC</h1>
                    <div class="period">Clinical Report: ${fromDate} to ${toDate}</div>
                    <div class="meta">
                        <span><strong>Issued By:</strong> ${session.fullName || session.name || 'Authorized Personnel'}</span>
                        <span><strong>Generated Date:</strong> ${new Date().toLocaleDateString()}</span>
                    </div>
                </div>

                <div class="summary-grid">
                    <div class="summary-card">
                        <div class="label">Total Appointments</div>
                        <div class="val">${summary.total}</div>
                    </div>
                    <div class="summary-card">
                        <div class="label">Completed Transactions</div>
                        <div class="val">${summary.done}</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Date & Time</th>
                            <th>Patient Name</th>
                            <th>Treatment</th>
                            <th style="text-align: center;">Completed Transaction</th>
                            <th style="text-align: center;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml || '<tr><td colSpan="5" style="text-align:center; padding: 30px; color: #9ca3af;">No appointments found for the selected period.</td></tr>'}
                    </tbody>
                </table>
            </body>
            </html>
        `;
    };

    const handlePrint = () => {
        addAuditLog('Printed Performance Report', `Printed clinic performance report for period ${fromDate} to ${toDate}.`);
        const printHtml = generateReportHtml();

        try {
            if (window.self === window.top) {
                window.print();
                return;
            }
        } catch (e) {}

        const printWindow = window.open('', '_blank', 'width=900,height=750');
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
        const filename = `Doc_Dental_Performance_Report_${fromDate}_to_${toDate}.pdf`;
        await exportHtmlToPdf(printHtml, filename, { orientation: 'landscape', width: '950px' });
    };

    return (
        <div className="report-container p-3 p-md-4 p-lg-5 animate__animated animate__fadeIn" style={{ backgroundColor: colors.beige, minHeight: '100vh', width: '100%' }}>
            <style>{`
                @media print {
                    body { background-color: white !important; -webkit-print-color-adjust: exact; }
                    body * { visibility: hidden; }
                    .report-container, .report-container * { visibility: visible; }
                    .report-container {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100% !important;
                        padding: 10mm 15mm !important;
                        margin: 0 !important;
                        background-color: white !important;
                    }
                    .d-print-none { display: none !important; }
                    .card { border: 1px solid #eee !important; box-shadow: none !important; }
                    .print-badge { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                }
            `}</style>

            {/* Print Header */}
            <div className="d-none d-print-block text-center mb-4 pb-3" style={{ borderBottom: '2px solid ' + colors.gold }}>
                <h2 className="fw-bold" style={{ color: colors.goldDark, margin: '0 0 5px 0', fontSize: '26pt' }}>DOC DENTAL CLINIC</h2>
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
