import type { Server as SocketIOServer } from "socket.io";

class SocketManager {
	private static instance: SocketManager;
	private io: SocketIOServer | null = null;

	private constructor() {}

	static getInstance(): SocketManager {
		if (!SocketManager.instance) {
			SocketManager.instance = new SocketManager();
		}
		return SocketManager.instance;
	}

	setIO(io: SocketIOServer): void {
		this.io = io;
		// Also set it in global scope for hooks that need it
		(global as { globalIO?: typeof io }).globalIO = io;
		console.log(
			"[SocketManager] ✅ Socket.IO server initialized and available globally",
		);
	}

	getIO(): SocketIOServer | null {
		return this.io;
	}

	// Emit to all connected clients
	emit(event: string, data: unknown): boolean {
		if (!this.io) {
			console.error(
				`[SocketManager] ❌ Cannot emit '${event}': Socket.IO not initialized`,
			);
			return false;
		}
		this.io.emit(event, data);
		console.log(`[SocketManager] ✅ Emitted '${event}' event to all clients`);
		return true;
	}

	// Emit to specific user room
	emitToUser(userId: string, event: string, data: unknown): boolean {
		if (!this.io) {
			console.error(
				`[SocketManager] ❌ Cannot emit '${event}' to user ${userId}: Socket.IO not initialized`,
			);
			return false;
		}
		this.io.to(`user:${userId}`).emit(event, data);
		console.log(
			`[SocketManager] ✅ Emitted '${event}' event to user:${userId}`,
		);
		return true;
	}

	// Check if socket is initialized
	isInitialized(): boolean {
		return this.io !== null;
	}

	// Get socket server instance for advanced operations
	getServer(): SocketIOServer | null {
		return this.io;
	}
}

export const socketManager = SocketManager.getInstance();
export default socketManager;
