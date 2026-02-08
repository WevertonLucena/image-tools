import { SelectionRect, RGBColor } from "@/types";
import { normalizeRect, getHandlePositions, HANDLE_SIZE } from "./geometry";

export function drawEditor(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
  offsetX: number,
  offsetY: number,
  selection: SelectionRect | null
) {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Draw image
  ctx.drawImage(
    image,
    offsetX,
    offsetY,
    image.naturalWidth * scale,
    image.naturalHeight * scale
  );

  if (!selection) return;

  const sel = normalizeRect(selection);

  // Draw dark overlay outside selection
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";

  // Top
  ctx.fillRect(0, 0, canvasWidth, sel.y);
  // Bottom
  ctx.fillRect(0, sel.y + sel.height, canvasWidth, canvasHeight - sel.y - sel.height);
  // Left
  ctx.fillRect(0, sel.y, sel.x, sel.height);
  // Right
  ctx.fillRect(sel.x + sel.width, sel.y, canvasWidth - sel.x - sel.width, sel.height);

  // Draw selection border
  ctx.strokeStyle = "#6366f1";
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.strokeRect(sel.x, sel.y, sel.width, sel.height);

  // Draw dashed inner guides (rule of thirds)
  if (sel.width > 60 && sel.height > 60) {
    ctx.strokeStyle = "rgba(99, 102, 241, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    const thirdW = sel.width / 3;
    const thirdH = sel.height / 3;

    for (let i = 1; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(sel.x + thirdW * i, sel.y);
      ctx.lineTo(sel.x + thirdW * i, sel.y + sel.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(sel.x, sel.y + thirdH * i);
      ctx.lineTo(sel.x + sel.width, sel.y + thirdH * i);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // Draw resize handles
  const handles = getHandlePositions(selection);
  ctx.fillStyle = "#6366f1";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;

  Object.values(handles).forEach((pos) => {
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, HANDLE_SIZE / 2 + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // Draw size label
  if (sel.width > 20 && sel.height > 20) {
    const labelText = `${Math.round(sel.width / scale)} × ${Math.round(sel.height / scale)}`;
    ctx.font = "12px monospace";
    const metrics = ctx.measureText(labelText);
    const labelW = metrics.width + 12;
    const labelH = 22;
    let labelX = sel.x + sel.width / 2 - labelW / 2;
    let labelY = sel.y - labelH - 6;

    if (labelY < 4) {
      labelY = sel.y + 6;
    }

    ctx.fillStyle = "rgba(99, 102, 241, 0.9)";
    ctx.beginPath();
    ctx.roundRect(labelX, labelY, labelW, labelH, 4);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(labelText, labelX + labelW / 2, labelY + labelH / 2);
  }
}

export function cropImage(
  image: HTMLImageElement,
  selection: SelectionRect,
  scale: number,
  offsetX: number,
  offsetY: number
): string {
  const sel = normalizeRect(selection);

  // Convert canvas coordinates to image coordinates
  const srcX = (sel.x - offsetX) / scale;
  const srcY = (sel.y - offsetY) / scale;
  const srcW = sel.width / scale;
  const srcH = sel.height / scale;

  // Clamp to image bounds
  const clampedX = Math.max(0, srcX);
  const clampedY = Math.max(0, srcY);
  const clampedW = Math.min(srcW, image.naturalWidth - clampedX);
  const clampedH = Math.min(srcH, image.naturalHeight - clampedY);

  const offscreen = document.createElement("canvas");
  offscreen.width = Math.round(clampedW);
  offscreen.height = Math.round(clampedH);

  const ctx = offscreen.getContext("2d")!;
  ctx.drawImage(
    image,
    Math.round(clampedX),
    Math.round(clampedY),
    Math.round(clampedW),
    Math.round(clampedH),
    0,
    0,
    Math.round(clampedW),
    Math.round(clampedH)
  );

  return offscreen.toDataURL("image/png");
}

export function getPixelColor(
  image: HTMLImageElement,
  canvasX: number,
  canvasY: number,
  scale: number,
  offsetX: number,
  offsetY: number
): RGBColor | null {
  const imgX = Math.round((canvasX - offsetX) / scale);
  const imgY = Math.round((canvasY - offsetY) / scale);

  if (imgX < 0 || imgY < 0 || imgX >= image.naturalWidth || imgY >= image.naturalHeight) {
    return null;
  }

  const offscreen = document.createElement("canvas");
  offscreen.width = image.naturalWidth;
  offscreen.height = image.naturalHeight;
  const ctx = offscreen.getContext("2d")!;
  ctx.drawImage(image, 0, 0);

  const pixel = ctx.getImageData(imgX, imgY, 1, 1).data;
  return { r: pixel[0], g: pixel[1], b: pixel[2] };
}

export function detectBackgroundColor(image: HTMLImageElement): RGBColor {
  const offscreen = document.createElement("canvas");
  offscreen.width = image.naturalWidth;
  offscreen.height = image.naturalHeight;
  const ctx = offscreen.getContext("2d")!;
  ctx.drawImage(image, 0, 0);

  // Sample pixels from the edges of the image
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  const sampleCount = Math.min(200, (w + h) * 2);
  const colors: RGBColor[] = [];

  const addSample = (x: number, y: number) => {
    const cx = Math.max(0, Math.min(w - 1, Math.round(x)));
    const cy = Math.max(0, Math.min(h - 1, Math.round(y)));
    const pixel = ctx.getImageData(cx, cy, 1, 1).data;
    colors.push({ r: pixel[0], g: pixel[1], b: pixel[2] });
  };

  const step = Math.max(1, Math.floor((w + h) * 2 / sampleCount));
  for (let i = 0; i < w; i += step) {
    addSample(i, 0);
    addSample(i, h - 1);
  }
  for (let i = 0; i < h; i += step) {
    addSample(0, i);
    addSample(w - 1, i);
  }

  // Find the most common color (simple bucketing)
  const bucketSize = 16;
  const buckets = new Map<string, { count: number; totalR: number; totalG: number; totalB: number }>();

  for (const c of colors) {
    const key = `${Math.floor(c.r / bucketSize)},${Math.floor(c.g / bucketSize)},${Math.floor(c.b / bucketSize)}`;
    const bucket = buckets.get(key) || { count: 0, totalR: 0, totalG: 0, totalB: 0 };
    bucket.count++;
    bucket.totalR += c.r;
    bucket.totalG += c.g;
    bucket.totalB += c.b;
    buckets.set(key, bucket);
  }

  let bestBucket = { count: 0, totalR: 255, totalG: 255, totalB: 255 };
  for (const bucket of buckets.values()) {
    if (bucket.count > bestBucket.count) {
      bestBucket = bucket;
    }
  }

  return {
    r: Math.round(bestBucket.totalR / bestBucket.count),
    g: Math.round(bestBucket.totalG / bestBucket.count),
    b: Math.round(bestBucket.totalB / bestBucket.count),
  };
}

export function removeBackground(
  image: HTMLImageElement,
  targetColor: RGBColor,
  tolerance: number
): string {
  const offscreen = document.createElement("canvas");
  offscreen.width = image.naturalWidth;
  offscreen.height = image.naturalHeight;
  const ctx = offscreen.getContext("2d")!;
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const distance = Math.sqrt(
      (r - targetColor.r) ** 2 +
      (g - targetColor.g) ** 2 +
      (b - targetColor.b) ** 2
    );

    // Max possible distance is ~441 (sqrt(255^2 * 3))
    const maxDistance = 441;
    const threshold = (tolerance / 100) * maxDistance;

    if (distance <= threshold) {
      // Fully transparent for colors within threshold
      const alpha = distance <= threshold * 0.7
        ? 0
        : Math.round(255 * ((distance - threshold * 0.7) / (threshold * 0.3)));
      data[i + 3] = alpha;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return offscreen.toDataURL("image/png");
}
