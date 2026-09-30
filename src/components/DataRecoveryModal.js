import React, { useState, useRef, useEffect } from 'react';
import Swal from 'sweetalert2';
import {
    RiShieldCheckLine,
    RiUploadCloud2Line,
    RiFileTextLine,
    RiFileExcel2Line,
    RiDatabase2Line,
    RiAlertLine,
    RiCheckDoubleLine,
    RiCheckboxCircleLine,
    RiCloseLine,
    RiRefreshLine,
    RiUserHeartLine,
    RiCalendarCheckLine,
    RiStethoscopeLine,
    RiMoneyDollarCircleLine,
    RiHistoryLine
} from 'react-icons/ri';
import { parseUploadedBackupFiles } from '../utils/dataRestore';
import { restoreDatabase, readSession } from '../utils/storage';
import { addAuditLog } from '../services/auditLogger';

const DataRecoveryModal = ({ isOpen, onClose, onSuccess, initialFiles = null }) => {
    const fileInputRef = useRef(null);
    const session = readSession() || {};
    const userName = session.fullName || session.name || session.email || 'Authorized User';

    const colors = {
        gold: '#D8B03B',
        goldDark: '#B48A18',
        goldLight: '#FDF7E7',
        beige: '#F8F7F2',
        danger: '#DC2626',
        success: '#16A34A'
    };

    const [isDragging, setIsDragging] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [parsedResult, setParsedResult] = useState(null);
    const [parseErrors, setParseErrors] = useState([]);
    const [recoveryMode, setRecoveryMode] = useState('merge'); // Non-destructive safe merge
    const [confirmed, setConfirmed] = useState(false);

    // Process files if initialFiles were dropped onto trigger card
    useEffect(() => {
        if (isOpen && initialFiles && initialFiles.length > 0) {
            handleProcessFiles(initialFiles);
        }
    }, [isOpen, initialFiles]);

    if (!isOpen) return null;

    const handleProcessFiles = async (fileList) => {
        const files = Array.from(fileList || []);
        if (files.length === 0) return;

        setIsParsing(true);
        setParseErrors([]);
        setConfirmed(false);
        setUploadedFiles(files);

        try {
            const outcome = await parseUploadedBackupFiles(files);
            if (!outcome.success) {
                setParsedResult(null);
                setParseErrors(outcome.errors || [outcome.error || 'Failed to read backup files.']);
            } else {
                setParsedResult(outcome);
                setParseErrors(outcome.errors || []);
            }
        } catch (err) {
            console.error('File parsing error:', err);
            setParseErrors([err.message || 'An unexpected error occurred while parsing files.']);
        } finally {
            setIsParsing(false);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleProcessFiles(e.dataTransfer.files);
        }
    };

    const handleFileInputChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleProcessFiles(e.target.files);
        }
    };

    const handleResetFiles = () => {
        setUploadedFiles([]);
        setParsedResult(null);
        setParseErrors([]);
        setConfirmed(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleExecuteRecovery = async () => {
        if (!parsedResult || !parsedResult.data) {
            Swal.fire({
                icon: 'warning',
                title: 'No Valid Backup Loaded',
                text: 'Please upload a valid JSON backup or CSV dataset file before proceeding.',
                confirmButtonColor: colors.goldDark
            });
            return;
        }

        if (!confirmed) {
            Swal.fire({
                icon: 'warning',
                title: 'Confirmation Required',
                text: 'Please check the confirmation box to verify that you wish to execute database recovery.',
                confirmButtonColor: colors.goldDark
            });
            return;
        }

        const confirmDialog = await Swal.fire({
            title: 'Execute Database Recovery?',
            html: `
                <div class="text-start small">
                    <p class="mb-2">You are about to restore clinical data in <strong>Safe Merge Mode (Non-destructive)</strong>.</p>
                    <div class="p-3 rounded bg-light border mb-2">
                        <div>👥 Users/Patients: <strong>${parsedResult.summary.counts.users}</strong></div>
                        <div>📅 Appointments: <strong>${parsedResult.summary.counts.appointments}</strong></div>
                        <div>📋 Medical Records: <strong>${parsedResult.summary.counts.medicalRecords}</strong></div>
                        <div>🦷 Dental Charts: <strong>${parsedResult.summary.counts.dentalCharts}</strong></div>
                    </div>
                    <p class="text-danger mb-0 fw-bold">This operation will update current database records immediately.</p>
                </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: colors.goldDark,
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, Restore Database',
            cancelButtonText: 'Cancel'
        });

        if (!confirmDialog.isConfirmed) return;

        setIsRestoring(true);

        try {
            const res = await restoreDatabase(parsedResult.data, recoveryMode, userName);

            if (res.success) {
                addAuditLog(
                    'Emergency Data Recovery Performed',
                    `Recovered ${parsedResult.summary.counts.users} users, ${parsedResult.summary.counts.appointments} appointments, ${parsedResult.summary.counts.medicalRecords} medical records (${recoveryMode} mode) by ${userName}.`
                );

                await Swal.fire({
                    icon: 'success',
                    title: 'Database Restored Successfully!',
                    html: `
                        <div class="text-start small">
                            <p class="mb-2 text-success fw-bold">All records have been recovered and synchronized.</p>
                            <div class="p-2 rounded bg-light border small">
                                <div>• <strong>${parsedResult.summary.counts.users}</strong> Patients / Users Recovered</div>
                                <div>• <strong>${parsedResult.summary.counts.appointments}</strong> Appointments Recovered</div>
                                <div>• <strong>${parsedResult.summary.counts.medicalRecords}</strong> Medical Records Recovered</div>
                                <div>• <strong>${parsedResult.summary.counts.dentalCharts}</strong> Dental Charts Recovered</div>
                            </div>
                        </div>
                    `,
                    confirmButtonColor: colors.goldDark
                });

                if (typeof onSuccess === 'function') {
                    onSuccess(parsedResult.data);
                }
                onClose();
            } else {
                throw new Error(res.error || 'Failed to restore database');
            }
        } catch (err) {
            console.error('Data restore error:', err);
            Swal.fire({
                icon: 'error',
                title: 'Recovery Failed',
                text: err.message || 'An error occurred while restoring data.',
                confirmButtonColor: colors.goldDark
            });
        } finally {
            setIsRestoring(false);
        }
    };

    return (
        <div
            className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
            style={{
                backgroundColor: 'rgba(26, 24, 21, 0.65)',
                backdropFilter: 'blur(5px)',
                zIndex: 1070
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget && !isRestoring) onClose();
            }}
        >
            <div
                className="card border-0 shadow-lg animate__animated animate__zoomIn animate__faster"
                style={{
                    width: '100%',
                    maxWidth: '640px',
                    maxHeight: '92vh',
                    borderRadius: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}
            >
                {/* Header */}
                <div
                    className="p-3 p-md-4 border-bottom d-flex align-items-center justify-content-between text-white"
                    style={{
                        background: `linear-gradient(135deg, ${colors.goldDark} 0%, #1f1b18 100%)`
                    }}
                >
                    <div className="d-flex align-items-center gap-3">
                        <div
                            className="rounded-3 d-flex align-items-center justify-content-center"
                            style={{
                                width: '48px',
                                height: '48px',
                                backgroundColor: 'rgba(255,255,255,0.15)',
                                backdropFilter: 'blur(4px)'
                            }}
                        >
                            <RiShieldCheckLine className="fs-3 text-warning" />
                        </div>
                        <div>
                            <h5 className="fw-bold mb-0 text-white">Emergency Data Recovery</h5>
                            <span className="small text-white-50" style={{ fontSize: '12px' }}>
                                Recover clinical database records from downloaded backup files
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="btn btn-sm text-white-50 p-1 border-0"
                        onClick={onClose}
                        disabled={isRestoring}
                        style={{ background: 'transparent' }}
                    >
                        <RiCloseLine className="fs-4 text-white" />
                    </button>
                </div>

                {/* Body (Scrollable) */}
                <div className="p-3 p-md-4 overflow-y-auto" style={{ maxHeight: 'calc(92vh - 150px)' }}>
                    
                    {/* Notice Banner */}
                    <div
                        className="p-3 rounded-3 mb-3 d-flex align-items-start gap-2"
                        style={{ backgroundColor: colors.goldLight, border: `1px solid ${colors.gold}50` }}
                    >
                        <RiAlertLine className="text-warning fs-5 flex-shrink-0 mt-1" />
                        <div className="small text-dark" style={{ lineHeight: 1.45 }}>
                            <strong>Purpose:</strong> Use this tool to completely restore and recover patient data, appointments, and charts when the clinical system data corrupts or goes missing.
                        </div>
                    </div>

                    {/* File Dropzone */}
                    {!parsedResult && (
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className="p-4 p-md-5 rounded-4 text-center d-flex flex-column align-items-center justify-content-center transition-all cursor-pointer"
                            style={{
                                border: `2px dashed ${isDragging ? colors.goldDark : '#D4AF37'}`,
                                backgroundColor: isDragging ? '#FFFDF5' : colors.beige,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                transform: isDragging ? 'scale(1.01)' : 'scale(1)'
                            }}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept=".json,.csv,.txt"
                                className="d-none"
                                onChange={handleFileInputChange}
                            />

                            <div
                                className="rounded-circle p-3 mb-3 d-flex align-items-center justify-content-center"
                                style={{ backgroundColor: '#ffffff', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                            >
                                <RiUploadCloud2Line size={42} style={{ color: colors.goldDark }} />
                            </div>

                            <h6 className="fw-bold mb-1 text-dark">
                                {isParsing ? 'Inspecting Backup File(s)...' : 'Put your downloaded backup file(s) here'}
                            </h6>
                            <p className="text-muted small mb-3" style={{ maxWidth: '420px' }}>
                                Drag & drop your Complete System Backup (<code>.json</code>) or CSV dataset files (<code>.csv</code>), or click to browse files from your computer.
                            </p>

                            {/* Format Badges */}
                            <div className="d-flex flex-wrap justify-content-center gap-2">
                                <span className="badge rounded-pill bg-white text-secondary border px-3 py-2 small d-flex align-items-center gap-1">
                                    <RiDatabase2Line className="text-warning" /> JSON Backup (.json)
                                </span>
                                <span className="badge rounded-pill bg-white text-secondary border px-3 py-2 small d-flex align-items-center gap-1">
                                    <RiFileExcel2Line className="text-success" /> CSV Datasets (.csv)
                                </span>
                                <span className="badge rounded-pill bg-white text-secondary border px-3 py-2 small d-flex align-items-center gap-1">
                                    <RiCheckDoubleLine className="text-primary" /> Multi-File CSV Bundle
                                </span>
                            </div>

                            {isParsing && (
                                <div className="mt-3 d-flex align-items-center gap-2 text-warning fw-bold small">
                                    <div className="spinner-border spinner-border-sm" role="status" />
                                    <span>Reading and verifying data integrity...</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Parse Errors */}
                    {parseErrors.length > 0 && (
                        <div className="alert alert-danger mt-3 mb-0 small">
                            <strong className="d-block mb-1">Inspection Warnings / Errors:</strong>
                            <ul className="mb-0 ps-3">
                                {parseErrors.map((err, i) => (
                                    <li key={i}>{err}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Inspection Breakdown */}
                    {parsedResult && (
                        <div className="animate__animated animate__fadeIn">
                            {/* File Status Card */}
                            <div className="card border p-3 rounded-3 mb-3 bg-white shadow-sm">
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <div className="d-flex align-items-center gap-2">
                                        <RiCheckboxCircleLine className="text-success fs-4" />
                                        <strong className="text-dark">Verified Doc Dental Backup Data</strong>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary py-0 px-2"
                                        onClick={handleResetFiles}
                                        disabled={isRestoring}
                                        style={{ fontSize: '12px' }}
                                    >
                                        Change File
                                    </button>
                                </div>
                                <div className="text-muted small">
                                    <strong>Source File(s):</strong> {parsedResult.summary.fileNames.join(', ')}
                                </div>
                                <div className="text-muted small mt-1">
                                    <strong>Detected Types:</strong> {parsedResult.summary.detectedTypes.join(', ') || 'Clinical Datasets'}
                                </div>
                            </div>

                            {/* Counts Grid */}
                            <h6 className="fw-bold text-dark mb-2 small text-uppercase" style={{ letterSpacing: '0.5px' }}>
                                Records Ready for Recovery
                            </h6>
                            <div className="row g-2 mb-3">
                                <div className="col-6 col-md-4">
                                    <div className="p-2 rounded-2 border bg-light d-flex align-items-center gap-2">
                                        <RiUserHeartLine className="text-primary fs-5" />
                                        <div>
                                            <div className="text-muted" style={{ fontSize: '11px' }}>Patients & Users</div>
                                            <strong className="text-dark fs-6">{parsedResult.summary.counts.users}</strong>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-6 col-md-4">
                                    <div className="p-2 rounded-2 border bg-light d-flex align-items-center gap-2">
                                        <RiCalendarCheckLine className="text-warning fs-5" />
                                        <div>
                                            <div className="text-muted" style={{ fontSize: '11px' }}>Appointments</div>
                                            <strong className="text-dark fs-6">{parsedResult.summary.counts.appointments}</strong>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-6 col-md-4">
                                    <div className="p-2 rounded-2 border bg-light d-flex align-items-center gap-2">
                                        <RiStethoscopeLine className="text-danger fs-5" />
                                        <div>
                                            <div className="text-muted" style={{ fontSize: '11px' }}>Medical Records</div>
                                            <strong className="text-dark fs-6">{parsedResult.summary.counts.medicalRecords}</strong>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-6 col-md-4">
                                    <div className="p-2 rounded-2 border bg-light d-flex align-items-center gap-2">
                                        <RiDatabase2Line className="text-success fs-5" />
                                        <div>
                                            <div className="text-muted" style={{ fontSize: '11px' }}>Dental Charts</div>
                                            <strong className="text-dark fs-6">{parsedResult.summary.counts.dentalCharts}</strong>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-6 col-md-4">
                                    <div className="p-2 rounded-2 border bg-light d-flex align-items-center gap-2">
                                        <RiMoneyDollarCircleLine className="text-info fs-5" />
                                        <div>
                                            <div className="text-muted" style={{ fontSize: '11px' }}>Price List Items</div>
                                            <strong className="text-dark fs-6">{parsedResult.summary.counts.pricelist}</strong>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-6 col-md-4">
                                    <div className="p-2 rounded-2 border bg-light d-flex align-items-center gap-2">
                                        <RiHistoryLine className="text-secondary fs-5" />
                                        <div>
                                            <div className="text-muted" style={{ fontSize: '11px' }}>Audit Logs</div>
                                            <strong className="text-dark fs-6">{parsedResult.summary.counts.auditLogs}</strong>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Recovery Mode Selector */}
                            <h6 className="fw-bold text-dark mb-2 small text-uppercase" style={{ letterSpacing: '0.5px' }}>
                                Recovery Mode
                            </h6>
                            <div className="mb-3">
                                <div className="p-3 rounded-3 border border-success-subtle bg-light d-flex align-items-start gap-3">
                                    <span className="badge bg-success mt-1" style={{ fontSize: '11px' }}>Safe Merge</span>
                                    <div>
                                        <div className="fw-bold text-dark small">Safe Merge & Update (Non-destructive)</div>
                                        <div className="text-muted" style={{ fontSize: '12px' }}>
                                            Preserves all existing database records. New entries and updates from the backup are safely merged without deleting or wiping any existing data.
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Safety Confirmation Checkbox */}
                            <div className="p-3 rounded-3 mb-2 bg-light border">
                                <div className="form-check">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id="confirmRestoreCheckbox"
                                        checked={confirmed}
                                        onChange={(e) => setConfirmed(e.target.checked)}
                                    />
                                    <label className="form-check-label text-dark small fw-semibold" htmlFor="confirmRestoreCheckbox" style={{ cursor: 'pointer' }}>
                                        I confirm that I want to restore the clinical database with this backup data.
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 p-md-4 border-top bg-light d-flex align-items-center justify-content-between">
                    <button
                        type="button"
                        className="btn btn-light border text-muted px-4 py-2"
                        onClick={onClose}
                        disabled={isRestoring}
                    >
                        Cancel
                    </button>

                    {parsedResult ? (
                        <button
                            type="button"
                            className="btn fw-bold text-white px-4 py-2 shadow-sm d-flex align-items-center gap-2"
                            style={{
                                backgroundColor: confirmed ? colors.goldDark : '#a89885',
                                cursor: confirmed && !isRestoring ? 'pointer' : 'not-allowed'
                            }}
                            disabled={!confirmed || isRestoring}
                            onClick={handleExecuteRecovery}
                        >
                            {isRestoring ? (
                                <>
                                    <div className="spinner-border spinner-border-sm text-white" role="status" />
                                    <span>Recovering Database...</span>
                                </>
                            ) : (
                                <>
                                    <RiRefreshLine className="fs-5" />
                                    <span>Start Data Recovery</span>
                                </>
                            )}
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="btn fw-bold text-white px-4 py-2 shadow-sm d-flex align-items-center gap-2"
                            style={{ backgroundColor: colors.goldDark }}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <RiUploadCloud2Line className="fs-5" />
                            <span>Browse Backup Files</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DataRecoveryModal;
