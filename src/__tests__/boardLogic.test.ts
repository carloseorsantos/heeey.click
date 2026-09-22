import { describe, it, expect } from 'vitest';
import {
  electSyncPeer,
  sanitizeFilesForBroadcast,
  computeSceneSignature,
} from '../lib/realtimeUtils';

describe('realtimeUtils & multiplayer protections', () => {
  describe('electSyncPeer', () => {
    it('should elect room owner if present in presence state', () => {
      const ownerId = 'user-owner-123';
      const presenceState = {
        'guest-1-key': [{ id: 'user-guest-1', joinedAt: 1000 }],
        'owner-key': [{ id: 'user-owner-123', joinedAt: 2000 }],
        'guest-2-key': [{ id: 'user-guest-2', joinedAt: 3000 }],
      };

      const elected = electSyncPeer(
        presenceState,
        ownerId,
        'user-guest-1',
        'newly-joined-peer'
      );
      expect(elected).toBe('user-owner-123');
    });

    it('should elect oldest peer if owner is not in presence', () => {
      const ownerId = 'user-owner-absent';
      const presenceState = {
        'guest-2-key': [{ id: 'user-guest-2', joinedAt: 2500 }],
        'guest-1-key': [{ id: 'user-guest-1', joinedAt: 1000 }],
        'guest-3-key': [{ id: 'user-guest-3', joinedAt: 3000 }],
      };

      const elected = electSyncPeer(
        presenceState,
        ownerId,
        'user-guest-1',
        'newly-joined-peer'
      );
      expect(elected).toBe('user-guest-1');
    });

    it('should exclude the requesting sender from election even if requester is owner', () => {
      const ownerId = 'user-owner-123';
      const presenceState = {
        'owner-key': [{ id: 'user-owner-123', joinedAt: 1000 }],
        'guest-key': [{ id: 'user-guest-1', joinedAt: 2000 }],
      };

      // Owner is re-joining or requesting sync
      const elected = electSyncPeer(
        presenceState,
        ownerId,
        'user-guest-1',
        'user-owner-123'
      );
      expect(elected).toBe('user-guest-1');
    });

    it('should break ties deterministically by peer ID when joinedAt timestamps are identical', () => {
      const presenceState = {
        'peer-z': [{ id: 'user-z', joinedAt: 1000 }],
        'peer-a': [{ id: 'user-a', joinedAt: 1000 }],
        'peer-m': [{ id: 'user-m', joinedAt: 1000 }],
      };

      const elected = electSyncPeer(
        presenceState,
        null,
        'user-z',
        'new-peer'
      );
      expect(elected).toBe('user-a');
    });

    it('should deduplicate multiple presence entries for the same client ID and take earliest joinedAt', () => {
      const presenceState = {
        'tab-1': [{ id: 'user-1', joinedAt: 5000 }],
        'tab-2': [{ id: 'user-1', joinedAt: 1000 }],
        'tab-3': [{ id: 'user-2', joinedAt: 2000 }],
      };

      const elected = electSyncPeer(
        presenceState,
        null,
        'user-2',
        'new-peer'
      );
      expect(elected).toBe('user-1');
    });

    it('should fall back to myUserId when presence state is empty or null', () => {
      expect(electSyncPeer(null, null, 'my-user-id', 'sender-1')).toBe('my-user-id');
      expect(electSyncPeer({}, null, 'my-user-id', 'sender-1')).toBe('my-user-id');
      expect(
        electSyncPeer(
          { onlySender: [{ id: 'sender-1', joinedAt: 1000 }] },
          null,
          'my-user-id',
          'sender-1'
        )
      ).toBe('my-user-id');
    });
  });

  describe('sanitizeFilesForBroadcast', () => {
    it('should keep remote image URLs and strip heavy base64 data URLs', () => {
      const testFiles = {
        'remote-img': {
          id: 'remote-img',
          dataURL: 'https://example.supabase.co/storage/v1/object/public/board-media/123/img.webp',
          mimeType: 'image/webp',
          created: 12345,
        },
        'heavy-base64': {
          id: 'heavy-base64',
          dataURL: 'data:image/png;base64,' + 'A'.repeat(50000),
          mimeType: 'image/png',
          created: 12346,
        },
      };

      const sanitized = sanitizeFilesForBroadcast(testFiles);
      expect(sanitized).toBeDefined();
      expect(sanitized!['remote-img'].dataURL).toBe(testFiles['remote-img'].dataURL);
      expect(sanitized!['heavy-base64'].dataURL).toBeUndefined();
      expect(sanitized!['heavy-base64'].id).toBe('heavy-base64');
      expect(sanitized!['heavy-base64'].mimeType).toBe('image/png');
    });

    it('should handle undefined or empty files safely', () => {
      expect(sanitizeFilesForBroadcast(undefined)).toBeUndefined();
      expect(sanitizeFilesForBroadcast({})).toEqual({});
    });
  });

  describe('computeSceneSignature', () => {
    it('should compute consistent scene signature and detect drawing modifications', () => {
      const elements1 = [{ id: '1', version: 1, versionNonce: 10 }];
      const elements2 = [{ id: '1', version: 1, versionNonce: 10 }];
      const elementsModified = [{ id: '1', version: 2, versionNonce: 11 }];

      const sig1 = computeSceneSignature(elements1, '#ffffff', 0);
      const sig2 = computeSceneSignature(elements2, '#ffffff', 0);
      const sigMod = computeSceneSignature(elementsModified, '#ffffff', 0);

      expect(sig1).toBe(sig2);
      expect(sig1).not.toBe(sigMod);
    });

    it('should detect background color and files count changes', () => {
      const elements = [{ id: '1', version: 1, versionNonce: 10 }];
      const sigWhite = computeSceneSignature(elements, '#ffffff', 0);
      const sigDark = computeSceneSignature(elements, '#121212', 0);
      const sigWithFiles = computeSceneSignature(elements, '#ffffff', 2);

      expect(sigWhite).not.toBe(sigDark);
      expect(sigWhite).not.toBe(sigWithFiles);
    });
  });
});
