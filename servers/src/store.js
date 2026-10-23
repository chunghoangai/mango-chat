import { randomUUID } from 'node:crypto';

export const MAX_MESSAGE_LENGTH = 2000;
export const HISTORY_LIMIT = 100;

const rooms = new Map();

function roomState(roomId, { roomName = roomId, roomType = 'group', participantIds = [] } = {}) {
  let state = rooms.get(roomId);
  if (!state) {
    state = {
      roomId,
      roomName,
      roomType,
      participantIds,
      clients: new Set(),
      history: [],
      updatedAt: new Date().toISOString()
    };
    rooms.set(roomId, state);
  }
  return state;
}

export function getRoom(roomId) {
  return rooms.get(roomId) ?? null;
}

export function listRooms() {
  return [...rooms.values()].map(publicRoom);
}

export function publicRoom(state, unreadCount = 0) {
  const last = state.history.at(-1);
  return {
    roomId: state.roomId,
    roomName: state.roomName,
    roomType: state.roomType,
    participantIds: state.participantIds,
    lastMessage: last ? {
      text: last.text,
      senderId: last.senderId,
      timestamp: last.timestamp
    } : null,
    unreadCount,
    updatedAt: state.updatedAt
  };
}

export function createRoom({ roomName, roomType = 'group', participantIds = [] }) {
  const roomId = randomUUID();
  const state = roomState(roomId, { roomName, roomType, participantIds });
  return publicRoom(state);
}

export function updateRoom(roomId, updates) {
  const state = getRoom(roomId);
  if (!state) return null;
  if (updates.roomName !== undefined) state.roomName = updates.roomName;
  if (updates.roomType !== undefined) state.roomType = updates.roomType;
  if (updates.participantIds !== undefined) state.participantIds = updates.participantIds;
  state.updatedAt = new Date().toISOString();
  return publicRoom(state);
}

export function deleteRoom(roomId) {
  const state = getRoom(roomId);
  if (!state) return false;
  for (const socket of state.clients) {
    if (socket.readyState === socket.OPEN) socket.close(1008, 'Room deleted');
  }
  return rooms.delete(roomId);
}

export function listMessages(roomId, { cursor, limit = HISTORY_LIMIT } = {}) {
  const state = getRoom(roomId);
  if (!state) return null;
  let messages = state.history;
  if (cursor) {
    const index = messages.findIndex(message => message.messageId === cursor);
    if (index < 0) return { messages: [], nextCursor: null };
    messages = messages.slice(0, index);
  }
  const page = messages.slice(-limit);
  return { messages: page, nextCursor: page.length === limit ? page[0].messageId : null };
}

export function createMessage(roomId, { senderId, text, mediaURL = null }) {
  const state = getRoom(roomId);
  if (!state) return null;
  const timestamp = new Date().toISOString();
  const message = {
    messageId: randomUUID(), roomId, senderId, text: text.trim(),
    mediaURL, status: 'sent', timestamp
  };
  state.history.push(message);
  if (state.history.length > HISTORY_LIMIT) state.history.shift();
  state.updatedAt = timestamp;
  const payload = JSON.stringify({ type: 'message:new', payload: message });
  for (const socket of state.clients) {
    if (socket.readyState === socket.OPEN) socket.send(payload);
  }
  return message;
}

export function roomStateForSocket(roomId) {
  return roomState(roomId);
}
