export const API_ROOT = (import.meta.env.VITE_API_URL || "http://localhost:4311/api/v1").replace(/\/$/, "");
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
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });

  if (response.status === 401 && allowRefresh && (path === "/auth/me" || !path.startsWith("/auth/"))) {
    const refreshed = await fetch(`${API_ROOT}/auth/refresh`, { method: "POST", credentials: "include" });
    if (refreshed.ok) return api<T>(path, options, false);
  }
  const payload = await response.json().catch(() => null) as { message?: string } | null;
  if (!response.ok) {
    throw new ApiError(payload?.message || "Something went wrong. Please try again.", response.status);
  }
  return payload as T;
}
