import { createMessage, listMessages, MAX_MESSAGE_LENGTH } from '../../../../../src/store.js';

function parseBody(body) {
  if (typeof body !== 'string') return body;
  try { return JSON.parse(body); } catch { return null; }
}

export default function handler(request, response) {
  const roomId = request.query?.roomId;
  if (request.method === 'GET') {
    const rawLimit = Number(request.query?.limit ?? 50);
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) return response.status(400).json({ error: 'limit must be between 1 and 100' });
    const result = listMessages(roomId, { cursor: request.query?.cursor, limit: rawLimit });
    if (!result) return response.status(404).json({ error: 'Room not found' });
    return response.status(200).json(result);
  }
  if (request.method === 'POST') {
    const body = parseBody(request.body);
    if (!body) return response.status(400).json({ error: 'Body must be valid JSON' });
    if (typeof body.senderId !== 'string' || !body.senderId.trim()) return response.status(400).json({ error: 'senderId is required' });
    if (typeof body.text !== 'string' || !body.text.trim() || body.text.trim().length > MAX_MESSAGE_LENGTH) {
      return response.status(400).json({ error: `text must contain 1-${MAX_MESSAGE_LENGTH} characters` });
    }
    if (body.mediaURL != null && typeof body.mediaURL !== 'string') return response.status(400).json({ error: 'mediaURL must be a string or null' });
    const message = createMessage(roomId, body);
    if (!message) return response.status(404).json({ error: 'Room not found' });
    return response.status(201).json({ message });
  }
  response.setHeader('Allow', 'GET, POST');
  return response.status(405).json({ error: 'Method not allowed' });
}
