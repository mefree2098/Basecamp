export function externalResourceHref(link: string) {
  const trimmed = link.trim();
  if (!trimmed) return "#";
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

export function formatResourceUrl(link: string) {
  try {
    const url = new URL(externalResourceHref(link));
    return `${url.hostname}${url.pathname}${url.search}`.replace(/\/$/, "");
  } catch {
    return link.trim();
  }
}
