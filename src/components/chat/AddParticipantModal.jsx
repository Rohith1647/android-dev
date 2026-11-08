import { useEffect, useState } from 'react';
import { Check, UserPlus } from 'lucide-react';
import {
  Avatar,
  Button,
  ErrorMessage,
  Modal,
  RoleBadge,
  Skeleton,
  cx,
  inputClass,
} from '../ui';
import { getDirectory } from '../../api/endpoints';
import { isAbortError } from '../../api/client';

/** Add participants to an existing group chat. */
export function AddParticipantModal({
  open,
  onClose,
  chatId,
  existingParticipantIds = [],
  onAdd,
}) {
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState('');

  const [people, setPeople] = useState([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [directoryError, setDirectoryError] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    setSelected([]);
    setQuery('');
    setError(null);

    const controller = new AbortController();
    setLoadingPeople(true);
    setDirectoryError(null);

    getDirectory({ signal: controller.signal })
      .then((data) => {
        setPeople(data.users ?? []);
        setLoadingPeople(false);
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setDirectoryError(err.message);
        setLoadingPeople(false);
      });

    return () => controller.abort();
  }, [open]);

  const existingSet = new Set(existingParticipantIds);
  const availablePeople = people.filter((person) => !existingSet.has(person.id));

  const filtered = query.trim()
    ? availablePeople.filter((person) =>
        `${person.name} ${person.email}`.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : availablePeople;

  const toggle = (id) => {
    setError(null);
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (selected.length === 0) {
      setError('Select at least one participant to add');
      return;
    }

    setSubmitting(true);
    try {
      await onAdd(chatId, selected);
      onClose();
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
      title="Add participants"
      description="Select teammates to add to this group conversation."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink">Select participants</span>
            {selected.length > 0 && (
              <span className="text-xs text-ink-soft">{selected.length} selected</span>
            )}
          </div>

          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people by name or email"
            aria-label="Search people to add"
            className={inputClass}
            disabled={submitting}
          />

          <div className="rt-scroll max-h-60 overflow-y-auto rounded-lg border border-parchment">
            {loadingPeople && (
              <div className="space-y-3 p-3" aria-busy="true">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Skeleton className="size-8 rounded-full" />
                    <Skeleton className="h-3.5 w-40" />
                  </div>
                ))}
              </div>
            )}

            {!loadingPeople && directoryError && (
              <div className="p-3">
                <ErrorMessage>{directoryError}</ErrorMessage>
              </div>
            )}

            {!loadingPeople && !directoryError && availablePeople.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-ink-soft">
                All available teammates are already in this chat.
              </p>
            )}

            {!loadingPeople && !directoryError && availablePeople.length > 0 && filtered.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-ink-soft">No matching people found.</p>
            )}

            {!loadingPeople &&
              !directoryError &&
              filtered.map((person) => {
                const isSelected = selected.includes(person.id);
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => toggle(person.id)}
                    aria-pressed={isSelected}
                    disabled={submitting}
                    className={cx(
                      'flex w-full items-center gap-3 border-b border-parchment px-3 py-2.5 text-left last:border-b-0 transition-colors',
                      isSelected ? 'bg-accent/10' : 'hover:bg-canvas',
                    )}
                  >
                    <Avatar name={person.name} role={person.role} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {person.name}
                      </span>
                      <span className="block truncate text-xs text-ink-soft">{person.email}</span>
                    </span>
                    <RoleBadge role={person.role} />
                    {isSelected && (
                      <Check size={16} className="shrink-0 text-accent-dark" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
          </div>
        </div>

        <ErrorMessage>{error}</ErrorMessage>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting} disabled={selected.length === 0}>
            <UserPlus size={16} aria-hidden="true" />
            Add participant{selected.length > 1 ? 's' : ''}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
