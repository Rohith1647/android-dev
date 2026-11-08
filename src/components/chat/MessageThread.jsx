import { useEffect, useLayoutEffect, useRef } from 'react';
import { Check, CheckCheck, MessageCircle } from 'lucide-react';
import { Avatar, EmptyState, ErrorMessage, Skeleton, cx } from '../ui';
import { formatDayLabel, formatMessageTime, sameDay } from '../../lib/time';
import { roleColor } from '../../lib/roles';

function StatusTicks({ status }) {
  if (status === 'SENDING') {
    return <span className="text-[10px] opacity-70">Sending…</span>;
  }
  if (status === 'READ') {
    return <CheckCheck size={13} className="opacity-90" aria-label="Read" />;
  }
  if (status === 'DELIVERED') {
    return <CheckCheck size={13} className="opacity-55" aria-label="Delivered" />;
  }
  return <Check size={13} className="opacity-55" aria-label="Sent" />;
}

function Bubble({ message, own, ownColor, showSender, chatName, isGroup }) {
  const displayName = message.senderName || (!isGroup ? chatName : undefined) || 'User';
  return (
    <div
      data-message-id={message.id}
      data-own={own ? 'true' : 'false'}
      className={cx('flex gap-2', own ? 'justify-end' : 'justify-start')}
    >
      {!own && (
        <div className="w-8 shrink-0 self-end">
          {showSender && <Avatar name={displayName} role={message.senderRole} size={28} />}
        </div>
      )}

      <div className={cx('max-w-[78%] sm:max-w-[70%]', own && 'items-end')}>
        {!own && showSender && displayName && (
          <p className="mb-0.5 ml-1 text-[11px] font-medium text-ink-soft">{displayName}</p>
        )}
        <div
          className={cx(
            'animate-rt-in rounded-xl px-3.5 py-2.5 text-sm break-words whitespace-pre-wrap',
            own
              ? 'rounded-br-sm text-white'
              : 'rounded-bl-sm border border-parchment bg-white text-ink',
            message.failed && 'ring-1 ring-red-300',
          )}
          style={own ? { backgroundColor: ownColor } : undefined}
        >
          {message.content}
          <span
            className={cx(
              'mt-1 flex items-center justify-end gap-1 text-[10px]',
              own ? 'text-white/75' : 'text-ink-soft',
            )}
          >
            {formatMessageTime(message.sentAt)}
            {own && <StatusTicks status={message.status} />}
          </span>
        </div>
      </div>
    </div>
  );
}

function DaySeparator({ iso }) {
  return (
    <div className="my-3 flex items-center gap-3">
      <span className="h-px flex-1 bg-parchment" />
      <span className="text-[11px] font-medium text-ink-soft">{formatDayLabel(iso)}</span>
      <span className="h-px flex-1 bg-parchment" />
    </div>
  );
}

export function TypingIndicator({ names, isGroup = false }) {
  if (names.length === 0) return null;
  const label = !isGroup
    ? 'typing…'
    : names.length === 1
      ? `${names[0]} is typing…`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing…`
        : `${names.length} people are typing…`;

  return (
    <div className="flex items-center gap-2 px-1 py-1 text-xs text-ink-soft" aria-live="polite">
      <span className="flex gap-0.5" aria-hidden="true">
        <span className="rt-dot size-1.5 rounded-full bg-ink-soft" />
        <span className="rt-dot size-1.5 rounded-full bg-ink-soft [animation-delay:0.15s]" />
        <span className="rt-dot size-1.5 rounded-full bg-ink-soft [animation-delay:0.3s]" />
      </span>
      {label}
    </div>
  );
}

export function MessageThread({
  messages,
  loading,
  error,
  currentUser,
  typingNames,
  isGroup = false,
  chatName = '',
  onRetry,
  onMessagesSeen,
  hasMore = false,
  loadingMore = false,
  loadMoreError = null,
  onLoadMore,
}) {
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const seenRef = useRef(new Set());
  const newestIdRef = useRef(null);
  const ownColor = roleColor(currentUser?.role);

  // Stick to the newest message — but not when older ones are prepended, which
  // leaves the newest message unchanged and should hold the reader's place.
  const newestId = messages[messages.length - 1]?.id ?? null;
  useLayoutEffect(() => {
    if (newestId === newestIdRef.current) return;
    newestIdRef.current = newestId;
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [newestId, typingNames.length]);

  // Read receipts: report other people's messages once they are actually on screen.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !onMessagesSeen || messages.length === 0) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const ids = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => entry.target.getAttribute('data-message-id'))
          .filter((id) => id && !seenRef.current.has(id));
        if (ids.length === 0) return;
        ids.forEach((id) => seenRef.current.add(id));
        onMessagesSeen(ids);
      },
      { root, threshold: 0.6 },
    );

    root
      .querySelectorAll('[data-message-id][data-own="false"]')
      .forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, [messages, onMessagesSeen]);

  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4" aria-busy="true" aria-label="Loading messages">
        {[60, 40, 70, 35, 55].map((width, index) => (
          <div key={index} className={cx('flex', index % 2 ? 'justify-end' : 'justify-start')}>
            <Skeleton className="h-12 rounded-xl" style={{ width: `${width}%` }} />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 space-y-3 p-6">
        <ErrorMessage>{error}</ErrorMessage>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-sm font-medium text-accent-dark underline"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  const validMessages = (messages ?? []).filter(Boolean);

  return (
    <div ref={scrollRef} className="rt-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
      {validMessages.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No messages yet"
          description="Say hello — your message will appear here instantly."
        />
      ) : (
        <div className="space-y-1.5">
          {loadMoreError && <ErrorMessage className="mb-2">{loadMoreError}</ErrorMessage>}
          {hasMore && (
            <div className="flex justify-center pb-2">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                className="rounded-full border border-parchment bg-white px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-canvas disabled:opacity-60"
              >
                {loadingMore ? 'Loading…' : 'Load earlier messages'}
              </button>
            </div>
          )}
          {validMessages.map((message, index) => {
            const previous = validMessages[index - 1];
            const own = message.senderId === currentUser?.id;
            const newDay = !previous || !sameDay(previous.sentAt, message.sentAt);
            const showSender = !previous || previous.senderId !== message.senderId || newDay;
            return (
              <div key={message.id ?? `msg-${index}`}>
                {newDay && <DaySeparator iso={message.sentAt} />}
                <div className={showSender ? 'mt-2.5' : undefined}>
                  <Bubble
                    message={message}
                    own={own}
                    ownColor={ownColor}
                    showSender={showSender}
                    chatName={chatName}
                    isGroup={isGroup}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <TypingIndicator names={typingNames} isGroup={isGroup} />
      <div ref={bottomRef} />
    </div>
  );
}
