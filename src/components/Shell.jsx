import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { KeyRound, LogOut, Menu, MessageSquare, Shield, Users, X } from 'lucide-react';
import { useAuth } from '../state/AuthContext';
import { useRealtime } from '../state/RealtimeContext';
import { ROLES, roleLabel } from '../lib/roles';
import { Avatar, cx } from './ui';
import { ChangePasswordModal } from './auth/ChangePasswordModal';

/** Nav items, each gated on the roles allowed to see it. */
const NAV_ITEMS = [
  { to: '/chats', label: 'Chats', icon: MessageSquare, roles: null },
  { to: '/admin', label: 'Admin panel', icon: Shield, roles: [ROLES.ADMIN] },
  { to: '/hr', label: 'HR panel', icon: Users, roles: [ROLES.HR] },
];

const CONNECTION_LABEL = {
  connected: 'Live',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  disconnected: 'Offline',
};

function ConnectionDot({ status }) {
  const color =
    status === 'connected'
      ? 'bg-emerald-400'
      : status === 'disconnected'
        ? 'bg-red-400'
        : 'bg-amber-400';
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-parchment/60">
      <span className={cx('size-1.5 rounded-full', color)} aria-hidden="true" />
      {CONNECTION_LABEL[status] ?? status}
    </span>
  );
}

function SidebarContent({ onNavigate, onOpenChangePassword }) {
  const { user, logout } = useAuth();
  const { status } = useRealtime();

  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user?.role));

  return (
    <div className="flex h-full flex-col bg-navy text-parchment">
      <div className="px-5 pt-6 pb-4 flex items-center gap-3">
        <img src="/Setu - Square.webp" alt="CS Setu Logo" className="h-6 w-6 object-contain" />
        <span className="font-display text-xl font-bold tracking-tight text-parchment">
          CS Setu
        </span>
      </div>

      <div className="mx-3 flex items-center gap-3 rounded-lg bg-white/5 px-3 py-3">
        <Avatar name={user?.name} role={user?.role} size={38} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-parchment">{user?.name}</p>
          <p className="text-xs text-parchment/60">{roleLabel(user?.role)}</p>
        </div>
      </div>

      <nav className="mt-5 flex-1 space-y-1 px-3" aria-label="Main">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-white/10 text-parchment'
                  : 'text-parchment/70 hover:bg-white/5 hover:text-parchment',
              )
            }
          >
            <Icon size={18} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-3 border-t border-white/10 px-5 py-4">
        <ConnectionDot status={status} />
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            onOpenChangePassword?.();
          }}
          className="flex items-center gap-2 text-sm text-parchment/70 transition-colors hover:text-parchment"
        >
          <KeyRound size={16} aria-hidden="true" />
          Change password
        </button>
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-2 text-sm text-parchment/70 transition-colors hover:text-parchment"
        >
          <LogOut size={16} aria-hidden="true" />
          Sign out
        </button>
      </div>
    </div>
  );
}

/** App frame used by every page after login. */
export function Shell({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const { mustChangePassword, completePasswordChange } = useAuth();
  const location = useLocation();

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKeyDown = (event) => event.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  return (
    <div className="flex h-full bg-canvas">
      <aside className="hidden w-64 shrink-0 md:block">
        <SidebarContent onOpenChangePassword={() => setChangePasswordOpen(true)} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-navy/60"
            onClick={() => setDrawerOpen(false)}
            role="presentation"
          />
          <div className="animate-rt-in absolute inset-y-0 left-0 w-64 shadow-xl">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              className="absolute top-5 right-3 z-10 rounded-md p-1 text-parchment/70 hover:text-parchment"
            >
              <X size={18} />
            </button>
            <SidebarContent
              onNavigate={() => setDrawerOpen(false)}
              onOpenChangePassword={() => setChangePasswordOpen(true)}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-parchment bg-navy px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            className="rounded-md p-1 text-parchment"
          >
            <Menu size={20} />
          </button>
          <img src="/Setu - Square.webp" alt="CS Setu Logo" className="h-6 w-6 object-contain" />
          <span className="font-display text-lg font-bold text-parchment">CS Setu</span>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>

      {/* Self-service password change modal */}
      <ChangePasswordModal
        open={changePasswordOpen}
        forced={false}
        onClose={() => setChangePasswordOpen(false)}
        onSuccess={() => setChangePasswordOpen(false)}
      />

      {/* Forced first-time password change modal */}
      {mustChangePassword && (
        <ChangePasswordModal
          open={true}
          forced={true}
          onSuccess={completePasswordChange}
        />
      )}
    </div>
  );
}
