"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { SelectionRect, ResizeHandle, InteractionMode, RGBColor } from "@/types";
import {
  normalizeRect,
  hitTestHandle,
  hitTestSelection,
  getResizeCursor,
  applyResize,
} from "@/utils/geometry";
import { drawEditor, cropImage, getPixelColor, detectBackgroundColor, removeBackground, resizeImage } from "@/utils/canvas";
import { Crop, Download, RotateCcw, X, Eraser, Pipette, Wand2, Scaling, Lock, Unlock } from "lucide-react";

interface ImageEditorProps {
  imageSrc: string;
  onReset: () => void;
}

export default function ImageEditor({ imageSrc, onReset }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("idle");
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [cursorStyle, setCursorStyle] = useState("crosshair");
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [imageLayout, setImageLayout] = useState({ scale: 1, offsetX: 0, offsetY: 0 });
  const [removeBgMode, setRemoveBgMode] = useState(false);
  const [pickingColor, setPickingColor] = useState(false);
  const [bgColor, setBgColor] = useState<RGBColor | null>(null);
  const [tolerance, setTolerance] = useState(10);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [resizeMode, setResizeMode] = useState(false);
  const [resizeWidth, setResizeWidth] = useState(0);
  const [resizeHeight, setResizeHeight] = useState(0);
  const [lockAspect, setLockAspect] = useState(true);
  const [aspectRatio, setAspectRatio] = useState(1);

  const dragStart = useRef({ x: 0, y: 0 });
  const selectionStart = useRef<SelectionRect | null>(null);

  // Load image and compute layout
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      computeLayout(img);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const computeLayout = useCallback((img: HTMLImageElement) => {
    const container = containerRef.current;
    if (!container) return;

    const containerW = container.clientWidth;
    const containerH = container.clientHeight;

    const scaleX = containerW / img.naturalWidth;
    const scaleY = containerH / img.naturalHeight;
    const scale = Math.min(scaleX, scaleY, 1);

    const displayW = img.naturalWidth * scale;
    const displayH = img.naturalHeight * scale;

    const offsetX = (containerW - displayW) / 2;
    const offsetY = (containerH - displayH) / 2;

    setCanvasSize({ width: containerW, height: containerH });
    setImageLayout({ scale, offsetX, offsetY });
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (imageRef.current) {
        setSelection(null);
        computeLayout(imageRef.current);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [computeLayout]);

  // Redraw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawEditor(
      ctx,
      img,
      canvasSize.width,
      canvasSize.height,
      imageLayout.scale,
      imageLayout.offsetX,
      imageLayout.offsetY,
      selection
    );
  }, [canvasSize, imageLayout, selection]);

  const getCanvasCoords = (e: React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (croppedImage || processedImage) return;
    if (resizeMode) return;

    // Color picking mode for background removal
    if (removeBgMode && pickingColor) {
      const pos = getCanvasCoords(e);
      const img = imageRef.current;
      if (!img) return;
      const color = getPixelColor(img, pos.x, pos.y, imageLayout.scale, imageLayout.offsetX, imageLayout.offsetY);
      if (color) {
        setBgColor(color);
        setPickingColor(false);
      }
      return;
    }

    if (removeBgMode) return;

    const pos = getCanvasCoords(e);
    dragStart.current = pos;

    if (selection) {
      const handle = hitTestHandle(selection, pos.x, pos.y);
      if (handle) {
        setInteractionMode("resizing");
        setActiveHandle(handle);
        selectionStart.current = { ...normalizeRect(selection) };
        return;
      }

      if (hitTestSelection(selection, pos.x, pos.y)) {
        setInteractionMode("moving");
        selectionStart.current = { ...normalizeRect(selection) };
        return;
      }
    }

    // Start new selection
    setInteractionMode("drawing");
    setSelection({ x: pos.x, y: pos.y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (croppedImage || processedImage) return;
    if (resizeMode) return;
    if (removeBgMode && pickingColor) {
      setCursorStyle("crosshair");
      return;
    }
    if (removeBgMode) return;
    const pos = getCanvasCoords(e);

    if (interactionMode === "idle") {
      // Update cursor based on hover
      if (selection) {
        const handle = hitTestHandle(selection, pos.x, pos.y);
        if (handle) {
          setCursorStyle(getResizeCursor(handle));
          return;
        }
        if (hitTestSelection(selection, pos.x, pos.y)) {
          setCursorStyle("move");
          return;
        }
      }
      setCursorStyle("crosshair");
      return;
    }

    const dx = pos.x - dragStart.current.x;
    const dy = pos.y - dragStart.current.y;

    if (interactionMode === "drawing") {
      setSelection((prev) =>
        prev ? { ...prev, width: dx, height: dy } : null
      );
    } else if (interactionMode === "moving" && selectionStart.current) {
      const s = selectionStart.current;
      setSelection({
        x: s.x + dx,
        y: s.y + dy,
        width: s.width,
        height: s.height,
      });
    } else if (interactionMode === "resizing" && activeHandle && selectionStart.current) {
      const newRect = applyResize(selectionStart.current, activeHandle, dx, dy);
      setSelection(newRect);
    }
  };

  const handleMouseUp = () => {
    if (interactionMode === "drawing" && selection) {
      const n = normalizeRect(selection);
      if (n.width < 5 || n.height < 5) {
        setSelection(null);
      } else {
        setSelection(n);
      }
    }
    setInteractionMode("idle");
    setActiveHandle(null);
    selectionStart.current = null;
  };

  const handleCrop = () => {
    const img = imageRef.current;
    if (!img || !selection) return;

    const dataUrl = cropImage(
      img,
      selection,
      imageLayout.scale,
      imageLayout.offsetX,
      imageLayout.offsetY
    );
    setCroppedImage(dataUrl);
  };

  const handleDownload = () => {
    if (!croppedImage) return;
    const link = document.createElement("a");
    link.download = "cropped-image.png";
    link.href = croppedImage;
    link.click();
  };

  const handleClearSelection = () => {
    setSelection(null);
    setCroppedImage(null);
    setProcessedImage(null);
  };

  const handleEnterRemoveBg = () => {
    setRemoveBgMode(true);
    setSelection(null);
    setCroppedImage(null);
    setProcessedImage(null);
    // Auto-detect background color
    const img = imageRef.current;
    if (img) {
      const detected = detectBackgroundColor(img);
      setBgColor(detected);
    }
  };

  const handleExitRemoveBg = () => {
    setRemoveBgMode(false);
    setPickingColor(false);
    setBgColor(null);
    setProcessedImage(null);
    // Re-render canvas with the original image
    const img = imageRef.current;
    if (img) computeLayout(img);
  };

  const handleApplyRemoveBg = () => {
    const img = imageRef.current;
    if (!img || !bgColor) return;
    const result = removeBackground(img, bgColor, tolerance);
    setProcessedImage(result);
  };

  const handleUseProcessed = () => {
    if (!processedImage) return;
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setProcessedImage(null);
      setRemoveBgMode(false);
      setBgColor(null);
      setPickingColor(false);
      computeLayout(img);
    };
    img.src = processedImage;
  };

  const handleDownloadProcessed = () => {
    if (!processedImage) return;
    const link = document.createElement("a");
    link.download = "transparent-bg.png";
    link.href = processedImage;
    link.click();
  };

  const handleEnterResize = () => {
    const img = imageRef.current;
    if (!img) return;
    setResizeMode(true);
    setSelection(null);
    setCroppedImage(null);
    setProcessedImage(null);
    setResizeWidth(img.naturalWidth);
    setResizeHeight(img.naturalHeight);
    setAspectRatio(img.naturalWidth / img.naturalHeight);
    setLockAspect(true);
  };

  const handleExitResize = () => {
    setResizeMode(false);
    const img = imageRef.current;
    if (img) computeLayout(img);
  };

  const handleResizeWidthChange = (val: number) => {
    const w = Math.max(1, val);
    setResizeWidth(w);
    if (lockAspect) {
      setResizeHeight(Math.round(w / aspectRatio));
    }
  };

  const handleResizeHeightChange = (val: number) => {
    const h = Math.max(1, val);
    setResizeHeight(h);
    if (lockAspect) {
      setResizeWidth(Math.round(h * aspectRatio));
    }
  };

  const handleApplyResize = () => {
    const img = imageRef.current;
    if (!img || resizeWidth < 1 || resizeHeight < 1) return;
    const result = resizeImage(img, resizeWidth, resizeHeight);
    setProcessedImage(result);
  };

  const handleDownloadResized = () => {
    if (!processedImage) return;
    const link = document.createElement("a");
    link.download = "resized-image.png";
    link.href = processedImage;
    link.click();
  };

  const handleUseResized = () => {
    if (!processedImage) return;
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setProcessedImage(null);
      setResizeMode(false);
      computeLayout(img);
    };
    img.src = processedImage;
  };

  const handleUseCropped = () => {
    if (!croppedImage) return;
    // Load the cropped image as the new working image
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setSelection(null);
      setCroppedImage(null);
      computeLayout(img);
    };
    img.src = croppedImage;
  };

  const selNorm = selection ? normalizeRect(selection) : null;
  const hasValidSelection = selNorm && selNorm.width > 5 && selNorm.height > 5;
  const showingResult = croppedImage || processedImage;
  const resultImage = croppedImage || processedImage;
  const resultLabel = croppedImage
    ? "Cropped Result"
    : resizeMode
      ? "Resized Image"
      : "Transparent Background";
  const activeMode = removeBgMode ? "bg" : resizeMode ? "resize" : "default";

  return (
    <div className="flex flex-col h-full w-full">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-wide opacity-70 uppercase">
            {removeBgMode ? "Remove Background" : resizeMode ? "Resize Image" : "Editor"}
          </h2>
          {hasValidSelection && !showingResult && !removeBgMode && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-mono"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {Math.round(selNorm!.width / imageLayout.scale)} ×{" "}
              {Math.round(selNorm!.height / imageLayout.scale)}px
            </span>
          )}
          {removeBgMode && bgColor && !processedImage && (
            <div className="flex items-center gap-2">
              <div
                className="w-5 h-5 rounded border"
                style={{
                  backgroundColor: `rgb(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`,
                  borderColor: "var(--border)",
                }}
                title={`RGB(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`}
              />
              <span className="text-xs font-mono opacity-60">
                RGB({bgColor.r}, {bgColor.g}, {bgColor.b})
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {showingResult ? (
            <>
              <button
                onClick={
                  croppedImage
                    ? handleUseCropped
                    : resizeMode
                      ? handleUseResized
                      : handleUseProcessed
                }
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                }}
                title="Use result as new source"
              >
                {croppedImage ? <Crop size={15} /> : resizeMode ? <Scaling size={15} /> : <Eraser size={15} />}
                Use as Source
              </button>
              <button
                onClick={
                  croppedImage
                    ? handleDownload
                    : resizeMode
                      ? handleDownloadResized
                      : handleDownloadProcessed
                }
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: "var(--success)",
                  color: "#fff",
                }}
              >
                <Download size={15} />
                Download
              </button>
              <button
                onClick={() => {
                  handleClearSelection();
                  if (resizeMode) handleExitResize();
                  else if (processedImage) handleExitRemoveBg();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: "var(--surface-hover)",
                  color: "var(--foreground)",
                }}
              >
                <X size={15} />
                Cancel
              </button>
            </>
          ) : resizeMode ? (
            <>
              <div className="flex items-center gap-2">
                <label className="text-xs opacity-50">W</label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={resizeWidth}
                  onChange={(e) => handleResizeWidthChange(Number(e.target.value))}
                  className="w-20 px-2 py-1 rounded-lg text-sm font-mono text-center outline-none"
                  style={{
                    background: "var(--background)",
                    color: "var(--foreground)",
                    border: "1px solid var(--border)",
                  }}
                />
                <button
                  onClick={() => setLockAspect(!lockAspect)}
                  className="p-1 rounded transition-all"
                  style={{
                    color: lockAspect ? "var(--accent)" : "var(--foreground)",
                    opacity: lockAspect ? 1 : 0.4,
                  }}
                  title={lockAspect ? "Aspect ratio locked" : "Aspect ratio unlocked"}
                >
                  {lockAspect ? <Lock size={14} /> : <Unlock size={14} />}
                </button>
                <label className="text-xs opacity-50">H</label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={resizeHeight}
                  onChange={(e) => handleResizeHeightChange(Number(e.target.value))}
                  className="w-20 px-2 py-1 rounded-lg text-sm font-mono text-center outline-none"
                  style={{
                    background: "var(--background)",
                    color: "var(--foreground)",
                    border: "1px solid var(--border)",
                  }}
                />
                <span className="text-xs opacity-40">px</span>
              </div>
              {imageRef.current && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const img = imageRef.current!;
                      handleResizeWidthChange(Math.round(img.naturalWidth / 2));
                    }}
                    className="px-2 py-1 rounded-lg text-xs font-medium transition-all"
                    style={{ background: "var(--surface-hover)", color: "var(--foreground)" }}
                    title="50% of original"
                  >
                    50%
                  </button>
                  <button
                    onClick={() => {
                      const img = imageRef.current!;
                      handleResizeWidthChange(Math.round(img.naturalWidth / 4));
                    }}
                    className="px-2 py-1 rounded-lg text-xs font-medium transition-all"
                    style={{ background: "var(--surface-hover)", color: "var(--foreground)" }}
                    title="25% of original"
                  >
                    25%
                  </button>
                </div>
              )}
              <button
                onClick={handleApplyResize}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:brightness-110"
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                }}
              >
                <Scaling size={15} />
                Apply
              </button>
              <button
                onClick={handleExitResize}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: "var(--surface-hover)",
                  color: "var(--foreground)",
                }}
              >
                <X size={15} />
                Cancel
              </button>
            </>
          ) : removeBgMode ? (
            <>
              <button
                onClick={() => setPickingColor(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: pickingColor ? "var(--accent)" : "var(--surface-hover)",
                  color: pickingColor ? "#fff" : "var(--foreground)",
                  boxShadow: pickingColor ? "0 0 12px var(--accent-glow)" : "none",
                }}
                title="Click on the image to pick the background color"
              >
                <Pipette size={15} />
                Pick Color
              </button>
              <button
                onClick={() => {
                  const img = imageRef.current;
                  if (img) setBgColor(detectBackgroundColor(img));
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: "var(--surface-hover)",
                  color: "var(--foreground)",
                }}
                title="Auto-detect background color from image edges"
              >
                <Wand2 size={15} />
                Auto Detect
              </button>
              <div className="flex items-center gap-2 px-2">
                <span className="text-xs opacity-50 whitespace-nowrap">Tolerance</span>
                <input
                  type="range"
                  min="1"
                  max="60"
                  value={tolerance}
                  onChange={(e) => setTolerance(Number(e.target.value))}
                  className="w-24 accent-[#6366f1]"
                />
                <span className="text-xs font-mono w-6 text-right opacity-70">{tolerance}</span>
              </div>
              {bgColor && (
                <button
                  onClick={handleApplyRemoveBg}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:brightness-110"
                  style={{
                    background: "var(--accent)",
                    color: "#fff",
                  }}
                >
                  <Eraser size={15} />
                  Apply
                </button>
              )}
              <button
                onClick={handleExitRemoveBg}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: "var(--surface-hover)",
                  color: "var(--foreground)",
                }}
              >
                <X size={15} />
                Cancel
              </button>
            </>
          ) : (
            <>
              {hasValidSelection && (
                <>
                  <button
                    onClick={handleCrop}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:brightness-110"
                    style={{
                      background: "var(--accent)",
                      color: "#fff",
                    }}
                  >
                    <Crop size={15} />
                    Crop
                  </button>
                  <button
                    onClick={handleClearSelection}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: "var(--surface-hover)",
                      color: "var(--foreground)",
                    }}
                  >
                    <X size={15} />
                    Clear
                  </button>
                </>
              )}
              <div
                className="w-px h-5 mx-1"
                style={{ background: "var(--border)" }}
              />
              <button
                onClick={handleEnterRemoveBg}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: "var(--surface-hover)",
                  color: "var(--foreground)",
                }}
                title="Remove background color and make it transparent"
              >
                <Eraser size={15} />
                Transparent BG
              </button>
              <button
                onClick={handleEnterResize}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: "var(--surface-hover)",
                  color: "var(--foreground)",
                }}
                title="Resize the image dimensions"
              >
                <Scaling size={15} />
                Resize
              </button>
              <button
                onClick={onReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: "var(--surface-hover)",
                  color: "var(--foreground)",
                }}
                title="Load a different image"
              >
                <RotateCcw size={15} />
                New Image
              </button>
            </>
          )}
        </div>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        style={{ background: "#0c0c10" }}
      >
        {!showingResult ? (
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            style={{ cursor: removeBgMode && pickingColor ? "crosshair" : cursorStyle }}
            className="absolute inset-0"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        ) : (
          <div className="flex items-center justify-center h-full p-8">
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm opacity-60 font-medium">{resultLabel}</p>
              <div
                className="rounded-lg shadow-2xl overflow-hidden"
                style={{
                  border: "2px solid var(--border)",
                  backgroundImage: processedImage
                    ? "repeating-conic-gradient(#808080 0% 25%, #c0c0c0 0% 50%)"
                    : "none",
                  backgroundSize: processedImage ? "16px 16px" : "auto",
                  backgroundColor: processedImage ? "transparent" : "var(--surface)",
                }}
              >
                <img
                  src={resultImage!}
                  alt="Result"
                  className="max-w-full max-h-[70vh]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Instructions overlay */}
        {!showingResult && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
            <div
              className="px-4 py-2 rounded-full text-xs font-medium backdrop-blur-sm"
              style={{
                background: "rgba(99, 102, 241, 0.15)",
                color: "var(--accent-hover)",
                border: "1px solid rgba(99, 102, 241, 0.2)",
              }}
            >
              {removeBgMode
                ? pickingColor
                  ? "Click on the color you want to make transparent"
                  : "Pick a color or use Auto Detect, then adjust tolerance and Apply"
                : resizeMode
                  ? "Set the desired dimensions and click Apply"
                  : !selection
                    ? "Click and drag to select an area to crop"
                    : "Drag to move, use handles to resize, or click outside to draw a new selection"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
