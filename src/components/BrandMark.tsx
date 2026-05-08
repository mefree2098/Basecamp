import Image from "next/image";
import Link from "next/link";

export function BrandMark() {
  return (
    <Link className="brand-mark" href="/" aria-label="Startup State home">
      <Image
        src="/brand/basecamp-app-icon.png"
        alt=""
        width={44}
        height={44}
        className="brand-mark__icon"
        priority
      />
      <span>
        <strong>Startup State</strong>
        <small>Utah</small>
      </span>
    </Link>
  );
}
