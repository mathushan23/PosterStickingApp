import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./auth/ProtectedRoute";
import Login from "./pages/Login";

// user
import UserDashboard from "./pages/user/UserDashboard";
import SubmitProof from "./pages/user/SubmitProof";
import History from "./pages/user/History";

// admin
import AdminDashboard from "./pages/admin/AdminDashboard";
import Users from "./pages/admin/Users";
import Submissions from "./pages/admin/Submissions";
import SubmissionDetails from "./pages/admin/SubmissionDetails";
import Spots from "./pages/admin/Spots";
import SpotDetails from "./pages/admin/SpotDetails";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />

      {/* USER */}
      <Route path="/user/dashboard" element={
        <ProtectedRoute role="user"><UserDashboard /></ProtectedRoute>
      } />
      <Route path="/user/submit" element={
        <ProtectedRoute role="user"><SubmitProof /></ProtectedRoute>
      } />
      <Route path="/user/history" element={
        <ProtectedRoute role="user"><History /></ProtectedRoute>
      } />

      {/* ADMIN */}
      <Route path="/admin/dashboard" element={
        <ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>
      } />
      <Route path="/admin/users" element={
        <ProtectedRoute role="admin"><Users /></ProtectedRoute>
      } />
      <Route path="/admin/submissions" element={
        <ProtectedRoute role="admin"><Submissions /></ProtectedRoute>
      } />
      <Route path="/admin/submissions/:id" element={
        <ProtectedRoute role="admin"><SubmissionDetails /></ProtectedRoute>
      } />
      <Route path="/admin/spots" element={
        <ProtectedRoute role="admin"><Spots /></ProtectedRoute>
      } />
      <Route path="/admin/spots/:id" element={
        <ProtectedRoute role="admin"><SpotDetails /></ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
