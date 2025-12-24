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
    if (socketRef.current) {
      socketRef.current.close();
    }
    const newSocket = new WebSocket(url);
    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.onopen = () => {
      console.log('WebSocket connected');
      setReadyState(newSocket.readyState);
    };

    newSocket.onmessage = (event) => {
      setLastMessage(event);
    };

    newSocket.onclose = () => {
      console.log('WebSocket disconnected');
      setReadyState(newSocket.readyState);
      socketRef.current = null;
      setSocket(null);
    };

    newSocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setReadyState(newSocket.readyState);
    };
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
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
      if (socketRef.current) {
        socketRef.current.close();
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
