import { deleteRoom, getRoom, publicRoom, updateRoom } from '../../../../src/store.js';

function parseBody(body) {
  if (typeof body !== 'string') return body;
  try { return JSON.parse(body); } catch { return null; }
}

function validateUpdates(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Body must be a JSON object';
  const fields = ['roomName', 'roomType', 'participantIds'];
  if (!fields.some(field => Object.hasOwn(body, field))) return 'Provide roomName, roomType, or participantIds';
  if (Object.hasOwn(body, 'roomName') && (typeof body.roomName !== 'string' || !body.roomName.trim() || body.roomName.trim().length > 80)) {
    return 'roomName must contain 1-80 characters';
  }
  if (Object.hasOwn(body, 'roomType') && !['direct', 'group'].includes(body.roomType)) return 'roomType must be direct or group';
  if (Object.hasOwn(body, 'participantIds') && (!Array.isArray(body.participantIds) || body.participantIds.some(id => typeof id !== 'string'))) {
    return 'participantIds must be an array of strings';
  }
  return null;
}

export default function handler(request, response) {
  const roomId = request.query?.roomId;
  if (request.method === 'GET') {
    const room = getRoom(roomId);
    return room ? response.status(200).json({ room: publicRoom(room) }) : response.status(404).json({ error: 'Room not found' });
  }
  if (request.method === 'PATCH' || request.method === 'PUT') {
    const body = parseBody(request.body);
    const error = validateUpdates(body);
    if (error) return response.status(400).json({ error });
    const updates = {};
    if (Object.hasOwn(body, 'roomName')) updates.roomName = body.roomName.trim();
    if (Object.hasOwn(body, 'roomType')) updates.roomType = body.roomType;
    if (Object.hasOwn(body, 'participantIds')) updates.participantIds = body.participantIds;
    const room = updateRoom(roomId, updates);
    return room ? response.status(200).json({ room }) : response.status(404).json({ error: 'Room not found' });
  }
  if (request.method === 'DELETE') {
    return deleteRoom(roomId)
      ? response.status(200).json({ roomId, deleted: true })
      : response.status(404).json({ error: 'Room not found' });
  }
  response.setHeader('Allow', 'GET, PATCH, PUT, DELETE');
  return response.status(405).json({ error: 'Method not allowed' });
}
