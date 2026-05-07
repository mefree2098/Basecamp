"use client";

import { Sparkles } from "lucide-react";

export type GuidePetState = "idle" | "thinking" | "speaking" | "ready" | "error";

const stateCopy: Record<GuidePetState, string> = {
  idle: "Ready when you are",
  thinking: "Checking Startup State",
  speaking: "Explaining the path",
  ready: "Path ready",
  error: "Using local guide"
};

export function AnimatedAvatar({
  compact = false,
  state = "idle",
  status
}: {
  compact?: boolean;
  state?: GuidePetState;
  status?: string;
}) {
  return (
    <div
      className={compact ? "basecamp-pet basecamp-pet--compact" : "basecamp-pet"}
      data-state={state}
      aria-label={`Basecamp guide status: ${status ?? stateCopy[state]}`}
    >
      {!compact && (
        <div className="basecamp-pet__status" aria-live="polite">
          {status ?? stateCopy[state]}
        </div>
      )}
      <div className="basecamp-pet__stage" aria-hidden="true">
        <div className="basecamp-pet__orbit">
          <span />
          <span />
          <span />
        </div>
        <div className="basecamp-pet__antenna">
          <span />
        </div>
        <div className="basecamp-pet__body">
          <div className="basecamp-pet__hood">
            <div className="basecamp-pet__face">
              <span className="basecamp-pet__eye" />
              <span className="basecamp-pet__eye" />
              <i />
            </div>
          </div>
          <span className="basecamp-pet__wing basecamp-pet__wing--left" />
          <span className="basecamp-pet__wing basecamp-pet__wing--right" />
          <div className="basecamp-pet__rock">
            <span />
            <span />
          </div>
        </div>
        <div className="basecamp-pet__beam" />
        <div className="basecamp-pet__sparkles">
          <span />
          <span />
          <span />
        </div>
      </div>
      {!compact && (
        <div className="avatar__caption">
          <Sparkles size={14} aria-hidden="true" />
          Grounded guide
        </div>
      )}
    </div>
  );
}
