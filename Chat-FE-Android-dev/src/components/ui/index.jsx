import { useEffect, useRef } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { hexToRgba, roleColor, roleLabel } from '../../lib/roles';
import { initialOf } from '../../lib/time';

export const cx = (...parts) => parts.filter(Boolean).join(' ');

// --- button --------------------------------------------------------------

const VARIANTS = {
  primary:
    'bg-accent text-navy hover:bg-accent-dark hover:text-white disabled:hover:bg-accent disabled:hover:text-navy',
  secondary: 'bg-white text-ink border border-parchment hover:bg-canvas disabled:hover:bg-white',
  ghost: 'bg-transparent text-ink-soft hover:bg-parchment/40 disabled:hover:bg-transparent',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:hover:bg-red-600',
};

const SIZES = {
  sm: 'text-sm px-3 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2.5 gap-2',
  lg: 'text-base px-5 py-3 gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className,
  children,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

// --- feedback ------------------------------------------------------------

/** Inline error built from the API's `error` field. */
export function ErrorMessage({ children, className, id }) {
  if (!children) return null;
  return (
    <p
      id={id}
      role="alert"
      className={cx(
        'flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700',
        className,
      )}
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center gap-3 px-6 py-14 text-center',
        className,
      )}
    >
      {Icon && (
        <div className="relative mb-1 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-accent/20 blur-md" aria-hidden="true" />
          <span className="relative flex size-12 items-center justify-center rounded-2xl border border-parchment bg-white shadow-xs text-ink-soft">
            <Icon size={22} aria-hidden="true" />
          </span>
        </div>
      )}
      <div className="space-y-1 max-w-sm">
        <p className="font-display text-base font-semibold text-ink">{title}</p>
        {description && <p className="text-sm text-ink-soft leading-relaxed">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cx('animate-pulse rounded-md bg-parchment/80 transition-colors', className)}
      {...props}
    />
  );
}

// --- identity ------------------------------------------------------------

export function Avatar({ name, role, size = 36, className }) {
  return (
    <span
      className={cx(
        'flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        className,
      )}
      style={{
        backgroundColor: roleColor(role),
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
      }}
      aria-hidden="true"
    >
      {initialOf(name)}
    </span>
  );
}

export function RoleBadge({ role }) {
  const color = roleColor(role);
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{
        color,
        backgroundColor: hexToRgba(color, 0.14),
        border: `1px solid ${hexToRgba(color, 0.3)}`,
      }}
    >
      {roleLabel(role)}
    </span>
  );
}

// --- overlays ------------------------------------------------------------

export function Modal({ open, onClose, title, description, children, size = 'md' }) {
  const panelRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
        return;
      }

      if (event.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            event.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            event.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const timer = setTimeout(() => {
      const target = panelRef.current?.querySelector(
        'input, select, textarea, button:not([data-dialog-close])',
      );
      target?.focus();
    }, 20);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      clearTimeout(timer);
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  const titleId = title ? 'modal-title-heading' : undefined;
  const descId = description ? 'modal-desc-text' : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={cx(
          'animate-rt-in max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-white shadow-lg sm:rounded-xl rt-scroll',
          size === 'lg' ? 'sm:max-w-lg' : 'sm:max-w-md',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-parchment px-5 py-4">
          <div>
            {title && <h2 id={titleId} className="font-display text-lg font-semibold text-ink">{title}</h2>}
            {description && <p id={descId} className="mt-0.5 text-sm text-ink-soft">{description}</p>}
          </div>
          <button
            type="button"
            data-dialog-close
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md p-1 text-ink-soft transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// --- form fields ---------------------------------------------------------

export function Field({ label, htmlFor, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

export const inputClass =
  'w-full rounded-lg border border-parchment bg-white px-3 py-2.5 text-sm text-ink ' +
  'placeholder:text-ink-soft/60 transition-colors focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
  'disabled:cursor-not-allowed disabled:bg-canvas';

/** Segmented role picker — the options passed in are the only ones offered. */
export function RolePicker({ value, onChange, options, disabled, name = 'role' }) {
  const handleKeyDown = (event, index) => {
    if (disabled) return;
    let nextIndex = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      nextIndex = (index + 1) % options.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      nextIndex = (index - 1 + options.length) % options.length;
    }
    if (nextIndex !== index) {
      onChange(options[nextIndex]);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Role"
      className={cx('grid gap-2', options.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}
    >
      {options.map((option, index) => {
        const selected = value === option;
        const color = roleColor(option);
        return (
          <button
            key={option}
            type="button"
            role="radio"
            name={name}
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cx(
              'rounded-lg border px-2 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              selected ? 'border-transparent' : 'border-parchment text-ink-soft hover:bg-canvas',
            )}
            style={
              selected
                ? {
                  color,
                  backgroundColor: hexToRgba(color, 0.14),
                  boxShadow: `inset 0 0 0 1.5px ${color}`,
                }
                : undefined
            }
          >
            {roleLabel(option)}
          </button>
        );
      })}
    </div>
  );
}
