import { SelectionRect, ResizeHandle } from "@/types";

const HANDLE_SIZE = 8;
const HANDLE_HIT_SIZE = 14;

export function normalizeRect(rect: SelectionRect): SelectionRect {
  return {
    x: rect.width < 0 ? rect.x + rect.width : rect.x,
    y: rect.height < 0 ? rect.y + rect.height : rect.y,
    width: Math.abs(rect.width),
    height: Math.abs(rect.height),
  };
}

export function getHandlePositions(rect: SelectionRect) {
  const n = normalizeRect(rect);
  return {
    "top-left": { x: n.x, y: n.y },
    "top": { x: n.x + n.width / 2, y: n.y },
    "top-right": { x: n.x + n.width, y: n.y },
    "right": { x: n.x + n.width, y: n.y + n.height / 2 },
    "bottom-right": { x: n.x + n.width, y: n.y + n.height },
    "bottom": { x: n.x + n.width / 2, y: n.y + n.height },
    "bottom-left": { x: n.x, y: n.y + n.height },
    "left": { x: n.x, y: n.y + n.height / 2 },
  };
}

export function hitTestHandle(
  rect: SelectionRect,
  px: number,
  py: number
): ResizeHandle | null {
  const handles = getHandlePositions(rect);
  const entries = Object.entries(handles) as [
    ResizeHandle,
    { x: number; y: number }
  ][];

  for (const [handle, pos] of entries) {
    if (
      Math.abs(px - pos.x) <= HANDLE_HIT_SIZE &&
      Math.abs(py - pos.y) <= HANDLE_HIT_SIZE
    ) {
      return handle;
    }
  }
  return null;
}

export function hitTestSelection(
  rect: SelectionRect,
  px: number,
  py: number
): boolean {
  const n = normalizeRect(rect);
  return (
    px >= n.x && px <= n.x + n.width && py >= n.y && py <= n.y + n.height
  );
}

export function getResizeCursor(handle: ResizeHandle): string {
  const cursors: Record<ResizeHandle, string> = {
    "top-left": "nwse-resize",
    "top-right": "nesw-resize",
    "bottom-left": "nesw-resize",
    "bottom-right": "nwse-resize",
    "top": "ns-resize",
    "bottom": "ns-resize",
    "left": "ew-resize",
    "right": "ew-resize",
  };
  return cursors[handle];
}

export function applyResize(
  original: SelectionRect,
  handle: ResizeHandle,
  dx: number,
  dy: number
): SelectionRect {
  const n = normalizeRect(original);
  let { x, y, width, height } = n;

  switch (handle) {
    case "top-left":
      x += dx;
      y += dy;
      width -= dx;
      height -= dy;
      break;
    case "top":
      y += dy;
      height -= dy;
      break;
    case "top-right":
      y += dy;
      width += dx;
      height -= dy;
      break;
    case "right":
      width += dx;
      break;
    case "bottom-right":
      width += dx;
      height += dy;
      break;
    case "bottom":
      height += dy;
      break;
    case "bottom-left":
      x += dx;
      width -= dx;
      height += dy;
      break;
    case "left":
      x += dx;
      width -= dx;
      break;
  }

  return { x, y, width, height };
}

export { HANDLE_SIZE };
