import { randomUUID } from 'node:crypto';

const MAX_MESSAGE_LENGTH = 2000;
const MAX_ROOM_LENGTH = 80;
const MAX_NAME_LENGTH = 40;
const HISTORY_LIMIT = 100;
const rooms = new Map();

function roomState(room) {
  let state = rooms.get(room);
  if (!state) {
    state = { clients: new Set(), history: [] };
    rooms.set(room, state);
  }
  return state;
}

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

export function connectChat(socket, requestURL) {
  const url = new URL(requestURL, 'http://localhost');
  const room = cleanRoom(url.searchParams.get('room') ?? 'general');
  const suppliedName = url.searchParams.get('name') ?? 'Guest';
  const name = [...suppliedName.trim()].slice(0, MAX_NAME_LENGTH).join('') || 'Guest';
  if (!room) {
    send(socket, { type: 'error', error: 'Invalid room name' });
    socket.close(1008, 'Invalid room name');
    return;
  }

  const state = roomState(room);
  const client = { id: randomUUID(), name, room, socket };
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

    const message = {
      id: randomUUID(),
      type: 'message',
      room,
      sender: { id: client.id, name: client.name },
      text,
      sentAt: new Date().toISOString()
    };
    state.history.push(message);
    if (state.history.length > HISTORY_LIMIT) state.history.shift();
    broadcast(state, message);
  });

  socket.on('close', () => {
    state.clients.delete(socket);
    if (state.clients.size === 0 && state.history.length === 0) rooms.delete(room);
    broadcast(state, { type: 'presence', users: state.clients.size });
  });
}
