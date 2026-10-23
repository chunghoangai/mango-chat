import { createPublicKey, verify as verifySignature } from 'node:crypto';

const JWKS_CACHE_MS = 10 * 60 * 1000;
let jwksCache = null;

function auth0Config() {
  const domain = process.env.AUTH0_DOMAIN?.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const audience = process.env.AUTH0_AUDIENCE?.trim();
  const configuredIssuer = process.env.AUTH0_ISSUER?.trim() || process.env.AUTH0_ISSUER_BASE_URL?.trim();
  if ((!domain && !configuredIssuer) || !audience) return null;

  const issuer = configuredIssuer || `https://${domain}/`;
  const issuerURL = new URL(issuer);
  if (issuerURL.protocol !== 'https:') throw new Error('AUTH0_ISSUER must use HTTPS');
  return { audience, issuer: issuerURL.href, jwksURL: new URL('.well-known/jwks.json', issuerURL).href };
}

async function getJwks(jwksURL, refresh = false) {
  if (!refresh && jwksCache?.url === jwksURL && jwksCache.expiresAt > Date.now()) return jwksCache.keys;

  const response = await fetch(jwksURL, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Auth0 JWKS request failed (${response.status})`);
  const body = await response.json();
  if (!Array.isArray(body.keys)) throw new Error('Auth0 JWKS response has no keys');
  jwksCache = { url: jwksURL, keys: body.keys, expiresAt: Date.now() + JWKS_CACHE_MS };
  return body.keys;
}

function unauthorized(response, error) {
  response.status(401).json({ error });
  return null;
}

export async function authenticateRequest(request, response) {
  let config;
  try {
    config = auth0Config();
  } catch {
    response.status(500).json({ error: 'Invalid Auth0 issuer configuration' });
    return null;
  }
  if (!config) {
    response.status(503).json({ error: 'Auth0 is not configured; set AUTH0_DOMAIN and AUTH0_AUDIENCE' });
    return null;
  }

  const authorization = request.headers?.authorization;
  const match = typeof authorization === 'string' && authorization.match(/^Bearer\s+(\S+)$/i);
  if (!match) return unauthorized(response, 'Bearer access token required');

  const parts = match[1].split('.');
  if (parts.length !== 3) return unauthorized(response, 'Invalid Auth0 access token');

  let header;
  let claims;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return unauthorized(response, 'Invalid Auth0 access token');
  }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
    return unauthorized(response, 'Unsupported Auth0 access token');
  }

  let jwk;
  try {
    let keys = await getJwks(config.jwksURL);
    jwk = keys.find(key => key.kid === header.kid && key.use === 'sig' && key.kty === 'RSA' && (!key.alg || key.alg === 'RS256'));
    if (!jwk) {
      keys = await getJwks(config.jwksURL, true);
      jwk = keys.find(key => key.kid === header.kid && key.use === 'sig' && key.kty === 'RSA' && (!key.alg || key.alg === 'RS256'));
    }
  } catch {
    response.status(502).json({ error: 'Could not retrieve Auth0 signing keys' });
    return null;
  }
  if (!jwk) return unauthorized(response, 'Unknown Auth0 signing key');

  let signatureIsValid = false;
  try {
    signatureIsValid = verifySignature(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      createPublicKey({ key: jwk, format: 'jwk' }),
      Buffer.from(parts[2], 'base64url')
    );
  } catch {
    return unauthorized(response, 'Invalid Auth0 access token signature');
  }
  if (!signatureIsValid) return unauthorized(response, 'Invalid Auth0 access token signature');

  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== config.issuer || !audiences.includes(config.audience)) {
    return unauthorized(response, 'Auth0 token issuer or audience does not match this API');
  }
  if (typeof claims.exp !== 'number' || claims.exp <= now || (typeof claims.nbf === 'number' && claims.nbf > now)) {
    return unauthorized(response, 'Auth0 access token is expired or not active');
  }
  if (typeof claims.sub !== 'string' || !claims.sub) {
    return unauthorized(response, 'Auth0 token has no user subject');
  }

  return {
    id: claims.sub,
    email: claims.email,
    name: claims.name ?? claims.nickname ?? claims.email ?? claims.sub,
    avatarUrl: claims.picture
  };
}
