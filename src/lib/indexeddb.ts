// IndexedDB service for local storage
import type { DiagramData } from "../../lib/mermaid-types";
import type { ContentType } from "./contentDetector";

const DB_NAME = "HumanLoopDB";
const DB_VERSION = 8; // Unified files table with auto-detected content types

interface DBSchema {
	spells: {
		key: string;
		value: {
			id: string;
			name: string;
			prompt: string;
			timestamp: string;
		};
	};
	preview: {
		key: string;
		value: {
			id: string;
			html: string;
			css: string;
			timestamp: string;
		};
	};
	files: {
		key: string;
		value: {
			id: string;
			name: string;
			content: string; // Universal content field
			detectedType: ContentType; // Auto-detected content type
			timestamp: string;
			position?: { x: number; y: number };
			diagramData?: DiagramData; // For Mermaid files (preserve existing)
		};
	};
	globalCss: {
		key: string;
		value: {
			id: string;
			css: string;
			timestamp: string;
		};
	};
	chatSettings: {
		key: string;
		value: {
			id: string;
			fontFamily: string;
			fontSize: number;
			timestamp: string;
		};
	};
	chatPrompts: {
		key: string;
		value: {
			id: string;
			permanentPrompt: string;
			subPrompt?: string;
			skillsPrompt: string;
			timestamp: string;
		};
	};
	noteFiles: {
		key: string;
		value: {
			id: string;
			name: string;
			content: string;
			timestamp: string;
		};
	};
}

class IndexedDBService {
	private db: IDBDatabase | null = null;
	private initPromise: Promise<void> | null = null;

	private createTransaction(
		storeNames: string[],
		mode: IDBTransactionMode,
	): IDBTransaction {
		if (!this.db) {
			throw new Error("Database not initialized");
		}
		const transaction = this.db.transaction(storeNames, mode);
		if (!transaction) {
			throw new Error("Failed to create transaction");
		}
		return transaction;
	}

	private async withTimeout<T>(
		promise: Promise<T>,
		timeoutMs = 5000,
	): Promise<T> {
		return Promise.race([
			promise,
			new Promise<T>((_, reject) =>
				setTimeout(
					() => reject(new Error("Database operation timeout")),
					timeoutMs,
				),
			),
		]);
	}

	async init(): Promise<void> {
		// If already initialized, return immediately
		if (this.db) {
			return Promise.resolve();
		}

		// If initialization is in progress, wait for it
		if (this.initPromise) {
			return this.initPromise;
		}

		// Start new initialization
		this.initPromise = new Promise((resolve, reject) => {
			const request = window.indexedDB.open(DB_NAME, DB_VERSION);

			request.onerror = () => {
				this.initPromise = null;
				reject(request.error);
			};
			request.onsuccess = async () => {
				this.db = request.result;
				this.initPromise = null;

				resolve();
			};

			request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
				const db = (event.target as IDBOpenDBRequest).result;
				const oldVersion = event.oldVersion;

				// Create new tables
				if (!db.objectStoreNames.contains("spells")) {
					db.createObjectStore("spells", { keyPath: "id" });
				}

				if (!db.objectStoreNames.contains("preview")) {
					db.createObjectStore("preview", { keyPath: "id" });
				}

				if (!db.objectStoreNames.contains("files")) {
					db.createObjectStore("files", { keyPath: "id" });
				}

				if (!db.objectStoreNames.contains("globalCss")) {
					db.createObjectStore("globalCss", { keyPath: "id" });
				}

				if (!db.objectStoreNames.contains("chatSettings")) {
					db.createObjectStore("chatSettings", { keyPath: "id" });
				}

				if (!db.objectStoreNames.contains("chatPrompts")) {
					db.createObjectStore("chatPrompts", { keyPath: "id" });
				}

				if (!db.objectStoreNames.contains("noteFiles")) {
					db.createObjectStore("noteFiles", { keyPath: "id" });
				}

				// Migrate from old schema to new unified files table
				if (oldVersion < 8) {
					// Migration will happen asynchronously after upgrade completes
					console.log(
						"[DB-MIGRATION] Database upgraded to version 8, migration will run...",
					);
				}
			};
		});

		return this.initPromise;
	}

	async saveSpell(spell: DBSchema["spells"]["value"]): Promise<void> {
		if (!this.db) await this.init();

		return new Promise((resolve, reject) => {
			try {
				const transaction = this.createTransaction(["spells"], "readwrite");
				const store = transaction.objectStore("spells");
				const request = store.put(spell);

				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			} catch (error) {
				reject(error);
			}
		});
	}

	async getSpells(): Promise<DBSchema["spells"]["value"][]> {
		if (!this.db) await this.init();

		return new Promise((resolve, reject) => {
			try {
				const transaction = this.createTransaction(["spells"], "readonly");
				const store = transaction.objectStore("spells");
				const request = store.getAll();

				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			} catch (error) {
				reject(error);
			}
		});
	}

	async deleteSpell(id: string): Promise<void> {
		if (!this.db) await this.init();

		return new Promise((resolve, reject) => {
			try {
				const transaction = this.createTransaction(["spells"], "readwrite");
				const store = transaction.objectStore("spells");
				const request = store.delete(id);

				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			} catch (error) {
				reject(error);
			}
		});
	}

	async savePreview(preview: DBSchema["preview"]["value"]): Promise<void> {
		if (!this.db) await this.init();

		return new Promise((resolve, reject) => {
			try {
				const transaction = this.createTransaction(["preview"], "readwrite");
				const store = transaction.objectStore("preview");
				const request = store.put(preview);

				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			} catch (error) {
				reject(error);
			}
		});
	}

	async getPreview(): Promise<DBSchema["preview"]["value"] | null> {
		if (!this.db) await this.init();

		return new Promise((resolve, reject) => {
			try {
				const transaction = this.createTransaction(["preview"], "readonly");
				const store = transaction.objectStore("preview");
				const request = store.get("current");

				request.onsuccess = () => resolve(request.result || null);
				request.onerror = () => reject(request.error);
			} catch (error) {
				reject(error);
			}
		});
	}

	// Global CSS methods
	async saveGlobalCss(css: string): Promise<void> {
		if (!this.db) await this.init();

		const data: DBSchema["globalCss"]["value"] = {
			id: "global",
			css,
			timestamp: new Date().toISOString(),
		};

		return this.withTimeout(
			new Promise((resolve, reject) => {
				try {
					const transaction = this.createTransaction(
						["globalCss"],
						"readwrite",
					);
					const store = transaction.objectStore("globalCss");
					const request = store.put(data);

					request.onsuccess = () => resolve();
					request.onerror = () => reject(request.error);
				} catch (error) {
					reject(error);
				}
			}),
			5000,
		);
	}

	async getGlobalCss(): Promise<string> {
		if (!this.db) await this.init();

		return this.withTimeout(
			new Promise((resolve, reject) => {
				try {
					const transaction = this.createTransaction(["globalCss"], "readonly");
					const store = transaction.objectStore("globalCss");
					const request = store.get("global");

					request.onsuccess = () => resolve(request.result?.css || "");
					request.onerror = () => reject(request.error);
				} catch (error) {
					reject(error);
				}
			}),
			5000,
		);
	}

	// Chat Settings methods
	async saveChatSettings(settings: {
		fontFamily: string;
		fontSize: number;
	}): Promise<void> {
		if (!this.db) await this.init();

		const data: DBSchema["chatSettings"]["value"] = {
			id: "current",
			fontFamily: settings.fontFamily,
			fontSize: settings.fontSize,
			timestamp: new Date().toISOString(),
		};

		return new Promise((resolve, reject) => {
			try {
				const transaction = this.createTransaction(
					["chatSettings"],
					"readwrite",
				);
				const store = transaction.objectStore("chatSettings");
				const request = store.put(data);

				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			} catch (error) {
				reject(error);
			}
		});
	}

	async getChatSettings(): Promise<{
		fontFamily: string;
		fontSize: number;
	} | null> {
		if (!this.db) await this.init();

		return new Promise((resolve, reject) => {
			try {
				const transaction = this.createTransaction(
					["chatSettings"],
					"readonly",
				);
				const store = transaction.objectStore("chatSettings");
				const request = store.get("current");

				request.onsuccess = () => {
					if (request.result) {
						resolve({
							fontFamily: request.result.fontFamily,
							fontSize: request.result.fontSize,
						});
					} else {
						resolve(null);
					}
				};
				request.onerror = () => reject(request.error);
			} catch (error) {
				reject(error);
			}
		});
	}

	// Chat Prompts methods
	async saveChatPrompts(prompts: {
		permanentPrompt: string;
		subPrompt?: string;
		skillsPrompt: string;
	}): Promise<void> {
		if (!this.db) await this.init();

		const data: DBSchema["chatPrompts"]["value"] = {
			id: "current",
			permanentPrompt: prompts.permanentPrompt,
			subPrompt: prompts.subPrompt || "",
			skillsPrompt: prompts.skillsPrompt,
			timestamp: new Date().toISOString(),
		};

		return new Promise((resolve, reject) => {
			try {
				const transaction = this.createTransaction(
					["chatPrompts"],
					"readwrite",
				);
				const store = transaction.objectStore("chatPrompts");
				const request = store.put(data);

				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			} catch (error) {
				reject(error);
			}
		});
	}

	async getChatPrompts(): Promise<{
		permanentPrompt: string;
		subPrompt?: string;
		skillsPrompt: string;
	} | null> {
		if (!this.db) await this.init();

		return new Promise((resolve, reject) => {
			try {
				const transaction = this.createTransaction(["chatPrompts"], "readonly");
				const store = transaction.objectStore("chatPrompts");
				const request = store.get("current");

				request.onsuccess = () => {
					if (request.result) {
						resolve({
							permanentPrompt: request.result.permanentPrompt,
							subPrompt: request.result.subPrompt || "",
							skillsPrompt: request.result.skillsPrompt,
						});
					} else {
						resolve(null);
					}
				};
				request.onerror = () => reject(request.error);
			} catch (error) {
				reject(error);
			}
		});
	}

	// Note Files methods
	async saveNoteFile(file: DBSchema["noteFiles"]["value"]): Promise<void> {
		if (!this.db) await this.init();

		return new Promise((resolve, reject) => {
			try {
				const transaction = this.createTransaction(["noteFiles"], "readwrite");
				const store = transaction.objectStore("noteFiles");
				const request = store.put(file);

				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			} catch (error) {
				reject(error);
			}
		});
	}

	async getNoteFiles(): Promise<DBSchema["noteFiles"]["value"][]> {
		if (!this.db) await this.init();

		return new Promise((resolve, reject) => {
			try {
				const transaction = this.createTransaction(["noteFiles"], "readonly");
				const store = transaction.objectStore("noteFiles");
				const request = store.getAll();

				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			} catch (error) {
				reject(error);
			}
		});
	}

	async getNoteFile(
		id: string,
	): Promise<DBSchema["noteFiles"]["value"] | null> {
		if (!this.db) await this.init();

		return new Promise((resolve, reject) => {
			try {
				const transaction = this.createTransaction(["noteFiles"], "readonly");
				const store = transaction.objectStore("noteFiles");
				const request = store.get(id);

				request.onsuccess = () => resolve(request.result || null);
				request.onerror = () => reject(request.error);
			} catch (error) {
				reject(error);
			}
		});
	}

	async deleteNoteFile(id: string): Promise<void> {
		if (!this.db) await this.init();

		return new Promise((resolve, reject) => {
			try {
				const transaction = this.createTransaction(["noteFiles"], "readwrite");
				const store = transaction.objectStore("noteFiles");
				const request = store.delete(id);

				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			} catch (error) {
				reject(error);
			}
		});
	}

	// Unified files methods
	async saveFile(file: DBSchema["files"]["value"]): Promise<void> {
		if (!this.db) await this.init();

		return new Promise((resolve, reject) => {
			try {
				const transaction = this.createTransaction(["files"], "readwrite");
				const store = transaction.objectStore("files");
				const request = store.put(file);

				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			} catch (error) {
				reject(error);
			}
		});
	}

	async getFiles(): Promise<DBSchema["files"]["value"][]> {
		if (!this.db) await this.init();

		return new Promise((resolve, reject) => {
			try {
				const transaction = this.createTransaction(["files"], "readonly");
				const store = transaction.objectStore("files");
				const request = store.getAll();

				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			} catch (error) {
				reject(error);
			}
		});
	}

	async getFile(id: string): Promise<DBSchema["files"]["value"] | null> {
		if (!this.db) await this.init();

		return new Promise((resolve, reject) => {
			try {
				const transaction = this.createTransaction(["files"], "readonly");
				const store = transaction.objectStore("files");
				const request = store.get(id);

				request.onsuccess = () => resolve(request.result || null);
				request.onerror = () => reject(request.error);
			} catch (error) {
				reject(error);
			}
		});
	}

	async deleteFile(id: string): Promise<void> {
		if (!this.db) await this.init();

		return new Promise((resolve, reject) => {
			try {
				const transaction = this.createTransaction(["files"], "readwrite");
				const store = transaction.objectStore("files");
				const request = store.delete(id);

				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			} catch (error) {
				reject(error);
			}
		});
	}
}

export const indexedDB = new IndexedDBService();
