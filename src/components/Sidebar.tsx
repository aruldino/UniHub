import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard, BookOpen, ClipboardCheck, FileText,
  Calendar as CalendarIcon, BarChart3, Bell, LogOut,
  Settings, Layers, BookOpenCheck,
  Award, Calculator, Shield, ShieldCheck, UserPlus, MessageSquare,
  ChevronLeft, ChevronDown, UserCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import NotificationCenter from '@/components/NotificationCenter';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  roles?: string[];
  permission?: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'lecturer', 'student'] },
  { label: 'Subjects', path: '/subjects', icon: BookOpen, roles: ['admin', 'lecturer', 'student'] },
  { label: 'Timetable', path: '/timetable', icon: CalendarIcon, roles: ['admin', 'lecturer', 'student'] },
  { label: 'Academy Events', path: '/events', icon: CalendarIcon, roles: ['admin', 'lecturer', 'student'] },
  { label: 'Attendance', path: '/attendance', icon: ClipboardCheck, roles: ['lecturer', 'student'] },
  { label: 'Assignments', path: '/assignments', icon: FileText, roles: ['lecturer', 'student'] },
  { label: 'Grading', path: '/grading', icon: Calculator, roles: ['lecturer'] },
  { label: 'My Results', path: '/results', icon: Award, roles: ['student'] },
  { label: 'Common Room', path: '/communication', icon: Bell, roles: ['admin', 'lecturer', 'student'] },
  { label: 'Social Hub', path: '/groups', icon: MessageSquare, roles: ['admin', 'lecturer', 'student'] },
  { label: 'Departments', path: '/admin/departments', icon: BookOpenCheck, roles: ['admin'] },
  { label: 'Manage Batches', path: '/admin/batches', icon: Layers, roles: ['admin'] },
  { label: 'Enrollments', path: '/admin/enrollments', icon: UserPlus, roles: ['admin'] },
  { label: 'Users', path: '/admin/users', icon: Settings, roles: ['admin', 'lecturer'], permission: 'manage:users' },
  { label: 'Security', path: '/admin/security', icon: ShieldCheck, roles: ['admin', 'lecturer'], permission: 'manage:security' },
  { label: 'Reports', path: '/analytics', icon: BarChart3, roles: ['admin', 'lecturer'], permission: 'view:reports' },
];

function roleBadgeVariant(role: string | null): 'roleAdmin' | 'roleLecturer' | 'roleStudent' | 'outline' {
  if (role === 'admin') return 'roleAdmin';
  if (role === 'lecturer') return 'roleLecturer';
  if (role === 'student') return 'roleStudent';
  return 'outline';
}

interface SidebarProps {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const Sidebar = ({ sidebarCollapsed, setSidebarCollapsed }: SidebarProps) => {
  const { profile, role, signOut, hasPermission } = useAuth();
  const location = useLocation();

  const filteredNav = navItems.filter(item => {
    const hasRole = !item.roles || (role && item.roles.includes(role));
    const hasPerm = !item.permission || hasPermission(item.permission);
    return hasRole && hasPerm;
  });

  const handleSignOut = async () => {
    await signOut();
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : '';

  return (
    <aside
      className={cn(
        'sidebar fixed left-0 top-0 h-screen flex-col border-r border-[#E2F4F8] bg-white shadow-uni-sidebar transition-[width] duration-300 ease-out z-50',
        sidebarCollapsed ? 'w-16' : 'w-[240px]'
      )}
    >
      <div className="flex h-full flex-col overflow-y-auto">
        {/* Logo Section */}
        <div className="flex items-center gap-2 border-b border-[#E2F4F8] px-3 py-4">
          {!sidebarCollapsed && (
            <>
              <img src="/logo.png" alt="" className="h-9 w-9 shrink-0 object-contain" />
              <div className="min-w-0 flex-1">
                <h1 className="truncate font-heading text-base font-bold text-[#1B2B4B]">UniHub</h1>
                <p className="truncate text-xs text-[#6B7280]">SAMS · Northern UNI</p>
              </div>
            </>
          )}
          {sidebarCollapsed && (
            <img src="/logo.png" alt="" className="mx-auto h-9 w-9 object-contain" />
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('hidden shrink-0 rounded-xl lg:flex', sidebarCollapsed && 'mx-auto')}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft className={cn('h-4 w-4 transition-transform', sidebarCollapsed && 'rotate-180')} />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="custom-scrollbar flex-1 space-y-0.5 overflow-y-auto px-2 py-4">
          {filteredNav.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                title={sidebarCollapsed ? item.label : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-xl py-3 text-sm font-semibold transition-colors',
                  sidebarCollapsed ? 'justify-center px-0' : 'px-3',
                  isActive
                    ? 'border-l-[3px] border-l-[#0EA5C8] bg-[#E0F7FC] text-[#0EA5C8]'
                    : 'border-l-[3px] border-l-transparent text-[#374151] hover:bg-[#F0FAFA] hover:text-[#0B8BA8]',
                )}
              >
                <item.icon
                  className={cn(
                    'h-5 w-5 shrink-0',
                    isActive ? 'text-[#0EA5C8]' : 'text-[#6B7280]',
                  )}
                />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Profile Section */}
        <div className="border-t border-[#E2F4F8] p-3">
          <div className={cn('flex items-center gap-2', sidebarCollapsed && 'flex-col')}>
            <Avatar className="h-9 w-9 shrink-0 border border-[#E2F4F8]">
              <AvatarFallback className="bg-[#E0F7FC] text-xs font-semibold text-[#0EA5C8]">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#1B2B4B]">{profile?.full_name || 'User'}</p>
                <Badge variant={roleBadgeVariant(role)} className="mt-0.5 text-[10px]">
                  {roleLabel}
                </Badge>
              </div>
            )}
            {!sidebarCollapsed && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-xl text-[#6B7280] hover:text-[#EF4444]"
                onClick={() => void handleSignOut()}
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;