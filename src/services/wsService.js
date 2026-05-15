export function openMessageSocket(token, onEvent) {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
  const wsUrl = apiUrl.replace(/^https?:/, wsProtocol) + '/ws'
  const socket = new WebSocket(wsUrl, [`bearer.${token}`])

  socket.onmessage = (evt) => {
    try {
      onEvent(JSON.parse(evt.data))
    } catch {}
  }

  return socket
}
