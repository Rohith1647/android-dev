import { useEffect, useState } from 'react';
import { Check, Copy, UserPlus } from 'lucide-react';
import { Button, ErrorMessage, Field, Modal, RolePicker, inputClass } from '../ui';

/**
 * Add-user dialog. `roleOptions` is the whole allow-list — Admin is never among
 * them, and HR only ever passes Employee/Student.
 */
export function AddUserModal({ open, onClose, onCreate, roleOptions, onCreated }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(roleOptions[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setEmail('');
    setRole(roleOptions[0]);
    setError(null);
    setSubmitting(false);
    setCreated(null);
    setCopied(false);
  }, [open, roleOptions]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) return setError('Name is required');
    if (!email.trim()) return setError('Email is required');

    setSubmitting(true);
    try {
      const data = await onCreate({ name: name.trim(), email: email.trim(), role });
      // 201 -> show the temporary password once so it can be shared manually.
      setCreated(data);
      onCreated?.(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function copyPassword() {
    const pwd = created?.temp_password ?? created?.tempPassword;
    if (!pwd) return;

    let success = false;
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(pwd);
        success = true;
      } catch {
        success = false;
      }
    }

    if (!success) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = pwd;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        success = false;
      }
    }

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? () => { } : onClose}
      title={created ? 'Account created' : 'Add user'}
      description={
        created
          ? 'Share these details with the new user — the password is shown only once.'
          : 'They will sign in with the temporary password shown after you submit.'
      }
    >
      {created ? (
        <div className="space-y-4">
          <div className="space-y-2 rounded-lg border border-parchment bg-canvas p-4">
            <p className="text-sm text-ink">
              <span className="font-medium">{created.user?.name ?? name}</span>
              <span className="text-ink-soft"> · {created.user?.email ?? email}</span>
            </p>
            <div className="flex items-center justify-between gap-3 rounded-md border border-parchment bg-white px-3 py-2">
              <div>
                <p className="text-[11px] tracking-wide text-ink-soft uppercase">
                  Temporary password
                </p>
                <p className="font-mono text-sm text-ink">{created.temp_password ?? created.tempPassword}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={copyPassword} aria-label={copied ? 'Password copied' : 'Copy temporary password'}>
                {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            {/* Live region for screen readers when password is copied */}
            <div className="sr-only" aria-live="polite" aria-atomic="true">
              {copied ? 'Temporary password copied to clipboard' : ''}
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Field label="Name" htmlFor="user-name">
            <input
              id="user-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={Boolean(error && !name.trim())}
              aria-describedby={error ? 'add-user-error' : undefined}
              className={inputClass}
              placeholder="Jamie Rivera"
              disabled={submitting}
            />
          </Field>

          <Field label="Email" htmlFor="user-email">
            <input
              id="user-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(error && !email.trim())}
              aria-describedby={error ? 'add-user-error' : undefined}
              className={inputClass}
              placeholder="jamie@cs-setu.io"
              disabled={submitting}
            />
          </Field>

          <Field label="Role">
            <RolePicker
              value={role}
              onChange={setRole}
              options={roleOptions}
              disabled={submitting}
            />
          </Field>

          <ErrorMessage id="add-user-error">{error}</ErrorMessage>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              <UserPlus size={16} aria-hidden="true" />
              Add user
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
