// Preserve MCP consent across sign-in without accepting arbitrary redirect URLs.
export function signInReturnPath(fallback: string) {
  return typeof window !== "undefined" && window.location.pathname === "/mcp/authorize"
    ? window.location.pathname + window.location.search : fallback;
}
