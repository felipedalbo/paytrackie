import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import LegalOnboardingModal from '@/components/legal/LegalOnboardingModal';
import SystemLogo from '@/components/shared/SystemLogo';
import LegalFooter from '@/components/shared/LegalFooter';
import {
  LayoutDashboard,
  FileText,
  Calendar,
  Clock,
  Receipt,
  Calculator,
  User,
  Shield,
  LogOut,
  Menu,
  X,
  Euro,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
  { name: 'Payroll Entry', icon: FileText, page: 'PayrollEntry' },
  { name: 'Overtime', icon: Clock, page: 'Overtime' },
  { name: 'Leave & Time Off', icon: Calendar, page: 'LeaveManagement' },
  { name: 'Summary', icon: Receipt, page: 'Payslips' },
  { name: 'Profile', icon: User, page: 'Profile' },
];

const adminItems = [
  { name: 'Admin Panel', icon: Shield, page: 'AdminPanel' },
  { name: 'Trial Users', icon: User, page: 'TrialUsers' },
];

export default function Layout({ children, currentPageName }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch current user
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Redirect to Welcome if not authenticated (except if already on Welcome page)
  useEffect(() => {
    if (!userLoading && !user && currentPageName !== 'Welcome') {
      navigate('/Welcome');
    }
  }, [user, userLoading, currentPageName, navigate]);

  // Fetch legal acceptance status
  const { data: legalAcceptances, isLoading: legalLoading } = useQuery({
    queryKey: ['legalAcceptance', user?.email],
    queryFn: () => base44.entities.LegalAcceptance.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  const hasAcceptedLegal = legalAcceptances && legalAcceptances.length > 0 && 
    legalAcceptances[0]?.legal_status === 'ACCEPTED';

  // Show legal modal if user hasn't accepted yet
  useEffect(() => {
    if (user && !legalLoading && !hasAcceptedLegal) {
      setShowLegalModal(true);
    }
  }, [user, legalLoading, hasAcceptedLegal]);

  // Accept legal terms mutation
  const acceptLegalMutation = useMutation({
    mutationFn: async () => {
      const timestamp = new Date().toISOString();
      
      return base44.entities.LegalAcceptance.create({
        user_id: user.id,
        user_email: user.email,
        ip_address: 'client-side',
        user_agent: navigator.userAgent,
        terms_version: '1.0.0',
        privacy_version: '1.0.0',
        copyright_version: '1.0.0',
        legal_status: 'ACCEPTED',
        acceptance_timestamp: timestamp,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legalAcceptance'] });
      setShowLegalModal(false);
    },
  });

  // Fetch employee to check admin status
  const { data: employees } = useQuery({
    queryKey: ['employee', user?.email],
    queryFn: () => base44.entities.Employee.filter({ created_by: user?.email }),
    enabled: !!user?.email,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const employee = employees?.[0];
  const isAdmin = employee?.is_admin || user?.role === 'admin';

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  const NavLink = ({ item, onClick }) => {
    const isActive = currentPageName === item.page;
    const Icon = item.icon;

    return (
      <Link
        to={createPageUrl(item.page)}
        onClick={onClick}
        className={cn(
          'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
          isActive
            ? 'bg-emerald-50 text-emerald-700 shadow-sm'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        )}
      >
        <Icon className={cn('h-5 w-5', isActive ? 'text-emerald-600' : 'text-slate-400')} />
        <span>{item.name}</span>
        {isActive && (
          <ChevronRight className="ml-auto h-4 w-4 text-emerald-500" />
        )}
      </Link>
    );
  };

  // Allow Welcome page without authentication
  if (currentPageName === 'Welcome') {
    return children;
  }

  // Block access if legal terms not accepted
  if (user && !legalLoading && !hasAcceptedLegal) {
    return (
      <>
        <LegalOnboardingModal
          isOpen={showLegalModal}
          onAccept={() => acceptLegalMutation.mutate()}
        />
        <div className="flex h-screen items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
            <p className="mt-4 text-slate-600">Loading...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-72 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="border-b border-slate-100 px-6 py-5">
            <SystemLogo size="default" showText={true} />
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
            {navItems.map((item) => (
              <NavLink key={item.name} item={item} />
            ))}

            {isAdmin && (
              <>
                <div className="my-4 border-t border-slate-100" />
                <p className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Administration
                </p>
                {adminItems.map((item) => (
                  <NavLink key={item.name} item={item} />
                ))}
              </>
            )}
          </nav>

          {/* User Info */}
          <div className="border-t border-slate-100 p-4">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                <span className="text-sm font-semibold text-emerald-700">
                  {(employee?.full_name || user?.full_name)?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-slate-900">
                  {employee?.full_name || user?.full_name || 'User'}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {user?.email}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-slate-400 hover:text-slate-600"
              >
                <LogOut className="h-4 w-4" />
              </Button>
              </div>
              </div>
              </div>
              </aside>

      {/* Mobile Header */}
      <header className="fixed left-0 right-0 top-0 z-50 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <SystemLogo size="small" showText={true} textSize="small" />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 h-full w-72 bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b px-6 py-5">
                  <SystemLogo size="default" showText={true} />
                  <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.name}
                      item={item}
                      onClick={() => setIsMobileMenuOpen(false)}
                    />
                  ))}

                  {isAdmin && (
                    <>
                      <div className="my-4 border-t border-slate-100" />
                      <p className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Administration
                      </p>
                      {adminItems.map((item) => (
                        <NavLink
                          key={item.name}
                          item={item}
                          onClick={() => setIsMobileMenuOpen(false)}
                        />
                      ))}
                    </>
                  )}
                </nav>

                <div className="border-t p-4">
                  <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                      <span className="text-sm font-semibold text-emerald-700">
                        {(employee?.full_name || user?.full_name)?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="truncate text-sm font-medium">{employee?.full_name || user?.full_name || 'User'}</p>
                      <p className="truncate text-xs text-slate-500">{user?.email}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleLogout}>
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="min-h-screen pt-16 lg:ml-72 lg:pt-0">
        {children}
        <LegalFooter />
      </main>

      {/* Custom Styles */}
      <style>{`
        :root {
          --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        body {
          font-family: var(--font-sans);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        .text-orange-500 {
          color: #f97316;
        }
        
        /* Smooth scrollbar */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        
        ::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        
        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}