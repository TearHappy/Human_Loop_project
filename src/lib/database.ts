import { decode } from "@toon-format/toon";
import bcrypt from "bcryptjs";

// In-memory storage
interface Session {
	id: string;
	user_id: string;
	created_at: string;
	last_activity: string;
}

// Use global singleton to persist storage across Next.js hot reloads and API route contexts
const globalForStorage = global as typeof globalThis & {
	inMemoryStorage?: {
		users: Map<string, User & { password_hash: string }>;
		llm_configurations: Map<string, LLMConfig>;
		pending_requests: Map<string, PendingRequest>;
		sessions: Map<string, Session>;
	};
};

const inMemoryStorage = globalForStorage.inMemoryStorage ?? {
	users: new Map<string, User & { password_hash: string }>(),
	llm_configurations: new Map<string, LLMConfig>(),
	pending_requests: new Map<string, PendingRequest>(),
	sessions: new Map<string, Session>(),
};

// Persist to global to survive hot reloads
if (process.env.NODE_ENV !== "production") {
	globalForStorage.inMemoryStorage = inMemoryStorage;
}

export interface User {
	id: string;
	email: string;
	full_name?: string;
	created_at: string;
	updated_at: string;
}

export interface LLMConfig {
	id: string;
	user_id: string;
	name: string;
	model_name: string;
	api_key: string;
	base_url: string;
	temperature: number;
	max_tokens: number;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface PendingRequest {
	id: string;
	user_id: string;
	request_id: string;
	method: string;
	params: string; // TOON-encoded string
	status: string;
	response?: string; // TOON-encoded string
	created_at: string;
	updated_at: string;
}

// Extended interface with decoded TOON fields for API consumption
export interface PendingRequestDecoded
	extends Omit<PendingRequest, "params" | "response"> {
	params: Record<string, unknown>; // Decoded from TOON
	response?: unknown; // Decoded from TOON
}

export class DatabaseService {
	// TOON Decoding Helpers
	private static decodeParams(toonString: string): Record<string, unknown> {
		try {
			const decoded = decode(toonString) as { params: Record<string, unknown> };
			return decoded.params || {};
		} catch (error) {
			console.error("[DB] Failed to decode params:", error);
			return {};
		}
	}

	private static decodeResponse(toonString: string): unknown {
		try {
			const decoded = decode(toonString) as { response: unknown };
			return decoded.response || decoded;
		} catch (error) {
			console.error("[DB] Failed to decode response:", error);
			return null;
		}
	}

	// User operations
	static async createUser(
		email: string,
		password: string,
		fullName?: string,
	): Promise<User> {
		const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		const passwordHash = await bcrypt.hash(password, 10);
		const now = new Date().toISOString();

		const user = {
			id,
			email,
			password_hash: passwordHash,
			full_name: fullName,
			created_at: now,
			updated_at: now,
		};

		inMemoryStorage.users.set(id, user);

		return {
			id: user.id,
			email: user.email,
			full_name: user.full_name,
			created_at: user.created_at,
			updated_at: user.updated_at,
		};
	}

	static async authenticateUser(
		email: string,
		password: string,
	): Promise<User | null> {
		const user = Array.from(inMemoryStorage.users.values()).find(
			(u) => u.email === email,
		);

		if (!user) return null;

		const isValid = await bcrypt.compare(password, user.password_hash);
		if (!isValid) return null;

		return {
			id: user.id,
			email: user.email,
			full_name: user.full_name,
			created_at: user.created_at,
			updated_at: user.updated_at,
		};
	}

	static getUserById(id: string): User | null {
		const user = inMemoryStorage.users.get(id);

		if (!user) return null;

		return {
			id: user.id,
			email: user.email,
			full_name: user.full_name,
			created_at: user.created_at,
			updated_at: user.updated_at,
		};
	}

	static getUserByEmail(email: string): User | null {
		const user = Array.from(inMemoryStorage.users.values()).find(
			(u) => u.email === email,
		);

		if (!user) return null;

		return {
			id: user.id,
			email: user.email,
			full_name: user.full_name,
			created_at: user.created_at,
			updated_at: user.updated_at,
		};
	}

	// LLM Configuration operations
	static getLLMConfigurations(userId: string): LLMConfig[] {
		const configs = Array.from(inMemoryStorage.llm_configurations.values())
			.filter((config) => config.user_id === userId)
			.sort(
				(a, b) =>
					new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
			);

		return configs.map((config) => ({
			...config,
			is_active: Boolean(config.is_active),
		}));
	}

	static createLLMConfiguration(
		config: Omit<LLMConfig, "id" | "created_at" | "updated_at">,
	): LLMConfig {
		const id = `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		const now = new Date().toISOString();

		const newConfig = {
			id,
			user_id: config.user_id,
			name: config.name,
			model_name: config.model_name,
			api_key: config.api_key,
			base_url: config.base_url,
			temperature: config.temperature,
			max_tokens: config.max_tokens,
			is_active: config.is_active,
			created_at: now,
			updated_at: now,
		};

		inMemoryStorage.llm_configurations.set(id, newConfig);

		return {
			...newConfig,
			is_active: Boolean(newConfig.is_active),
		};
	}

	static updateLLMConfiguration(
		id: string,
		userId: string,
		updates: Partial<LLMConfig>,
	): LLMConfig | null {
		const config = inMemoryStorage.llm_configurations.get(id);

		if (!config || config.user_id !== userId) return null;

		const now = new Date().toISOString();
		const updatedConfig = {
			...config,
			...updates,
			id: config.id,
			created_at: config.created_at,
			updated_at: now,
		};

		inMemoryStorage.llm_configurations.set(id, updatedConfig);

		return {
			...updatedConfig,
			is_active: Boolean(updatedConfig.is_active),
		};
	}

	static getLLMConfigurationById(id: string): LLMConfig | null {
		const config = inMemoryStorage.llm_configurations.get(id);

		if (!config) return null;

		return {
			...config,
			is_active: Boolean(config.is_active),
		};
	}

	static deleteLLMConfiguration(id: string, userId: string): boolean {
		const config = inMemoryStorage.llm_configurations.get(id);

		if (!config || config.user_id !== userId) return false;

		return inMemoryStorage.llm_configurations.delete(id);
	}

	static setActiveConfiguration(configId: string, userId: string): void {
		// First, set all configs for this user to inactive
		inMemoryStorage.llm_configurations.forEach((config, id) => {
			if (config.user_id === userId) {
				config.is_active = false;
				inMemoryStorage.llm_configurations.set(id, config);
			}
		});

		// Then set the specified config to active
		const targetConfig = inMemoryStorage.llm_configurations.get(configId);
		if (targetConfig && targetConfig.user_id === userId) {
			targetConfig.is_active = true;
			inMemoryStorage.llm_configurations.set(configId, targetConfig);
		}
	}

	// Pending Request operations
	static createPendingRequest(
		request: Omit<PendingRequest, "id" | "created_at" | "updated_at">,
	): PendingRequest {
		const id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		const now = new Date().toISOString();

		const newRequest = {
			id,
			user_id: request.user_id,
			request_id: request.request_id,
			method: request.method,
			params: request.params,
			status: request.status,
			response: request.response,
			created_at: now,
			updated_at: now,
		};

		inMemoryStorage.pending_requests.set(id, newRequest);
		console.log(
			`[DB] ✅ Created pending request ${id} for user ${request.user_id}. Total requests: ${inMemoryStorage.pending_requests.size}`,
		);

		return newRequest;
	}

	static updatePendingRequest(
		requestId: string,
		userId: string,
		updates: Partial<PendingRequest>,
	): PendingRequest | null {
		const request = Array.from(inMemoryStorage.pending_requests.values()).find(
			(req) => req.request_id === requestId && req.user_id === userId,
		);

		if (!request) return null;

		const now = new Date().toISOString();
		const updatedRequest = {
			...request,
			...updates,
			id: request.id,
			created_at: request.created_at,
			updated_at: now,
		};

		inMemoryStorage.pending_requests.set(request.id, updatedRequest);

		return updatedRequest;
	}

	static getPendingRequestById(id: string): PendingRequest | null {
		return inMemoryStorage.pending_requests.get(id) || null;
	}

	static getPendingRequestByRequestId(
		requestId: string,
	): PendingRequest | null {
		return (
			Array.from(inMemoryStorage.pending_requests.values()).find(
				(req) => req.request_id === requestId,
			) || null
		);
	}

	static getPendingRequestsByUser(userId: string): PendingRequest[] {
		const allRequests = Array.from(inMemoryStorage.pending_requests.values());
		console.log(`[DB] 🔍 Total requests in storage: ${allRequests.length}`);
		const userRequests = allRequests.filter((req) => req.user_id === userId);
		console.log(`[DB] 🔍 Requests for user ${userId}: ${userRequests.length}`);
		return userRequests.sort(
			(a, b) =>
				new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
		);
	}

	// Get pending requests with TOON-decoded params and response
	static getPendingRequestsByUserDecoded(
		userId: string,
	): PendingRequestDecoded[] {
		const requests = DatabaseService.getPendingRequestsByUser(userId);
		return requests.map((req) => ({
			...req,
			params: DatabaseService.decodeParams(req.params),
			response: req.response
				? DatabaseService.decodeResponse(req.response)
				: undefined,
		}));
	}

	// Get single pending request with TOON-decoded fields
	static getPendingRequestByIdDecoded(
		id: string,
	): PendingRequestDecoded | null {
		const req = DatabaseService.getPendingRequestById(id);
		if (!req) return null;
		return {
			...req,
			params: DatabaseService.decodeParams(req.params),
			response: req.response
				? DatabaseService.decodeResponse(req.response)
				: undefined,
		};
	}

	// Get pending request by request_id with TOON-decoded fields
	static getPendingRequestByRequestIdDecoded(
		requestId: string,
	): PendingRequestDecoded | null {
		const req = DatabaseService.getPendingRequestByRequestId(requestId);
		if (!req) return null;
		return {
			...req,
			params: DatabaseService.decodeParams(req.params),
			response: req.response
				? DatabaseService.decodeResponse(req.response)
				: undefined,
		};
	}
}

export default inMemoryStorage;
