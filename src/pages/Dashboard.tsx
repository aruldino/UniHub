import { useAuth } from '@/context/AuthContext';
import AdminDashboard from '@/modules/admin/AdminDashboard';
import LecturerDashboard from '@/modules/lecturer/LecturerDashboard';
import StudentDashboard from '@/modules/student/StudentDashboard';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Dashboard = () => {
  const { user, role, loading } = useAuth();

  const renderDashboard = () => {
    if (user && !role) {
      return (
        <Card className="max-w-lg border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="text-lg">Account setup incomplete</CardTitle>
            <CardDescription>
              You are signed in, but no role is assigned in the <code className="text-xs">user_roles</code> table.
              Ask an administrator to add your user in Supabase (Authentication → Users) and insert a row in{' '}
              <code className="text-xs">user_roles</code> with role <code className="text-xs">student</code>,{' '}
              <code className="text-xs">lecturer</code>, or <code className="text-xs">admin</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Until then, most menu items may not work as expected.
          </CardContent>
        </Card>
      );
    }
    switch (role) {
      case 'admin':
        return <AdminDashboard />;
      case 'lecturer':
        return <LecturerDashboard />;
      case 'student':
        return <StudentDashboard />;
      default:
        return (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Sign in to continue.</p>
          </div>
        );
    }
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <h1 className="text-2xl font-black font-heading tracking-tight mb-2 underline decoration-primary decoration-4 underline-offset-4">
          UniHub Overview
        </h1>
        <p className="text-muted-foreground mb-8">
          Signed in as{' '}
          <span className="text-primary font-bold uppercase">{role ?? (user ? 'no role yet' : 'guest')}</span>
        </p>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          renderDashboard()
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
