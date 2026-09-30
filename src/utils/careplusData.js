/**
 * CarePlus Clinic Management System
 * Core Data Models, Initial Seed Data, and Branch Definitions
 */

export const CLINIC_BRANCHES = [
    {
        id: 'metro',
        name: 'CarePlus Metro Branch',
        shortName: 'Metro Branch',
        tag: 'Main Clinic',
        address: '102 Central Medical Blvd, Metro District',
        phone: '(02) 8820-1001',
        hours: 'Mon-Sat: 7:00 AM - 7:00 PM',
        email: 'metro@careplusclinic.com'
    },
    {
        id: 'northside',
        name: 'CarePlus Northside Branch',
        shortName: 'Northside Branch',
        tag: 'Specialty & Diagnostic Clinic',
        address: '45 Northway Avenue, Northside District',
        phone: '(02) 8820-1002',
        hours: 'Mon-Sun: 8:00 AM - 6:00 PM',
        email: 'northside@careplusclinic.com'
    }
];

export const CLINIC_DOCTORS = [
    {
        id: 'doc-1',
        name: 'Dr. Robert Chen, MD',
        specialty: 'Internal Medicine & Adult Health',
        branch: 'CarePlus Metro Branch',
        email: 'dr.chen@careplus.com',
        schedule: 'Mon, Wed, Fri (8:00 AM - 4:00 PM)'
    },
    {
        id: 'doc-2',
        name: 'Dr. Maria Santos, MD',
        specialty: 'Family Medicine & General Consultation',
        branch: 'CarePlus Northside Branch',
        email: 'dr.santos@careplus.com',
        schedule: 'Tue, Thu, Sat (9:00 AM - 5:00 PM)'
    },
    {
        id: 'doc-3',
        name: 'Dr. Alan Vance, MD',
        specialty: 'Pediatrics & Child Wellness',
        branch: 'CarePlus Metro Branch',
        email: 'dr.vance@careplus.com',
        schedule: 'Daily (9:00 AM - 2:00 PM)'
    },
    {
        id: 'doc-4',
        name: 'Dr. Elena Cruz, MD, FPSP',
        specialty: 'Clinical Pathology & Laboratory Diagnostics',
        branch: 'CarePlus Northside Branch',
        email: 'dr.cruz@careplus.com',
        schedule: 'Mon-Sat (7:00 AM - 3:00 PM)'
    }
];

export const LAB_TEST_CATALOG = [
    { code: 'CBC', name: 'Complete Blood Count (CBC) with Platelets', category: 'Hematology', price: 350, turnaround: '2 hours' },
    { code: 'URIN', name: 'Routine Urinalysis (10-parameter)', category: 'Clinical Microscopy', price: 200, turnaround: '1 hour' },
    { code: 'FECA', name: 'Routine Fecalysis', category: 'Clinical Microscopy', price: 180, turnaround: '1 hour' },
    { code: 'FBS', name: 'Fasting Blood Sugar (FBS)', category: 'Blood Chemistry', price: 250, turnaround: '2 hours' },
    { code: 'LIPID', name: 'Full Lipid Profile (Cholesterol, Triglycerides, HDL, LDL)', category: 'Blood Chemistry', price: 850, turnaround: '4 hours' },
    { code: 'LFT', name: 'Liver Function Test (SGPT, SGOT, Alk Phos)', category: 'Blood Chemistry', price: 950, turnaround: '4 hours' },
    { code: 'CREA', name: 'Serum Creatinine & eGFR (Renal Function)', category: 'Blood Chemistry', price: 320, turnaround: '2 hours' },
    { code: 'UA', name: 'Serum Uric Acid', category: 'Blood Chemistry', price: 280, turnaround: '2 hours' },
    { code: 'HBA1C', name: 'Hemoglobin A1c (HbA1c Glycated Hb)', category: 'Special Chemistry', price: 750, turnaround: '3 hours' },
    { code: 'XRAY', name: 'Chest X-Ray PA View (Digital Radiography)', category: 'Imaging', price: 500, turnaround: '1 hour' },
    { code: 'ECG', name: '12-Lead Electrocardiogram (ECG)', category: 'Cardiology', price: 450, turnaround: '30 mins' }
];

export const INITIAL_CAREPLUS_USERS = [
    {
        id: 1001,
        email: 'admin@careplus.com',
        password: 'admin123',
        role: 'Admin',
        fullName: 'Dr. Justin Alcantara (Medical Director)',
        phone: '(02) 8820-1000',
        branch: 'CarePlus Metro Branch',
        otp_status: 'Verified',
        patient_type: 'Staff'
    },
    {
        id: 1002,
        email: 'dr.chen@careplus.com',
        password: 'doctor123',
        role: 'Doctor',
        fullName: 'Dr. Robert Chen, MD',
        phone: '0917-111-2233',
        branch: 'CarePlus Metro Branch',
        otp_status: 'Verified',
        patient_type: 'Staff'
    },
    {
        id: 1003,
        email: 'dr.santos@careplus.com',
        password: 'doctor123',
        role: 'Doctor',
        fullName: 'Dr. Maria Santos, MD',
        phone: '0918-222-3344',
        branch: 'CarePlus Northside Branch',
        otp_status: 'Verified',
        patient_type: 'Staff'
    },
    {
        id: 1004,
        email: 'staff@careplus.com',
        password: 'staff123',
        role: 'Staff',
        fullName: 'Nurse Clara Reyes (Head Receptionist)',
        phone: '0919-333-4455',
        branch: 'CarePlus Metro Branch',
        otp_status: 'Verified',
        patient_type: 'Staff'
    },
    {
        id: 1005,
        email: 'lab@careplus.com',
        password: 'lab123',
        role: 'Laboratory',
        fullName: 'MedTech Ronald David (Chief Lab Specialist)',
        phone: '0920-444-5566',
        branch: 'CarePlus Northside Branch',
        otp_status: 'Verified',
        patient_type: 'Staff'
    },
    {
        id: 1006,
        email: 'billing@careplus.com',
        password: 'billing123',
        role: 'Billing',
        fullName: 'Cashier Teresa Gomez (Patient Accounts Officer)',
        phone: '0921-555-6677',
        branch: 'CarePlus Metro Branch',
        otp_status: 'Verified',
        patient_type: 'Staff'
    },
    {
        id: 2001,
        email: 'john.doe@gmail.com',
        password: 'patient123',
        role: 'Patient',
        fullName: 'John Patrick Doe',
        phone: '0922-666-7788',
        branch: 'CarePlus Metro Branch',
        birthdate: '1988-06-14',
        gender: 'Male',
        address: '12 Emerald St, Metro City',
        bloodType: 'O+',
        emergencyContact: 'Mary Doe (Wife) - 0922-999-0001',
        insuranceProvider: 'Maxicare HMO (ID: MX-88291)',
        otp_status: 'Verified',
        patient_type: 'Regular Patient'
    },
    {
        id: 2002,
        email: 'jane.smith@gmail.com',
        password: 'patient123',
        role: 'Patient',
        fullName: 'Jane Alyssa Smith',
        phone: '0923-777-8899',
        branch: 'CarePlus Northside Branch',
        birthdate: '1995-11-20',
        gender: 'Female',
        address: '88 Oakridge Ave, Northside City',
        bloodType: 'A+',
        emergencyContact: 'Peter Smith (Father) - 0923-888-1122',
        insuranceProvider: 'PhilHealth (PIN: 19-028374829-1)',
        otp_status: 'Verified',
        patient_type: 'Regular Patient'
    },
    {
        id: 2003,
        email: 'miguel.tan@gmail.com',
        password: 'patient123',
        role: 'Patient',
        fullName: 'Miguel Antonio Tan',
        phone: '0925-888-9900',
        branch: 'CarePlus Metro Branch',
        birthdate: '1962-03-05',
        gender: 'Male',
        address: '34 Sampaguita Village, Metro City',
        bloodType: 'B+',
        emergencyContact: 'Lucia Tan (Daughter) - 0925-111-3322',
        insuranceProvider: 'Senior Citizen (OSCA ID: SC-4401)',
        otp_status: 'Verified',
        patient_type: 'Senior Citizen'
    }
];

export const INITIAL_CAREPLUS_APPOINTMENTS = [
    {
        id: 3001,
        patientEmail: 'john.doe@gmail.com',
        patientName: 'John Patrick Doe',
        branch: 'CarePlus Metro Branch',
        doctor: 'Dr. Robert Chen, MD',
        category: 'Adult Health',
        service: 'Hypertension & Cholesterol Follow-Up',
        duration: '30 mins',
        date: new Date().toISOString().split('T')[0],
        time: '09:30 AM',
        notes: 'Routine 3-month review of maintenance blood pressure medications.',
        status: 'In Consultation',
        priority: 'Normal'
    },
    {
        id: 3002,
        patientEmail: 'jane.smith@gmail.com',
        patientName: 'Jane Alyssa Smith',
        branch: 'CarePlus Northside Branch',
        doctor: 'Dr. Maria Santos, MD',
        category: 'General Consultation',
        service: 'Acute Pharyngitis & Flu Symptoms',
        duration: '30 mins',
        date: new Date().toISOString().split('T')[0],
        time: '11:00 AM',
        notes: 'Sore throat, mild fever for 2 days. Needs physician evaluation.',
        status: 'Confirmed',
        priority: 'Urgent'
    },
    {
        id: 3003,
        patientEmail: 'miguel.tan@gmail.com',
        patientName: 'Miguel Antonio Tan',
        branch: 'CarePlus Metro Branch',
        doctor: 'Dr. Robert Chen, MD',
        category: 'Diagnostic Review',
        service: 'Comprehensive Senior Wellness Checkup',
        duration: '45 mins',
        date: new Date().toISOString().split('T')[0],
        time: '02:00 PM',
        notes: 'Review laboratory chemistry panel and ECG results.',
        status: 'Pending',
        priority: 'Normal'
    },
    {
        id: 3004,
        patientEmail: 'john.doe@gmail.com',
        patientName: 'John Patrick Doe',
        branch: 'CarePlus Northside Branch',
        doctor: 'Dr. Elena Cruz, MD, FPSP',
        category: 'Diagnostic Laboratory',
        service: 'Fasting Blood Sugar & Lipid Profile Test',
        duration: '20 mins',
        date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
        time: '08:00 AM',
        notes: 'Early morning blood extraction. Patient 10-hour fasting verified.',
        status: 'Completed',
        priority: 'Normal'
    }
];

export const INITIAL_CAREPLUS_CONSULTATIONS = [
    {
        id: 'CONS-2026-001',
        patientEmail: 'john.doe@gmail.com',
        patientName: 'John Patrick Doe',
        doctorName: 'Dr. Robert Chen, MD',
        doctorEmail: 'dr.chen@careplus.com',
        branch: 'CarePlus Metro Branch',
        date: new Date().toISOString().split('T')[0],
        vitals: {
            bloodPressure: '130/84 mmHg',
            heartRate: '76 bpm',
            respiratoryRate: '18 cpm',
            temperature: '36.7 °C',
            weight: '72 kg',
            height: '175 cm',
            bmi: '23.5 (Normal)'
        },
        chiefComplaint: 'Follow-up for cardiovascular maintenance and review of recent lipid panel results.',
        symptoms: 'Occasional mild tension headache during stress, denies chest tightness or dyspnea.',
        diagnosis: 'Essential Primary Hypertension (Stage 1 - Well Controlled), Mild Hyperlipidemia',
        prescription: [
            { medication: 'Amlodipine Besylate', dosage: '5 mg', frequency: 'Once daily (Morning)', duration: '30 days' },
            { medication: 'Atorvastatin Calcium', dosage: '20 mg', frequency: 'Once daily at bedtime', duration: '30 days' }
        ],
        clinicalAdvice: 'Maintain low-sodium diet (<2g/day). Regular aerobic exercise for 30 minutes 4 times weekly. Recheck lipid profile in 3 months.',
        orderedLabs: ['Full Lipid Profile', 'Serum Creatinine & eGFR'],
        createdAt: new Date().toISOString()
    },
    {
        id: 'CONS-2026-002',
        patientEmail: 'jane.smith@gmail.com',
        patientName: 'Jane Alyssa Smith',
        doctorName: 'Dr. Maria Santos, MD',
        doctorEmail: 'dr.santos@careplus.com',
        branch: 'CarePlus Northside Branch',
        date: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0],
        vitals: {
            bloodPressure: '118/76 mmHg',
            heartRate: '82 bpm',
            respiratoryRate: '19 cpm',
            temperature: '38.1 °C (Febrile)',
            weight: '55 kg',
            height: '162 cm',
            bmi: '21.0 (Normal)'
        },
        chiefComplaint: 'Severe sore throat with pain on swallowing, body aches and dry cough for 3 days.',
        symptoms: 'Erythematous posterior pharynx, mild bilateral tonsillar enlargement without exudates, clear breath sounds.',
        diagnosis: 'Acute Viral Pharyngitis / Upper Respiratory Tract Infection',
        prescription: [
            { medication: 'Paracetamol', dosage: '500 mg', frequency: 'Every 6 hours as needed for fever/pain', duration: '5 days' },
            { medication: 'Cetirizine HCl', dosage: '10 mg', frequency: 'Once daily at bedtime', duration: '7 days' },
            { medication: 'Hexetidine Oral Antiseptic Gargle', dosage: '0.1%', frequency: 'Gargle 15ml thrice daily', duration: '5 days' }
        ],
        clinicalAdvice: 'Warm saline gargles, increased oral fluid intake (>2.5L/day), adequate voice rest. Return immediately if high fever persists >48 hours.',
        orderedLabs: ['Complete Blood Count (CBC) with Platelets'],
        createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
    }
];

export const INITIAL_CAREPLUS_LAB_REQUESTS = [
    {
        id: 'LAB-2026-081',
        patientEmail: 'john.doe@gmail.com',
        patientName: 'John Patrick Doe',
        requestingDoctor: 'Dr. Robert Chen, MD',
        branch: 'CarePlus Metro Branch',
        testCategory: 'Blood Chemistry',
        testName: 'Full Lipid Profile',
        requestDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
        completionDate: new Date().toISOString().split('T')[0],
        status: 'Completed',
        technician: 'Ronald David, RMT',
        specimen: 'Serum (Venipuncture, 10h Fasting)',
        results: [
            { parameter: 'Total Cholesterol', value: '208', unit: 'mg/dL', normalRange: '< 200 mg/dL', flag: 'High' },
            { parameter: 'Triglycerides', value: '142', unit: 'mg/dL', normalRange: '< 150 mg/dL', flag: 'Normal' },
            { parameter: 'HDL Cholesterol (Good)', value: '52', unit: 'mg/dL', normalRange: '> 40 mg/dL', flag: 'Normal' },
            { parameter: 'LDL Cholesterol (Calculated)', value: '127', unit: 'mg/dL', normalRange: '< 100 mg/dL', flag: 'High' }
        ],
        remarks: 'Sample clear, no hemolysis noted. Results validated by Clinical Pathologist.'
    },
    {
        id: 'LAB-2026-082',
        patientEmail: 'jane.smith@gmail.com',
        patientName: 'Jane Alyssa Smith',
        requestingDoctor: 'Dr. Maria Santos, MD',
        branch: 'CarePlus Northside Branch',
        testCategory: 'Hematology',
        testName: 'Complete Blood Count (CBC) with Platelets',
        requestDate: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
        completionDate: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
        status: 'Completed',
        technician: 'Ronald David, RMT',
        specimen: 'Whole Blood (EDTA Purple Top)',
        results: [
            { parameter: 'Hemoglobin', value: '13.2', unit: 'g/dL', normalRange: '12.0 - 15.5 g/dL', flag: 'Normal' },
            { parameter: 'Hematocrit', value: '39.8', unit: '%', normalRange: '36.0 - 46.0 %', flag: 'Normal' },
            { parameter: 'WBC Count', value: '9,400', unit: '/uL', normalRange: '4,500 - 11,000 /uL', flag: 'Normal' },
            { parameter: 'Neutrophils', value: '62', unit: '%', normalRange: '50 - 70 %', flag: 'Normal' },
            { parameter: 'Lymphocytes', value: '31', unit: '%', normalRange: '20 - 40 %', flag: 'Normal' },
            { parameter: 'Platelet Count', value: '265,000', unit: '/uL', normalRange: '150,000 - 450,000 /uL', flag: 'Normal' }
        ],
        remarks: 'Hematologic indices within acceptable physiological baseline.'
    },
    {
        id: 'LAB-2026-083',
        patientEmail: 'miguel.tan@gmail.com',
        patientName: 'Miguel Antonio Tan',
        requestingDoctor: 'Dr. Robert Chen, MD',
        branch: 'CarePlus Metro Branch',
        testCategory: 'Imaging',
        testName: 'Chest X-Ray PA View (Digital Radiography)',
        requestDate: new Date().toISOString().split('T')[0],
        completionDate: null,
        status: 'Processing',
        technician: 'Assigned to Radiologic Tech',
        specimen: 'Radiographic Examination',
        results: [],
        remarks: 'Digital exposure taken, pending radiologist formal reading.'
    }
];

export const INITIAL_CAREPLUS_BILLING = [
    {
        id: 'INV-2026-101',
        invoiceNumber: 'CP-INV-101',
        patientEmail: 'john.doe@gmail.com',
        patientName: 'John Patrick Doe',
        branch: 'CarePlus Metro Branch',
        date: new Date().toISOString().split('T')[0],
        items: [
            { description: 'Specialist Medical Consultation (Internal Medicine)', category: 'Professional Fee', amount: 800 },
            { description: 'Full Lipid Profile Chemistry Panel', category: 'Laboratory Test', amount: 850 }
        ],
        subtotal: 1650,
        discountType: 'None',
        discountAmount: 0,
        tax: 0,
        totalAmount: 1650,
        amountPaid: 1650,
        paymentStatus: 'Paid',
        paymentMethod: 'GCash Online',
        receiptNumber: 'OR-CP-88391',
        cashier: 'Teresa Gomez',
        createdAt: new Date().toISOString()
    },
    {
        id: 'INV-2026-102',
        invoiceNumber: 'CP-INV-102',
        patientEmail: 'jane.smith@gmail.com',
        patientName: 'Jane Alyssa Smith',
        branch: 'CarePlus Northside Branch',
        date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
        items: [
            { description: 'General Outpatient Consultation', category: 'Professional Fee', amount: 600 },
            { description: 'Complete Blood Count (CBC) with Platelets', category: 'Laboratory Test', amount: 350 },
            { description: 'Prescription Dispensing & Clinic Triage Pack', category: 'Supplies', amount: 200 }
        ],
        subtotal: 1150,
        discountType: 'PhilHealth Benefit Deduction',
        discountAmount: 300,
        tax: 0,
        totalAmount: 850,
        amountPaid: 850,
        paymentStatus: 'Paid',
        paymentMethod: 'Credit Card (Visa)',
        receiptNumber: 'OR-CP-88392',
        cashier: 'Teresa Gomez',
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
        id: 'INV-2026-103',
        invoiceNumber: 'CP-INV-103',
        patientEmail: 'miguel.tan@gmail.com',
        patientName: 'Miguel Antonio Tan',
        branch: 'CarePlus Metro Branch',
        date: new Date().toISOString().split('T')[0],
        items: [
            { description: 'Comprehensive Senior Consultation', category: 'Professional Fee', amount: 900 },
            { description: 'Chest X-Ray PA View Digital', category: 'Imaging', amount: 500 },
            { description: '12-Lead Electrocardiogram (ECG)', category: 'Cardiology', amount: 450 }
        ],
        subtotal: 1850,
        discountType: 'Senior Citizen (20% Statutory Discount)',
        discountAmount: 370,
        tax: 0,
        totalAmount: 1480,
        amountPaid: 0,
        paymentStatus: 'Unpaid',
        paymentMethod: 'Pending Billing Counter Checkout',
        receiptNumber: 'PENDING-OR',
        cashier: 'Pending',
        createdAt: new Date().toISOString()
    }
];
