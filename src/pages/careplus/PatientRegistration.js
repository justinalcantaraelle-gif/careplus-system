import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
    RiUserAddLine, RiSearchLine, RiBuilding4Line, RiUserHeartLine,
    RiCalendarCheckLine, RiStethoscopeLine, RiFlaskLine, RiMoneyDollarCircleLine,
    RiFileTextLine, RiPhoneLine, RiMailLine, RiMapPinLine, RiHeartPulseLine,
    RiShieldCheckLine, RiCheckLine, RiMedicineBottleLine, RiTimeLine,
    RiCloseLine, RiCheckboxCircleLine, RiInformationLine, RiShieldUserLine
} from 'react-icons/ri';
import { readDatabase, writeDatabase, readSession } from '../../utils/storage';
import { CLINIC_BRANCHES, CLINIC_DOCTORS } from '../../utils/careplusData';
import { addAuditLog } from '../../services/auditLogger';

// Master Clinical Reference Presets
const PRESET_CONDITIONS = [
    'Hypertension / High BP',
    'Type 2 Diabetes',
    'Type 1 Diabetes',
    'Asthma / COPD / Respiratory',
    'Cardiovascular / Heart Disease',
    'Chronic Kidney Disease (CKD)',
    'Thyroid Disorder',
    'Cancer / Malignancy History',
    'Bleeding / Clotting Disorder',
    'Epilepsy / Seizures',
    'Acid Reflux / GERD / Peptic Ulcer',
    'Hepatitis / Liver Disease'
];

const DRUG_ALLERGY_OPTIONS = [
    'None known',
    'Penicillin / Amoxicillin',
    'Sulfa Drugs / Sulfonamides',
    'Aspirin / NSAIDs (Ibuprofen, Mefenamic)',
    'Cephalosporins',
    'Local Anesthesia (Lidocaine)',
    'Codeine / Opioids',
    'Other Drug Allergy'
];

const FOOD_ALLERGY_OPTIONS = [
    'None known',
    'Seafood / Shellfish',
    'Peanuts / Tree Nuts',
    'Eggs / Dairy Products',
    'Soy / Wheat / Gluten',
    'Latex',
    'Contrast Dye / Iodine',
    'Other Food / Environmental'
];

const PATIENT_CLASSIFICATIONS = [
    'Regular Patient',
    'Senior Citizen (OSCA 20%)',
    'Person with Disability (PWD 20%)',
    'Pediatric Patient (< 18 yrs)',
    'Corporate HMO Account / Retainer',
    'PhilHealth Subsidized',
    'Indigent / Charity Service'
];

const HMO_PROVIDERS = [
    'None (Self-Pay)',
    'Maxicare Healthcare',
    'Intellicare (Asalus)',
    'Medicard Philippines',
    'PhilCare',
    'Etiqa Life & General',
    'Pacific Cross',
    'Avega Managed Care',
    'Cigna Global',
    'Generali Philippines',
    'Caritas Health Shield',
    'Insular Health Care (InLife)',
    'Other HMO / Private Insurance'
];

const CIVIL_STATUS_OPTIONS = [
    'Single',
    'Married',
    'Widowed',
    'Separated',
    'Divorced',
    'Child / Minor'
];

const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'Unknown'];

const TRIAGE_ACUITY_LEVELS = [
    { level: 'Level 1 - Immediate / Resuscitation', badge: 'bg-danger text-white' },
    { level: 'Level 2 - Emergency / Very Urgent', badge: 'bg-danger bg-opacity-75 text-white' },
    { level: 'Level 3 - Urgent Care', badge: 'bg-warning text-dark' },
    { level: 'Level 4 - Standard Walk-in Consultation', badge: 'bg-primary text-white' },
    { level: 'Level 5 - Non-Urgent / Routine Checkup', badge: 'bg-info bg-opacity-75 text-dark' }
];

const calculateAge = (dobString) => {
    if (!dobString) return '';
    const today = new Date();
    const birthDate = new Date(dobString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age >= 0 ? age : 0;
};

const PatientRegistration = () => {
    const navigate = useNavigate();
    const session = readSession() || {};
    const [db, setDb] = useState(() => readDatabase({}));
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBranch, setSelectedBranch] = useState('All');
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [selectedPatientDetails, setSelectedPatientDetails] = useState(null);

    // Comprehensive Registration Form State
    const initialRegForm = {
        // --- 1. Demographics & Identity ---
        fullName: '',
        nickname: '',
        email: '',
        phone: '',
        secondaryPhone: '',
        birthdate: '',
        age: '',
        gender: 'Female',
        civilStatus: 'Single',
        nationality: 'Filipino',
        religion: 'Roman Catholic',
        bloodType: 'O+',
        occupation: '',
        employer: '',
        address: '',
        city: 'Metro Manila',
        province: '',
        zipCode: '',

        // --- 2. Family & Emergency Contacts ---
        emergencyContact: '',
        emergencyRelationship: 'Spouse',
        emergencyPhone: '',
        emergencyAltPhone: '',
        mothersMaidenName: '',
        fathersName: '',
        guardianName: '',
        guardianContact: '',

        // --- 3. Clinic Branch, Insurance & IDs ---
        branch: session.branch || CLINIC_BRANCHES[0].name,
        patient_type: 'Regular Patient',
        governmentIdNumber: '',
        philhealthNumber: '',
        nationalIdNumber: '',
        insuranceProvider: 'None (Self-Pay)',
        hmoCardNumber: '',
        hmoApprovalCode: '',
        corporateAccountName: '',

        // --- 4. Comprehensive Medical Baseline ---
        allergies: 'None known',
        drugAllergies: 'None known',
        foodAllergies: 'None known',
        allergyReactions: '',
        selectedConditions: [],
        chronicConditions: 'None reported',
        otherConditionsText: '',
        maintenanceMeds: '',
        pastSurgeries: '',
        familyHistory: '',
        smokingStatus: 'Non-Smoker',
        alcoholUse: 'Non-Drinker',
        dietaryRestrictions: 'None',
        isPregnant: 'No',
        isNursing: 'No',
        lastMenstrualPeriod: '',
        vaccinationHistory: 'COVID-19 Complete',

        // --- 5. Walk-in Clinical Triage & Intake ---
        chiefComplaint: '',
        complaintDuration: '2 days',
        painScale: '0',
        bpSystolic: '120',
        bpDiastolic: '80',
        temperature: '36.5',
        pulseRate: '75',
        respiratoryRate: '18',
        oxygenSaturation: '98',
        heightCm: '165',
        weight: '60',
        bloodSugarRBS: '',
        triageAcuity: 'Level 4 - Standard Walk-in Consultation',
        addToQueueToday: false,
        queueService: 'General Consultation',
        queueDoctor: '',
        triageNotes: '',

        // --- 6. Consent & Attestation ---
        dataPrivacyConsent: true,
        treatmentConsent: true
    };

    const [regForm, setRegForm] = useState(initialRegForm);

    useEffect(() => {
        const sync = () => setDb(readDatabase({}));
        window.addEventListener('careplus_db_updated', sync);
        window.addEventListener('storage', sync);
        return () => {
            window.removeEventListener('careplus_db_updated', sync);
            window.removeEventListener('storage', sync);
        };
    }, []);

    const patients = useMemo(() => {
        return (db.users || []).filter(u => {
            const isPatient = (u.role || '').toLowerCase() === 'patient';
            if (!isPatient) return false;
            const matchesBranch = selectedBranch === 'All' || u.branch === selectedBranch;
            const query = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm ||
                (u.fullName || '').toLowerCase().includes(query) ||
                (u.nickname || '').toLowerCase().includes(query) ||
                (u.email || '').toLowerCase().includes(query) ||
                (u.phone || '').toLowerCase().includes(query) ||
                (u.philhealthNumber || '').toLowerCase().includes(query) ||
                (u.governmentIdNumber || '').toLowerCase().includes(query) ||
                (u.insuranceProvider || '').toLowerCase().includes(query);
            return matchesBranch && matchesSearch;
        });
    }, [db.users, selectedBranch, searchTerm]);

    // Derived Summary Metrics
    const metrics = useMemo(() => {
        const total = (db.users || []).filter(u => (u.role || '').toLowerCase() === 'patient').length;
        const seniorPwd = (db.users || []).filter(u =>
            (u.role || '').toLowerCase() === 'patient' &&
            (u.patient_type?.includes('Senior') || u.patient_type?.includes('PWD') || u.governmentIdNumber)
        ).length;
        const insured = (db.users || []).filter(u =>
            (u.role || '').toLowerCase() === 'patient' &&
            u.insuranceProvider && !u.insuranceProvider.includes('Self-Pay') && !u.insuranceProvider.includes('None')
        ).length;
        return { total, seniorPwd, insured };
    }, [db.users]);

    // Realtime BMI Calculation
    const calculatedBmi = useMemo(() => {
        const h = parseFloat(regForm.heightCm) / 100;
        const w = parseFloat(regForm.weight);
        if (!h || !w || h <= 0 || w <= 0) return null;
        const bmiVal = (w / (h * h)).toFixed(1);
        let cat = 'Normal Weight';
        let badgeClass = 'badge bg-success bg-opacity-15 text-success border border-success';
        if (bmiVal < 18.5) {
            cat = 'Underweight';
            badgeClass = 'badge bg-warning bg-opacity-15 text-dark border border-warning';
        } else if (bmiVal >= 18.5 && bmiVal < 25) {
            cat = 'Normal Weight';
            badgeClass = 'badge bg-success bg-opacity-15 text-success border border-success';
        } else if (bmiVal >= 25 && bmiVal < 30) {
            cat = 'Overweight';
            badgeClass = 'badge bg-warning bg-opacity-25 text-dark border border-warning';
        } else {
            cat = 'Obese';
            badgeClass = 'badge bg-danger bg-opacity-15 text-danger border border-danger';
        }
        return { val: bmiVal, category: cat, badgeClass };
    }, [regForm.heightCm, regForm.weight]);

    // Realtime Blood Pressure Status
    const bpStatus = useMemo(() => {
        const sys = parseInt(regForm.bpSystolic, 10);
        const dia = parseInt(regForm.bpDiastolic, 10);
        if (!sys || !dia) return null;
        if (sys < 120 && dia < 80) return { label: 'Optimal Normal BP', color: 'badge bg-success bg-opacity-10 text-success border border-success' };
        if (sys <= 129 && dia < 80) return { label: 'Elevated BP', color: 'badge bg-warning bg-opacity-10 text-dark border border-warning' };
        if (sys <= 139 || dia <= 89) return { label: 'Stage 1 Hypertension', color: 'badge bg-warning bg-opacity-15 text-dark border border-warning' };
        if (sys >= 180 || dia >= 120) return { label: 'Hypertensive Crisis (Urgent)', color: 'badge bg-danger text-white' };
        if (sys >= 140 || dia >= 90) return { label: 'Stage 2 Hypertension', color: 'badge bg-danger bg-opacity-15 text-danger border border-danger' };
        return null;
    }, [regForm.bpSystolic, regForm.bpDiastolic]);

    // Pain scale helper
    const getPainScaleInfo = (scale) => {
        const num = parseInt(scale, 10) || 0;
        if (num === 0) return { text: '0 - No Pain / Asymptomatic', color: 'text-success' };
        if (num <= 3) return { text: `${num} - Mild Discomfort`, color: 'text-info' };
        if (num <= 6) return { text: `${num} - Moderate Pain`, color: 'text-warning' };
        if (num <= 8) return { text: `${num} - Severe Distress`, color: 'text-danger' };
        return { text: `${num} - Worst / Agonizing Pain`, color: 'text-danger fw-bold' };
    };

    // Toggle chronic conditions
    const handleToggleCondition = (cond) => {
        setRegForm(prev => {
            const current = prev.selectedConditions || [];
            const next = current.includes(cond)
                ? current.filter(c => c !== cond)
                : [...current, cond];
            return {
                ...prev,
                selectedConditions: next,
                chronicConditions: next.length > 0 ? next.join(', ') : 'None reported'
            };
        });
    };

    const handleRegisterPatient = (e) => {
        e.preventDefault();
        if (!regForm.fullName || !regForm.email || !regForm.phone) {
            Swal.fire('Required Fields Missing', 'Please provide Full Legal Name, Email Address, and Mobile Number.', 'warning');
            return;
        }

        const emailLower = regForm.email.toLowerCase().trim();
        const exists = (db.users || []).some(u => (u.email || '').toLowerCase() === emailLower);
        if (exists) {
            Swal.fire('Duplicate Email', 'A patient with this email already exists in the CarePlus registry.', 'warning');
            return;
        }

        const newId = Date.now();
        const formattedEmergency = regForm.emergencyContact
            ? `${regForm.emergencyContact} (${regForm.emergencyRelationship || 'Contact'}) - ${regForm.emergencyPhone || regForm.phone}`
            : '';

        const calculatedAgeVal = calculateAge(regForm.birthdate) || regForm.age || '';

        const newUser = {
            id: newId,
            email: emailLower,
            password: 'patient123', // default registration password
            role: 'Patient',
            fullName: regForm.fullName.trim(),
            nickname: regForm.nickname.trim(),
            phone: regForm.phone.trim(),
            secondaryPhone: regForm.secondaryPhone.trim(),
            birthdate: regForm.birthdate,
            age: calculatedAgeVal,
            gender: regForm.gender,
            civilStatus: regForm.civilStatus,
            nationality: regForm.nationality,
            religion: regForm.religion,
            occupation: regForm.occupation,
            employer: regForm.employer,
            address: regForm.address,
            city: regForm.city,
            province: regForm.province,
            zipCode: regForm.zipCode,
            bloodType: regForm.bloodType,
            emergencyContact: formattedEmergency,
            emergencyRelationship: regForm.emergencyRelationship,
            emergencyPhone: regForm.emergencyPhone,
            emergencyAltPhone: regForm.emergencyAltPhone,
            mothersMaidenName: regForm.mothersMaidenName,
            fathersName: regForm.fathersName,
            guardianName: regForm.guardianName,
            guardianContact: regForm.guardianContact,
            branch: regForm.branch,
            patient_type: regForm.patient_type,
            governmentIdNumber: regForm.governmentIdNumber,
            philhealthNumber: regForm.philhealthNumber,
            nationalIdNumber: regForm.nationalIdNumber,
            insuranceProvider: regForm.insuranceProvider + (regForm.hmoCardNumber ? ` (Card: ${regForm.hmoCardNumber})` : ''),
            hmoCardNumber: regForm.hmoCardNumber,
            hmoApprovalCode: regForm.hmoApprovalCode,
            corporateAccountName: regForm.corporateAccountName,
            otp_status: 'Verified',
            created_at: new Date().toISOString()
        };

        // Combine all allergies
        const allAllergies = [
            regForm.allergies && regForm.allergies !== 'None known' ? regForm.allergies : null,
            regForm.drugAllergies && regForm.drugAllergies !== 'None known' ? `Drug: ${regForm.drugAllergies}` : null,
            regForm.foodAllergies && regForm.foodAllergies !== 'None known' ? `Food/Env: ${regForm.foodAllergies}` : null,
            regForm.allergyReactions ? `Reactions: ${regForm.allergyReactions}` : null
        ].filter(Boolean);

        // Combine all conditions
        const allConditions = [
            ...(regForm.selectedConditions || []),
            regForm.otherConditionsText ? `Other: ${regForm.otherConditionsText}` : null,
            regForm.chronicConditions && regForm.chronicConditions !== 'None reported' && !regForm.selectedConditions?.length ? regForm.chronicConditions : null
        ].filter(Boolean);

        // Create electronic medical history record & triage vitals
        const newMedicalRecords = {
            ...(db.medical_records || {}),
            [emailLower]: {
                name: regForm.fullName.trim(),
                nickname: regForm.nickname.trim(),
                email: emailLower,
                contactNumber: regForm.phone.trim(),
                secondaryPhone: regForm.secondaryPhone.trim(),
                birthday: regForm.birthdate,
                age: calculatedAgeVal,
                sex: regForm.gender,
                civilStatus: regForm.civilStatus,
                nationality: regForm.nationality,
                religion: regForm.religion,
                occupation: regForm.occupation,
                employer: regForm.employer,
                address: regForm.address,
                city: regForm.city,
                bloodType: regForm.bloodType,
                allergies: allAllergies.length > 0 ? allAllergies : ['None known'],
                drugAllergies: regForm.drugAllergies,
                foodAllergies: regForm.foodAllergies,
                allergyReactions: regForm.allergyReactions,
                conditions: allConditions.length > 0 ? allConditions : ['None reported'],
                maintenanceMeds: regForm.maintenanceMeds ? [regForm.maintenanceMeds] : [],
                pastSurgeries: regForm.pastSurgeries ? [regForm.pastSurgeries] : [],
                familyHistory: regForm.familyHistory,
                socialHistory: {
                    smoking: regForm.smokingStatus,
                    alcohol: regForm.alcoholUse,
                    diet: regForm.dietaryRestrictions
                },
                womensHealth: {
                    isPregnant: regForm.isPregnant,
                    isNursing: regForm.isNursing,
                    lastMenstrualPeriod: regForm.lastMenstrualPeriod
                },
                vaccinations: regForm.vaccinationHistory,
                emergencyContact: formattedEmergency,
                emergencyPhone: regForm.emergencyPhone,
                mothersMaidenName: regForm.mothersMaidenName,
                fathersName: regForm.fathersName,
                guardianName: regForm.guardianName,
                guardianContact: regForm.guardianContact,
                philhealthNumber: regForm.philhealthNumber,
                nationalIdNumber: regForm.nationalIdNumber,
                hmoDetails: `${regForm.insuranceProvider} - Card #${regForm.hmoCardNumber || 'N/A'}`,
                chiefComplaint: regForm.chiefComplaint || '',
                complaintDuration: regForm.complaintDuration || '',
                painScale: regForm.painScale || '0',
                triageAcuity: regForm.triageAcuity || 'Level 4 - Standard Walk-in Consultation',
                triageNotes: regForm.triageNotes || '',
                initialVitals: {
                    bloodPressure: regForm.bpSystolic && regForm.bpDiastolic ? `${regForm.bpSystolic}/${regForm.bpDiastolic} mmHg` : '',
                    temperature: regForm.temperature ? `${regForm.temperature} °C` : '',
                    pulseRate: regForm.pulseRate ? `${regForm.pulseRate} bpm` : '',
                    respiratoryRate: regForm.respiratoryRate ? `${regForm.respiratoryRate} cpm` : '',
                    oxygenSaturation: regForm.oxygenSaturation ? `${regForm.oxygenSaturation} %` : '',
                    height: regForm.heightCm ? `${regForm.heightCm} cm` : '',
                    weight: regForm.weight ? `${regForm.weight} kg` : '',
                    bmi: calculatedBmi ? `${calculatedBmi.val} (${calculatedBmi.category})` : '',
                    bloodSugarRBS: regForm.bloodSugarRBS ? `${regForm.bloodSugarRBS} mg/dL` : '',
                    recordedAt: new Date().toLocaleDateString()
                },
                hasConsented: regForm.dataPrivacyConsent && regForm.treatmentConsent,
                consentTimestamp: new Date().toISOString(),
                recordedBy: session.fullName || session.name || 'Admissions Staff',
                recordedByClinic: true,
                dateSubmitted: new Date().toISOString().split('T')[0]
            }
        };

        // If walk-in patient is routed immediately to today's queue
        const newAppointments = [...(db.appointments || [])];
        if (regForm.addToQueueToday) {
            const defaultDoctor = CLINIC_DOCTORS.find(d => d.branch === regForm.branch)?.name || CLINIC_DOCTORS[0]?.name || 'Dr. Robert Chen, MD';
            const assignedDoctor = regForm.queueDoctor || defaultDoctor;
            const newAppt = {
                id: Date.now() + 5,
                patientEmail: emailLower,
                patientName: regForm.fullName.trim(),
                patientPhone: regForm.phone.trim(),
                branch: regForm.branch,
                doctor: assignedDoctor,
                category: 'Walk-in Intake',
                service: regForm.queueService || 'General Consultation',
                duration: '30 mins',
                date: new Date().toISOString().split('T')[0],
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                notes: `Walk-in Admitted. Complaint: ${regForm.chiefComplaint || 'Consultation requested'} (${regForm.complaintDuration}). Pain: ${regForm.painScale}/10. Vitals: BP ${regForm.bpSystolic}/${regForm.bpDiastolic} mmHg, Temp ${regForm.temperature}°C, SpO2 ${regForm.oxygenSaturation}%, BMI ${calculatedBmi?.val || 'N/A'}. Acuity: ${regForm.triageAcuity}.`,
                status: 'Pending',
                priority: regForm.triageAcuity.includes('Level 1') || regForm.triageAcuity.includes('Level 2') ? 'Urgent' : 'Normal'
            };
            newAppointments.unshift(newAppt);
        }

        const newDb = {
            ...db,
            users: [newUser, ...(db.users || [])],
            medical_records: newMedicalRecords,
            appointments: newAppointments
        };

        writeDatabase(newDb);
        addAuditLog('Patient Registered', `Admitted patient ${newUser.fullName} (${newUser.email}) at ${newUser.branch}${regForm.addToQueueToday ? ' and added to active queue' : ''}`);

        Swal.fire({
            icon: 'success',
            title: 'Patient Master Record Created!',
            html: `<p><b>${newUser.fullName}</b> (PID-${String(newUser.id).slice(-4)}) has been registered at <b>${newUser.branch}</b>.</p>
                   ${regForm.addToQueueToday ? `<p class="text-success fw-bold small">✔ Admitted to today's active doctor queue for <b>${regForm.queueDoctor || 'Attending Physician'}</b>.</p>` : ''}
                   <p class="small text-muted mb-0">Electronic Medical Chart, clinical triage vitals, and portal account have been provisioned.</p>`,
            confirmButtonText: 'Great, Done!'
        });

        setShowRegisterModal(false);
        setRegForm(initialRegForm);
    };

    return (
        <div className="container-fluid p-3 p-md-4">
            {/* Header Banner */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 p-4 rounded-4 shadow-sm bg-white border">
                <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                        <span className="badge rounded-pill bg-primary bg-opacity-10 text-primary px-3 py-1 fw-bold">
                            <RiUserHeartLine className="me-1" /> Central Patient Administration
                        </span>
                        <span className="badge rounded-pill bg-light text-secondary border px-3 py-1">
                            Enterprise Master Patient Index (EMPI)
                        </span>
                    </div>
                    <h2 className="fw-bold mb-1 text-dark">Patient Registration & Medical Chart Roster</h2>
                    <p className="text-muted small mb-0">
                        Admit walk-in and online patients across Metro and Northside branches. Manage full demographic identity, family emergency contacts, HMO / PhilHealth coverage, complete clinical history, and nurse triage intake.
                    </p>
                </div>
                <div>
                    <button
                        onClick={() => {
                            setRegForm(initialRegForm);
                            setShowRegisterModal(true);
                        }}
                        className="btn btn-primary d-flex align-items-center gap-2 px-4 py-2 rounded-3 shadow-sm fw-semibold"
                    >
                        <RiUserAddLine size={19} /> Register Walk-in / New Patient
                    </button>
                </div>
            </div>

            {/* Metrics Ribbon */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-sm-6 col-lg-4">
                    <div className="card border-0 shadow-sm rounded-3 p-3 bg-white border-start border-4 border-primary">
                        <div className="small text-muted fw-semibold">Total Registered Patients</div>
                        <div className="fs-3 fw-bold text-dark">{metrics.total}</div>
                        <div className="small text-muted">Across all branches & clinical departments</div>
                    </div>
                </div>
                <div className="col-12 col-sm-6 col-lg-4">
                    <div className="card border-0 shadow-sm rounded-3 p-3 bg-white border-start border-4 border-warning">
                        <div className="small text-muted fw-semibold">Senior Citizen & PWD Patients</div>
                        <div className="fs-3 fw-bold text-dark">{metrics.seniorPwd}</div>
                        <div className="small text-muted">With verified OSCA / Magna Carta ID benefits</div>
                    </div>
                </div>
                <div className="col-12 col-sm-6 col-lg-4">
                    <div className="card border-0 shadow-sm rounded-3 p-3 bg-white border-start border-4 border-success">
                        <div className="small text-muted fw-semibold">Insured / HMO Policyholders</div>
                        <div className="fs-3 fw-bold text-dark">{metrics.insured}</div>
                        <div className="small text-muted">Maxicare, Intellicare, Medicard, PhilCare & Corporate</div>
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-md-6">
                    <div className="input-group bg-white rounded-3 shadow-sm border">
                        <span className="input-group-text bg-transparent border-0 text-muted">
                            <RiSearchLine />
                        </span>
                        <input
                            type="text"
                            className="form-control border-0 bg-transparent"
                            placeholder="Search by patient name, nickname, email, phone, PhilHealth PIN, or HMO..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button className="btn btn-link text-muted pe-3" onClick={() => setSearchTerm('')}>
                                <RiCloseLine />
                            </button>
                        )}
                    </div>
                </div>
                <div className="col-12 col-md-6">
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
            </div>

            {/* Patient Directory Table */}
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                            <tr>
                                <th className="ps-4">Patient Name & ID</th>
                                <th>Contact Information</th>
                                <th>Branch</th>
                                <th>Demographics & Blood</th>
                                <th>Category / HMO</th>
                                <th className="text-end pe-4">Clinical Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {patients.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-5 text-muted">
                                        <RiUserHeartLine size={42} className="mb-2 text-secondary opacity-50" />
                                        <p className="mb-0">No registered patients found matching your search.</p>
                                    </td>
                                </tr>
                            ) : (
                                patients.map((pat) => (
                                    <tr key={pat.id}>
                                        <td className="ps-4">
                                            <div className="fw-bold text-dark">{pat.fullName}</div>
                                            <div className="small text-muted font-monospace">
                                                PID-{String(pat.id).slice(-4)} {pat.nickname ? `• "${pat.nickname}"` : ''}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="small text-dark d-flex align-items-center gap-1">
                                                <RiPhoneLine className="text-muted" /> {pat.phone || 'No phone'}
                                            </div>
                                            <div className="small text-muted d-flex align-items-center gap-1">
                                                <RiMailLine className="text-muted" /> {pat.email}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge rounded-pill ${pat.branch?.includes('Metro') ? 'bg-primary bg-opacity-10 text-primary' : 'bg-info bg-opacity-10 text-dark'}`}>
                                                <RiBuilding4Line className="me-1" />
                                                {pat.branch?.includes('Metro') ? 'Metro Branch' : 'Northside Branch'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="small text-dark">
                                                {pat.gender || 'N/A'} • {pat.birthdate || 'N/A'} {pat.age ? `(${pat.age}y)` : ''}
                                            </div>
                                            <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2">
                                                Type {pat.bloodType || 'O+'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="badge bg-secondary bg-opacity-10 text-dark">
                                                {pat.patient_type || 'Regular Patient'}
                                            </span>
                                            <div className="small text-muted text-truncate" style={{ maxWidth: '180px' }}>
                                                {pat.insuranceProvider || 'Self-Pay'}
                                            </div>
                                        </td>
                                        <td className="text-end pe-4">
                                            <button
                                                onClick={() => setSelectedPatientDetails(pat)}
                                                className="btn btn-sm btn-outline-primary rounded-pill px-3"
                                            >
                                                View Chart
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal: Comprehensive Walk-in & Patient Registration (1 Straight Continuous Scroll) */}
            {showRegisterModal && createPortal(
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 9999 }}>
                    <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content rounded-4 border-0 shadow-lg overflow-hidden">
                            {/* Modal Header */}
                            <div className="modal-header bg-primary text-white py-3 px-4">
                                <div>
                                    <h5 className="modal-title fw-bold d-flex align-items-center gap-2 mb-0">
                                        <RiUserAddLine size={22} /> Walk-in & Comprehensive Patient Registration
                                    </h5>
                                    <small className="text-white-50">Complete Master Electronic Health Record, Clinical Baseline & Admissions Intake</small>
                                </div>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowRegisterModal(false)}></button>
                            </div>

                            <form onSubmit={handleRegisterPatient}>
                                {/* Scrollable Form Body - 1 Straight Scroll */}
                                <div className="modal-body p-4" style={{ maxHeight: '78vh', overflowY: 'auto' }}>

                                    {/* SECTION 1: Personal & Demographics */}
                                    <div className="mb-4">
                                        <div className="d-flex align-items-center justify-content-between border-bottom pb-2 mb-3">
                                            <h6 className="fw-bold text-primary mb-0 d-flex align-items-center gap-2">
                                                <span className="badge rounded-circle bg-primary text-white p-1" style={{ width: '22px', height: '22px' }}>1</span>
                                                Personal Identification & Demographics
                                            </h6>
                                            <span className="text-muted small">* Required for admission</span>
                                        </div>
                                        <div className="row g-3">
                                            <div className="col-md-5">
                                                <label className="form-label small fw-semibold">Full Legal Name *</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="First Name, Middle Name, Last Name, Suffix (Jr, III)"
                                                    value={regForm.fullName}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, fullName: e.target.value }))}
                                                    required
                                                />
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label small fw-semibold">Preferred Name / Alias</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="Nickname (e.g. Johnny)"
                                                    value={regForm.nickname}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, nickname: e.target.value }))}
                                                />
                                            </div>
                                            <div className="col-md-4">
                                                <label className="form-label small fw-semibold">Email Address (Portal Username) *</label>
                                                <input
                                                    type="email"
                                                    className="form-control"
                                                    placeholder="e.g. john.doe@email.com"
                                                    value={regForm.email}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, email: e.target.value }))}
                                                    required
                                                />
                                            </div>

                                            <div className="col-md-3">
                                                <label className="form-label small fw-semibold">Mobile Number *</label>
                                                <input
                                                    type="tel"
                                                    className="form-control"
                                                    placeholder="0917-000-0000"
                                                    value={regForm.phone}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, phone: e.target.value }))}
                                                    required
                                                />
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label small fw-semibold">Secondary / Landline</label>
                                                <input
                                                    type="tel"
                                                    className="form-control"
                                                    placeholder="(02) 8000-0000"
                                                    value={regForm.secondaryPhone}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, secondaryPhone: e.target.value }))}
                                                />
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label small fw-semibold">Date of Birth</label>
                                                <input
                                                    type="date"
                                                    className="form-control"
                                                    value={regForm.birthdate}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        const calculated = calculateAge(val);
                                                        setRegForm(prev => ({ ...prev, birthdate: val, age: calculated }));
                                                    }}
                                                />
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label small fw-semibold">Age (Auto-calculated)</label>
                                                <input
                                                    type="text"
                                                    className="form-control bg-light"
                                                    value={regForm.age ? `${regForm.age} years old` : 'Auto from DOB'}
                                                    readOnly
                                                />
                                            </div>

                                            <div className="col-md-3">
                                                <label className="form-label small fw-semibold">Biological Sex</label>
                                                <select
                                                    className="form-select"
                                                    value={regForm.gender}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, gender: e.target.value }))}
                                                >
                                                    <option value="Female">Female</option>
                                                    <option value="Male">Male</option>
                                                    <option value="Other">Other / Intersex</option>
                                                </select>
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label small fw-semibold">Civil Status</label>
                                                <select
                                                    className="form-select"
                                                    value={regForm.civilStatus}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, civilStatus: e.target.value }))}
                                                >
                                                    {CIVIL_STATUS_OPTIONS.map(c => (
                                                        <option key={c} value={c}>{c}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label small fw-semibold">Blood Type & Rh</label>
                                                <select
                                                    className="form-select"
                                                    value={regForm.bloodType}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, bloodType: e.target.value }))}
                                                >
                                                    {BLOOD_TYPES.map(b => (
                                                        <option key={b} value={b}>{b}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label small fw-semibold">Nationality</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="e.g. Filipino, Dual Citizen"
                                                    value={regForm.nationality}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, nationality: e.target.value }))}
                                                />
                                            </div>

                                            <div className="col-md-3">
                                                <label className="form-label small fw-semibold">Religion / Spiritual</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="e.g. Roman Catholic, Christian"
                                                    value={regForm.religion}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, religion: e.target.value }))}
                                                />
                                            </div>
                                            <div className="col-md-4">
                                                <label className="form-label small fw-semibold">Occupation</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="e.g. Software Engineer, Teacher, Student"
                                                    value={regForm.occupation}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, occupation: e.target.value }))}
                                                />
                                            </div>
                                            <div className="col-md-5">
                                                <label className="form-label small fw-semibold">Employer / School Name</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="e.g. TechCorp Solutions, DepEd, DLSU"
                                                    value={regForm.employer}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, employer: e.target.value }))}
                                                />
                                            </div>

                                            <div className="col-md-6">
                                                <label className="form-label small fw-semibold">Street Address / Barangay</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="House/Unit #, Street, Barangay"
                                                    value={regForm.address}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, address: e.target.value }))}
                                                />
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label small fw-semibold">City / Municipality</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="City (e.g. Makati)"
                                                    value={regForm.city}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, city: e.target.value }))}
                                                />
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label small fw-semibold">Province & ZIP Code</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="e.g. Metro Manila 1200"
                                                    value={regForm.province}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, province: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* SECTION 2: Family & Emergency Contacts */}
                                    <div className="mb-4">
                                        <div className="d-flex align-items-center justify-content-between border-bottom pb-2 mb-3">
                                            <h6 className="fw-bold text-primary mb-0 d-flex align-items-center gap-2">
                                                <span className="badge rounded-circle bg-primary text-white p-1" style={{ width: '22px', height: '22px' }}>2</span>
                                                Family, Next-of-Kin & Legal Guardian Details
                                            </h6>
                                            <span className="text-muted small">Hospital records & emergency notification</span>
                                        </div>
                                        <div className="row g-3">
                                            <div className="col-md-5">
                                                <label className="form-label small fw-semibold">Primary Emergency Contact Name</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="Full Name (e.g. Mary Jane Doe)"
                                                    value={regForm.emergencyContact}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, emergencyContact: e.target.value }))}
                                                />
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label small fw-semibold">Relationship</label>
                                                <select
                                                    className="form-select"
                                                    value={regForm.emergencyRelationship}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, emergencyRelationship: e.target.value }))}
                                                >
                                                    <option value="Spouse">Spouse</option>
                                                    <option value="Parent">Parent</option>
                                                    <option value="Child">Child</option>
                                                    <option value="Sibling">Sibling</option>
                                                    <option value="Legal Guardian">Legal Guardian</option>
                                                    <option value="Domestic Partner">Domestic Partner</option>
                                                    <option value="Friend / Relative">Friend / Relative</option>
                                                </select>
                                            </div>
                                            <div className="col-md-4">
                                                <label className="form-label small fw-semibold">Emergency Phone Number</label>
                                                <input
                                                    type="tel"
                                                    className="form-control"
                                                    placeholder="0918-000-0000"
                                                    value={regForm.emergencyPhone}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, emergencyPhone: e.target.value }))}
                                                />
                                            </div>

                                            <div className="col-md-6">
                                                <label className="form-label small fw-semibold">Mother's Maiden Name (Verification Key)</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="Mother's Full Maiden Name (DOH standard)"
                                                    value={regForm.mothersMaidenName}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, mothersMaidenName: e.target.value }))}
                                                />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label small fw-semibold">Father's Full Name</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="Father's Full Legal Name"
                                                    value={regForm.fathersName}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, fathersName: e.target.value }))}
                                                />
                                            </div>

                                            <div className="col-md-6">
                                                <label className="form-label small fw-semibold">Legal Guardian / Companion (for Minors)</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="Guardian Name (if patient is minor or ward)"
                                                    value={regForm.guardianName}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, guardianName: e.target.value }))}
                                                />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label small fw-semibold">Guardian Contact Number</label>
                                                <input
                                                    type="tel"
                                                    className="form-control"
                                                    placeholder="Guardian Phone (if minor)"
                                                    value={regForm.guardianContact}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, guardianContact: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* SECTION 3: Clinic Branch & Insurance / HMO */}
                                    <div className="mb-4">
                                        <div className="d-flex align-items-center justify-content-between border-bottom pb-2 mb-3">
                                            <h6 className="fw-bold text-primary mb-0 d-flex align-items-center gap-2">
                                                <span className="badge rounded-circle bg-primary text-white p-1" style={{ width: '22px', height: '22px' }}>3</span>
                                                Clinic Branch, Insurance, HMO & Government IDs
                                            </h6>
                                            <span className="text-muted small">Billing, claim eligibility & discounts</span>
                                        </div>
                                        <div className="row g-3">
                                            <div className="col-md-4">
                                                <label className="form-label small fw-semibold">Admitting Clinic Branch *</label>
                                                <select
                                                    className="form-select"
                                                    value={regForm.branch}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, branch: e.target.value }))}
                                                    required
                                                >
                                                    {CLINIC_BRANCHES.map(b => (
                                                        <option key={b.id} value={b.name}>{b.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-md-4">
                                                <label className="form-label small fw-semibold">Patient Billing Classification</label>
                                                <select
                                                    className="form-select"
                                                    value={regForm.patient_type}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, patient_type: e.target.value }))}
                                                >
                                                    {PATIENT_CLASSIFICATIONS.map(p => (
                                                        <option key={p} value={p}>{p}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-md-4">
                                                <label className="form-label small fw-semibold">Senior Citizen / PWD ID #</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="OSCA-12345 or PWD-67890"
                                                    value={regForm.governmentIdNumber}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, governmentIdNumber: e.target.value }))}
                                                />
                                            </div>

                                            <div className="col-md-4">
                                                <label className="form-label small fw-semibold">PhilHealth Identification # (PIN)</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="12-345678901-2"
                                                    value={regForm.philhealthNumber}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, philhealthNumber: e.target.value }))}
                                                />
                                            </div>
                                            <div className="col-md-4">
                                                <label className="form-label small fw-semibold">National ID (PhilSys Card #)</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="1234-5678-9012-3456"
                                                    value={regForm.nationalIdNumber}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, nationalIdNumber: e.target.value }))}
                                                />
                                            </div>
                                            <div className="col-md-4">
                                                <label className="form-label small fw-semibold">Primary HMO / Insurance Provider</label>
                                                <select
                                                    className="form-select"
                                                    value={regForm.insuranceProvider}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, insuranceProvider: e.target.value }))}
                                                >
                                                    {HMO_PROVIDERS.map(h => (
                                                        <option key={h} value={h}>{h}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="col-md-4">
                                                <label className="form-label small fw-semibold">HMO Member / Card Number</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="Card / Policy # (e.g. MAX-889900)"
                                                    value={regForm.hmoCardNumber}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, hmoCardNumber: e.target.value }))}
                                                />
                                            </div>
                                            <div className="col-md-4">
                                                <label className="form-label small fw-semibold">Approval Code / LOA Reference</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="Letter of Authorization / Approval #"
                                                    value={regForm.hmoApprovalCode}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, hmoApprovalCode: e.target.value }))}
                                                />
                                            </div>
                                            <div className="col-md-4">
                                                <label className="form-label small fw-semibold">Corporate Retainer Account</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="Company Retainer (e.g. San Miguel Corp)"
                                                    value={regForm.corporateAccountName}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, corporateAccountName: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* SECTION 4: Comprehensive Medical Baseline & Review */}
                                    <div className="mb-4">
                                        <div className="d-flex align-items-center justify-content-between border-bottom pb-2 mb-3">
                                            <h6 className="fw-bold text-primary mb-0 d-flex align-items-center gap-2">
                                                <span className="badge rounded-circle bg-primary text-white p-1" style={{ width: '22px', height: '22px' }}>4</span>
                                                Comprehensive Clinical History & Medical Baseline
                                            </h6>
                                            <span className="text-muted small">Diagnostic safety & clinical alerts</span>
                                        </div>

                                        {/* Allergies Card */}
                                        <div className="card p-3 mb-3 border-danger border-opacity-25 bg-danger bg-opacity-10 rounded-3">
                                            <h6 className="fw-bold text-danger mb-2 d-flex align-items-center gap-1">
                                                <RiShieldCheckLine /> Allergy Screening & Adverse Drug Reactions
                                            </h6>
                                            <div className="row g-2">
                                                <div className="col-md-4">
                                                    <label className="form-label small fw-semibold">Known Drug Allergies</label>
                                                    <select
                                                        className="form-select form-select-sm"
                                                        value={regForm.drugAllergies}
                                                        onChange={(e) => setRegForm(prev => ({ ...prev, drugAllergies: e.target.value }))}
                                                    >
                                                        {DRUG_ALLERGY_OPTIONS.map(d => (
                                                            <option key={d} value={d}>{d}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="col-md-4">
                                                    <label className="form-label small fw-semibold">Food / Environmental Allergies</label>
                                                    <select
                                                        className="form-select form-select-sm"
                                                        value={regForm.foodAllergies}
                                                        onChange={(e) => setRegForm(prev => ({ ...prev, foodAllergies: e.target.value }))}
                                                    >
                                                        {FOOD_ALLERGY_OPTIONS.map(f => (
                                                            <option key={f} value={f}>{f}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="col-md-4">
                                                    <label className="form-label small fw-semibold">Reaction Symptoms & Severity</label>
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-sm"
                                                        placeholder="e.g. Anaphylaxis, Rash, Facial swelling"
                                                        value={regForm.allergyReactions}
                                                        onChange={(e) => setRegForm(prev => ({ ...prev, allergyReactions: e.target.value }))}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Chronic Conditions Checklist */}
                                        <div className="mb-3">
                                            <label className="form-label small fw-semibold text-dark d-block">
                                                Pre-existing Chronic Diseases & Medical Conditions:
                                            </label>
                                            <div className="d-flex flex-wrap gap-2 mb-2">
                                                {PRESET_CONDITIONS.map(cond => {
                                                    const active = (regForm.selectedConditions || []).includes(cond);
                                                    return (
                                                        <button
                                                            key={cond}
                                                            type="button"
                                                            onClick={() => handleToggleCondition(cond)}
                                                            className={`btn btn-sm rounded-pill px-3 py-1 ${active ? 'btn-danger shadow-sm' : 'btn-outline-secondary bg-white'}`}
                                                        >
                                                            {active && <RiCheckLine className="me-1" />}
                                                            {cond}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <input
                                                type="text"
                                                className="form-control form-control-sm"
                                                placeholder="Specify other medical conditions or notes (or 'None')..."
                                                value={regForm.otherConditionsText}
                                                onChange={(e) => setRegForm(prev => ({ ...prev, otherConditionsText: e.target.value }))}
                                            />
                                        </div>

                                        {/* Medications & Surgeries */}
                                        <div className="row g-3 mb-3">
                                            <div className="col-md-6">
                                                <label className="form-label small fw-semibold">Current Maintenance Medications</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="Drug name, dose, frequency (e.g. Amlodipine 5mg OD, Metformin 500mg BID)"
                                                    value={regForm.maintenanceMeds}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, maintenanceMeds: e.target.value }))}
                                                />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label small fw-semibold">Past Major Surgeries & Hospitalizations</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="Procedure & year (e.g. Appendectomy 2019, Cesarean 2021)"
                                                    value={regForm.pastSurgeries}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, pastSurgeries: e.target.value }))}
                                                />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label small fw-semibold">Family Hereditary Medical History</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="e.g. Father: Hypertension, Mother: Diabetes Type 2"
                                                    value={regForm.familyHistory}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, familyHistory: e.target.value }))}
                                                />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label small fw-semibold">Vaccination & Immunization History</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="e.g. COVID-19 Complete + Boosters, Flu Shot (2026), Pneumococcal"
                                                    value={regForm.vaccinationHistory}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, vaccinationHistory: e.target.value }))}
                                                />
                                            </div>
                                        </div>

                                        {/* Social Habits & Women's Health */}
                                        <div className="row g-3 p-3 bg-light rounded-3 border">
                                            <div className="col-md-4">
                                                <label className="form-label small fw-semibold">Smoking / Tobacco Use</label>
                                                <select
                                                    className="form-select form-select-sm"
                                                    value={regForm.smokingStatus}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, smokingStatus: e.target.value }))}
                                                >
                                                    <option value="Non-Smoker">Non-Smoker / Never Smoked</option>
                                                    <option value="Former Smoker">Former Smoker (Quit)</option>
                                                    <option value="Current Smoker (Light)">Current Smoker (&lt; 10 sticks/day)</option>
                                                    <option value="Current Smoker (Heavy)">Current Smoker (&gt; 1 pack/day)</option>
                                                    <option value="Vaping / E-Cigarette">Vaping / E-Cigarette User</option>
                                                </select>
                                            </div>
                                            <div className="col-md-4">
                                                <label className="form-label small fw-semibold">Alcohol Consumption</label>
                                                <select
                                                    className="form-select form-select-sm"
                                                    value={regForm.alcoholUse}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, alcoholUse: e.target.value }))}
                                                >
                                                    <option value="Non-Drinker">Non-Drinker</option>
                                                    <option value="Social / Occasional">Social / Occasional (1-2 drinks/wk)</option>
                                                    <option value="Moderate">Moderate (3-5 drinks/wk)</option>
                                                    <option value="Frequent / Daily">Frequent / Daily Consumption</option>
                                                </select>
                                            </div>
                                            <div className="col-md-4">
                                                <label className="form-label small fw-semibold">Special Dietary Restrictions</label>
                                                <input
                                                    type="text"
                                                    className="form-control form-control-sm"
                                                    placeholder="e.g. Low sodium, Diabetic diet, Halal"
                                                    value={regForm.dietaryRestrictions}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, dietaryRestrictions: e.target.value }))}
                                                />
                                            </div>

                                            {/* Female-specific fields */}
                                            {regForm.gender === 'Female' && (
                                                <>
                                                    <div className="col-md-4">
                                                        <label className="form-label small fw-semibold text-danger">Currently Pregnant?</label>
                                                        <select
                                                            className="form-select form-select-sm"
                                                            value={regForm.isPregnant}
                                                            onChange={(e) => setRegForm(prev => ({ ...prev, isPregnant: e.target.value }))}
                                                        >
                                                            <option value="No">No</option>
                                                            <option value="Yes (1st Trimester)">Yes (1st Trimester)</option>
                                                            <option value="Yes (2nd Trimester)">Yes (2nd Trimester)</option>
                                                            <option value="Yes (3rd Trimester)">Yes (3rd Trimester)</option>
                                                            <option value="Unsure">Unsure</option>
                                                        </select>
                                                    </div>
                                                    <div className="col-md-4">
                                                        <label className="form-label small fw-semibold text-danger">Currently Breastfeeding?</label>
                                                        <select
                                                            className="form-select form-select-sm"
                                                            value={regForm.isNursing}
                                                            onChange={(e) => setRegForm(prev => ({ ...prev, isNursing: e.target.value }))}
                                                        >
                                                            <option value="No">No</option>
                                                            <option value="Yes">Yes</option>
                                                        </select>
                                                    </div>
                                                    <div className="col-md-4">
                                                        <label className="form-label small fw-semibold text-danger">Last Menstrual Period (LMP)</label>
                                                        <input
                                                            type="date"
                                                            className="form-control form-control-sm"
                                                            value={regForm.lastMenstrualPeriod}
                                                            onChange={(e) => setRegForm(prev => ({ ...prev, lastMenstrualPeriod: e.target.value }))}
                                                        />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* SECTION 5: Walk-in Clinical Triage & Intake Vitals */}
                                    <div className="mb-4">
                                        <div className="d-flex align-items-center justify-content-between border-bottom pb-2 mb-3">
                                            <h6 className="fw-bold text-primary mb-0 d-flex align-items-center gap-2">
                                                <span className="badge rounded-circle bg-primary text-white p-1" style={{ width: '22px', height: '22px' }}>5</span>
                                                Walk-in Clinical Triage & Objective Vital Signs
                                            </h6>
                                            <span className="text-muted small">Admissions desk nurse intake</span>
                                        </div>

                                        {/* Chief Complaint & Duration */}
                                        <div className="row g-3 mb-3">
                                            <div className="col-md-7">
                                                <label className="form-label small fw-semibold">Chief Complaint / Primary Reason for Visit</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="e.g. Severe throbbing right ear pain, difficulty swallowing, productive cough for 3 days"
                                                    value={regForm.chiefComplaint}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, chiefComplaint: e.target.value }))}
                                                />
                                            </div>
                                            <div className="col-md-2">
                                                <label className="form-label small fw-semibold">Onset / Duration</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="e.g. 2 days, Sudden"
                                                    value={regForm.complaintDuration}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, complaintDuration: e.target.value }))}
                                                />
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label small fw-semibold">
                                                    Pain Scale (0-10): <span className={getPainScaleInfo(regForm.painScale).color}>{getPainScaleInfo(regForm.painScale).text}</span>
                                                </label>
                                                <input
                                                    type="range"
                                                    className="form-range"
                                                    min="0"
                                                    max="10"
                                                    step="1"
                                                    value={regForm.painScale}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, painScale: e.target.value }))}
                                                />
                                            </div>
                                        </div>

                                        {/* Vitals Box */}
                                        <div className="p-3 bg-light rounded-3 border mb-3">
                                            <div className="d-flex align-items-center justify-content-between mb-2">
                                                <label className="form-label small fw-bold text-dark text-uppercase mb-0">
                                                    <RiHeartPulseLine className="text-danger me-1" />
                                                    Physical Triage Vital Signs:
                                                </label>
                                                <div className="d-flex gap-2">
                                                    {bpStatus && <span className={bpStatus.color}>{bpStatus.label}</span>}
                                                    {calculatedBmi && <span className={calculatedBmi.badgeClass}>BMI: {calculatedBmi.val} ({calculatedBmi.category})</span>}
                                                </div>
                                            </div>

                                            <div className="row g-2">
                                                <div className="col-6 col-md-3">
                                                    <label className="form-label small text-muted mb-1">Blood Pressure (BP)</label>
                                                    <div className="input-group input-group-sm">
                                                        <input
                                                            type="number"
                                                            className="form-control text-center"
                                                            placeholder="120"
                                                            value={regForm.bpSystolic}
                                                            onChange={(e) => setRegForm(prev => ({ ...prev, bpSystolic: e.target.value }))}
                                                        />
                                                        <span className="input-group-text bg-white">/</span>
                                                        <input
                                                            type="number"
                                                            className="form-control text-center"
                                                            placeholder="80"
                                                            value={regForm.bpDiastolic}
                                                            onChange={(e) => setRegForm(prev => ({ ...prev, bpDiastolic: e.target.value }))}
                                                        />
                                                        <span className="input-group-text bg-white small">mmHg</span>
                                                    </div>
                                                </div>
                                                <div className="col-6 col-md-2">
                                                    <label className="form-label small text-muted mb-1">Temperature</label>
                                                    <div className="input-group input-group-sm">
                                                        <input
                                                            type="number"
                                                            step="0.1"
                                                            className="form-control text-center"
                                                            placeholder="36.5"
                                                            value={regForm.temperature}
                                                            onChange={(e) => setRegForm(prev => ({ ...prev, temperature: e.target.value }))}
                                                        />
                                                        <span className="input-group-text bg-white small">°C</span>
                                                    </div>
                                                </div>
                                                <div className="col-6 col-md-2">
                                                    <label className="form-label small text-muted mb-1">Heart / Pulse</label>
                                                    <div className="input-group input-group-sm">
                                                        <input
                                                            type="number"
                                                            className="form-control text-center"
                                                            placeholder="75"
                                                            value={regForm.pulseRate}
                                                            onChange={(e) => setRegForm(prev => ({ ...prev, pulseRate: e.target.value }))}
                                                        />
                                                        <span className="input-group-text bg-white small">bpm</span>
                                                    </div>
                                                </div>
                                                <div className="col-6 col-md-2">
                                                    <label className="form-label small text-muted mb-1">Resp. Rate</label>
                                                    <div className="input-group input-group-sm">
                                                        <input
                                                            type="number"
                                                            className="form-control text-center"
                                                            placeholder="18"
                                                            value={regForm.respiratoryRate}
                                                            onChange={(e) => setRegForm(prev => ({ ...prev, respiratoryRate: e.target.value }))}
                                                        />
                                                        <span className="input-group-text bg-white small">cpm</span>
                                                    </div>
                                                </div>
                                                <div className="col-6 col-md-3">
                                                    <label className="form-label small text-muted mb-1">Oxygen Saturation</label>
                                                    <div className="input-group input-group-sm">
                                                        <input
                                                            type="number"
                                                            className="form-control text-center"
                                                            placeholder="98"
                                                            value={regForm.oxygenSaturation}
                                                            onChange={(e) => setRegForm(prev => ({ ...prev, oxygenSaturation: e.target.value }))}
                                                        />
                                                        <span className="input-group-text bg-white small">% SpO2</span>
                                                    </div>
                                                </div>

                                                <div className="col-6 col-md-3">
                                                    <label className="form-label small text-muted mb-1">Height</label>
                                                    <div className="input-group input-group-sm">
                                                        <input
                                                            type="number"
                                                            className="form-control text-center"
                                                            placeholder="165"
                                                            value={regForm.heightCm}
                                                            onChange={(e) => setRegForm(prev => ({ ...prev, heightCm: e.target.value }))}
                                                        />
                                                        <span className="input-group-text bg-white small">cm</span>
                                                    </div>
                                                </div>
                                                <div className="col-6 col-md-3">
                                                    <label className="form-label small text-muted mb-1">Weight</label>
                                                    <div className="input-group input-group-sm">
                                                        <input
                                                            type="number"
                                                            step="0.5"
                                                            className="form-control text-center"
                                                            placeholder="60"
                                                            value={regForm.weight}
                                                            onChange={(e) => setRegForm(prev => ({ ...prev, weight: e.target.value }))}
                                                        />
                                                        <span className="input-group-text bg-white small">kg</span>
                                                    </div>
                                                </div>
                                                <div className="col-6 col-md-3">
                                                    <label className="form-label small text-muted mb-1">Blood Sugar (RBS)</label>
                                                    <div className="input-group input-group-sm">
                                                        <input
                                                            type="number"
                                                            className="form-control text-center"
                                                            placeholder="Optional"
                                                            value={regForm.bloodSugarRBS}
                                                            onChange={(e) => setRegForm(prev => ({ ...prev, bloodSugarRBS: e.target.value }))}
                                                        />
                                                        <span className="input-group-text bg-white small">mg/dL</span>
                                                    </div>
                                                </div>
                                                <div className="col-6 col-md-3">
                                                    <label className="form-label small text-muted mb-1">Triage Acuity Priority</label>
                                                    <select
                                                        className="form-select form-select-sm"
                                                        value={regForm.triageAcuity}
                                                        onChange={(e) => setRegForm(prev => ({ ...prev, triageAcuity: e.target.value }))}
                                                    >
                                                        {TRIAGE_ACUITY_LEVELS.map(t => (
                                                            <option key={t.level} value={t.level}>{t.level}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Direct Queue Routing Card */}
                                        <div className="p-3 border rounded-3 bg-white shadow-sm">
                                            <div className="form-check form-switch mb-2">
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    id="addToQueueTodayCheck"
                                                    checked={regForm.addToQueueToday}
                                                    onChange={(e) => setRegForm(prev => ({ ...prev, addToQueueToday: e.target.checked }))}
                                                />
                                                <label className="form-check-label fw-bold text-dark" htmlFor="addToQueueTodayCheck">
                                                    Route walk-in patient directly to Today's Doctor Queue
                                                </label>
                                            </div>
                                            <p className="text-muted small mb-2 ps-4">
                                                Instantly creates an active admitted appointment for today, notifying attending doctors and placing this patient in the live queue for consultation.
                                            </p>
                                            {regForm.addToQueueToday && (
                                                <div className="row g-2 ps-4 pt-1">
                                                    <div className="col-md-6">
                                                        <label className="form-label small fw-semibold">Consultation Service</label>
                                                        <select
                                                            className="form-select form-select-sm"
                                                            value={regForm.queueService}
                                                            onChange={(e) => setRegForm(prev => ({ ...prev, queueService: e.target.value }))}
                                                        >
                                                            <option value="General Consultation">General Consultation</option>
                                                            <option value="ENT Specialist Consultation">ENT Specialist Consultation</option>
                                                            <option value="Follow-up Checkup">Follow-up Checkup</option>
                                                            <option value="Pediatric Consultation">Pediatric Consultation</option>
                                                            <option value="Urgent Care Triage">Urgent Care Triage</option>
                                                            <option value="Laboratory / Diagnostics Only">Laboratory / Diagnostics Only</option>
                                                        </select>
                                                    </div>
                                                    <div className="col-md-6">
                                                        <label className="form-label small fw-semibold">Attending Doctor</label>
                                                        <select
                                                            className="form-select form-select-sm"
                                                            value={regForm.queueDoctor}
                                                            onChange={(e) => setRegForm(prev => ({ ...prev, queueDoctor: e.target.value }))}
                                                        >
                                                            <option value="">-- Assign Doctor (or Auto-assign) --</option>
                                                            {CLINIC_DOCTORS.filter(d => !regForm.branch || d.branch === regForm.branch).map(doc => (
                                                                <option key={doc.id} value={doc.name}>{doc.name} ({doc.specialty})</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* SECTION 6: Data Privacy & Attestation */}
                                    <div className="p-3 bg-light rounded-3 border mt-3">
                                        <h6 className="fw-bold text-dark small mb-2 d-flex align-items-center gap-1">
                                            <RiShieldCheckLine className="text-success" /> Compliance & Informed Consent Attestation
                                        </h6>
                                        <div className="form-check mb-1">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                id="privacyCheck"
                                                checked={regForm.dataPrivacyConsent}
                                                onChange={(e) => setRegForm(prev => ({ ...prev, dataPrivacyConsent: e.target.checked }))}
                                            />
                                            <label className="form-check-label small text-muted" htmlFor="privacyCheck">
                                                I confirm patient has given informed consent under <b>Republic Act 10173 (Data Privacy Act of 2012)</b> for the collection, electronic storage, and processing of their medical health information.
                                            </label>
                                        </div>
                                        <div className="form-check">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                id="treatmentCheck"
                                                checked={regForm.treatmentConsent}
                                                onChange={(e) => setRegForm(prev => ({ ...prev, treatmentConsent: e.target.checked }))}
                                            />
                                            <label className="form-check-label small text-muted" htmlFor="treatmentCheck">
                                                Consent for clinical examination, nurse vital sign triage, diagnostic orders, and emergency care.
                                            </label>
                                        </div>
                                    </div>

                                </div>

                                {/* Modal Footer */}
                                <div className="modal-footer bg-light py-3 px-4 d-flex justify-content-between align-items-center">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary rounded-pill px-4"
                                        onClick={() => setShowRegisterModal(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary rounded-pill px-5 py-2 fw-bold shadow-sm d-flex align-items-center gap-2">
                                        <RiCheckLine size={20} /> Complete & Save Patient Master Record
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal: Patient Master Chart Details */}
            {selectedPatientDetails && (() => {
                const patRecord = (db.medical_records || {})[(selectedPatientDetails.email || '').toLowerCase()] || {};
                return createPortal(
                    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 9999 }}>
                        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                            <div className="modal-content rounded-4 border-0 shadow-lg overflow-hidden">
                                <div className="modal-header bg-light border-bottom py-3 px-4">
                                    <div className="d-flex align-items-center gap-3">
                                        <div
                                            className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold fs-5 shadow-sm"
                                            style={{ width: '48px', height: '48px' }}
                                        >
                                            {selectedPatientDetails.fullName?.charAt(0) || 'P'}
                                        </div>
                                        <div>
                                            <h5 className="modal-title fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                                                {selectedPatientDetails.fullName}
                                                {selectedPatientDetails.nickname && (
                                                    <span className="badge bg-light text-secondary border fw-normal">"{selectedPatientDetails.nickname}"</span>
                                                )}
                                            </h5>
                                            <div className="small text-muted font-monospace">
                                                PID-{String(selectedPatientDetails.id).slice(-4)} • {selectedPatientDetails.gender} • {selectedPatientDetails.age ? `${selectedPatientDetails.age} yrs` : selectedPatientDetails.birthdate} • Blood {selectedPatientDetails.bloodType || 'O+'}
                                            </div>
                                        </div>
                                    </div>
                                    <button type="button" className="btn-close" onClick={() => setSelectedPatientDetails(null)}></button>
                                </div>

                                <div className="modal-body p-4 bg-white" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                                    {/* 1. Demographic & Identification Overview */}
                                    <div className="row g-3 mb-4 p-3 bg-light rounded-3 border">
                                        <div className="col-6 col-md-3">
                                            <span className="small text-muted d-block">Email (Portal ID):</span>
                                            <div className="fw-semibold text-dark text-truncate">{selectedPatientDetails.email}</div>
                                        </div>
                                        <div className="col-6 col-md-3">
                                            <span className="small text-muted d-block">Primary Mobile:</span>
                                            <div className="fw-semibold text-dark">{selectedPatientDetails.phone || 'N/A'}</div>
                                        </div>
                                        <div className="col-6 col-md-3">
                                            <span className="small text-muted d-block">Secondary Phone:</span>
                                            <div className="fw-semibold text-dark">{selectedPatientDetails.secondaryPhone || 'None'}</div>
                                        </div>
                                        <div className="col-6 col-md-3">
                                            <span className="small text-muted d-block">Registered Branch:</span>
                                            <div><span className="badge bg-primary bg-opacity-10 text-primary">{selectedPatientDetails.branch}</span></div>
                                        </div>

                                        <div className="col-6 col-md-3">
                                            <span className="small text-muted d-block">Civil Status:</span>
                                            <div className="fw-semibold text-dark">{selectedPatientDetails.civilStatus || 'Single'}</div>
                                        </div>
                                        <div className="col-6 col-md-3">
                                            <span className="small text-muted d-block">Nationality:</span>
                                            <div className="fw-semibold text-dark">{selectedPatientDetails.nationality || 'Filipino'}</div>
                                        </div>
                                        <div className="col-6 col-md-3">
                                            <span className="small text-muted d-block">Religion:</span>
                                            <div className="fw-semibold text-dark">{selectedPatientDetails.religion || 'Roman Catholic'}</div>
                                        </div>
                                        <div className="col-6 col-md-3">
                                            <span className="small text-muted d-block">Occupation & Employer:</span>
                                            <div className="fw-semibold text-dark text-truncate">
                                                {selectedPatientDetails.occupation || 'N/A'} {selectedPatientDetails.employer ? `(${selectedPatientDetails.employer})` : ''}
                                            </div>
                                        </div>

                                        <div className="col-12 col-md-6">
                                            <span className="small text-muted d-block">Residential Address:</span>
                                            <div className="fw-semibold text-dark">
                                                {selectedPatientDetails.address || 'N/A'} {selectedPatientDetails.city ? `, ${selectedPatientDetails.city}` : ''} {selectedPatientDetails.province ? `, ${selectedPatientDetails.province}` : ''}
                                            </div>
                                        </div>
                                        <div className="col-12 col-md-6">
                                            <span className="small text-muted d-block">Primary Emergency Contact:</span>
                                            <div className="fw-semibold text-dark">{selectedPatientDetails.emergencyContact || 'None provided'}</div>
                                        </div>

                                        {selectedPatientDetails.mothersMaidenName && (
                                            <div className="col-6 col-md-4">
                                                <span className="small text-muted d-block">Mother's Maiden Name:</span>
                                                <div className="fw-semibold text-dark">{selectedPatientDetails.mothersMaidenName}</div>
                                            </div>
                                        )}
                                        {selectedPatientDetails.fathersName && (
                                            <div className="col-6 col-md-4">
                                                <span className="small text-muted d-block">Father's Name:</span>
                                                <div className="fw-semibold text-dark">{selectedPatientDetails.fathersName}</div>
                                            </div>
                                        )}
                                        {selectedPatientDetails.guardianName && (
                                            <div className="col-6 col-md-4">
                                                <span className="small text-muted d-block">Guardian / Companion:</span>
                                                <div className="fw-semibold text-dark">{selectedPatientDetails.guardianName} ({selectedPatientDetails.guardianContact || 'No phone'})</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* 2. Insurance, HMO & Government IDs */}
                                    <div className="row g-3 mb-4 p-3 bg-white rounded-3 border">
                                        <div className="col-12">
                                            <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                                                <RiShieldUserLine className="text-primary" /> Health Insurance, HMO & Government Benefits
                                            </h6>
                                        </div>
                                        <div className="col-6 col-md-3">
                                            <span className="small text-muted d-block">Classification:</span>
                                            <div className="fw-semibold text-dark">{selectedPatientDetails.patient_type || 'Regular Patient'}</div>
                                        </div>
                                        <div className="col-6 col-md-3">
                                            <span className="small text-muted d-block">Senior / PWD ID:</span>
                                            <div className="fw-semibold text-dark">{selectedPatientDetails.governmentIdNumber || 'N/A'}</div>
                                        </div>
                                        <div className="col-6 col-md-3">
                                            <span className="small text-muted d-block">PhilHealth PIN:</span>
                                            <div className="fw-semibold text-dark">{selectedPatientDetails.philhealthNumber || patRecord.philhealthNumber || 'N/A'}</div>
                                        </div>
                                        <div className="col-6 col-md-3">
                                            <span className="small text-muted d-block">National ID (PhilSys):</span>
                                            <div className="fw-semibold text-dark">{selectedPatientDetails.nationalIdNumber || patRecord.nationalIdNumber || 'N/A'}</div>
                                        </div>
                                        <div className="col-6 col-md-4">
                                            <span className="small text-muted d-block">Primary Insurance / HMO:</span>
                                            <div className="fw-semibold text-dark">{selectedPatientDetails.insuranceProvider || 'Self-Pay'}</div>
                                        </div>
                                        <div className="col-6 col-md-4">
                                            <span className="small text-muted d-block">HMO Card / Policy Number:</span>
                                            <div className="fw-semibold text-dark">{selectedPatientDetails.hmoCardNumber || 'N/A'}</div>
                                        </div>
                                        <div className="col-6 col-md-4">
                                            <span className="small text-muted d-block">Corporate Retainer Account:</span>
                                            <div className="fw-semibold text-dark">{selectedPatientDetails.corporateAccountName || 'None'}</div>
                                        </div>
                                    </div>

                                    {/* 3. Medical Baseline & Clinical Review */}
                                    <div className="p-3 bg-white rounded-3 border mb-4">
                                        <h6 className="fw-bold text-primary mb-3 d-flex align-items-center gap-2">
                                            <RiHeartPulseLine /> Clinical Baseline & Health Review
                                        </h6>
                                        <div className="row g-3">
                                            <div className="col-md-6">
                                                <div className="small text-muted fw-semibold">Known Allergies:</div>
                                                <div className="d-flex flex-wrap gap-1 mt-1">
                                                    {Array.isArray(patRecord.allergies) && patRecord.allergies.length > 0 ? (
                                                        patRecord.allergies.map((alg, i) => (
                                                            <span key={i} className="badge bg-warning bg-opacity-20 text-dark border border-warning">
                                                                {alg}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="badge bg-light text-muted border">None known</span>
                                                    )}
                                                </div>
                                                {patRecord.allergyReactions && (
                                                    <div className="small text-danger mt-1">
                                                        <b>Reactions:</b> {patRecord.allergyReactions}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="col-md-6">
                                                <div className="small text-muted fw-semibold">Chronic Medical Conditions:</div>
                                                <div className="d-flex flex-wrap gap-1 mt-1">
                                                    {Array.isArray(patRecord.conditions) && patRecord.conditions.length > 0 ? (
                                                        patRecord.conditions.map((c, i) => (
                                                            <span key={i} className="badge bg-danger bg-opacity-10 text-danger border border-danger">
                                                                {c}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="badge bg-light text-muted border">None reported</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="col-md-6">
                                                <div className="small text-muted fw-semibold">Current Maintenance Medications:</div>
                                                <div className="small text-dark mt-1">
                                                    {Array.isArray(patRecord.maintenanceMeds) && patRecord.maintenanceMeds.length > 0
                                                        ? patRecord.maintenanceMeds.join(', ')
                                                        : 'None reported'}
                                                </div>
                                            </div>

                                            <div className="col-md-6">
                                                <div className="small text-muted fw-semibold">Past Major Surgeries & Hospitalizations:</div>
                                                <div className="small text-dark mt-1">
                                                    {Array.isArray(patRecord.pastSurgeries) && patRecord.pastSurgeries.length > 0
                                                        ? patRecord.pastSurgeries.join(', ')
                                                        : 'None reported'}
                                                </div>
                                            </div>

                                            {patRecord.familyHistory && (
                                                <div className="col-md-6">
                                                    <div className="small text-muted fw-semibold">Family Hereditary History:</div>
                                                    <div className="small text-dark mt-1">{patRecord.familyHistory}</div>
                                                </div>
                                            )}

                                            {patRecord.vaccinations && (
                                                <div className="col-md-6">
                                                    <div className="small text-muted fw-semibold">Vaccinations & Immunizations:</div>
                                                    <div className="small text-dark mt-1">{patRecord.vaccinations}</div>
                                                </div>
                                            )}

                                            {patRecord.socialHistory && (
                                                <div className="col-12 pt-2 border-top">
                                                    <div className="small text-muted fw-semibold mb-1">Lifestyle & Social Habits:</div>
                                                    <div className="d-flex flex-wrap gap-2">
                                                        <span className="badge bg-light text-dark border">Smoking: {patRecord.socialHistory.smoking || 'Non-Smoker'}</span>
                                                        <span className="badge bg-light text-dark border">Alcohol: {patRecord.socialHistory.alcohol || 'Non-Drinker'}</span>
                                                        {patRecord.socialHistory.diet && (
                                                            <span className="badge bg-light text-dark border">Diet: {patRecord.socialHistory.diet}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Initial Vitals Ribbon */}
                                            {patRecord.initialVitals && (
                                                <div className="col-12 mt-2 pt-2 border-top">
                                                    <div className="small text-muted fw-semibold mb-2">Nurse Intake Triage Vitals:</div>
                                                    <div className="d-flex flex-wrap gap-2">
                                                        {patRecord.initialVitals.bloodPressure && (
                                                            <span className="badge bg-danger bg-opacity-10 text-danger border p-2">
                                                                BP: {patRecord.initialVitals.bloodPressure}
                                                            </span>
                                                        )}
                                                        {patRecord.initialVitals.temperature && (
                                                            <span className="badge bg-info bg-opacity-10 text-dark border p-2">
                                                                Temp: {patRecord.initialVitals.temperature}
                                                            </span>
                                                        )}
                                                        {patRecord.initialVitals.pulseRate && (
                                                            <span className="badge bg-success bg-opacity-10 text-success border p-2">
                                                                Pulse: {patRecord.initialVitals.pulseRate}
                                                            </span>
                                                        )}
                                                        {patRecord.initialVitals.respiratoryRate && (
                                                            <span className="badge bg-secondary bg-opacity-10 text-dark border p-2">
                                                                RR: {patRecord.initialVitals.respiratoryRate}
                                                            </span>
                                                        )}
                                                        {patRecord.initialVitals.oxygenSaturation && (
                                                            <span className="badge bg-primary bg-opacity-10 text-primary border p-2">
                                                                SpO2: {patRecord.initialVitals.oxygenSaturation}
                                                            </span>
                                                        )}
                                                        {patRecord.initialVitals.height && patRecord.initialVitals.weight && (
                                                            <span className="badge bg-dark bg-opacity-10 text-dark border p-2">
                                                                Height: {patRecord.initialVitals.height} • Weight: {patRecord.initialVitals.weight}
                                                            </span>
                                                        )}
                                                        {patRecord.initialVitals.bmi && (
                                                            <span className="badge bg-success text-white p-2">
                                                                BMI: {patRecord.initialVitals.bmi}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {patRecord.chiefComplaint && (
                                                        <div className="small text-dark mt-2 p-2 bg-light rounded border">
                                                            <b>Chief Complaint:</b> {patRecord.chiefComplaint}
                                                            {patRecord.complaintDuration ? ` (${patRecord.complaintDuration})` : ''} • Pain Scale: {patRecord.painScale || '0'}/10
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 4. Clinical Shortcuts */}
                                    <h6 className="fw-bold mb-3 text-dark">Quick Clinical Shortcuts for this Patient:</h6>
                                    <div className="row g-2">
                                        <div className="col-6 col-md-3">
                                            <button
                                                onClick={() => {
                                                    setSelectedPatientDetails(null);
                                                    navigate(`/${(session.role || 'staff').toLowerCase()}/consultations`);
                                                }}
                                                className="btn btn-outline-primary w-100 py-3 rounded-3 d-flex flex-column align-items-center gap-1 shadow-sm"
                                            >
                                                <RiStethoscopeLine size={24} />
                                                <span className="small fw-semibold">Consultations</span>
                                            </button>
                                        </div>
                                        <div className="col-6 col-md-3">
                                            <button
                                                onClick={() => {
                                                    setSelectedPatientDetails(null);
                                                    navigate(`/${(session.role || 'staff').toLowerCase()}/laboratory`);
                                                }}
                                                className="btn btn-outline-info w-100 py-3 rounded-3 d-flex flex-column align-items-center gap-1 shadow-sm"
                                            >
                                                <RiFlaskLine size={24} />
                                                <span className="small fw-semibold">Lab Orders</span>
                                            </button>
                                        </div>
                                        <div className="col-6 col-md-3">
                                            <button
                                                onClick={() => {
                                                    setSelectedPatientDetails(null);
                                                    navigate(`/${(session.role || 'staff').toLowerCase()}/billing`);
                                                }}
                                                className="btn btn-outline-success w-100 py-3 rounded-3 d-flex flex-column align-items-center gap-1 shadow-sm"
                                            >
                                                <RiMoneyDollarCircleLine size={24} />
                                                <span className="small fw-semibold">Invoices & Bills</span>
                                            </button>
                                        </div>
                                        <div className="col-6 col-md-3">
                                            <button
                                                onClick={() => {
                                                    setSelectedPatientDetails(null);
                                                    navigate(`/${(session.role || 'staff').toLowerCase()}/book`);
                                                }}
                                                className="btn btn-outline-warning text-dark w-100 py-3 rounded-3 d-flex flex-column align-items-center gap-1 shadow-sm"
                                            >
                                                <RiCalendarCheckLine size={24} />
                                                <span className="small fw-semibold">Appointments</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="modal-footer bg-light py-2">
                                    <button type="button" className="btn btn-secondary rounded-pill px-4" onClick={() => setSelectedPatientDetails(null)}>
                                        Close Master Chart
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                );
            })()}
        </div>
    );
};

export default PatientRegistration;
