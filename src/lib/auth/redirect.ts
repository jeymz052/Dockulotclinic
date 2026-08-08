const FALLBACK_AUTH_REDIRECT = "/dashboard";
const LOCAL_REDIRECT_ORIGIN = "https://dockulot.local";

export function getSafeAuthRedirect(
  value: string | null | undefined,
  fallback = FALLBACK_AUTH_REDIRECT,
) {
  if (!value) {
    return fallback;
  }

  try {
    const url = new URL(value, LOCAL_REDIRECT_ORIGIN);
    if (url.origin !== LOCAL_REDIRECT_ORIGIN) {
      return fallback;
    }
    if (!url.pathname.startsWith("/") || url.pathname.startsWith("//")) {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
