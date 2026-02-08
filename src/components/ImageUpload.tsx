"use client";

import React, { useCallback, useRef, useState } from "react";
import { Upload, ImageIcon } from "lucide-react";

interface ImageUploadProps {
  onImageLoad: (src: string) => void;
}

export default function ImageUpload({ onImageLoad }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) onImageLoad(result);
      };
      reader.readAsDataURL(file);
    },
    [onImageLoad]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) handleFile(file);
          break;
        }
      }
    },
    [handleFile]
  );

  React.useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  return (
    <div className="flex items-center justify-center h-full w-full p-8">
      <div
        className="relative w-full max-w-xl rounded-2xl p-12 text-center transition-all duration-300"
        style={{
          background: isDragging ? "var(--surface-hover)" : "var(--surface)",
          border: `2px dashed ${isDragging ? "var(--accent)" : "var(--border)"}`,
          boxShadow: isDragging ? "0 0 40px var(--accent-glow)" : "none",
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="flex flex-col items-center gap-5">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center transition-colors"
            style={{
              background: isDragging
                ? "var(--accent)"
                : "rgba(99, 102, 241, 0.1)",
            }}
          >
            {isDragging ? (
              <Upload size={28} color="#fff" />
            ) : (
              <ImageIcon size={28} style={{ color: "var(--accent)" }} />
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-1">
              {isDragging ? "Drop your image here" : "Upload an Image"}
            </h2>
            <p className="text-sm opacity-50">
              Drag & drop, paste from clipboard, or click to browse
            </p>
          </div>

          <button
            onClick={() => inputRef.current?.click()}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
            style={{
              background: "var(--accent)",
              color: "#fff",
              boxShadow: "0 4px 14px var(--accent-glow)",
            }}
          >
            Choose File
          </button>

          <p className="text-xs opacity-30 mt-1">
            Supports PNG, JPG, GIF, WebP, SVG
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleChange}
        />
      </div>
    </div>
  );
}
