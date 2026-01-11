import type { Server as NetServer } from "node:http";
import type { Socket as NetSocket } from "node:net";
import { decode, encode } from "@toon-format/toon";
import jwt from "jsonwebtoken";
import type { NextApiRequest, NextApiResponse } from "next";
import { type Socket, Server as SocketIOServer } from "socket.io";
import { DatabaseService } from "../../src/lib/database";
import socketManager from "../../src/lib/socket-manager";

interface SocketServer extends NetServer {
	io?: SocketIOServer;
}

interface SocketWithIO extends NetSocket {
	server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
	socket: SocketWithIO;
}

interface AuthenticatedSocket extends Socket {
	userId?: string;
	sessionToken?: string;
}

// Simple in-memory correlator for WebContainer compatibility
type ResponseResolver = (value: unknown) => void;

class SimpleCorrelator {
	private responses: Map<string, ResponseResolver> = new Map();
	private timeouts: Map<string, NodeJS.Timeout> = new Map();
	private socketRequests: Map<string, Set<string>> = new Map(); // socketId -> Set<requestId>

	async waitForWebResponse(
		requestId: string,
		timeoutMs: number,
		socketId?: string,
	): Promise<unknown> {
		return new Promise((resolve) => {
			// Track request by socket ID for cleanup
			if (socketId) {
				if (!this.socketRequests.has(socketId)) {
					this.socketRequests.set(socketId, new Set());
				}
				this.socketRequests.get(socketId)?.add(requestId);
			}

			// Only set timeout if timeoutMs > 0 (0 means infinite wait)
			if (timeoutMs > 0) {
				const timeout = setTimeout(() => {
					this.responses.delete(requestId);
					this.timeouts.delete(requestId);
					if (socketId) {
						this.socketRequests.get(socketId)?.delete(requestId);
					}
					resolve({
						user_input: "Please re-send your last message to ask_human",
					});
				}, timeoutMs);
				this.timeouts.set(requestId, timeout);
			}

			// Check if response already exists
			if (this.responses.has(requestId)) {
				const response = this.responses.get(requestId);
				this.responses.delete(requestId);
				const timeout = this.timeouts.get(requestId);
				if (timeout) {
					clearTimeout(timeout);
					this.timeouts.delete(requestId);
				}
				if (socketId) {
					this.socketRequests.get(socketId)?.delete(requestId);
				}
				resolve(response);
				return;
			}

			// Store resolver for later
			this.responses.set(requestId, resolve);
		});
	}

	async resolveRequest(requestId: string, response: unknown): Promise<void> {
		if (this.responses.has(requestId)) {
			const resolve = this.responses.get(requestId);
			if (typeof resolve === "function") {
				resolve(response);
			}
			this.responses.delete(requestId);

			const timeout = this.timeouts.get(requestId);
			if (timeout) {
				clearTimeout(timeout);
				this.timeouts.delete(requestId);
			}

			// Remove from socket tracking
			for (const [socketId, requestIds] of this.socketRequests.entries()) {
				if (requestIds.has(requestId)) {
					requestIds.delete(requestId);
					if (requestIds.size === 0) {
						this.socketRequests.delete(socketId);
					}
					break;
				}
			}
		}
	}

	cleanupSocket(socketId: string): void {
		const requestIds = this.socketRequests.get(socketId);
		if (!requestIds) return;

		// Clean up all pending requests for this socket
		for (const requestId of requestIds) {
			// Clear timeout if exists
			const timeout = this.timeouts.get(requestId);
			if (timeout) {
				clearTimeout(timeout);
				this.timeouts.delete(requestId);
			}

			// Resolve with disconnect error if pending
			const resolve = this.responses.get(requestId);
			if (resolve && typeof resolve === "function") {
				resolve({
					error: "Connection closed",
					user_input: "Connection was closed. Please reconnect and try again.",
				});
			}
			this.responses.delete(requestId);
		}

		// Remove socket tracking
		this.socketRequests.delete(socketId);
	}
}

const correlator = new SimpleCorrelator();

// Export the SocketManager's getIO for backward compatibility
export function getIO(): SocketIOServer | null {
	return socketManager.getIO();
}

interface SequentialThinkingData {
	thought: string;
	thoughtNumber: number;
	totalThoughts: number;
}

interface SendToPreviewData {
	html: string;
	css: string;
}

interface PreviewRequestData {
	requestId?: string;
	mcpSocketId?: string;
}

interface PreviewResponseData {
	html?: string;
	css?: string;
	mcpSocketId?: string;
	requestId?: string;
}

interface MCPRequestData {
	method: string;
	params: Record<string, unknown>;
	requestId: string;
}

interface MCPResponseData {
	requestId: string;
	response: Record<string, unknown>;
}

interface MCPErrorData {
	requestId: string;
	error: string;
}

interface HumanQuestionData {
	requestId: string;
	question: string;
	userId: string;
	timestamp: number;
}

interface UserResponseData {
	requestId: string;
	response: string;
}

interface UpdateConfigData {
	configId: string;
	updates: Record<string, unknown>;
}

const SocketHandler = async (
	req: NextApiRequest,
	res: NextApiResponseWithSocket,
) => {
	if (res.socket.server.io && socketManager.isInitialized()) {
		res.end();
		return;
	}
	const io = new SocketIOServer(res.socket.server, {
		path: "/api/socket",
		cors: {
			origin: "*",
			methods: ["GET", "POST"],
		},
		// Production-ready robust configuration
		pingTimeout: 20000, // 20 seconds (reduced from 60s for faster cleanup)
		pingInterval: 10000, // 10 seconds (reduced from 25s for faster detection)
		upgradeTimeout: 10000, // 10 seconds (reduced from 30s)
		maxHttpBufferSize: 1e6, // 1MB - prevent memory issues
		transports: ["polling", "websocket"],
		allowUpgrades: true,
		// Connection state recovery for better reliability
		// Reduced duration to prevent connection leaks
		connectionStateRecovery: {
			maxDisconnectionDuration: 30 * 1000, // 30 seconds (reduced from 2 minutes)
			skipMiddlewares: true, // Skip middlewares for recovery
		},
		// Engine.IO options for stability
		perMessageDeflate: false, // Disable compression to prevent issues
	});

	// Authentication middleware
	io.use(async (socket: AuthenticatedSocket, next) => {
		// TODO: Implement Supabase JWT authentication
		// For now, using mock user for development
		socket.userId = "mock-user-123";
		socket.sessionToken = "mock-jwt-token-for-development";
		next();
	});

	io.on("connection", async (socket: AuthenticatedSocket) => {
		// Join user-specific room
		socket.join(`user:${socket.userId}`);

		// Handle ping/pong for connection health monitoring
		socket.on("ping", () => {
			socket.emit("pong");
		});

		// Broadcast sequential thinking events from MCP bridge to all clients
		socket.on("sequential_thinking", (data: SequentialThinkingData) => {
			try {
				io.to(`user:${socket.userId}`).emit("sequential_thinking", data);
			} catch (error) {
				console.error(
					"[Socket.IO] Failed to broadcast sequential_thinking:",
					error,
				);
			}
		});

		// Broadcast send_to_preview events from MCP bridge to all clients
		socket.on("send_to_preview", (data: SendToPreviewData) => {
			try {
				io.to(`user:${socket.userId}`).emit("send_to_preview", data);
			} catch (error) {
				console.error(
					"[Socket.IO] Failed to broadcast send_to_preview:",
					error,
				);
			}
		});

		// Broadcast send_to_mermaid events from MCP bridge to all clients
		socket.on("send_to_mermaid", (data: unknown) => {
			console.log(
				"[Socket.IO] ========== SEND_TO_MERMAID LISTENER TRIGGERED ==========",
			);
			console.log(
				"[Socket.IO] Received send_to_mermaid from MCP bridge:",
				data,
			);
			try {
				io.to(`user:${socket.userId}`).emit("send_to_mermaid", data);
				console.log(
					"[Socket.IO] Broadcasted send_to_mermaid to user:",
					socket.userId,
				);
			} catch (error) {
				console.error(
					"[Socket.IO] Failed to broadcast send_to_mermaid:",
					error,
				);
			}
		});

		// Broadcast send_md_file events from MCP bridge to all clients
		socket.on("send_md_file", (data: unknown) => {
			console.log(
				"[Socket.IO] ========== SEND_MD_FILE LISTENER TRIGGERED ==========",
			);
			console.log("[Socket.IO] Received send_md_file from MCP bridge:", data);
			try {
				io.to(`user:${socket.userId}`).emit("send_md_file", data);
				console.log(
					"[Socket.IO] Broadcasted send_md_file to user:",
					socket.userId,
				);
			} catch (error) {
				console.error("[Socket.IO] Failed to broadcast send_md_file:", error);
			}
		});

		// Handle get_preview_request from MCP bridge
		socket.on("get_preview_request", (data: PreviewRequestData) => {
			// Store the requestor socket ID in the data
			const requestData = { ...data, mcpSocketId: socket.id };
			// Broadcast request to the specific user's room
			io.to(`user:${socket.userId}`).emit("get_preview_request", requestData);
		});

		// Handle preview_response from client and forward to MCP bridge
		socket.on("preview_response", (data: PreviewResponseData) => {
			// Send directly to the MCP bridge socket that requested it
			if (data.mcpSocketId) {
				const mcpSocket = io.sockets.sockets.get(data.mcpSocketId);
				if (mcpSocket) {
					mcpSocket.emit("preview_response", data);
				} else {
					console.error(
						"[Socket.IO] MCP bridge socket not found:",
						data.mcpSocketId,
					);
				}
			} else {
				// Fallback: broadcast to all
				io.emit("preview_response", data);
			}
		});

		// Handle TTS notifications from Claude Code hooks
		socket.on("tts_notification", (data: unknown) => {
			try {
				// Broadcast to all clients (since Claude hooks don't have user context)
				io.emit("tts_notification", data);
			} catch (error) {
				console.error(
					"[Socket.IO] Failed to broadcast tts_notification:",
					error,
				);
			}
		});

		// Handle MCP requests
		socket.on("mcp_request", async (data) => {
			try {
				const { method, params, requestId } = data;

				// Store request in database
				if (socket.userId) {
					DatabaseService.createPendingRequest({
						user_id: socket.userId,
						request_id: requestId,
						method,
						params: encode({ params }),
						status: "pending",
					});
				}

				// Handle ask_human tool call
				if (method === "tools/call" && params?.name === "ask_human") {
					const question = params.arguments?.question;
					const userId = params.arguments?.userId || socket.userId;
					if (!question) {
						socket.emit("mcp_error", {
							requestId,
							error: "ask_human requires a question parameter",
						});
						return;
					}

					// Emit to user's UI
					if (socket.userId) {
						io.to(`user:${socket.userId}`).emit("human_question", {
							requestId,
							question,
							userId,
							timestamp: Date.now(),
						});
					}

					// Wait for user's response with 5 minute timeout to prevent memory leaks
					const response = await correlator.waitForWebResponse(
						requestId,
						300000,
						socket.id,
					); // 5 minutes timeout

					// Update database
					if (socket.userId) {
						DatabaseService.updatePendingRequest(requestId, socket.userId, {
							status: "completed",
							response: encode({ response }),
						});
					}

					// Send response back to MCP client
					socket.emit("mcp_response", {
						requestId,
						response:
							(response as { user_input?: unknown })?.user_input || response,
					});

					// Handle send_to_preview tool call
				} else if (
					method === "tools/call" &&
					params?.name === "send_to_preview"
				) {
					const html = params?.arguments?.html ?? "";
					const css = params?.arguments?.css ?? "";

					// Broadcast to all sessions of this user
					if (socket.userId) {
						io.to(`user:${socket.userId}`).emit("send_to_preview", {
							html,
							css,
						});
					}

					// Mark request as completed in DB
					if (socket.userId) {
						DatabaseService.updatePendingRequest(requestId, socket.userId, {
							status: "completed",
							response: encode({ ok: true }),
						});
					}

					// Respond back to MCP client
					socket.emit("mcp_response", {
						requestId,
						response: "Preview updated",
					});
				} else if (method === "chat/completions") {
					// Wait for external LLM response via human (5 min timeout)
					const response = await correlator.waitForWebResponse(
						requestId,
						300000,
						socket.id,
					);

					// Update database
					if (socket.userId) {
						DatabaseService.updatePendingRequest(requestId, socket.userId, {
							status: "completed",
							response: encode({ response }),
						});
					}

					// Send response back to client
					socket.emit("mcp_response", {
						requestId,
						response: {
							type: "external_llm",
							content:
								(response as { user_input?: string })?.user_input ||
								"No response from external LLM",
						},
					});
				} else {
					// Wait for response with timeout
					const response = await correlator.waitForWebResponse(
						requestId,
						30000,
						socket.id,
					);

					// Update database
					if (socket.userId) {
						DatabaseService.updatePendingRequest(requestId, socket.userId, {
							status: "completed",
							response: encode({ response }),
						});
					}

					// Send response back to client
					socket.emit("mcp_response", {
						requestId,
						response,
					});
				}
			} catch (error) {
				console.error("Error handling MCP request:", error);
				socket.emit("mcp_error", {
					requestId: data.requestId,
					error: "Internal server error",
				});
			}
		});

		// Handle user responses to pending requests
		socket.on("user_response", async (data) => {
			try {
				const { requestId, response } = data;

				// Resolve the request using the correlator
				await correlator.resolveRequest(requestId, { user_input: response });

				socket.emit("response_sent", { requestId });
			} catch (error) {
				console.error("Error handling user response:", error);
				socket.emit("error", { message: "Failed to send response" });
			}
		});

		// Handle configuration updates
		socket.on("update_config", async (data) => {
			try {
				const { configId, updates } = data;

				if (!socket.userId) {
					socket.emit("config_error", {
						error: "User not authenticated",
					});
					return;
				}

				const updated = DatabaseService.updateLLMConfiguration(
					configId,
					socket.userId,
					updates,
				);

				if (!updated) {
					socket.emit("config_error", {
						error: "Failed to update configuration",
					});
				}

				socket.emit("config_updated", { configId });
			} catch (error) {
				console.error("Error updating config:", error);
				socket.emit("config_error", {
					error: "Failed to update configuration",
				});
			}
		});

		// Handle disconnection
		socket.on("disconnect", async (reason) => {
			// Clean up all pending requests for this socket
			correlator.cleanupSocket(socket.id);

			// Leave all rooms
			const rooms = Array.from(socket.rooms);
			for (const room of rooms) {
				socket.leave(room);
			}

			// Clear socket-specific state
			if (socket.userId) {
				// Update any pending requests in database to cancelled status
				// This is handled by the correlator cleanup above
			}
		});
	});

	res.socket.server.io = io;

	// Initialize SocketManager with the IO instance
	socketManager.setIO(io);

	res.end();
};

export default SocketHandler;
export const config = { api: { bodyParser: false } };
