const DEFAULT_BACKEND_PORT = '8000'

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function toWebSocketOrigin(value: string): string {
  const normalized = trimTrailingSlash(value)
  if (normalized.startsWith('https://')) {
    return `wss://${normalized.slice('https://'.length)}`
  }
  if (normalized.startsWith('http://')) {
    return `ws://${normalized.slice('http://'.length)}`
  }
  return normalized
}

export function getBackendHttpOrigin(): string {
  const configured = import.meta.env.VITE_BACKEND_HTTP_ORIGIN
  if (configured) {
    return trimTrailingSlash(configured)
  }

  if (!import.meta.env.DEV) {
    return trimTrailingSlash(window.location.origin)
  }

  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
  return `${protocol}//${window.location.hostname}:${DEFAULT_BACKEND_PORT}`
}

export function getBackendWsOrigin(): string {
  const configured = import.meta.env.VITE_BACKEND_WS_ORIGIN
  if (configured) {
    return toWebSocketOrigin(configured)
  }

  return toWebSocketOrigin(getBackendHttpOrigin())
}
