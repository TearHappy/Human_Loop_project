"use client";

import type React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import Image from "next/image";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { usePreview } from "../contexts/PreviewContext";
import { useSequentialThinking } from "../contexts/SequentialThinkingContext";
import { useSocket } from "../hooks/useSocket";

import {
	type Attachment,
	MultimodalAIChatInput,
} from "@/components/ui/multimodal-ai-chat-input";
import { MessageSquare, MoreHorizontal, Search, Zap } from "lucide-react";
import { usePromptData } from "../hooks/usePromptData";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "../hooks/useSpeechSynthesis";
import { detectContentType } from "../lib/contentDetector";
import { indexedDB as db } from "../lib/indexeddb";
import { getDefaultPrePrompt, getDefaultSubPrompt } from "../lib/prompts";
import { parseVoiceTags } from "../lib/voice-parser";
import { ChatInputArea } from "./chat/ChatInputArea";
import { ChatSettingsPanel } from "./chat/ChatSettingsPanel";
import { MessageList } from "./chat/MessageList";
import "highlight.js/styles/github-dark.css";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

// Add custom animation
const pulseSlowAnimation = `
  @keyframes pulse-slow {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.8;
    }
  }
  .animate-pulse-slow {
    animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
`;

interface Message {
	id: string;
	type: "user" | "assistant" | "system";
	content: string;
	timestamp: Date;
	requestId?: string;
	imageUrl?: string;
}

interface ChatInterfaceProps {
	token: string;
	userId: string;
	initialMessage?: string;
	onMessageSet?: () => void;
	onConnectionChange?: (connected: boolean) => void;
	prePrompt?: string;
	setPrePrompt?: (value: string) => void;
	subPrompt?: string;
	setSubPrompt?: (value: string) => void;
	skills?: string[];
	setSkills?: (value: string[]) => void;
	getActivePrePrompt?: () => string;
	getActiveSubPrompt?: () => string;
}

export const ChatInterface = ({
	token,
	userId,
	initialMessage,
	onMessageSet,
	onConnectionChange,
	prePrompt = "",
	setPrePrompt = () => {},
	subPrompt = "",
	setSubPrompt = () => {},
	skills = [],
	setSkills = () => {},
	getActivePrePrompt,
	getActiveSubPrompt,
}: ChatInterfaceProps) => {
	const [messages, setMessages] = useState<Message[]>([]);
	const [inputValue, setInputValue] = useState("");

	// Message limit to prevent memory accumulation
	const MAX_MESSAGES = 1000; // Limit to 1000 messages to prevent memory leaks

	// Helper function to add messages with size limit enforcement
	const addMessage = useCallback((newMessage: Message) => {
		setMessages((prev) => {
			const updated = [...prev, newMessage];
			// Enforce message limit to prevent memory accumulation
			if (updated.length > MAX_MESSAGES) {
				const excess = updated.length - MAX_MESSAGES;
				console.log(
					`[ChatInterface] Removing ${excess} old messages to prevent memory accumulation`,
				);
				return updated.slice(excess); // Remove oldest messages
			}
			return updated;
		});
	}, []);

	// Helper function moved to centralized module: getDefaultPrePrompt

	// Watch for initialMessage changes from Spellbook
	useEffect(() => {
		if (initialMessage) {
			setInputValue(initialMessage);
			onMessageSet?.();
			chatInputRef.current?.focus();
		}
	}, [initialMessage, onMessageSet]);
	const [isPermanentInputVisible, setIsPermanentInputVisible] = useState(false); // State to toggle permanent input visibility
	const [pendingRequests, setPendingRequests] = useState<Set<string>>(
		new Set(),
	);
	const [searchQuery, setSearchQuery] = useState("");
	const [copySuccess, setCopySuccess] = useState(false);
	const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
	const [collapsedMessages, setCollapsedMessages] = useState<Set<string>>(
		new Set(),
	);

	const toggleMessageCollapse = (messageId: string) => {
		setCollapsedMessages((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(messageId)) {
				newSet.delete(messageId);
			} else {
				newSet.add(messageId);
			}
			return newSet;
		});
	};
	const chatInputRef = useRef<HTMLTextAreaElement>(null);
	const cursorToEndRef = useRef<(() => void) | null>(null);
	const copySuccessTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const copyMessageTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	const [unreadCount, setUnreadCount] = useState<number>(0);

	// Handle page visibility changes to reset tab title
	useEffect(() => {
		if (typeof window !== "undefined") {
			const handleVisibilityChange = () => {
				if (!document.hidden && unreadCount > 0) {
					// User returned to tab - reset title and counter
					document.title = "Chat";
					setUnreadCount(0);
				}
			};

			document.addEventListener("visibilitychange", handleVisibilityChange);

			return () => {
				document.removeEventListener(
					"visibilitychange",
					handleVisibilityChange,
				);
			};
		}
	}, [unreadCount]);

	const [isProcessing, setIsProcessing] = useState(false);
	const processingRef = useRef(false);

	const { socket, connected, error, sendMCPRequest, sendUserResponse } =
		useSocket({
			token,
			autoConnect: true,
		});

	// Notify parent component of connection status changes
	useEffect(() => {
		if (onConnectionChange) {
			onConnectionChange(connected);
		}
	}, [connected, onConnectionChange]);

	const { addThought, setActive } = useSequentialThinking();
	const { updatePreview } = usePreview();

	// TTS (Text-to-Speech) integration
	const { speak, cancel, pause, resume, speaking, paused, supported } =
		useSpeechSynthesis();
	const [ttsAutoPlay, setTtsAutoPlay] = useState(false); // TTS OFF by default
	const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(
		null,
	);
	const [pausedMessageId, setPausedMessageId] = useState<string | null>(null);
	const [ttsActivated, setTtsActivated] = useState(false);

	// Use prompt data passed as props
	const skillsArray = skills;
	const setSkillsArray = setSkills;

	// Convert skills array to string for compatibility
	const skillsInput = skillsArray.join(", ");
	const setSkillsInput = (value: string) => {
		const skillsArr = value
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		setSkillsArray(skillsArr);
	};

	// Load TTS settings from localStorage on mount
	useEffect(() => {
		if (typeof window !== "undefined") {
			const savedTtsAutoPlay = localStorage.getItem("ttsAutoPlay");
			const savedTtsActivated = localStorage.getItem("ttsActivated");

			if (savedTtsAutoPlay === "true") {
				setTtsAutoPlay(true);
				console.log("[TTS] Loaded ttsAutoPlay from localStorage: true");
			}
			if (savedTtsActivated === "true") {
				setTtsActivated(true);
				console.log("[TTS] Loaded ttsActivated from localStorage: true");
			}
		}
	}, []);

	// Note: Prompt loading/saving now handled by usePromptData hook

	// Chat UI Settings - Using rem for responsive scaling
	const [chatFontFamily, setChatFontFamily] = useState("system-ui");
	const [chatFontScale, setChatFontScale] = useState(1.0); // Multiplier: 0.75 to 1.5
	const [chatTextAlign, setChatTextAlign] = useState<
		"left" | "center" | "right"
	>("left");
	const [chatBubbleBackground, setChatBubbleBackground] = useState("#1C1C1C");
	const [showSettings, setShowSettings] = useState(false);

	// Filter messages based on search query
	const filteredMessages = useMemo(() => {
		if (!searchQuery.trim()) return messages;

		return messages.filter((message) =>
			message.content.toLowerCase().includes(searchQuery.toLowerCase()),
		);
	}, [messages, searchQuery]);

	// Speech Recognition - Clean hook integration
	const {
		isListening,
		transcript,
		interimTranscript,
		startListening,
		stopListening,
		resetTranscript,
		supported: speechSupported,
	} = useSpeechRecognition();

	// Track last processed transcript to prevent duplication
	const lastProcessedTranscriptRef = useRef("");

	// Append final transcript to input value (confirmed text in white)
	useEffect(() => {
		if (
			transcript.trim() &&
			transcript !== lastProcessedTranscriptRef.current
		) {
			// Extract only the new part (transcript accumulates, so we need to get the diff)
			const lastProcessed = lastProcessedTranscriptRef.current;
			const newPart = transcript.startsWith(lastProcessed)
				? transcript.slice(lastProcessed.length).trim()
				: transcript.trim();

			if (newPart) {
				setInputValue((prev) => {
					const newValue = prev ? `${prev} ${newPart}` : newPart;
					return newValue;
				});
				lastProcessedTranscriptRef.current = transcript;
			}
		}
	}, [transcript]);

	// Reset transcript tracker when stopping
	useEffect(() => {
		if (!isListening) {
			lastProcessedTranscriptRef.current = "";
		}
	}, [isListening]);

	// Simple microphone button handler
	const handleMicrophoneClick = () => {
		if (isListening) {
			stopListening();
		} else {
			startListening();
		}
	};

	// Guard for client-only UI to avoid hydration mismatch
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setMounted(true);
	}, []);

	// Display text for input field - append interim text while recording
	const displayText = inputValue;

	// Keep external callbacks/values stable inside socket listeners
	const addThoughtRef = useRef(addThought);
	const setActiveRef = useRef(setActive);
	const updatePreviewRef = useRef(updatePreview);
	const speakRef = useRef(speak);
	const supportedRef = useRef(supported);

	useEffect(() => {
		addThoughtRef.current = addThought;
	}, [addThought]);

	useEffect(() => {
		setActiveRef.current = setActive;
	}, [setActive]);

	useEffect(() => {
		updatePreviewRef.current = updatePreview;
	}, [updatePreview]);

	useEffect(() => {
		speakRef.current = speak;
	}, [speak]);

	useEffect(() => {
		supportedRef.current = supported;
	}, [supported]);

	useEffect(() => {
		if (!socket) return;

		// Handle incoming MCP requests from external LLMs
		socket.on("mcp_request", (data) => {
			const { requestId, question, timestamp } = data;

			const newMessage: Message = {
				id: `mcp_request_${requestId}`,
				type: "system",
				content: question,
				timestamp: timestamp || new Date().toISOString(),
				requestId,
			};

			addMessage(newMessage);

			// Update unread/tab title when hidden
			if (typeof window !== "undefined" && document.hidden) {
				setUnreadCount((prev) => {
					const newCount = prev + 1;
					document.title = `Chat (${newCount} new)`;
					return newCount;
				});
			}

			setPendingRequests((prev) => {
				const newSet = new Set(prev);
				newSet.add(requestId);
				return newSet;
			});
		});

		socket.on("mcp_response", (data) => {
			const { requestId, response } = data;

			// Format MCP response properly
			let content = "";
			if (response && typeof response === "object") {
				if (response.content && Array.isArray(response.content)) {
					content = response.content
						.map(
							(item: { text?: string; content?: string }) =>
								item.text || item.content || "",
						)
						.join("\n");
				} else if (response.result) {
					content =
						typeof response.result === "string"
							? response.result
							: JSON.stringify(response.result, null, 2);
				} else {
					content = JSON.stringify(response, null, 2);
				}
			} else {
				content = String(response || "No response");
			}

			const newMessage: Message = {
				id: `mcp_response_${requestId}`,
				type: "assistant" as const,
				content: content,
				timestamp: new Date(),
				requestId,
			};

			addMessage(newMessage);

			// Update unread/tab title when hidden
			if (typeof window !== "undefined" && document.hidden) {
				setUnreadCount((prev) => {
					const newCount = prev + 1;
					document.title = `Chat (${newCount} new)`;
					return newCount;
				});
			}

			// TTS: Auto-play voice content if enabled, activated, and voice tags are present
			// Read from localStorage directly to avoid race conditions
			const ttsEnabled =
				typeof window !== "undefined" &&
				localStorage.getItem("ttsAutoPlay") === "true";
			const ttsActive =
				typeof window !== "undefined" &&
				localStorage.getItem("ttsActivated") === "true";

			// Only log TTS activity in development and only when actually speaking
			if (ttsEnabled && supportedRef.current && ttsActive) {
				const { voiceText, hasVoice } = parseVoiceTags(content);
				if (hasVoice && voiceText) {
					if (process.env.NODE_ENV === "development") {
						console.log("[TTS] 🔊 Speaking MCP response");
					}
					setSpeakingMessageId(newMessage.id);
					speakRef.current({ text: voiceText });
				}
			}

			setPendingRequests((prev) => {
				const newSet = new Set(prev);
				newSet.delete(requestId);
				return newSet;
			});
		});

		socket.on("mcp_error", (data) => {
			const { requestId, error } = data;

			const errorMessage = {
				id: `error_${Date.now()}`,
				type: "system" as const,
				content: `Error: ${error}`,
				timestamp: new Date(),
				requestId,
			};

			addMessage(errorMessage);

			// Update unread/tab title when hidden
			if (typeof window !== "undefined" && document.hidden) {
				setUnreadCount((prev) => {
					const newCount = prev + 1;
					document.title = `Chat (${newCount} new)`;
					return newCount;
				});
			}

			setPendingRequests((prev) => {
				const newSet = new Set(prev);
				newSet.delete(requestId);
				return newSet;
			});
		});

		// Listen for human_question events (ask_human tool)
		socket.on("human_question", (data) => {
			// Reduced logging to prevent console spam
			if (process.env.NODE_ENV === "development") {
				console.log("[Chat] 📝 Human question received:", data.requestId);
			}

			const questionMessage = {
				id: `question_${Date.now()}`,
				type: "system" as const,
				content: data.question,
				timestamp: new Date(),
				requestId: data.requestId,
			};

			addMessage(questionMessage);

			// TTS: Auto-play voice content if enabled, activated, and voice tags are present
			// Read from localStorage directly to avoid race conditions
			const ttsEnabled =
				typeof window !== "undefined" &&
				localStorage.getItem("ttsAutoPlay") === "true";
			const ttsActive =
				typeof window !== "undefined" &&
				localStorage.getItem("ttsActivated") === "true";

			// Only log TTS activity in development and only when actually speaking
			if (ttsEnabled && supportedRef.current && ttsActive) {
				const { voiceText, hasVoice } = parseVoiceTags(data.question);
				if (hasVoice && voiceText) {
					if (process.env.NODE_ENV === "development") {
						console.log("[TTS] 🔊 Speaking human question");
					}
					setSpeakingMessageId(questionMessage.id);
					speakRef.current({ text: voiceText });
				}
			}

			setPendingRequests((prev) => new Set(prev).add(data.requestId));
		});

		// Listen for sequential thinking events
		socket.on("sequential_thinking", (data) => {
			console.log("[Chat] Received sequential thinking event:", data);

			// Process raw thought data with Julia service via context
			// Convert MCP data structure to SimpleThoughtInput format
			if (data?.thought) {
				const thoughtInput = {
					content: data.thought,
					is_final_thought: !data.nextThoughtNeeded,
					thoughtNumber: data.thoughtNumber,
					totalThoughts: data.totalThoughts,
				};
				addThoughtRef.current(thoughtInput).catch((error) => {
					console.error("[Chat] Error adding thought:", error);
				});
				setActiveRef.current(data.nextThoughtNeeded);
			}
		});

		// Listen for send_to_preview events - SINGLE SOURCE OF TRUTH
		socket.on("send_to_preview", (data) => {
			console.log("[PERSIST-1] send_to_preview event received", {
				htmlLength: data?.html?.length,
				cssLength: data?.css?.length,
			});

			if (!data?.html || typeof data.html !== "string") {
				console.error("[PERSIST-ERROR] Invalid data:", data);
				return;
			}

			// Handle async operations in an async IIFE
			(async () => {
				try {
					// Get all existing files to find lowest available number (unified numbering)
					const existingFiles = await db.getFiles();
					const existingNumbers = existingFiles
						.map((f) => {
							const match = f.name.match(/^(\d+)$/);
							return match ? Number.parseInt(match[1], 10) : null;
						})
						.filter((n) => n !== null) as number[];

					// Find lowest available number (1, 2, 3...)
					let fileNumber = 1;
					while (existingNumbers.includes(fileNumber)) {
						fileNumber++;
					}

					// Generate unique file ID with better collision prevention
					const timestamp = Date.now();
					const randomSuffix = Math.random().toString(36).substr(2, 9);
					const fileId = `html_${timestamp}_${randomSuffix}`;

					// Create file entry in unified files table
					const htmlFile = {
						id: fileId,
						name: `${fileNumber}`, // Just the number: "1", "2", "3"...
						content: data.html,
						detectedType: detectContentType(data.html),
						timestamp: new Date(timestamp).toISOString(),
						position: { x: 0, y: 0 },
					};

					console.log("[PERSIST-2] Saving to unified files table...");
					await db.saveFile(htmlFile);
					console.log("[PERSIST-3] File save SUCCESS with ID:", fileId);

					// Save CSS to globalCss table if provided
					if (data.css) {
						await db.saveGlobalCss(data.css);
						console.log("[PERSIST-3B] CSS saved to globalCss table");
					}

					console.log("[PERSIST-4] Updating PreviewContext...");
					updatePreviewRef.current(data.html, data.css || "");
					console.log(
						"[PERSIST-5] FLOW COMPLETE. File created in htmlFiles table.",
					);

					// IMMEDIATE PLAY MODE ACTIVATION
					if (typeof window !== "undefined") {
						localStorage.setItem("previewIsPlaying", "true");
						localStorage.setItem("notesTab", "preview");
						window.dispatchEvent(
							new CustomEvent("newFileReceived", {
								detail: {
									fileName: htmlFile.name,
									fileId: fileId,
									html: data.html,
									css: data.css || "",
									immediatePlay: true,
								},
							}),
						);
						window.dispatchEvent(
							new CustomEvent("immediatePlayMode", {
								detail: {
									fileId: fileId,
									html: data.html,
									css: data.css || "",
								},
							}),
						);

						console.log(
							"[PERSIST-6] 🎮 IMMEDIATE play mode activated - no polling!",
						);
						console.log(
							"[PERSIST-7] 📂 Auto-switched to preview tab immediately",
						);
					}
				} catch (error) {
					console.error("[PERSIST-ERROR] Save failed:", error);
				}
			})();
		});

		// Listen for send_to_mermaid events - SINGLE SOURCE OF TRUTH
		socket.on("send_to_mermaid", (data) => {
			console.log("[Chat] Received send_to_mermaid event:", data);

			if (!data?.mermaid || typeof data.mermaid !== "string") {
				console.error("[Chat] Invalid send_to_mermaid data:", data);
				return;
			}

			// Handle async operations in an async IIFE
			(async () => {
				try {
					// Get all existing files to find lowest available number (unified numbering)
					const existingFiles = await db.getFiles();
					const existingNumbers = existingFiles
						.map((f) => {
							const match = f.name.match(/^(\d+)$/);
							return match ? Number.parseInt(match[1], 10) : null;
						})
						.filter((n) => n !== null) as number[];

					// Find lowest available number (1, 2, 3...)
					let fileNumber = 1;
					while (existingNumbers.includes(fileNumber)) {
						fileNumber++;
					}

					// Generate unique file ID
					const timestamp = Date.now();
					const randomSuffix = Math.random().toString(36).substr(2, 9);
					const fileId = `mermaid_${timestamp}_${randomSuffix}`;

					// Create mermaid file entry in unified files table
					const mermaidFile = {
						id: fileId,
						name: `${fileNumber}`, // Just the number: "1", "2", "3"...
						content: data.mermaid, // Mermaid source code
						detectedType: "mermaid" as const,
						timestamp: new Date(timestamp).toISOString(),
						position: { x: 0, y: 0 },
					};

					console.log(
						"[Chat] Saving mermaid diagram to unified files table...",
					);

					// Save to unified files table
					await db.saveFile(mermaidFile);

					console.log("[Chat] Mermaid diagram saved successfully");
					console.log("[Chat] Auto-switching to preview tab");

					// Switch to preview tab and activate diagram
					if (typeof window !== "undefined") {
						window.postMessage(
							JSON.stringify({
								type: "MERMAID_RECEIVED",
								payload: {
									fileId: fileId,
									mermaid: data.mermaid,
								},
							}),
						);
						console.log("[Chat] Mermaid diagram activated in preview tab");
					}
				} catch (error) {
					console.error("[Chat] Failed to save mermaid diagram:", error);
				}
			})();
		});

		// Listen for send_md_file events - SINGLE SOURCE OF TRUTH
		socket.on("send_md_file", (data) => {
			console.log("[Chat] Received send_md_file event:", data);

			if (!data?.content || typeof data.content !== "string") {
				console.error("[Chat] Invalid send_md_file data:", data);
				return;
			}

			// Handle async operations in an async IIFE
			(async () => {
				try {
					// Get all existing files to find lowest available number (unified numbering)
					const existingFiles = await db.getFiles();
					const existingNumbers = existingFiles
						.map((f) => {
							const match = f.name.match(/^(\d+)$/);
							return match ? Number.parseInt(match[1], 10) : null;
						})
						.filter((n) => n !== null) as number[];

					// Find lowest available number (1, 2, 3...)
					let fileNumber = 1;
					while (existingNumbers.includes(fileNumber)) {
						fileNumber++;
					}

					// Generate unique file ID
					const timestamp = Date.now();
					const randomSuffix = Math.random().toString(36).substr(2, 9);
					const fileId = `md_${timestamp}_${randomSuffix}`;

					// Use provided filename or generate default
					const fileName = data.filename || `${fileNumber}`;

					// Create markdown file entry in unified files table
					const mdFile = {
						id: fileId,
						name: fileName,
						content: data.content, // Markdown content
						detectedType: "text" as const,
						timestamp: new Date(timestamp).toISOString(),
						position: { x: 0, y: 0 },
					};

					console.log("[Chat] Saving markdown file to unified files table...");

					// Save to unified files table
					await db.saveFile(mdFile);

					console.log("[Chat] Markdown file saved successfully");
					console.log("[Chat] Auto-switching to preview tab");

					// Switch to preview tab and activate markdown file
					if (typeof window !== "undefined") {
						window.postMessage(
							JSON.stringify({
								type: "MD_FILE_RECEIVED",
								payload: {
									fileId: fileId,
									content: data.content,
									filename: fileName,
								},
							}),
						);
						console.log("[Chat] Markdown file activated in preview tab");
					}
				} catch (error) {
					console.error("[Chat] Failed to save markdown file:", error);
				}
			})();
		});

		// Listen for get_preview_request and respond with current content
		socket.on("get_preview_request", (data) => {
			console.log("[Chat] ========================================");
			console.log("[Chat] Received get_preview_request");
			console.log("[Chat] Data:", JSON.stringify(data, null, 2));
			console.log("[Chat] Socket connected?", socket.connected);
			console.log("[Chat] Socket ID:", socket.id);
			console.log("[Chat] ========================================");

			(async () => {
				try {
					console.log("[Chat] Loading latest file from files table...");
					const allFiles = await db.getFiles();
					const htmlFiles = allFiles.filter(
						(file) => file.detectedType === "html",
					);
					const latestFile =
						htmlFiles.length > 0 ? htmlFiles[htmlFiles.length - 1] : null;
					const css = await db.getGlobalCss();

					console.log("[Chat] Latest file loaded:", {
						fileId: latestFile?.id,
						fileName: latestFile?.name,
						hasHtml: !!latestFile?.content,
						hasCss: !!css,
					});

					const response = {
						html: latestFile?.content || "",
						css: css || "",
						requestId: data.requestId,
						mcpSocketId: data.mcpSocketId,
					};

					console.log("[Chat] Sending preview_response:");
					console.log("[Chat]   - HTML length:", response.html.length);
					console.log("[Chat]   - CSS length:", response.css.length);
					console.log("[Chat]   - Request ID:", response.requestId);
					console.log("[Chat]   - MCP Socket ID:", response.mcpSocketId);
					console.log("[Chat] ========================================");

					socket.emit("preview_response", response);
					console.log("[Chat] preview_response emitted successfully");
				} catch (error) {
					console.error("[Chat] Failed to get preview:", error);
					console.error("[Chat] Error stack:", (error as Error).stack);
				}
			})();
		});

		// Listen for TTS notifications from Claude Code hooks
		socket.on("tts_notification", (data) => {
			console.log("[Chat] ========== TTS NOTIFICATION RECEIVED ==========");
			console.log("[Chat] Received tts_notification from Claude hook:", data);

			// Parse voice tags and trigger TTS if voice content exists
			const { hasVoice, voiceText } = parseVoiceTags(data.message);
			console.log("[TTS] Claude notification parsing:", {
				hasVoice,
				voiceTextLength: voiceText?.length || 0,
			});

			if (hasVoice && voiceText) {
				const ttsEnabled =
					typeof window !== "undefined" &&
					localStorage.getItem("ttsAutoPlay") === "true";
				const ttsActive =
					typeof window !== "undefined" &&
					localStorage.getItem("ttsActivated") === "true";

				console.log("[TTS] Claude notification - Checking conditions:", {
					ttsEnabled,
					supported: supportedRef.current,
					ttsActive,
				});

				if (ttsEnabled && supportedRef.current && ttsActive) {
					console.log(
						"[TTS] Claude notification - Speaking:",
						voiceText.substring(0, 50),
					);
					setSpeakingMessageId(`claude-notification-${Date.now()}`);
					speakRef.current({ text: voiceText });
				} else {
					console.log("[TTS] Claude notification - TTS conditions not met");
				}
			} else {
				console.log("[TTS] Claude notification - No voice content to speak");
			}
		});

		return () => {
			socket.off("mcp_request");
			socket.off("mcp_response");
			socket.off("mcp_error");
			socket.off("human_question");
			socket.off("sequential_thinking");
			socket.off("send_to_preview");
			socket.off("send_to_mermaid");
			socket.off("send_md_file");
			socket.off("get_preview_request");
			socket.off("tts_notification");
			socket.off("workspace_info");
		};
	}, [socket, addMessage]);

	// Listen for workspace info from MCP server
	useEffect(() => {
		if (!socket) return;

		// Workspace info listener removed - using manual folder input only
	}, [socket]);

	const handleSendMessage = async (messageContent?: string) => {
		const actualMessage = messageContent || inputValue;
		if (!actualMessage.trim()) return;

		// Stop microphone if recording
		if (isListening) {
			stopListening();
		}

		// Default pre-prompt (protocol) - dynamic based on TTS state
		const defaultPrePrompt = getDefaultPrePrompt(ttsAutoPlay);
		const defaultSubPrompt = getDefaultSubPrompt();

		const activePrePrompt = prePrompt.trim() ? prePrompt : defaultPrePrompt;
		const activeSubPrompt = subPrompt.trim() ? subPrompt : defaultSubPrompt;

		// Build message content with pre-prompt + separator + user message + sub-prompt
		const fullMessageContent = `${activePrePrompt}\n\n---------------------\nUSER MESSAGE:\n${actualMessage}\n${activeSubPrompt}`;

		// Create user message for display
		const userMessage: Message = {
			id: `msg_${Date.now()}`,
			type: "user",
			content: actualMessage || "[Image sent]",
			timestamp: new Date(),
		};

		// Add user message to chat and collapse it by default
		addMessage(userMessage);
		setCollapsedMessages((prev) => {
			const newSet = new Set(prev);
			newSet.add(userMessage.id);
			return newSet;
		});

		// Clear input immediately
		setInputValue("");

		// Check if we're responding to a pending request
		const pendingRequestIds = Array.from(pendingRequests);
		if (pendingRequestIds.length > 0) {
			// Respond to the most recent pending request
			const requestId = pendingRequestIds[pendingRequestIds.length - 1];
			console.log(
				"Responding to request ID:",
				requestId,
				"with response:",
				actualMessage,
			);

			if (sendUserResponse) {
				// For MCP responses, send full messageContent with pre-prompt and sub-prompt
				sendUserResponse(requestId, fullMessageContent);
				console.log(
					"User response sent via socket with pre-prompt and sub-prompt",
				);

				setPendingRequests((prev) => {
					const newSet = new Set(prev);
					newSet.delete(requestId);
					return newSet;
				});
			} else {
				console.error("sendUserResponse function not available");
			}
		} else {
			// Regular message - send directly to LLM
			console.log("Processing regular message");

			setIsProcessing(true);
			processingRef.current = true;

			try {
				if (sendMCPRequest) {
					// Build message with pre-prompt + separator + user message + sub-prompt
					let combinedText = `${activePrePrompt}\n\n`;
					combinedText += "---------------------\n";
					combinedText += "USER MESSAGE:\n";
					combinedText += actualMessage || "[Image sent]";
					combinedText += `\n${activeSubPrompt}`;

					const requestId = sendMCPRequest("chat/completions", {
						messages: [{ role: "user", content: combinedText }],
					});

					console.log(
						"Sent message via WebSocket MCP with requestId:",
						requestId,
					);
				}
			} catch (error) {
				console.error("Error sending message via WebSocket MCP:", error);
				addMessage({
					id: `error_${Date.now()}`,
					type: "system",
					content: "Error sending message. Please try again.",
					timestamp: new Date(),
				});
			} finally {
				setIsProcessing(false);
				processingRef.current = false;
			}
		}
	};

	const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage(inputValue);
		}
	};

	const handleCopyAll = async () => {
		try {
			const messagesToCopy = filteredMessages
				.map((message) => {
					const timestamp = message.timestamp.toLocaleString();
					if (message.type === "system") {
						return `[${timestamp}] System: ${message.content}`;
					}
					// User and Assistant messages without prefix
					return `[${timestamp}] ${message.content}`;
				})
				.join("\n\n");

			await navigator.clipboard.writeText(messagesToCopy);
			setCopySuccess(true);

			// Clear any existing timeout
			if (copySuccessTimeoutRef.current) {
				clearTimeout(copySuccessTimeoutRef.current);
			}

			copySuccessTimeoutRef.current = setTimeout(
				() => setCopySuccess(false),
				2000,
			);
		} catch (error) {
			console.error("Failed to copy messages:", error);
		}
	};

	const clearChat = () => {
		setMessages([]);
		setPendingRequests(new Set());
		setCollapsedMessages(new Set());
		setCopySuccess(false);
		setCopiedMessageId(null);
		// Clear input values
		setInputValue("");
		setPrePrompt("");
		setSubPrompt("");
		setSkillsInput("");
		// Reset search
		setSearchQuery("");
	};

	useEffect(() => {
		const style = document.createElement("style");
		style.innerHTML = pulseSlowAnimation;
		document.head.appendChild(style);
		return () => {
			document.head.removeChild(style);
		};
	}, []);

	// Cancel TTS on component unmount
	useEffect(() => {
		return () => {
			cancel();
		};
	}, [cancel]);

	// Cleanup timeouts on component unmount
	useEffect(() => {
		return () => {
			if (copySuccessTimeoutRef.current) {
				clearTimeout(copySuccessTimeoutRef.current);
				copySuccessTimeoutRef.current = null;
			}
			if (copyMessageTimeoutRef.current) {
				clearTimeout(copyMessageTimeoutRef.current);
				copyMessageTimeoutRef.current = null;
			}
		};
	}, []);

	// Cleanup blob URLs on component unmount
	useEffect(() => {
		return () => {
		};
	}, []);

	// Load chat settings from localStorage on mount
	useEffect(() => {
		if (typeof window !== "undefined") {
			const savedFontFamily = localStorage.getItem("chatFontFamily");
			const savedFontScale = localStorage.getItem("chatFontScale");
			const savedTextAlign = localStorage.getItem("chatTextAlign");
			const savedBubbleBackground = localStorage.getItem(
				"chatBubbleBackground",
			);

			if (savedFontFamily) {
				setChatFontFamily(savedFontFamily);
				console.log(
					"[Settings] Loaded chatFontFamily from localStorage:",
					savedFontFamily,
				);
			}
			if (savedFontScale) {
				setChatFontScale(Number.parseFloat(savedFontScale));
				console.log(
					"[Settings] Loaded chatFontScale from localStorage:",
					savedFontScale,
				);
			}
			if (
				savedTextAlign &&
				(savedTextAlign === "left" ||
					savedTextAlign === "center" ||
					savedTextAlign === "right")
			) {
				setChatTextAlign(savedTextAlign as "left" | "center" | "right");
				console.log(
					"[Settings] Loaded chatTextAlign from localStorage:",
					savedTextAlign,
				);
			}
			if (savedBubbleBackground) {
				setChatBubbleBackground(savedBubbleBackground);
				console.log(
					"[Settings] Loaded chatBubbleBackground from localStorage:",
					savedBubbleBackground,
				);
			}
		}
	}, []);

	// Save chat settings to localStorage when they change
	useEffect(() => {
		if (typeof window !== "undefined") {
			localStorage.setItem("chatFontFamily", chatFontFamily);
			localStorage.setItem("chatFontScale", chatFontScale.toString());
			localStorage.setItem("chatTextAlign", chatTextAlign);
			localStorage.setItem("chatBubbleBackground", chatBubbleBackground);
			console.log("[Settings] Saved to localStorage:", {
				chatFontFamily,
				chatFontScale,
				chatTextAlign,
				chatBubbleBackground,
			});
		}
	}, [chatFontFamily, chatFontScale, chatTextAlign, chatBubbleBackground]);

	return (
		<div className="h-full">
			<ResizablePanelGroup direction="horizontal" className="h-full">
				{/* Main Chat Interface */}
				<ResizablePanel defaultSize={60} minSize={40}>
					<Card className="h-full flex flex-col overflow-hidden">
						<CardHeader className="p-0">
							{/* Single Line: Search with Embedded Settings */}
							<div className="relative">
								<Input
									type="text"
									placeholder="Search messages..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="w-full pr-12 h-8 text-sm pt-1 pb-0 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
								/>
								{/* Settings Button - Embedded inside search bar */}
								<button
									type="button"
									onClick={() => setShowSettings(!showSettings)}
									className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 text-white transition-transform duration-200 hover:scale-110 flex items-center justify-center"
									title="Chat settings"
								>
									<MoreHorizontal
										className={
											connected ? "h-3 w-3 text-white" : "h-3 w-3 text-red-500"
										}
									/>
								</button>

								<ChatSettingsPanel
									showSettings={showSettings}
									setShowSettings={setShowSettings}
									chatFontFamily={chatFontFamily}
									setChatFontFamily={setChatFontFamily}
									chatFontScale={chatFontScale}
									setChatFontScale={setChatFontScale}
									chatTextAlign={chatTextAlign}
									setChatTextAlign={setChatTextAlign}
									chatBubbleBackground={chatBubbleBackground}
									setChatBubbleBackground={setChatBubbleBackground}
									supported={supported}
									ttsAutoPlay={ttsAutoPlay}
									setTtsAutoPlay={setTtsAutoPlay}
									speak={speak}
									setTtsActivated={setTtsActivated}
									handleCopyAll={handleCopyAll}
									copySuccess={copySuccess}
									filteredMessages={filteredMessages.map((msg) => ({
										...msg,
										role: msg.type,
									}))}
									clearChat={clearChat}
								/>
							</div>
							{error && (
								<div className="bg-red-50 border border-red-200 rounded-md p-3 mt-3">
									<p className="text-red-700 text-sm">{error}</p>
								</div>
							)}
						</CardHeader>

						<CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
							<div className="flex-1 px-4 pt-3 pb-0 overflow-hidden flex flex-col">
								<MessageList
									messages={messages}
									filteredMessages={filteredMessages}
									searchQuery={searchQuery}
									chatFontFamily={chatFontFamily}
									chatFontScale={chatFontScale}
									chatTextAlign={chatTextAlign}
									chatBubbleBackground={chatBubbleBackground}
									collapsedMessages={collapsedMessages}
									copiedMessageId={copiedMessageId}
									speaking={speaking}
									paused={paused}
									speakingMessageId={speakingMessageId}
									pausedMessageId={pausedMessageId}
									onCopyMessage={async (messageId, content) => {
										try {
											const textToCopy =
												content.trim() ||
												"[No content - placeholder message]";
											await navigator.clipboard.writeText(textToCopy);
											setCopiedMessageId(messageId);

											// Clear any existing timeout
											if (copyMessageTimeoutRef.current) {
												clearTimeout(copyMessageTimeoutRef.current);
											}

											copyMessageTimeoutRef.current = setTimeout(
												() => setCopiedMessageId(null),
												2000,
											);
										} catch (error) {
											console.error("Failed to copy message:", error);
										}
									}}
									onToggleCollapse={toggleMessageCollapse}
									onSpeakMessage={(text: string, messageId: string) => {
										speak({ text });
										setSpeakingMessageId(messageId);
										setPausedMessageId(null);
									}}
									onCancelSpeak={(messageId: string) => {
										pause();
										setPausedMessageId(messageId);
									}}
									onResumeSpeak={() => {
										resume();
										setPausedMessageId(null);
									}}
								/>

								{isProcessing && (
									<div className="flex justify-center">
										<div className="bg-blue-50 text-blue-700 p-2 rounded-lg text-sm border border-blue-200">
											<div className="flex items-center space-x-2">
												<Zap className="h-4 w-4 animate-spin" />
												<span>Processing message...</span>
												<Zap className="h-4 w-4 animate-spin" />
												<span>Processing message...</span>
											</div>
										</div>
									</div>
								)}
							</div>
							<ChatInputArea
								inputValue={inputValue}
								setInputValue={setInputValue}
								isListening={isListening}
								transcript={transcript}
								interimTranscript={interimTranscript}
								startListening={startListening}
								stopListening={stopListening}
								mounted={mounted}
								handleSendMessage={(message: string) => {
									handleSendMessage(message);
								}}
								isProcessing={isProcessing}
								connected={connected}
								ttsAutoPlay={ttsAutoPlay}
								socket={socket}
							/>
						</CardContent>
					</Card>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
};
