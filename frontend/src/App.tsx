import { Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./store/auth";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import PatientListPage from "./pages/PatientListPage";
import PatientDetailPage from "./pages/PatientDetailPage";
import AppointmentPage from "./pages/AppointmentPage";
import InsightsPage from "./pages/InsightsPage";
import AuditLogPage from "./pages/AuditLogPage";
import LabQueuePage from "./pages/LabQueuePage";

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.accessToken);
  return token ? children : <Navigate to="/login" replace />;
}

/** Redirect to "/" if the current role is not in the allowed list. */
function RoleRoute({
  children,
  roles,
}: {
  children: JSX.Element;
  roles: string[];
}) {
  const role = useAuthStore((s) => s.role);
  return role && roles.includes(role) ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="patients" element={<PatientListPage />} />
        <Route path="patients/:id" element={<PatientDetailPage />} />
        <Route
          path="appointments"
          element={
            <RoleRoute roles={["ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST"]}>
              <AppointmentPage />
            </RoleRoute>
          }
        />
        <Route
          path="lab-queue"
          element={
            <RoleRoute roles={["LAB_TECHNICIAN", "ADMIN"]}>
              <LabQueuePage />
            </RoleRoute>
          }
        />
        <Route
          path="insights"
          element={
            <RoleRoute roles={["ADMIN"]}>
              <InsightsPage />
            </RoleRoute>
          }
        />
        <Route
          path="audit"
          element={
            <RoleRoute roles={["ADMIN"]}>
              <AuditLogPage />
            </RoleRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
