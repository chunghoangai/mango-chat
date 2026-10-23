import { createRoom, listRooms } from '../../../../src/store.js';
import { authenticateRequest } from '../../../../src/auth.js';

export default async function handler(request, response) {
  const user = await authenticateRequest(request, response);
  if (!user) return;
  if (request.method === 'GET') return response.status(200).json({ rooms: listRooms() });
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  let body = request.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return response.status(400).json({ error: 'Body must be valid JSON' }); }
  }
  const roomName = typeof body?.roomName === 'string' ? body.roomName.trim() : '';
  const roomType = body?.roomType ?? 'group';
  const requestedParticipantIds = body?.participantIds ?? [];
  if (!roomName || roomName.length > 80) return response.status(400).json({ error: 'roomName must contain 1-80 characters' });
  if (!['direct', 'group'].includes(roomType)) return response.status(400).json({ error: 'roomType must be direct or group' });
  if (!Array.isArray(requestedParticipantIds) || requestedParticipantIds.some(id => typeof id !== 'string')) {
    return response.status(400).json({ error: 'participantIds must be an array of strings' });
  }
  const participantIds = [...new Set([user.id, ...requestedParticipantIds])];
  return response.status(201).json({ room: createRoom({ roomName, roomType, participantIds }) });
}
