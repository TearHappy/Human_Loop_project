import { useCallback, useEffect, useRef, useState } from "react";
import { indexedDB as db } from "../lib/indexeddb";

/**
 * Monaco/VS Code-inspired file manager hook
 * - Path-based file indexing
 * - Lazy content loading (only active file)
 * - Debounced auto-save
 * - No fallbacks - solid engineering
 */

interface NoteFile {
	id: string;
	name: string;
	content: string;
	timestamp: string;
}

interface UseFileManagerReturn {
	files: NoteFile[];
	activeFileId: string | null;
	activeContent: string;
	isLoaded: boolean;
	createFile: (name?: string) => Promise<void>;
	deleteFile: (id: string) => Promise<void>;
	selectFile: (id: string) => void;
	updateContent: (content: string) => void;
}

const DEFAULT_NOTE_NAME = "Untitled Note";
const AUTO_SAVE_DELAY = 500; // ms

export function useFileManager(): UseFileManagerReturn {
	const [files, setFiles] = useState<NoteFile[]>([]);
	const [activeFileId, setActiveFileId] = useState<string | null>(null);
	const [activeContent, setActiveContent] = useState("");
	const [isLoaded, setIsLoaded] = useState(false);

	const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const contentCacheRef = useRef<Map<string, string>>(new Map());

	// Load file list on mount (metadata only, not content)
	useEffect(() => {
		const loadFiles = async () => {
			console.log("[useFileManager] Starting to load files...");
			try {
				const savedFiles = await db.getNoteFiles();
				console.log("[useFileManager] Loaded files from DB:", savedFiles);

				if (savedFiles.length === 0) {
					console.log(
						"[useFileManager] No files found, creating default file...",
					);
					// Create default file if none exist
					const defaultFile: NoteFile = {
						id: `note-${Date.now()}`,
						name: DEFAULT_NOTE_NAME,
						content: "",
						timestamp: new Date().toISOString(),
					};
					await db.saveNoteFile(defaultFile);
					setFiles([defaultFile]);
					setActiveFileId(defaultFile.id);
					setActiveContent("");
					contentCacheRef.current.set(defaultFile.id, "");
					console.log("[useFileManager] Default file created:", defaultFile.id);
				} else {
					// Sort by timestamp descending (newest first)
					const sortedFiles = savedFiles.sort(
						(a, b) =>
							new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
					);
					setFiles(sortedFiles);

					// Select first file and load its content
					const firstFile = sortedFiles[0];
					setActiveFileId(firstFile.id);
					setActiveContent(firstFile.content);
					contentCacheRef.current.set(firstFile.id, firstFile.content);
					console.log(
						"[useFileManager] Loaded existing files, active:",
						firstFile.id,
					);
				}
			} catch (error) {
				console.error("[useFileManager] Failed to load files:", error);
			} finally {
				console.log("[useFileManager] Setting isLoaded to true");
				setIsLoaded(true);
			}
		};

		loadFiles();
	}, []);

	// Debounced auto-save (defined before selectFile so it can be used)
	const saveActiveFile = useCallback(async () => {
		if (!activeFileId) return;

		const file = files.find((f) => f.id === activeFileId);
		if (!file) return;

		const updatedFile: NoteFile = {
			...file,
			content: activeContent,
			timestamp: new Date().toISOString(),
		};

		try {
			await db.saveNoteFile(updatedFile);
			// Update local state
			setFiles((prev) =>
				prev.map((f) => (f.id === activeFileId ? updatedFile : f)),
			);
			// Update cache
			contentCacheRef.current.set(activeFileId, activeContent);
		} catch (error) {
			console.error("[useFileManager] Failed to save file:", error);
		}
	}, [activeFileId, activeContent, files]);

	// Lazy load file content when switching files
	const selectFile = useCallback(
		(id: string) => {
			if (id === activeFileId) return;

			// Save current file before switching
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
				saveActiveFile();
			}

			const cachedContent = contentCacheRef.current.get(id);
			if (cachedContent !== undefined) {
				// Use cached content
				setActiveFileId(id);
				setActiveContent(cachedContent);
			} else {
				// Load from IndexedDB (lazy)
				const file = files.find((f) => f.id === id);
				if (file) {
					setActiveFileId(id);
					setActiveContent(file.content);
					contentCacheRef.current.set(id, file.content);
				}
			}
		},
		[activeFileId, files, saveActiveFile],
	);

	// Update content with debounced save
	const updateContent = useCallback(
		(content: string) => {
			setActiveContent(content);

			// Debounce auto-save
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}

			saveTimeoutRef.current = setTimeout(() => {
				saveActiveFile();
			}, AUTO_SAVE_DELAY);
		},
		[saveActiveFile],
	);

	// Create new file
	const createFile = useCallback(async (name?: string) => {
		const newFile: NoteFile = {
			id: `note-${Date.now()}`,
			name: name || DEFAULT_NOTE_NAME,
			content: "",
			timestamp: new Date().toISOString(),
		};

		try {
			await db.saveNoteFile(newFile);
			setFiles((prev) => [newFile, ...prev]); // Add to beginning
			setActiveFileId(newFile.id);
			setActiveContent("");
			contentCacheRef.current.set(newFile.id, "");
		} catch (error) {
			console.error("[useFileManager] Failed to create file:", error);
		}
	}, []);

	// Delete file
	const deleteFile = useCallback(
		async (id: string) => {
			try {
				await db.deleteNoteFile(id);

				// Update state
				const remainingFiles = files.filter((f) => f.id !== id);
				setFiles(remainingFiles);

				// Clear cache
				contentCacheRef.current.delete(id);

				// If deleted file was active, switch to first remaining file (or create new if none remain)
				if (id === activeFileId) {
					if (remainingFiles.length > 0) {
						const nextFile = remainingFiles[0];
						setActiveFileId(nextFile.id);
						setActiveContent(nextFile.content);
						contentCacheRef.current.set(nextFile.id, nextFile.content);
					} else {
						// No files remain - create a new empty file
						const newFileId = Date.now().toString();
						const newFile = {
							id: newFileId,
							name: "Untitled",
							content: "",
							timestamp: new Date().toISOString(),
						};
						await db.saveNoteFile(newFile);
						setFiles([newFile]);
						setActiveFileId(newFileId);
						setActiveContent("");
						contentCacheRef.current.set(newFileId, "");
					}
				}
			} catch (error) {
				console.error("[useFileManager] Failed to delete file:", error);
			}
		},
		[files, activeFileId],
	);

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
				saveTimeoutRef.current = null;
			}
		};
	}, []);

	return {
		files,
		activeFileId,
		activeContent,
		isLoaded,
		createFile,
		deleteFile,
		selectFile,
		updateContent,
	};
}
