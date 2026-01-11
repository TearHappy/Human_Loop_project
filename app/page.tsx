"use client";

import React, {
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import ReactDOM from "react-dom";
import { PromptInputBox } from "../src/components/LLMChatInput";
import {
	type UsePromptDataResult,
	usePromptData,
} from "../src/hooks/usePromptData";

import {
	AlignCenter,
	AlignLeft,
	AlignRight,
	BookOpen,
	Brain,
	Check,
	Code,
	Copy,
	Download,
	Edit,
	Globe,
	Loader2,
	Maximize2,
	MessageSquare,
	Monitor,
	Moon,
	MousePointerClick,
	Move,
	Network,
	Play,
	Search,
	Settings,
	Smartphone,
	SquareDashedMousePointer,
	SquareStack,
	StickyNote,
	Sun,
	Tablet,
	Target,
	Trash2,
	Upload,
	User,
	XIcon,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import {
	type ReactZoomPanPinchRef,
	TransformComponent,
	TransformWrapper,
} from "react-zoom-pan-pinch";
import { NotesPanel as NotesPanelComponent } from "../components/NotesPanel";
import { WebviewTab } from "../components/WebviewTab";
import { CSSPreview } from "../components/preview/CSSPreview";
import { MermaidEditor } from "../components/preview/MermaidEditor";
import { MermaidView } from "../components/preview/MermaidView";
import { PlainTextView } from "../components/preview/PlainTextView";
import { useMermaidState } from "../components/preview/useMermaidState";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { ScrollArea } from "../components/ui/scroll-area";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "../components/ui/tabs";
import V0InputField from "../components/ui/v0-input-field";
import { generateElementSelectorScript } from "../lib/element-selector-script";
import type { DiagramData } from "../lib/mermaid-types";
// Import components from correct paths based on project structure
import { ChatInterface } from "../src/components/ChatInterface";
import { MobilePanelNavigator } from "../src/components/MobilePanelNavigator";
import { ThinkingPanelContainer } from "../src/components/ThinkingPanelContainer";
import { ChatSessionProvider } from "../src/contexts/ChatSessionContext";
import { PreviewProvider, usePreview } from "../src/contexts/PreviewContext";
import {
	SequentialThinkingProvider,
	useSequentialThinking,
} from "../src/contexts/SequentialThinkingContext";
import type { ContentType } from "../src/lib/contentDetector";
import { detectContentType } from "../src/lib/contentDetector";
import { extractFontsFromCSS, loadGoogleFonts } from "../src/lib/googleFonts";
import { indexedDB as db } from "../src/lib/indexeddb";
import { injectServiceWorker } from "../src/lib/serviceWorkerUtils";

// Mock user for development - will be replaced with proper Supabase auth later
const MOCK_USER = {
	id: "mock-user-123",
	email: "test@example.com",
	full_name: "Test User",
};

// Mock token for development - will be replaced with proper JWT from Supabase later
const MOCK_TOKEN = "mock-jwt-token-for-development";

// Media query helper to avoid rendering multiple ChatInterface instances on small screens
const useIsSmallScreen = () => {
	const [isSmall, setIsSmall] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const media = window.matchMedia("(max-width: 640px)");
		const update = () => setIsSmall(media.matches);
		update();
		media.addEventListener("change", update);
		return () => media.removeEventListener("change", update);
	}, []);

	return isSmall;
};

// Component interface for multi-component view
interface HTMLComponent {
	id: string;
	name: string;
	html: string;
	css: string;
	position: { x: number; y: number };
	scale: number;
}

// Preview Tab Component - HTML Code Editor with Play Button
function PreviewTab({
	notesTab,
	dynamicChatInput,
	onV0Submit,
	onExposeState,
	onModeChange,
}: {
	notesTab: "preview" | "canvas" | "edit";
	dynamicChatInput: React.ReactNode;
	onV0Submit: (
		payload: string | { type: string; [key: string]: unknown },
	) => void;
	onExposeState?: (state: {
		files: Array<{ id: string; name: string }>;
		activeTab: "html" | "css";
		selectedFileId: string | null;
		isPlaying: boolean;
		onSelectFile: (id: string) => void;
		onCreateFile: () => void;
		onDeleteFile: (id: string) => Promise<void>;
		onSetActiveTab: (tab: "html" | "css") => void;
	}) => void;
	onModeChange?: (mode: "preview" | "canvas" | "edit") => void;
}) {
	const {
		htmlContent: contextHtml,
		cssContent: contextCss,
		setHtmlContent: setContextHtml,
		setCssContent: setContextCss,
		isHydrated,
	} = usePreview();

	// State for background theme (with localStorage persistence)
	const [isDarkPreview, setIsDarkPreview] = useState(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("isDarkPreview");
			return saved ? JSON.parse(saved) : false;
		}
		return false;
	});
	const [elementSelectorEnabled, setElementSelectorEnabled] = useState(false);
	const [textAlign, setTextAlign] = useState<"left" | "center" | "right">(
		"left",
	);

	// WAIT for IndexedDB to load before initializing
	const [htmlContent, setHtmlContent] = useState("");
	const [cssContent, setCssContent] = useState("");
	const [isPlaying, setIsPlaying] = useState(true);
	const [initialized, setInitialized] = useState(false);
	const [filesLoaded, setFilesLoaded] = useState(false);

	// Multi-file canvas state (IndexedDB-backed) - MUST be declared before useEffect uses them
	const [files, setFiles] = useState<
		Array<{
			id: string;
			name: string;
			content: string; // Universal content field
			detectedType: ContentType; // Auto-detected content type
			timestamp: string;
			position?: { x: number; y: number };
			diagramData?: DiagramData; // For Mermaid files (preserve existing)
		}>
	>([]);
	const [selectedFileId, setSelectedFileId] = useState<string | null>(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("selectedFileId");
			return saved || null;
		}
		return null;
	});
	const [showColorPicker, setShowColorPicker] = useState(false);
	const [selectedColor, setSelectedColor] = useState("#3b82f6");
	const [activeTab, setActiveTab] = useState<"html" | "css">("html");

	// After mount, read from localStorage and update
	useEffect(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("activeTab");
			if (saved === "css" || saved === "html") {
				setActiveTab(saved);
			}
		}
	}, []);

	// REACTIVE: Auto-load file content when selectedFileId changes
	// Note: This must be after mermaidState declaration
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const overlayRef = useRef<HTMLDivElement>(null);

	// PROFESSIONAL: Update iframe via postMessage (no flash, no remount)
	useEffect(() => {
		if (iframeRef.current?.contentWindow && htmlContent) {
			iframeRef.current.contentWindow.postMessage(
				{
					type: "update",
					html: htmlContent,
					css: cssContent,
				},
				"*",
			);
		}
	}, [htmlContent, cssContent]);

	// Loading and error states
	const [isLoading, setIsLoading] = useState(false);
	const [hasError, setHasError] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");

	// Initialize ONLY AFTER IndexedDB has loaded (isHydrated = true)
	useEffect(() => {
		if (!isHydrated) {
			console.log("[PreviewTab] Waiting for IndexedDB to load...");
			return; // Don't initialize yet
		}

		if (initialized) return; // Already initialized

		console.log(
			"[PreviewTab] Initialized - content loads from htmlFiles + globalCss tables",
		);
		// NO loading from preview table
		// HTML loaded from htmlFiles table in file load useEffect
		// CSS loaded from globalCss table in file load useEffect
		// Content will be set by LOAD-FILES effect based on DB state

		setInitialized(true);
	}, [isHydrated, initialized]);

	// Removed complex context sync - KISS principle
	// Files are managed directly without complex synchronization

	// Removed complex HTML sync - KISS principle
	// Files are managed directly without auto-sync
	const [showMultiView, setShowMultiView] = useState(() => {
		// Load showMultiView from localStorage on mount
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("previewShowMultiView");
			return saved ? JSON.parse(saved) : false;
		}
		return false;
	});

	// Watch notesTab mode changes and update preview states accordingly
	useEffect(() => {
		if (notesTab === "canvas") {
			// Canvas = multi-view canvas
			setShowMultiView(true);
		} else if (notesTab === "edit") {
			// Edit mode = single-file edit (not playing)
			setShowMultiView(false);
			setIsPlaying(false);

			// Load the selected file's content into htmlContent for editing
			if (selectedFileId) {
				const file = files.find((f) => f.id === selectedFileId);
				if (file?.content) {
					setHtmlContent(file.content);
				}
			}
		} else if (notesTab === "preview") {
			// Preview mode = play mode (show rendered preview)
			setShowMultiView(false);
			setIsPlaying(true);
		}
	}, [notesTab, selectedFileId, files]);

	const [canvasZoom, setCanvasZoom] = useState(1);
	const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
	const [isPanning, setIsPanning] = useState(false);
	const [panStart, setPanStart] = useState({ x: 0, y: 0 });
	const canvasRef = useRef<HTMLDivElement>(null);
	const [frameViewports, setFrameViewports] = useState<
		Record<string, "mobile" | "tablet" | "desktop">
	>({});
	const [useGlobalViewport, setUseGlobalViewport] = useState(false);
	const [globalViewportMode, setGlobalViewportMode] = useState<
		"mobile" | "tablet" | "desktop"
	>("desktop");
	const [frameLoadingStates, setFrameLoadingStates] = useState<
		Record<string, boolean>
	>({});
	const [frameErrorStates, setFrameErrorStates] = useState<
		Record<string, boolean>
	>({});
	const transformRef = useRef<ReactZoomPanPinchRef>(null);
	// Dynamic V0 input overlay state
	const [dynamicInputState, setDynamicInputState] = useState<{
		visible: boolean;
		x: number;
		y: number;
	}>({ visible: false, x: 0, y: 0 });
	const previewContainerRef = useRef<HTMLDivElement>(null);
	const [dragState, setDragState] = useState<{
		isDragging: boolean;
		draggedFrame: string | null;
		startPosition: { x: number; y: number };
		currentPosition: { x: number; y: number };
		offset: { x: number; y: number };
	}>({
		isDragging: false,
		draggedFrame: null,
		startPosition: { x: 0, y: 0 },
		currentPosition: { x: 0, y: 0 },
		offset: { x: 0, y: 0 },
	});

	// Performance: Use refs to avoid re-renders during drag
	const dragStateRef = useRef(dragState);
	const rafIdRef = useRef<number | null>(null);

	useEffect(() => {
		dragStateRef.current = dragState;
	}, [dragState]);

	// Superdesign-style viewport presets
	const headerHeightPx = 50;
	const [responsiveConfig, setResponsiveConfig] = useState({
		gridSpacing: 50,
		framesPerRow: 3,
	});
	const getViewportDimensions = (mode: "mobile" | "tablet" | "desktop") => {
		switch (mode) {
			case "mobile":
				return { width: 375, height: 667 };
			case "tablet":
				return { width: 768, height: 1024 };
			default:
				return { width: 1280, height: 800 };
		}
	};

	// Responsive canvas config
	useEffect(() => {
		const updateConfig = () => {
			const width = window.innerWidth;
			if (width < 1200) {
				setResponsiveConfig({ gridSpacing: 30, framesPerRow: 2 });
			} else if (width < 1600) {
				setResponsiveConfig({ gridSpacing: 50, framesPerRow: 3 });
			} else {
				setResponsiveConfig({ gridSpacing: 60, framesPerRow: 4 });
			}
		};
		updateConfig();
		window.addEventListener("resize", updateConfig);
		return () => window.removeEventListener("resize", updateConfig);
	}, []);

	// Compute default grid position for a given index
	const computeDefaultPosition = (index: number) => {
		const mode = useGlobalViewport ? globalViewportMode : "desktop";
		const defaultDims = getViewportDimensions(mode);
		const width = defaultDims.width;
		const height = defaultDims.height + headerHeightPx;
		const col = index % responsiveConfig.framesPerRow;
		const row = Math.floor(index / responsiveConfig.framesPerRow);
		return {
			x: col * (width + responsiveConfig.gridSpacing),
			y: row * (height + responsiveConfig.gridSpacing),
		};
	};

	// Initialize Mermaid state
	const mermaidState = useMermaidState(selectedFileId);

	// REACTIVE: Auto-load file content when selectedFileId changes (after mermaidState is declared)
	// Only update if selectedFileId actually changed, not when files array updates during editing
	const prevSelectedFileIdRef = useRef<string | null>(null);
	useEffect(() => {
		// Only reload if selectedFileId actually changed (file selection changed)
		if (selectedFileId !== prevSelectedFileIdRef.current) {
			prevSelectedFileIdRef.current = selectedFileId;
			if (selectedFileId && files.length > 0) {
				const targetFile = files.find((f) => f.id === selectedFileId);
				if (targetFile) {
					// Load content based on detected type
					if (targetFile.detectedType === "mermaid") {
						// Load Mermaid diagram
						mermaidState.loadDiagram(selectedFileId);
					} else {
						// For HTML, CSS, Markdown, Text - load into editor
						const fileContent = targetFile.content || "";
						setHtmlContent((current) =>
							current !== fileContent ? fileContent : current,
						);
						setActiveTab("html");
					}
				}
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedFileId, mermaidState, files]); // Trigger when files array changes

	// ═══════════════════════════════════════════════════════════
	// UNIFIED FILES LOADING - HTML + Mermaid
	// ═══════════════════════════════════════════════════════════
	// Use ref to track if we've already loaded to prevent infinite loops
	const hasLoadedFilesRef = useRef(false);

	useEffect(() => {
		if (!initialized || hasLoadedFilesRef.current) return;

		const loadFilesFromDB = async () => {
			try {
				console.log(
					"[FILES-LOAD-1] Loading files from unified IndexedDB table...",
				);

				// Load all files from unified table
				const allFiles = await db.getFiles().catch(() => []);

				console.log(`[FILES-LOAD-2] Found ${allFiles.length} files`);

				// Sort by timestamp (newest first)
				allFiles.sort(
					(a, b) =>
						new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
				);

				const hasLoadedOnce =
					sessionStorage.getItem("previewFilesInitialized") === "true";

				if (allFiles.length === 0 && !hasLoadedOnce) {
					// FIRST TIME LOAD: Create initial file 1
					console.log(
						"[FILES-LOAD-3] First time load - creating initial file 1",
					);
					const id = Date.now().toString();
					const initialContent = contextHtml || "";
					const initialFile = {
						id,
						name: "1",
						content: initialContent,
						detectedType: detectContentType(initialContent),
						timestamp: new Date().toISOString(),
						position: { x: 0, y: 0 },
					};
					await db.saveFile(initialFile);
					setFiles([initialFile]);
					setSelectedFileId(id);
					// Removed content loading - let the useEffect at line 446 handle it
				} else if (allFiles.length > 0) {
					// FILES EXIST: Load them
					console.log("[FILES-LOAD-3] Loading existing files");
					setFiles(allFiles);

					// Select first file - content will be loaded by useEffect at line 446
					const firstId = allFiles[0].id;
					setSelectedFileId(firstId);
				} else {
					// USER DELETED ALL: Show empty
					console.log("[FILES-LOAD-3] User deleted all - EMPTY state");
					setFiles([]);
					setSelectedFileId(null);
					setHtmlContent("");
					// Only set contextHtml to empty if it's not already empty to prevent circular dependency
					if (contextHtml) {
						setContextHtml("");
					}
				}

				sessionStorage.setItem("previewFilesInitialized", "true");
				setFilesLoaded(true);
				hasLoadedFilesRef.current = true;
			} catch (e) {
				console.error("[FILES-LOAD-ERROR] Failed to load files:", e);
				setFilesLoaded(true);
				hasLoadedFilesRef.current = true;
			}
		};

		loadFilesFromDB();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [initialized, contextHtml, setContextHtml]); // Only depend on initialized - removed problematic dependencies

	// Load isPlaying from localStorage after mount (fixes hydration error)
	useEffect(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("previewIsPlaying");
			if (saved) {
				setIsPlaying(JSON.parse(saved));
			}
		}
	}, []);

	// ═══════════════════════════════════════════════════════════
	// OLD POLLING SYSTEM REMOVED - Now using immediate synchronous activation!
	// ═══════════════════════════════════════════════════════════
	// No more polling! Preview/play mode activation is now immediate and event-driven.

	// ═══════════════════════════════════════════════════════════
	// GLOBAL CSS LOADING - Separate from HTML
	// ═══════════════════════════════════════════════════════════
	useEffect(() => {
		if (!initialized) return;

		const loadGlobalCssFromDB = async () => {
			try {
				console.log("[CSS-LOAD-1] Loading global CSS from IndexedDB...");
				const globalCss = await db.getGlobalCss().catch(() => "");
				console.log("[CSS-LOAD-2] CSS length:", globalCss?.length || 0);

				if (globalCss) {
					console.log("[CSS-LOAD-3] Setting CSS content");
					setCssContent(globalCss);
					setContextCss(globalCss);
				} else {
					console.log("[CSS-LOAD-3] No CSS in database");
					setCssContent("");
					setContextCss("");
				}
			} catch (e) {
				console.error("[CSS-LOAD-ERROR] Failed to load CSS:", e);
			}
		};

		loadGlobalCssFromDB();
	}, [initialized, setContextCss]);

	// ═══════════════════════════════════════════════════════════
	// IMMEDIATE PLAY MODE ACTIVATION - No polling! Synchronous!
	// ═══════════════════════════════════════════════════════════
	useEffect(() => {
		if (!initialized) return;

		const handleImmediatePlayMode = (event: CustomEvent) => {
			console.log(
				"[IMMEDIATE-PLAY] Received immediate play mode request:",
				event.detail,
			);

			const { fileId, html, css } = event.detail;

			// Update files state by loading the saved file (preserves consistent numeric naming)
			if (fileId && html) {
				(async () => {
					try {
						const allFiles = await db.getFiles().catch(() => []);
						const saved = allFiles.find((f) => f.id === fileId);
						if (saved) {
							setFiles((prev) =>
								prev.some((f) => f.id === fileId) ? prev : [...prev, saved],
							);
						}
					} catch (e) {
						// noop
					}
				})();

				// Auto-select the new file and switch to play mode immediately
				// React batches these updates automatically - no setTimeout needed
				setSelectedFileId(fileId);
				setHtmlContent(html);
				setContextHtml(html);
				setIsPlaying(true);
				console.log(
					"[IMMEDIATE-PLAY] IMMEDIATE play mode activated - no polling delay!",
				);
			}
		};

		if (typeof window !== "undefined") {
			window.addEventListener(
				"immediatePlayMode",
				handleImmediatePlayMode as EventListener,
			);

			return () => {
				window.removeEventListener(
					"immediatePlayMode",
					handleImmediatePlayMode as EventListener,
				);
			};
		}
	}, [initialized, setContextHtml]);

	// Load viewport preferences from IndexedDB
	useEffect(() => {
		const loadViewports = async () => {
			try {
				const saved = localStorage.getItem("frameViewports");
				if (saved) {
					setFrameViewports(JSON.parse(saved));
				}
				const globalMode = localStorage.getItem("globalViewportMode");
				if (globalMode) {
					setGlobalViewportMode(globalMode as "mobile" | "tablet" | "desktop");
				}
				const useGlobal = localStorage.getItem("useGlobalViewport");
				if (useGlobal) {
					setUseGlobalViewport(useGlobal === "true");
				}
			} catch (e) {
				console.error("[PreviewTab] Failed to load viewport preferences", e);
			}
		};
		loadViewports();
	}, []);

	// Save viewport preferences
	useEffect(() => {
		try {
			localStorage.setItem("frameViewports", JSON.stringify(frameViewports));
			localStorage.setItem("globalViewportMode", globalViewportMode);
			localStorage.setItem("useGlobalViewport", useGlobalViewport.toString());
		} catch (e) {
			console.error("[PreviewTab] Failed to save viewport preferences", e);
		}
	}, [frameViewports, globalViewportMode, useGlobalViewport]);

	// Save showMultiView and isPlaying to localStorage
	useEffect(() => {
		try {
			localStorage.setItem(
				"previewShowMultiView",
				JSON.stringify(showMultiView),
			);
			console.log(
				"[PreviewTab] Saved showMultiView to localStorage:",
				showMultiView,
			);
		} catch (e) {
			console.error("[PreviewTab] Failed to save showMultiView", e);
		}
	}, [showMultiView]);

	useEffect(() => {
		try {
			localStorage.setItem("previewIsPlaying", JSON.stringify(isPlaying));
			console.log("[PreviewTab] Saved isPlaying to localStorage:", isPlaying);
		} catch (e) {
			console.error("[PreviewTab] Failed to save isPlaying", e);
		}
	}, [isPlaying]);

	// Save isDarkPreview to localStorage
	useEffect(() => {
		try {
			localStorage.setItem("isDarkPreview", JSON.stringify(isDarkPreview));
			console.log(
				"[PreviewTab] Saved isDarkPreview to localStorage:",
				isDarkPreview,
			);
		} catch (e) {
			console.error("[PreviewTab] Failed to save isDarkPreview", e);
		}
	}, [isDarkPreview]);

	// Save selectedFileId to localStorage
	useEffect(() => {
		try {
			if (selectedFileId) {
				localStorage.setItem("selectedFileId", selectedFileId);
				console.log(
					"[PreviewTab] Saved selectedFileId to localStorage:",
					selectedFileId,
				);
			}
		} catch (e) {
			console.error("[PreviewTab] Failed to save selectedFileId", e);
		}
	}, [selectedFileId]);

	// Save activeTab to localStorage
	useEffect(() => {
		try {
			localStorage.setItem("activeTab", activeTab);
			console.log("[PreviewTab] Saved activeTab to localStorage:", activeTab);
		} catch (e) {
			console.error("[PreviewTab] Failed to save activeTab", e);
		}
	}, [activeTab]);

	// Auto-switch to new file when received from chat
	useEffect(() => {
		const handleNewFileReceived = (event: CustomEvent) => {
			console.log("[PreviewTab] New file received:", event.detail);
			const { fileId, fileName } = event.detail;

			if (fileId) {
				// Select the new file
				setSelectedFileId(fileId);

				// Switch to play mode to show the preview
				setIsPlaying(true);

				// Exit canvas mode to show single file view
				setShowMultiView(false);

				// Find the file and set its content
				const file = files.find((f) => f.id === fileId);
				if (file) {
					setHtmlContent(file.content || "");
					console.log("[PreviewTab] Switched to new file:", fileName);
				}
			}
		};

		if (typeof window !== "undefined") {
			window.addEventListener(
				"newFileReceived",
				handleNewFileReceived as EventListener,
			);
		}

		return () => {
			if (typeof window !== "undefined") {
				window.removeEventListener(
					"newFileReceived",
					handleNewFileReceived as EventListener,
				);
			}
		};
	}, [files]);

	// Fonts loaded flag
	const fontsLoadedRef = useRef(false);

	// ═══════════════════════════════════════════════════════════
	// UNDO/REDO SYSTEM - Tracks both HTML and CSS changes
	// ═══════════════════════════════════════════════════════════
	const [history, setHistory] = useState<Array<{ html: string; css: string }>>([
		{ html: htmlContent, css: cssContent },
	]);
	const [historyIndex, setHistoryIndex] = useState(0);

	// Stable refs for history and index to avoid stale closures in handlers
	const historyRef = useRef(history);
	const historyIndexRef = useRef(historyIndex);
	useEffect(() => {
		historyRef.current = history;
	}, [history]);
	useEffect(() => {
		historyIndexRef.current = historyIndex;
	}, [historyIndex]);

	const MAX_HISTORY_SIZE = 50;

	const saveToHistory = useCallback(
		(html: string, css: string) => {
			const newHistory = history.slice(0, historyIndex + 1);
			newHistory.push({ html, css });

			// Limit history size
			if (newHistory.length > MAX_HISTORY_SIZE) {
				newHistory.shift(); // Remove oldest entry
				setHistoryIndex((prev) => Math.max(0, prev - 1));
			}

			setHistory(newHistory);
			setHistoryIndex(newHistory.length - 1);
		},
		[history, historyIndex],
	);

	const undoContentChange = useCallback(() => {
		setHistoryIndex((prev) => {
			if (prev > 0) {
				const newIndex = prev - 1;
				const snapshot = historyRef.current[newIndex];
				// Restore both HTML and CSS
				setHtmlContent(snapshot.html);
				setCssContent(snapshot.css);
				setContextHtml(snapshot.html);
				setContextCss(snapshot.css);
				console.log("[UNDO] Restored to index:", newIndex);
				return newIndex;
			}
			return prev;
		});
	}, [setContextHtml, setContextCss]);

	const redoContentChange = useCallback(() => {
		setHistoryIndex((prev) => {
			const lastIndex = historyRef.current.length - 1;
			if (prev < lastIndex) {
				const newIndex = prev + 1;
				const snapshot = historyRef.current[newIndex];
				// Restore both HTML and CSS
				setHtmlContent(snapshot.html);
				setCssContent(snapshot.css);
				setContextHtml(snapshot.html);
				setContextCss(snapshot.css);
				console.log("[REDO] Restored to index:", newIndex);
				return newIndex;
			}
			return prev;
		});
	}, [setContextHtml, setContextCss]);

	// Keyboard shortcuts (Ctrl+Z, Ctrl+Y)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.ctrlKey && e.key === "z") {
				e.preventDefault();
				undoContentChange();
			} else if (e.ctrlKey && e.key === "y") {
				e.preventDefault();
				redoContentChange();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [undoContentChange, redoContentChange]);

	// Listen for changes from iframe
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			if (event.data.type === "elementMoved") {
				// Update HTML content with new positions
				const parser = new DOMParser();
				const doc = parser.parseFromString(htmlContent, "text/html");
				// This is a simplified approach - in production you'd want more sophisticated HTML parsing
				console.log("Element moved:", event.data);
				// For now, we'll update on Edit Mode toggle
			} else if (event.data.type === "contentChanged") {
				// Update HTML content when edited in full preview mode
				console.log("Content changed in preview:", event.data.html);
				const newHtml = event.data.html;
				setHtmlContent(newHtml);
				setContextHtml(newHtml); // Sync to context -> IndexedDB
				saveToHistory(newHtml, cssContent);

				// Validate that selectedFileId exists before saving
				if (selectedFileId) {
					const existing = files.find((f) => f.id === selectedFileId);
					if (existing) {
						// Additional validation: ensure we're saving to the correct file
						if (existing.content !== newHtml) {
							const updated = {
								...existing,
								content: newHtml,
								detectedType: detectContentType(newHtml),
								timestamp: new Date().toISOString(),
							};
							setFiles((prev) =>
								prev.map((f) => (f.id === selectedFileId ? updated : f)),
							);
							db.saveFile(updated).catch((err) =>
								console.error("[PreviewTab] Failed to save file", err),
							);
							console.log("[PreviewTab] Saved changes to file:", existing.name);
						} else {
							console.log("[PreviewTab] No changes to save");
						}
					} else {
						console.error(
							"[PreviewTab] Selected file not found:",
							selectedFileId,
						);
					}
				} else {
					console.error("[PreviewTab] No file selected for saving changes");
				}
			} else if (event.data.type === "elementSelectorClick") {
				// Handle element selector clicks from iframe: forward to onV0Submit and show V0 input
				console.log("[PreviewTab] elementSelectorClick received:", event.data);
				try {
					onV0Submit(event.data);
				} catch (e) {
					console.error("[PreviewTab] onV0Submit handler error", e);
				}
				// Position dynamic input near the clicked coordinates if provided
				if (
					typeof event.data?.x === "number" &&
					typeof event.data?.y === "number"
				) {
					// Get iframe position to convert iframe-relative coords to viewport coords
					const iframe = iframeRef.current;
					if (iframe) {
						const iframeRect = iframe.getBoundingClientRect();
						const viewportX = iframeRect.left + event.data.x;
						const viewportY = iframeRect.top + event.data.y;
						// Clamp within viewport bounds with margin for input width/height
						const vw = window.innerWidth;
						const vh = window.innerHeight;
						const clampedX = Math.max(8, Math.min(viewportX, vw - 320));
						const clampedY = Math.max(8, Math.min(viewportY, vh - 240));
						console.log("[PreviewTab] Positioning overlay at:", {
							clampedX,
							clampedY,
						});
						setDynamicInputState({ visible: true, x: clampedX, y: clampedY });
					} else {
						setDynamicInputState({ visible: true, x: 100, y: 100 });
					}
				} else {
					setDynamicInputState({ visible: true, x: 100, y: 100 });
				}
			}

			// Handle MERMAID_RECEIVED from ChatInterface
			try {
				const parsed =
					typeof event.data === "string" ? JSON.parse(event.data) : event.data;
				if (parsed.type === "MERMAID_RECEIVED") {
					console.log("[PreviewTab] MERMAID_RECEIVED event:", parsed.payload);
					const { fileId, mermaid } = parsed.payload;

					if (fileId && mermaid) {
						// Reload files from database to get the new mermaid file
						db.getFiles()
							.then((allFiles) => {
								setFiles(allFiles);
								// Select the new mermaid file
								setSelectedFileId(fileId);
								// Switch to play mode
								setIsPlaying(true);
								// Exit canvas mode
								setShowMultiView(false);
								console.log("[PreviewTab] Switched to mermaid file:", fileId);
							})
							.catch((err) => {
								console.error("[PreviewTab] Failed to reload files:", err);
							});
					}
				}
			} catch (e) {
				// Not a JSON message, ignore
			}
		};

		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [
		htmlContent,
		cssContent,
		selectedFileId,
		files,
		saveToHistory,
		setContextHtml,
		onV0Submit,
	]);

	// Toggle selector via postMessage (no iframe reload)
	useEffect(() => {
		if (iframeRef.current?.contentWindow) {
			iframeRef.current.contentWindow.postMessage(
				{
					type: "toggleSelector",
					enabled: elementSelectorEnabled,
				},
				"*",
			);
		}
	}, [elementSelectorEnabled]);

	// Hide V0 overlay when selector mode is disabled
	useEffect(() => {
		if (!elementSelectorEnabled && dynamicInputState.visible) {
			setDynamicInputState({ visible: false, x: 0, y: 0 });
		}
	}, [elementSelectorEnabled, dynamicInputState.visible]);

	// V0 overlay only closes on submit, not on outside click

	// Load Google Fonts from CSS
	useEffect(() => {
		if (cssContent && !fontsLoadedRef.current) {
			const fonts = extractFontsFromCSS(cssContent);
			if (fonts.length > 0) {
				console.log("[PreviewTab] Loading Google Fonts:", fonts);
				loadGoogleFonts(fonts).then(() => {
					console.log("[PreviewTab] Google Fonts loaded successfully");
					fontsLoadedRef.current = true;
				});
			}
		}
	}, [cssContent]);

	// ═══════════════════════════════════════════════════════════
	// HTML FILE OPERATIONS - Create, Delete, Duplicate, Open
	// ═══════════════════════════════════════════════════════════

	const createNewFile = useCallback(() => {
		const id = Date.now().toString();
		const defaultContent = ""; // Start with empty content to show placeholder

		// Find lowest available number
		const existingNumbers = files
			.map((f) => {
				const match = f.name.match(/^(\d+)$/);
				return match ? Number.parseInt(match[1], 10) : null;
			})
			.filter((n) => n !== null) as number[];

		let fileNumber = 1;
		while (existingNumbers.includes(fileNumber)) {
			fileNumber++;
		}

		const newFile = {
			id,
			name: `${fileNumber}`,
			content: defaultContent,
			detectedType: "text" as ContentType, // Default to text
			timestamp: new Date().toISOString(),
			position: { x: 0, y: 0 },
		};

		// Update state immediately (non-blocking)
		setFiles((prev) => [...prev, newFile]);
		setSelectedFileId(id);
		setHtmlContent("");
		setActiveTab("html");

		// Save to unified DB table in background (non-blocking)
		db.saveFile(newFile).catch((error) => {
			console.error("[CREATE-FILE] Failed to save file to database:", error);
		});
	}, [files]);

	const deleteFile = useCallback(
		async (fileId: string, fileName: string) => {
			try {
				// Delete from unified DB table
				await db.deleteFile(fileId);

				const remainingFiles = files.filter((f) => f.id !== fileId);

				// If deleting the active file, switch selection to next file
				if (fileId === selectedFileId && remainingFiles.length > 0) {
					const currentIndex = files.findIndex((f) => f.id === fileId);
					const nextFile = remainingFiles[currentIndex] || remainingFiles[0];
					setSelectedFileId(nextFile.id);
				} else if (fileId === selectedFileId && remainingFiles.length === 0) {
					setSelectedFileId(null);
					setHtmlContent("");
					setContextHtml("");
				}

				setFiles(remainingFiles);
			} catch (err) {
				console.error("[DELETE-ERROR] Failed to delete file:", err);
			}
		},
		[files, selectedFileId, setContextHtml],
	);

	const duplicateFile = async (fileId: string) => {
		console.log("[FILE-DUPLICATE-1] Duplicating file:", fileId);
		const file = files.find((f) => f.id === fileId);
		if (!file) return;

		const id = Date.now().toString();
		const index = files.length;
		const pos = computeDefaultPosition(index);
		const duplicated = {
			id,
			name: `${file.name} (Copy)`,
			content: file.content,
			detectedType: file.detectedType,
			timestamp: new Date().toISOString(),
			position: pos,
		};
		await db.saveFile(duplicated);
		setFiles((prev) => [...prev, duplicated]);
		console.log("[FILE-DUPLICATE-2] File duplicated:", duplicated.name);
	};

	const createFileFromLLM = async (content: string, name?: string) => {
		console.log("[FILE-LLM-1] Creating file from LLM response...");
		const id = Date.now().toString();
		const index = files.length;
		const pos = computeDefaultPosition(index);
		const file = {
			id,
			name: name || `LLM Response ${index + 1}`,
			content,
			detectedType: detectContentType(content),
			timestamp: new Date().toISOString(),
			position: pos,
		};
		await db.saveFile(file);
		setFiles((prev) => [...prev, file]);
		console.log("[FILE-LLM-2] LLM file created:", file.name);
		return file;
	};

	const openHtmlFileFullScreen = (fileId: string) => {
		const file = files.find((f) => f.id === fileId);
		if (!file) return;

		// Direct, simple updates - React 18 auto-batches for best performance
		setSelectedFileId(fileId);
		setShowMultiView(false);
		onModeChange?.("preview");
	};

	// Expose state to parent (for FileTabsHeader integration)
	useEffect(() => {
		if (onExposeState) {
			onExposeState({
				files: files.map((f) => ({ id: f.id, name: f.name })),
				activeTab,
				selectedFileId,
				isPlaying,
				onSelectFile: (id: string) => setSelectedFileId(id),
				onCreateFile: createNewFile,
				onDeleteFile: async (id: string) => {
					const file = files.find((f) => f.id === id);
					if (file) await deleteFile(id, file.name);
				},
				onSetActiveTab: setActiveTab,
			});
		}
	}, [
		files,
		activeTab,
		selectedFileId,
		isPlaying,
		onExposeState,
		deleteFile,
		createNewFile,
	]);

	// Transform mouse coordinates to canvas space (optimized)
	const transformMouseToCanvasSpace = useCallback(
		(clientX: number, clientY: number, canvasRect: DOMRect) => {
			const transformState = transformRef.current?.instance?.transformState;
			const currentScale = transformState?.scale || 1;
			const currentTranslateX = transformState?.positionX || 0;
			const currentTranslateY = transformState?.positionY || 0;

			const rawMouseX = clientX - canvasRect.left;
			const rawMouseY = clientY - canvasRect.top;

			return {
				x: (rawMouseX - currentTranslateX) / currentScale,
				y: (rawMouseY - currentTranslateY) / currentScale,
			};
		},
		[],
	);

	// Frame drag handlers (optimized)
	const handleDragStart = useCallback(
		(
			fileId: string,
			startPos: { x: number; y: number },
			mouseEvent: React.MouseEvent,
		) => {
			const canvasElement = canvasRef.current;
			if (!canvasElement) return;

			const canvasRect = canvasElement.getBoundingClientRect();
			const canvasMousePos = transformMouseToCanvasSpace(
				mouseEvent.clientX,
				mouseEvent.clientY,
				canvasRect,
			);

			setDragState({
				isDragging: true,
				draggedFrame: fileId,
				startPosition: startPos,
				currentPosition: startPos,
				offset: {
					x: canvasMousePos.x - startPos.x,
					y: canvasMousePos.y - startPos.y,
				},
			});
		},
		[transformMouseToCanvasSpace],
	);

	const handleDragMove = useCallback((mousePos: { x: number; y: number }) => {
		const currentDragState = dragStateRef.current;
		if (!currentDragState.isDragging || !currentDragState.draggedFrame) return;

		const newPosition = {
			x: mousePos.x - currentDragState.offset.x,
			y: mousePos.y - currentDragState.offset.y,
		};

		// Cancel previous frame
		if (rafIdRef.current) {
			cancelAnimationFrame(rafIdRef.current);
		}

		// Use RAF for smooth 60fps updates
		rafIdRef.current = requestAnimationFrame(() => {
			setDragState((prev) => ({
				...prev,
				currentPosition: newPosition,
			}));
		});
	}, []);

	const handleDragEnd = useCallback(async () => {
		const currentDragState = dragStateRef.current;
		if (!currentDragState.isDragging || !currentDragState.draggedFrame) return;

		// Cancel any pending RAF
		if (rafIdRef.current) {
			cancelAnimationFrame(rafIdRef.current);
			rafIdRef.current = null;
		}

		// Snap to grid (makes positioning cleaner)
		const gridSize = 25;
		const snappedPosition = {
			x: Math.round(currentDragState.currentPosition.x / gridSize) * gridSize,
			y: Math.round(currentDragState.currentPosition.y / gridSize) * gridSize,
		};

		// Save the new position
		const fileId = currentDragState.draggedFrame;
		const file = files.find((f) => f.id === fileId);
		if (file) {
			const updated = {
				...file,
				position: snappedPosition,
				timestamp: new Date().toISOString(),
			};
			setFiles((prev) => prev.map((f) => (f.id === fileId ? updated : f)));
			try {
				if (file.detectedType === "mermaid") {
					// Mermaid files are saved via mermaidState.updateSource
					// Position updates are handled separately if needed
				} else {
					// Save position update for all other file types
					await db.saveFile(updated);
				}
			} catch (e) {
				console.error("[PreviewTab] saveFile failed", e);
			}
		}

		// Reset drag state
		setDragState({
			isDragging: false,
			draggedFrame: null,
			startPosition: { x: 0, y: 0 },
			currentPosition: { x: 0, y: 0 },
			offset: { x: 0, y: 0 },
		});
	}, [files]);

	// Canvas zoom controls with react-zoom-pan-pinch
	const handleZoomIn = useCallback(() => {
		if (transformRef.current) {
			transformRef.current.zoomIn(0.1);
			console.log(
				"[Canvas] Zoom in:",
				transformRef.current.instance?.transformState.scale,
			);
		}
	}, []);
	const handleZoomOut = useCallback(() => {
		if (transformRef.current) {
			transformRef.current.zoomOut(0.1);
			console.log(
				"[Canvas] Zoom out:",
				transformRef.current.instance?.transformState.scale,
			);
		}
	}, []);
	const handleResetZoom = useCallback(() => {
		if (transformRef.current) {
			transformRef.current.resetTransform();
			console.log("[Canvas] Reset zoom");
		}
	}, []);
	const handleFitToView = () => {
		if (transformRef.current && files.length > 0) {
			transformRef.current.centerView(1, 200);
			console.log("[Canvas] Fit to view");
		}
	};

	// Global viewport handlers
	const handleGlobalViewportChange = (
		mode: "mobile" | "tablet" | "desktop",
	) => {
		setGlobalViewportMode(mode);
		// Always update all frames to the new viewport mode
		const newViewports: Record<string, "mobile" | "tablet" | "desktop"> = {};
		for (const f of files) {
			newViewports[f.id] = mode;
		}
		setFrameViewports(newViewports);
	};

	const toggleGlobalViewport = () => {
		const newUseGlobal = !useGlobalViewport;
		setUseGlobalViewport(newUseGlobal);
		if (newUseGlobal) {
			const newViewports: Record<string, "mobile" | "tablet" | "desktop"> = {};
			for (const f of files) {
				newViewports[f.id] = globalViewportMode;
			}
			setFrameViewports(newViewports);
		}
	};

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
				switch (e.key) {
					case "=":
					case "+":
						e.preventDefault();
						handleZoomIn();
						break;
					case "-":
						e.preventDefault();
						handleZoomOut();
						break;
					case "0":
						e.preventDefault();
						handleResetZoom();
						break;
				}
			}
		};
		if (showMultiView) {
			window.addEventListener("keydown", handleKeyDown);
			return () => window.removeEventListener("keydown", handleKeyDown);
		}
	}, [showMultiView, handleZoomIn, handleZoomOut, handleResetZoom]);

	// Insert color at cursor position
	const insertColor = () => {
		if (textareaRef.current) {
			const start = textareaRef.current.selectionStart;
			const end = textareaRef.current.selectionEnd;
			const text = htmlContent;
			const newText =
				text.substring(0, start) + selectedColor + text.substring(end);
			setHtmlContent(newText);
			setContextHtml(newText); // Sync to context -> IndexedDB
			saveToHistory(newText, cssContent);
			setShowColorPicker(false);

			// Restore cursor position
			setTimeout(() => {
				if (textareaRef.current) {
					textareaRef.current.focus();
					textareaRef.current.setSelectionRange(
						start + selectedColor.length,
						start + selectedColor.length,
					);
				}
			}, 0);
		}
	};

	// Generate the full HTML document for srcdoc with service worker and style injection
	const generateIframeContent = useCallback(
		(
			html: string,
			css: string,
			mode: "full" | "canvas" = "full",
			enableSelector = false,
			fileName = "preview",
		) => {
			// Check if content is a full HTML document (starts with DOCTYPE)
			const isFullHTMLDocument = /^\s*<!DOCTYPE\s+html>/i.test(html);

			// If it's a full HTML document, use it as-is (don't wrap it)
			if (isFullHTMLDocument) {
				// Inject service worker for external resources
				return injectServiceWorker(html);
			}

			// Otherwise, wrap the content in our HTML template
			let content = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: ${mode === "full" ? "#1a1a1a" : isDarkPreview ? "#1a1a1a" : "white"};
            color: ${mode === "full" ? "#e5e7eb" : isDarkPreview ? "#e5e7eb" : "#1a1a1a"};
            overflow: hidden;
            transition: background-color 0.3s ease, color 0.3s ease;
          }
          * {
            box-sizing: border-box;
          }
          ${
						mode === "full"
							? `
          /* Make content editable in full mode */
          body { padding: 0; }
          [contenteditable="true"] { outline: 1px solid #e5e7eb; min-height: 1em; }
          [contenteditable="true"]:focus { outline: 2px solid #3b82f6; outline-offset: 2px; }
          
          /* Draggable elements styling */
          .draggable-element {
            position: relative;
            cursor: move;
            border: 2px dashed transparent;
            transition: border-color 0.2s ease;
          }
          .draggable-element:hover {
            border-color: #10b981;
            box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
          }
          .draggable-element.dragging {
            border-color: #3b82f6;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 1000;
          }
          
          /* Resize handles */
          .resize-handles {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
          }
          .resize-handle {
            position: absolute;
            background: #3b82f6;
            border: 1px solid white;
            border-radius: 50%;
            pointer-events: auto;
            z-index: 10;
          }
          .resize-handle.nw { top: -4px; left: -4px; width: 8px; height: 8px; cursor: nw-resize; }
          .resize-handle.ne { top: -4px; right: -4px; width: 8px; height: 8px; cursor: ne-resize; }
          .resize-handle.sw { bottom: -4px; left: -4px; width: 8px; height: 8px; cursor: sw-resize; }
          .resize-handle.se { bottom: -4px; right: -4px; width: 8px; height: 8px; cursor: se-resize; }
          .resize-handle.n { top: -4px; left: 50%; transform: translateX(-50%); width: 8px; height: 8px; cursor: n-resize; }
          .resize-handle.s { bottom: -4px; left: 50%; transform: translateX(-50%); width: 8px; height: 8px; cursor: s-resize; }
          .resize-handle.w { top: 50%; left: -4px; transform: translateY(-50%); width: 8px; height: 8px; cursor: w-resize; }
          .resize-handle.e { top: 50%; right: -4px; transform: translateY(-50%); width: 8px; height: 8px; cursor: e-resize; }
          `
							: ""
					}
          /* Global CSS */
          ${cssContent}

        </style>
        <script>
          ${
						mode === "full"
							? `
          // Make content editable and sync changes (full mode)
          document.addEventListener('DOMContentLoaded', function() {
            function makeElementEditable(element) {
              if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') return;
              if (element.children.length === 0 && element.textContent.trim()) {
                element.setAttribute('contenteditable', 'true');
              }
              for (let child of element.children) { makeElementEditable(child); }
            }
            makeElementEditable(document.body);

            // Create a clean HTML snapshot by removing editor artifacts
            function getCleanHTML() {
              var clone = document.body.cloneNode(true);
              // Remove resize handles and alignment guides
              clone.querySelectorAll('.resize-handles, .resize-handle, .alignment-guide').forEach(function(el){ el.remove(); });
              // Remove editor-specific attributes/classes
              clone.querySelectorAll('[data-draggable-initialized]').forEach(function(el){ el.removeAttribute('data-draggable-initialized'); });
              clone.querySelectorAll('[contenteditable]').forEach(function(el){ el.removeAttribute('contenteditable'); });
              clone.querySelectorAll('.draggable-element').forEach(function(el){ el.classList.remove('draggable-element'); });
              return clone.innerHTML;
            }
            
            // Make elements draggable
            function addDraggableToElements() {
              const candidates = document.querySelectorAll('div, p, h1, h2, h3, h4, h5, h6, span, img, button, section, article, header, footer, nav, aside');
              var count = 0;
              candidates.forEach((el) => {
                // Skip our own utility elements and already-initialized nodes
                if (!el || !(el instanceof HTMLElement)) return;
                if (el.classList.contains('resize-handles') || el.classList.contains('resize-handle')) return;
                if (el.closest('.resize-handles')) return;
                if (el.getAttribute('data-draggable-initialized') === 'yes') return;
                makeElementDraggable(el);
                count++;
              });
              console.log('[Draggable] Initialized ' + count + ' elements with resize handles');
            }
            addDraggableToElements();
            
            // Re-add draggable functionality only for added nodes
            const observer = new MutationObserver((mutationList) => {
              mutationList.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                  if (node && node.nodeType === 1) {
                    const el = node as HTMLElement;
                    if (!el.classList.contains('resize-handles') && !el.classList.contains('resize-handle')) {
                      if (el.getAttribute('data-draggable-initialized') !== 'yes') {
                        makeElementDraggable(el);
                      }
                      // Also process descendants once
                      el.querySelectorAll && el.querySelectorAll('div, p, h1, h2, h3, h4, h5, h6, span, img, button, section, article, header, footer, nav, aside').forEach((child) => {
                        const c = child as HTMLElement;
                        if (c.classList.contains('resize-handles') || c.classList.contains('resize-handle')) return;
                        if (c.closest('.resize-handles')) return;
                        if (c.getAttribute('data-draggable-initialized') === 'yes') return;
                        makeElementDraggable(c);
                      });
                    }
                  }
                });
              });
            });
            observer.observe(document.body, { childList: true, subtree: true });

            var changeTimeout;
            document.addEventListener('input', function(e) {
              var target = e.target;
              if (target && target.getAttribute && target.getAttribute('contenteditable') === 'true') {
                clearTimeout(changeTimeout);
                changeTimeout = setTimeout(function() {
                  var newHtml = getCleanHTML();
                  window.parent.postMessage({ type: 'contentChanged', html: newHtml }, '*');
                }, 400);
              }
            });
          });

          // Element dragging and resizing (full mode)
          let isDragging = false;
          let isResizing = false;
          let currentElement = null;
          let resizeHandle = null;
          let startX, startY, startLeft, startTop, startWidth, startHeight;
          const SNAP_THRESHOLD = 5; // pixels for snap detection
          let guideLines = [];
          
          // Add draggable class and resize handles to elements
          function makeElementDraggable(element) {
            if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE' || element.tagName === 'HTML' || element.tagName === 'HEAD' || element.tagName === 'BODY') return;
            if (element.getAttribute('data-draggable-initialized') === 'yes') return;
            
            console.log('[Draggable] Making element draggable:', element.tagName, element.className);
            
            element.classList.add('draggable-element');
            element.setAttribute('data-draggable-initialized', 'yes');
            
            // Add resize handles
            let handles = element.querySelector(':scope > .resize-handles');
            if (!handles) {
              const newHandles = document.createElement('div');
              newHandles.className = 'resize-handles';
              newHandles.innerHTML = '<div class="resize-handle nw"></div><div class="resize-handle ne"></div><div class="resize-handle sw"></div><div class="resize-handle se"></div><div class="resize-handle n"></div><div class="resize-handle s"></div><div class="resize-handle w"></div><div class="resize-handle e"></div>';
              newHandles.style.display = 'none';
              element.appendChild(newHandles);
              handles = newHandles;
              console.log('[Draggable] Added resize handles to:', element.tagName);
              
              // Add event listeners only once when creating handles
              element.addEventListener('mouseenter', function() {
                console.log('[Draggable] Mouse enter on:', this.tagName);
                var h = this.querySelector('.resize-handles');
                if (h) h.style.display = 'block';
              });
              element.addEventListener('mouseleave', function() {
                var h = this.querySelector('.resize-handles');
                if (h) h.style.display = 'none';
              });
            }
          }
            const line = document.createElement('div');
            line.className = 'alignment-guide';
            line.style.position = 'fixed';
            line.style.backgroundColor = '#3b82f6';
            line.style.zIndex = '99999';
            line.style.pointerEvents = 'none';
            if (type === 'vertical') {
              line.style.width = '1px';
              line.style.height = '100vh';
            } else {
              line.style.width = '100vw';
              line.style.height = '1px';
            }
            document.body.appendChild(line);
            return line;
          }
          
          // Remove all guide lines
          function clearGuides() {
            document.querySelectorAll('.alignment-guide').forEach(el => el.remove());
            guideLines = [];
          }
          
          // Check alignment and show guides
          function checkAlignment(draggedRect) {
            clearGuides();
            // Only consider other draggable elements to reduce DOM scans
            const elements = Array.from(document.querySelectorAll('.draggable-element')).filter(el => 
              el !== currentElement && el !== document.body && el !== document.documentElement &&
              !el.classList.contains('alignment-guide') &&
              !el.classList.contains('resize-handles') && !el.classList.contains('resize-handle')
            );
            
            let snapX = null, snapY = null;
            
            elements.forEach(el => {
              const rect = el.getBoundingClientRect();
              
              // Check vertical alignment (left, center, right)
              if (Math.abs(draggedRect.left - rect.left) < SNAP_THRESHOLD) {
                const line = createGuideLine('vertical');
                line.style.left = rect.left + 'px';
                snapX = rect.left;
              } else if (Math.abs(draggedRect.right - rect.right) < SNAP_THRESHOLD) {
                const line = createGuideLine('vertical');
                line.style.left = rect.right + 'px';
                snapX = rect.right - draggedRect.width;
              } else if (Math.abs((draggedRect.left + draggedRect.width/2) - (rect.left + rect.width/2)) < SNAP_THRESHOLD) {
                const line = createGuideLine('vertical');
                line.style.left = (rect.left + rect.width/2) + 'px';
                snapX = rect.left + rect.width/2 - draggedRect.width/2;
              }
              
              // Check horizontal alignment (top, center, bottom)
              if (Math.abs(draggedRect.top - rect.top) < SNAP_THRESHOLD) {
                const line = createGuideLine('horizontal');
                line.style.top = rect.top + 'px';
                snapY = rect.top;
              } else if (Math.abs(draggedRect.bottom - rect.bottom) < SNAP_THRESHOLD) {
                const line = createGuideLine('horizontal');
                line.style.top = rect.bottom + 'px';
                snapY = rect.bottom - draggedRect.height;
              } else if (Math.abs((draggedRect.top + draggedRect.height/2) - (rect.top + rect.height/2)) < SNAP_THRESHOLD) {
                const line = createGuideLine('horizontal');
                line.style.top = (rect.top + rect.height/2) + 'px';
                snapY = rect.top + rect.height/2 - draggedRect.height/2;
              }
            });
            
            return { snapX, snapY };
          }
          
          document.addEventListener('mousedown', (e) => {
            // Check if it's a resize handle
            if (e.target.classList.contains('resize-handle')) {
              isResizing = true;
              resizeHandle = e.target.className.split(' ')[1]; // get direction (nw, ne, etc.)
              currentElement = e.target.closest('.draggable-element');
              if (!currentElement) return;
              
              const rect = currentElement.getBoundingClientRect();
              startX = e.clientX;
              startY = e.clientY;
              startLeft = rect.left;
              startTop = rect.top;
              startWidth = rect.width;
              startHeight = rect.height;
              
              // Ensure element is absolutely positioned
              if (getComputedStyle(currentElement).position === 'static') {
                currentElement.style.position = 'absolute';
                currentElement.style.left = startLeft + 'px';
                currentElement.style.top = startTop + 'px';
                currentElement.style.width = startWidth + 'px';
                currentElement.style.height = startHeight + 'px';
                currentElement.style.margin = '0';
              }
              
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            
            // Check if it's a draggable element (but not resize handle)
            if (e.target.classList.contains('draggable-element') || e.target.closest('.draggable-element')) {
              isDragging = true;
              currentElement = e.target.classList.contains('draggable-element') ? e.target : e.target.closest('.draggable-element');
              currentElement.classList.add('dragging');
              
              const rect = currentElement.getBoundingClientRect();
              startX = e.clientX;
              startY = e.clientY;
              startLeft = rect.left;
              startTop = rect.top;
              
              // Preserve current dimensions and make absolutely positioned if needed
              const computedStyle = getComputedStyle(currentElement);
              if (computedStyle.position === 'static') {
                // Get the actual rendered dimensions
                const currentWidth = currentElement.offsetWidth;
                const currentHeight = currentElement.offsetHeight;
                
                currentElement.style.position = 'absolute';
                currentElement.style.left = startLeft + 'px';
                currentElement.style.top = startTop + 'px';
                currentElement.style.width = currentWidth + 'px';
                currentElement.style.height = currentHeight + 'px';
                currentElement.style.margin = '0';
              }
              
              e.preventDefault();
            }
          });
          
          document.addEventListener('mousemove', (e) => {
            if (rafPending) return;
            rafPending = true;
            window.requestAnimationFrame(() => {
              rafPending = false;
              if (isResizing && currentElement && resizeHandle) {
              const deltaX = e.clientX - startX;
              const deltaY = e.clientY - startY;
              
              let newLeft = startLeft;
              let newTop = startTop;
              let newWidth = startWidth;
              let newHeight = startHeight;
              
              // Handle different resize directions
              switch (resizeHandle) {
                case 'se': // bottom-right
                  newWidth = startWidth + deltaX;
                  newHeight = startHeight + deltaY;
                  break;
                case 'sw': // bottom-left
                  newLeft = startLeft + deltaX;
                  newWidth = startWidth - deltaX;
                  newHeight = startHeight + deltaY;
                  break;
                case 'ne': // top-right
                  newTop = startTop + deltaY;
                  newWidth = startWidth + deltaX;
                  newHeight = startHeight - deltaY;
                  break;
                case 'nw': // top-left
                  newLeft = startLeft + deltaX;
                  newTop = startTop + deltaY;
                  newWidth = startWidth - deltaX;
                  newHeight = startHeight - deltaY;
                  break;
                case 'n': // top
                  newTop = startTop + deltaY;
                  newHeight = startHeight - deltaY;
                  break;
                case 's': // bottom
                  newHeight = startHeight + deltaY;
                  break;
                case 'w': // left
                  newLeft = startLeft + deltaX;
                  newWidth = startWidth - deltaX;
                  break;
                case 'e': // right
                  newWidth = startWidth + deltaX;
                  break;
              }
              
              // Minimum size constraints
              if (newWidth < 20) newWidth = 20;
              if (newHeight < 20) newHeight = 20;
              
              currentElement.style.left = newLeft + 'px';
              currentElement.style.top = newTop + 'px';
              currentElement.style.width = newWidth + 'px';
              currentElement.style.height = newHeight + 'px';
              
            } else if (isDragging && currentElement) {
              const deltaX = e.clientX - startX;
              const deltaY = e.clientY - startY;
              let newLeft = startLeft + deltaX;
              let newTop = startTop + deltaY;
              
              // Check alignment and apply snap
              const rect = currentElement.getBoundingClientRect();
              const draggedRect = {
                left: newLeft,
                top: newTop,
                right: newLeft + rect.width,
                bottom: newTop + rect.height,
                width: rect.width,
                height: rect.height
              };
              
              const { snapX, snapY } = checkAlignment(draggedRect);
              if (snapX !== null) newLeft = snapX;
              if (snapY !== null) newTop = snapY;
              
              currentElement.style.left = newLeft + 'px';
              currentElement.style.top = newTop + 'px';
            }
            });
          });
          
          document.addEventListener('mouseup', () => {
            if (isDragging || isResizing) {
              if (currentElement) {
                currentElement.classList.remove('dragging');
                // Send position/size changes back to parent
                const styles = currentElement.style.cssText;
                window.parent.postMessage({ type: 'elementMoved', styles, html: currentElement.outerHTML }, '*');
                // Also send updated full HTML so parent persists changes (cleaned)
                window.parent.postMessage({ type: 'contentChanged', html: getCleanHTML() }, '*');
              }
            }
            isDragging = false;
            isResizing = false;
            currentElement = null;
            resizeHandle = null;
            clearGuides();
          });
          `
							: ""
					}
        </script>
      </head>
      <body>
        ${html}
        <script>${generateElementSelectorScript(fileName)}</script>
      </body>
    </html>
    `;

			// Inject service worker for external resources
			content = injectServiceWorker(content);

			return content;
		},
		[isDarkPreview, cssContent],
	);

	// Memoized iframe content for canvas mode (files preview)
	const canvasIframeContent = useMemo(() => {
		const isHtml = detectContentType(htmlContent) === "html";
		return generateIframeContent(
			htmlContent,
			isHtml ? cssContent : "",
			isPlaying ? "full" : "canvas",
			elementSelectorEnabled,
			files.find((f) => f.id === selectedFileId)?.name || "preview",
		);
	}, [
		htmlContent,
		cssContent,
		isPlaying,
		elementSelectorEnabled,
		selectedFileId,
		files,
		generateIframeContent,
	]);

	// Memoized iframe content for full preview mode
	const fullIframeContent = useMemo(() => {
		const isHtml = detectContentType(htmlContent) === "html";
		return generateIframeContent(
			htmlContent,
			isHtml ? cssContent : "",
			"full",
			elementSelectorEnabled,
			files.find((f) => f.id === selectedFileId)?.name || "preview",
		);
	}, [
		htmlContent,
		cssContent,
		elementSelectorEnabled,
		selectedFileId,
		files,
		generateIframeContent,
	]);

	return (
		<div
			ref={previewContainerRef}
			className="flex flex-col h-full min-h-0 relative"
		>
			{/* Content Area */}
			<div className="flex-1 overflow-hidden p-0 min-h-0">
				{/* Canvas View - Independent of Play/Edit mode */}
				{showMultiView && (
					<div
						className={`relative w-full h-full border rounded-md overflow-hidden ${isDarkPreview ? "bg-black" : "bg-gray-100"}`}
					>
						{/* Consolidated Toolbar - Upload | Color Picker | ZOOM | Theme | Viewport */}
						<div
							className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 ${isDarkPreview ? "border-gray-700" : "border-gray-300"} border rounded-lg shadow-lg px-3 py-2`}
							style={{ backgroundColor: "#2a2a2a" }}
						>
							{/* Upload Button (File Import) */}
							<Button
								size="sm"
								variant="ghost"
								onClick={async () => {
									try {
										if (!("showOpenFilePicker" in window)) {
											console.warn(
												"File System Access API not available in this browser",
											);
											return;
										}
										// @ts-expect-error - showOpenFilePicker is available in Chrome
										const [handle] = await window.showOpenFilePicker({
											multiple: false,
											excludeAcceptAllOption: false,
											types: [
												{
													description: "HTML or CSS",
													accept: {
														"text/html": [".html", ".htm"],
														"text/css": [".css"],
													},
												},
											],
										});

										const file = await handle.getFile();
										const text = await file.text();
										const name = file.name || "Imported";
										const lower = name.toLowerCase();

										if (lower.endsWith(".css") || file.type === "text/css") {
											setCssContent(text);
											setContextCss(text);
											await db.saveGlobalCss(text);
										} else {
											const baseName =
												name.replace(/\.(html?|css)$/i, "").trim() || undefined;
											await createFileFromLLM(text, baseName);
										}
									} catch (err) {
										console.error("[Upload] Import failed", err);
									}
								}}
								title="Upload HTML or CSS file"
								className={!isDarkPreview ? "text-black hover:text-black" : ""}
							>
								<Upload className="h-4 w-4" />
							</Button>
							{/* Color Picker */}
							<div className="relative">
								<Button
									onClick={() => setShowColorPicker(!showColorPicker)}
									size="sm"
									variant="ghost"
									className={
										!isDarkPreview
											? "text-black hover:text-black flex items-center gap-2"
											: "flex items-center gap-2"
									}
									title="Color Picker"
								>
									<div
										className="w-4 h-4 rounded border"
										style={{ backgroundColor: selectedColor }}
									/>
								</Button>
								{showColorPicker && (
									<div className="absolute top-full mt-2 left-0 z-50 bg-white border rounded-lg shadow-lg overflow-hidden">
										<input
											type="color"
											value={selectedColor}
											onChange={(e) => setSelectedColor(e.target.value)}
											className="w-full h-32 cursor-pointer border-0 block rounded-t-lg"
										/>
										<div className="p-3 pt-2 flex gap-2 bg-black">
											<input
												type="text"
												value={selectedColor}
												onChange={(e) => setSelectedColor(e.target.value)}
												className="flex-1 px-2 py-1 text-xs border rounded"
											/>
											<Button size="sm" onClick={insertColor}>
												Insert
											</Button>
										</div>
									</div>
								)}
							</div>
							<div
								className={`w-px h-4 ${isDarkPreview ? "bg-gray-700" : "bg-gray-300"}`}
							/>
							{/* Zoom Controls */}
							<Button
								size="sm"
								variant="ghost"
								onClick={handleZoomOut}
								title="Zoom Out (Ctrl/Cmd + -)"
								className={!isDarkPreview ? "text-black hover:text-black" : ""}
							>
								<ZoomOut className="h-4 w-4" />
							</Button>
							<Button
								size="sm"
								variant="ghost"
								onClick={handleZoomIn}
								title="Zoom In (Ctrl/Cmd + +)"
								className={!isDarkPreview ? "text-black hover:text-black" : ""}
							>
								<ZoomIn className="h-4 w-4" />
							</Button>
							{/* Theme Toggle */}
							<Button
								size="sm"
								variant="ghost"
								onClick={() => setIsDarkPreview(!isDarkPreview)}
								title={`Toggle ${isDarkPreview ? "light" : "dark"} preview background`}
								className={!isDarkPreview ? "text-black hover:text-black" : ""}
							>
								{isDarkPreview ? (
									<Sun className="h-4 w-4" />
								) : (
									<Moon className="h-4 w-4" />
								)}
							</Button>
							<div
								className={`w-px h-4 ${isDarkPreview ? "bg-gray-700" : "bg-gray-300"}`}
							/>
							{/* Viewport Controls: Mobile/Desktop */}
							<Button
								size="sm"
								variant={globalViewportMode === "mobile" ? "default" : "ghost"}
								onClick={() => handleGlobalViewportChange("mobile")}
								title="Mobile View (375×667)"
								className={!isDarkPreview ? "text-black hover:text-black" : ""}
							>
								<Smartphone className="h-4 w-4" />
							</Button>
							<Button
								size="sm"
								variant={globalViewportMode === "desktop" ? "default" : "ghost"}
								onClick={() => handleGlobalViewportChange("desktop")}
								title="Desktop View (1280×800)"
								className={!isDarkPreview ? "text-black hover:text-black" : ""}
							>
								<Monitor className="h-4 w-4" />
							</Button>
						</div>

						{/* TransformWrapper for stable pan/zoom */}
						<TransformWrapper
							ref={transformRef}
							initialScale={(() => {
								// Load initial zoom from localStorage
								if (typeof window !== "undefined") {
									const saved = localStorage.getItem("canvasZoom");
									return saved ? Number.parseFloat(saved) : 1;
								}
								return 1;
							})()}
							initialPositionX={(() => {
								// Load initial pan X from localStorage
								if (typeof window !== "undefined") {
									const saved = localStorage.getItem("canvasPanX");
									return saved ? Number.parseFloat(saved) : 0;
								}
								return 0;
							})()}
							initialPositionY={(() => {
								// Load initial pan Y from localStorage
								if (typeof window !== "undefined") {
									const saved = localStorage.getItem("canvasPanY");
									return saved ? Number.parseFloat(saved) : 0;
								}
								return 0;
							})()}
							minScale={0.1}
							maxScale={3}
							limitToBounds={false}
							smooth={false}
							disablePadding={true}
							doubleClick={{ disabled: false, mode: "zoomIn", step: 0.5 }}
							wheel={{
								wheelDisabled: false,
								touchPadDisabled: false,
								step: 0.05,
							}}
							panning={{
								disabled: dragState.isDragging,
								velocityDisabled: true,
								wheelPanning: false,
							}}
							pinch={{ disabled: false, step: 1 }}
							centerOnInit={false}
							onTransformed={(ref) => {
								const state = ref.state;
								if (state.scale <= 0) {
									console.error(
										"[Canvas] Invalid scale detected:",
										state.scale,
									);
									ref.setTransform(state.positionX, state.positionY, 0.1);
								}
								// Save zoom and pan to localStorage
								try {
									localStorage.setItem("canvasZoom", state.scale.toString());
									localStorage.setItem(
										"canvasPanX",
										state.positionX.toString(),
									);
									localStorage.setItem(
										"canvasPanY",
										state.positionY.toString(),
									);
								} catch (e) {
									console.error("[Canvas] Failed to save transform state", e);
								}
								console.log("[Canvas] Transform:", {
									scale: state.scale,
									x: state.positionX,
									y: state.positionY,
								});
							}}
						>
							<TransformComponent
								wrapperStyle={{ width: "100%", height: "100%" }}
								contentStyle={{ width: "100%", height: "100%" }}
							>
								{/* Grid Background */}
								<div
									ref={canvasRef}
									className="relative"
									style={{
										minWidth: "10000px",
										minHeight: "10000px",
										backgroundImage: dragState.isDragging
											? `linear-gradient(${isDarkPreview ? "rgba(59, 130, 246, 0.3)" : "rgba(59, 130, 246, 0.2)"} 1px, transparent 1px), linear-gradient(90deg, ${isDarkPreview ? "rgba(59, 130, 246, 0.3)" : "rgba(59, 130, 246, 0.2)"} 1px, transparent 1px)`
											: `linear-gradient(${isDarkPreview ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"} 1px, transparent 1px), linear-gradient(90deg, ${isDarkPreview ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"} 1px, transparent 1px)`,
										backgroundSize: dragState.isDragging
											? "25px 25px"
											: "50px 50px",
										backgroundPosition: "0 0, 0 0",
									}}
									onMouseMove={(e) => {
										if (dragState.isDragging && canvasRef.current) {
											const rect = canvasRef.current.getBoundingClientRect();
											const mousePos = transformMouseToCanvasSpace(
												e.clientX,
												e.clientY,
												rect,
											);
											handleDragMove(mousePos);
										}
									}}
									onMouseUp={handleDragEnd}
									onMouseLeave={handleDragEnd}
								>
									{files
										.filter(
											(f) =>
												f.detectedType === "html" || f.detectedType === "css",
										)
										.map((file, index) => {
											const pos =
												file.position ?? computeDefaultPosition(index);
											const viewportMode =
												frameViewports[file.id] ?? globalViewportMode;
											const dims = getViewportDimensions(viewportMode);
											const finalPosition =
												dragState.draggedFrame === file.id
													? dragState.currentPosition
													: pos;
											const isDraggingThis =
												dragState.isDragging &&
												dragState.draggedFrame === file.id;

											return (
												<div
													key={file.id}
													className={`absolute rounded-lg shadow-lg overflow-hidden ${isDraggingThis ? "ring-2 ring-blue-500" : "border border-gray-300"} flex flex-col`}
													style={{
														left: `${finalPosition.x}px`,
														top: `${finalPosition.y}px`,
														width: `${dims.width}px`,
														height: `${dims.height + headerHeightPx}px`,
														cursor: isDraggingThis ? "grabbing" : "grab",
														zIndex: isDraggingThis ? 1000 : 1,
														opacity: 1,
													}}
													onMouseDown={(e) => {
														if (e.button === 0 && !e.altKey) {
															e.preventDefault();
															e.stopPropagation();
															handleDragStart(file.id, pos, e);
														}
													}}
													onDoubleClick={() => openHtmlFileFullScreen(file.id)}
												>
													{/* Frame Header */}
													<div className="bg-blue-500 text-white px-3 py-2 text-sm font-medium flex items-center justify-between select-none">
														<div className="flex items-center gap-2 min-w-0">
															<span className="truncate mr-2">{file.name}</span>
															<div className="flex items-center gap-1">
																<button
																	type="button"
																	onClick={(e) => {
																		e.stopPropagation();
																		setFrameViewports((prev) => ({
																			...prev,
																			[file.id]: "mobile",
																		}));
																	}}
																	className={`px-1 py-0.5 rounded ${(frameViewports[file.id] ?? "desktop") === "mobile" ? "bg-blue-600" : "hover:bg-blue-600"}`}
																	title="Mobile View"
																>
																	<Smartphone className="h-3 w-3" />
																</button>
																<button
																	type="button"
																	onClick={(e) => {
																		e.stopPropagation();
																		setFrameViewports((prev) => ({
																			...prev,
																			[file.id]: "tablet",
																		}));
																	}}
																	className={`px-1 py-0.5 rounded ${(frameViewports[file.id] ?? "desktop") === "tablet" ? "bg-blue-600" : "hover:bg-blue-600"}`}
																	title="Tablet View"
																>
																	<Tablet className="h-3 w-3" />
																</button>
																<button
																	type="button"
																	onClick={(e) => {
																		e.stopPropagation();
																		setFrameViewports((prev) => ({
																			...prev,
																			[file.id]: "desktop",
																		}));
																	}}
																	className={`px-1 py-0.5 rounded ${(frameViewports[file.id] ?? "desktop") === "desktop" ? "bg-blue-600" : "hover:bg-blue-600"}`}
																	title="Desktop View"
																>
																	<Monitor className="h-3 w-3" />
																</button>
															</div>
														</div>
														<div className="flex items-center gap-1">
															<button
																type="button"
																onClick={(e) => {
																	e.stopPropagation();
																	const input = document.createElement("input");
																	input.type = "file";
																	input.accept = ".html";
																	input.onchange = async (ev) => {
																		const uploadedFile = (
																			ev.target as HTMLInputElement
																		).files?.[0];
																		if (!uploadedFile) return;
																		const text = await uploadedFile.text();
																		const updated = {
																			...file,
																			html: text,
																			timestamp: new Date().toISOString(),
																		};
																		setFiles((prev) =>
																			prev.map((f) =>
																				f.id === file.id ? updated : f,
																			),
																		);
																		await db.saveFile(updated);
																	};
																	input.click();
																}}
																className="hover:bg-blue-600 rounded px-2 py-1"
																title="Upload HTML"
															>
																<Upload className="h-3 w-3" />
															</button>
															<button
																type="button"
																onClick={(e) => {
																	e.stopPropagation();
																	const contentType =
																		file.detectedType === "css"
																			? "text/css"
																			: file.detectedType === "mermaid"
																				? "text/plain"
																				: "text/html";
																	const extension =
																		file.detectedType === "css"
																			? ".css"
																			: file.detectedType === "mermaid"
																				? ".mmd"
																				: ".html";
																	const blob = new Blob([file.content || ""], {
																		type: contentType,
																	});
																	const url = URL.createObjectURL(blob);
																	const link = document.createElement("a");
																	link.href = url;
																	link.download = `${file.name}${extension}`;
																	link.click();
																	URL.revokeObjectURL(url);
																}}
																className="hover:bg-blue-600 rounded px-2 py-1"
																title="Download HTML"
															>
																<Download className="h-3 w-3" />
															</button>
															<button
																type="button"
																onClick={(e) => {
																	e.stopPropagation();
																	duplicateFile(file.id);
																}}
																className="hover:bg-blue-600 rounded px-2 py-1"
																title="Duplicate"
															>
																<Copy className="h-3 w-3" />
															</button>
															<button
																type="button"
																onClick={async (e) => {
																	e.stopPropagation();
																	await deleteFile(file.id, file.name);
																}}
																className="hover:bg-blue-600 rounded px-2 py-1"
																title="Remove"
															>
																×
															</button>
														</div>
													</div>
													{/* Frame iframe (non-editable canvas preview) - Explicit dimensions to prevent breaking */}
													<div className="relative w-full flex-1 min-h-0 overflow-hidden">
														<iframe
															key={
																(file.content || "") +
																cssContent +
																isDarkPreview +
																viewportMode
															}
															srcDoc={generateIframeContent(
																file.content || "",
																detectContentType(file.content || "") === "html"
																	? cssContent
																	: "",
																"canvas",
															)}
															style={{
																width: `${dims.width}px`,
																height: `${dims.height}px`,
																backgroundColor: isDarkPreview
																	? "#1a1a1a"
																	: "white",
																border: "none",
																margin: 0,
																padding: 0,
																display: "block",
																pointerEvents: "none",
																transform: "scale(1)",
																transformOrigin: "top left",
																outline: "none",
																filter: "none",
															}}
															title={file.name}
															sandbox="allow-scripts allow-same-origin"
															referrerPolicy="no-referrer"
														/>
													</div>
												</div>
											);
										})}

									{/* Empty state */}
									{files.length === 0 && (
										<div
											className={`absolute inset-0 flex items-center justify-center ${isDarkPreview ? "text-gray-400" : "text-gray-500"}`}
										>
											<div className="text-center">
												<p className="text-lg font-medium mb-2">
													No components yet
												</p>
												<p className="text-sm">
													Click &quot;New&quot; to create a component, or double
													click a frame to open full view
												</p>
											</div>
										</div>
									)}
								</div>
							</TransformComponent>
						</TransformWrapper>
					</div>
				)}

				{/* Single File Preview - Always mounted, visibility toggled */}
				{!showMultiView && (
					<div
						className="relative w-full h-full rounded-xl"
						style={{
							display: isPlaying ? "block" : "none",
						}}
					>
						{selectedFileId &&
							(() => {
								const file = files.find((f) => f.id === selectedFileId);
								if (!file) return null;

								console.log(
									"[CONTENT-RENDER] File:",
									file.name,
									"detectedType:",
									file.detectedType,
									"textAlign:",
									textAlign,
								);

								switch (file.detectedType) {
									case "mermaid":
										console.log("[CONTENT-RENDER] Case: mermaid");
										return (
											<MermaidView
												diagram={mermaidState.diagram}
												mermaidState={mermaidState}
												selectedFileId={selectedFileId}
												onDiagramUpdate={(diagram) => {
													// Update diagram in mermaidState
													mermaidState.diagram = diagram;
												}}
												onModeChange={(mode) => {
													// Filter out "diagram" mode since it's integrated into preview
													if (mode !== "diagram" && onModeChange) {
														onModeChange(mode);
													}
												}}
											/>
										);

									case "html":
										return (
											<>
												{/* Loading Overlay */}
												{isLoading && (
													<div
														className={`absolute inset-0 flex items-center justify-center ${isDarkPreview ? "bg-black/80" : "bg-white/80"} z-50 rounded-md`}
													>
														<div className="flex flex-col items-center gap-2">
															<Loader2 className="h-8 w-8 animate-spin text-blue-500" />
															<span
																className={`text-sm ${isDarkPreview ? "text-white" : "text-gray-600"}`}
															>
																Loading preview...
															</span>
														</div>
													</div>
												)}

												{/* Error Overlay */}
												{hasError && (
													<div className="absolute inset-0 flex items-center justify-center bg-red-50 z-50 rounded-md">
														<div className="text-center p-6">
															<div className="text-4xl mb-2">⚠️</div>
															<p className="text-lg font-medium text-red-600 mb-2">
																Failed to load preview
															</p>
															<p className="text-sm text-gray-600 mb-4">
																{errorMessage}
															</p>
															<Button
																size="sm"
																onClick={() => {
																	setHasError(false);
																	setIsLoading(true);
																}}
															>
																Retry
															</Button>
														</div>
													</div>
												)}

												<iframe
													ref={iframeRef}
													srcDoc={fullIframeContent}
													className="w-full h-full border rounded-t-xl rounded-b-xl"
													style={{
														outline: "none",
														filter: "none",
													}}
													title="HTML Preview"
													sandbox="allow-scripts allow-same-origin"
													referrerPolicy="no-referrer"
													loading="lazy"
													onLoad={() => {
														setIsLoading(false);
														setHasError(false);
													}}
													onError={(e) => {
														console.log("[PreviewTab] iframe error:", e);
														setIsLoading(false);
														setHasError(true);
														setErrorMessage("Failed to render HTML content");
													}}
												/>
											</>
										);

									case "css":
										console.log("[CONTENT-RENDER] Case: css");
										return <CSSPreview content={file.content} />;

									case "text":
										console.log(
											"[CONTENT-RENDER] Case: text, passing className:",
											textAlign === "center"
												? "text-center"
												: textAlign === "right"
													? "text-right"
													: "text-left",
										);
										return (
											<PlainTextView
												content={file.content}
												className={
													textAlign === "center"
														? "text-center"
														: textAlign === "right"
															? "text-right"
															: "text-left"
												}
											/>
										);

									default:
										console.log(
											"[CONTENT-RENDER] Case: default (not html/css/text), detectedType was:",
											file.detectedType,
											"passing className:",
											textAlign === "center"
												? "text-center"
												: textAlign === "right"
													? "text-right"
													: "text-left",
										);
										return (
											<PlainTextView
												content={file.content}
												className={
													textAlign === "center"
														? "text-center"
														: textAlign === "right"
															? "text-right"
															: "text-left"
												}
											/>
										);
								}
							})()}
					</div>
				)}

				{/* Code Editor - Always mounted, visibility toggled */}
				{!showMultiView && (
					<div
						className="relative w-full h-full"
						style={{ display: !isPlaying ? "block" : "none" }}
					>
						{selectedFileId &&
							(() => {
								const file = files.find((f) => f.id === selectedFileId);
								if (!file) return null;

								console.log(
									"[PLAY-MODE] File detected:",
									file.name,
									"Type:",
									file.detectedType,
								);

								// Use universal editor for ALL types including mermaid
								return (
									<>
										{/* Toolbar removed for Edit mode */}

										<textarea
											ref={textareaRef}
											value={activeTab === "html" ? htmlContent : cssContent}
											onChange={(e) => {
												const newValue = e.target.value;
												if (activeTab === "html") {
													// Update content immediately (no async blocking)
													setHtmlContent(newValue);

													// Auto-detect content type and save to unified table
													if (selectedFileId) {
														// Auto-detect content type
														const detectedType = detectContentType(newValue);

														const updated = {
															id: selectedFileId,
															name:
																files.find((f) => f.id === selectedFileId)
																	?.name || "Unknown",
															content: newValue,
															detectedType,
															timestamp: new Date().toISOString(),
															position: files.find(
																(f) => f.id === selectedFileId,
															)?.position || { x: 0, y: 0 },
														};

														// Update local state immediately
														setFiles((prev) =>
															prev.map((f) =>
																f.id === selectedFileId ? updated : f,
															),
														);

														// Save to unified table (non-blocking)
														db.saveFile(updated).catch((err) =>
															console.error("[FILE-SAVE-ERROR] Failed:", err),
														);
													}
												} else {
													// ═══════════════════════════════════════
													// CSS SAVE - Update globalCss table (unchanged)
													// ═══════════════════════════════════════
													console.log(
														"[CSS-SAVE-1] CSS edited, length:",
														newValue.length,
													);
													setCssContent(newValue);
													setContextCss(newValue);
													saveToHistory(htmlContent, newValue);

													db.saveGlobalCss(newValue)
														.then(() =>
															console.log(
																"[CSS-SAVE-2] CSS saved to globalCss table",
															),
														)
														.catch((err) =>
															console.error("[CSS-SAVE-ERROR] Failed:", err),
														);
												}
											}}
											placeholder={
												activeTab === "html"
													? "Enter HTML body content. You can also include a <style> tag for file-specific CSS.HTML body only (no document tags). Google Fonts will load automatically from CSS.\n\nExample:\n<style>\n  h1 { color: steelblue; }\n</style>\n\n<div class='container'>\n  <h1>Hello World</h1>\n</div>\n\nClick 'Play' to preview."
													: "Enter GLOBAL CSS here. These styles apply to all HTML files.\n\nExample:\nbody {\n  font-family: sans-serif;\n  background-color: #f0f2f5;\n}\n\n.container {\n  padding: 20px;\n  border-radius: 8px;\n}"
											}
											className="w-full h-full p-4 bg-background text-sm font-mono border rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 resize-none"
											style={{
												fontFamily:
													'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
												lineHeight: "1.5",
											}}
										/>
									</>
								);
							})()}
					</div>
				)}
			</div>

			{/* Footer - always visible, OUTSIDE content area */}
			<div className="flex-shrink-0 px-4 py-2 bg-background">
				{isPlaying && !showMultiView ? (
					// PLAY MODE footer with EDIT button (like MERMAID MODE but no PLUS)
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							<button
								type="button"
								onClick={() => onModeChange?.("edit")}
								className="h-7 text-gray-400 hover:text-white hover:bg-transparent flex items-center gap-2 text-xs"
								title="Switch to edit mode"
							>
								<Edit className="h-4 w-4" />
								<span>Edit</span>
							</button>
						</div>
						{(() => {
							const sel = selectedFileId
								? files.find((f) => f.id === selectedFileId)
								: null;
							const isText = sel
								? detectContentType(sel.content) === "text"
								: false;
							if (isText) {
								return (
									<div className="flex items-center gap-1">
										<button
											type="button"
											onClick={() => {
												console.log(
													"[ALIGN] Clicked LEFT, current textAlign:",
													textAlign,
												);
												setTextAlign("left");
												console.log("[ALIGN] Set textAlign to: left");
											}}
											className={`h-7 w-7 flex items-center justify-center rounded hover:bg-gray-700 transition ${
												textAlign === "left"
													? "text-white"
													: "text-gray-400 hover:text-white"
											}`}
											title="Align left"
										>
											<AlignLeft className="h-4 w-4" />
										</button>
										<button
											type="button"
											onClick={() => {
												console.log(
													"[ALIGN] Clicked CENTER, current textAlign:",
													textAlign,
												);
												setTextAlign("center");
												console.log("[ALIGN] Set textAlign to: center");
											}}
											className={`h-7 w-7 flex items-center justify-center rounded hover:bg-gray-700 transition ${
												textAlign === "center"
													? "text-white"
													: "text-gray-400 hover:text-white"
											}`}
											title="Align center"
										>
											<AlignCenter className="h-4 w-4" />
										</button>
										<button
											type="button"
											onClick={() => {
												console.log(
													"[ALIGN] Clicked RIGHT, current textAlign:",
													textAlign,
												);
												setTextAlign("right");
												console.log("[ALIGN] Set textAlign to: right");
											}}
											className={`h-7 w-7 flex items-center justify-center rounded hover:bg-gray-700 transition ${
												textAlign === "right"
													? "text-white"
													: "text-gray-400 hover:text-white"
											}`}
											title="Align right"
										>
											<AlignRight className="h-4 w-4" />
										</button>
									</div>
								);
							}
							return (
								<button
									type="button"
									onClick={() =>
										setElementSelectorEnabled(!elementSelectorEnabled)
									}
									className="h-7 text-gray-400 hover:text-white hover:bg-transparent flex items-center gap-2 text-xs"
									title="Toggle element selector"
								>
									<SquareDashedMousePointer className="h-4 w-4" />
									<span>Select</span>
								</button>
							);
						})()}
					</div>
				) : !isPlaying ? (
					// EDIT MODE footer with PLAY button and CSS button (only for HTML)
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							<button
								type="button"
								onClick={() => onModeChange?.("preview")}
								className="h-7 text-gray-400 hover:text-white hover:bg-transparent flex items-center gap-2 text-xs"
								title="Switch to play mode"
							>
								<Play className="h-4 w-4" />
								<span>Play</span>
							</button>
						</div>
						{(() => {
							const sel = selectedFileId
								? files.find((f) => f.id === selectedFileId)
								: null;
							const isHtml = sel
								? detectContentType(sel.content) === "html"
								: false;
							if (isHtml) {
								return (
									<button
										type="button"
										onClick={() =>
											setActiveTab(activeTab === "css" ? "html" : "css")
										}
										className={`h-7 hover:bg-transparent flex items-center gap-2 text-xs ${
											activeTab === "css"
												? "text-white"
												: "text-gray-400 hover:text-white"
										}`}
										title="Toggle CSS editor"
									>
										<Code className="h-4 w-4" />
										<span>CSS</span>
									</button>
								);
							}
							return null;
						})()}
					</div>
				) : (
					// Default text footer for canvas mode
					<p className="text-xs" style={{ color: "#e5e7eb" }}>
						{showMultiView
							? `Canvas (${files.length} files) • Pan=Alt+Drag • Full view=Double-click`
							: ""}
					</p>
				)}
			</div>

			{dynamicInputState.visible && typeof document !== "undefined" && (
				<>
					{/* Render overlay as portal to document.body */}
					{(() => {
						const overlay = (
							<div
								ref={overlayRef}
								style={{
									position: "fixed",
									left: `${dynamicInputState.x}px`,
									top: `${dynamicInputState.y}px`,
									zIndex: 10000,
								}}
							>
								<V0InputField
									placeholder="Ask v0.."
									onSubmit={(val: string) => {
										onV0Submit(val);
										setDynamicInputState((prev) => ({
											...prev,
											visible: false,
										}));
									}}
									textColor="#FFFFFF"
									showEffects={true}
									glowIntensity={0.6}
								/>
							</div>
						);
						return overlay;
					})()}
				</>
			)}
		</div>
	);
}

const AppContainer = React.memo(function AppContainer({
	notesTab,
	setNotesTab,
	dynamicChatInput,
	onV0Submit,
	promptData,
}: {
	notesTab: "preview" | "canvas" | "edit" | "webview";
	setNotesTab: (tab: "preview" | "canvas" | "edit" | "webview") => void;
	dynamicChatInput: React.ReactNode;
	onV0Submit: (
		payload: string | { type: string; [key: string]: unknown },
	) => void;
	promptData: UsePromptDataResult;
}) {
	const { thoughts, isActive, clearThoughts, addThought, setActive } =
		useSequentialThinking();
	const isSmallScreen = useIsSmallScreen();

	// Desktop-only: toggle Notes panel width between 25% and 50%
	const [isNotesExpanded, setIsNotesExpanded] = useState(false);

	// Mobile panel state
	const [mobileActivePanel, setMobileActivePanel] = useState<
		"thinking" | "chat" | "notes"
	>("chat");

	// Track socket connection status from ChatInterface
	const [socketConnected, setSocketConnected] = useState(false);

	// Capture PreviewTab exposed state
	const [previewState, setPreviewState] = useState<{
		files: Array<{ id: string; name: string }>;
		activeTab: "html" | "css";
		selectedFileId: string | null;
		isPlaying: boolean;
		onSelectFile: (id: string) => void;
		onCreateFile: () => void | Promise<void>;
		onDeleteFile: (id: string) => Promise<void>;
		onSetActiveTab: (tab: "html" | "css") => void;
	} | null>(null);

	// Memoized onExposeState with shallow equality to prevent update loops
	const onExposeState = useCallback(
		(next: {
			files: Array<{ id: string; name: string }>;
			activeTab: "html" | "css";
			selectedFileId: string | null;
			isPlaying: boolean;
			onSelectFile: (id: string) => void;
			onCreateFile: () => void | Promise<void>;
			onDeleteFile: (id: string) => Promise<void>;
			onSetActiveTab: (tab: "html" | "css") => void;
		}) => {
			setPreviewState((prev) => {
				if (prev) {
					const sameBasic =
						prev.activeTab === next.activeTab &&
						prev.selectedFileId === next.selectedFileId &&
						prev.isPlaying === next.isPlaying;
					const sameFiles =
						prev.files.length === next.files.length &&
						prev.files.every(
							(f, i) =>
								f.id === next.files[i].id && f.name === next.files[i].name,
						);
					const sameHandlers =
						prev.onSelectFile === next.onSelectFile &&
						prev.onCreateFile === next.onCreateFile &&
						prev.onDeleteFile === next.onDeleteFile &&
						prev.onSetActiveTab === next.onSetActiveTab;
					if (sameBasic && sameFiles && sameHandlers) {
						return prev;
					}
				}
				return next;
			});
		},
		[],
	);

	// Stable wrapper so NotesPanel receives a consistent component
	const PreviewTabWithState = useCallback(
		(props: {
			notesTab: "preview" | "canvas" | "edit";
			dynamicChatInput: React.ReactNode;
			onV0Submit: (
				payload: string | { type: string; [key: string]: unknown },
			) => void;
			onModeChange?: (mode: "preview" | "canvas" | "edit") => void;
		}) => (
			<PreviewTab
				{...props}
				onExposeState={onExposeState}
				onModeChange={setNotesTab}
			/>
		),
		[onExposeState, setNotesTab],
	);

	return (
		<ChatSessionProvider token={MOCK_TOKEN}>
			<div
				className="h-screen flex flex-col overflow-hidden dark-theme dotted-bg"
				style={{ backgroundColor: "#1C1C1C" }}
			>
				<main className="w-full px-1 sm:px-2 lg:px-2 flex-1 overflow-hidden pb-20 sm:pb-0">
					{/* Desktop Layout - 3 panels side by side */}
					<div className="hidden sm:flex gap-1 h-full py-2">
						<div className="basis-1/4 min-w-0 h-full">
							<ThinkingPanelContainer
								thoughts={thoughts}
								isActive={socketConnected}
								onClear={clearThoughts}
							/>
						</div>
						<div
							className={
								isNotesExpanded
									? "basis-1/4 h-full flex flex-col min-h-0"
									: "basis-1/2 h-full flex flex-col min-h-0"
							}
						>
							{!isSmallScreen && (
								<ChatInterface
									token={MOCK_TOKEN}
									userId={MOCK_USER.id}
									onConnectionChange={setSocketConnected}
									prePrompt={promptData.prePrompt}
									setPrePrompt={promptData.setPrePrompt}
									subPrompt={promptData.subPrompt}
									setSubPrompt={promptData.setSubPrompt}
									skills={promptData.skills}
									setSkills={promptData.setSkills}
									getActivePrePrompt={promptData.getActivePrePrompt}
									getActiveSubPrompt={promptData.getActiveSubPrompt}
								/>
							)}
						</div>
						<NotesPanelComponent
							notesTab={notesTab}
							setNotesTab={setNotesTab}
							dynamicChatInput={dynamicChatInput}
							onV0Submit={onV0Submit}
							isExpanded={isNotesExpanded}
							onToggleExpand={() => setIsNotesExpanded((prev) => !prev)}
							previewFiles={previewState?.files}
							PreviewTabComponent={PreviewTabWithState}
							previewActiveTab={previewState?.activeTab}
							previewSelectedFileId={previewState?.selectedFileId}
							previewIsPlaying={previewState?.isPlaying}
							onPreviewSelectFile={previewState?.onSelectFile}
							onPreviewCreateFile={previewState?.onCreateFile}
							onPreviewDeleteFile={previewState?.onDeleteFile}
							onPreviewSetActiveTab={previewState?.onSetActiveTab}
						/>
					</div>

					{/* Mobile Layout - Single panel at a time */}
					<div className="sm:hidden h-full py-2">
						{mobileActivePanel === "thinking" && (
							<div className="h-full">
								<ThinkingPanelContainer
									thoughts={thoughts}
									isActive={socketConnected}
									onClear={clearThoughts}
								/>
							</div>
						)}

						{mobileActivePanel === "chat" && (
							<div className="h-full flex flex-col min-h-0">
								{isSmallScreen && (
									<ChatInterface
										token={MOCK_TOKEN}
										userId={MOCK_USER.id}
										onConnectionChange={setSocketConnected}
										prePrompt={promptData.prePrompt}
										setPrePrompt={promptData.setPrePrompt}
										subPrompt={promptData.subPrompt}
										setSubPrompt={promptData.setSubPrompt}
										skills={promptData.skills}
										setSkills={promptData.setSkills}
										getActivePrePrompt={promptData.getActivePrePrompt}
										getActiveSubPrompt={promptData.getActiveSubPrompt}
									/>
								)}
							</div>
						)}

						{mobileActivePanel === "notes" && (
							<div className="h-full">
								<NotesPanelComponent
									notesTab={notesTab}
									setNotesTab={setNotesTab}
									dynamicChatInput={dynamicChatInput}
									onV0Submit={onV0Submit}
									previewFiles={previewState?.files}
									PreviewTabComponent={PreviewTabWithState}
									previewActiveTab={previewState?.activeTab}
									previewSelectedFileId={previewState?.selectedFileId}
									previewIsPlaying={previewState?.isPlaying}
									onPreviewSelectFile={previewState?.onSelectFile}
									onPreviewCreateFile={previewState?.onCreateFile}
									onPreviewDeleteFile={previewState?.onDeleteFile}
									onPreviewSetActiveTab={previewState?.onSetActiveTab}
								/>
							</div>
						)}
					</div>
				</main>

				{/* Mobile Panel Navigator */}
				<MobilePanelNavigator
					activePanel={mobileActivePanel}
					onPanelChange={setMobileActivePanel}
				/>
			</div>
		</ChatSessionProvider>
	);
});

export default function Home() {
	const [loading, setLoading] = useState(false);
	// SSR-safe initial state; load persisted value after mount to avoid hydration mismatch
	const [notesTab, setNotesTab] = useState<
		"preview" | "canvas" | "edit" | "webview"
	>("preview");

	// Controlled chat input state for PromptInputBox
	const [promptValue, setPromptValue] = useState("");
	const [isListening, setIsListening] = useState(false);
	const [transcript, setTranscript] = useState("");
	const [interimTranscript, setInterimTranscript] = useState("");

	// Shared prompt data for both ChatInterface and PromptInputBox
	const promptData = usePromptData({ storagePrefix: "llmChat" });

	// Chat input state for PreviewTab integration
	const [dynamicChatInput, setDynamicChatInput] =
		useState<React.ReactNode>(null);

	// Create PromptInputBox with shared prompt data
	const chatInput = useMemo(
		() => (
			<PromptInputBox
				onSend={(message) => console.log("Message:", message)}
				{...promptData}
				value={promptValue}
				onValueChange={setPromptValue}
				isListening={isListening}
				transcript={transcript}
				interimTranscript={interimTranscript}
				onStartListening={() => setIsListening(true)}
				onStopListening={() => setIsListening(false)}
			/>
		),
		[promptData, promptValue, isListening, transcript, interimTranscript],
	);

	const onV0Submit = useCallback(
		(payload: string | { type: string; [key: string]: unknown }) => {
			// no-op default; can be wired to chat handler elsewhere
			return;
		},
		[],
	);

	// After mount, read from localStorage and update
	useEffect(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("notesTab");
			// Migrate legacy "notes" mode to "preview"
			if (saved === "notes") {
				setNotesTab("preview");
				localStorage.setItem("notesTab", "preview");
			} else if (
				saved === "preview" ||
				saved === "canvas" ||
				saved === "edit" ||
				saved === "webview"
			) {
				setNotesTab(saved);
			}
		}
	}, []);

	// Save notesTab to localStorage whenever it changes
	useEffect(() => {
		if (typeof window !== "undefined") {
			localStorage.setItem("notesTab", notesTab);
			console.log("[HOME] 💾 Saved notesTab to localStorage:", notesTab);
		}
	}, [notesTab]);

	// Auto-switch to preview tab when new file is received
	useEffect(() => {
		const handleNewFileReceived = (event: CustomEvent) => {
			console.log(
				"[HOME] 🎯 New file received, switching to preview tab:",
				event.detail,
			);
			setNotesTab("preview");
		};

		if (typeof window !== "undefined") {
			window.addEventListener(
				"newFileReceived",
				handleNewFileReceived as EventListener,
			);
		}

		return () => {
			if (typeof window !== "undefined") {
				window.removeEventListener(
					"newFileReceived",
					handleNewFileReceived as EventListener,
				);
			}
		};
	}, []);

	// Commented out authentication logic - will be replaced with proper Supabase implementation
	/*
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const userData = {
          id: session.user.id,
          email: session.user.email!,
          full_name: session.user.user_metadata?.full_name
        };
        
        setUser(userData);
        
        // Generate JWT token for socket authentication
        const jwtToken = jwt.sign(
          { userId: session.user.id },
          process.env.NEXT_PUBLIC_JWT_SECRET || 'your-secret-key',
          { expiresIn: '24h' }
        );
        
        setToken(jwtToken);
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async () => {
    // Authentication logic will be implemented with proper Supabase later
  };

  const handleSignOut = async () => {
    // Sign out logic will be implemented with proper Supabase later
  };
  */

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
			</div>
		);
	}

	// Commented out authentication UI - will be replaced with proper Supabase auth components
	/*
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">
              {isSignUp ? 'Create Account' : 'Sign In'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            // Auth form components...
          </CardContent>
        </Card>
      </div>
    );
  }
  */

	return (
		<SequentialThinkingProvider>
			<PreviewProvider>
				<AppContainer
					notesTab={notesTab}
					setNotesTab={setNotesTab}
					dynamicChatInput={dynamicChatInput}
					onV0Submit={onV0Submit}
					promptData={promptData}
				/>
			</PreviewProvider>
		</SequentialThinkingProvider>
	);
}
