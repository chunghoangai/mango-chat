# Mango Chat APIs

API reference for the features currently implemented in `servers/`. The Vercel Functions are relative to the `servers` project root. The standalone local server also exposes `/health` and a WebSocket at `/ws`.

## Authentication

All Vercel REST endpoints and the Vercel WebSocket endpoint require a valid Auth0 access token issued for the Mango Chat API. Send it in the HTTP `Authorization` header:

```http
Authorization: Bearer <auth0-access-token>
```

The API verifies each JWT's RS256 signature against Auth0's JWKS, and checks its issuer, audience, expiration, and subject. The verified `sub` is the user's stable ID. Message `senderId` is taken from that identity; clients must not send it. The WebSocket handshake also requires the Bearer header. The user's name and avatar are read from token claims when present. Missing or invalid tokens receive `401 Unauthorized`; if Auth0's JWKS cannot be reached, the API returns `502 Bad Gateway`.

Configure an Auth0 API and set `AUTH0_AUDIENCE` (the API identifier) in the Vercel project environment variables. Set either `AUTH0_DOMAIN` (for example, `tenant.us.auth0.com`) or `AUTH0_ISSUER_BASE_URL` (the Auth0 issuer URL; the standard Auth0 SDK variable). `AUTH0_ISSUER` can override the issuer. It must exactly match the token's `iss` claim, including its trailing slash. The client must request an access token for this API audience. Do not send an ID token to these API endpoints. Login and callback handling are client responsibilities and are not implemented by these endpoints. See [Auth0's API authorization guide](https://developer.auth0.com/resources/guides/api/express/basic-authorization).

Local standalone HTTP and WebSocket server routes are for development and do not enforce this token check. Vercel room endpoints require authentication but do not yet enforce per-room participant permissions; any valid Auth0 user can call a room endpoint if they know its ID.

## Rooms

### List rooms

`GET /api/chat/v1/rooms`

Alias: `GET /api/chat/v1/all`

Returns `{ "rooms": [...] }`.

### Create a room

`POST /api/chat/v1/rooms`

Request:

```json
{
  "roomName": "Design",
  "roomType": "group",
  "participantIds": ["user-1", "user-2"]
}
```

`roomName` is required (1–80 characters). `roomType` is `group` or `direct` and defaults to `group`. `participantIds` is an array of strings and defaults to `[]`. The server generates `roomId`.

Success: `201 Created`, `{ "room": Room }`.

### Get room metadata

`GET /api/chat/v1/rooms/{roomId}`

Success: `200 OK`, `{ "room": Room }`. Missing room: `404 Not Found`.

### Update room metadata

`PATCH /api/chat/v1/rooms/{roomId}`

Supply one or more mutable fields. Omitted fields are unchanged.

```json
{
  "roomName": "Design team",
  "roomType": "group",
  "participantIds": ["user-1", "user-3"]
}
```

`PUT` is also accepted and has the same partial-update behavior. `roomName` must be 1–80 characters; `roomType` must be `group` or `direct`; `participantIds` must be an array of strings.

Success: `200 OK`, `{ "room": Room }`. Invalid input: `400 Bad Request`. Missing room: `404 Not Found`.

### Delete a room

`DELETE /api/chat/v1/rooms/{roomId}`

Success: `200 OK`, `{ "roomId": "...", "deleted": true }`. Connected WebSocket clients are closed. Missing room: `404 Not Found`.

## Messages

### List message history

`GET /api/chat/v1/rooms/{roomId}/messages?limit=50&cursor={messageId}`

`limit` defaults to 50 and must be 1–100. Results are ordered oldest to newest within the returned page, with the newest page returned first. Pass the returned `nextCursor` as `cursor` to fetch the preceding page. History is capped at the latest 100 messages per room.

Success: `200 OK`:

```json
{
  "messages": [],
  "nextCursor": null
}
```

Unknown room: `404 Not Found`; invalid limit: `400 Bad Request`.

### Send a message

`POST /api/chat/v1/rooms/{roomId}/messages`

Request:

```json
{
  "text": "Hello",
  "mediaURL": null
}
```

Non-empty `text` is required. Text is limited to 2,000 characters. `mediaURL` is optional and may be a string or `null`. The authenticated Auth0 user becomes `senderId` in the returned message.

Success: `201 Created`, `{ "message": Message }`. Invalid input: `400 Bad Request`. Unknown room: `404 Not Found`.

## WebSocket chat

### Connect

On Vercel, connect to:

```text
wss://<deployment-host>/api/ws?roomId=<room-id>
```

Include `Authorization: Bearer <auth0-access-token>` in the WebSocket handshake headers. The room must already exist. The verified Auth0 subject supplies the user ID. Locally, the standalone server accepts `ws://localhost:3000/ws?room=<room-name>&name=<display-name>` without authentication; it creates an in-memory room when a client joins.

On connection the server sends `connected` with a client ID and user count, `history` with the latest messages, and `presence` with the room user count. When a client disconnects, remaining clients receive an updated `presence` event.

### Client messages

Send JSON text frames:

```json
{"type":"message","text":"Hello"}
```

Messages are stored in room history and broadcast to all connected clients in that room. Text must contain 1–2,000 characters. Binary frames are rejected.

Heartbeat:

```json
{"type":"ping"}
```

The server responds with `{"type":"pong","at":<unix-milliseconds>}`.

Error frames have the shape `{ "type": "error", "error": "..." }`.

### Server events

- `connected`: connection ID, room, and current user count.
- `history`: recent messages at connection time.
- `presence`: current connected user count.
- `message:new`: a message created through REST. WebSocket-originated messages use the legacy `message` event shape.

## Data shapes

Room responses use:

```json
{
  "roomId": "UUID",
  "roomName": "Design",
  "roomType": "group",
  "participantIds": ["user-1"],
  "lastMessage": null,
  "unreadCount": 0,
  "updatedAt": "ISO-8601 timestamp"
}
```

Message REST responses use:

```json
{
  "messageId": "UUID",
  "roomId": "UUID",
  "senderId": "user-1",
  "text": "Hello",
  "mediaURL": null,
  "status": "sent",
  "timestamp": "ISO-8601 timestamp"
}
```

## Health and fallback

- `GET /health` on the standalone local server returns `{ "status": "ok" }`.
- Other standalone HTTP requests return a plain-text server description.
- A request to the Vercel WebSocket function without a WebSocket upgrade receives `426 Upgrade Required`.

## Current implementation limits

- Room membership and messages live in process memory, capped to 100 messages per room. Vercel instances and restarts do not share this state; use shared storage and pub/sub for durable, cross-instance chat.
- The Auth0 login/callback/token lifecycle is not implemented in this server. Participant IDs are client supplied, and room-level membership/authorization checks are not implemented.
- `unreadCount` is always zero. Read receipts, message status updates, typing events, and media upload/storage are not implemented.
- The local WebSocket path uses room names while Vercel uses IDs for rooms created through REST.
