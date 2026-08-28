export const API_ROOT = (import.meta.env?.VITE_API_URL || "http://localhost:4311/api/v1").replace(/\/$/, "");
export const SOCKET_ROOT = API_ROOT.replace(/\/api\/v1$/, "");

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function api<T>(path: string, options: RequestInit = {}, allowRefresh = true): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = options.body instanceof FormData ? 45_000 : 20_000;
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener("abort", abortFromCaller, { once: true });

  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      ...options,
      signal: controller.signal,
      credentials: "include",
      headers: {
        ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...options.headers
      }
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ApiError("The request took too long. Check your connection and try again.", 408);
    }
    throw new ApiError(error instanceof Error ? error.message : "The server could not be reached.", 0);
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }

  if (response.status === 401 && allowRefresh && (path === "/auth/me" || !path.startsWith("/auth/"))) {
    try {
      await api("/auth/refresh", { method: "POST" }, false);
      return api<T>(path, options, false);
    } catch {
      // The original 401 response below provides the useful session error.
    }
  }
  const payload = await response.json().catch(() => null) as { message?: string } | null;
  if (!response.ok) {
    throw new ApiError(payload?.message || "Something went wrong. Please try again.", response.status);
  }
  return payload as T;
}
