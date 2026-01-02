import { useState, useEffect, useRef, useCallback } from 'react';

interface WebSocketHook {
  socket: WebSocket | null;
  connect: (url: string) => void;
  disconnect: () => void;
  sendMessage: (message: string) => void;
  lastMessage: MessageEvent | null;
  readyState: number;
}

export function useWebSocket(): WebSocketHook {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);
  const [readyState, setReadyState] = useState<number>(WebSocket.CLOSED);
  const socketRef = useRef<WebSocket | null>(null);

  const connect = useCallback((url: string) => {
    // Only close if socket is fully connected, not still connecting
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.close();
    } else {
      socketRef.current = null;
    }
    const newSocket = new WebSocket(url);
    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.onopen = () => {
      setReadyState(newSocket.readyState);
    };

    newSocket.onmessage = (event) => {
      setLastMessage(event);
    };

    newSocket.onclose = () => {
      setReadyState(newSocket.readyState);
      socketRef.current = null;
      setSocket(null);
    };

    newSocket.onerror = (error) => {
      // Suppress error logging during initial connection/cleanup
      // WebSocket errors during component lifecycle are expected
    };
  }, []);

  const disconnect = useCallback(() => {
    // Only close if socket is fully connected
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.close();
    }
  }, []);

  const sendMessage = useCallback((message: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(message);
    }
  }, []);

  useEffect(() => {
    return () => {
      // Only close if socket is fully connected (not still connecting)
      // In React Strict Mode, cleanup runs before connection completes
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      } else {
        // Just nullify the ref without closing to avoid connection error
        socketRef.current = null;
      }
    };
  }, []);

  return {
    socket,
    connect,
    disconnect,
    sendMessage,
    lastMessage,
    readyState,
  };
}
