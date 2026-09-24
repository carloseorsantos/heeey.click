import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateTargetDimensions,
  uploadBoardImage,
  optimizeAndUploadImage,
} from '../lib/imageOptimizer';
import { supabase } from '../lib/supabase';

describe('imageOptimizer', () => {
  describe('calculateTargetDimensions', () => {
    it('should keep images within maxDimension (1600px) unchanged', () => {
      const result = calculateTargetDimensions(800, 600, 1600);
      expect(result).toEqual({ width: 800, height: 600 });

      const square = calculateTargetDimensions(1200, 1200, 1600);
      expect(square).toEqual({ width: 1200, height: 1200 });
    });

    it('should downscale wide images so width is 1600 and aspect ratio is preserved', () => {
      // 4000 x 3000 (4:3) -> 1600 x 1200
      const result = calculateTargetDimensions(4000, 3000, 1600);
      expect(result.width).toBe(1600);
      expect(result.height).toBe(1200);
    });

    it('should downscale tall images so height is 1600 and aspect ratio is preserved', () => {
      // 1000 x 4000 (1:4) -> 400 x 1600
      const result = calculateTargetDimensions(1000, 4000, 1600);
      expect(result.width).toBe(400);
      expect(result.height).toBe(1600);
    });

    it('should handle square images larger than maxDimension', () => {
      const result = calculateTargetDimensions(2500, 2500, 1600);
      expect(result).toEqual({ width: 1600, height: 1600 });
    });

    it('should handle invalid or zero dimensions safely', () => {
      const result = calculateTargetDimensions(0, 0, 1600);
      expect(result).toEqual({ width: 1600, height: 1600 });
    });

    it('should handle NaN or non-finite dimensions safely without crashing', () => {
      const nanResult = calculateTargetDimensions(NaN, 1000, 1600);
      expect(nanResult).toEqual({ width: 1600, height: 1600 });

      const infResult = calculateTargetDimensions(1000, Infinity, 1600);
      expect(infResult).toEqual({ width: 1600, height: 1600 });
    });
  });

  describe('compressDataURL', () => {
    it('should handle base64 encoded SVG data URLs safely', async () => {
      const svgBase64 = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>')}`;
      const { compressDataURL } = await import('../lib/imageOptimizer');
      const result = await compressDataURL(svgBase64);
      expect(result.mimeType).toBe('image/svg+xml');
      expect(result.blob).toBeInstanceOf(Blob);
    });

    it('should handle URL-encoded SVG data URLs without calling invalid atob', async () => {
      const svgRaw = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';
      const { compressDataURL } = await import('../lib/imageOptimizer');
      const result = await compressDataURL(svgRaw);
      expect(result.mimeType).toBe('image/svg+xml');
      expect(result.blob).toBeInstanceOf(Blob);
    });
  });

  describe('uploadBoardImage and storage fallback', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should return null if boardId or fileId is empty', async () => {
      const fakeBlob = new Blob(['test content'], { type: 'image/webp' });
      expect(await uploadBoardImage('', 'file-1', fakeBlob)).toBeNull();
      expect(await uploadBoardImage('board-1', '', fakeBlob)).toBeNull();
    });

    it('should sanitize boardId and fileId path components', async () => {
      const mockUpload = vi.fn().mockResolvedValue({ data: { path: 'test.webp' }, error: null });
      const mockGetPublicUrl = vi.fn().mockReturnValue({
        data: { publicUrl: 'https://example.supabase.co/storage/v1/object/public/board-media/safe/safe.webp' },
      });

      vi.spyOn(supabase.storage, 'from').mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      } as any);

      const fakeBlob = new Blob(['test content'], { type: 'image/webp' });
      await uploadBoardImage('board with space', 'file/with/slash', fakeBlob, 'image/webp');

      expect(mockUpload).toHaveBeenCalledWith(
        'board%20with%20space/file%2Fwith%2Fslash.webp',
        fakeBlob,
        expect.anything()
      );
    });

    it('should return public URL when Supabase storage upload succeeds', async () => {
      const mockUpload = vi.fn().mockResolvedValue({ data: { path: 'test.webp' }, error: null });
      const mockGetPublicUrl = vi.fn().mockReturnValue({
        data: { publicUrl: 'https://example.supabase.co/storage/v1/object/public/board-media/board-1/file-1.webp' },
      });

      vi.spyOn(supabase.storage, 'from').mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      } as any);

      const fakeBlob = new Blob(['test content'], { type: 'image/webp' });
      const url = await uploadBoardImage('board-1', 'file-1', fakeBlob, 'image/webp');

      expect(url).toBe('https://example.supabase.co/storage/v1/object/public/board-media/board-1/file-1.webp');
      expect(mockUpload).toHaveBeenCalledWith(
        'board-1/file-1.webp',
        fakeBlob,
        expect.objectContaining({ contentType: 'image/webp', upsert: false })
      );
    });

    it('treats an already uploaded file (retry of the same image) as success', async () => {
      vi.spyOn(supabase.storage, 'from').mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: null, error: { message: 'The resource already exists', statusCode: '409' } }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.test/board-1/file-1.webp' } }),
      } as any);

      const url = await uploadBoardImage('board-1', 'file-1', new Blob(['x'], { type: 'image/webp' }), 'image/webp');

      expect(url).toBe('https://example.test/board-1/file-1.webp');
    });

    it('should return null gracefully when Supabase storage returns an error (bucket missing / offline)', async () => {
      vi.spyOn(supabase.storage, 'from').mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: null, error: { message: 'Bucket not found' } }),
        getPublicUrl: vi.fn(),
      } as any);

      const fakeBlob = new Blob(['test content'], { type: 'image/webp' });
      const url = await uploadBoardImage('board-1', 'file-1', fakeBlob, 'image/webp');

      expect(url).toBeNull();
    });

    it('should return null gracefully when Supabase storage throws network exception', async () => {
      vi.spyOn(supabase.storage, 'from').mockReturnValue({
        upload: vi.fn().mockRejectedValue(new Error('Network offline')),
        getPublicUrl: vi.fn(),
      } as any);

      const fakeBlob = new Blob(['test content'], { type: 'image/webp' });
      const url = await uploadBoardImage('board-1', 'file-1', fakeBlob, 'image/webp');

      expect(url).toBeNull();
    });
  });

  describe('optimizeAndUploadImage', () => {
    it('should pass through existing remote URLs without recompressing', async () => {
      const remoteUrl = 'https://cdn.example.com/images/artwork.png';
      const result = await optimizeAndUploadImage('board-1', 'file-1', remoteUrl);

      expect(result.dataURL).toBe(remoteUrl);
      expect(result.isRemote).toBe(true);
    });
  });

  describe('cursor micro-movement Euclidean distance logic', () => {
    it('should correctly measure Euclidean distance between pointer coordinates', () => {
      const p1 = { x: 100, y: 100 };
      const p2 = { x: 101, y: 102 }; // dx = 1, dy = 2 -> dist = sqrt(5) ≈ 2.236 (< 3px)
      const p3 = { x: 103, y: 104 }; // dx = 3, dy = 4 -> dist = 5.0 (>= 3px)

      const distSmall = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      expect(distSmall).toBeLessThan(3);

      const distLarge = Math.hypot(p3.x - p1.x, p3.y - p1.y);
      expect(distLarge).toBeGreaterThanOrEqual(3);
    });
  });
});
