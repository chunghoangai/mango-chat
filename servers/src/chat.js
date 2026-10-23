import { randomUUID } from 'node:crypto';
import { createMessage, roomStateForSocket } from './store.js';

const MAX_MESSAGE_LENGTH = 2000;
const MAX_ROOM_LENGTH = 80;
const MAX_NAME_LENGTH = 40;
function send(socket, value) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(value));
}

function broadcast(state, value) {
  const payload = JSON.stringify(value);
  for (const client of state.clients) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
}

function cleanRoom(value) {
  if (typeof value !== 'string') return null;
  const room = value.trim();
  return /^[a-zA-Z0-9_-]{1,80}$/.test(room) ? room : null;
}

export function connectChat(socket, requestURL, authenticatedUser = null) {
  const url = new URL(requestURL, 'http://localhost');
  const room = cleanRoom(url.searchParams.get('room') ?? 'general');
  const suppliedName = authenticatedUser?.name ?? url.searchParams.get('name') ?? 'Guest';
  const name = [...suppliedName.trim()].slice(0, MAX_NAME_LENGTH).join('') || 'Guest';
  if (!room) {
    send(socket, { type: 'error', error: 'Invalid room name' });
    socket.close(1008, 'Invalid room name');
    return;
  }

  const state = roomStateForSocket(room);
  state.roomName = state.roomName || room;
  const client = { id: authenticatedUser?.id ?? randomUUID(), name, room, socket };
  state.clients.add(socket);
  socket.client = client;

  send(socket, { type: 'connected', id: client.id, room, users: state.clients.size });
  send(socket, { type: 'history', messages: state.history });
  broadcast(state, { type: 'presence', users: state.clients.size });

  socket.on('message', (data, isBinary) => {
    if (isBinary) return send(socket, { type: 'error', error: 'Binary messages are not supported' });
    let payload;
    try {
      payload = JSON.parse(data.toString());
    } catch {
      return send(socket, { type: 'error', error: 'Message must be valid JSON' });
    }

    if (payload?.type === 'ping') return send(socket, { type: 'pong', at: Date.now() });
    if (payload?.type !== 'message') return send(socket, { type: 'error', error: 'Unsupported message type' });
    if (typeof payload.text !== 'string') return send(socket, { type: 'error', error: 'Message text is required' });

    const text = payload.text.trim();
    if (!text || text.length > MAX_MESSAGE_LENGTH) {
      return send(socket, { type: 'error', error: `Message must contain 1-${MAX_MESSAGE_LENGTH} characters` });
    }

    const message = createMessage(room, { senderId: client.id, text });
    broadcast(state, { ...message, type: 'message', sender: { id: client.id, name: client.name }, sentAt: message.timestamp });
  });

  socket.on('close', () => {
    state.clients.delete(socket);
    broadcast(state, { type: 'presence', users: state.clients.size });
  });
}
