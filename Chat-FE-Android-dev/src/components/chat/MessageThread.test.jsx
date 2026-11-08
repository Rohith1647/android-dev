import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MessageThread } from './MessageThread';

describe('MessageThread avatar and displayName fallbacks', () => {
  const currentUser = { id: 'user-1', name: 'Current User', role: 'EMPLOYEE' };

  it('in direct chats, falls back to chatName when senderName is missing', () => {
    const messages = [
      {
        id: 'msg-1',
        senderId: 'peer-1',
        content: 'Hello there',
        sentAt: '2026-08-29T10:00:00Z',
        status: 'DELIVERED',
      },
    ];

    const html = renderToString(
      <MessageThread
        messages={messages}
        loading={false}
        error={null}
        currentUser={currentUser}
        typingNames={[]}
        isGroup={false}
        chatName="Peer Name"
      />,
    );

    expect(html).toContain('Peer Name');
    expect(html).toContain('>P<');
  });

  it('in group chats, does NOT display group chatName as the sender name when senderName is missing', () => {
    const messages = [
      {
        id: 'msg-1',
        senderId: 'peer-2',
        content: 'Group message from WS without senderName',
        sentAt: '2026-08-29T10:00:00Z',
        status: 'DELIVERED',
      },
    ];

    const html = renderToString(
      <MessageThread
        messages={messages}
        loading={false}
        error={null}
        currentUser={currentUser}
        typingNames={[]}
        isGroup={true}
        chatName="Engineering Team"
      />,
    );

    expect(html).not.toContain('Engineering Team');
    expect(html).toContain('User');
    expect(html).toContain('>U<');
  });

  it('displays message.senderName when present in group chats', () => {
    const messages = [
      {
        id: 'msg-1',
        senderId: 'peer-3',
        senderName: 'Alice Smith',
        content: 'Hey team!',
        sentAt: '2026-08-29T10:00:00Z',
        status: 'DELIVERED',
      },
    ];

    const html = renderToString(
      <MessageThread
        messages={messages}
        loading={false}
        error={null}
        currentUser={currentUser}
        typingNames={[]}
        isGroup={true}
        chatName="Engineering Team"
      />,
    );

    expect(html).toContain('Alice Smith');
    expect(html).toContain('>A<');
  });
});
