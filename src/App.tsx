import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import GlobalErrorBoundary from "@/components/GlobalErrorBoundary";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";

// Auth & Public - Lazy loaded
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/auth/Login"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));

// Modular Imports - Lazy loaded
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const Subjects = lazy(() => import("./modules/academic/Subjects"));
const Timetable = lazy(() => import("./modules/academic/Timetable"));
const Attendance = lazy(() => import("./modules/attendance/Attendance"));
const Exams = lazy(() => import("./modules/academic/Exams"));
const Communication = lazy(() => import("./modules/communication/Communication"));
const PermissionControl = lazy(() => import("./modules/admin/PermissionControl"));

const Assignments = lazy(() => import("./pages/Assignments"));
const Groups = lazy(() => import("./pages/Groups"));
const Events = lazy(() => import("./pages/Events"));
const Analytics = lazy(() => import("./pages/Analytics"));

// Admin Specific - Lazy loaded
const UserManagement = lazy(() => import("./modules/admin/UserManagement"));
const Batches = lazy(() => import("./modules/admin/Batches"));
const DepartmentManagement = lazy(() => import("./modules/admin/DepartmentManagement"));
const Grading = lazy(() => import("./modules/academic/Grading"));
const Enrollments = lazy(() => import("./modules/academic/Enrollments"));
const MyGrades = lazy(() => import("./modules/student/MyGrades"));

// Loading component
const LoadingSpinner = () => (
  <div className="flex h-screen w-full items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <GlobalErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                {/* Campus Control Plane */}
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/subjects" element={<ProtectedRoute allowedRoles={['admin', 'lecturer', 'student']}><Subjects /></ProtectedRoute>} />
                <Route path="/timetable" element={<ProtectedRoute allowedRoles={['admin', 'lecturer', 'student']}><Timetable /></ProtectedRoute>} />
                <Route path="/attendance" element={<ProtectedRoute allowedRoles={['lecturer', 'student']}><Attendance /></ProtectedRoute>} />
                <Route path="/assignments" element={<ProtectedRoute allowedRoles={['lecturer', 'student']}><Assignments /></ProtectedRoute>} />
                <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
                <Route path="/events" element={<ProtectedRoute allowedRoles={['admin', 'lecturer', 'student']}><Events /></ProtectedRoute>} />

                {/* Academic Capabilities */}

                {/* Admin Control */}
                <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin', 'lecturer']} requiredPermission="manage:users"><UserManagement /></ProtectedRoute>} />
                <Route path="/admin/batches" element={<ProtectedRoute allowedRoles={['admin', 'lecturer']}><Batches /></ProtectedRoute>} />
                <Route path="/admin/departments" element={<ProtectedRoute allowedRoles={['admin']}><DepartmentManagement /></ProtectedRoute>} />

                {/* Academic & Grading Logic */}
                <Route path="/grading" element={<ProtectedRoute allowedRoles={['lecturer']}><Grading /></ProtectedRoute>} />
                <Route path="/results" element={<ProtectedRoute allowedRoles={['student']}><MyGrades /></ProtectedRoute>} />
                <Route path="/exams" element={<ProtectedRoute allowedRoles={['lecturer', 'student']}><Exams /></ProtectedRoute>} />
                <Route path="/communication" element={<ProtectedRoute><Communication /></ProtectedRoute>} />
                <Route path="/admin/security" element={<ProtectedRoute allowedRoles={['admin', 'lecturer']} requiredPermission="manage:security"><PermissionControl /></ProtectedRoute>} />
                <Route path="/admin/enrollments" element={<ProtectedRoute allowedRoles={['admin', 'lecturer']}><Enrollments /></ProtectedRoute>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </GlobalErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
