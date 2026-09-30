import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    RiCompass3Line, RiFlowChart, RiFileTextLine, RiShieldKeyholeLine,
    RiLayoutMasonryLine, RiNodeTree, RiCheckDoubleLine, RiBuilding4Line,
    RiUserSharedLine, RiServerLine, RiDatabase2Line, RiArrowRightLine,
    RiAlertLine, RiCheckboxCircleLine, RiCodeBoxLine, RiPlayCircleLine,
    RiExternalLinkLine, RiStethoscopeLine, RiFlaskLine, RiMoneyDollarCircleLine,
    RiCalendarCheckLine, RiUserAddLine, RiFileChartLine, RiShieldCheckLine
} from 'react-icons/ri';

const EnterpriseArchitecturePortal = () => {
    const navigate = useNavigate();
    const [activeOutput, setActiveOutput] = useState('eaDiagram'); // 'analysis' | 'asIs' | 'requirements' | 'mockup' | 'roles' | 'toBe' | 'eaDiagram' | 'liveDemo'

    return (
        <div className="container-fluid p-3 p-md-4 animate__animated animate__fadeIn" style={{ maxWidth: '1600px', margin: '0 auto' }}>
            {/* Header Banner */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 p-4 rounded-4 shadow-sm bg-white border">
                <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                        <span className="badge rounded-pill bg-dark text-white px-3 py-1 fw-bold">
                            <RiCompass3Line className="me-1" /> Enterprise Architecture (ENTARC) Framework
                        </span>
                        <span className="badge rounded-pill bg-primary bg-opacity-10 text-primary px-3 py-1">
                            Group 2 Academic Deliverables
                        </span>
                    </div>
                    <h2 className="fw-bold mb-1 text-dark">CarePlus Enterprise Architecture & System Blueprint</h2>
                    <p className="text-muted small mb-0">
                        Complete Deliverable Suite for Group 2: CarePlus Clinic Management System. Covering Business Analysis, As-Is / To-Be process workflows, Requirements, UI Mock-ups, RBAC security, TOGAF 4-Layer EA Blueprint, and Live System Demonstration.
                    </p>
                </div>
            </div>

            {/* Navigation Tabs for All 8 Expected Project Outputs */}
            <div className="row g-2 mb-4">
                {[
                    { id: 'analysis', label: '1. Business Analysis', icon: <RiFileTextLine /> },
                    { id: 'asIs', label: '2. As-Is Process', icon: <RiFlowChart /> },
                    { id: 'requirements', label: '3. Requirements', icon: <RiCheckDoubleLine /> },
                    { id: 'mockup', label: '4. System Mock-Up', icon: <RiLayoutMasonryLine /> },
                    { id: 'roles', label: '5. Roles & Access', icon: <RiShieldKeyholeLine /> },
                    { id: 'toBe', label: '6. To-Be Process', icon: <RiFlowChart /> },
                    { id: 'eaDiagram', label: '7. EA Diagram', icon: <RiNodeTree /> },
                    { id: 'liveDemo', label: '8. Live System Demo', icon: <RiPlayCircleLine /> }
                ].map(tab => (
                    <div key={tab.id} className="col-6 col-sm-4 col-md-3 col-xl">
                        <button
                            onClick={() => setActiveOutput(tab.id)}
                            className={`btn w-100 py-2 px-1 text-truncate rounded-3 fw-semibold small d-flex align-items-center justify-content-center gap-1 shadow-sm ${activeOutput === tab.id ? 'btn-primary' : 'btn-white bg-white border text-secondary'}`}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    </div>
                ))}
            </div>

            {/* OUTPUT 1: Business Analysis */}
            {activeOutput === 'analysis' && (
                <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white">
                    <div className="d-flex align-items-center gap-2 mb-3">
                        <span className="badge bg-primary px-3 py-1 rounded-pill">Deliverable Output #1</span>
                        <h4 className="fw-bold mb-0 text-dark">Business Analysis & Problem Statement</h4>
                    </div>

                    <div className="p-3 bg-light rounded-3 border-start border-primary border-4 mb-4">
                        <h6 className="fw-bold text-dark mb-1">Organizational Profile: CarePlus Clinics</h6>
                        <p className="text-secondary small mb-0">
                            CarePlus operates two clinic facilities: <strong>CarePlus Metro Branch</strong> (Main Outpatient Clinic) and <strong>CarePlus Northside Branch</strong> (Specialty & Diagnostic Center). Currently, patient registration, appointments, laboratory results, billing, and clinical consultations are handled using disparate legacy systems and manual paperwork.
                        </p>
                    </div>

                    <div className="row g-4 mb-4">
                        <div className="col-md-6">
                            <div className="p-4 border rounded-4 h-100 bg-white">
                                <h6 className="fw-bold text-danger d-flex align-items-center gap-2 mb-3">
                                    <RiAlertLine /> Operational Problems in Current State
                                </h6>
                                <ul className="text-secondary small d-flex flex-column gap-2 mb-0 ps-3">
                                    <li><strong>Siloed Branch Data:</strong> Patient visits in Metro Branch are invisible to clinicians in Northside Branch, resulting in duplicate registrations and missing health histories.</li>
                                    <li><strong>Manual Paperwork Bottlenecks:</strong> Physical laboratory result slips and paper-based prescriptions lead to delays and high risk of clinical misplacement.</li>
                                    <li><strong>Billing & Discount Discrepancies:</strong> Lack of automated calculations for Senior Citizen (20%), PWD (20%), and PhilHealth coverage creates revenue leakages and audit findings.</li>
                                    <li><strong>No Unified Patient Visibility:</strong> Patients cannot view their cumulative diagnostic results or appointment status online without visiting the physical branch.</li>
                                </ul>
                            </div>
                        </div>

                        <div className="col-md-6">
                            <div className="p-4 border rounded-4 h-100 bg-white">
                                <h6 className="fw-bold text-success d-flex align-items-center gap-2 mb-3">
                                    <RiCheckboxCircleLine /> Strategic Architectural Objectives
                                </h6>
                                <ul className="text-secondary small d-flex flex-column gap-2 mb-0 ps-3">
                                    <li><strong>Centralized Multi-Branch EHR:</strong> Establish a unified patient identifier and synchronized clinical record accessible across Metro and Northside branches.</li>
                                    <li><strong>Digital Diagnostic Pipeline:</strong> Real-time laboratory requisitioning from doctor consultation directly into technician queues with automated abnormal flags.</li>
                                    <li><strong>Audited POS & Invoicing:</strong> Automated statutory discounting (Senior/PWD 20%) and official receipt generation with transparent payment reconciliation.</li>
                                    <li><strong>Strict Role-Based Security:</strong> Delineate access privileges for Medical Director, Attending Physicians, Triage Nurses, MedTechs, Cashiers, and Patients.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* OUTPUT 2: As-Is Process Diagram */}
            {activeOutput === 'asIs' && (
                <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white">
                    <div className="d-flex align-items-center gap-2 mb-3">
                        <span className="badge bg-danger px-3 py-1 rounded-pill">Deliverable Output #2</span>
                        <h4 className="fw-bold mb-0 text-dark">As-Is Process Diagram (Fragmented Baseline Operations)</h4>
                    </div>
                    <p className="text-muted small mb-4">
                        Depicts the current operational silos where patient registration, doctor consultations, lab tests, and payments operate on disconnected standalone tools and manual clipboards.
                    </p>

                    <div className="p-4 bg-light rounded-4 border mb-4">
                        <div className="d-flex flex-column flex-lg-row align-items-center justify-content-between gap-3 text-center">
                            <div className="p-3 bg-white rounded-3 border shadow-sm w-100">
                                <span className="badge bg-secondary mb-1">Step 1</span>
                                <h6 className="fw-bold text-dark mb-1">Branch Intake</h6>
                                <p className="text-muted small mb-0">Patient fills paper intake form at Metro or Northside desk</p>
                            </div>
                            <RiArrowRightLine className="fs-3 text-danger d-none d-lg-block" />
                            <div className="p-3 bg-white rounded-3 border shadow-sm w-100">
                                <span className="badge bg-secondary mb-1">Step 2</span>
                                <h6 className="fw-bold text-dark mb-1">Manual Schedule</h6>
                                <p className="text-muted small mb-0">Staff checks paper appointment book or spreadsheet</p>
                            </div>
                            <RiArrowRightLine className="fs-3 text-danger d-none d-lg-block" />
                            <div className="p-3 bg-white rounded-3 border shadow-sm w-100">
                                <span className="badge bg-secondary mb-1">Step 3</span>
                                <h6 className="fw-bold text-dark mb-1">Doctor Consultation</h6>
                                <p className="text-muted small mb-0">Handwritten chart notes; manual paper lab request issued</p>
                            </div>
                            <RiArrowRightLine className="fs-3 text-danger d-none d-lg-block" />
                            <div className="p-3 bg-white rounded-3 border shadow-sm w-100">
                                <span className="badge bg-secondary mb-1">Step 4</span>
                                <h6 className="fw-bold text-dark mb-1">Separate Lab Tool</h6>
                                <p className="text-muted small mb-0">Patient brings paper order to lab; printed result slip after 24 hrs</p>
                            </div>
                            <RiArrowRightLine className="fs-3 text-danger d-none d-lg-block" />
                            <div className="p-3 bg-white rounded-3 border shadow-sm w-100">
                                <span className="badge bg-secondary mb-1">Step 5</span>
                                <h6 className="fw-bold text-dark mb-1">Manual Cashier</h6>
                                <p className="text-muted small mb-0">Cashier manually calculates Senior/PWD discount on calculator</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* OUTPUT 3: Business Requirements */}
            {activeOutput === 'requirements' && (
                <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white">
                    <div className="d-flex align-items-center gap-2 mb-3">
                        <span className="badge bg-primary px-3 py-1 rounded-pill">Deliverable Output #3</span>
                        <h4 className="fw-bold mb-0 text-dark">Business Requirements Specification</h4>
                    </div>
                    <p className="text-muted small mb-4">
                        Structured Functional (FR) and Non-Functional Requirements (NFR) mapped to CarePlus operational standards.
                    </p>

                    <div className="table-responsive">
                        <table className="table table-hover align-middle border">
                            <thead className="table-light small text-muted">
                                <tr>
                                    <th style={{ width: '10%' }}>Req ID</th>
                                    <th style={{ width: '25%' }}>Domain Module</th>
                                    <th>Detailed Functional Requirement</th>
                                    <th style={{ width: '15%' }}>Priority</th>
                                </tr>
                            </thead>
                            <tbody className="small">
                                <tr>
                                    <td className="fw-bold text-primary">FR-01</td>
                                    <td>Patient Registration</td>
                                    <td>The system must provide digital & walk-in patient intake, capturing demographics, branch assignment (Metro vs Northside), emergency contact, PhilHealth/HMO, and medical history.</td>
                                    <td><span className="badge bg-danger">Critical</span></td>
                                </tr>
                                <tr>
                                    <td className="fw-bold text-primary">FR-02</td>
                                    <td>Appointment Scheduling</td>
                                    <td>The system must manage appointment slots per doctor and branch, allowing online booking, queue monitoring, approval, and cancellation handling.</td>
                                    <td><span className="badge bg-danger">Critical</span></td>
                                </tr>
                                <tr>
                                    <td className="fw-bold text-primary">FR-03</td>
                                    <td>Doctor Consultation Records</td>
                                    <td>The system must capture clinical vitals, chief complaints, assessment/diagnosis, digital prescriptions (Rx), and direct lab test requisitioning.</td>
                                    <td><span className="badge bg-danger">Critical</span></td>
                                </tr>
                                <tr>
                                    <td className="fw-bold text-primary">FR-04</td>
                                    <td>Laboratory Requests & Results</td>
                                    <td>The system must track diagnostic orders (CBC, Lipid, FBS, Urinalysis, Chest X-Ray), specimen intake, parameter result recording, abnormal flags, and printable diagnostic slips.</td>
                                    <td><span className="badge bg-danger">Critical</span></td>
                                </tr>
                                <tr>
                                    <td className="fw-bold text-primary">FR-05</td>
                                    <td>Billing and Payments</td>
                                    <td>The system must automatically generate itemized invoices, calculate statutory discounts (Senior Citizen 20%, PWD 20%, PhilHealth), record payments, and print Official Receipts.</td>
                                    <td><span className="badge bg-danger">Critical</span></td>
                                </tr>
                                <tr>
                                    <td className="fw-bold text-primary">FR-06</td>
                                    <td>Medical Reports & Analytics</td>
                                    <td>The system must aggregate branch-level performance comparison (Metro vs Northside) and generate printable Medical Certificates and complete patient health histories.</td>
                                    <td><span className="badge bg-warning text-dark">High</span></td>
                                </tr>
                                <tr>
                                    <td className="fw-bold text-primary">FR-07</td>
                                    <td>User Access & Security</td>
                                    <td>The system must enforce Role-Based Access Control (RBAC) across Admin, Doctor, Staff, Laboratory, Billing, and Patient roles with audit trail logging.</td>
                                    <td><span className="badge bg-danger">Critical</span></td>
                                </tr>
                                <tr>
                                    <td className="fw-bold text-secondary">NFR-01</td>
                                    <td>Data Privacy & Compliance</td>
                                    <td>System must comply with Health Information Privacy and Data Privacy Act of 2012 (DPA) standards, logging all record views and clinical updates.</td>
                                    <td><span className="badge bg-primary">Standard</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* OUTPUT 4: System Mock-up */}
            {activeOutput === 'mockup' && (
                <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white">
                    <div className="d-flex align-items-center gap-2 mb-3">
                        <span className="badge bg-primary px-3 py-1 rounded-pill">Deliverable Output #4</span>
                        <h4 className="fw-bold mb-0 text-dark">System Mock-Up & Interface Architecture</h4>
                    </div>
                    <p className="text-muted small mb-4">
                        High-fidelity UI architectural previews and wireframes illustrating the cohesive, unified design system across all 6 clinical subsystems.
                    </p>

                    <div className="row g-4">
                        {[
                            {
                                title: 'Subsystem 1: Patient Intake & Roster',
                                badge: 'Module FR-01',
                                desc: 'Digital registration modal with automatic 2-branch facility assignment, PhilHealth/HMO validation, and medical history triage.',
                                color: 'primary',
                                route: '/staff/registration',
                                icon: <RiUserAddLine />
                            },
                            {
                                title: 'Subsystem 2: Multi-Branch Appointment Calendar',
                                badge: 'Module FR-02',
                                desc: 'Time-slot allocation engine with doctor availability filters, real-time booking queue, and instant status approval.',
                                color: 'info',
                                route: '/staff/book',
                                icon: <RiCalendarCheckLine />
                            },
                            {
                                title: 'Subsystem 3: Doctor Consultation & E-Prescription',
                                badge: 'Module FR-03',
                                desc: 'Clinician workspace with vitals monitoring, ICD-10 diagnostic entries, dynamic Rx medication builder, and direct lab ordering.',
                                color: 'success',
                                route: '/staff/consultations',
                                icon: <RiStethoscopeLine />
                            },
                            {
                                title: 'Subsystem 4: Laboratory Specimen & Results Hub',
                                badge: 'Module FR-04',
                                desc: 'Diagnostic testing workbench with specimen tracking, multi-parameter normal range validation, auto-flagging, and official lab slips.',
                                color: 'warning',
                                route: '/staff/laboratory',
                                icon: <RiFlaskLine />
                            },
                            {
                                title: 'Subsystem 5: Billing, Discounts & POS Receipts',
                                badge: 'Module FR-05',
                                desc: 'Automated itemized patient invoice generation, 20% Senior/PWD statutory discount logic, PhilHealth deduction, and Official Receipts.',
                                color: 'danger',
                                route: '/staff/billing',
                                icon: <RiMoneyDollarCircleLine />
                            },
                            {
                                title: 'Subsystem 6: Cross-Branch BI & Medical Certificates',
                                badge: 'Module FR-06',
                                desc: 'Comparative multi-branch operational analytics (Metro vs Northside), longitudinal patient health record timeline, and official med certs.',
                                color: 'dark',
                                route: '/staff/medical-reports',
                                icon: <RiFileChartLine />
                            }
                        ].map((mock, idx) => (
                            <div key={idx} className="col-12 col-md-6 col-xl-4">
                                <div className="card h-100 border rounded-4 p-4 shadow-sm bg-light">
                                    <div className="d-flex align-items-center justify-content-between mb-3">
                                        <div className={`p-2 rounded-3 bg-${mock.color} text-white`}>
                                            {mock.icon}
                                        </div>
                                        <span className={`badge bg-${mock.color} bg-opacity-10 text-${mock.color} rounded-pill`}>
                                            {mock.badge}
                                        </span>
                                    </div>
                                    <h6 className="fw-bold text-dark mb-1">{mock.title}</h6>
                                    <p className="text-secondary small mb-3 flex-grow-1">{mock.desc}</p>
                                    <button
                                        onClick={() => navigate(mock.route)}
                                        className="btn btn-outline-primary btn-sm rounded-3 d-flex align-items-center justify-content-center gap-2"
                                    >
                                        Inspect Live Screen <RiExternalLinkLine />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* OUTPUT 5: User Roles and Access Matrix */}
            {activeOutput === 'roles' && (
                <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white">
                    <div className="d-flex align-items-center gap-2 mb-3">
                        <span className="badge bg-primary px-3 py-1 rounded-pill">Deliverable Output #5</span>
                        <h4 className="fw-bold mb-0 text-dark">User Roles and Access Control Matrix (RBAC)</h4>
                    </div>
                    <p className="text-muted small mb-4">
                        Security architecture defining permissions, granular read/write privileges, and access boundaries across CarePlus user personas.
                    </p>

                    <div className="table-responsive">
                        <table className="table table-bordered text-center align-middle">
                            <thead className="table-dark small">
                                <tr>
                                    <th className="text-start">System Functional Module</th>
                                    <th>Medical Director (Admin)</th>
                                    <th>Attending Physician (Doctor)</th>
                                    <th>Clinic Staff (Nurse / Reception)</th>
                                    <th>MedTech (Laboratory)</th>
                                    <th>Cashier (Billing)</th>
                                    <th>Patient Portal</th>
                                </tr>
                            </thead>
                            <tbody className="small">
                                <tr>
                                    <td className="text-start fw-bold">Patient Registration & Demographics</td>
                                    <td><span className="badge bg-success">Full Access</span></td>
                                    <td><span className="badge bg-info text-white">Read Only</span></td>
                                    <td><span className="badge bg-success">Full Access</span></td>
                                    <td><span className="badge bg-info text-white">Read Only</span></td>
                                    <td><span className="badge bg-info text-white">Read Only</span></td>
                                    <td><span className="badge bg-warning text-dark">Own Profile</span></td>
                                </tr>
                                <tr>
                                    <td className="text-start fw-bold">Appointment Scheduling & Triage</td>
                                    <td><span className="badge bg-success">Full Access</span></td>
                                    <td><span className="badge bg-info text-white">Assigned Queue</span></td>
                                    <td><span className="badge bg-success">Full Access</span></td>
                                    <td><span className="badge bg-secondary">No Access</span></td>
                                    <td><span className="badge bg-secondary">No Access</span></td>
                                    <td><span className="badge bg-warning text-dark">Book & View Own</span></td>
                                </tr>
                                <tr>
                                    <td className="text-start fw-bold">Doctor Consultations, Vitals & Rx</td>
                                    <td><span className="badge bg-success">Full Access</span></td>
                                    <td><span className="badge bg-success">Create & Prescribe</span></td>
                                    <td><span className="badge bg-info text-white">Record Vitals</span></td>
                                    <td><span className="badge bg-secondary">No Access</span></td>
                                    <td><span className="badge bg-secondary">No Access</span></td>
                                    <td><span className="badge bg-warning text-dark">View Own Rx</span></td>
                                </tr>
                                <tr>
                                    <td className="text-start fw-bold">Laboratory Requisitions & Results</td>
                                    <td><span className="badge bg-success">Full Access</span></td>
                                    <td><span className="badge bg-info text-white">Order Tests</span></td>
                                    <td><span className="badge bg-info text-white">Specimen Intake</span></td>
                                    <td><span className="badge bg-success">Encode Findings</span></td>
                                    <td><span className="badge bg-secondary">No Access</span></td>
                                    <td><span className="badge bg-warning text-dark">View Own Slips</span></td>
                                </tr>
                                <tr>
                                    <td className="text-start fw-bold">Billing, Discounts & Official Receipts</td>
                                    <td><span className="badge bg-success">Full Access</span></td>
                                    <td><span className="badge bg-secondary">No Access</span></td>
                                    <td><span className="badge bg-info text-white">Create Invoice</span></td>
                                    <td><span className="badge bg-secondary">No Access</span></td>
                                    <td><span className="badge bg-success">Process Payment</span></td>
                                    <td><span className="badge bg-warning text-dark">View Own OR</span></td>
                                </tr>
                                <tr>
                                    <td className="text-start fw-bold">Executive Medical Reports & Certificates</td>
                                    <td><span className="badge bg-success">Full Analytics</span></td>
                                    <td><span className="badge bg-info text-white">Sign Med Cert</span></td>
                                    <td><span className="badge bg-info text-white">Issue Med Cert</span></td>
                                    <td><span className="badge bg-secondary">No Access</span></td>
                                    <td><span className="badge bg-secondary">No Access</span></td>
                                    <td><span className="badge bg-warning text-dark">View Own EHR</span></td>
                                </tr>
                                <tr>
                                    <td className="text-start fw-bold">Security, Audit Trails & User Roles</td>
                                    <td><span className="badge bg-success">Manage Users</span></td>
                                    <td><span className="badge bg-secondary">No Access</span></td>
                                    <td><span className="badge bg-secondary">No Access</span></td>
                                    <td><span className="badge bg-secondary">No Access</span></td>
                                    <td><span className="badge bg-secondary">No Access</span></td>
                                    <td><span className="badge bg-secondary">No Access</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* OUTPUT 6: To-Be Process Diagram */}
            {activeOutput === 'toBe' && (
                <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white">
                    <div className="d-flex align-items-center gap-2 mb-3">
                        <span className="badge bg-success px-3 py-1 rounded-pill">Deliverable Output #6</span>
                        <h4 className="fw-bold mb-0 text-dark">To-Be Process Diagram (Integrated Digital Flow)</h4>
                    </div>
                    <p className="text-muted small mb-4">
                        Depicts the re-engineered, fully integrated patient journey linking all 6 core clinical services across both Metro and Northside facilities into a single central data architecture.
                    </p>

                    <div className="p-4 bg-light rounded-4 border mb-4">
                        <div className="d-flex flex-column flex-lg-row align-items-center justify-content-between gap-3 text-center">
                            <div className="p-3 bg-white rounded-3 border shadow-sm w-100 border-start border-primary border-4">
                                <span className="badge bg-primary mb-1">Phase 1: Digital Intake</span>
                                <h6 className="fw-bold text-dark mb-1">Unified EHR Intake</h6>
                                <p className="text-muted small mb-0">Patient registered once; valid at both Metro & Northside branches</p>
                            </div>
                            <RiArrowRightLine className="fs-3 text-success d-none d-lg-block" />
                            <div className="p-3 bg-white rounded-3 border shadow-sm w-100 border-start border-info border-4">
                                <span className="badge bg-info mb-1">Phase 2: Scheduling</span>
                                <h6 className="fw-bold text-dark mb-1">Multi-Branch Queue</h6>
                                <p className="text-muted small mb-0">Patient books slot; triage status immediately syncs to staff monitor</p>
                            </div>
                            <RiArrowRightLine className="fs-3 text-success d-none d-lg-block" />
                            <div className="p-3 bg-white rounded-3 border shadow-sm w-100 border-start border-success border-4">
                                <span className="badge bg-success mb-1">Phase 3: Consultation</span>
                                <h6 className="fw-bold text-dark mb-1">Doctor Exam & E-Rx</h6>
                                <p className="text-muted small mb-0">Physician inputs vitals, diagnosis, and electronically dispatches lab requests</p>
                            </div>
                            <RiArrowRightLine className="fs-3 text-success d-none d-lg-block" />
                            <div className="p-3 bg-white rounded-3 border shadow-sm w-100 border-start border-warning border-4">
                                <span className="badge bg-warning text-dark mb-1">Phase 4: Diagnostics</span>
                                <h6 className="fw-bold text-dark mb-1">Lab Testing & Slips</h6>
                                <p className="text-muted small mb-0">MedTech enters findings; automated flags; results link to doctor & patient EHR</p>
                            </div>
                            <RiArrowRightLine className="fs-3 text-success d-none d-lg-block" />
                            <div className="p-3 bg-white rounded-3 border shadow-sm w-100 border-start border-danger border-4">
                                <span className="badge bg-danger mb-1">Phase 5: Automated POS</span>
                                <h6 className="fw-bold text-dark mb-1">Billing & OR Slip</h6>
                                <p className="text-muted small mb-0">Automated 20% Senior/PWD discount; instant multi-channel payment receipt</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* OUTPUT 7: Enterprise Architecture Diagram (TOGAF 4-Layer) */}
            {activeOutput === 'eaDiagram' && (
                <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white">
                    <div className="d-flex align-items-center gap-2 mb-3">
                        <span className="badge bg-primary px-3 py-1 rounded-pill">Deliverable Output #7</span>
                        <h4 className="fw-bold mb-0 text-dark">TOGAF 4-Layer Enterprise Architecture Blueprint</h4>
                    </div>
                    <p className="text-muted small mb-4">
                        Comprehensive architecture stack detailing Business, Application, Data, and Technology tiers supporting CarePlus multi-facility operations.
                    </p>

                    <div className="d-flex flex-column gap-3">
                        {/* Layer 1: Business Architecture */}
                        <div className="p-4 rounded-4 border bg-light">
                            <div className="d-flex align-items-center gap-2 mb-2">
                                <span className="badge bg-primary px-3 py-1">Layer 1</span>
                                <h5 className="fw-bold text-dark mb-0">Business Architecture Tier</h5>
                            </div>
                            <p className="text-secondary small mb-3">
                                Business entities, clinical stakeholders, organizational goals, and strategic healthcare services.
                            </p>
                            <div className="row g-2">
                                <div className="col-md-3">
                                    <div className="p-3 bg-white rounded border text-center">
                                        <div className="fw-bold small text-dark">CarePlus Metro Branch</div>
                                        <div className="text-muted small">Outpatient Care, Consultations, Triage</div>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <div className="p-3 bg-white rounded border text-center">
                                        <div className="fw-bold small text-dark">CarePlus Northside Branch</div>
                                        <div className="text-muted small">Specialty Diagnostics, Clinical Pathology</div>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <div className="p-3 bg-white rounded border text-center">
                                        <div className="fw-bold small text-dark">Clinical Governance</div>
                                        <div className="text-muted small">Medical Director & Regulatory Compliance</div>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <div className="p-3 bg-white rounded border text-center">
                                        <div className="fw-bold small text-dark">Patient Beneficiaries</div>
                                        <div className="text-muted small">Regular, PWD, Senior Citizens, HMO Insured</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Layer 2: Application Architecture */}
                        <div className="p-4 rounded-4 border bg-light">
                            <div className="d-flex align-items-center gap-2 mb-2">
                                <span className="badge bg-success px-3 py-1">Layer 2</span>
                                <h5 className="fw-bold text-dark mb-0">Application & Services Architecture Tier</h5>
                            </div>
                            <p className="text-secondary small mb-3">
                                Deployed micro-frontends, core functional modules, and business logic controllers.
                            </p>
                            <div className="row g-2">
                                <div className="col-md-2">
                                    <div className="p-2 px-3 bg-white rounded border text-center small fw-semibold">Patient Intake Engine</div>
                                </div>
                                <div className="col-md-2">
                                    <div className="p-2 px-3 bg-white rounded border text-center small fw-semibold">Appointment Scheduler</div>
                                </div>
                                <div className="col-md-2">
                                    <div className="p-2 px-3 bg-white rounded border text-center small fw-semibold">Doctor E-Prescription</div>
                                </div>
                                <div className="col-md-2">
                                    <div className="p-2 px-3 bg-white rounded border text-center small fw-semibold">Laboratory Diagnostic Station</div>
                                </div>
                                <div className="col-md-2">
                                    <div className="p-2 px-3 bg-white rounded border text-center small fw-semibold">Billing & Cashier Module</div>
                                </div>
                                <div className="col-md-2">
                                    <div className="p-2 px-3 bg-white rounded border text-center small fw-semibold">Multi-Branch BI Engine</div>
                                </div>
                            </div>
                        </div>

                        {/* Layer 3: Data Architecture */}
                        <div className="p-4 rounded-4 border bg-light">
                            <div className="d-flex align-items-center gap-2 mb-2">
                                <span className="badge bg-info text-white px-3 py-1">Layer 3</span>
                                <h5 className="fw-bold text-dark mb-0">Data & Entity Architecture Tier</h5>
                            </div>
                            <p className="text-secondary small mb-3">
                                Centralized relational entities and medical schemas with foreign key integrity.
                            </p>
                            <div className="row g-2">
                                <div className="col-md-3">
                                    <div className="p-2 px-3 bg-white rounded border text-center small fw-semibold">`users` (RBAC Accounts)</div>
                                </div>
                                <div className="col-md-3">
                                    <div className="p-2 px-3 bg-white rounded border text-center small fw-semibold">`clinic_branches` (Metro / Northside)</div>
                                </div>
                                <div className="col-md-3">
                                    <div className="p-2 px-3 bg-white rounded border text-center small fw-semibold">`appointments` (Multi-Branch Slots)</div>
                                </div>
                                <div className="col-md-3">
                                    <div className="p-2 px-3 bg-white rounded border text-center small fw-semibold">`consultations` & Rx Prescriptions</div>
                                </div>
                                <div className="col-md-4">
                                    <div className="p-2 px-3 bg-white rounded border text-center small fw-semibold">`laboratory_requests` & Results</div>
                                </div>
                                <div className="col-md-4">
                                    <div className="p-2 px-3 bg-white rounded border text-center small fw-semibold">`billing_records` & OR Receipts</div>
                                </div>
                                <div className="col-md-4">
                                    <div className="p-2 px-3 bg-white rounded border text-center small fw-semibold">`audit_logs` (DPA Traceability)</div>
                                </div>
                            </div>
                        </div>

                        {/* Layer 4: Technology Architecture */}
                        <div className="p-4 rounded-4 border bg-light">
                            <div className="d-flex align-items-center gap-2 mb-2">
                                <span className="badge bg-dark px-3 py-1">Layer 4</span>
                                <h5 className="fw-bold text-dark mb-0">Technology & Infrastructure Tier</h5>
                            </div>
                            <p className="text-secondary small mb-3">
                                Hosting platforms, execution environments, network topologies, and transport security.
                            </p>
                            <div className="row g-2">
                                <div className="col-md-3">
                                    <div className="p-3 bg-white rounded border text-center">
                                        <div className="fw-bold small text-dark">Local Server Runtime</div>
                                        <div className="text-muted small">Apache XAMPP / Node.js Express Port 5000</div>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <div className="p-3 bg-white rounded border text-center">
                                        <div className="fw-bold small text-dark">Database Storage</div>
                                        <div className="text-muted small">MySQL 8.0+ / MariaDB UTF8mb4 Engine</div>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <div className="p-3 bg-white rounded border text-center">
                                        <div className="fw-bold small text-dark">Transport Security</div>
                                        <div className="text-muted small">TLS 1.3 / HTTPS Encryption & CSP Headers</div>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <div className="p-3 bg-white rounded border text-center">
                                        <div className="fw-bold small text-dark">Client Compatibility</div>
                                        <div className="text-muted small">HTML5 / Modern Browsers (Chrome, Edge, Safari)</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* OUTPUT 8: Live System Demonstration */}
            {activeOutput === 'liveDemo' && (
                <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white">
                    <div className="d-flex align-items-center gap-2 mb-3">
                        <span className="badge bg-success px-3 py-1 rounded-pill">Deliverable Output #8</span>
                        <h4 className="fw-bold mb-0 text-dark">Live System Demonstration & Presentation Walkthrough</h4>
                    </div>
                    <p className="text-muted small mb-4">
                        Interactive demonstration launchpad. Follow this standard step-by-step evaluator script during your capstone defense.
                    </p>

                    <div className="row g-4 mb-4">
                        <div className="col-12 col-lg-7">
                            <h6 className="fw-bold text-dark mb-3">Official Presentation Defense Walkthrough:</h6>
                            <div className="d-flex flex-column gap-3">
                                {[
                                    {
                                        step: 'Step 1',
                                        title: 'Walk-In Patient Intake & Registration',
                                        desc: 'Register a patient (e.g. John Patrick Doe) at CarePlus Metro Branch with demographics, PhilHealth HMO, and emergency contacts.',
                                        action: 'Launch Registration',
                                        route: '/staff/registration'
                                    },
                                    {
                                        step: 'Step 2',
                                        title: 'Multi-Branch Appointment Scheduling',
                                        desc: 'Schedule appointment for Adult Internal Medicine with Dr. Robert Chen at Metro Branch. Approve slot in real-time triage queue.',
                                        action: 'Launch Scheduling',
                                        route: '/staff/book'
                                    },
                                    {
                                        step: 'Step 3',
                                        title: 'Doctor Consultation & Lab Requisition',
                                        desc: 'Clinician records blood pressure (120/80), diagnosis (Hypertension Stage 1), prescribes Amlodipine 5mg, and orders a Full Lipid Profile lab test.',
                                        action: 'Conduct Consultation',
                                        route: '/staff/consultations'
                                    },
                                    {
                                        step: 'Step 4',
                                        title: 'Diagnostic Lab Test & Result Encoding',
                                        desc: 'MedTech receives specimen at Northside Branch diagnostic hub, enters findings (Cholesterol: 245 mg/dL [HIGH]), and prints official diagnostic slip.',
                                        action: 'Open Lab Station',
                                        route: '/staff/laboratory'
                                    },
                                    {
                                        step: 'Step 5',
                                        title: 'Billing, Statutory Discounts & Official Receipt',
                                        desc: 'Cashier bills patient for consultation + lipid panel. Applies 20% Senior Citizen discount. Generates Official Receipt (OR).',
                                        action: 'Open Cashier POS',
                                        route: '/staff/billing'
                                    },
                                    {
                                        step: 'Step 6',
                                        title: 'Cross-Branch BI Reports & Medical Certificate',
                                        desc: 'Compare footfall and revenue between Metro and Northside facilities. Generate a signed Medical Certificate of Fitness.',
                                        action: 'View Medical Reports',
                                        route: '/staff/medical-reports'
                                    }
                                ].map((item, idx) => (
                                    <div key={idx} className="p-3 border rounded-3 bg-light d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3">
                                        <div>
                                            <div className="d-flex align-items-center gap-2 mb-1">
                                                <span className="badge bg-primary rounded-pill">{item.step}</span>
                                                <strong className="text-dark small">{item.title}</strong>
                                            </div>
                                            <p className="text-muted small mb-0">{item.desc}</p>
                                        </div>
                                        <button
                                            onClick={() => navigate(item.route)}
                                            className="btn btn-outline-primary btn-sm flex-shrink-0 d-flex align-items-center gap-1"
                                        >
                                            {item.action} <RiArrowRightLine />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="col-12 col-lg-5">
                            <div className="card border p-3 rounded-4 bg-light h-100">
                                <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                                    <RiShieldCheckLine className="text-primary" /> 1-Click Role Switcher
                                </h6>
                                <p className="text-muted small mb-3">
                                    Log in with any of these pre-configured accounts during the live presentation:
                                </p>

                                <div className="d-flex flex-column gap-2">
                                    {[
                                        { role: 'Medical Director (Admin)', email: 'admin@careplus.com', branch: 'CarePlus Metro Branch' },
                                        { role: 'Attending Physician (Doctor)', email: 'dr.chen@careplus.com', branch: 'CarePlus Metro Branch' },
                                        { role: 'Clinic Triage Nurse (Staff)', email: 'staff@careplus.com', branch: 'CarePlus Metro Branch' },
                                        { role: 'Chief MedTech (Laboratory)', email: 'lab@careplus.com', branch: 'CarePlus Northside Branch' },
                                        { role: 'Billing Cashier (Finance)', email: 'billing@careplus.com', branch: 'CarePlus Metro Branch' },
                                        { role: 'Patient Beneficiary (Portal)', email: 'john.doe@gmail.com', branch: 'Metro Branch' }
                                    ].map((acc, idx) => (
                                        <div key={idx} className="p-2 rounded-2 bg-white border d-flex align-items-center justify-content-between">
                                            <div className="overflow-hidden me-2">
                                                <div className="fw-bold small text-dark text-truncate">{acc.role}</div>
                                                <div className="text-muted" style={{ fontSize: '11px' }}>{acc.email} &bull; {acc.branch}</div>
                                            </div>
                                            <span className="badge bg-light text-secondary border" style={{ fontSize: '10px' }}>
                                                Live Active
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-3 p-3 bg-white rounded-3 border">
                                    <div className="small text-muted fw-semibold mb-1">Presentation Tip:</div>
                                    <p className="text-secondary small mb-0">
                                        Use the <strong>"Active Facility"</strong> switcher located in the top navigation header at any time to demonstrate real-time branch filtering between Metro and Northside clinics!
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EnterpriseArchitecturePortal;
