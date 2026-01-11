"use client";

import React, {
	useRef,
	useEffect,
	useState,
	useMemo,
	useCallback,
	type Dispatch,
	type SetStateAction,
	type ChangeEvent,
	memo,
} from "react";

import { type VariantProps, cva } from "class-variance-authority";
import equal from "fast-deep-equal";
import { AnimatePresence, motion } from "framer-motion";
import {
	Settings as GearIcon,
	Loader2 as LoaderIcon,
	X as XIcon,
} from "lucide-react";
import {
	Check,
	ChevronDown,
	ChevronUp,
	Copy,
	ImageIcon,
	MessageSquarePlus,
	Layers,
	Send,
	Trash2,
	Zap,
} from "lucide-react";
import Image from "next/image";
import { twMerge } from "tailwind-merge";
import { Switch } from "./switch";

const clsx = (...args: (string | boolean | undefined | null)[]) =>
	args.filter(Boolean).join(" ");

// Type Definitions
export interface Attachment {
	id?: string;
	url: string;
	name: string;
	contentType: string;
	size: number;
}

interface UIMessage {
	id: string;
	content: string;
	role: string;
	attachments?: Attachment[];
}

interface Prompt {
	id: string;
	title: string;
	content: string;
	usageCount: number;
	lastUsed: Date;
}

type VisibilityType = "public" | "private" | "unlisted" | string;

// Utility Functions
const cn = (...inputs: (string | boolean | undefined | null)[]) => {
	return twMerge(clsx(...inputs));
};

// Button variants using cva
const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default:
					"bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
				destructive: "border border-input bg-background hover:bg-accent",
				outline: "border border-input bg-background hover:bg-accent",
				secondary:
					"bg-secondary text-secondary-foreground hover:bg-secondary/80",
				ghost: "hover:bg-accent hover:text-accent-foreground",
				link: "underline-offset-4 hover:underline",
			},
			size: {
				default: "h-10 px-4 py-2",
				sm: "h-9 rounded-md px-3",
				lg: "h-11 rounded-md px-8",
				icon: "h-10 w-10",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

// Button component
interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? "button" : "button";

		return (
			<Comp
				className={cn(buttonVariants({ variant, size, className }))}
				ref={ref}
				{...props}
			/>
		);
	},
);
Button.displayName = "Button";

// Textarea component
const Textarea = React.forwardRef<
	HTMLTextAreaElement,
	React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
	return (
		<textarea
			className={cn(
				"flex min-h-[80px] w-full rounded-md border px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
				className,
			)}
			ref={ref}
			{...props}
		/>
	);
});
Textarea.displayName = "Textarea";

// Prompt Button Component
interface PromptButtonProps {
	prompt: Prompt;
	onClick: (prompt: Prompt) => void;
}

const PromptButton = memo(({ prompt, onClick }: PromptButtonProps) => {
	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -10 }}
			transition={{ duration: 0.2 }}
			className="flex-shrink-0"
		>
			<Button
				variant="outline"
				size="sm"
				className="flex items-center justify-between gap-2 pr-2 h-8 text-xs"
				onClick={() => onClick(prompt)}
			>
				<span className="truncate max-w-[120px]">{prompt.title}</span>
				<GearIcon className="h-3.5 w-3.5 flex-shrink-0" />
			</Button>
		</motion.div>
	);
});
PromptButton.displayName = "PromptButton";

// Prompt Suggestions Component
interface PromptSuggestionsProps {
	prompts: Prompt[];
	onSelectPrompt: (prompt: Prompt) => void;
}

const PromptSuggestions = memo(
	({ prompts, onSelectPrompt }: PromptSuggestionsProps) => {
		return (
			<div className="flex flex-wrap gap-2 mb-2">
				<AnimatePresence>
					{prompts.map((prompt) => (
						<PromptButton
							key={prompt.id}
							prompt={prompt}
							onClick={onSelectPrompt}
						/>
					))}
				</AnimatePresence>
			</div>
		);
	},
);
PromptSuggestions.displayName = "PromptSuggestions";

// Main MultimodalAIChatInput Component
export interface MultimodalAIChatInputProps {
	onSendMessage: (
		message: string,
		attachments: Attachment[],
	) => void;
	isLoading?: boolean;
	isRecording?: boolean;
	onToggleRecording?: () => void;
	disabled?: boolean;
	placeholder?: string;
	className?: string;
	suggestedPrompts?: Prompt[];
	onSelectPrompt?: (prompt: Prompt) => void;
	prePrompt?: string;
	onPrePromptChange?: (value: string) => void;
	prePromptPlaceholder?: string;
	onGetDefaultPrePrompt?: () => string;
	subPrompt?: string;
	onSubPromptChange?: (value: string) => void;
	subPromptPlaceholder?: string;
	skillsPrompt?: string;
	onSkillsPromptChange?: (value: string) => void;
	onFileUpload?: () => void;
	value?: string;
	onChange?: (value: string) => void;
	onCursorToEnd?: React.MutableRefObject<(() => void) | null>;
	interimTranscript?: string;
	confirmedTranscript?: string;
}

export const MultimodalAIChatInput = ({
	onSendMessage,
	isLoading = false,
	isRecording = false,
	onToggleRecording,
	disabled = false,
	placeholder = "Type your message here...",
	className,
	suggestedPrompts = [],
	onSelectPrompt,
	prePrompt = "",
	onPrePromptChange,
	prePromptPlaceholder,
	onGetDefaultPrePrompt,
	subPrompt = "",
	onSubPromptChange,
	subPromptPlaceholder,
	skillsPrompt = "",
	onSkillsPromptChange,
	onFileUpload,
	value,
	onChange,
	onCursorToEnd,
	interimTranscript = "",
	confirmedTranscript = "",
}: MultimodalAIChatInputProps) => {
	// State
	const [internalInputValue, setInternalInputValue] = useState("");
	const [attachments, setAttachments] = useState<Attachment[]>([]);
	const [isPrePromptVisible, setIsPrePromptVisible] = useState(false);
	const [isSubPromptVisible, setIsSubPromptVisible] = useState(false);
	const [isSkillsInputVisible, setIsSkillsInputVisible] = useState(false);
	const [copiedPrePrompt, setCopiedPrePrompt] = useState(false);
	const [copiedSubPrompt, setCopiedSubPrompt] = useState(false);

	// Use controlled or uncontrolled input value
	const inputValue = value !== undefined ? value : internalInputValue;

	// Display value with interim text appended while recording
	const displayValue =
		isRecording && interimTranscript
			? `${inputValue} ${interimTranscript}`
			: inputValue;

	// Function to update input value
	const updateInputValue = useCallback(
		(newValue: string) => {
			if (onChange) {
				// If onChange is provided, use it (controlled component)
				onChange(newValue);
			} else {
				// Otherwise use internal state (uncontrolled component)
				setInternalInputValue(newValue);
			}
		},
		[onChange],
	);

	// Refs
	const fileInputRef = useRef<HTMLInputElement>(null);
	const chatInputRef = useRef<HTMLTextAreaElement>(null);
	const prePromptInputRef = useRef<HTMLTextAreaElement>(null);
	const subPromptInputRef = useRef<HTMLTextAreaElement>(null);
	const skillsInputRef = useRef<HTMLTextAreaElement>(null);

	// Handle input change - auto-restore "1." when typing on first line
	const handleInputChange = useCallback(
		(e: ChangeEvent<HTMLTextAreaElement>) => {
			let rawValue = e.target.value;

			// If recording, strip the interim text from the end
			if (
				isRecording &&
				interimTranscript &&
				rawValue.endsWith(` ${interimTranscript}`)
			) {
				rawValue = rawValue.slice(0, -(interimTranscript.length + 1));
			}

			// Split into lines
			const lines = rawValue.split("\n");

			// Auto-restore "1." on first line when user starts typing
			if (lines.length > 0) {
				const firstLine = lines[0];
				// If first line has content but no "1. ", add it
				if (firstLine.trim() && !firstLine.startsWith("1. ")) {
					lines[0] = `1. ${firstLine.replace(/^1\.\s*/, "")}`;
				}
				// If first line is completely empty, leave it empty (allow deletion)
			}

			updateInputValue(lines.join("\n"));
		},
		[updateInputValue, isRecording, interimTranscript],
	);

	// Handle pre-prompt change
	const handlePrePromptChange = useCallback(
		(e: ChangeEvent<HTMLTextAreaElement>) => {
			if (onPrePromptChange) {
				onPrePromptChange(e.target.value);
			}
		},
		[onPrePromptChange],
	);

	// Handle sub-prompt change
	const handleSubPromptChange = useCallback(
		(e: ChangeEvent<HTMLTextAreaElement>) => {
			if (onSubPromptChange) {
				onSubPromptChange(e.target.value);
			}
		},
		[onSubPromptChange],
	);

	// Handle skills prompt change
	const handleSkillsPromptChange = useCallback(
		(e: ChangeEvent<HTMLTextAreaElement>) => {
			if (onSkillsPromptChange) {
				onSkillsPromptChange(e.target.value);
			}
		},
		[onSkillsPromptChange],
	);

	// Parse skills prompts from textarea
	const parsedSkills = useMemo(() => {
		if (!skillsPrompt.trim()) return [];

		// Split by double newlines to get separate prompts
		const prompts = skillsPrompt
			.split(/\n\s*\n|\n---+\n/)
			.map((p) => p.trim())
			.filter((p) => p.length > 0);

		return prompts;
	}, [skillsPrompt]);

	// Handle inserting a skill prompt into the input
	const handleInsertSkill = useCallback(
		(skillText: string) => {
			// Append to current input value
			const newValue = inputValue ? `${inputValue}\n${skillText}` : skillText;
			updateInputValue(newValue);

			// Focus the input after inserting
			setTimeout(() => {
				if (chatInputRef.current) {
					chatInputRef.current.focus();
					const textLength = chatInputRef.current.value.length;
					chatInputRef.current.selectionStart = textLength;
					chatInputRef.current.selectionEnd = textLength;
				}
			}, 100);
		},
		[inputValue, updateInputValue],
	);

	// Skills blocks state with unique IDs
	const [skillsBlocks, setSkillsBlocks] = useState<
		Array<{ id: string; text: string }>
	>(
		skillsPrompt
			.split("\n")
			.filter((b) => b.trim())
			.map((text, idx) => ({ id: `skill-${Date.now()}-${idx}`, text })),
	);
	const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

	// Sync skillsBlocks with skillsPrompt
	useEffect(() => {
		const blocks = skillsPrompt
			.split("\n")
			.filter((b) => b.trim())
			.map((text, idx) => ({ id: `skill-${Date.now()}-${idx}`, text }));
		setSkillsBlocks(blocks);
	}, [skillsPrompt]);

	// Handle block click
	const handleBlockClick = useCallback(
		(blockText: string) => {
			// Insert clicked block into input
			const newValue = inputValue
				? `${inputValue}\n1. ${blockText}`
				: `1. ${blockText}`;
			updateInputValue(newValue);

			// Focus input
			setTimeout(() => {
				if (chatInputRef.current) {
					chatInputRef.current.focus();
				}
			}, 100);
		},
		[inputValue, updateInputValue],
	);

	// Handle block edit
	const handleBlockEdit = useCallback(
		(id: string, text: string) => {
			const newBlocks = skillsBlocks.map((b) =>
				b.id === id ? { ...b, text } : b,
			);
			setSkillsBlocks(newBlocks);
			const newPrompt = newBlocks.map((b) => b.text).join("\n");
			if (onSkillsPromptChange) {
				onSkillsPromptChange(newPrompt);
			}
		},
		[skillsBlocks, onSkillsPromptChange],
	);

	// Handle add new block
	const handleAddBlock = useCallback(() => {
		const newId = `skill-${Date.now()}`;
		const newBlocks = [...skillsBlocks, { id: newId, text: "" }];
		setSkillsBlocks(newBlocks);
		setEditingBlockId(newId);
	}, [skillsBlocks]);

	// Handle block key press
	const handleBlockKeyPress = useCallback(
		(e: React.KeyboardEvent, id: string) => {
			if (e.key === "Enter") {
				e.preventDefault();
				const index = skillsBlocks.findIndex((b) => b.id === id);
				const newId = `skill-${Date.now()}`;
				const newBlocks = [...skillsBlocks];
				newBlocks.splice(index + 1, 0, { id: newId, text: "" });
				setSkillsBlocks(newBlocks);
				setEditingBlockId(newId);

				// Update the prompt
				setTimeout(() => {
					const updatedPrompt = newBlocks.map((b) => b.text).join("\n");
					if (onSkillsPromptChange) {
						onSkillsPromptChange(updatedPrompt);
					}
				}, 0);
			} else if (
				e.key === "Backspace" &&
				!skillsBlocks.find((b) => b.id === id)?.text &&
				skillsBlocks.length > 1
			) {
				e.preventDefault();
				const index = skillsBlocks.findIndex((b) => b.id === id);
				const newBlocks = skillsBlocks.filter((b) => b.id !== id);
				setSkillsBlocks(newBlocks);
				const prevBlock = newBlocks[Math.max(0, index - 1)];
				if (prevBlock) setEditingBlockId(prevBlock.id);

				// Update the prompt
				const updatedPrompt = newBlocks.map((b) => b.text).join("\n");
				if (onSkillsPromptChange) {
					onSkillsPromptChange(updatedPrompt);
				}
			}
		},
		[skillsBlocks, onSkillsPromptChange],
	);

	// Handle delete block
	const handleDeleteBlock = useCallback(
		(id: string) => {
			const newBlocks = skillsBlocks.filter((b) => b.id !== id);
			setSkillsBlocks(newBlocks);
			const updatedPrompt = newBlocks.map((b) => b.text).join("\n");
			if (onSkillsPromptChange) {
				onSkillsPromptChange(updatedPrompt);
			}
		},
		[skillsBlocks, onSkillsPromptChange],
	);

	// Handle send to LLM directly
	const handleSendToLLM = useCallback(
		(blockText: string) => {
			const messageToSend = `1. ${blockText}`;
			onSendMessage(messageToSend, attachments);
		},
		[onSendMessage, attachments],
	);

	// Handle copy pre-prompt
	const handleCopyPrePrompt = useCallback(async () => {
		const textToCopy =
			prePrompt.trim() ||
			(onGetDefaultPrePrompt ? onGetDefaultPrePrompt() : "");

		try {
			await navigator.clipboard.writeText(textToCopy);
			setCopiedPrePrompt(true);
			setTimeout(() => setCopiedPrePrompt(false), 2000);
		} catch (err) {
			// Fallback for older browsers
			const textarea = document.createElement("textarea");
			textarea.value = textToCopy;
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand("copy");
			document.body.removeChild(textarea);
			setCopiedPrePrompt(true);
			setTimeout(() => setCopiedPrePrompt(false), 2000);
		}
	}, [prePrompt, onGetDefaultPrePrompt]);

	// Handle copy sub-prompt
	const handleCopySubPrompt = useCallback(async () => {
		const textToCopy = subPrompt.trim() || subPromptPlaceholder || "";

		try {
			await navigator.clipboard.writeText(textToCopy);
			setCopiedSubPrompt(true);
			setTimeout(() => setCopiedSubPrompt(false), 2000);
		} catch (err) {
			// Fallback for older browsers
			const textarea = document.createElement("textarea");
			textarea.value = textToCopy;
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand("copy");
			document.body.removeChild(textarea);
			setCopiedSubPrompt(true);
			setTimeout(() => setCopiedSubPrompt(false), 2000);
		}
	}, [subPrompt, subPromptPlaceholder]);

	// Handle key press (Enter to send, Shift+Enter for new line with auto-number)
	const handleKeyPress = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				if (inputValue.trim() || attachments.length > 0) {
					onSendMessage(inputValue, attachments);
					updateInputValue("");
					setAttachments([]);
				}
			} else if (e.key === "Enter" && e.shiftKey) {
				// Shift+Enter: Number follows to next line
				e.preventDefault();
				const textarea = e.currentTarget;
				const cursorPos = textarea.selectionStart;
				const textBefore = inputValue.substring(0, cursorPos);
				const textAfter = inputValue.substring(cursorPos);

				// Get all lines and current line
				const lines = textBefore.split("\n");
				const currentLine = lines[lines.length - 1];

				// Check if current line is empty numbered line (e.g., "2. " with nothing after)
				const emptyNumberMatch = currentLine.match(/^(\d+)\.\s*$/);

				if (emptyNumberMatch) {
					// Empty numbered line - remove it, add blank line, then add same number to next line
					const sameNumber = emptyNumberMatch[1];
					const linesBeforeCurrent = lines.slice(0, -1);
					const newTextBefore =
						linesBeforeCurrent.join("\n") +
						(linesBeforeCurrent.length > 0 ? "\n" : "");
					const newValue = `${newTextBefore}\n${sameNumber}. ${textAfter}`;
					updateInputValue(newValue);

					setTimeout(() => {
						if (chatInputRef.current) {
							const newCursorPos =
								newTextBefore.length + 1 + sameNumber.length + 2;
							chatInputRef.current.selectionStart = newCursorPos;
							chatInputRef.current.selectionEnd = newCursorPos;
						}
					}, 0);
				} else {
					// Line has content - calculate next number
					const allCurrentLines = inputValue.split("\n");
					const numberedLines = allCurrentLines.filter((line) =>
						/^\d+\.\s+\S/.test(line),
					);
					const nextNumber = numberedLines.length + 1;

					// Add new line with next number
					const newValue = `${textBefore}\n${nextNumber}. ${textAfter}`;
					updateInputValue(newValue);

					setTimeout(() => {
						if (chatInputRef.current) {
							const newCursorPos = cursorPos + `\n${nextNumber}. `.length;
							chatInputRef.current.selectionStart = newCursorPos;
							chatInputRef.current.selectionEnd = newCursorPos;
						}
					}, 0);
				}
			}
		},
		[inputValue, attachments, onSendMessage, updateInputValue],
	);

	// Handle file selection
	const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files?.length) return;

		// Process files and create attachments
		const newAttachments: Attachment[] = [];

		for (const file of Array.from(files)) {
			const reader = new FileReader();
			reader.onload = () => {
				const attachment: Attachment = {
					url: reader.result as string,
					name: file.name,
					contentType: file.type,
					size: file.size,
				};

				setAttachments((prev) => [...prev, attachment]);
			};
			reader.readAsDataURL(file);
		}

		// Reset file input
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	}, []);

	// Drag-and-drop support (images)
	const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
	}, []);

	const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();

		const files = e.dataTransfer?.files;
		if (!files || files.length === 0) return;

		for (const file of Array.from(files)) {
			if (!file.type.startsWith("image/")) return;
			const reader = new FileReader();
			reader.onload = () => {
				const attachment: Attachment = {
					url: reader.result as string,
					name: file.name,
					contentType: file.type,
					size: file.size,
				};

				setAttachments((prev) => [...prev, attachment]);
			};
			reader.readAsDataURL(file);
		}
	}, []);

	// Handle send button click
	const handleSendClick = useCallback(() => {
		if (inputValue.trim() || attachments.length > 0) {
			onSendMessage(inputValue, attachments);
			updateInputValue("");
			setAttachments([]);
		}
	}, [
		inputValue,
		attachments,
		onSendMessage,
		updateInputValue,
	]);

	// Handle prompt selection
	const handleSelectPrompt = useCallback(
		(prompt: Prompt) => {
			if (onSelectPrompt) {
				onSelectPrompt(prompt);
			} else {
				const newValue = inputValue
					? `${inputValue}\n${prompt.content}`
					: prompt.content;
				updateInputValue(newValue);
			}
		},
		[onSelectPrompt, inputValue, updateInputValue],
	);

	// Handle remove attachment
	const handleRemoveAttachment = useCallback((index: number) => {
		setAttachments((prev) => prev.filter((_, i) => i !== index));
	}, []);

	// Auto-resize textarea on input
	useEffect(() => {
		if (chatInputRef.current) {
			// Save cursor position before resizing
			const cursorPos = chatInputRef.current.selectionStart;
			const cursorEnd = chatInputRef.current.selectionEnd;

			chatInputRef.current.style.height = "auto";
			chatInputRef.current.style.height = `${Math.min(
				chatInputRef.current.scrollHeight,
				280,
			)}px`;

			// Restore cursor position after resizing
			requestAnimationFrame(() => {
				if (chatInputRef.current) {
					chatInputRef.current.selectionStart = cursorPos;
					chatInputRef.current.selectionEnd = cursorEnd;
				}
			});
		}
	}, []);

	// Initialize input value from props when component mounts or value prop changes
	useEffect(() => {
		if (value !== undefined && value !== internalInputValue) {
			// Save cursor position before updating
			const cursorPos = chatInputRef.current?.selectionStart || 0;
			const cursorEnd = chatInputRef.current?.selectionEnd || 0;

			setInternalInputValue(value);

			// Restore cursor position after React updates
			requestAnimationFrame(() => {
				if (chatInputRef.current) {
					chatInputRef.current.selectionStart = cursorPos;
					chatInputRef.current.selectionEnd = cursorEnd;
				}
			});
		}
	}, [value, internalInputValue]);

	// Auto-resize pre-prompt textarea on input
	useEffect(() => {
		if (prePromptInputRef.current && isPrePromptVisible) {
			prePromptInputRef.current.style.height = "auto";
			prePromptInputRef.current.style.height = `${Math.min(
				prePromptInputRef.current.scrollHeight,
				150,
			)}px`;
		}
	}, [isPrePromptVisible]);

	// Auto-resize sub-prompt textarea on input
	useEffect(() => {
		if (subPromptInputRef.current && isSubPromptVisible) {
			subPromptInputRef.current.style.height = "auto";
			subPromptInputRef.current.style.height = `${Math.min(
				subPromptInputRef.current.scrollHeight,
				150,
			)}px`;
		}
	}, [isSubPromptVisible]);

	// Auto-resize skills prompt textarea on input
	useEffect(() => {
		if (skillsInputRef.current && isSkillsInputVisible) {
			skillsInputRef.current.style.height = "auto";
			skillsInputRef.current.style.height = `${Math.min(
				skillsInputRef.current.scrollHeight,
				150,
			)}px`;
		}
	}, [isSkillsInputVisible]);

	// Cursor positioning function
	const placeCursorAtEnd = useCallback(() => {
		if (chatInputRef.current) {
			// Use a longer delay to ensure the input value has been updated
			setTimeout(() => {
				if (chatInputRef.current) {
					const textLength = chatInputRef.current.value.length;
					chatInputRef.current.selectionStart = textLength;
					chatInputRef.current.selectionEnd = textLength;
					chatInputRef.current.focus();
					console.log(
						"[Input] Cursor positioned at end, focus set, text length:",
						textLength,
					);
				}
			}, 100);
		}
	}, []);

	// Expose cursor positioning function to parent
	useEffect(() => {
		if (onCursorToEnd) {
			onCursorToEnd.current = placeCursorAtEnd;
		}
	}, [onCursorToEnd, placeCursorAtEnd]);

	return (
		<div className={cn("w-full", className)}>
			{/* Suggestion Prompts */}
			{suggestedPrompts.length > 0 && (
				<PromptSuggestions
					prompts={suggestedPrompts}
					onSelectPrompt={handleSelectPrompt}
				/>
			)}

			{/* Collapsible skills prompt */}
			<div className="mb-3 w-full border rounded-md overflow-hidden shadow-sm">
				<button
					type="button"
					className="flex items-center justify-between w-full p-2 cursor-pointer"
					onClick={() => setIsSkillsInputVisible(!isSkillsInputVisible)}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							setIsSkillsInputVisible(!isSkillsInputVisible);
						}
					}}
				>
					<div className="flex items-center">
						<Zap className="h-4 w-4" />
						<span className="text-sm font-medium ml-2">Skills</span>
					</div>
					<div>
						{isSkillsInputVisible ? (
							<ChevronDown className="h-4 w-4" />
						) : (
							<ChevronUp className="h-4 w-4" />
						)}
					</div>
				</button>
				{isSkillsInputVisible && (
					<div className="border-t">
						{/* Notion-like blocks */}
						<div
							className="min-h-[60px] max-h-[150px] overflow-y-auto p-3"
							style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
						>
							{skillsBlocks.map((block) => (
								<div key={block.id} className="flex items-center group">
									{editingBlockId === block.id ? (
										<input
											type="text"
											value={block.text}
											onChange={(e) =>
												handleBlockEdit(block.id, e.target.value)
											}
											onBlur={() => setEditingBlockId(null)}
											onKeyDown={(e) => handleBlockKeyPress(e, block.id)}
											className="flex-1 px-2 py-1 border-0 outline-none bg-transparent text-white"
											placeholder="Type a prompt..."
										/>
									) : (
										<div className="flex items-center flex-1">
											<button
												type="button"
												onClick={() => setEditingBlockId(block.id)}
												onKeyDown={(e) => {
													if (e.key === "Enter" || e.key === " ") {
														e.preventDefault();
														setEditingBlockId(block.id);
													}
												}}
												className="flex-1 px-2 py-1 cursor-text rounded text-left border-0 bg-transparent"
											>
												{block.text || (
													<span className="text-gray-600">
														Empty prompt - click to add
													</span>
												)}
											</button>
											{block.text && (
												<div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
													<button
														type="button"
														onClick={() => handleDeleteBlock(block.id)}
														className="p-1 text-gray-400 hover:text-white transition-colors"
														title="Delete block"
													>
														<Trash2 className="h-4 w-4" />
													</button>
													<button
														type="button"
														onClick={() => handleBlockClick(block.text)}
														className="p-1 text-gray-400 hover:text-white transition-colors"
														title="Send to input"
													>
														<Copy className="h-4 w-4" />
													</button>
													<button
														type="button"
														onClick={() => handleSendToLLM(block.text)}
														className="p-1 text-gray-400 hover:text-white transition-colors"
														title="Send to LLM"
													>
														<Send className="h-4 w-4" />
													</button>
												</div>
											)}
										</div>
									)}
								</div>
							))}
							{/* Add new block button */}
							<div className="flex items-center mt-1">
								<button
									type="button"
									onClick={handleAddBlock}
									className="text-gray-500 hover:text-gray-300 text-sm px-2 py-1"
								>
									+ Add Skill
								</button>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Collapsible pre-prompt */}
			<div className="mb-3 w-full border rounded-md overflow-hidden shadow-sm">
				<button
					type="button"
					className="flex items-center justify-between w-full p-2 cursor-pointer group"
					onClick={() => setIsPrePromptVisible(!isPrePromptVisible)}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							setIsPrePromptVisible(!isPrePromptVisible);
						}
					}}
				>
					<div className="flex items-center">
						<MessageSquarePlus className="h-4 w-4 mr-2" />
						<span className="text-sm font-medium">Pre-Prompt</span>
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								handleCopyPrePrompt();
							}}
							className="p-1 text-gray-400 hover:text-white"
							title="Copy pre-prompt"
						>
							{copiedPrePrompt ? (
								<Check className="h-4 w-4 text-gray-400" />
							) : (
								<Copy className="h-4 w-4" />
							)}
						</button>
						{isPrePromptVisible ? (
							<ChevronDown className="h-4 w-4" />
						) : (
							<ChevronUp className="h-4 w-4" />
						)}
					</div>
				</button>
				{isPrePromptVisible && (
					<div className="p-0">
						<textarea
							ref={prePromptInputRef}
							value={prePrompt}
							onChange={handlePrePromptChange}
							className="min-h-[60px] w-full p-3 border-0 border-t resize-none focus:outline-none focus:ring-1"
							style={{
								scrollbarWidth: "none",
								msOverflowStyle: "none",
								height: "auto",
								minHeight: "60px",
								maxHeight: "150px",
								overflowY: "auto",
							}}
							placeholder={prePromptPlaceholder || ""}
						/>
					</div>
				)}
			</div>

			{/* Attachments preview */}
			{attachments.length > 0 && (
				<div className="mb-3 p-2 border rounded-lg">
					<div className="flex flex-wrap gap-2">
						{attachments.map((attachment, index) => (
							<div
								key={attachment.id || `attachment-${index}-${attachment.name}`}
								className="flex items-center space-x-2 p-2 rounded border"
							>
								{attachment.contentType.startsWith("image/") && (
									<div className="relative h-10 w-10 flex-shrink-0">
										<Image
											src={attachment.url}
											alt={attachment.name}
											fill
											className="object-cover rounded"
										/>
									</div>
								)}
								<div className="flex-1 min-w-0">
									<p className="text-xs truncate">{attachment.name}</p>
									<p className="text-xs">
										{(attachment.size / 1024).toFixed(1)} KB
									</p>
								</div>
								<button
									type="button"
									onClick={() => handleRemoveAttachment(index)}
									className=""
								>
									<XIcon className="h-4 w-4" />
								</button>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Hidden file input */}
			<input
				ref={fileInputRef}
				type="file"
				accept="image/*"
				onChange={handleFileSelect}
				className="hidden"
				multiple
			/>

			{/* Chat input with icons */}
			<div
				className="w-full relative"
				onDragOver={handleDragOver}
				onDrop={handleDrop}
			>
				<div className="flex items-center border rounded-md">
					{/* Image upload button */}
					<button
						type="button"
						onClick={() => {
							if (onFileUpload) {
								// Use the external file upload handler if provided
								onFileUpload();
							} else if (fileInputRef.current) {
								// Otherwise use the internal file input
								fileInputRef.current.click();
							}
						}}
						disabled={disabled || isLoading}
						className="flex-shrink-0 p-2 mx-2 disabled:opacity-50"
					>
						<ImageIcon className="h-5 w-5" />
					</button>

					{/* Input field - simple, all white text */}
					<textarea
						ref={chatInputRef}
						value={displayValue}
						onChange={handleInputChange}
						className="flex-1 py-3 px-3 border-0 focus:outline-none focus:ring-0 text-sm resize-none text-white scrollbar-hide"
						onKeyDown={handleKeyPress}
						placeholder={placeholder}
						disabled={disabled || isLoading}
						style={{
							height: "auto",
							minHeight: "70px",
							maxHeight: "280px",
							overflowY: "auto",
							scrollbarWidth: "none",
							msOverflowStyle: "none",
						}}
					/>

					{/* Right side buttons */}
					<div className="flex items-center pr-2 space-x-3">
						{/* Voice recording button */}
						{onToggleRecording && (
							<button
								type="button"
								onClick={onToggleRecording}
								disabled={disabled || isLoading}
								className={`p-2 mx-1 rounded-full disabled:opacity-50 transition-all duration-200 ${
									isRecording
										? "bg-red-500 text-white"
										: "bg-gray-100 hover:bg-gray-200 text-gray-700"
								}`}
							>
								{isRecording ? (
									<LoaderIcon className="h-5 w-5 animate-spin" />
								) : (
									<svg
										xmlns="http://www.w3.org/2000/svg"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
										className="h-5 w-5"
										role="img"
										aria-label="Microphone"
									>
										<title>Microphone</title>
										<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
										<path d="M19 10v2a7 7 0 0 1-14 0v-2" />
										<line x1="12" x2="12" y1="19" y2="22" />
									</svg>
								)}
							</button>
						)}

						{/* Send button */}
						<button
							type="button"
							onClick={handleSendClick}
							disabled={
								disabled ||
								isLoading ||
								(!inputValue.trim() && attachments.length === 0)
							}
							className="p-2 rounded-full disabled:opacity-50"
						>
							{isLoading ? (
								<LoaderIcon className="h-5 w-5 animate-spin" />
							) : (
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="h-5 w-5"
									role="img"
									aria-label="Send"
								>
									<path d="m22 2-7 20-4-9-9-4Z" />
									<path d="M22 2 11 13" />
								</svg>
							)}
						</button>
					</div>
				</div>
			</div>

			{/* Collapsible sub-prompt (below main input) */}
			<div className="mt-3 w-full border rounded-md overflow-hidden shadow-sm">
				<button
					type="button"
					className="flex items-center justify-between w-full p-2 cursor-pointer group"
					onClick={() => setIsSubPromptVisible(!isSubPromptVisible)}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							setIsSubPromptVisible(!isSubPromptVisible);
						}
					}}
				>
					<div className="flex items-center">
						<Layers className="h-4 w-4 mr-2" />
						<span className="text-sm font-medium">Sub-Prompt</span>
					</div>
					<div className="flex items-center gap-2">
						{isSubPromptVisible && (
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									handleCopySubPrompt();
								}}
								className="p-1 text-gray-400 hover:text-white"
								title="Copy sub-prompt"
							>
								{copiedSubPrompt ? (
									<Check className="h-4 w-4 text-gray-400" />
								) : (
									<Copy className="h-4 w-4" />
								)}
							</button>
						)}
						{isSubPromptVisible ? (
							<ChevronDown className="h-4 w-4" />
						) : (
							<ChevronUp className="h-4 w-4" />
						)}
					</div>
				</button>
				{isSubPromptVisible && (
					<div className="p-0">
						<textarea
							ref={subPromptInputRef}
							value={subPrompt}
							onChange={handleSubPromptChange}
							className="min-h-[60px] w-full p-3 border-0 border-t resize-none focus:outline-none focus:ring-1"
							style={{
								scrollbarWidth: "none",
								msOverflowStyle: "none",
								height: "auto",
								minHeight: "60px",
								maxHeight: "150px",
								overflowY: "auto",
							}}
							placeholder={subPromptPlaceholder || ""}
						/>
					</div>
				)}
			</div>
		</div>
	);
};

MultimodalAIChatInput.displayName = "MultimodalAIChatInput";
