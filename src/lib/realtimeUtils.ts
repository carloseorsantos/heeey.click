/**
 * Realtime and multiplayer utility functions for Heeey.
 */

export interface PresenceEntry {
  id: string;
  joinedAt?: number;
  name?: string;
  color?: { background: string; stroke: string };
  [key: string]: any;
}

/**
 * Sanitizes files dictionary for WebSocket broadcasts.
 * Keeps remote URLs (http:// or https://) which are tiny (~100 bytes).
 * Strips raw base64 data URLs to prevent Phoenix Realtime frame drops (WebSocket 1009).
 */
export function sanitizeFilesForBroadcast(
  files?: Record<string, any>
): Record<string, any> | undefined {
  if (!files || typeof files !== 'object') return undefined;

  const sanitized: Record<string, any> = {};
  for (const [key, file] of Object.entries(files)) {
    if (!file) continue;

    // Remote URLs (https://...) are small and safe to broadcast
    if (
      typeof file.dataURL === 'string' &&
      (file.dataURL.startsWith('http://') || file.dataURL.startsWith('https://'))
    ) {
      sanitized[key] = file;
    } else {
      // Local base64 data URLs: broadcast metadata only.
      // The remote URL is broadcast once background upload to Supabase storage completes.
      sanitized[key] = {
        id: file.id,
        mimeType: file.mimeType,
        created: file.created,
        _optimized: file._optimized,
      };
    }
  }

  return sanitized;
}

/**
 * Computes a fast signature of canvas scene elements, background color, and files.
 * Used for change detection to ignore pure viewport pan/zoom/scroll updates
 * while preserving every user drawing stroke.
 */
export function computeSceneSignature(
  elements: readonly any[],
  viewBgColor?: string,
  filesCount: number = 0
): string {
  const elementsVersionSum = elements.reduce(
    (acc, el) => (acc + (el.version || 0) + (el.versionNonce || 0)) % 10000000,
    0
  );
  return `${elements.length}:${elementsVersionSum}:${viewBgColor || ''}:${filesCount}`;
}

/**
 * Deterministically elects a single peer to respond to a sync-request,
 * preventing thundering herd where all peers in a room flood the newly joined user.
 *
 * Election rules:
 * 1. Filter out the requesting sender.
 * 2. If room owner is present and not the sender, elect owner.
 * 3. Otherwise elect oldest collaborator (earliest joinedAt).
 * 4. Deterministic tie-breaking using peer ID (localeCompare).
 * 5. Fall back to current user ID if no eligible peers exist.
 */
export function electSyncPeer(
  presenceState: Record<string, any> | null | undefined,
  currentOwnerId: string | null | undefined,
  myUserId: string,
  requestingSenderId: string
): string {
  if (!presenceState || typeof presenceState !== 'object') {
    return myUserId;
  }

  // Deduplicate peers by ID, tracking earliest joinedAt timestamp
  const peerMap = new Map<string, number>();

  Object.values(presenceState).forEach((entries: any) => {
    const list = Array.isArray(entries) ? entries : [entries];
    list.forEach((p: any) => {
      if (p && p.id && p.id !== requestingSenderId) {
        const timestamp = typeof p.joinedAt === 'number' ? p.joinedAt : 0;
        const existing = peerMap.get(p.id);
        if (existing === undefined || timestamp < existing) {
          peerMap.set(p.id, timestamp);
        }
      }
    });
  });

  const eligiblePeers: { id: string; joinedAt: number }[] = Array.from(peerMap.entries()).map(
    ([id, joinedAt]) => ({ id, joinedAt })
  );

  if (eligiblePeers.length === 0) {
    return myUserId;
  }

  // Rule 1: Room owner gets priority if present
  if (currentOwnerId && peerMap.has(currentOwnerId)) {
    return currentOwnerId;
  }

  // Rule 2 & 3: Oldest peer, with deterministic tie-breaking on ID
  eligiblePeers.sort(
    (a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id)
  );

  return eligiblePeers[0].id;
}
