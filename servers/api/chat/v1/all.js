import { listRooms } from '../../../src/store.js';
import { authenticateRequest } from '../../../src/auth.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  if (!await authenticateRequest(request, response)) return;
  return response.status(200).json({ rooms: listRooms() });
}
