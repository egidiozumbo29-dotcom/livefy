"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getWsUrl(): string {
  const url = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (url) return url.replace(/\/$/, "");
  return "http://127.0.0.1:4000";
}

export function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  if (!socket) {
    socket = io(getWsUrl(), {
      transports: ["websocket", "polling"],
      autoConnect: false,
    });
  }
  return socket;
}
