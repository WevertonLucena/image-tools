"use client";

import { useState } from "react";
import ImageUpload from "@/components/ImageUpload";
import ImageEditor from "@/components/ImageEditor";
import { ImageIcon } from "lucide-react";

export default function Home() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {/* Header */}
      <header
        className="flex items-center gap-3 px-5 py-3 border-b shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "var(--accent)" }}
        >
          <ImageIcon size={16} color="#fff" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight">Image Handler</h1>
          <p className="text-[11px] opacity-40">Crop & process your images</p>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {imageSrc ? (
          <ImageEditor
            imageSrc={imageSrc}
            onReset={() => setImageSrc(null)}
          />
        ) : (
          <ImageUpload onImageLoad={setImageSrc} />
        )}
      </main>
    </div>
  );
}
