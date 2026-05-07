"use client";

import { Sparkles } from "lucide-react";

export function AnimatedAvatar({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "avatar avatar--compact" : "avatar"} aria-label="Basecamp AI guide">
      <div className="avatar__signal" aria-hidden="true" />
      <div className="avatar__body">
        <div className="avatar__face">
          <span />
          <span />
          <i />
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
