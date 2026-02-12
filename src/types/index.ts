export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ResizeHandle =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "top"
  | "bottom"
  | "left"
  | "right";

export type InteractionMode = "idle" | "drawing" | "moving" | "resizing";

export interface EditorState {
  image: HTMLImageElement | null;
  imageSrc: string | null;
  selection: SelectionRect | null;
  interactionMode: InteractionMode;
  activeHandle: ResizeHandle | null;
}

export type ImageAction = "crop" | "remove-bg" | "resize";

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}
