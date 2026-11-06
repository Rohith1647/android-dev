import { useEffect, useRef, useState } from 'react';
import { SendHorizontal } from 'lucide-react';
import { Button, ErrorMessage } from '../ui';
import { TYPING_THROTTLE_MS } from '../../config';

/**
 * Message input. Every role can send here — the student restriction applies to
 * creating chats, never to replying in a chat they already belong to.
 */
export function MessageComposer({ onSend, onTyping, sending, error, disabled, draftKey }) {
  const [value, setValue] = useState('');
  const lastTypingRef = useRef(0);
  const textareaRef = useRef(null);

  // Reset the draft when the open chat changes.
  useEffect(() => {
    setValue('');
    lastTypingRef.current = 0;
  }, [draftKey]);

  const resize = () => {
    const node = textareaRef.current;
    if (!node) return;
    // An empty box falls back to the CSS height so a stale measurement can
    // never leave the composer stretched open.
    if (!value) {
      node.style.height = '';
      return;
    }
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, 140)}px`;
  };

  useEffect(resize, [value]);

  function handleChange(event) {
    setValue(event.target.value);
    if (!event.target.value.trim()) return;
    // Throttled so we publish at most one typing event every few seconds.
    const now = Date.now();
    if (now - lastTypingRef.current >= TYPING_THROTTLE_MS) {
      lastTypingRef.current = now;
      onTyping?.();
    }
  }

  async function submit(event) {
    event?.preventDefault();
    const content = value.trim();
    if (!content || sending || disabled) return;
    // Clear optimistically; ChatPage hands the text back if the send fails.
    setValue('');
    lastTypingRef.current = 0;
    const ok = await onSend(content);
    if (!ok) setValue(content);
    textareaRef.current?.focus();
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form onSubmit={submit} className="border-t border-parchment bg-white px-3 py-3">
      {error && <ErrorMessage className="mb-2">{error}</ErrorMessage>}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-label="Message"
          placeholder={disabled ? 'Select a chat to start typing' : 'Write a message…'}
          className="rt-scroll max-h-36 flex-1 resize-none rounded-lg border border-parchment bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:border-accent focus:outline-none disabled:cursor-not-allowed"
        />
        <Button
          type="submit"
          loading={sending}
          disabled={disabled || !value.trim()}
          className="h-11 px-4"
          aria-label="Send message"
        >
          {!sending && <SendHorizontal size={16} aria-hidden="true" />}
          <span className="hidden sm:inline">Send</span>
        </Button>
      </div>
    </form>
  );
}
