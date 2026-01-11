"use client";

import { Zap } from "lucide-react";
import Image from "next/image";
import React from "react";
import { PromptInputBox } from "../LLMChatInput";

interface ChatInputAreaProps {
	inputValue: string;
	setInputValue: (value: string) => void;
	isListening: boolean;
	transcript: string;
	interimTranscript: string;
	startListening: () => void;
	stopListening: () => void;
	mounted: boolean;
	handleSendMessage: (
		message: string,
	) => void;
	isProcessing: boolean;
	connected: boolean;
	ttsAutoPlay: boolean;
	socket?: {
		emit: (event: string, data: unknown) => void;
		on: (event: string, handler: (data: unknown) => void) => void;
		off: (event: string, handler?: (data: unknown) => void) => void;
	} | null;
}

export const ChatInputArea: React.FC<ChatInputAreaProps> = React.memo(
	({
		inputValue,
		setInputValue,
		isListening,
		transcript,
		interimTranscript,
		startListening,
		stopListening,
		mounted,
		handleSendMessage,
		isProcessing,
		connected,
		ttsAutoPlay,
		socket,
	}) => {
		const [workspacePath, setWorkspacePath] = React.useState<string>(() => {
			if (typeof window !== "undefined") {
				return localStorage.getItem("codeIndexFolderPath") || "";
			}
			return "";
		});

		React.useEffect(() => {
			const handleCustom = (e: Event) => {
				const anyEvent = e as unknown as { detail?: string };
				if (typeof window !== "undefined") {
					const next =
						typeof anyEvent?.detail === "string"
							? anyEvent.detail
							: localStorage.getItem("codeIndexFolderPath") || "";
					setWorkspacePath(next);
				}
			};

			const handleStorage = (e: StorageEvent) => {
				if (e.key === "codeIndexFolderPath") {
					setWorkspacePath(e.newValue || "");
				}
			};

			window.addEventListener(
				"workspacePathChanged",
				handleCustom as EventListener,
			);
			window.addEventListener("storage", handleStorage);
			return () => {
				window.removeEventListener(
					"workspacePathChanged",
					handleCustom as EventListener,
				);
				window.removeEventListener("storage", handleStorage);
			};
		}, []);
		return (
			<div className="flex-shrink-0 p-4 bg-background">
				{/* Using the new PromptInputBox component (shared with LLM Chat) */}
				<PromptInputBox
					value={inputValue}
					onValueChange={setInputValue}
					isListening={isListening}
					transcript={transcript}
					interimTranscript={interimTranscript}
					onStartListening={startListening}
					onStopListening={stopListening}
					mounted={mounted}
					onSend={(message) => {
						handleSendMessage(message);
					}}
					isLoading={isProcessing || !connected}
					placeholder="Type your message here..."
					ttsEnabled={ttsAutoPlay}
					selectedFolder={workspacePath}
					socket={socket}
				/>
			</div>
		);
	},
);
