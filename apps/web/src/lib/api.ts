/** Base URL for all API requests. Empty in dev (uses Vite proxy), full URL in production. */
export const API_BASE = import.meta.env.VITE_API_URL ?? ''
