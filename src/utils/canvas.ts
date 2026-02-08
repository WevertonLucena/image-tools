import { SelectionRect } from "@/types";
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
