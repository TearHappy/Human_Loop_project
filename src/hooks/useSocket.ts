"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type Socket, io } from "socket.io-client";

interface UseSocketOptions {
	token?: string;
	autoConnect?: boolean;
}

interface SocketState {
	connected: boolean;
	error: string | null;
}

interface QueuedMessage {
	method: string;
	params: Record<string, unknown>;
	requestId: string;
	timestamp: number;
}

export const useSocket = (options: UseSocketOptions = {}) => {
	const [socket, setSocket] = useState<Socket | null>(null);
	const [state, setState] = useState<SocketState>({
		connected: false,
		error: null,
	});

	// Use refs to store current socket instance and message queue
	const socketRef = useRef<Socket | null>(null);
	const messageQueueRef = useRef<QueuedMessage[]>([]);
	const hasConnectedRef = useRef(false); // Track if we've already initiated connection
	const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	// Ensure window 'online'/'offline' listeners are always cleaned up
	const windowCleanupRef = useRef<(() => void) | null>(null);
	const isConnectingRef = useRef(false); // Track if connection attempt is in progress
	socketRef.current = socket;

	const processMessageQueue = useCallback(() => {
		const queue = messageQueueRef.current;
		if (queue.length === 0) return;

		console.log(`[useSocket] 📤 Processing ${queue.length} queued messages`);

		const currentSocket = socketRef.current;
		if (!currentSocket || !currentSocket.connected) {
			console.log("[useSocket] ⚠️ Cannot process queue: socket not connected");
			return;
		}

		// Process all queued messages
		const messages: QueuedMessage[] = [...queue];
		messageQueueRef.current = [];

		for (const { method, params, requestId } of messages) {
			try {
				if (currentSocket.connected) {
					currentSocket.emit("mcp_request", {
						method,
						params,
						requestId,
					});
					console.log(
						`[useSocket] ✅ Sent queued message: ${method} (${requestId})`,
					);
				} else {
					// Re-queue if still not connected
					messageQueueRef.current.push({
						method,
						params,
						requestId,
						timestamp: Date.now(),
					});
				}
			} catch (error) {
				console.error(
					"[useSocket] ❌ Error sending queued message, re-queueing:",
					error,
				);
				messageQueueRef.current.push({
					method,
					params,
					requestId,
					timestamp: Date.now(),
				});
			}
		}
	}, []);

	const connect = useCallback(() => {
		if (!options.token) {
			setState((prev) => ({
				...prev,
				error: "No authentication token provided",
			}));
			return;
		}

		// Prevent multiple connections
		if (socketRef.current?.connected) {
			console.log("[useSocket] Already connected, skipping");
			return;
		}

		// Prevent duplicate connection attempts
		if (hasConnectedRef.current || isConnectingRef.current) {
			console.log(
				"[useSocket] Connection already initiated or in progress, skipping",
			);
			return;
		}

		hasConnectedRef.current = true;
		isConnectingRef.current = true;
		console.log("[useSocket] Initiating connection...");

		const newSocket = io({
			path: "/api/socket",
			auth: { token: options.token },
			// Robust reconnection strategy
			reconnection: true,
			reconnectionAttempts: Number.POSITIVE_INFINITY,
			reconnectionDelay: 1000, // Start with 1 second delay
			reconnectionDelayMax: 10000, // Max 10 seconds between attempts
			randomizationFactor: 0.5, // Prevent synchronized reconnections
			timeout: 30000, // 30 seconds for connection attempt
			// Transport configuration
			transports: ["polling", "websocket"],
			upgrade: true,
			rememberUpgrade: true,
			tryAllTransports: true, // Try all transports if one fails
			forceNew: false,
			// Additional stability options
			closeOnBeforeunload: false, // Properly detect page reloads
		});

		newSocket.on("connect", () => {
			console.log("[useSocket] ✅ Connected to server");
			isConnectingRef.current = false;
			setState((prev) => ({ ...prev, connected: true, error: null }));

			// Start heartbeat monitoring
			if (pingIntervalRef.current) {
				clearInterval(pingIntervalRef.current);
			}
			pingIntervalRef.current = setInterval(() => {
				if (newSocket.connected) {
					newSocket.emit("ping");
					console.log("[useSocket] 💓 Ping sent");
				} else {
					console.log(
						"[useSocket] ⚠️ Socket disconnected, clearing ping interval",
					);
					if (pingIntervalRef.current) {
						clearInterval(pingIntervalRef.current);
						pingIntervalRef.current = null;
					}
				}
			}, 25000); // Ping every 25 seconds

			// Process queued messages
			processMessageQueue();
		});

		newSocket.on("disconnect", (reason) => {
			console.log("[useSocket] ❌ Disconnected:", reason);
			isConnectingRef.current = false;
			setState((prev) => ({ ...prev, connected: false }));

			// Clear heartbeat interval
			if (pingIntervalRef.current) {
				clearInterval(pingIntervalRef.current);
				pingIntervalRef.current = null;
			}

			// Reset connection flag to allow reconnection
			hasConnectedRef.current = false;

			// Auto-reconnect for all disconnect reasons
			console.log("[useSocket] 🔄 Will auto-reconnect...");

			// Force reconnect if not a clean disconnect
			if (
				reason === "io server disconnect" ||
				reason === "transport close" ||
				reason === "transport error"
			) {
				console.log(
					"[useSocket] 🔄 Forcing immediate reconnect due to:",
					reason,
				);
				if (reconnectTimeoutRef.current) {
					clearTimeout(reconnectTimeoutRef.current);
				}
				reconnectTimeoutRef.current = setTimeout(() => {
					if (!newSocket.connected) {
						console.log("[useSocket] 🔄 Executing forced reconnect...");
						newSocket.connect();
					}
				}, 1000);
			}

			// Ensure window listeners are cleaned up
			windowCleanupRef.current?.();
		});

		newSocket.on("connect_error", (error) => {
			console.error("[useSocket] Connection error:", error.message);
			isConnectingRef.current = false;
			hasConnectedRef.current = false; // Reset to allow retry
			setState((prev) => ({ ...prev, error: error.message, connected: false }));
		});

		// Listen for pong responses
		newSocket.on("pong", () => {
			console.log("[useSocket] 💓 Pong received - connection healthy");
		});

		newSocket.on("reconnect_attempt", (attemptNumber) => {
			console.log("[useSocket] Reconnection attempt:", attemptNumber);
		});

		newSocket.on("reconnect", (attemptNumber) => {
			console.log(
				"[useSocket] ✅ Reconnected after",
				attemptNumber,
				"attempts",
			);
			setState((prev) => ({ ...prev, connected: true, error: null }));
			isConnectingRef.current = false;

			// Process queued messages
			processMessageQueue();
		});

		// Handle offline/online events
		const handleOffline = () => {
			console.log("[useSocket] 📱 Browser went offline");
			setState((prev) => ({
				...prev,
				connected: false,
				error: "Browser offline",
			}));
		};

		const handleOnline = () => {
			console.log(
				"[useSocket] 📱 Browser back online, attempting to reconnect...",
			);
			if (!newSocket.connected) {
				newSocket.connect();
			}
		};

		// Listen for browser online/offline events
		if (typeof window !== "undefined") {
			window.addEventListener("offline", handleOffline);
			window.addEventListener("online", handleOnline);
		}

		// Store cleanup function in a ref so it can be called on unmount as well
		windowCleanupRef.current = () => {
			if (typeof window !== "undefined") {
				window.removeEventListener("offline", handleOffline);
				window.removeEventListener("online", handleOnline);
			}
		};

		// Window cleanup is now handled in the main disconnect handler above

		setSocket(newSocket);
	}, [options.token, processMessageQueue]); // Include token and processMessageQueue dependencies

	const disconnect = useCallback(() => {
		const currentSocket = socketRef.current;
		if (currentSocket) {
			// Clean up all event listeners
			currentSocket.off("connect");
			currentSocket.off("disconnect");
			currentSocket.off("connect_error");
			currentSocket.off("pong");
			currentSocket.off("reconnect_attempt");
			currentSocket.off("reconnect");

			currentSocket.disconnect();
			setSocket(null);
			setState({ connected: false, error: null });
		}
	}, []); // No dependencies needed since we use ref

	const sendMCPRequest = useCallback(
		(method: string, params: Record<string, unknown>) => {
			const currentSocket = socketRef.current;
			const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

			if (!currentSocket) {
				console.warn(
					"[useSocket] ⚠️ Socket not initialized, queueing message:",
					method,
				);
				messageQueueRef.current.push({
					method,
					params,
					requestId,
					timestamp: Date.now(),
				});
				return requestId;
			}

			if (!currentSocket.connected) {
				console.warn(
					"[useSocket] ⚠️ Socket disconnected, queueing message:",
					method,
				);
				messageQueueRef.current.push({
					method,
					params,
					requestId,
					timestamp: Date.now(),
				});
				return requestId;
			}

			try {
				currentSocket.emit("mcp_request", {
					method,
					params,
					requestId,
				});
				console.log(`[useSocket] ✅ Sent message: ${method} (${requestId})`);
			} catch (error) {
				console.error("[useSocket] ❌ Error sending message, queueing:", error);
				messageQueueRef.current.push({
					method,
					params,
					requestId,
					timestamp: Date.now(),
				});
			}

			return requestId;
		},
		[],
	); // No dependencies needed since we use ref

	const sendUserResponse = useCallback(
		(requestId: string, response: string) => {
			const currentSocket = socketRef.current;
			if (!currentSocket || !currentSocket.connected) {
				console.error(
					"[useSocket] ❌ Cannot send user response: socket not connected",
				);
				return;
			}

			try {
				currentSocket.emit("user_response", {
					requestId,
					response,
				});
				console.log(`[useSocket] ✅ Sent user response for ${requestId}`);
			} catch (error) {
				console.error("[useSocket] ❌ Error sending user response:", error);
			}
		},
		[],
	); // No dependencies needed since we use ref

	const updateConfig = useCallback(
		(configId: string, updates: Record<string, unknown>) => {
			const currentSocket = socketRef.current;
			if (!currentSocket || !currentSocket.connected) {
				console.error(
					"[useSocket] ❌ Cannot update config: socket not connected",
				);
				return;
			}

			try {
				currentSocket.emit("update_config", {
					configId,
					updates,
				});
				console.log(`[useSocket] ✅ Updated config ${configId}`);
			} catch (error) {
				console.error("[useSocket] ❌ Error updating config:", error);
			}
		},
		[],
	); // No dependencies needed since we use ref

	// Stable useEffect that doesn't cause infinite loops
	useEffect(() => {
		if (
			options.autoConnect !== false &&
			options.token &&
			!hasConnectedRef.current
		) {
			connect();
		}

		return () => {
			// Cleanup intervals
			if (pingIntervalRef.current) {
				clearInterval(pingIntervalRef.current);
				pingIntervalRef.current = null;
			}
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
				reconnectTimeoutRef.current = null;
			}

			// Ensure window listeners are cleaned up even if socket is still connected
			windowCleanupRef.current?.();

			const currentSocket = socketRef.current;
			if (currentSocket) {
				currentSocket.off("connect");
				currentSocket.off("disconnect");
				currentSocket.off("connect_error");
				currentSocket.off("pong");
				currentSocket.disconnect();
			}
			// Reset connection flags to allow reconnection on remount
			hasConnectedRef.current = false;
			isConnectingRef.current = false;
		};
	}, [options.token, options.autoConnect, connect]);

	return {
		socket,
		...state,
		connect,
		disconnect,
		sendMCPRequest,
		sendUserResponse,
		updateConfig,
	};
};
