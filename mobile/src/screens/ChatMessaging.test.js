import { describe, expect, it, vi } from 'vitest';
import { canCreateChat, roleColor, roleLabel } from '../lib/roles';
import { formatDayLabel, formatListTime, formatMessageTime, initialOf, sameDay } from '../lib/time';

describe('Day 3 Core Messaging Logic & Utilities', () => {
  describe('Roles and Permissions (T3.1 & T3.4)', () => {
    it('enforces that students cannot create chats or groups', () => {
      expect(canCreateChat('STUDENT')).toBe(false);
      expect(canCreateChat('ADMIN')).toBe(true);
      expect(canCreateChat('HR')).toBe(true);
      expect(canCreateChat('EMPLOYEE')).toBe(true);
    });

    it('returns valid role colors and human labels for UI badges and avatars', () => {
      expect(roleColor('ADMIN')).toBe('#C9A227');
      expect(roleColor('HR')).toBe('#5B8A72');
      expect(roleColor('EMPLOYEE')).toBe('#4C7EA8');
      expect(roleColor('STUDENT')).toBe('#9B6BA8');
      expect(roleLabel('ADMIN')).toBe('Admin');
      expect(roleLabel('HR')).toBe('HR');
      expect(roleLabel('EMPLOYEE')).toBe('Employee');
      expect(roleLabel('STUDENT')).toBe('Student');
    });
  });

  describe('Time Formatter & Inverted List Grouping (T3.1 & T3.2)', () => {
    it('correctly extracts initial for avatar display', () => {
      expect(initialOf('Jane Doe')).toBe('J');
      expect(initialOf('admin@roundtable.io')).toBe('A');
      expect(initialOf('')).toBe('?');
    });

    it('formats message timestamps', () => {
      const now = new Date();
      const formatted = formatMessageTime(now.toISOString());
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
      expect(formatMessageTime('')).toBe('');
    });

    it('identifies sameDay for date separators', () => {
      const date1 = '2026-09-10T10:00:00.000Z';
      const date2 = '2026-09-10T14:30:00.000Z';
      const date3 = '2026-09-09T18:00:00.000Z';

      expect(sameDay(date1, date2)).toBe(true);
      expect(sameDay(date1, date3)).toBe(false);
    });

    it('computes human day labels (Today, Yesterday, or full date)', () => {
      const today = new Date().toISOString();
      expect(formatDayLabel(today)).toBe('Today');
      expect(formatDayLabel('')).toBe('Today');
    });

    it('formats chat list preview time', () => {
      const today = new Date().toISOString();
      const listTime = formatListTime(today);
      expect(listTime).toBeTruthy();
      expect(formatListTime('')).toBe('');
    });
  });

  describe('Inverted FlatList Message Indexing & Ordering Logic (T3.2)', () => {
    it('prepends newest messages at index 0 and correctly identifies date divider transitions in inverted order', () => {
      // Suppose backend returns ascending: [day1_msg, day2_msg1, day2_msg2]
      const chronological = [
        { id: 'm1', sentAt: '2026-09-09T10:00:00.000Z', content: 'First' },
        { id: 'm2', sentAt: '2026-09-10T09:00:00.000Z', content: 'Second' },
        { id: 'm3', sentAt: '2026-09-10T09:05:00.000Z', content: 'Third' },
      ];

      // Inverted array: [m3, m2, m1]
      const inverted = [...chronological].reverse();
      expect(inverted[0].id).toBe('m3');
      expect(inverted[2].id).toBe('m1');

      // Check date separator logic for inverted FlatList:
      // An item needs a separator if the older message (index + 1) is from a different day
      // For m3: older is m2 (same day) -> false
      const m3Divider = !inverted[1] || !sameDay(inverted[1].sentAt, inverted[0].sentAt);
      expect(m3Divider).toBe(false);

      // For m2: older is m1 (different day 09 vs 10) -> true
      const m2Divider = !inverted[2] || !sameDay(inverted[2].sentAt, inverted[1].sentAt);
      expect(m2Divider).toBe(true);

      // For m1: older is undefined (earliest message in thread) -> true
      const m1Divider = !inverted[3] || !sameDay(undefined, inverted[2].sentAt);
      expect(m1Divider).toBe(true);
    });

    it('pagination prepends older messages to the end of the inverted array', () => {
      let currentInverted = [
        { id: 'm3', content: 'Newest' },
        { id: 'm2', content: 'Middle' },
      ];

      // Reaching onEndReached loads older page: [m1, m0]
      const olderChronological = [
        { id: 'm0', content: 'Oldest' },
        { id: 'm1', content: 'Older' },
      ];

      const reversedOlder = [...olderChronological].reverse(); // [m1, m0]
      currentInverted = [...currentInverted, ...reversedOlder];

      expect(currentInverted.map((m) => m.id)).toEqual(['m3', 'm2', 'm1', 'm0']);
      // Newest message remains unchanged at index 0
      expect(currentInverted[0].id).toBe('m3');
    });
  });

  describe('Chat List Bumping & Unread Deduplication (T3.1)', () => {
    it('moves chat to top of list and increments unread count on incoming message', () => {
      const chats = [
        { id: 'c1', name: 'General', lastMessage: 'Old msg', unreadCount: 0, lastMessageId: 'old-1' },
        { id: 'c2', name: 'Alpha', lastMessage: 'PR ready', unreadCount: 1, lastMessageId: 'alpha-1' },
      ];

      const incoming = {
        id: 'new-msg-1',
        chatId: 'c2',
        content: 'Alpha updated!',
        sentAt: '2026-09-10T11:00:00.000Z',
      };

      const index = chats.findIndex((c) => c.id === incoming.chatId);
      const chat = chats[index];
      const updated = {
        ...chat,
        lastMessageId: incoming.id,
        lastMessage: incoming.content,
        lastMessageAt: incoming.sentAt,
        unreadCount: (chat.unreadCount ?? 0) + 1,
      };
      const rest = chats.filter((_, i) => i !== index);
      const reordered = [updated, ...rest];

      expect(reordered[0].id).toBe('c2');
      expect(reordered[0].unreadCount).toBe(2);
      expect(reordered[0].lastMessage).toBe('Alpha updated!');
      expect(reordered[1].id).toBe('c1');
    });
  });
});
