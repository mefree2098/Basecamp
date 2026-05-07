import Image from "next/image";
import Link from "next/link";

export function BrandMark() {
  return (
    <Link className="brand-mark" href="/" aria-label="Basecamp home">
      <Image
        src="/brand/basecamp-iconography.png"
        alt=""
        width={44}
        height={44}
        className="brand-mark__icon"
        priority
      />
      <span>
        <strong>Basecamp</strong>
        <small>Startup State guide</small>
      </span>
    </Link>
  );
}
