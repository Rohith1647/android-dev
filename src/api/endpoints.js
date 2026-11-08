import { request, setSession } from './client';
import { MESSAGE_PAGE_SIZE } from '../config';
import { ROLES } from '../lib/roles';

/**
 * Every backend call the app makes. Read operations accept an AbortSignal so
 * views can cancel in-flight requests when they unmount or switch context.
 */

// --- auth ----------------------------------------------------------------

/** 200 -> { token, refreshToken?, user }. 401 -> { error: 'Invalid email or password' } */
export async function login({ email, password }, { signal } = {}) {
  const data = await request('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: { email, password },
    signal,
  });
  setSession({ token: data.token, refreshToken: data.refreshToken });
  return data;
}

/** 200 -> { token }. Changes password and updates the session token with the fresh one returned. */
export async function changePassword({ currentPassword, newPassword }, { signal } = {}) {
  const data = await request('/api/auth/password', {
    method: 'POST',
    auth: true,
    body: { currentPassword, newPassword },
    signal,
  });
  if (data?.token) {
    setSession({ token: data.token });
  }
  return data;
}

// --- chats ---------------------------------------------------------------

/** -> { chats: [{ id, type, name, lastMessage, lastMessageAt, unreadCount }] } */
export const getChats = ({ signal } = {}) => request('/api/chats', { signal });

/** -> { chat }. 403 -> { error: 'Students cannot create new chats' } */
export const createChat = ({ type, name, participantIds }) =>
  request('/api/chats', {
    method: 'POST',
    body: { type, ...(name ? { name } : {}), participantIds },
  });

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
  return request(`/api/chats/${encodeURIComponent(chatId)}/messages?${query}`, { signal });
};

/** -> { message }. Persistence half of sending; the WS publish is the live half. */
export const sendMessage = (chatId, content) =>
  request(`/api/chats/${encodeURIComponent(chatId)}/messages`, {
    method: 'POST',
    body: { content },
  });

/** Directory of people the signed-in user may start a chat with. */
export const getDirectory = ({ signal } = {}) => request('/api/users', { signal });

// --- user management -----------------------------------------------------

/**
 * Admin and HR expose the same operations under different prefixes. The panel
 * selects one from the signed-in role; the backend enforces the boundary.
 */
export function userAdminApi(role) {
  const prefix = role === ROLES.ADMIN ? '/api/admin' : '/api/hr';
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
