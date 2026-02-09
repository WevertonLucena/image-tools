"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  Upload,
  Music,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import {
  convertMP3ToWAV,
  formatDuration,
  formatFileSize,
  SampleRate,
} from "@/utils/audio";

type ConversionState = "idle" | "loaded" | "converting" | "done" | "error";

interface AudioInfo {
  name: string;
  size: number;
  duration: number;
}

export default function AudioConverter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [audioInfo, setAudioInfo] = useState<AudioInfo | null>(null);
  const [sampleRate, setSampleRate] = useState<SampleRate>(44100);
  const [state, setState] = useState<ConversionState>("idle");
  const [wavBlob, setWavBlob] = useState<Blob | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleFile = useCallback(async (f: File) => {
    if (!f.type.startsWith("audio/") && !f.name.endsWith(".mp3")) {
      setErrorMsg("Please select an MP3 file.");
      setState("error");
      return;
    }

    setFile(f);
    setWavBlob(null);
    setErrorMsg("");

    // Get duration
    try {
      const url = URL.createObjectURL(f);
      const audio = new Audio(url);
      audio.addEventListener("loadedmetadata", () => {
        setAudioInfo({
          name: f.name,
          size: f.size,
          duration: audio.duration,
        });
        URL.revokeObjectURL(url);
      });
      audio.addEventListener("error", () => {
        setAudioInfo({ name: f.name, size: f.size, duration: 0 });
        URL.revokeObjectURL(url);
      });
      setState("loaded");
    } catch {
      setAudioInfo({ name: f.name, size: f.size, duration: 0 });
      setState("loaded");
    }
  }, []);

  const handleConvert = async () => {
    if (!file) return;
    setState("converting");
    setErrorMsg("");

    try {
      const blob = await convertMP3ToWAV(file, { sampleRate });
      setWavBlob(blob);
      setState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Conversion failed.");
      setState("error");
    }
  };

  const handleDownload = () => {
    if (!wavBlob || !audioInfo) return;
    const url = URL.createObjectURL(wavBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = audioInfo.name.replace(/\.mp3$/i, "") + ".wav";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setFile(null);
    setAudioInfo(null);
    setWavBlob(null);
    setState("idle");
    setErrorMsg("");
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  // Upload view
  if (state === "idle") {
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
                <Music size={28} style={{ color: "var(--accent)" }} />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold mb-1">
                {isDragging ? "Drop your MP3 here" : "Upload MP3 File"}
              </h2>
              <p className="text-sm opacity-50">
                Drag & drop or click to browse
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
              Choose MP3 File
            </button>
            <p className="text-xs opacity-30 mt-1">Supports MP3 files</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".mp3,audio/mpeg"
            className="hidden"
            onChange={handleChange}
          />
        </div>
      </div>
    );
  }

  // Loaded / Converting / Done / Error view
  return (
    <div className="flex items-center justify-center h-full w-full p-8">
      <div
        className="w-full max-w-lg rounded-2xl p-8"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        {/* File info */}
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(99, 102, 241, 0.1)" }}
          >
            <Music size={22} style={{ color: "var(--accent)" }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">
              {audioInfo?.name}
            </p>
            <p className="text-xs opacity-50">
              {audioInfo ? formatFileSize(audioInfo.size) : ""}
              {audioInfo && audioInfo.duration > 0
                ? ` · ${formatDuration(audioInfo.duration)}`
                : ""}
            </p>
          </div>
        </div>

        {/* Output settings */}
        <div
          className="rounded-xl p-4 mb-6"
          style={{ background: "var(--background)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide opacity-50 mb-3">
            Output Settings
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm opacity-70">Format</span>
              <span className="text-sm font-mono">WAV (16-bit PCM)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm opacity-70">Channels</span>
              <span className="text-sm font-mono">Mono</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm opacity-70">Sample Rate</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSampleRate(44100)}
                  disabled={state === "converting"}
                  className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background:
                      sampleRate === 44100
                        ? "var(--accent)"
                        : "var(--surface-hover)",
                    color: sampleRate === 44100 ? "#fff" : "var(--foreground)",
                  }}
                >
                  44.1 kHz
                </button>
                <button
                  onClick={() => setSampleRate(22050)}
                  disabled={state === "converting"}
                  className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background:
                      sampleRate === 22050
                        ? "var(--accent)"
                        : "var(--surface-hover)",
                    color: sampleRate === 22050 ? "#fff" : "var(--foreground)",
                  }}
                >
                  22.05 kHz
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* WAV result info */}
        {state === "done" && wavBlob && (
          <div
            className="rounded-xl p-4 mb-6 flex items-center gap-3"
            style={{
              background: "rgba(34, 197, 94, 0.08)",
              border: "1px solid rgba(34, 197, 94, 0.2)",
            }}
          >
            <CheckCircle2 size={18} style={{ color: "var(--success)" }} />
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--success)" }}>
                Conversion complete
              </p>
              <p className="text-xs opacity-60">
                Output: {formatFileSize(wavBlob.size)} · Mono · {sampleRate / 1000} kHz · 16-bit PCM
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {state === "error" && (
          <div
            className="rounded-xl p-4 mb-6 flex items-center gap-3"
            style={{
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
            }}
          >
            <AlertCircle size={18} style={{ color: "var(--danger)" }} />
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {errorMsg}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          {state === "done" ? (
            <>
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
                style={{
                  background: "var(--success)",
                  color: "#fff",
                }}
              >
                <Download size={16} />
                Download WAV
              </button>
              <button
                onClick={handleReset}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: "var(--surface-hover)",
                  color: "var(--foreground)",
                }}
              >
                <RotateCcw size={16} />
                New File
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleConvert}
                disabled={state === "converting"}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-60"
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                  boxShadow: "0 4px 14px var(--accent-glow)",
                }}
              >
                {state === "converting" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Convert to WAV
                  </>
                )}
              </button>
              <button
                onClick={handleReset}
                disabled={state === "converting"}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                style={{
                  background: "var(--surface-hover)",
                  color: "var(--foreground)",
                }}
              >
                <RotateCcw size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
