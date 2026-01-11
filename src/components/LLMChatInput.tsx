import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { AnimatePresence, motion } from "framer-motion";
import {
	ArrowUp,
	Check,
	Copy,
	Layers,
	Lightbulb,
	Mic,
	Square,
	StopCircle,
	X,
	CornerDownLeft,
} from "lucide-react";
import React from "react";
import { usePromptData } from "../hooks/usePromptData";
import { getDefaultPrePrompt, getDefaultSubPrompt } from "../lib/prompts";
import styles from "./LLMChatInput.module.css";
import { type SlashCommand, SlashCommandPicker } from "./SlashCommandPicker";
// Speech recognition is now controlled by parent; no direct hook usage here

// Utility function for className merging
const cn = (...classes: (string | undefined | null | false)[]) =>
	classes.filter(Boolean).join(" ");

// Embedded CSS for minimal custom styles
const embeddedStyles = `
  *:focus-visible {
    outline-offset: 0 !important;
    --ring-offset: 0 !important;
  }
  textarea::-webkit-scrollbar {
    width: 6px;
  }
  textarea::-webkit-scrollbar-track {
    background: transparent;
  }
  textarea::-webkit-scrollbar-thumb {
    background-color: #444444;
    border-radius: 3px;
  }
  textarea::-webkit-scrollbar-thumb:hover {
    background-color: #555555;
  }
`;

// Style injector component
const StyleInjector: React.FC = () => {
	React.useEffect(() => {
		if (
			typeof window !== "undefined" &&
			!document.getElementById("llm-chat-input-styles")
		) {
			const styleSheet = document.createElement("style");
			styleSheet.id = "llm-chat-input-styles";
			styleSheet.innerText = embeddedStyles;
			document.head.appendChild(styleSheet);

			return () => {
				// Cleanup styles when component unmounts
				if (document.getElementById("llm-chat-input-styles")) {
					document.head.removeChild(styleSheet);
				}
			};
		}
	}, []);

	return null;
};

// Textarea Component
interface TextareaProps
	extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
	className?: string;
}
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
	({ className, ...props }, ref) => (
		<textarea
			className={cn(
				"flex w-full rounded-md border-none bg-transparent px-3 py-2.5 text-base text-gray-100 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px] resize-none scrollbar-thin scrollbar-thumb-[#444444] scrollbar-track-transparent hover:scrollbar-thumb-[#555555]",
				className,
			)}
			ref={ref}
			rows={1}
			{...props}
		/>
	),
);
Textarea.displayName = "Textarea";

// Tooltip Components
const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipContent = React.forwardRef<
	React.ElementRef<typeof TooltipPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
	<TooltipPrimitive.Content
		ref={ref}
		sideOffset={sideOffset}
		className={cn(
			"z-50 overflow-hidden rounded-md border border-[#333333] bg-[#1F2023] px-3 py-1.5 text-sm text-white shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
			className,
		)}
		{...props}
	/>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

// Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "default" | "outline" | "ghost";
	size?: "default" | "sm" | "lg" | "icon";
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant = "default", size = "default", ...props }, ref) => {
		const variantClasses = {
			default: "bg-white hover:bg-white/80 text-black",
			outline: "border border-[#444444] bg-transparent hover:bg-[#3A3A40]",
			ghost: "bg-transparent hover:bg-[#3A3A40]",
		};
		const sizeClasses = {
			default: "h-10 px-4 py-2",
			sm: "h-8 px-3 text-sm",
			lg: "h-12 px-6",
			icon: "h-8 w-8 rounded-full aspect-[1/1]",
		};
		return (
			<button
				className={cn(
					"inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
					variantClasses[variant],
					sizeClasses[size],
					className,
				)}
				ref={ref}
				{...props}
			/>
		);
	},
);
Button.displayName = "Button";

// Pre-prompt Panel Component - Textarea with placeholder like ChatInterface
const PrepromptPanel: React.FC<{
	onClose: () => void;
	onSave: (preprompt: string) => void;
	preprompt?: string;
	onPrepromptChange?: (preprompt: string) => void;
	ttsEnabled?: boolean;
}> = ({
	onClose,
	onSave,
	preprompt = "",
	onPrepromptChange,
	ttsEnabled = false,
}) => {
	const [copiedPrePrompt, setCopiedPrePrompt] = React.useState(false);
	const textareaRef = React.useRef<HTMLTextAreaElement>(null);
	const copyTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

	// Cleanup timeout on component unmount
	React.useEffect(() => {
		return () => {
			if (copyTimeoutRef.current) {
				clearTimeout(copyTimeoutRef.current);
				copyTimeoutRef.current = null;
			}
		};
	}, []);

	const handleCopyPrePrompt = async () => {
		try {
			const textToCopy = preprompt || getDefaultPrePrompt(ttsEnabled);
			await navigator.clipboard.writeText(textToCopy);
			setCopiedPrePrompt(true);

			// Clear any existing timeout
			if (copyTimeoutRef.current) {
				clearTimeout(copyTimeoutRef.current);
			}

			copyTimeoutRef.current = setTimeout(
				() => setCopiedPrePrompt(false),
				2000,
			);
		} catch (error) {
			console.error("Failed to copy pre-prompt:", error);
		}
	};

	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		onPrepromptChange?.(e.target.value);
	};

	return (
		<div
			className="flex flex-col p-4"
			style={{ height: "300px", minHeight: "300px" }}
		>
			<div className="flex items-center justify-between mb-3">
				<span className="text-sm font-medium text-white">Pre-Prompt</span>
				<button
					type="button"
					onClick={handleCopyPrePrompt}
					className="p-1 text-gray-400 hover:text-white transition-colors"
					title="Copy pre-prompt"
				>
					{copiedPrePrompt ? (
						<Check className="h-4 w-4 text-green-400" />
					) : (
						<Copy className="h-4 w-4" />
					)}
				</button>
			</div>
			<textarea
				ref={textareaRef}
				value={preprompt}
				onChange={handleChange}
				className="flex-1 w-full p-3 bg-transparent text-white border border-gray-700 rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]"
				style={{
					scrollbarWidth: "thin",
					scrollbarColor: "#4B5563 #1C1C1C",
				}}
				placeholder={getDefaultPrePrompt(ttsEnabled)}
			/>
		</div>
	);
};

// Sub-prompt Panel Component - Textarea with placeholder like ChatInterface
const SubpromptPanel: React.FC<{
	onClose: () => void;
	onSave: (subprompt: string) => void;
	subprompt?: string;
	onSubpromptChange?: (subprompt: string) => void;
}> = ({ onClose, onSave, subprompt = "", onSubpromptChange }) => {
	const [copiedSubPrompt, setCopiedSubPrompt] = React.useState(false);
	const textareaRef = React.useRef<HTMLTextAreaElement>(null);
	const copyTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

	// Cleanup timeout on component unmount
	React.useEffect(() => {
		return () => {
			if (copyTimeoutRef.current) {
				clearTimeout(copyTimeoutRef.current);
				copyTimeoutRef.current = null;
			}
		};
	}, []);

	const handleCopySubPrompt = async () => {
		try {
			const textToCopy = subprompt || getDefaultSubPrompt();
			await navigator.clipboard.writeText(textToCopy);
			setCopiedSubPrompt(true);

			// Clear any existing timeout
			if (copyTimeoutRef.current) {
				clearTimeout(copyTimeoutRef.current);
			}

			copyTimeoutRef.current = setTimeout(
				() => setCopiedSubPrompt(false),
				2000,
			);
		} catch (error) {
			console.error("Failed to copy sub-prompt:", error);
		}
	};

	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		onSubpromptChange?.(e.target.value);
	};

	return (
		<div
			className="flex flex-col p-4"
			style={{ height: "300px", minHeight: "300px" }}
		>
			<div className="flex items-center justify-between mb-3">
				<span className="text-sm font-medium text-white">Sub-Prompt</span>
				<button
					type="button"
					onClick={handleCopySubPrompt}
					className="p-1 text-gray-400 hover:text-white transition-colors"
					title="Copy sub-prompt"
				>
					{copiedSubPrompt ? (
						<Check className="h-4 w-4 text-green-400" />
					) : (
						<Copy className="h-4 w-4" />
					)}
				</button>
			</div>
			<textarea
				ref={textareaRef}
				value={subprompt}
				onChange={handleChange}
				className="flex-1 w-full p-3 bg-transparent text-white border border-gray-700 rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-[#F97316]"
				style={{
					scrollbarWidth: "thin",
					scrollbarColor: "#4B5563 #1C1C1C",
				}}
				placeholder={getDefaultSubPrompt()}
			/>
		</div>
	);
};

// PromptInput Context and Components
interface PromptInputContextType {
	isLoading: boolean;
	value: string;
	setValue: (value: string) => void;
	maxHeight: number | string;
	onSubmit?: () => void;
	disabled?: boolean;
	interimTranscript?: string;
	isListening?: boolean;
}
const PromptInputContext = React.createContext<PromptInputContextType>({
	isLoading: false,
	value: "",
	setValue: () => {},
	maxHeight: 240,
	onSubmit: undefined,
	disabled: false,
	interimTranscript: "",
	isListening: false,
});
function usePromptInput() {
	const context = React.useContext(PromptInputContext);
	if (!context)
		throw new Error("usePromptInput must be used within a PromptInput");
	return context;
}

interface PromptInputProps {
	isLoading?: boolean;
	value?: string;
	onValueChange?: (value: string) => void;
	maxHeight?: number | string;
	onSubmit?: () => void;
	children: React.ReactNode;
	className?: string;
	disabled?: boolean;
	interimTranscript?: string;
	isListening?: boolean;
}
const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(
	(
		{
			className,
			isLoading = false,
			maxHeight = 240,
			value,
			onValueChange,
			onSubmit,
			children,
			disabled = false,
			interimTranscript = "",
			isListening = false,
		},
		ref,
	) => {
		const [internalValue, setInternalValue] = React.useState(value || "");
		const handleChange = (newValue: string) => {
			setInternalValue(newValue);
			onValueChange?.(newValue);
		};
		return (
			<TooltipProvider>
				<PromptInputContext.Provider
					value={{
						isLoading,
						value: value ?? internalValue,
						setValue: onValueChange ?? handleChange,
						maxHeight,
						onSubmit,
						disabled,
						interimTranscript,
						isListening,
					}}
				>
					<StyledPromptContainer
						ref={ref}
						className={cn(isLoading && "loading", className)}
					>
						{children}
					</StyledPromptContainer>
				</PromptInputContext.Provider>
			</TooltipProvider>
		);
	},
);
PromptInput.displayName = "PromptInput";

interface PromptInputTextareaProps {
	disableAutosize?: boolean;
	placeholder?: string;
	onValueChange?: (value: string, cursorPos?: number) => void;
}
const PromptInputTextarea: React.FC<
	PromptInputTextareaProps & React.ComponentProps<typeof Textarea>
> = ({
	className,
	onKeyDown,
	disableAutosize = false,
	placeholder,
	onValueChange,
	...props
}) => {
	const {
		value,
		setValue,
		maxHeight,
		onSubmit,
		disabled,
		interimTranscript = "",
		isListening = false,
	} = usePromptInput();
	const textareaRef = React.useRef<HTMLTextAreaElement>(null);
	const wrapperRef = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		if (disableAutosize || !textareaRef.current) return;

		// Use requestAnimationFrame to defer layout reads and prevent forced reflow
		const textarea = textareaRef.current;
		let rafId: number;

		const updateHeight = () => {
			if (!textarea) return;

			// Reset height to auto to get accurate scrollHeight
			textarea.style.height = "auto";

			// Defer the scrollHeight read to the next frame to avoid forced reflow
			rafId = requestAnimationFrame(() => {
				if (!textarea) return;

				const newHeight =
					typeof maxHeight === "number"
						? Math.min(textarea.scrollHeight, maxHeight)
						: textarea.scrollHeight;

				textarea.style.height = `${newHeight}px`;
			});
		};

		updateHeight();

		// Cleanup function to cancel pending animation frame
		return () => {
			if (rafId) {
				cancelAnimationFrame(rafId);
			}
		};
		// Recompute height when content or interim transcript changes
	}, [maxHeight, disableAutosize, value, interimTranscript, isListening]);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			onSubmit?.();
		}
		onKeyDown?.(e);
	};

	// Compute display value: confirmed text + interim text (when listening)
	const displayValue =
		isListening && interimTranscript
			? `${value}${value ? " " : ""}${interimTranscript}`
			: value;

	return (
		<div ref={wrapperRef} className="relative w-full">
			<Textarea
				ref={textareaRef}
				value={displayValue}
				onChange={(e) => {
					const newValue = e.target.value;
					setValue(newValue);
					onValueChange?.(newValue, e.target.selectionStart || 0);
				}}
				onKeyDown={handleKeyDown}
				className={cn("text-base", className)}
				disabled={disabled}
				placeholder={placeholder}
				{...props}
			/>
		</div>
	);
};

interface PromptInputActionsProps
	extends React.HTMLAttributes<HTMLDivElement> {}
const PromptInputActions: React.FC<PromptInputActionsProps> = ({
	children,
	className,
	...props
}) => (
	<div className={cn("flex items-center gap-2", className)} {...props}>
		{children}
	</div>
);

interface PromptInputActionProps extends React.ComponentProps<typeof Tooltip> {
	tooltip: React.ReactNode;
	children: React.ReactNode;
	side?: "top" | "bottom" | "left" | "right";
	className?: string;
}
const PromptInputAction: React.FC<PromptInputActionProps> = ({
	tooltip,
	children,
	className,
	side = "top",
	...props
}) => {
	const { disabled } = usePromptInput();
	return (
		<Tooltip {...props}>
			<TooltipTrigger asChild disabled={disabled}>
				{children}
			</TooltipTrigger>
			<TooltipContent side={side} className={className}>
				{tooltip}
			</TooltipContent>
		</Tooltip>
	);
};

// Custom Divider Component
const CustomDivider: React.FC = () => <div className={styles.customDivider} />;

type StyledPromptContainerProps = {
	children: React.ReactNode;
	className?: string;
};

// Styled Prompt Input Container with more rounded corners
const StyledPromptContainer = React.forwardRef<
	HTMLDivElement,
	StyledPromptContainerProps
>(({ children, className }, ref) => {
	return (
		<div
			ref={ref}
			className={cn(styles.styledPromptContainer, className)}
		>
			{children}
		</div>
	);
});
StyledPromptContainer.displayName = "StyledPromptContainer";

// Main PromptInputBox Component
interface PromptInputBoxProps {
	onSend?: (message: string) => void;
	isLoading?: boolean;
	placeholder?: string;
	className?: string;
	// Controlled input from parent
	value: string;
	onValueChange: (v: string) => void;
	// Controlled speech recognition from parent
	isListening: boolean;
	transcript: string;
	interimTranscript: string;
	onStartListening: () => void;
	onStopListening: () => void;
	// Client-only guard to avoid hydration mismatch for streaming UI
	mounted?: boolean;
	// TTS enabled state for dynamic prompt generation
	ttsEnabled?: boolean;
	// Slash commands support
	enableSlashCommands?: boolean;
	onSlashCommand?: (command: SlashCommand) => void;
	// File picker support
	selectedFolder?: string;
	socket?: {
		emit: (event: string, data: unknown) => void;
		on: (event: string, handler: (data: unknown) => void) => void;
		off: (event: string, handler?: (data: unknown) => void) => void;
	} | null;
}
export const PromptInputBox = React.forwardRef(
	(props: PromptInputBoxProps, ref: React.Ref<HTMLDivElement>) => {
		const {
			onSend = () => {},
			isLoading = false,
			placeholder = "Type your message here...",
			className,
			value,
			onValueChange,
			isListening,
			transcript,
			interimTranscript,
			onStartListening,
			onStopListening,
			mounted = true,
			ttsEnabled = false,
			selectedFolder,
			socket,
		} = props;

		// Slash commands state
		const [showSlashPicker, setShowSlashPicker] = React.useState(false);
		const [slashQuery, setSlashQuery] = React.useState("");

		// Use shared hook for persistent data
		const {
			prePrompt: savedPreprompt,
			setPrePrompt: setSavedPreprompt,
			subPrompt: savedSubprompt,
			setSubPrompt: setSavedSubprompt,
			workspacePath,
			setWorkspacePath,
		} = usePromptData({ storagePrefix: "llmChat" });

		// Normalize potentially undefined value from parent (this is confirmed text only)
		const inputVal = value ?? "";

		// Local UI state removed; use controlled value from parent
		const [isPrePromptVisible, setIsPrePromptVisible] = React.useState(false);
		const [isSubPromptVisible, setIsSubPromptVisible] = React.useState(false);
		const [isSkillsInputVisible, setIsSkillsInputVisible] = React.useState(false);
		const [copiedPrePrompt, setCopiedPrePrompt] = React.useState(false);
		const [copiedSubPrompt, setCopiedSubPrompt] = React.useState(false);
		const promptBoxRef = React.useRef<HTMLDivElement>(null);
		const [workspaceInput, setWorkspaceInput] = React.useState(workspacePath);
		const [activePanel, setActivePanel] = React.useState<
			"preprompt" | "subprompt" | null
		>(null);
		const showPreprompt = activePanel === "preprompt";
		const showSubprompt = activePanel === "subprompt";

		React.useEffect(() => {
			setWorkspaceInput(workspacePath);
		}, [workspacePath]);

		// Refs to hold the latest transcript values to avoid stale closures in callbacks.
		// No internal speech state; parent provides transcript values

		const handleToggleChange = (value: "preprompt" | "subprompt") => {
			setActivePanel((prev) => {
				if (prev === value) return null;
				return value;
			});
		};
		const handleClosePanel = () => {
			setActivePanel(null);
		};
		const handleInputChange = (newValue: string) => {
			onValueChange(newValue);

			// Detect slash command
			const lastWord = newValue.split(" ").pop() || "";
			if (lastWord.startsWith("/")) {
				setShowSlashPicker(true);
				setSlashQuery(lastWord.slice(1));
			} else {
				setShowSlashPicker(false);
				setSlashQuery("");
			}
		};
		const handleSlashCommandSelect = (command: SlashCommand) => {
			// Replace /command with template
			const words = inputVal.split(" ");
			words.pop(); // Remove /command
			const newInput =
				words.join(" ") + (words.length > 0 ? " " : "") + command.template;
			onValueChange(newInput);
			setShowSlashPicker(false);
			props.onSlashCommand?.(command);
		};
		const handleSavePreprompt = (preprompt: string) => {
			setSavedPreprompt(preprompt);
		};
		const handleSaveSubprompt = (subprompt: string) => {
			setSavedSubprompt(subprompt);
		};
		const handleSubmit = () => {
			if (inputVal.trim()) {
				if (activePanel === "preprompt") {
					setSavedPreprompt(inputVal.trim());
				} else if (activePanel === "subprompt") {
					setSavedSubprompt(inputVal.trim());
				} else {
					onSend(inputVal);
					onValueChange("");
				}
			}
		};

		const hasContent = inputVal.trim() !== "";

		return (
			<div style={{ position: "relative" }}>
				<StyleInjector />
				<PromptInput
					value={inputVal}
					onValueChange={onValueChange}
					interimTranscript={isListening ? interimTranscript : ""}
					isListening={isListening}
					isLoading={isLoading}
					onSubmit={handleSubmit}
					className={cn("w-full", className)}
					disabled={isLoading}
					ref={ref || promptBoxRef}
				>
					{/* Textarea with Slash Command Picker */}
					<div className="relative">
						<div
							className={cn(
								"transition-all duration-300",
								activePanel
									? "h-0 overflow-hidden opacity-0"
									: "opacity-100 mb-2",
							)}
						>
							<PromptInputTextarea
								placeholder={activePanel ? "" : placeholder}
								className="text-base"
								onValueChange={handleInputChange}
								onKeyDown={(e) => {
								}}
							/>
						</div>

						{/* Slash Command Picker - positioned above textarea, sibling of wrapper */}
						{showSlashPicker && (
							<SlashCommandPicker
								onSelect={handleSlashCommandSelect}
								onClose={() => setShowSlashPicker(false)}
								searchQuery={slashQuery}
							/>
						)}
					</div>

					{activePanel === "preprompt" && (
						<PrepromptPanel
							onClose={handleClosePanel}
							onSave={handleSavePreprompt}
							preprompt={savedPreprompt}
							onPrepromptChange={setSavedPreprompt}
							ttsEnabled={ttsEnabled}
						/>
					)}

					{activePanel === "subprompt" && (
						<SubpromptPanel
							onClose={handleClosePanel}
							onSave={handleSaveSubprompt}
							subprompt={savedSubprompt}
							onSubpromptChange={setSavedSubprompt}
						/>
					)}

					<PromptInputActions className="flex items-center justify-between gap-2 p-0 pt-2">
						<div className="flex items-center gap-1">
							<div className="flex items-center gap-1">
								<button
									type="button"
									onClick={() => {
										setIsPrePromptVisible((prev) => !prev);
										setIsSubPromptVisible(false);
										setActivePanel((prev) =>
											prev === "preprompt" ? null : "preprompt",
										);
									}}
									className={cn(
										"rounded-full transition-all flex items-center gap-1 px-2 py-1 border h-8",
										showPreprompt
											? "bg-[#8B5CF6]/15 border-[#8B5CF6] text-[#8B5CF6]"
											: "bg-transparent border-transparent text-[#9CA3AF] hover:text-[#D1D5DB]",
									)}
								>
									<div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
										<Lightbulb
											className={cn(
												"w-4 h-4",
												showPreprompt ? "text-[#8B5CF6]" : "text-inherit",
											)}
										/>
									</div>
									{showPreprompt && (
										<span className="text-xs overflow-hidden whitespace-nowrap text-[#8B5CF6] flex-shrink-0">
											Pre-prompt
										</span>
									)}
								</button>

								<button
									type="button"
									onClick={() => {
										setIsSubPromptVisible((prev) => !prev);
										setIsPrePromptVisible(false);
										setActivePanel((prev) =>
											prev === "subprompt" ? null : "subprompt",
										);
									}}
									className={cn(
										"rounded-full transition-all flex items-center gap-1 px-2 py-1 border h-8",
										showSubprompt
											? "bg-[#F97316]/15 border-[#F97316] text-[#F97316]"
											: "bg-transparent border-transparent text-[#9CA3AF] hover:text-[#D1D5DB]",
									)}
								>
									<div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
										<Layers
											className={cn(
												"w-4 h-4",
												showSubprompt ? "text-[#F97316]" : "text-inherit",
											)}
										/>
									</div>
									{showSubprompt && (
										<span className="text-xs overflow-hidden whitespace-nowrap text-[#F97316] flex-shrink-0">
											Sub-prompt
										</span>
									)}
								</button>
							</div>

						</div>

						<div className="flex items-center gap-2">
							<PromptInputAction
								tooltip={
									isLoading
										? "Stop generation"
										: isListening
											? "Stop recording"
											: "Voice message"
								}
							>
								<div className="flex items-center gap-1">
									{/* Mic Button */}
									<Button
										variant="default"
										size="icon"
										className={cn(
											"h-8 w-8 rounded-full transition-all duration-200 bg-gray-700 hover:bg-gray-600",
										)}
										onClick={() => {
											console.log("[Button] Clicked! isListening:", isListening);
											if (isListening) {
												console.log(
													"[Button] Stopping recording - setting isRecording to false",
												);
												onStopListening();
											} else {
												console.log("[Button] Starting recording");
												onStartListening();
											}
										}}
										disabled={isLoading && !hasContent}
									>
										{isLoading ? (
											<Square className="h-4 w-4 fill-[#1F2023] animate-pulse" />
										) : isListening ? (
											<StopCircle className="h-5 w-5 text-[#1F2023]" />
										) : (
											<Mic className="h-5 w-5 text-[#1F2023] transition-colors" />
										)}
									</Button>
								</div>
							</PromptInputAction>

							{/* Enter Button (no tooltip, to the right of the mic) */}
							<Button
								variant="ghost"
								size="icon"
								className="h-10 w-10 rounded-full bg-transparent hover:bg-transparent text-[#D1D5DB] disabled:text-[#6B7280]"
								onClick={handleSubmit}
								disabled={isLoading || !hasContent}
								title="Enter"
							>
								<CornerDownLeft className="h-5 w-5" />
							</Button>
						</div>
					</PromptInputActions>
				</PromptInput>
			</div>
		);
	},
);
PromptInputBox.displayName = "PromptInputBox";
