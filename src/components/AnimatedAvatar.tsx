"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Sparkles } from "lucide-react";

export type GuideCompanionState = "idle" | "thinking" | "speaking" | "ready" | "error";

const spriteColumns = 8;
const spriteRows = 6;
const spriteFrameSize = 181;
const compactSpriteFrameSize = 86;

const stateCopy: Record<GuideCompanionState, string> = {
  idle: "Basecamp guide ready",
  thinking: "Reviewing your path",
  speaking: "Explaining the route",
  ready: "Next steps ready",
  error: "Local route ready"
};

const frameSequence = [0, 1, 2, 3, 4, 5, 6, 7];

const petRows: Record<GuideCompanionState, { row: number; frames: number[]; ms: number }> = {
  idle: { row: 0, frames: frameSequence, ms: 240 },
  thinking: { row: 1, frames: frameSequence, ms: 220 },
  speaking: { row: 2, frames: frameSequence, ms: 200 },
  ready: { row: 3, frames: frameSequence, ms: 220 },
  error: { row: 5, frames: frameSequence, ms: 240 }
};

export function AnimatedAvatar({
  compact = false,
  state = "idle",
  status
}: {
  compact?: boolean;
  state?: GuideCompanionState;
  status?: string;
}) {
  const [frameIndex, setFrameIndex] = useState(0);
  const sequence = useMemo(() => petRows[state], [state]);
  const frame = sequence.frames[frameIndex % sequence.frames.length];
  const renderedFrameSize = compact ? compactSpriteFrameSize : spriteFrameSize;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setFrameIndex((value) => value + 1);
    }, sequence.ms);
    return () => window.clearInterval(timer);
  }, [sequence]);

  return (
    <div
      className={compact ? "codex-pet codex-pet--compact" : "codex-pet"}
      data-state={state}
      aria-label={`Basecamp guide status: ${status ?? stateCopy[state]}`}
    >
      {!compact && (
        <div className="codex-pet__status" aria-live="polite">
          {status ?? stateCopy[state]}
        </div>
      )}
      <div
        className="codex-pet__sprite"
        style={
          {
            width: `${renderedFrameSize}px`,
            height: `${renderedFrameSize}px`,
            backgroundPosition: `-${frame * renderedFrameSize}px -${
              sequence.row * renderedFrameSize
            }px`,
            backgroundSize: `${spriteColumns * renderedFrameSize}px ${
              spriteRows * renderedFrameSize
            }px`
          } as CSSProperties
        }
        aria-hidden="true"
      />
      {!compact && (
        <div className="avatar__caption">
          <Sparkles size={14} aria-hidden="true" />
          16-bit Startup State guide
        </div>
      )}
    </div>
  );
}
