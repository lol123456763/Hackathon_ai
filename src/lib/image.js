// Client-side image prep: shrink photos before upload, and rasterize the sample illustration.
export async function fileToJpegDataUrl(file, maxSide = 1024, quality = 0.82) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return drawToDataUrl(img, maxSide, 'image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function urlToPngDataUrl(src, maxSide = 1024) {
  const img = await loadImage(src);
  return drawToDataUrl(img, maxSide, 'image/png');
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawToDataUrl(img, maxSide, type, quality) {
  const w = img.naturalWidth || img.width || 1024;
  const h = img.naturalHeight || img.height || 768;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(type, quality);
}
