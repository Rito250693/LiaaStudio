import type { GalleryImage } from '../components/admin/ImageField';
import { apiFetch } from './apiClient';

const MAX_DIMENSION = 2200;
const WEBP_QUALITY = 0.88;
const MAX_RAW_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

export interface UploadResult {
  image: GalleryImage;
  originalBytes: number;
  finalBytes: number;
  optimized: boolean;
}

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen.'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo decodificar la imagen.'));
    img.src = src;
  });
}

/**
 * Optimizes heavy raster photos (PNG/JPG/WEBP) in-browser to high-quality WebP
 * (up to 2200px) so camera/design files of 10-50 MB upload fast and keep the site snappy.
 * Preserves SVG and GIF files untouched.
 */
async function prepareImageForUpload(file: File): Promise<{
  filename: string;
  dataUrl: string;
  optimized: boolean;
  finalBytes: number;
}> {
  const lower = file.name.toLowerCase();
  const isRasterOptimizable =
    file.type === 'image/jpeg' ||
    file.type === 'image/png' ||
    file.type === 'image/webp' ||
    /\.(jpe?g|png|webp)$/.test(lower);

  // Keep SVG, GIF, or already tiny files (< 350 KB) untouched
  if (!isRasterOptimizable || file.size < 350 * 1024) {
    const dataUrl = await readFileAsDataUrl(file);
    return { filename: file.name, dataUrl, optimized: false, finalBytes: file.size };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(objectUrl);
    let targetW = img.naturalWidth;
    let targetH = img.naturalHeight;

    if (targetW > MAX_DIMENSION || targetH > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / targetW, MAX_DIMENSION / targetH);
      targetW = Math.round(targetW * ratio);
      targetH = Math.round(targetH * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const dataUrl = await readFileAsDataUrl(file);
      return { filename: file.name, dataUrl, optimized: false, finalBytes: file.size };
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/webp', WEBP_QUALITY),
    );

    if (blob && blob.size < file.size) {
      const baseName = file.name.replace(/\.[^.]+$/, '');
      const dataUrl = await readFileAsDataUrl(blob);
      return {
        filename: `${baseName}.webp`,
        dataUrl,
        optimized: true,
        finalBytes: blob.size,
      };
    }

    const dataUrl = await readFileAsDataUrl(file);
    return { filename: file.name, dataUrl, optimized: false, finalBytes: file.size };
  } catch {
    // Fallback to raw upload if canvas decoding fails
    const dataUrl = await readFileAsDataUrl(file);
    return { filename: file.name, dataUrl, optimized: false, finalBytes: file.size };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export async function uploadAdminImage(file: File): Promise<UploadResult> {
  if (file.size > MAX_RAW_UPLOAD_BYTES) {
    throw new Error('El archivo supera el límite máximo de 50 MB.');
  }

  const prepared = await prepareImageForUpload(file);

  const res = await apiFetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: prepared.filename,
      dataUrl: prepared.dataUrl,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al subir la imagen.');
  }

  return {
    image: data.image as GalleryImage,
    originalBytes: file.size,
    finalBytes: prepared.finalBytes,
    optimized: prepared.optimized,
  };
}
