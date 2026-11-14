const ROUTER_REST_URL = process.env.MIKROTIK_REST_URL;
const ROUTER_API_USER = process.env.MIKROTIK_API_USER;
const ROUTER_API_PASSWORD = process.env.MIKROTIK_API_PASSWORD;

export function isRouterConfigured() {
  return Boolean(ROUTER_REST_URL && ROUTER_API_USER && ROUTER_API_PASSWORD);
}

export async function getRouterStatus() {
  if (!isRouterConfigured()) {
    return {
      configured: false,
      connected: false,
      message: "MikroTik integration is not configured yet.",
    };
  }

  let baseUrl;
  try {
    baseUrl = new URL(ROUTER_REST_URL);
  } catch {
    return { configured: true, connected: false, error: "INVALID_ROUTER_URL" };
  }

  // RouterOS REST must only be reached over HTTPS (normally through a private VPN).
  if (baseUrl.protocol !== "https:" || baseUrl.username || baseUrl.password) {
    return { configured: true, connected: false, error: "HTTPS_PRIVATE_ENDPOINT_REQUIRED" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const authorization = Buffer.from(
    `${ROUTER_API_USER}:${ROUTER_API_PASSWORD}`,
    "utf8",
  ).toString("base64");

  try {
    const response = await fetch(
      new URL("/rest/system/resource", baseUrl).toString(),
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${authorization}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      return {
        configured: true,
        connected: false,
        error: response.status === 401 || response.status === 403
          ? "ROUTER_AUTH_FAILED"
          : "ROUTER_HTTP_ERROR",
      };
    }

    const resources = await response.json();
    const resource = Array.isArray(resources) ? resources[0] : resources;
    if (!resource || typeof resource !== "object") {
      return { configured: true, connected: false, error: "INVALID_ROUTER_RESPONSE" };
    }

    return {
      configured: true,
      connected: true,
      router: {
        boardName: resource["board-name"] || null,
        version: resource.version || null,
        uptime: resource.uptime || null,
        cpuLoad: resource["cpu-load"] ?? null,
        freeMemory: resource["free-memory"] || null,
        totalMemory: resource["total-memory"] || null,
      },
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      error: error?.name === "AbortError" ? "ROUTER_TIMEOUT" : "ROUTER_UNREACHABLE",
    };
  } finally {
    clearTimeout(timeout);
  }
}
