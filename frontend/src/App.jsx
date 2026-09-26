import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useWard } from "./context/WardContext";
import { can, CLINICAL_ROLES } from "./access";
import Shell from "./components/Shell";
import Login from "./pages/Login";
import Forgot from "./pages/Forgot";
import Signup from "./pages/Signup";
import Pending from "./pages/Pending";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import PatientProfile from "./pages/PatientProfile";
import LiveMonitor from "./pages/LiveMonitor";
import Alerts from "./pages/Alerts";
import AlertDetail from "./pages/AlertDetail";
import AIInsights from "./pages/AIInsights";
import AIExplanation from "./pages/AIExplanation";
import Caregivers from "./pages/Caregivers";
import CaregiverActivity from "./pages/CaregiverActivity";
import Equipment from "./pages/Equipment";
import IoT from "./pages/IoT";
import Notes from "./pages/Notes";
import Medications from "./pages/Medications";
import Attendance from "./pages/Attendance";
import Reports from "./pages/Reports";
import AuditLog from "./pages/AuditLog";
import Settings from "./pages/Settings";
import Users from "./pages/Users";

function Guard({ feature, children }) {
  const { user, authReady } = useWard();
  const location = useLocation();
  if (!authReady) return null;
  if (!user) return <Navigate to="/" state={{ from: location.pathname }} replace />;
  if (user.role === "pending" || user.status === "pending") return <Navigate to="/pending" replace />;
  if (!CLINICAL_ROLES.includes(user.role)) return <Navigate to="/" replace />;
  if (feature && !can(user, feature)) return <Navigate to="/app" replace />;
  return children;
}

function PendingOnly({ children }) {
  const { user, authReady } = useWard();
  if (!authReady) return null;
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== "pending" && user.status !== "pending") return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot" element={<Forgot />} />
      <Route path="/pending" element={<PendingOnly><Pending /></PendingOnly>} />
      <Route path="/app" element={<Guard><Shell /></Guard>}>
        <Route index element={<Dashboard />} />
        <Route path="patients" element={<Patients />} />
        <Route path="patients/:id" element={<PatientProfile />} />
        <Route path="monitor" element={<LiveMonitor />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="alerts/:id" element={<AlertDetail />} />
        <Route path="ai" element={<Guard feature="insights"><AIInsights /></Guard>} />
        <Route path="ai/:id" element={<Guard feature="insights"><AIExplanation /></Guard>} />
        <Route path="caregivers" element={<Guard feature="caregivers"><Caregivers /></Guard>} />
        <Route path="caregivers/:id" element={<Guard feature="caregivers"><CaregiverActivity /></Guard>} />
        <Route path="attendance" element={<Guard feature="attendance"><Attendance /></Guard>} />
        <Route path="equipment" element={<Guard feature="devices"><Equipment /></Guard>} />
        <Route path="iot" element={<Guard feature="devices"><IoT /></Guard>} />
        <Route path="notes" element={<Guard feature="notes"><Notes /></Guard>} />
        <Route path="medications" element={<Guard feature="medications"><Medications /></Guard>} />
        <Route path="reports" element={<Guard feature="reports"><Reports /></Guard>} />
        <Route path="audit" element={<Guard feature="audit"><AuditLog /></Guard>} />
        <Route path="users" element={<Guard feature="users"><Users /></Guard>} />
        <Route path="settings" element={<Guard feature="settings"><Settings /></Guard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
