/**
 * Google Drive memory sync.
 *
 * Pitfall #4: Edge doesn't support chrome.identity.getAuthToken().
 *   → Uses chrome.identity.launchWebAuthFlow() with PKCE instead.
 *
 * Pitfall #5: GDrive multipart uploads need RFC 2387 multipart/related.
 */

import type { POMemoryStore } from '../../types/schema';

const DRIVE_API = 'https://www.googleapis.com/';
const MEMORY_FILENAME = 'po-coach-memory.json';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

// ── PKCE helpers ──

export async function generatePKCE(): Promise<{
  verifier: string;
  challenge: string;
}> {
  // 43-char random verifier (RFC 7636 recommends 43–128)
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = base64UrlEncode(array);

  // SHA-256 challenge
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  );
  const challenge = base64UrlEncode(new Uint8Array(digest));

  return { verifier, challenge };
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── OAuth (Edge-compatible) ──

export async function authenticateGDrive(clientId: string): Promise<string> {
  const redirectUrl = chrome.identity.getRedirectURL();
  const { verifier, challenge } = await generatePKCE();

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUrl);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true,
  });

  if (!responseUrl) {
    throw new Error('GDrive auth flow returned no URL');
  }

  const code = new URL(responseUrl).searchParams.get('code');
  if (!code) {
    throw new Error('GDrive auth flow returned no authorization code');
  }

  // Exchange code for token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUrl,
    }),
  });

  if (!tokenResponse.ok) {
    const errBody = await tokenResponse.text().catch(() => '');
    throw new Error(`Token exchange failed: ${tokenResponse.status} – ${errBody}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token as string;
}

// ── Drive file operations ──

async function findExistingFile(
  token: string
): Promise<string | null> {
  const query = encodeURIComponent(
    `name='${MEMORY_FILENAME}' and trashed=false`
  );
  const res = await fetch(
    `${DRIVE_API}drive/v3/files?q=${query}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) return null;
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

/**
 * Upload memory store to Google Drive.
 * Creates a new file or updates an existing one.
 */
export async function uploadMemoryToGDrive(
  token: string,
  memoryStore: POMemoryStore
): Promise<void> {
  const existingId = await findExistingFile(token);
  const jsonBody = JSON.stringify(memoryStore, null, 2);

  if (existingId) {
    // Update existing file (simple media upload)
    const res = await fetch(
      `${DRIVE_API}upload/drive/v3/files/${existingId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: jsonBody,
      }
    );
    if (!res.ok) {
      throw new Error(`GDrive update failed: ${res.status}`);
    }
  } else {
    // Create new file with RFC 2387 multipart/related
    const boundary = '----POCoachBoundary' + Date.now();
    const metadata = JSON.stringify({
      name: MEMORY_FILENAME,
      mimeType: 'application/json',
    });

    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${metadata}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${jsonBody}\r\n` +
      `--${boundary}--`;

    const res = await fetch(
      `${DRIVE_API}upload/drive/v3/files?uploadType=multipart`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );
    if (!res.ok) {
      throw new Error(`GDrive create failed: ${res.status}`);
    }
  }
}

/**
 * Download memory store from Google Drive.
 * Returns null if no file exists.
 */
export async function downloadMemoryFromGDrive(
  token: string
): Promise<POMemoryStore | null> {
  const fileId = await findExistingFile(token);
  if (!fileId) return null;

  const res = await fetch(
    `${DRIVE_API}drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    console.warn(`[gdrive-sync] Download failed: ${res.status}`);
    return null;
  }

  try {
    return (await res.json()) as POMemoryStore;
  } catch {
    console.warn('[gdrive-sync] Failed to parse downloaded memory file');
    return null;
  }
}
