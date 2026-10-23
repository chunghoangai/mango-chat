# Mango Chat WebSocket server

Standalone WebSocket chat server for mobile and other clients. The native app is not modified.

## Local development

```sh
cd servers
npm install
npm run dev
```

Connect a local WebSocket client to `ws://localhost:3000/ws?room=general&name=Guest`. Health check: `http://localhost:3000/health`.

## REST API

The REST handlers are deployed under `/api/chat/v1`:

| Method and path | Purpose |
| --- | --- |
| `GET /api/chat/v1/all` | List rooms (alias for the room list) |
| `GET /api/chat/v1/rooms` | List rooms |
| `POST /api/chat/v1/rooms` | Create a room |
| `GET /api/chat/v1/rooms/{roomId}` | Get room metadata |
| `PATCH /api/chat/v1/rooms/{roomId}` | Update supplied room metadata fields |
| `DELETE /api/chat/v1/rooms/{roomId}` | Delete a room and close its connected sockets |
| `GET /api/chat/v1/rooms/{roomId}/messages?cursor={messageId}&limit=50` | Read a page of messages, newest page first |
| `POST /api/chat/v1/rooms/{roomId}/messages` | Send a message |

Create-room body: `{"roomName":"Design","roomType":"group","participantIds":["user-1","user-2"]}`.
Room updates accept any subset of `roomName`, `roomType`, and `participantIds`, for example `{"roomName":"Design team"}`.
Send-message body: `{"text":"Hello","mediaURL":null}`. The authenticated user's Auth0 subject is used as the sender ID.

All Vercel REST routes and WebSocket upgrades require `Authorization: Bearer <auth0-access-token>`. Configure `AUTH0_AUDIENCE` and either `AUTH0_DOMAIN` or `AUTH0_ISSUER_BASE_URL` in the Vercel project settings; the optional `AUTH0_ISSUER` overrides the issuer. The API verifies Auth0 JWT signatures and claims. OAuth login/callback is implemented by the client, not this server. Local standalone routes are development-only and do not enforce auth. REST sends are broadcast as `message:new`. Unread counts are zero, and room/message data is in-memory only; use shared persistent storage before relying on this across Vercel instances or restarts.

## Protocol

On connect, the server sends `connected`, `history` (up to 100 recent messages), then `presence`. Send JSON messages:

```json
{"type":"message","text":"Hello"}
```

Heartbeat request: `{"type":"ping"}`. The server responds with `pong`. Messages are broadcast to everyone in that room, including the sender. Rooms use alphanumeric characters, `_`, or `-`, up to 80 characters. Text is limited to 2,000 characters.

## Deploy on Vercel

Copy this `servers` directory as the Vercel project root, then run `npx vercel login` and `npx vercel --prod` from that directory. Connect mobile clients to `wss://<deployment-host>/api/ws?roomId=<room-id>` and include the Auth0 access token in the WebSocket handshake's `Authorization` header.

Each connection can last up to the function's configured duration (300 seconds on Hobby), so clients must reconnect and request history after reconnecting. This starter stores history and room membership in process memory. Vercel may route different clients to different function instances, and deploys/restarts lose memory; for shared rooms across instances, add a shared datastore/pub-sub service such as Redis before production. The WebSocket Functions feature is currently beta; verify current Vercel terms and limits before deployment.

## Security and production notes

The local standalone development server allows unauthenticated room joins. Vercel API routes require an Auth0 access token, but do not enforce per-room membership or roles. Add room authorization, rate limits, and shared persistent storage before handling private or sensitive messages. The Vercel Hobby plan may not be suitable for unrestricted production usage.
