const BASE_URL = import.meta.env.VITE_API_URL ?? "";

type Method = "GET" | "POST" | "PATCH" | "DELETE";

async function request<T>(
  method: Method,
  path: string,
  body?: unknown
): Promise<T> {
  const token = localStorage.getItem("token");
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error ?? "Request failed"), {
      status: res.status,
    });
  }
  //c no content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),

  // multipart upload for avatar and resumes (method defaults to PUT to match backend)
  upload: async <T>(path: string, formData: FormData, method: "POST" | "PUT" = "PUT"): Promise<T> => {
    const token = localStorage.getItem("token");
    const headers: HeadersInit = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw Object.assign(new Error(err.error ?? "Upload failed"), {
        status: res.status,
      });
    }
    return res.json() as Promise<T>;
  },
};
