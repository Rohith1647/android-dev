import { Button, ErrorMessage, Modal } from './ui';

/** Confirmation gate for destructive actions (currently: removing a user). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  loading = false,
  error = null,
}) {
  return (
    <Modal open={open} onClose={loading ? () => {} : onCancel} title={title}>
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">{description}</p>
        <ErrorMessage id="confirm-dialog-error">{error}</ErrorMessage>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
