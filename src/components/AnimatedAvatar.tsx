"use client";

import { Sparkles } from "lucide-react";

export type GuideCompanionState = "idle" | "thinking" | "speaking" | "ready" | "error";

const stateCopy: Record<GuideCompanionState, string> = {
  idle: "Tour guide ready",
  thinking: "Mapping your first stop",
  speaking: "Walking through the path",
  ready: "Route ready",
  error: "Local route ready"
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
  return (
    <div
      className={compact ? "tour-guide tour-guide--compact" : "tour-guide"}
      data-state={state}
      aria-label={`Basecamp tour guide status: ${status ?? stateCopy[state]}`}
    >
      {!compact && (
        <div className="tour-guide__status" aria-live="polite">
          {status ?? stateCopy[state]}
        </div>
      )}
      <div className="tour-guide__scene" aria-hidden="true">
        <div className="tour-guide__trail">
          <span className="tour-guide__pin tour-guide__pin--start" />
          <span className="tour-guide__pin tour-guide__pin--end" />
        </div>
        <div className="tour-guide__spotlight" />
        <div className="tour-guide__figure">
          <div className="tour-guide__hair">
            <span />
          </div>
          <div className="tour-guide__head">
            <span className="tour-guide__ear tour-guide__ear--left" />
            <span className="tour-guide__ear tour-guide__ear--right" />
            <span className="tour-guide__eye tour-guide__eye--left" />
            <span className="tour-guide__eye tour-guide__eye--right" />
            <span className="tour-guide__smile" />
            <span className="tour-guide__cheek tour-guide__cheek--left" />
            <span className="tour-guide__cheek tour-guide__cheek--right" />
          </div>
          <div className="tour-guide__neck" />
          <div className="tour-guide__torso">
            <span className="tour-guide__scarf" />
            <span className="tour-guide__badge" />
          </div>
          <span className="tour-guide__arm tour-guide__arm--left" />
          <span className="tour-guide__arm tour-guide__arm--right">
            <i className="tour-guide__map" />
          </span>
          <span className="tour-guide__leg tour-guide__leg--left" />
          <span className="tour-guide__leg tour-guide__leg--right" />
        </div>
        <div className="tour-guide__sign">
          <span />
        </div>
        <div className="tour-guide__sparkles">
          <span />
          <span />
          <span />
        </div>
      </div>
      {!compact && (
        <div className="avatar__caption">
          <Sparkles size={14} aria-hidden="true" />
          Startup State tour guide
        </div>
      )}
    </div>
  );
}
