import { supabase } from './supabase';

export interface OptimizedImageResult {
  dataURL: string;
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface OptimizedUploadResult {
  dataURL: string;
  mimeType: string;
  isRemote: boolean;
  width?: number;
  height?: number;
}

const MAX_IMAGE_DIMENSION = 1600;
const TARGET_MAX_BYTES = 150 * 1024; // ~150 KB target limit
const DEFAULT_QUALITY = 0.8;

/**
 * Calculates resized dimensions while maintaining the original aspect ratio.
 * Limits the maximum dimension (width or height) to maxDimension (default 1600px).
 */
export function calculateTargetDimensions(
  width: number,
  height: number,
  maxDimension: number = MAX_IMAGE_DIMENSION
): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: maxDimension, height: maxDimension };
  }

  if (width <= maxDimension && height <= maxDimension) {
    return { width: Math.round(width), height: Math.round(height) };
  }

  if (width >= height) {
    const ratio = height / width;
    return {
      width: maxDimension,
      height: Math.max(1, Math.round(maxDimension * ratio)),
    };
  } else {
    const ratio = width / height;
    return {
      width: Math.max(1, Math.round(maxDimension * ratio)),
      height: maxDimension,
    };
  }
}

/**
 * Compresses an image source (Image, Canvas, or ImageBitmap) to WebP or JPEG
 * with downscaling to max 1600px and quality ~0.8 (targeting < 150 KB).
 */
export async function compressCanvasSource(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  preferMimeType: string = 'image/webp',
  quality: number = DEFAULT_QUALITY
): Promise<OptimizedImageResult> {
  const { width, height } = calculateTargetDimensions(sourceWidth, sourceHeight, MAX_IMAGE_DIMENSION);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, width, height);
  }

  let mimeType = preferMimeType === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
  let dataURL = canvas.toDataURL(mimeType, quality);

  // If the browser doesn't support WebP export in canvas, fallback to JPEG
  if (!dataURL.startsWith(`data:${mimeType}`)) {
    mimeType = 'image/jpeg';
    if (ctx) {
      // Paint white background behind transparent regions so JPEG does not render them pitch black
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
    }
    dataURL = canvas.toDataURL(mimeType, quality);
  }

  // Create Blob
  let blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob(
      (b) => {
        if (b) {
          resolve(b);
        } else {
          const binStr = atob(dataURL.split(',')[1]);
          const len = binStr.length;
          const arr = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            arr[i] = binStr.charCodeAt(i);
          }
          resolve(new Blob([arr], { type: mimeType }));
        }
      },
      mimeType,
      quality
    );
  });

  // If still significantly larger than 150 KB, do a second compression pass at lower quality/scale
  if (blob.size > TARGET_MAX_BYTES && quality > 0.6) {
    const reducedQuality = Math.max(0.6, quality - 0.15);
    const secondDataUrl = canvas.toDataURL(mimeType, reducedQuality);
    const secondBlob = await new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b || blob),
        mimeType,
        reducedQuality
      );
    });

    if (secondBlob.size < blob.size) {
      blob = secondBlob;
      dataURL = secondDataUrl;
    }
  }

  return {
    dataURL,
    blob,
    mimeType,
    width,
    height,
    sizeBytes: blob.size,
  };
}

/**
 * Compresses a File or Blob client-side.
 */
export async function compressImageFile(
  fileOrBlob: File | Blob
): Promise<OptimizedImageResult> {
  // SVGs are already crisp vectors and tiny, keep as vector SVG
  if (fileOrBlob.type === 'image/svg+xml') {
    const dataURL = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(fileOrBlob);
    });

    return {
      dataURL,
      blob: fileOrBlob,
      mimeType: 'image/svg+xml',
      width: 400,
      height: 400,
      sizeBytes: fileOrBlob.size,
    };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(fileOrBlob);

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const result = await compressCanvasSource(
          img,
          img.naturalWidth || img.width,
          img.naturalHeight || img.height,
          'image/webp',
          DEFAULT_QUALITY
        );
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Falha ao decodificar imagem para compressão: ${err}`));
    };

    img.src = objectUrl;
  });
}

/**
 * Compresses a raw dataURL string client-side.
 */
export async function compressDataURL(dataURL: string): Promise<OptimizedImageResult> {
  if (dataURL.startsWith('data:image/svg+xml')) {
    let blob: Blob;
    if (dataURL.includes(';base64,')) {
      try {
        const binStr = atob(dataURL.split(';base64,')[1] || '');
        const arr = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) {
          arr[i] = binStr.charCodeAt(i);
        }
        blob = new Blob([arr], { type: 'image/svg+xml' });
      } catch {
        blob = new Blob([dataURL], { type: 'image/svg+xml' });
      }
    } else {
      try {
        const parts = dataURL.split(',');
        const rawContent = parts.slice(1).join(',');
        const svgText = decodeURIComponent(rawContent);
        blob = new Blob([svgText], { type: 'image/svg+xml' });
      } catch {
        blob = new Blob([dataURL], { type: 'image/svg+xml' });
      }
    }

    return {
      dataURL,
      blob,
      mimeType: 'image/svg+xml',
      width: 400,
      height: 400,
      sizeBytes: blob.size,
    };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      try {
        const result = await compressCanvasSource(
          img,
          img.naturalWidth || img.width,
          img.naturalHeight || img.height,
          'image/webp',
          DEFAULT_QUALITY
        );
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (err) => {
      reject(new Error(`Falha ao carregar dataURL para otimização: ${err}`));
    };

    img.src = dataURL;
  });
}

/**
 * Uploads an image blob to Supabase Storage bucket `board-media`.
 * Returns the public URL if successful, or null on error / missing bucket.
 */
export async function uploadBoardImage(
  boardId: string,
  fileId: string,
  blobOrFile: Blob | File,
  mimeType: string = 'image/webp'
): Promise<string | null> {
  if (!boardId || !fileId || !blobOrFile) {
    return null;
  }

  try {
    const ext = mimeType.includes('webp')
      ? 'webp'
      : mimeType.includes('jpeg') || mimeType.includes('jpg')
      ? 'jpg'
      : mimeType.includes('svg')
      ? 'svg'
      : 'png';

    const safeBoardId = encodeURIComponent(boardId.trim());
    const safeFileId = encodeURIComponent(fileId.trim());
    const filePath = `${safeBoardId}/${safeFileId}.${ext}`;

    const { error } = await supabase.storage
      .from('board-media')
      .upload(filePath, blobOrFile, {
        contentType: mimeType,
        // Each image gets its own file id, so an existing object is a retry of the same image.
        // Upserting would need read access to the bucket, which only board owners have.
        upsert: false,
      });

    if (error && !isAlreadyUploaded(error)) {
      console.warn('Upload para storage board-media falhou (fallback dataURL ativo):', error.message);
      return null;
    }

    const { data } = supabase.storage
      .from('board-media')
      .getPublicUrl(filePath);

    return data?.publicUrl || null;
  } catch (err) {
    console.warn('Erro ao acessar storage do Supabase (fallback dataURL ativo):', err);
    return null;
  }
}

function isAlreadyUploaded(error: { message?: string; statusCode?: string }): boolean {
  return error.statusCode === '409' || /already exists|duplicate/i.test(error.message ?? '');
}

/**
 * Hybrid optimizer:
 * 1. Resizes and compresses image to WebP <= 1600px at 0.8 quality (< 150 KB).
 * 2. Attempts upload to Supabase Storage bucket `board-media`.
 * 3. Returns public URL if uploaded; otherwise graceful fallback to compressed dataURL.
 */
export async function optimizeAndUploadImage(
  boardId: string,
  fileId: string,
  input: File | Blob | string
): Promise<OptimizedUploadResult> {
  // If already an HTTP/HTTPS remote URL, no re-processing needed
  if (typeof input === 'string' && (input.startsWith('http://') || input.startsWith('https://'))) {
    return {
      dataURL: input,
      mimeType: 'image/webp',
      isRemote: true,
    };
  }

  try {
    let compressed: OptimizedImageResult;

    if (typeof input === 'string') {
      compressed = await compressDataURL(input);
    } else {
      compressed = await compressImageFile(input);
    }

    // Try uploading compressed blob to Supabase Storage
    const publicUrl = await uploadBoardImage(
      boardId,
      fileId,
      compressed.blob,
      compressed.mimeType
    );

    if (publicUrl) {
      return {
        dataURL: publicUrl,
        mimeType: compressed.mimeType,
        isRemote: true,
        width: compressed.width,
        height: compressed.height,
      };
    }

    // Graceful fallback: return compressed dataURL (small, < 150 KB)
    return {
      dataURL: compressed.dataURL,
      mimeType: compressed.mimeType,
      isRemote: false,
      width: compressed.width,
      height: compressed.height,
    };
  } catch (error) {
    console.warn('Falha na otimização de imagem, usando original como fallback:', error);
    if (typeof input === 'string') {
      return { dataURL: input, mimeType: 'image/png', isRemote: false };
    }
    const fallbackDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(input);
    });
    return { dataURL: fallbackDataUrl, mimeType: input.type || 'image/png', isRemote: false };
  }
}
