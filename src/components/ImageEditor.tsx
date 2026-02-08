"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { SelectionRect, ResizeHandle, InteractionMode } from "@/types";
import {
  normalizeRect,
  hitTestHandle,
  hitTestSelection,
  getResizeCursor,
  applyResize,
} from "@/utils/geometry";
import { drawEditor, cropImage } from "@/utils/canvas";
import { Crop, Download, RotateCcw, X } from "lucide-react";

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
    if (croppedImage) return;
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
    if (croppedImage) return;
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

  return (
    <div className="flex flex-col h-full w-full">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-wide opacity-70 uppercase">
            Editor
          </h2>
          {hasValidSelection && !croppedImage && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-mono"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {Math.round(selNorm!.width / imageLayout.scale)} ×{" "}
              {Math.round(selNorm!.height / imageLayout.scale)}px
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {croppedImage ? (
            <>
              <button
                onClick={handleUseCropped}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                }}
                title="Use cropped image as new source"
              >
                <Crop size={15} />
                Use as Source
              </button>
              <button
                onClick={handleDownload}
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
                onClick={handleClearSelection}
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
        {!croppedImage ? (
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            style={{ cursor: cursorStyle }}
            className="absolute inset-0"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        ) : (
          <div className="flex items-center justify-center h-full p-8">
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm opacity-60 font-medium">Cropped Result</p>
              <img
                src={croppedImage}
                alt="Cropped"
                className="max-w-full max-h-[70vh] rounded-lg shadow-2xl"
                style={{ border: "2px solid var(--border)" }}
              />
            </div>
          </div>
        )}

        {/* Instructions overlay */}
        {!selection && !croppedImage && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
            <div
              className="px-4 py-2 rounded-full text-xs font-medium backdrop-blur-sm"
              style={{
                background: "rgba(99, 102, 241, 0.15)",
                color: "var(--accent-hover)",
                border: "1px solid rgba(99, 102, 241, 0.2)",
              }}
            >
              Click and drag to select an area to crop
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
