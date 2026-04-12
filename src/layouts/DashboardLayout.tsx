import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Search, ChevronDown, UserCircle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import NotificationCenter from '@/components/NotificationCenter';
import Sidebar from '@/components/Sidebar';
import '@/components/Sidebar.css';

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { profile, role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : '';

  const navLabels: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/subjects': 'Subjects',
    '/timetable': 'Timetable',
    '/events': 'Academy Events',
    '/attendance': 'Attendance',
    '/assignments': 'Assignments',
    '/grading': 'Grading',
    '/results': 'My Results',
    '/communication': 'Common Room',
    '/groups': 'Social Hub',
    '/admin/departments': 'Departments',
    '/admin/batches': 'Manage Batches',
    '/admin/enrollments': 'Enrollments',
    '/admin/users': 'Users',
    '/admin/security': 'Security',
    '/analytics': 'Reports',
    '/profile': 'Profile',
  };

  const currentTitle = navLabels[location.pathname] || 'Dashboard';

  return (
    <div className="flex min-h-screen bg-[#F0FAFA]">
      {/* Fixed Sidebar */}
      <Sidebar 
        sidebarCollapsed={sidebarCollapsed} 
        setSidebarCollapsed={setSidebarCollapsed} 
      />

      {/* Main Content Area */}
      <main 
        className={`flex-1 transition-all duration-300 ${
          sidebarCollapsed ? 'ml-16' : 'ml-[240px]'
        }`}
      >
        {/* Header */}
        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-[#E2F4F8] bg-white px-4 py-4 lg:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.6px] text-[#6B7280]">SAMS</p>
              <h2 className="truncate font-heading text-[26px] font-bold leading-tight tracking-[-0.3px] text-[#1B2B4B]">
                {currentTitle}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
              <Input
                placeholder="Search…"
                className="h-10 w-[200px] rounded-[10px] border-[#E2F4F8] bg-[#F8FFFE] pl-9 lg:w-[240px]"
              />
            </div>
            <NotificationCenter />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 rounded-2xl px-2">
                  <Avatar className="h-9 w-9 border border-[#E2F4F8]">
                    <AvatarFallback className="bg-[#E0F7FC] text-xs font-semibold text-[#0EA5C8]">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="hidden h-4 w-4 text-[#6B7280] sm:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 uni-modal-surface border-[#E2F4F8] p-1">
                <DropdownMenuItem
                  className="rounded-xl"
                  onSelect={(e) => {
                    e.preventDefault();
                    navigate('/profile');
                  }}
                >
                  <UserCircle className="mr-2 h-4 w-4 text-[#0EA5C8]" />
                  <span className="text-[#374151]">Profile</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#E2F4F8]" />
                <DropdownMenuItem
                  className="rounded-xl text-[#EF4444] focus:text-[#EF4444]"
                  onSelect={(e) => {
                    e.preventDefault();
                    void handleSignOut();
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <div className="px-4 py-6 pb-24 lg:px-6">
          <div className="mx-auto w-full max-w-content">{children}</div>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;