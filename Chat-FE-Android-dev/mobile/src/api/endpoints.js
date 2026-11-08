import { request, setSession } from './client';
import { MESSAGE_PAGE_SIZE } from '../config';

/**
 * Mobile endpoints matching Spring Boot REST API.
 */

// --- chats ---------------------------------------------------------------

/** -> { chats: [{ id, type, name, lastMessage, lastMessageAt, unreadCount }] } */
export const getChats = ({ signal } = {}) => request('/api/chats', { signal });

/** -> { chat }. 403 -> { error: 'Students cannot create new chats' } */
export const createChat = ({ type, name, participantIds }) =>
  request('/api/chats', {
    method: 'POST',
    body: { type, ...(name ? { name } : {}), participantIds },
  });

/** -> [{ userId, name, joinedAt }] */
export const getParticipants = (chatId, { signal } = {}) =>
  request(`/api/chats/${encodeURIComponent(chatId)}/participants`, { signal });

/** -> { chat } | { success: true }. 403 -> { error: 'Students cannot add participants' } */
export const addParticipants = (chatId, participantIds) =>
  request(`/api/chats/${encodeURIComponent(chatId)}/participants`, {
    method: 'POST',
    body: { participantIds },
  });

/** -> { messages: [{ id, senderId, senderName?, content, sentAt, status }], hasMore } */
export const getMessages = (chatId, { before, limit = MESSAGE_PAGE_SIZE, signal } = {}) => {
  const query = new URLSearchParams({ limit: String(limit) });
  if (before) query.set('before', before);
  return request(`/api/chats/${encodeURIComponent(chatId)}/messages?${query.toString()}`, { signal });
};

/** -> { message }. Persistence half of sending; the STOMP publish is the live half. */
export const sendMessage = (chatId, content) =>
  request(`/api/chats/${encodeURIComponent(chatId)}/messages`, {
    method: 'POST',
    body: { content },
  });

/** Directory of people the signed-in user may start a chat with or add to a group. */
export const getDirectory = ({ signal } = {}) => request('/api/users', { signal });

// --- auth ----------------------------------------------------------------

/** 200 -> { token, refreshToken? }. Changes password and updates the session token with the fresh one returned. */
export async function changePassword({ currentPassword, newPassword }, { signal } = {}) {
  const data = await request('/api/auth/password', {
    method: 'POST',
    auth: true,
    body: { currentPassword, newPassword },
    signal,
  });
  if (data?.token) {
    await setSession({ token: data.token, refreshToken: data.refreshToken });
  }
  return data;
}

// --- user management -----------------------------------------------------

/**
 * Admin and HR expose user management endpoints under /api/admin or /api/hr.
 */
export function userAdminApi(role) {
  const prefix = role === 'ADMIN' ? '/api/admin' : '/api/hr';
  return {
    /** -> { users: [{ id, name, email, role }] } */
    list: ({ search, page, limit, signal } = {}) => {
      const query = new URLSearchParams();
      if (search && search.trim()) query.set('search', search.trim());
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));
      const queryString = query.toString() ? `?${query.toString()}` : '';
      return request(`${prefix}/users${queryString}`, { signal });
    },
    /** 201 -> { user, temp_password } | 400 -> { error } */
    create: ({ name, email, role: newRole }) =>
      request(`${prefix}/users`, { method: 'POST', body: { name, email, role: newRole } }),
    /** -> { user } */
    changeRole: (id, newRole) =>
      request(`${prefix}/users/${encodeURIComponent(id)}/role`, {
        method: 'PATCH',
        body: { role: newRole },
      }),
    /** -> 204 */
    remove: (id) => request(`${prefix}/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  };
}
