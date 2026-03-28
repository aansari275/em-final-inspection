export async function compressImage(file: File, maxWidth = 1400, quality = 0.55): Promise<File> {
  // Skip non-image files
  if (!file.type.startsWith('image/')) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Skip if already small enough
      if (img.width <= maxWidth && file.size <= 500 * 1024) {
        resolve(file);
        return;
      }

      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    // 15s timeout with aggressive fallback
    const timeout = setTimeout(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;
      const ctx = canvas.getContext('2d');
      if (ctx && img.complete) {
        ctx.drawImage(img, 0, 0, 800, 600);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(new File([blob], file.name, { type: 'image/jpeg' }));
            else resolve(file);
          },
          'image/jpeg',
          0.4
        );
      } else {
        resolve(file);
      }
    }, 15000);

    img.addEventListener('load', () => clearTimeout(timeout), { once: true });
    img.src = url;
  });
}

// Upload timeout wrapper
export function withTimeout<T>(promise: Promise<T>, ms: number, label?: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout: ${label || 'operation'} exceeded ${ms}ms`)),
      ms
    );
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
