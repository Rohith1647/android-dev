import { Lock, MessageSquarePlus, MessagesSquare, Search } from 'lucide-react';
import { useState } from 'react';
import { Button, EmptyState, ErrorMessage, Skeleton, cx } from '../ui';
import { formatListTime } from '../../lib/time';
import { canCreateChat } from '../../lib/roles';

function ChatRow({ chat, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(chat.id)}
      aria-current={active ? 'true' : undefined}
      className={cx(
        'w-full rounded-lg px-3 py-2.5 text-left transition-colors',
        active ? 'bg-parchment/70' : 'hover:bg-parchment/40',
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-semibold text-ink">{chat.name}</span>
        <span className="shrink-0 text-[11px] text-ink-soft">
          {formatListTime(chat.lastMessageAt)}
        </span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className="truncate text-xs text-ink-soft">
          {chat.lastMessage ?? 'No messages yet'}
        </span>
        {chat.unreadCount > 0 && (
          <span
            className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-navy"
            aria-label={`${chat.unreadCount} unread messages`}
          >
            {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
          </span>
        )}
      </div>
    </button>
  );
}

export function ChatList({
  chats,
  loading,
  error,
  role,
  selectedChatId,
  onSelect,
  onNewChat,
  onRetry,
}) {
  const [query, setQuery] = useState('');
  const allowed = canCreateChat(role);

  const filtered = query.trim()
    ? chats.filter((chat) => chat.name?.toLowerCase().includes(query.trim().toLowerCase()))
    : chats;

  return (
    <div className="flex h-full min-h-0 flex-col border-parchment bg-white md:border-r">
      <div className="space-y-3 border-b border-parchment px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-lg font-semibold text-ink">Chats</h1>
          {allowed ? (
            <Button size="sm" onClick={onNewChat}>
              <MessageSquarePlus size={16} aria-hidden="true" />
              New chat
            </Button>
          ) : (
            // Students cannot start chats. The button is hidden for clarity only —
            // POST /api/chats is what actually enforces this.
            <span
              className="inline-flex items-center gap-1.5 rounded-md border border-parchment bg-canvas px-2.5 py-1.5 text-xs font-medium text-ink-soft"
              title="Only admins, HR and employees can start new chats"
            >
              <Lock size={13} aria-hidden="true" />
              Restricted
            </span>
          )}
        </div>

        <div className="relative">
          <Search
            size={15}
            className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-soft/70"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
            className="w-full rounded-lg border border-parchment bg-canvas py-2 pr-3 pl-9 text-sm text-ink placeholder:text-ink-soft/60 focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      <div className="rt-scroll min-h-0 flex-1 overflow-y-auto p-2">
        {loading && (
          <div className="space-y-2 p-1" aria-busy="true" aria-label="Loading chats">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="space-y-2 rounded-lg px-2 py-2.5">
                <div className="flex justify-between gap-2">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <Skeleton className="h-3 w-44" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="space-y-3 p-3">
            <ErrorMessage>{error}</ErrorMessage>
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Try again
            </Button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            icon={MessagesSquare}
            title={query ? 'No matching chats' : 'No chats yet'}
            description={
              query
                ? 'Try a different search term.'
                : allowed
                  ? 'Start a conversation with the New chat button.'
                  : 'You will see conversations here once someone adds you to one.'
            }
          />
        )}

        {!loading &&
          !error &&
          filtered.map((chat) => (
            <ChatRow
              key={chat.id}
              chat={chat}
              active={chat.id === selectedChatId}
              onSelect={onSelect}
            />
          ))}
      </div>
    </div>
  );
}
