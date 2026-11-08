import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Search,
  Trash2,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react';
import { Avatar, Button, EmptyState, ErrorMessage, RoleBadge, Skeleton } from '../ui';
import { isAbortError } from '../../api/client';
import { ConfirmDialog } from '../ConfirmDialog';
import { AddUserModal } from './AddUserModal';
import { ChangeRoleModal } from './ChangeRoleModal';
import { ROLES, roleLabel } from '../../lib/roles';

const MENU_WIDTH = 176;

function RowMenu({ user, open, onToggle, onChangeRole, onRemove, manageable, currentUserId }) {
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const [position, setPosition] = useState(null);

  // The table card clips its overflow, so the menu is positioned against the
  // viewport instead of the row.
  useEffect(() => {
    if (!open) {
      setPosition(null);
      return undefined;
    }

    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const openUpwards = rect.bottom + 110 > window.innerHeight;
      const leftPos = Math.min(
        Math.max(8, rect.right - MENU_WIDTH),
        window.innerWidth - MENU_WIDTH - 8,
      );
      setPosition({
        left: leftPos,
        top: openUpwards ? undefined : rect.bottom + 6,
        bottom: openUpwards ? window.innerHeight - rect.top + 6 : undefined,
      });
    };
    place();

    // Auto focus first item on open
    const timer = setTimeout(() => {
      menuRef.current?.querySelector('button')?.focus();
    }, 20);

    const onDocumentClick = (event) => {
      if (!menuRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) {
        onToggle(null);
      }
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onToggle(null);
        triggerRef.current?.focus();
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!menuRef.current) return;
        const items = Array.from(menuRef.current.querySelectorAll('button'));
        if (items.length === 0) return;
        event.preventDefault();
        const currentIndex = items.indexOf(document.activeElement);
        if (event.key === 'ArrowDown') {
          const next = (currentIndex + 1) % items.length;
          items[next]?.focus();
        } else {
          const prev = (currentIndex - 1 + items.length) % items.length;
          items[prev]?.focus();
        }
      }
    };

    const close = () => onToggle(null);

    document.addEventListener('mousedown', onDocumentClick);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', onDocumentClick);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open, onToggle]);

  if (!manageable) {
    const unmanageableTitle =
      user.id === currentUserId
        ? 'You cannot modify your own account'
        : `${roleLabel(user.role)} accounts cannot be managed here`;

    return (
      <span
        className="block text-right text-xs text-ink-soft"
        title={unmanageableTitle}
      >
        —
      </span>
    );
  }

  const menuId = `user-actions-menu-${user.id}`;

  return (
    <div className="flex justify-end">
      <button
        type="button"
        ref={triggerRef}
        onClick={() => onToggle(open ? null : user.id)}
        aria-label={`Actions for ${user.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-canvas hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
      >
        <MoreHorizontal size={18} />
      </button>

      {open && position && (
        <div
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-label={`Actions for ${user.name}`}
          style={{ ...position, width: MENU_WIDTH }}
          className="animate-rt-in fixed z-50 overflow-hidden rounded-lg border border-parchment bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onToggle(null);
              onChangeRole(user);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-canvas focus:bg-canvas focus:outline-none"
          >
            <UserCog size={15} aria-hidden="true" />
            Change role
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onToggle(null);
              onRemove(user);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 focus:bg-red-50 focus:outline-none"
          >
            <Trash2 size={15} aria-hidden="true" />
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The Admin and HR panels share the user management table interface with custom titles,
 * API endpoints, and assignable role scopes.
 */
export function UserManagementPanel({ title, subtitle, api, roleOptions, currentUserId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Search & Pagination States
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const [addOpen, setAddOpen] = useState(false);
  const [menuUserId, setMenuUserId] = useState(null);
  const [roleTarget, setRoleTarget] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState(null);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setUsers((current) => {
      if (current.length === 0) setLoading(true);
      return current;
    });
    setError(null);

    api
      .list({ signal: controller.signal })
      .then((data) => {
        setUsers(data.users ?? []);
        setLoading(false);
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setError(err.message);
        setLoading(false);
      });

    return () => controller.abort();
  }, [api, reloadKey]);

  // Filter users by search query (name, email, or role)
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.trim().toLowerCase();
    return users.filter(
      (user) =>
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.role?.toLowerCase().includes(query),
    );
  }, [users, searchQuery]);

  // Calculate total pages and safe clamped page index
  const totalUsers = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  // Reset to page 1 when search or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, pageSize]);

  // Keep state synchronized if totalPages shrinks
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex = totalUsers === 0 ? 0 : (safePage - 1) * pageSize;
  const paginatedUsers = useMemo(() => {
    return filteredUsers.slice(startIndex, startIndex + pageSize);
  }, [filteredUsers, startIndex, pageSize]);

  const displayFrom = totalUsers === 0 ? 0 : startIndex + 1;
  const displayTo = Math.min(startIndex + pageSize, totalUsers);

  /** Only users with roles assignable in the active panel (and not self) are manageable. */
  const isManageable = (user) => roleOptions.includes(user.role) && user.id !== currentUserId;

  async function handleChangeRole(role) {
    await api.changeRole(roleTarget.id, role);
    setUsers((current) =>
      current.map((user) => (user.id === roleTarget.id ? { ...user, role } : user)),
    );
    setRoleTarget(null);
    refresh();
  }

  async function handleRemove() {
    setRemoving(true);
    setRemoveError(null);
    try {
      await api.remove(removeTarget.id);
      setUsers((current) => current.filter((user) => user.id !== removeTarget.id));
      setRemoveTarget(null);
      refresh();
    } catch (err) {
      setRemoveError(err.message);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <section className="rt-scroll h-full overflow-y-auto" aria-label={title}>
      {/* Screen reader live region for table updates */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {loading
          ? 'Loading users list'
          : `Showing ${displayFrom} to ${displayTo} of ${totalUsers} users`}
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{title}</h1>
            <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus size={16} aria-hidden="true" />
            <span>Add user</span>
          </Button>
        </header>

        {/* Toolbar: Search input & Page size selector */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-parchment/80 bg-white/70 p-3 sm:p-4 shadow-2xs">
          <div className="relative max-w-md flex-1">
            <Search
              size={16}
              className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-soft/70 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users by name, email, or role…"
              aria-label="Search users by name, email, or role"
              className="w-full rounded-lg border border-parchment bg-white py-2 pr-3 pl-9 text-sm text-ink placeholder:text-ink-soft/60 focus:border-accent focus:outline-none transition-colors [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 text-sm text-ink-soft">
            <label htmlFor="pageSizeSelect" className="shrink-0 font-medium text-xs sm:text-sm">
              Rows per page:
            </label>
            <select
              id="pageSizeSelect"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Rows per page"
              className="cursor-pointer rounded-lg border border-parchment bg-white px-2.5 py-1.5 text-sm font-medium text-ink focus:border-accent focus:outline-none transition-colors"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-parchment bg-white shadow-2xs">
          {/* Loading Skeleton */}
          {loading && (
            <div className="rt-scroll w-full overflow-x-auto" aria-busy="true" aria-label="Loading users">
              <table className="w-full border-collapse text-left" aria-label={`${title} skeleton table`}>
                <thead>
                  <tr className="border-b border-parchment bg-canvas/60 text-xs tracking-wide text-ink-soft uppercase">
                    <th scope="col" className="px-3 py-3 font-medium sm:px-4">
                      Name
                    </th>
                    <th scope="col" className="hidden px-4 py-3 font-medium sm:table-cell">
                      Email
                    </th>
                    <th scope="col" className="px-3 py-3 font-medium sm:px-4">
                      Role
                    </th>
                    <th scope="col" className="px-2 py-3 text-right font-medium sm:px-4">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-parchment">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index} className="align-middle">
                      <td className="px-3 py-3 sm:px-4">
                        <div className="flex items-center gap-3">
                          <Skeleton className="size-[34px] shrink-0 rounded-full" />
                          <div className="space-y-1.5 min-w-0">
                            <Skeleton className="h-3.5 w-28 sm:w-36" />
                            <Skeleton className="h-3 w-40 sm:hidden" />
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <Skeleton className="h-3.5 w-44" />
                      </td>
                      <td className="px-3 py-3 sm:px-4">
                        <Skeleton className="h-6 w-20 rounded-full" />
                      </td>
                      <td className="px-2 py-3 text-right sm:px-4">
                        <Skeleton className="ml-auto size-7 rounded-md" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="space-y-3 p-6 text-center sm:text-left">
              <ErrorMessage>{error}</ErrorMessage>
              <Button variant="secondary" size="sm" onClick={refresh}>
                Try again
              </Button>
            </div>
          )}

          {/* Empty State: No Users in System */}
          {!loading && !error && users.length === 0 && (
            <EmptyState
              icon={Users}
              title="No users yet"
              description="Add your first teammate to get them into CS Setu."
              action={
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <UserPlus size={15} aria-hidden="true" />
                  <span>Add user</span>
                </Button>
              }
            />
          )}

          {/* Empty State: Search Query Filter Zero Results */}
          {!loading && !error && users.length > 0 && filteredUsers.length === 0 && (
            <EmptyState
              icon={Search}
              title="No matching users found"
              description={`No user records match "${searchQuery}". Try adjusting your search term.`}
              action={
                <Button variant="secondary" size="sm" onClick={() => setSearchQuery('')}>
                  Clear search
                </Button>
              }
            />
          )}

          {/* User Table & Pagination */}
          {!loading && !error && filteredUsers.length > 0 && (
            <>
              <div className="rt-scroll w-full overflow-x-auto">
                <table className="w-full border-collapse text-left" aria-label={`${title} user list`}>
                  <thead>
                    <tr className="border-b border-parchment bg-canvas/60 text-xs tracking-wide text-ink-soft uppercase">
                      <th scope="col" className="px-3 py-3 font-medium sm:px-4">
                        Name
                      </th>
                      <th scope="col" className="hidden px-4 py-3 font-medium sm:table-cell">
                        Email
                      </th>
                      <th scope="col" className="px-3 py-3 font-medium sm:px-4">
                        Role
                      </th>
                      <th scope="col" className="px-2 py-3 text-right font-medium sm:px-4">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-parchment">
                    {paginatedUsers.map((user) => (
                      <tr key={user.id} className="align-middle transition-colors hover:bg-canvas/50">
                        <td className="px-3 py-3 sm:px-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={user.name} role={user.role} size={34} />
                            <div className="min-w-0 max-w-[7rem] sm:max-w-none">
                              <p className="truncate text-sm font-medium text-ink">
                                {user.name}
                                {user.id === currentUserId && (
                                  <span className="ml-1.5 text-xs font-normal text-ink-soft">
                                    (you)
                                  </span>
                                )}
                              </p>
                              <p className="truncate text-xs text-ink-soft sm:hidden">
                                {user.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 text-sm text-ink-soft sm:table-cell">
                          <span className="block max-w-[16rem] truncate">{user.email}</span>
                        </td>
                        <td className="px-3 py-3 sm:px-4">
                          <RoleBadge role={user.role} />
                        </td>
                        <td className="px-2 py-3 sm:px-4">
                          <RowMenu
                            user={user}
                            currentUserId={currentUserId}
                            manageable={isManageable(user)}
                            open={menuUserId === user.id}
                            onToggle={setMenuUserId}
                            onChangeRole={setRoleTarget}
                            onRemove={(target) => {
                              setRemoveError(null);
                              setRemoveTarget(target);
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="flex flex-col items-center justify-between gap-3 border-t border-parchment bg-canvas/30 px-4 py-3 sm:flex-row sm:px-5">
                <p className="text-xs text-ink-soft">
                  Showing <span className="font-semibold text-ink">{displayFrom}</span> to{' '}
                  <span className="font-semibold text-ink">{displayTo}</span> of{' '}
                  <span className="font-semibold text-ink">{totalUsers}</span> users
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                    disabled={safePage === 1}
                    aria-label="Previous page"
                    aria-disabled={safePage === 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-parchment bg-white px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft size={14} />
                    <span>Previous</span>
                  </button>

                  <span className="px-2 text-xs font-medium text-ink-soft" aria-current="page">
                    Page {safePage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
                    disabled={safePage === totalPages}
                    aria-label="Next page"
                    aria-disabled={safePage === totalPages}
                    className="inline-flex items-center gap-1 rounded-lg border border-parchment bg-white px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span>Next</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <AddUserModal
        open={addOpen}
        roleOptions={roleOptions}
        onClose={() => setAddOpen(false)}
        onCreate={api.create}
        onCreated={(newUser) => {
          if (newUser) {
            setUsers((current) => [newUser, ...current]);
          }
          refresh();
        }}
      />

      <ChangeRoleModal
        open={Boolean(roleTarget)}
        user={roleTarget}
        roleOptions={roleOptions}
        onClose={() => setRoleTarget(null)}
        onSubmit={handleChangeRole}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Remove user"
        description={
          removeTarget
            ? `${removeTarget.name} will lose access to CS Setu immediately. This cannot be undone.`
            : ''
        }
        confirmLabel="Remove user"
        loading={removing}
        error={removeError}
        onCancel={() => {
          setRemoveTarget(null);
          setRemoveError(null);
        }}
        onConfirm={handleRemove}
      />
    </section>
  );
}
