import { useEffect, useState } from 'react';
import { Button, ErrorMessage, Field, Modal, RolePicker } from '../ui';

/** Role picker for an existing user; `roleOptions` is the caller's allow-list. */
export function ChangeRoleModal({ open, user, roleOptions, onClose, onSubmit }) {
  const [role, setRole] = useState(user?.role ?? roleOptions[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setRole(roleOptions.includes(user?.role) ? user.role : roleOptions[0]);
    setError(null);
    setSubmitting(false);
  }, [open, user, roleOptions]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (role === user?.role) return onClose();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(role);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title="Change role"
      description={user ? `Update what ${user.name} can do in CS Setu.` : undefined}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Role">
          <RolePicker value={role} onChange={setRole} options={roleOptions} disabled={submitting} />
        </Field>

        <ErrorMessage id="change-role-error">{error}</ErrorMessage>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Save role
          </Button>
        </div>
      </form>
    </Modal>
  );
}
