import { useEffect, useState } from 'react';
import { Check, Users } from 'lucide-react';
import {
  Avatar,
  Button,
  ErrorMessage,
  Field,
  Modal,
  RoleBadge,
  Skeleton,
  cx,
  inputClass,
} from '../ui';
import { getDirectory } from '../../api/endpoints';
import { isAbortError } from '../../api/client';

/** Create a DIRECT or GROUP chat: POST /api/chats. */
export function NewChatModal({ open, onClose, onCreated, onCreate }) {
  const [type, setType] = useState('DIRECT');
  const [name, setName] = useState('');
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState('');

  const [people, setPeople] = useState([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [directoryError, setDirectoryError] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    setType('DIRECT');
    setName('');
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

  const toggle = (id) => {
    setError(null);
    setSelected((current) => {
      if (type === 'DIRECT') return current.includes(id) ? [] : [id];
      return current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    });
  };

  const switchType = (nextType) => {
    setType(nextType);
    setError(null);
    if (nextType === 'DIRECT') setSelected((current) => current.slice(0, 1));
  };

  const filtered = query.trim()
    ? people.filter((person) =>
        `${person.name} ${person.email}`.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : people;

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (selected.length === 0) {
      setError('Pick at least one participant');
      return;
    }
    if (type === 'GROUP' && !name.trim()) {
      setError('Group chats need a name');
      return;
    }

    setSubmitting(true);
    try {
      const data = await onCreate({
        type,
        name: type === 'GROUP' ? name.trim() : undefined,
        participantIds: selected,
      });
      const chat = data?.chat ?? data?.data ?? (data?.id ? data : null);
      if (chat) {
        onCreated(chat);
      } else {
        throw new Error('Chat creation succeeded but no chat details were returned.');
      }
    } catch (err) {
      // 403 { error: "Students cannot create new chats" } surfaces here too.
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title="New chat"
      description="Start a direct message or a group conversation."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div role="radiogroup" aria-label="Chat type" className="grid grid-cols-2 gap-2">
          {[
            ['DIRECT', 'Direct'],
            ['GROUP', 'Group'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={type === value}
              onClick={() => switchType(value)}
              className={cx(
                'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                type === value
                  ? 'border-accent bg-accent/12 text-accent-dark'
                  : 'border-parchment text-ink-soft hover:bg-canvas',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {type === 'GROUP' && (
          <Field label="Group name" htmlFor="chat-name">
            <input
              id="chat-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
              placeholder="e.g. Design guild"
              disabled={submitting}
            />
          </Field>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink">
              {type === 'DIRECT' ? 'Who do you want to message?' : 'Participants'}
            </span>
            {selected.length > 0 && (
              <span className="text-xs text-ink-soft">{selected.length} selected</span>
            )}
          </div>

          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people"
            aria-label="Search people"
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

            {!loadingPeople && !directoryError && filtered.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-ink-soft">No people found.</p>
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
          <Button type="submit" loading={submitting}>
            <Users size={16} aria-hidden="true" />
            Create chat
          </Button>
        </div>
      </form>
    </Modal>
  );
}
