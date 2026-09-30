import React, { useState } from 'react';
import {
    RiCompass3Line, RiFlowChart, RiFileTextLine, RiShieldKeyholeLine,
    RiLayoutMasonryLine, RiNodeTree, RiCheckDoubleLine, RiBuilding4Line,
    RiUserSharedLine, RiServerLine, RiDatabase2Line, RiArrowRightLine,
    RiAlertLine, RiCheckboxCircleLine, RiCodeBoxLine
} from 'react-icons/ri';

const EnterpriseArchitecturePortal = () => {
    const [activeOutput, setActiveOutput] = useState('eaDiagram'); // 'analysis' | 'asIs' | 'requirements' | 'roles' | 'toBe' | 'eaDiagram'

    return (
        <div className="container-fluid p-3 p-md-4 animate__animated animate__fadeIn">
            {/* Header Banner */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 p-4 rounded-4 shadow-sm bg-white border">
                <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                        <span className="badge rounded-pill bg-dark text-white px-3 py-1 fw-bold">
                            <RiCompass3Line className="me-1" /> Enterprise Architecture (ENTARC) Framework
                        </span>
                        <span className="badge rounded-pill bg-primary bg-opacity-10 text-primary px-3 py-1">
                            Group 2 Capstone Deliverables
                        </span>
                    </div>
                    <h2 className="fw-bold mb-1 text-dark">CarePlus Enterprise Architecture & System Blueprint</h2>
                    <p className="text-muted small mb-0">
                        Official Academic & Architectural Artifacts for Group 2: CarePlus Clinic Management System. Covering Business Analysis, As-Is / To-Be process workflows, RBAC matrix, and TOGAF 4-Layer Enterprise Architecture.
                    </p>
                </div>
            </div>

            {/* Navigation Tabs for Expected Outputs */}
            <div className="row g-2 mb-4">
                {[
                    { id: 'analysis', label: '1. Business Analysis', icon: <RiFileTextLine /> },
                    { id: 'asIs', label: '2. As-Is Process Diagram', icon: <RiFlowChart /> },
                    { id: 'requirements', label: '3. Business Requirements', icon: <RiCheckDoubleLine /> },
                    { id: 'roles', label: '5. User Roles & Access', icon: <RiShieldKeyholeLine /> },
                    { id: 'toBe', label: '6. To-Be Process Diagram', icon: <RiFlowChart /> },
                    { id: 'eaDiagram', label: '7. Enterprise Architecture (EA)', icon: <RiNodeTree /> }
                ].map(tab => (
                    <div key={tab.id} className="col-6 col-md-4 col-lg-2">
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

                    <div className="row g-4 mb-4">
                        <div className="col-12 col-lg-6">
                            <div className="p-4 rounded-4 bg-light border h-100">
                                <h5 className="fw-bold text-danger d-flex align-items-center gap-2 mb-3">
                                    <RiAlertLine /> Current Operational Bottlenecks (The Problem)
                                </h5>
                                <p className="text-secondary">
                                    CarePlus currently operates two clinical branches (Metro Main Clinic and Northside Diagnostic Specialty Clinic). Prior to this system proposal, operations were hindered by severe tool fragmentation:
                                </p>
                                <ul className="text-secondary small mb-0 lh-lg">
                                    <li><strong>Siloed Patient Records:</strong> Patient registration and medical records were kept on physical paper index cards or isolated local machines, resulting in duplicate registrations and zero cross-branch record visibility.</li>
                                    <li><strong>Decoupled Appointment Booking:</strong> Handled via disconnected spreadsheets and phone calls, causing frequent double-bookings and chair scheduling conflicts between physicians.</li>
                                    <li><strong>Delayed Laboratory Turnaround:</strong> Diagnostic requests from Metro Branch had to be physically transported to Northside, with result slips manually transcribed, leading to transcription errors and 24-48h delays.</li>
                                    <li><strong>Fragmented Billing Reconciliations:</strong> Cashiers used standalone non-integrated point-of-sale registers, making it impossible to apply unified statutory discounts (Senior/PWD/PhilHealth) or generate multi-branch revenue audits.</li>
                                </ul>
                            </div>
                        </div>

                        <div className="col-12 col-lg-6">
                            <div className="p-4 rounded-4 bg-primary bg-opacity-10 border border-primary border-opacity-25 h-100">
                                <h5 className="fw-bold text-primary d-flex align-items-center gap-2 mb-3">
                                    <RiCheckboxCircleLine /> Proposed System Solution & Strategic Objectives
                                </h5>
                                <p className="text-dark">
                                    The CarePlus Clinic Management System establishes an integrated enterprise healthcare platform connecting both clinic branches into a single authoritative digital nervous system:
                                </p>
                                <ul className="text-dark small mb-0 lh-lg">
                                    <li><strong>Single Source of Patient Truth:</strong> Unified Electronic Health Record (EHR) accessible securely by authorized clinicians across Metro and Northside.</li>
                                    <li><strong>Automated Diagnostic Flow:</strong> Doctor consultation module automatically triggers digital laboratory requisitions, which route instantly to the laboratory technologist workbench.</li>
                                    <li><strong>Automated Revenue Cycle:</strong> Invoicing automatically aggregates doctor professional fees, ordered lab items, and statutory deductions into standardized receipts.</li>
                                    <li><strong>Role-Based Security & Governance:</strong> Complete data protection and HIPAA/DPA audit trails logging every record access across all endpoints.</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 rounded-4 bg-white border">
                        <h5 className="fw-bold text-dark mb-3">Key Performance Indicators (KPIs) Target Matrix</h5>
                        <div className="row g-3 text-center">
                            <div className="col-6 col-md-3">
                                <div className="p-3 bg-light rounded-3">
                                    <div className="display-6 fw-bold text-primary">-65%</div>
                                    <div className="small text-muted mt-1">Patient Check-In Wait Times</div>
                                </div>
                            </div>
                            <div className="col-6 col-md-3">
                                <div className="p-3 bg-light rounded-3">
                                    <div className="display-6 fw-bold text-success">100%</div>
                                    <div className="small text-muted mt-1">Cross-Branch Record Availability</div>
                                </div>
                            </div>
                            <div className="col-6 col-md-3">
                                <div className="p-3 bg-light rounded-3">
                                    <div className="display-6 fw-bold text-info">Zero</div>
                                    <div className="small text-muted mt-1">Duplicate Registrations & Lost Charts</div>
                                </div>
                            </div>
                            <div className="col-6 col-md-3">
                                <div className="p-3 bg-light rounded-3">
                                    <div className="display-6 fw-bold text-warning text-dark">&lt; 1 hr</div>
                                    <div className="small text-muted mt-1">Routine Lab Diagnostic Turnaround</div>
                                </div>
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
                        <h4 className="fw-bold mb-0 text-dark">As-Is Process Workflow (Legacy Disjointed Operations)</h4>
                    </div>
                    <p className="text-muted small mb-4">
                        Visual representation of how CarePlus previously operated across its two branches with siloed, disconnected manual tools.
                    </p>

                    <div className="p-4 bg-light rounded-4 border mb-4">
                        <div className="d-flex flex-column gap-3">
                            <div className="p-3 bg-white rounded-3 border-start border-danger border-4 shadow-sm">
                                <div className="fw-bold text-danger mb-1">Step 1: Patient Arrival & Registration (Separate Paper Tool)</div>
                                <div className="small text-muted">Patient arrives at Branch 1 (Metro) or Branch 2 (Northside). Receptionist hands out paper forms. If patient visits the other branch next week, they are registered as a brand new patient.</div>
                            </div>
                            <div className="text-center text-muted"><RiArrowRightLine style={{ transform: 'rotate(90deg)' }} /></div>

                            <div className="p-3 bg-white rounded-3 border-start border-warning border-4 shadow-sm">
                                <div className="fw-bold text-warning text-dark mb-1">Step 2: Appointment Scheduling (Standalone Spreadsheet)</div>
                                <div className="small text-muted">Clinic staff maintains appointments in an offline Excel sheet. Doctors at the other branch have no visibility into physician availability or schedule changes.</div>
                            </div>
                            <div className="text-center text-muted"><RiArrowRightLine style={{ transform: 'rotate(90deg)' }} /></div>

                            <div className="p-3 bg-white rounded-3 border-start border-secondary border-4 shadow-sm">
                                <div className="fw-bold text-secondary mb-1">Step 3: Consultation & Handwritten Notes (Physical Paper Folder)</div>
                                <div className="small text-muted">Physician writes consultation notes and prescriptions by hand on physical charts. Charts are filed in physical cabinets and cannot be viewed by clinicians at the other branch.</div>
                            </div>
                            <div className="text-center text-muted"><RiArrowRightLine style={{ transform: 'rotate(90deg)' }} /></div>

                            <div className="p-3 bg-white rounded-3 border-start border-danger border-4 shadow-sm">
                                <div className="fw-bold text-danger mb-1">Step 4: Laboratory Requests & Results (Manual Requisition & Phone Calls)</div>
                                <div className="small text-muted">Physician issues paper lab order. If specialized blood chemistry is needed, patient must travel to Northside branch. Results are typed into a standalone PC, printed, and physically carried back.</div>
                            </div>
                            <div className="text-center text-muted"><RiArrowRightLine style={{ transform: 'rotate(90deg)' }} /></div>

                            <div className="p-3 bg-white rounded-3 border-start border-dark border-4 shadow-sm">
                                <div className="fw-bold text-dark mb-1">Step 5: Billing & Invoicing (Disconnected Cash Register)</div>
                                <div className="small text-muted">Cashier manually tallies handwritten doctor fees and printed lab slips. High risk of missing charges, calculation errors for Senior/PWD discounts, and zero consolidated financial reporting.</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* OUTPUT 3: Business Requirements */}
            {activeOutput === 'requirements' && (
                <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white">
                    <div className="d-flex align-items-center gap-2 mb-3">
                        <span className="badge bg-success px-3 py-1 rounded-pill">Deliverable Output #3</span>
                        <h4 className="fw-bold mb-0 text-dark">Business Requirements Specification</h4>
                    </div>

                    <div className="table-responsive mb-4">
                        <table className="table table-bordered align-middle">
                            <thead className="table-light small">
                                <tr>
                                    <th style={{ width: '100px' }}>Req ID</th>
                                    <th>Requirement Category</th>
                                    <th>Business Requirement Description</th>
                                    <th>Priority</th>
                                </tr>
                            </thead>
                            <tbody className="small">
                                <tr>
                                    <td className="fw-bold text-primary">FR-01</td>
                                    <td>Patient Registration</td>
                                    <td>The system must allow walk-in and online patient registration with multi-branch allocation (Metro vs Northside), emergency contacts, blood type, and insurance details.</td>
                                    <td><span className="badge bg-danger">Critical</span></td>
                                </tr>
                                <tr>
                                    <td className="fw-bold text-primary">FR-02</td>
                                    <td>Appointment Scheduling</td>
                                    <td>The system must provide calendar scheduling with branch selection, physician selection, service category, and status lifecycle (Pending, Confirmed, Completed).</td>
                                    <td><span className="badge bg-danger">Critical</span></td>
                                </tr>
                                <tr>
                                    <td className="fw-bold text-primary">FR-03</td>
                                    <td>Doctor Consultation Records</td>
                                    <td>The system must record vital signs, chief complaints, symptoms, primary clinical diagnoses, electronic prescriptions (Rx), and physician follow-up advice.</td>
                                    <td><span className="badge bg-danger">Critical</span></td>
                                </tr>
                                <tr>
                                    <td className="fw-bold text-primary">FR-04</td>
                                    <td>Laboratory Requests & Results</td>
                                    <td>The system must support direct lab test requisitioning from consultation, tracking specimen analysis, encoding results with normal reference ranges/flags, and printing official lab slips.</td>
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
                            <thead className="table-light small">
                                <tr>
                                    <th className="text-start">Functional Module / Feature</th>
                                    <th>Admin / Director</th>
                                    <th>Doctor / Physician</th>
                                    <th>Clinical Staff / Nurse</th>
                                    <th>Laboratory Specialist</th>
                                    <th>Billing Cashier</th>
                                    <th>Patient</th>
                                </tr>
                            </thead>
                            <tbody className="small">
                                <tr>
                                    <td className="text-start fw-semibold">Patient Registration</td>
                                    <td><span className="badge bg-success">Full Control</span></td>
                                    <td><span className="badge bg-info text-dark">View</span></td>
                                    <td><span className="badge bg-success">Create / Edit</span></td>
                                    <td><span className="badge bg-info text-dark">View</span></td>
                                    <td><span className="badge bg-info text-dark">View</span></td>
                                    <td><span className="badge bg-secondary">Self Only</span></td>
                                </tr>
                                <tr>
                                    <td className="text-start fw-semibold">Appointment Scheduling</td>
                                    <td><span className="badge bg-success">Full Control</span></td>
                                    <td><span className="badge bg-info text-dark">View Schedule</span></td>
                                    <td><span className="badge bg-success">Create / Confirm</span></td>
                                    <td><span className="badge bg-secondary">No Access</span></td>
                                    <td><span className="badge bg-secondary">No Access</span></td>
                                    <td><span className="badge bg-primary">Book Own</span></td>
                                </tr>
                                <tr>
                                    <td className="text-start fw-semibold">Doctor Consultations & Rx</td>
                                    <td><span className="badge bg-info text-dark">View / Audit</span></td>
                                    <td><span className="badge bg-success">Create / Prescribe</span></td>
                                    <td><span className="badge bg-info text-dark">Assist / View</span></td>
                                    <td><span className="badge bg-secondary">No Access</span></td>
                                    <td><span className="badge bg-secondary">No Access</span></td>
                                    <td><span className="badge bg-info text-dark">View Own Rx</span></td>
                                </tr>
                                <tr>
                                    <td className="text-start fw-semibold">Laboratory Requisition & Results</td>
                                    <td><span className="badge bg-success">Full Control</span></td>
                                    <td><span className="badge bg-primary">Order / View</span></td>
                                    <td><span className="badge bg-info text-dark">View Status</span></td>
                                    <td><span className="badge bg-success">Encode & Release</span></td>
                                    <td><span className="badge bg-secondary">No Access</span></td>
                                    <td><span className="badge bg-info text-dark">View Own Slips</span></td>
                                </tr>
                                <tr>
                                    <td className="text-start fw-semibold">Billing, Invoices & Payments</td>
                                    <td><span className="badge bg-success">Full Control</span></td>
                                    <td><span className="badge bg-secondary">No Access</span></td>
                                    <td><span className="badge bg-info text-dark">View Invoice</span></td>
                                    <td><span className="badge bg-secondary">No Access</span></td>
                                    <td><span className="badge bg-success">Collect & Receipt</span></td>
                                    <td><span className="badge bg-info text-dark">View Own Bills</span></td>
                                </tr>
                                <tr>
                                    <td className="text-start fw-semibold">Medical Reports & Analytics</td>
                                    <td><span className="badge bg-success">Multi-Branch KPIs</span></td>
                                    <td><span className="badge bg-primary">Clinical Summary</span></td>
                                    <td><span className="badge bg-info text-dark">Branch Reports</span></td>
                                    <td><span className="badge bg-secondary">No Access</span></td>
                                    <td><span className="badge bg-info text-dark">Revenue Reports</span></td>
                                    <td><span className="badge bg-info text-dark">Personal Records</span></td>
                                </tr>
                                <tr>
                                    <td className="text-start fw-semibold">Audit Logs & Security Access</td>
                                    <td><span className="badge bg-success">Full Audit Trail</span></td>
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
                        <h4 className="fw-bold mb-0 text-dark">To-Be Process Workflow (Integrated CarePlus Enterprise Solution)</h4>
                    </div>
                    <p className="text-muted small mb-4">
                        Streamlined, cohesive digital workflow integrating both Metro and Northside branches into a unified operational loop.
                    </p>

                    <div className="row g-3">
                        <div className="col-12 col-md-6 col-lg-4">
                            <div className="p-3 bg-light rounded-3 border h-100">
                                <div className="badge bg-primary mb-2">Step 1</div>
                                <h6 className="fw-bold text-dark">Unified Patient Intake</h6>
                                <p className="small text-muted mb-0">
                                    Patient registers either online or via walk-in desk at Metro or Northside branch. A permanent master digital record (PID) is established.
                                </p>
                            </div>
                        </div>

                        <div className="col-12 col-md-6 col-lg-4">
                            <div className="p-3 bg-light rounded-3 border h-100">
                                <div className="badge bg-primary mb-2">Step 2</div>
                                <h6 className="fw-bold text-dark">Multi-Branch Appointment Triage</h6>
                                <p className="small text-muted mb-0">
                                    Appointment is confirmed on the centralized calendar with real-time doctor availability and automated room queue allocation.
                                </p>
                            </div>
                        </div>

                        <div className="col-12 col-md-6 col-lg-4">
                            <div className="p-3 bg-light rounded-3 border h-100">
                                <div className="badge bg-primary mb-2">Step 3</div>
                                <h6 className="fw-bold text-dark">Physician Consultation & Digital Rx</h6>
                                <p className="small text-muted mb-0">
                                    Doctor records vital signs, chief complaint, diagnosis, and issues electronic prescription. Any needed lab test is selected with 1 click.
                                </p>
                            </div>
                        </div>

                        <div className="col-12 col-md-6 col-lg-4">
                            <div className="p-3 bg-light rounded-3 border h-100">
                                <div className="badge bg-info text-dark mb-2">Step 4</div>
                                <h6 className="fw-bold text-dark">Automated Lab Routing</h6>
                                <p className="small text-muted mb-0">
                                    Requisition routes immediately to the diagnostic laboratory queue. MedTech processes specimen and encodes verified result parameters.
                                </p>
                            </div>
                        </div>

                        <div className="col-12 col-md-6 col-lg-4">
                            <div className="p-3 bg-light rounded-3 border h-100">
                                <div className="badge bg-success mb-2">Step 5</div>
                                <h6 className="fw-bold text-dark">Unified Itemized Billing</h6>
                                <p className="small text-muted mb-0">
                                    Invoice aggregates doctor consultation fee + laboratory procedures automatically. Statutory discount applied and receipt generated.
                                </p>
                            </div>
                        </div>

                        <div className="col-12 col-md-6 col-lg-4">
                            <div className="p-3 bg-light rounded-3 border h-100">
                                <div className="badge bg-dark mb-2">Step 6</div>
                                <h6 className="fw-bold text-dark">EHR Archival & Multi-Branch Access</h6>
                                <p className="small text-muted mb-0">
                                    All encounter data, lab slips, and receipts are bound to patient EHR, accessible instantly should the patient visit either branch next.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* OUTPUT 7: Enterprise Architecture (EA) Diagram (TOGAF 4-Layer) */}
            {activeOutput === 'eaDiagram' && (
                <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white">
                    <div className="d-flex align-items-center gap-2 mb-3">
                        <span className="badge bg-dark text-white px-3 py-1 rounded-pill">Deliverable Output #7</span>
                        <h4 className="fw-bold mb-0 text-dark">Enterprise Architecture (EA) 4-Layer Framework</h4>
                    </div>
                    <p className="text-muted small mb-4">
                        Standardized TOGAF (The Open Group Architecture Framework) architectural representation connecting Business, Application, Data, and Technology tiers.
                    </p>

                    <div className="d-flex flex-column gap-3">
                        {/* Layer 1: Business Architecture */}
                        <div className="p-4 rounded-4 border bg-light">
                            <div className="d-flex align-items-center gap-2 mb-2">
                                <span className="badge bg-primary px-3 py-1">Layer 1</span>
                                <h5 className="fw-bold text-primary mb-0">Business Architecture Tier</h5>
                            </div>
                            <p className="text-secondary small mb-3">
                                Represents CarePlus business capabilities, stakeholder value streams, and clinical governance spanning both clinic branches.
                            </p>
                            <div className="row g-2">
                                <div className="col-md-3">
                                    <div className="p-2 px-3 bg-white rounded border text-center small fw-semibold">Patient Administration & Triage</div>
                                </div>
                                <div className="col-md-3">
                                    <div className="p-2 px-3 bg-white rounded border text-center small fw-semibold">Ambulatory & Specialist Consultations</div>
                                </div>
                                <div className="col-md-3">
                                    <div className="p-2 px-3 bg-white rounded border text-center small fw-semibold">Pathology & Diagnostic Laboratory</div>
                                </div>
                                <div className="col-md-3">
                                    <div className="p-2 px-3 bg-white rounded border text-center small fw-semibold">Financial & Statutory Revenue Management</div>
                                </div>
                            </div>
                        </div>

                        {/* Layer 2: Application Architecture */}
                        <div className="p-4 rounded-4 border bg-light">
                            <div className="d-flex align-items-center gap-2 mb-2">
                                <span className="badge bg-success px-3 py-1">Layer 2</span>
                                <h5 className="fw-bold text-success mb-0">Application Architecture Tier</h5>
                            </div>
                            <p className="text-secondary small mb-3">
                                Modular software services, presentation layer, and decoupled business logic components.
                            </p>
                            <div className="row g-2">
                                <div className="col-md-4">
                                    <div className="p-3 bg-white rounded border">
                                        <div className="fw-bold text-dark small">Frontend Clinical SPA</div>
                                        <div className="text-muted small">React 19 • React Router 7 • Responsive Bootstrap 5 • SweetAlert2 Notifications</div>
                                    </div>
                                </div>
                                <div className="col-md-4">
                                    <div className="p-3 bg-white rounded border">
                                        <div className="fw-bold text-dark small">Backend REST API Services</div>
                                        <div className="text-muted small">Node.js Express Engine • Modular API Endpoints (`/consultations`, `/laboratory`, `/billing`)</div>
                                    </div>
                                </div>
                                <div className="col-md-4">
                                    <div className="p-3 bg-white rounded border">
                                        <div className="fw-bold text-dark small">Security & Realtime Engine</div>
                                        <div className="text-muted small">JWT Token Bearer Authentication • BroadcastChannel Multi-tab Sync • Rate Limiters</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Layer 3: Data Architecture */}
                        <div className="p-4 rounded-4 border bg-light">
                            <div className="d-flex align-items-center gap-2 mb-2">
                                <span className="badge bg-info text-dark px-3 py-1">Layer 3</span>
                                <h5 className="fw-bold text-dark mb-0">Data Architecture Tier</h5>
                            </div>
                            <p className="text-secondary small mb-3">
                                Relational data models, persistent storage entities, and clinical schemas.
                            </p>
                            <div className="row g-2">
                                <div className="col-md-3">
                                    <div className="p-2 px-3 bg-white rounded border text-center small fw-semibold">`users` & RBAC Credentials</div>
                                </div>
                                <div className="col-md-3">
                                    <div className="p-2 px-3 bg-white rounded border text-center small fw-semibold">`appointments` (Multi-Branch)</div>
                                </div>
                                <div className="col-md-3">
                                    <div className="p-2 px-3 bg-white rounded border text-center small fw-semibold">`consultation_records` & Rx</div>
                                </div>
                                <div className="col-md-3">
                                    <div className="p-2 px-3 bg-white rounded border text-center small fw-semibold">`laboratory_records` & Results</div>
                                </div>
                                <div className="col-md-4">
                                    <div className="p-2 px-3 bg-white rounded border text-center small fw-semibold">`billing_records` & OR Receipts</div>
                                </div>
                                <div className="col-md-4">
                                    <div className="p-2 px-3 bg-white rounded border text-center small fw-semibold">`medical_records` (Centralized EHR)</div>
                                </div>
                                <div className="col-md-4">
                                    <div className="p-2 px-3 bg-white rounded border text-center small fw-semibold">`audit_logs` (HIPAA/DPA Traceability)</div>
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
        </div>
    );
};

export default EnterpriseArchitecturePortal;
