"use client";

import AudioConverter from "@/components/AudioConverter";
import { Music, ImageIcon } from "lucide-react";
import Link from "next/link";

export default function AudioPage() {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {/* Header */}
      <header
        className="flex items-center justify-between px-5 py-3 border-b shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent)" }}
          >
            <Music size={16} color="#fff" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">Audio Converter</h1>
            <p className="text-[11px] opacity-40">MP3 to WAV · Mono · 16-bit PCM</p>
          </div>
        </div>
        <Link
          href="/"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
          style={{
            background: "var(--surface-hover)",
            color: "var(--foreground)",
          }}
        >
          <ImageIcon size={15} />
          Image Tools
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <AudioConverter />
      </main>
    </div>
  );
}
