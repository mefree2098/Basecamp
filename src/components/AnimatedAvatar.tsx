"use client";

import Image from "next/image";
import { Sparkles } from "lucide-react";

export function AnimatedAvatar({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "avatar avatar--compact" : "avatar"} aria-label="Basecamp AI guide">
      <div className="avatar__signal" aria-hidden="true" />
      <Image
        src="/brand/basecamp-guide-avatar.png"
        alt=""
        width={compact ? 78 : 132}
        height={compact ? 116 : 197}
        className="avatar__sprite"
        priority={!compact}
      />
      {!compact && (
        <div className="avatar__caption">
          <Sparkles size={14} aria-hidden="true" />
          Grounded guide
        </div>
      )}
    </div>
  );
}
