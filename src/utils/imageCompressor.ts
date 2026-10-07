/**
 * Utilitário de Compressão e Redimensionamento de Imagens Client-Side via HTML5 Canvas
 * 
 * Regra:
 * - Redimensiona para no máximo 1200px (largura ou altura) preservando o aspect-ratio original.
 * - Converte automaticamente para WebP (com fallback para JPEG) com qualidade 80% (0.8).
 * - Reduz fotos de celulares (10MB-20MB) para ~80KB-180KB, evitando travamentos de rede e loops infinitos.
 */

export interface CompressedImageResult {
  blob: Blob;
  file: File;
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
}

export async function compressProductImage(
  file: File,
  maxDimension: number = 1200,
  quality: number = 0.8
): Promise<CompressedImageResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('O arquivo selecionado não é uma imagem válida.');
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Não foi possível ler os dados da imagem.'));
      image.src = objectUrl;
    });

    let width = img.naturalWidth || img.width || 1200;
    let height = img.naturalHeight || img.height || 1200;

    // Redimensionamento proporcional (máximo 1200px)
    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Falha ao inicializar o Canvas 2D para processamento da imagem.');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    // Conversão para WebP 80% (com fallback para JPEG caso WebP não retorne blob)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (webpBlob) => {
          if (webpBlob && webpBlob.size > 0) {
            resolve(webpBlob);
          } else {
            canvas.toBlob(
              (jpegBlob) => {
                if (jpegBlob && jpegBlob.size > 0) {
                  resolve(jpegBlob);
                } else {
                  reject(new Error('Falha na conversão da imagem pelo Canvas.'));
                }
              },
              'image/jpeg',
              quality
            );
          }
        },
        'image/webp',
        quality
      );
    });

    const isWebP = blob.type === 'image/webp';
    const originalNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    const cleanBaseName = originalNameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, '_');
    const extension = isWebP ? 'webp' : 'jpg';
    const outputFileName = `${cleanBaseName}.${extension}`;

    const compressedFile = new File([blob], outputFileName, {
      type: blob.type,
      lastModified: Date.now()
    });

    return {
      blob,
      file: compressedFile,
      fileName: outputFileName,
      mimeType: blob.type,
      width,
      height
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
