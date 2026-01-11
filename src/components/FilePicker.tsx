"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
	ChevronRight,
	File,
	FileCode,
	FileImage,
	FileText,
	Folder,
	FolderUp,
	Search,
} from "lucide-react";
import React, {
	useState,
	useEffect,
	useRef,
	useCallback,
	useMemo,
} from "react";

// IndexedDB storage for directory handle
const DB_NAME = "FilePickerDB";
const DB_VERSION = 1;
const STORE_NAME = "directoryHandle";

async function initDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: "id" });
			}
		};
	});
}

async function saveDirectoryHandle(
	handle: FileSystemDirectoryHandle,
): Promise<void> {
	try {
		const db = await initDB();
		const transaction = db.transaction([STORE_NAME], "readwrite");
		const store = transaction.objectStore(STORE_NAME);
		await store.put({ id: "current", handle });
	} catch (err) {
		console.error("Failed to save directory handle:", err);
	}
}

async function loadDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
	try {
		const db = await initDB();
		const transaction = db.transaction([STORE_NAME], "readonly");
		const store = transaction.objectStore(STORE_NAME);
		const request = store.get("current");

		return new Promise((resolve) => {
			request.onsuccess = () => {
				const result = request.result;
				resolve(result?.handle || null);
			};
			request.onerror = () => resolve(null);
		});
	} catch (err) {
		console.error("Failed to load directory handle:", err);
		return null;
	}
}

interface FileEntry {
	name: string;
	path: string;
	is_directory: boolean;
	size: number;
	extension?: string;
}

interface FilePickerProps {
	/**
	 * Callback when a file/directory is selected
	 */
	onSelect: (entry: FileEntry) => void;
	/**
	 * Callback to close the picker
	 */
	onClose: () => void;
	/**
	 * Initial search query
	 */
	initialQuery?: string;
	/**
	 * Optional className for styling
	 */
	className?: string;
	/**
	 * Whether to allow directory selection
	 */
	allowDirectorySelection?: boolean;
	/**
	 * Auto-open folder picker if no folder selected
	 */
	autoOpenPicker?: boolean;
}

// File icon mapping based on extension
const getFileIcon = (entry: FileEntry) => {
	if (entry.is_directory) return Folder;

	const ext = entry.extension?.toLowerCase();
	switch (ext) {
		case "js":
		case "jsx":
		case "ts":
		case "tsx":
		case "py":
		case "java":
		case "cpp":
		case "c":
		case "go":
		case "rs":
			return FileCode;
		case "md":
		case "txt":
		case "json":
		case "xml":
		case "yaml":
		case "yml":
			return FileText;
		case "png":
		case "jpg":
		case "jpeg":
		case "gif":
		case "svg":
		case "webp":
		case "ico":
			return FileImage;
		default:
			return File;
	}
};

// Format file size to human readable
const formatFileSize = (bytes: number): string => {
	if (bytes === 0) return "";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
};

// Common ignore patterns (same as mcp-server.js)
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
	".next",
	".pnp",
	".vercel",
];

// Check if entry should be ignored
const shouldIgnoreEntry = (entry: FileEntry): boolean => {
	// Skip hidden files/directories except .claude
	if (entry.name.startsWith(".") && entry.name !== ".claude") {
		return true;
	}

	// Check ignore patterns
	return DEFAULT_IGNORE_PATTERNS.some((pattern) => {
		return (
			entry.name === pattern ||
			entry.name.includes(pattern) ||
			entry.path.includes(`/${pattern}/`) ||
			entry.path.includes(`\\${pattern}\\`) ||
			entry.path.endsWith(`/${pattern}`) ||
			entry.path.endsWith(`\\${pattern}`)
		);
	});
};

// Convert FileSystemHandle to FileEntry
const handleToEntry = async (
	handle: FileSystemHandle,
	parentPath = "",
): Promise<FileEntry> => {
	const path = parentPath ? `${parentPath}/${handle.name}` : handle.name;

	if (handle.kind === "directory") {
		return {
			name: handle.name,
			path,
			is_directory: true,
			size: 0,
		};
	}
	const fileHandle = handle as FileSystemFileHandle;
	const file = await fileHandle.getFile();
	const extension = handle.name.includes(".")
		? handle.name.split(".").pop()?.toLowerCase()
		: undefined;
	return {
		name: handle.name,
		path,
		is_directory: false,
		size: file.size,
		extension,
	};
};

const FilePickerComponent: React.FC<FilePickerProps> = ({
	onSelect,
	onClose,
	initialQuery = "",
	className,
	allowDirectorySelection = false,
	autoOpenPicker = false,
}) => {
	const [directoryHandle, setDirectoryHandle] =
		useState<FileSystemDirectoryHandle | null>(null);
	const [currentPath, setCurrentPath] = useState<string[]>([]);
	const [entries, setEntries] = useState<FileEntry[]>([]);
	const [searchQuery, setSearchQuery] = useState(initialQuery);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isRestoring, setIsRestoring] = useState(true);

	const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
	const fileListRef = useRef<HTMLDivElement>(null);
	const loadDirectoryRef = useRef<typeof loadDirectory | null>(null);

	useEffect(() => {
		setSearchQuery(initialQuery);
	}, [initialQuery]);

	// Computed values
	const displayEntries = useMemo(() => {
		let filtered = entries;

		// Filter by search query if present
		if (searchQuery.trim()) {
			filtered = entries.filter((entry) =>
				entry.name.toLowerCase().includes(searchQuery.toLowerCase()),
			);
		}

		// Sort: directories first, then files, alphabetically within each group
		return filtered.sort((a, b) => {
			if (a.is_directory !== b.is_directory) {
				return a.is_directory ? -1 : 1;
			}
			return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
		});
	}, [entries, searchQuery]);

	const canGoBack = currentPath.length > 0;

	// Get relative path for display
	const relativePath =
		currentPath.length === 0 ? "/" : `/${currentPath.join("/")}`;

	// Load directory contents from FileSystemDirectoryHandle
	const loadDirectory = useCallback(
		async (
			handle: FileSystemDirectoryHandle | null,
			path: string[] = currentPath,
		) => {
			if (!handle) {
				setEntries([]);
				setIsLoading(false);
				return;
			}

			try {
				setIsLoading(true);
				setError(null);

				const entriesList: FileEntry[] = [];
				const pathString = path.join("/");

				for await (const handleEntry of (
					handle as FileSystemDirectoryHandle & {
						values(): AsyncIterableIterator<FileSystemHandle>;
					}
				).values()) {
					const entry = await handleToEntry(handleEntry, pathString);

					// Filter out ignored files/directories
					if (!shouldIgnoreEntry(entry)) {
						entriesList.push(entry);
					}
				}

				// Sort: directories first, then files, alphabetically within each group
				entriesList.sort((a, b) => {
					if (a.is_directory !== b.is_directory) {
						return a.is_directory ? -1 : 1;
					}
					return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
				});

				setEntries(entriesList);
				setIsLoading(false);
			} catch (err: unknown) {
				// Handle "not allowed" errors and all other errors silently
				const error = err as { name?: string; message?: string };
				if (
					error?.name === "NotAllowedError" ||
					error?.message?.includes("not allowed") ||
					error?.message?.includes("user agent")
				) {
					// Permission error - clear handle silently, show file picker button
					setDirectoryHandle(null);
					setError(null);
					setEntries([]);
					try {
						const db = await initDB();
						const transaction = db.transaction([STORE_NAME], "readwrite");
						const store = transaction.objectStore(STORE_NAME);
						await store.delete("current");
					} catch {
						// Silently ignore
					}
				} else {
					// Other error - silently fail
					setError(null);
					setEntries([]);
				}
				setIsLoading(false);
			}
		},
		[currentPath],
	);

	// Keep ref updated
	useEffect(() => {
		loadDirectoryRef.current = loadDirectory;
	}, [loadDirectory]);

	// Open folder picker
	const handleOpenFolder = useCallback(async () => {
		try {
			if (!("showDirectoryPicker" in window)) {
				// Silently fail - just don't show picker
				return;
			}

			const handle = await (
				window as Window & {
					showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
				}
			).showDirectoryPicker();
			setDirectoryHandle(handle);
			setCurrentPath([]);
			setError(null);
			await saveDirectoryHandle(handle);
			await loadDirectory(handle, []);
		} catch (err: unknown) {
			const error = err as { name?: string };
			if (error.name === "AbortError") {
				// User cancelled - silently handle
				return;
			}
			// Silently fail - don't show error to user
			setError(null);
		}
	}, [loadDirectory]);

	// Restore directory handle on mount
	// biome-ignore lint/correctness/useExhaustiveDependencies: loadDirectory is stable
	useEffect(() => {
		let cancelled = false;

		(async () => {
			try {
				const handle = await loadDirectoryHandle();
				if (cancelled) {
					setIsRestoring(false);
					return;
				}

				if (handle) {
					// Try to use the handle directly - if it works, great!
					// If it fails, silently clear it and show file picker button
					// Check permission before accessing handle to prevent "not allowed" errors
					try {
						const permissionStatus = await (
							handle as FileSystemDirectoryHandle & {
								queryPermission(descriptor: { mode: string }): Promise<string>;
							}
						).queryPermission({
							mode: "read",
						});
						if (permissionStatus === "granted") {
							setDirectoryHandle(handle);
							setCurrentPath([]);
							await loadDirectory(handle, []);
						} else {
							// Permission not granted - silently clear handle
							try {
								const db = await initDB();
								const transaction = db.transaction([STORE_NAME], "readwrite");
								const store = transaction.objectStore(STORE_NAME);
								await store.delete("current");
							} catch {
								// Silently ignore
							}
							setDirectoryHandle(null);
							setError(null);

							// Auto-open picker if requested
							if (autoOpenPicker) {
								await handleOpenFolder();
							}
						}
					} catch (err: unknown) {
						// Any error - silently clear handle to prevent "not allowed" errors
						try {
							const db = await initDB();
							const transaction = db.transaction([STORE_NAME], "readwrite");
							const store = transaction.objectStore(STORE_NAME);
							await store.delete("current");
						} catch {
							// Silently ignore
						}
						setDirectoryHandle(null);
						setError(null);

						// Auto-open picker if requested
						if (autoOpenPicker) {
							await handleOpenFolder();
						}
					}
				} else {
					// No handle saved - auto-open picker if requested
					if (autoOpenPicker) {
						await handleOpenFolder();
					}
				}
			} catch {
				// Silently fail - just show file picker button
				setDirectoryHandle(null);
				setError(null);

				// Auto-open picker if requested
				if (autoOpenPicker) {
					await handleOpenFolder();
				}
			} finally {
				if (!cancelled) {
					setIsRestoring(false);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [autoOpenPicker]);

	// Navigate into directory
	const navigateToDirectory = useCallback(
		async (entry: FileEntry) => {
			if (!directoryHandle || !entry.is_directory) return;

			try {
				const newPath = [...currentPath, entry.name];
				let currentHandle = directoryHandle;

				// Navigate to the subdirectory
				for (const segment of newPath) {
					currentHandle = await currentHandle.getDirectoryHandle(segment);
				}

				setCurrentPath(newPath);
				setSearchQuery("");
				setSelectedIndex(0);
				await loadDirectoryRef.current?.(currentHandle, newPath);
			} catch (err) {
				// Silently fail - don't show error
				setError(null);
			}
		},
		[directoryHandle, currentPath],
	);

	// Navigate back
	const navigateBack = useCallback(async () => {
		if (!directoryHandle || currentPath.length === 0) return;

		try {
			const newPath = currentPath.slice(0, -1);
			let currentHandle = directoryHandle;

			// Navigate to parent directory
			for (const segment of newPath) {
				currentHandle = await currentHandle.getDirectoryHandle(segment);
			}

			setCurrentPath(newPath);
			setSearchQuery("");
			setSelectedIndex(0);
			await loadDirectoryRef.current?.(currentHandle, newPath);
		} catch (err) {
			// Silently fail - don't show error
			setError(null);
		}
	}, [directoryHandle, currentPath]);

	// Search function (client-side only)
	const performSearch = useCallback(
		async (query: string) => {
			if (!directoryHandle || !query.trim()) {
				return;
			}

			try {
				setIsLoading(true);
				setError(null);

				const results: FileEntry[] = [];
				const queryLower = query.toLowerCase();

				// Recursive search function
				const searchRecursive = async (
					handle: FileSystemDirectoryHandle,
					path: string[],
					depth: number,
				) => {
					if (depth > 5 || results.length >= 50) return;

					for await (const handleEntry of (
						handle as FileSystemDirectoryHandle & {
							values(): AsyncIterableIterator<FileSystemHandle>;
						}
					).values()) {
						// Skip ignored entries
						const tempEntry = await handleToEntry(handleEntry, path.join("/"));
						if (shouldIgnoreEntry(tempEntry)) {
							continue;
						}

						if (handleEntry.name.toLowerCase().includes(queryLower)) {
							results.push(tempEntry);
							if (results.length >= 50) return;
						}

						if (handleEntry.kind === "directory") {
							const dirHandle = handleEntry as FileSystemDirectoryHandle;
							await searchRecursive(
								dirHandle,
								[...path, handleEntry.name],
								depth + 1,
							);
						}
					}
				};

				let currentHandle = directoryHandle;
				for (const segment of currentPath) {
					currentHandle = await currentHandle.getDirectoryHandle(segment);
				}

				await searchRecursive(currentHandle, currentPath, 0);

				// Sort results
				results.sort((a, b) => {
					if (a.is_directory !== b.is_directory) {
						return a.is_directory ? -1 : 1;
					}
					return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
				});

				setEntries(results);
				setIsLoading(false);
			} catch (err) {
				// Silently fail - don't show error
				setError(null);
				setIsLoading(false);
			}
		},
		[directoryHandle, currentPath],
	);

	// Debounced search
	// biome-ignore lint/correctness/useExhaustiveDependencies: loadDirectory and performSearch are stable
	useEffect(() => {
		if (searchDebounceRef.current) {
			clearTimeout(searchDebounceRef.current);
		}

		if (searchQuery.trim()) {
			searchDebounceRef.current = setTimeout(() => {
				performSearch(searchQuery);
			}, 300);
		} else {
			// Reload current directory when search is cleared
			if (directoryHandle) {
				(async () => {
					let currentHandle = directoryHandle;
					for (const segment of currentPath) {
						currentHandle = await currentHandle.getDirectoryHandle(segment);
					}
					await loadDirectory(currentHandle, currentPath);
				})();
			}
		}

		return () => {
			if (searchDebounceRef.current) {
				clearTimeout(searchDebounceRef.current);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchQuery, directoryHandle, currentPath]);

	// Reset selected index when entries change
	useEffect(() => {
		setSelectedIndex(0);
	}, []);

	// Keyboard navigation
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			switch (e.key) {
				case "Escape":
					e.preventDefault();
					onClose();
					break;

				case "Enter":
					e.preventDefault();
					if (
						displayEntries.length > 0 &&
						selectedIndex < displayEntries.length
					) {
						onSelect(displayEntries[selectedIndex]);
					}
					break;

				case "ArrowDown":
					e.preventDefault();
					setSelectedIndex((prev) =>
						Math.min(displayEntries.length - 1, prev + 1),
					);
					break;

				case "ArrowRight":
					e.preventDefault();
					if (
						displayEntries.length > 0 &&
						selectedIndex < displayEntries.length
					) {
						const entry = displayEntries[selectedIndex];
						if (entry.is_directory) {
							navigateToDirectory(entry);
						}
					}
					break;

				case "ArrowLeft":
					e.preventDefault();
					if (canGoBack) {
						navigateBack();
					}
					break;
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		displayEntries,
		selectedIndex,
		canGoBack,
		navigateToDirectory,
		navigateBack,
		onClose,
		onSelect,
	]);

	// Scroll selected item into view
	useEffect(() => {
		if (fileListRef.current) {
			const selectedElement = fileListRef.current.querySelector(
				`[data-index="${selectedIndex}"]`,
			);
			if (selectedElement) {
				selectedElement.scrollIntoView({
					block: "nearest",
					behavior: "smooth",
				});
			}
		}
	}, [selectedIndex]);

	const handleEntryClick = useCallback(
		(entry: FileEntry) => {
			onSelect(entry);
		},
		[onSelect],
	);

	const handleEntryDoubleClick = useCallback(
		(entry: FileEntry) => {
			if (entry.is_directory) {
				navigateToDirectory(entry);
			}
		},
		[navigateToDirectory],
	);

	// Don't render anything while restoring or if no folder selected
	// The autoOpenPicker logic will handle opening the picker automatically
	if (isRestoring || !directoryHandle) {
		return null;
	}

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.95 }}
			className={cn(
				"fixed bottom-auto top-auto left-0 z-50",
				"w-[500px] h-[400px]",
				"bg-background border border-border rounded-lg shadow-lg",
				"flex flex-col overflow-hidden",
				className,
			)}
			style={{ position: "absolute", bottom: "100%", marginBottom: "0.5rem" }}
		>
			{/* Header */}
			<div className="border-b border-border p-3">
				{/* Search input */}
				<div className="relative">
					<Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search files..."
						className="w-full pl-8 pr-8 py-1.5 text-sm bg-muted/50 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					/>
					<button
						type="button"
						onClick={handleOpenFolder}
						className="absolute right-2 top-1/2 transform -translate-y-1/2 transition-colors"
						title="Choose source folder"
					>
						<FolderUp className="h-4 w-4 text-muted-foreground hover:text-foreground" />
					</button>
				</div>
			</div>

			{/* File List */}
			<div className="flex-1 overflow-y-auto relative">
				{isLoading && displayEntries.length === 0 && (
					<div className="flex items-center justify-center h-full">
						<span className="text-sm text-muted-foreground">Loading...</span>
					</div>
				)}

				{!isLoading && !error && displayEntries.length === 0 && (
					<div className="flex flex-col items-center justify-center h-full">
						<Search className="h-8 w-8 text-muted-foreground mb-2" />
						<span className="text-sm text-muted-foreground">
							{searchQuery.trim() ? "No files found" : "Empty directory"}
						</span>
					</div>
				)}

				{displayEntries.length > 0 && (
					<div className="p-2 space-y-0.5" ref={fileListRef}>
						{displayEntries.map((entry, index) => {
							const Icon = getFileIcon(entry);
							const isSearching = searchQuery.trim() !== "";
							const isSelected = index === selectedIndex;

							return (
								<button
									type="button"
									key={entry.path}
									data-index={index}
									onClick={() => handleEntryClick(entry)}
									onDoubleClick={() => handleEntryDoubleClick(entry)}
									onMouseEnter={() => setSelectedIndex(index)}
									className={cn(
										"w-full flex items-center gap-2 px-2 py-1.5 rounded-md",
										"text-left text-sm",
										isSelected ? "bg-white text-black" : "hover:bg-accent/50",
									)}
									title={
										entry.is_directory
											? "Click to select • Double-click to enter"
											: "Click to select"
									}
								>
									<Icon
										className={cn(
											"h-4 w-4 flex-shrink-0",
											entry.is_directory
												? "text-blue-500"
												: "text-muted-foreground",
										)}
									/>

									<span className="flex-1 truncate">{entry.name}</span>

									{!entry.is_directory && entry.size > 0 && (
										<span className="text-xs text-muted-foreground">
											{formatFileSize(entry.size)}
										</span>
									)}

									{entry.is_directory && (
										<ChevronRight className="h-4 w-4 text-muted-foreground" />
									)}

									{isSearching && (
										<span className="text-xs text-muted-foreground font-mono truncate max-w-[150px]">
											{entry.path}
										</span>
									)}
								</button>
							);
						})}
					</div>
				)}
			</div>

			{/* Footer */}
			<div className="border-t border-border p-2">
				<p className="text-xs text-muted-foreground text-center">
					↑↓ Navigate • Enter Select • → Enter Directory • ← Go Back • Esc Close
				</p>
			</div>
		</motion.div>
	);
};

FilePickerComponent.displayName = "FilePicker";

export const FilePicker = React.memo(FilePickerComponent);
