import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { getDatabase, getPricelist, loadAllProfilePics, readDatabase, readSession, subscribeToRealtimeDb } from './utils/storage';

// AUTH PAGES
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

// CAREPLUS CLINIC MODULES
import DoctorConsultations from './pages/careplus/DoctorConsultations';
import LaboratoryManagement from './pages/careplus/LaboratoryManagement';
import BillingManagement from './pages/careplus/BillingManagement';
import PatientRegistration from './pages/careplus/PatientRegistration';
import MedicalReports from './pages/careplus/MedicalReports';
import EnterpriseArchitecturePortal from './pages/careplus/EnterpriseArchitecturePortal';

// EXISTING SYSTEM CORE PAGES
import PatientDashboard from './pages/patient/PatientDashboard';
import BookAppointment from './pages/patient/BookAppointment';
import MedicalRecordForm from './pages/patient/MedicalRecordsForm.js';
import PriceListView from './pages/patient/PriceListView';
import ConsentForm from './pages/patient/ConsentForm';

import StaffDashboard from './pages/staff/StaffDashboard';
import BookApproval from './pages/staff/BookApproval.js';
import PriceList from './pages/staff/PriceList';
import StaffMedicalRecords from './pages/staff/MedicalRecords.js';
import ConsentForms from './pages/staff/ConsentForms';
import ReportsDashboard from './pages/staff/ReportsDashboard';

import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import PatientManagement from './pages/admin/PatientManagement';
import AuditLogs from './pages/admin/AuditLogs';

function RootRedirect() {
  return <Navigate to="/login" replace />;
}

function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Instant load if database is already in memory
    const cachedDb = readDatabase();
    if (cachedDb && cachedDb.users && cachedDb.users.length > 0) {
      setLoading(false);
    }

    // Connect active real-time SSE listener and BroadcastChannel
    const session = readSession();
    subscribeToRealtimeDb(session?.email || '', session?.role || '');

    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 1200);

    Promise.all([
      getDatabase(),
      getPricelist().catch(() => []),
      loadAllProfilePics().catch(() => ({}))
    ]).then(() => {
      setLoading(false);
      clearTimeout(safetyTimer);
    }).catch((err) => {
      console.warn('CarePlus local fallback active:', err);
      setLoading(false);
      clearTimeout(safetyTimer);
    });

    return () => clearTimeout(safetyTimer);
  }, []);

  if (loading) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center min-vh-100 animate__animated animate__fadeIn" style={{ backgroundColor: '#f8fafc' }}>
        <div className="p-3 bg-white rounded-4 shadow-sm mb-3 border">
          <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
        <h4 className="fw-bold mb-1 text-dark">CarePlus Clinic Management System</h4>
        <p className="text-muted small">Initializing Multi-Branch Healthcare Network & Central EHR...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login mode="patient" />} />
      <Route path="/admin/login" element={<Login mode="admin" />} />
      <Route path="/superadmin/login" element={<Login mode="superadmin" />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Dashboard routes */}
      <Route path="/:role/*" element={<DashboardWrapper />} />

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}

function DashboardWrapper() {
  const { role } = useParams();
  let content;

  switch (role) {
    case 'patient':
      content = (
        <ProtectedRoute requiredRole="patient">
          <Routes>
            <Route index element={<PatientDashboard />} />
            <Route path="consent" element={<ConsentForm />} />
            <Route path="medical" element={<MedicalRecordForm />} />
            <Route path="book" element={<BookAppointment />} />
            <Route path="consultations" element={<DoctorConsultations />} />
            <Route path="laboratory" element={<LaboratoryManagement />} />
            <Route path="billing" element={<BillingManagement />} />
            <Route path="reports" element={<MedicalReports />} />
            <Route path="ea-blueprint" element={<EnterpriseArchitecturePortal />} />
            <Route path="price-list" element={<PriceListView />} />
          </Routes>
        </ProtectedRoute>
      );
      break;

    case 'staff':
      content = (
        <ProtectedRoute requiredRole="staff">
          <Routes>
            <Route index element={<StaffDashboard />} />
            <Route path="registration" element={<PatientRegistration />} />
            <Route path="consultations" element={<DoctorConsultations />} />
            <Route path="laboratory" element={<LaboratoryManagement />} />
            <Route path="billing" element={<BillingManagement />} />
            <Route path="medical-reports" element={<MedicalReports />} />
            <Route path="ea-blueprint" element={<EnterpriseArchitecturePortal />} />
            <Route path="patients" element={<PatientManagement />} />
            <Route path="medical" element={<StaffMedicalRecords />} />
            <Route path="book" element={<BookApproval />} />
            <Route path="price-list" element={<PriceList />} />
            <Route path="consent-forms" element={<ConsentForms />} />
            <Route path="reports" element={<ReportsDashboard />} />
          </Routes>
        </ProtectedRoute>
      );
      break;

    case 'admin':
      content = (
        <ProtectedRoute requiredRole="admin">
          <Routes>
            <Route index element={<AdminDashboard />} />
            <Route path="registration" element={<PatientRegistration />} />
            <Route path="consultations" element={<DoctorConsultations />} />
            <Route path="laboratory" element={<LaboratoryManagement />} />
            <Route path="billing" element={<BillingManagement />} />
            <Route path="medical-reports" element={<MedicalReports />} />
            <Route path="ea-blueprint" element={<EnterpriseArchitecturePortal />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="patients" element={<PatientManagement />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="book" element={<BookApproval />} />
            <Route path="medical" element={<StaffMedicalRecords />} />
            <Route path="price-list" element={<PriceList />} />
            <Route path="consent-forms" element={<ConsentForms />} />
            <Route path="reports" element={<ReportsDashboard />} />
          </Routes>
        </ProtectedRoute>
      );
      break;

    default:
      return <Navigate to="/login" replace />;
  }

  return <Layout role={role}>{content}</Layout>;
}

export default App;
