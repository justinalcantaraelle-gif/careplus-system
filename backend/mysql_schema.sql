-- ====================================================================
-- MySQL / TiDB Database Schema for Doc Dental Care Clinical System
-- Target: MySQL 8.0+ / TiDB Cloud Serverless
-- Character Set: utf8mb4 (Full Unicode & Emoji support)
-- ====================================================================

-- 0. Create Database (if not exists)
CREATE DATABASE IF NOT EXISTS doc_dental_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE doc_dental_db;

-- 1. Users Table (Patients, Staff, Admin, SuperAdmin)
CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NULL,
    temp_otp VARCHAR(255) NULL,
    reset_token VARCHAR(255) NULL,
    reset_token_expires BIGINT NULL,
    otp_status VARCHAR(50) NULL,
    banned_until VARCHAR(100) NULL,
    patient_type VARCHAR(50) NULL DEFAULT 'New Patient',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_email (email),
    INDEX idx_user_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
    id BIGINT PRIMARY KEY,
    patient_email VARCHAR(255) NOT NULL,
    patient_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NULL,
    service VARCHAR(255) NULL,
    duration VARCHAR(50) NULL,
    date VARCHAR(50) NULL,
    time VARCHAR(50) NULL,
    notes TEXT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    cancelled_due_to_emergency BOOLEAN DEFAULT FALSE,
    emergency_reason TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_app_patient_email (patient_email),
    INDEX idx_app_date (date),
    INDEX idx_app_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Medical Records Table (Medical History, Questionnaires, Vitals)
CREATE TABLE IF NOT EXISTS medical_records (
    email VARCHAR(255) PRIMARY KEY,
    record_data JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_med_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Dental Charts Table (Stores Tooth Treatments & Braces Color Selections / Approvals)
CREATE TABLE IF NOT EXISTS dental_charts (
    email VARCHAR(255) PRIMARY KEY,
    chart_data JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_dental_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Intraoral Charts Table (Stores Intraoral Exam, Tooth Conditions, Findings & Exam Notes)
CREATE TABLE IF NOT EXISTS intraoral_charts (
    email VARCHAR(255) PRIMARY KEY,
    chart_data JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_intra_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Patient Charts Table (Patient Timeline, Braces History, Notification Tracking)
CREATE TABLE IF NOT EXISTS patient_charts (
    email VARCHAR(255) PRIMARY KEY,
    chart_data JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_patient_chart_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Audit Logs Table (System & Staff Activity Logs)
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT PRIMARY KEY,
    action VARCHAR(255) NOT NULL,
    details TEXT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Clinic Pricelist Table (Services Catalog, Chair Durations, Prices)
CREATE TABLE IF NOT EXISTS clinic_pricelist (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(255) NOT NULL,
    service VARCHAR(255) NOT NULL,
    price VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_price_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Profile Pics Table (Base64 Patient & Staff Avatars)
CREATE TABLE IF NOT EXISTS profile_pics (
    email VARCHAR(255) PRIMARY KEY,
    photo_data LONGTEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_pic_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Consent Records Table (Digital Signatures & Signed Agreements)
CREATE TABLE IF NOT EXISTS consent_records (
    email VARCHAR(255) PRIMARY KEY,
    signature LONGTEXT NOT NULL,
    date_signed VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_consent_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. User Tokens Table (Session Storage & Token Invalidation)
CREATE TABLE IF NOT EXISTS user_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    email VARCHAR(255) NOT NULL,
    token TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    INDEX idx_token_email (email),
    INDEX idx_token_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. CarePlus Clinic Branches Table
CREATE TABLE IF NOT EXISTS clinic_branches (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    short_name VARCHAR(100) NOT NULL,
    tag VARCHAR(100) NULL,
    address TEXT NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. CarePlus Doctor Consultations Table
CREATE TABLE IF NOT EXISTS consultations (
    id VARCHAR(100) PRIMARY KEY,
    patient_email VARCHAR(255) NOT NULL,
    patient_name VARCHAR(255) NOT NULL,
    doctor_name VARCHAR(255) NOT NULL,
    doctor_email VARCHAR(255) NULL,
    branch VARCHAR(255) NOT NULL,
    consultation_date VARCHAR(50) NOT NULL,
    vitals JSON NULL,
    chief_complaint TEXT NOT NULL,
    symptoms TEXT NULL,
    diagnosis TEXT NOT NULL,
    clinical_advice TEXT NULL,
    prescription JSON NULL,
    ordered_labs JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cons_patient (patient_email),
    INDEX idx_cons_branch (branch),
    INDEX idx_cons_date (consultation_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. CarePlus Laboratory Requests & Results Table
CREATE TABLE IF NOT EXISTS laboratory_requests (
    id VARCHAR(100) PRIMARY KEY,
    patient_email VARCHAR(255) NOT NULL,
    patient_name VARCHAR(255) NOT NULL,
    requesting_doctor VARCHAR(255) NOT NULL,
    branch VARCHAR(255) NOT NULL,
    test_category VARCHAR(100) NOT NULL,
    test_name VARCHAR(255) NOT NULL,
    request_date VARCHAR(50) NOT NULL,
    completion_date VARCHAR(50) NULL,
    status VARCHAR(50) DEFAULT 'Requested',
    technician VARCHAR(255) NULL,
    specimen VARCHAR(255) NULL,
    results JSON NULL,
    remarks TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_lab_patient (patient_email),
    INDEX idx_lab_branch (branch),
    INDEX idx_lab_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. CarePlus Billing & Payments Invoices Table
CREATE TABLE IF NOT EXISTS billing_records (
    id VARCHAR(100) PRIMARY KEY,
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    patient_email VARCHAR(255) NOT NULL,
    patient_name VARCHAR(255) NOT NULL,
    branch VARCHAR(255) NOT NULL,
    invoice_date VARCHAR(50) NOT NULL,
    items JSON NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    discount_type VARCHAR(100) NULL,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    tax DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL,
    amount_paid DECIMAL(10, 2) DEFAULT 0,
    payment_status VARCHAR(50) DEFAULT 'Unpaid',
    payment_method VARCHAR(100) NULL,
    receipt_number VARCHAR(100) NULL,
    cashier VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_bill_patient (patient_email),
    INDEX idx_bill_branch (branch),
    INDEX idx_bill_status (payment_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
