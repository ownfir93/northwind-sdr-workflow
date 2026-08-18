"use client";
import { Handle, Position } from "@xyflow/react";
import { memo } from "react";

export type RunState = "idle" | "active" | "done";

const KIND_STYLE: Record<string, { bg: string; border: string; accent: string }> = {
  event: { bg: "#fff7ed", border: "#fb923c", accent: "#c2410c" },
  process: { bg: "#eef2ff", border: "#818cf8", accent: "#4338ca" },
  decision: { bg: "#faf5ff", border: "#c084fc", accent: "#7e22ce" },
  terminal: { bg: "#f1f5f9", border: "#94a3b8", accent: "#334155" },
  handoff: { bg: "#ecfeff", border: "#22d3ee", accent: "#0e7490" }, // outreach + human send layer
  scheduled: { bg: "#e2e8f0", border: "#475569", accent: "#1e293b" }, // cron / scheduled source
};

function WfNodeImpl({ data }: { data: any }) {
  const kind = data.kind as string;
  const state = (data.state ?? "idle") as RunState;
  const s = KIND_STYLE[kind] ?? KIND_STYLE.process;

  const active = state === "active";
  const done = state === "done";

  return (
    <div
      style={{
        width: 168,
        padding: "8px 10px",
        borderRadius: 10,
        background: done ? "#ecfdf5" : s.bg,
        border: `2px solid ${active ? "#f59e0b" : done ? "#10b981" : s.border}`,
        boxShadow: active ? "0 0 0 4px rgba(245,158,11,0.25)" : "0 1px 2px rgba(0,0,0,0.06)",
        transform: active ? "scale(1.04)" : "scale(1)",
        transition: "all 160ms ease",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        opacity: data.dimmed ? 0.45 : 1,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: s.border, width: 7, height: 7 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: s.accent }}>{data.title}</span>
        {done && <span style={{ fontSize: 11 }}>✓</span>}
      </div>
      {data.subtitle && (
        <div style={{ fontSize: 10.5, color: "#475569", marginTop: 2 }}>{data.subtitle}</div>
      )}
      {data.model && (
        <div
          style={{
            display: "inline-block",
            marginTop: 5,
            fontSize: 9.5,
            color: s.accent,
            background: "#fff",
            border: `1px solid ${s.border}`,
            borderRadius: 6,
            padding: "0 5px",
          }}
        >
          {data.model}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: s.border, width: 7, height: 7 }} />
    </div>
  );
}

export default memo(WfNodeImpl);
