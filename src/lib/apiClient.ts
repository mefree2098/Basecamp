type ApiErrorShape = {
  error?: unknown;
};

export async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(input, {
    ...init,
    headers
  });
  const data = (await response.json().catch(() => ({}))) as ApiErrorShape;
  if (!response.ok) {
    throw new Error(formatApiError(data.error, response.status));
  }
  return data as T;
}

function formatApiError(error: unknown, status: number) {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code: unknown }).code);
  }
  return `API request failed with ${status}.`;
}
