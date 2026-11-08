import { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { Button, ErrorMessage, Field, Modal, inputClass } from '../ui';
import { changePassword } from '../../api/endpoints';

export function ChangePasswordModal({ open, forced = false, onClose, onSuccess }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(false);
    setSubmitting(false);
  }, [open]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }

    if (!newPassword || newPassword.length < 12) {
      setError('New password must be at least 12 characters long.');
      return;
    }

    if (newPassword === currentPassword) {
      setError('New password must differ from the current one.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        if (!forced) {
          onClose?.();
        }
      }, 1200);
    } catch (err) {
      setError(err?.message || 'Failed to update password.');
    } finally {
      setSubmitting(false);
    }
  }

  const handleClose = () => {
    if (forced || submitting) return;
    onClose?.();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={forced ? 'Set up your password' : 'Change password'}
      description={
        forced
          ? 'Your account was created with a temporary password. You must set a new password before continuing.'
          : 'Update your account password. All previous sessions will be refreshed.'
      }
    >
      {success ? (
        <div className="py-6 text-center space-y-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <ShieldCheck size={24} />
          </div>
          <p className="font-display font-medium text-ink">Password updated successfully</p>
          <p className="text-sm text-ink-soft">
            {forced ? 'Redirecting to application...' : 'Your new password is now active.'}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            label="Current password"
            htmlFor="current-password"
            hint={forced ? 'Enter the temporary password provided to you.' : undefined}
          >
            <input
              id="current-password"
              name="current-password"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={submitting}
              className={inputClass}
            />
          </Field>

          <Field
            label="New password"
            htmlFor="new-password"
            hint="Must be at least 12 characters and different from current password."
          >
            <input
              id="new-password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={submitting}
              className={inputClass}
            />
          </Field>

          <Field label="Confirm new password" htmlFor="confirm-password">
            <input
              id="confirm-password"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={submitting}
              className={inputClass}
            />
          </Field>

          <ErrorMessage id="change-password-error">{error}</ErrorMessage>

          <div className="flex justify-end gap-2 pt-2">
            {!forced && (
              <Button variant="secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
            )}
            <Button type="submit" loading={submitting}>
              <KeyRound size={16} className="mr-1.5" aria-hidden="true" />
              {forced ? 'Set password and continue' : 'Update password'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
