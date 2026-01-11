#!/usr/bin/env node

const fs = require("node:fs").promises;
const os = require("node:os");
const path = require("node:path");
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const {
	StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const { io } = require("socket.io-client");
const { encode } = require("@toon-format/toon");

// Sequential Thinking Service - Passes data to UI for Julia processing
class SequentialThinking {
	constructor() {
		this.history = [];
	}

	process(data) {
		// Pass raw data - UI will process with Julia service
		this.history.push(data);

		// Return the raw data as-is for UI to process
		return data;
	}
}

// WebSocket Bridge
class SocketBridge {
	constructor() {
		this.socket = null;
		this.requests = new Map();
		this.isConnected = false;
		this.lastEndpoint = process.env.NEXTJS_URL || "http://localhost:7777";
		this.pendingEmits = [];
		// NO automatic workspace detection - user must provide path manually
	}

	connect() {
		if (this.socket) return; // Already connected or attempting to connect

		// Connecting to Next.js server with robust, automatic reconnection
		this.socket = io(this.lastEndpoint, {
			path: "/api/socket",
			transports: ["websocket", "polling"],
			// Let the library handle all reconnection logic. It will retry indefinitely.
			reconnection: true,
			reconnectionAttempts: Number.POSITIVE_INFINITY,
			reconnectionDelay: 1000,
			reconnectionDelayMax: 10000, // Increase max delay to 10s
			timeout: 20000, // Connection timeout
			autoConnect: true,
		});

		this.socket.on("connect", async () => {
			this.isConnected = true;
			// NO automatic workspace info broadcast - user provides path manually
			// CRITICAL: Restore pending requests from server on initial connect
			await this.restorePendingRequests();
			// Process any pending emits
			this.processPendingEmits();
		});

		this.socket.on("disconnect", (reason) => {
			this.isConnected = false;
			console.error(`[MCP] Socket disconnected: ${reason}`);
			// Cleanup: Clear any pending requests on disconnect
			for (const [requestId, req] of this.requests.entries()) {
				if (req.timeout) {
					clearTimeout(req.timeout);
				}
				if (!req.restored && req.reject) {
					req.reject(new Error(`Socket disconnected: ${reason}`));
				}
			}
			this.requests.clear();
		});

		this.socket.on("connect_error", (error) => {
			console.error("[MCP] ⚠️ Connection error:", error.message);
			this.isConnected = false;
			// The library's auto-reconnect will handle this.
		});

		this.socket.on("reconnect", (attemptNumber) => {
			// Fired on successful reconnection
			this.isConnected = true;
			// NO automatic workspace info broadcast - user provides path manually
			// CRITICAL: Restore pending requests from server after reconnect
			this.restorePendingRequests().then(() => {
				this.processPendingEmits();
			});
		});

		this.socket.on("mcp_response", ({ requestId, response }) => {
			const req = this.requests.get(requestId);
			if (req) {
				// Clear timeout if it exists
				if (req.timeout) {
					clearTimeout(req.timeout);
				}
				this.requests.delete(requestId);
				// Handle both original and restored requests
				if (req.restored) {
					console.error(
						`[MCP] Received response for restored request: ${requestId}`,
					);
					// For restored requests, just log - original promise is gone
				} else {
					req.resolve(response);
				}
			} else {
				console.error(
					`[MCP] Received response for unknown request: ${requestId}`,
				);
			}
		});

		this.socket.on("mcp_error", ({ requestId, error }) => {
			const req = this.requests.get(requestId);
			if (req) {
				// Clear timeout if it exists
				if (req.timeout) {
					clearTimeout(req.timeout);
				}
				this.requests.delete(requestId);
				// Handle both original and restored requests
				if (req.restored) {
					console.error(
						`[MCP] Error for restored request: ${requestId} - ${error}`,
					);
					// For restored requests, just log - original promise is gone
				} else {
					req.reject(new Error(error));
				}
			} else {
				console.error(`[MCP] Received error for unknown request: ${requestId}`);
			}
		});

		// Handle code indexing requests
		this.socket.on("index_folder", async ({ folderPath, requestId }) => {
			console.error(`[MCP] Received index_folder request for: ${folderPath}`);
			try {
				const files = await this.readFolderRecursive(folderPath);
				console.error(`[MCP] Found ${files.length} files to index`);
				this.safeEmit("index_folder_response", { requestId, files });
			} catch (error) {
				console.error("[MCP] Error reading folder:", error);
				this.safeEmit("index_folder_error", {
					requestId,
					error: error.message || "Failed to read folder",
				});
			}
		});

		// File I/O for checkpoints
		this.socket.on("read_file", async ({ filePath, requestId }) => {
			try {
				const fs = require("node:fs").promises;
				const path = require("node:path");

				// Resolve absolute path
				const absolutePath = path.isAbsolute(filePath)
					? filePath
					: path.join(process.cwd(), filePath);

				const content = await fs.readFile(absolutePath, "utf-8");
				this.safeEmit(`file_read_response_${requestId}`, { content });
			} catch (error) {
				console.error("[MCP] Error reading file:", error);
				this.safeEmit(`file_read_response_${requestId}`, {
					error: error.message,
				});
			}
		});

		this.socket.on("write_file", async ({ filePath, content, requestId }) => {
			try {
				const fs = require("node:fs").promises;
				const path = require("node:path");

				// Resolve absolute path
				const absolutePath = path.isAbsolute(filePath)
					? filePath
					: path.join(process.cwd(), filePath);

				// Ensure directory exists
				await fs.mkdir(path.dirname(absolutePath), { recursive: true });

				// Write file
				await fs.writeFile(absolutePath, content, "utf-8");
				this.safeEmit(`file_write_response_${requestId}`, { success: true });
			} catch (error) {
				console.error("[MCP] Error writing file:", error);
				this.safeEmit(`file_write_response_${requestId}`, {
					error: error.message,
				});
			}
		});
	}

	async readFolderRecursive(folderPath) {
		const files = [];
		const DEFAULT_IGNORE_PATTERNS = [
			"node_modules",
			"dist",
			"build",
			"out",
			"target",
			"coverage",
			".git",
			".svn",
			".hg",
			".vscode",
			".idea",
			"__pycache__",
			".cache",
			"logs",
			"tmp",
			"temp",
			".env",
		];
		const DEFAULT_EXTENSIONS = [
			".ts",
			".tsx",
			".js",
			".jsx",
			".py",
			".java",
			".cpp",
			".c",
			".h",
			".cs",
			".go",
			".rs",
			".php",
			".rb",
			".swift",
			".kt",
			".md",
		];

		async function scan(dir) {
			try {
				const entries = await fs.readdir(dir, { withFileTypes: true });

				for (const entry of entries) {
					const fullPath = path.join(dir, entry.name);

					// Check ignore patterns
					const shouldIgnore = DEFAULT_IGNORE_PATTERNS.some(
						(pattern) =>
							entry.name.includes(pattern) ||
							fullPath.includes(path.sep + pattern + path.sep),
					);

					if (shouldIgnore) continue;

					if (entry.isDirectory()) {
						await scan(fullPath);
					} else if (entry.isFile()) {
						const ext = path.extname(entry.name);
						if (DEFAULT_EXTENSIONS.includes(ext)) {
							try {
								const content = await fs.readFile(fullPath, "utf-8");
								files.push({
									path: fullPath,
									name: entry.name,
									extension: ext,
									content,
								});
							} catch (readError) {
								console.error(
									`[MCP] Error reading file ${fullPath}:`,
									readError.message,
								);
							}
						}
					}
				}
			} catch (error) {
				console.error(`[MCP] Error scanning directory ${dir}:`, error.message);
			}
		}

		await scan(folderPath);
		return files;
	}

	async restorePendingRequests() {
		try {
			console.error("[MCP] 🔄 Restoring pending requests from server...");

			// Fetch pending requests from Next.js API
			const response = await fetch(
				`${this.lastEndpoint}/api/pending-requests`,
				{
					method: "GET",
					headers: { "Content-Type": "application/json" },
				},
			);

			if (!response.ok) {
				console.error(
					"[MCP] ⚠️ Failed to fetch pending requests:",
					response.status,
				);
				return;
			}

			const pendingRequests = await response.json();
			console.error(`[MCP] Found ${pendingRequests.length} pending requests`);

			// Restore each pending request
			for (const req of pendingRequests) {
				if (!this.requests.has(req.request_id)) {
					console.error(`[MCP] ✅ Restoring request: ${req.request_id}`);
					// Create a new promise for this restored request
					this.requests.set(req.request_id, {
						resolve: () => {}, // Will be replaced when response arrives
						reject: () => {},
						question: req.params?.question || "",
						userId: req.params?.userId || "mock-user-123",
						timestamp: new Date(req.created_at).getTime(),
						restored: true,
					});
				}
			}

			console.error("[MCP] ✅ Pending requests restored");
		} catch (error) {
			console.error(
				"[MCP] ❌ Error restoring pending requests:",
				error.message,
			);
		}
	}

	processPendingEmits() {
		if (this.pendingEmits.length === 0) return;

		console.error(`[MCP] Processing ${this.pendingEmits.length} pending emits`);

		const emits = [...this.pendingEmits];
		this.pendingEmits = [];

		for (const { event, data } of emits) {
			try {
				this.socket.emit(event, data);
				console.error(`[MCP] ✅ Sent pending emit: ${event}`);
			} catch (error) {
				console.error(`[MCP] ❌ Failed to send pending emit: ${event}`, error);
				// Re-queue if failed
				this.pendingEmits.push({ event, data });
			}
		}
	}

	safeEmit(event, data) {
		if (!this.socket) {
			console.error(
				`[MCP] ⚠️ Cannot emit ${event}: socket not initialized. Queueing...`,
			);
			this.pendingEmits.push({ event, data });
			return false;
		}

		if (!this.isConnected || !this.socket.connected) {
			console.error(
				`[MCP] ⚠️ Cannot emit ${event}: socket disconnected. Queueing...`,
			);
			this.pendingEmits.push({ event, data });
			// The socket.io client will automatically try to reconnect.
			return false;
		}

		try {
			this.socket.emit(event, data);
			return true;
		} catch (error) {
			console.error(`[MCP] ❌ Error emitting ${event}:`, error);
			this.pendingEmits.push({ event, data });
			return false;
		}
	}

	askHuman(question, userId = "mock-user-123") {
		return new Promise((resolve, reject) => {
			const requestId = `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

			// Create timeout to prevent memory leaks (5 minutes for human response)
			const timeout = setTimeout(() => {
				const req = this.requests.get(requestId);
				if (req) {
					console.error(
						`[MCP] ⚠️  Request timeout after 5 minutes: ${requestId}`,
					);
					this.requests.delete(requestId); // CLEANUP orphaned request
					reject(
						new Error("Request timeout after 5 minutes - no response received"),
					);
				}
			}, 300000); // 5 minutes timeout

			// Store request with metadata and timeout reference
			this.requests.set(requestId, {
				resolve,
				reject,
				question,
				userId,
				timestamp: Date.now(),
				timeout, // Store timeout so we can clear it on response
			});

			const success = this.safeEmit("mcp_request", {
				method: "tools/call",
				params: {
					name: "ask_human",
					// Ensure arguments are always an object
					arguments: {
						question: question || "",
						userId: userId || "mock-user-123",
					},
				},
				requestId,
			});

			if (!success) {
				console.error("[MCP] ask_human queued due to disconnection");
			}
			// Request queued if disconnected
		});
	}

	emitThought(thought) {
		this.safeEmit("sequential_thinking", thought);
	}

	sendToPreview(html, css) {
		const data = { html, css };
		this.safeEmit("send_to_preview", data);
	}

	sendToMermaid(mermaid) {
		console.error(
			"[MCP] sendToMermaid called with mermaid length:",
			mermaid?.length,
		);
		console.error("[MCP] Socket connected?", this.socket.connected);
		console.error("[MCP] Socket ID:", this.socket.id);
		console.error("[MCP] Emitting send_to_mermaid event...");

		const data = { mermaid };
		console.error(
			"[MCP] Data to emit:",
			JSON.stringify(data).substring(0, 200),
		);
		this.safeEmit("send_to_mermaid", data);

		console.error("[MCP] send_to_mermaid event emitted");
	}

	sendMdFile(content, filename) {
		console.error(
			"[MCP] sendMdFile called with content length:",
			content?.length,
			"filename:",
			filename,
		);
		console.error("[MCP] Socket connected?", this.socket.connected);
		console.error("[MCP] Socket ID:", this.socket.id);
		console.error("[MCP] Emitting send_md_file event...");

		const data = { content, filename };
		console.error(
			"[MCP] Data to emit:",
			JSON.stringify(data).substring(0, 200),
		);
		this.safeEmit("send_md_file", data);

		console.error("[MCP] send_md_file event emitted");
	}

	async getPreview() {
		if (!this.isConnected) {
			// Return fallback instead of throwing
			return Promise.resolve({
				html: "",
				css: "",
				error: "Socket disconnected",
				fallback: true,
			});
		}

		const requestId = `get_preview_${Date.now()}`;

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.socket.off("preview_response");
				// Resolve with empty fallback instead of rejecting
				resolve({
					html: "",
					css: "",
					error: "Preview not available (timeout)",
					fallback: true,
				});
			}, 30000); // 30 seconds timeout

			this.socket.once("preview_response", (data) => {
				clearTimeout(timeout);
				resolve(data);
			});

			const success = this.safeEmit("get_preview_request", { requestId });
			if (!success) {
				clearTimeout(timeout);
				this.socket.off("preview_response");
				reject(
					new Error("Failed to emit get_preview_request - socket disconnected"),
				);
			}
		});
	}
}

// Tool Definitions
const TOOLS = [
	{
		name: "ask_human",
		description: "Ask a human user for input or assistance",
		inputSchema: {
			type: "object",
			properties: {
				question: { type: "string", description: "The question to ask" },
				userId: { type: "string", default: "mock-user-123" },
			},
			required: ["question"],
		},
	},
	{
		name: "sequentialthinking",
		description: "Dynamic problem-solving through sequential thoughts",
		inputSchema: {
			type: "object",
			properties: {
				thought: { type: "string" },
				nextThoughtNeeded: { type: "boolean" },
				thoughtNumber: { type: "integer", minimum: 1 },
				totalThoughts: { type: "integer", minimum: 1 },
			},
			required: [
				"thought",
				"nextThoughtNeeded",
				"thoughtNumber",
				"totalThoughts",
			],
		},
	},
	{
		name: "send_to_preview",
		description:
			"Send HTML and CSS code to the Preview tab for visual rendering and editing. Use this to show the user visual components, layouts, or designs.",
		inputSchema: {
			type: "object",
			properties: {
				html: {
					type: "string",
					description:
						"HTML code (body content only, no DOCTYPE or html/head/body tags)",
				},
				css: {
					type: "string",
					description: "CSS code (optional, can be empty string)",
				},
			},
			required: ["html"],
		},
	},
	{
		name: "get_preview",
		description:
			"Fetch the current HTML and CSS code from the user's Preview tab. Use this to see what the user has edited or to read the current state before making modifications.",
		inputSchema: {
			type: "object",
			properties: {},
			required: [],
		},
	},
	{
		name: "send_to_mermaid",
		description:
			"Send Mermaid diagram code to the Mermaid tab for visual rendering. Use this to show the user diagrams, flowcharts, sequence diagrams, or any other Mermaid-supported visualizations.",
		inputSchema: {
			type: "object",
			properties: {
				mermaid: {
					type: "string",
					description: "Mermaid diagram code (e.g., 'graph TD; A-->B; B-->C;')",
				},
			},
			required: ["mermaid"],
		},
	},
	{
		name: "send_md_file",
		description:
			"Send markdown content to create a new note file in the user's notes panel. Use this to save documentation, summaries, guides, or any markdown-formatted content for the user to reference later.",
		inputSchema: {
			type: "object",
			properties: {
				content: {
					type: "string",
					description: "Markdown content to save in the note file",
				},
				filename: {
					type: "string",
					description:
						"Optional filename for the note (without .md extension). If not provided, a default name will be generated.",
				},
			},
			required: ["content"],
		},
	},
];

// Initialize
const thinking = new SequentialThinking();
const socket = new SocketBridge();
const server = new Server(
	{ name: "human-assistant", version: "1.0.0" },
	{ capabilities: { tools: {} } },
);

// Register Handlers
server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
	const { name, arguments: args } = request.params;

	if (name === "sequentialthinking") {
		const rawThoughtData = thinking.process(args);
		// Emit raw thought data - UI will process with Julia service
		socket.emitThought(rawThoughtData);
		return {
			content: [
				{
					type: "text",
					text: encode({
						thought: {
							number: rawThoughtData.thoughtNumber,
							total: rawThoughtData.totalThoughts,
							next_needed: rawThoughtData.nextThoughtNeeded,
						},
					}),
				},
			],
		};
	}

	if (name === "ask_human") {
		const response = await socket.askHuman(args.question, args.userId);
		const text =
			typeof response === "object"
				? response.user_input || encode({ response })
				: response;
		// Clean up the request from persistence now that it's resolved
		// Note: This part is implicitly handled by how we receive responses, but an explicit cleanup is safer.
		return {
			content: [{ type: "text", text: `${text}` }],
		};
	}

	if (name === "send_to_preview") {
		// EXACTLY like sequentialthinking - call the method on socket
		socket.sendToPreview(args.html, args.css || "");
		return {
			content: [
				{
					type: "text",
					text: encode({
						result: {
							success: true,
							message: "HTML/CSS sent to Preview tab successfully",
							html_length: args.html?.length || 0,
							css_length: (args.css || "").length,
						},
					}),
				},
			],
		};
	}

	if (name === "send_to_mermaid") {
		console.error("[MCP] send_to_mermaid tool called with args:", {
			mermaidLength: args.mermaid?.length,
		});
		socket.sendToMermaid(args.mermaid);
		console.error("[MCP] socket.sendToMermaid method called");
		return {
			content: [
				{
					type: "text",
					text: encode({
						result: {
							success: true,
							message: "Mermaid diagram sent successfully",
							diagram_length: args.mermaid?.length || 0,
						},
					}),
				},
			],
		};
	}

	if (name === "send_md_file") {
		console.error("[MCP] send_md_file tool called with args:", {
			contentLength: args.content?.length,
			filename: args.filename,
		});
		socket.sendMdFile(args.content, args.filename);
		console.error("[MCP] socket.sendMdFile method called");
		return {
			content: [
				{
					type: "text",
					text: encode({
						result: {
							success: true,
							message: "Markdown file sent to notes successfully",
							content_length: args.content?.length || 0,
							filename: args.filename || "auto-generated",
						},
					}),
				},
			],
		};
	}

	if (name === "get_preview") {
		const preview = await socket.getPreview();

		// Handle fallback/timeout gracefully
		if (preview.fallback || preview.error) {
			return {
				content: [
					{
						type: "text",
						text: encode({
							error: {
								message: "Preview content not available",
								reason: preview.error || "timeout",
								fallback: true,
							},
						}),
					},
				],
			};
		}

		return {
			content: [
				{
					type: "text",
					text: encode({
						preview: {
							html: preview.html,
							css: preview.css,
							html_length: preview.html.length,
							css_length: preview.css.length,
						},
					}),
				},
			],
		};
	}

	return {
		content: [{ type: "text", text: `Unknown tool: ${name}` }],
		isError: true,
	};
});

// Graceful shutdown handler
let shuttingDown = false;
function setupGracefulShutdown() {
	const shutdown = async (signal) => {
		if (shuttingDown) {
			return;
		}
		shuttingDown = true;
		console.error(`[MCP] Received ${signal}, shutting down gracefully...`);

		// Cleanup: Disconnect socket
		if (socket.socket) {
			console.error("[MCP] Disconnecting socket...");
			socket.socket.disconnect();
			socket.socket = null;
			socket.isConnected = false;
		}

		// Cleanup: Clear all pending requests and reject them so callers don't hang
		for (const [requestId, req] of socket.requests.entries()) {
			if (req.timeout) {
				clearTimeout(req.timeout);
			}
			if (req.reject) {
				req.reject(new Error("MCP server shutting down"));
			}
		}
		socket.requests.clear();

		// Cleanup: Close server transport
		try {
			await server.close();
			console.error("[MCP] Server transport closed.");
		} catch (error) {
			console.error("[MCP] Error closing server:", error);
		}

		process.exit(0);
	};

	process.on("SIGINT", () => shutdown("SIGINT"));
	process.on("SIGTERM", () => shutdown("SIGTERM"));

	process.on("exit", () => {
		console.error("[MCP] Process exiting, performing final cleanup...");
		if (socket.socket) {
			socket.socket.disconnect();
		}
		// If shutdown already ran, requests are already cleared/rejected.
		// If not, clear them here as a last resort.
		socket.requests.clear();
	});
}

// Start Server
async function start() {
	const transport = new StdioServerTransport();
	await server.connect(transport);

	// Setup graceful shutdown handlers
	setupGracefulShutdown();

	// Only enable WebSocket if not explicitly disabled.
	// This allows the MCP server to run standalone for testing or other integrations.
	if (process.env.MCP_ENABLE_WEBSOCKET !== "false") {
		socket.connect();
		console.error("[MCP] Server running with WebSocket support enabled.");
	} else {
		console.error("[MCP] Server running (stdio only - WebSocket disabled).");
	}
}

start();
