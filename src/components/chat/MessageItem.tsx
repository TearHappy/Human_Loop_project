"use client";

import {
	Check,
	ChevronDown,
	ChevronUp,
	Copy,
	Pause,
	Play,
	Volume2,
} from "lucide-react";
import Image from "next/image";
import React, { useMemo } from "react";
import { VoiceContent } from "../VoiceTag";

interface Message {
	id: string;
	type: "user" | "assistant" | "system";
	content: string;
	timestamp: Date;
	requestId?: string;
	imageUrl?: string;
}

interface MessageItemProps {
	message: Message;
	isScrolling: boolean;
	chatFontFamily: string;
	chatFontScale: number;
	chatTextAlign: "left" | "center" | "right";
	chatBubbleBackground: string;
	collapsedMessages: Set<string>;
	copiedMessageId: string | null;
	speaking: boolean;
	paused: boolean;
	speakingMessageId: string | null;
	pausedMessageId: string | null;
	onCopyMessage: (messageId: string, content: string) => void;
	onToggleCollapse: (messageId: string) => void;
	onSpeakMessage: (text: string, messageId: string) => void;
	onCancelSpeak: (messageId: string) => void;
	onResumeSpeak: () => void;
}

export const MessageItem: React.FC<MessageItemProps> = React.memo(
	({
		message,
		isScrolling,
		chatFontFamily,
		chatFontScale,
		chatTextAlign,
		chatBubbleBackground,
		collapsedMessages,
		copiedMessageId,
		speaking,
		paused,
		speakingMessageId,
		pausedMessageId,
		onCopyMessage,
		onToggleCollapse,
		onSpeakMessage,
		onCancelSpeak,
		onResumeSpeak,
	}) => {
		const isCollapsed = collapsedMessages.has(message.id);
		const isThisMessagePaused = pausedMessageId === message.id;

		// Memoize contentToShow calculation to prevent expensive string operations on re-renders
		const contentToShow = useMemo(() => {
			if (!isCollapsed) return message.content;

			// Only split once per message content
			const lines = message.content.split("\n");
			const maxLines = message.type === "user" ? 2 : 3;
			const visibleLines = lines.slice(0, maxLines);
			const hasMoreLines = lines.length > maxLines;

			return visibleLines.join("\n") + (hasMoreLines ? "\n..." : "");
		}, [message.content, message.type, isCollapsed]);

		return (
			<div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-300 group">
				{/* Message bubble */}
				<div
					className={`w-full p-3 rounded-lg shadow-sm hover:shadow transition-all duration-200 relative ${
						collapsedMessages.has(message.id) ? "bg-gray-800" : "bg-gray-800"
					}`}
					style={{
						backgroundColor: chatBubbleBackground,
						minHeight: "48px",
						fontFamily: chatFontFamily,
						fontSize: `${chatFontScale}rem`,
						textAlign: chatTextAlign,
					}}
				>
					{/* Action buttons - TOP RIGHT of bubble */}
					<div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
						{/* Speaker/Pause toggle button */}
						<button
							type="button"
							onClick={() => {
								if (isThisMessagePaused) {
									// If THIS message is paused, resume
									onResumeSpeak();
								} else if (speaking && speakingMessageId === message.id) {
									// If THIS message is currently speaking, pause
									onCancelSpeak(message.id);
								} else {
									// If not speaking, play message or selection
									const selection = window.getSelection();
									const selectedText = selection?.toString().trim();
									// If text is selected, speak only selection; otherwise speak full message
									const textToSpeak = selectedText || message.content;
									onSpeakMessage(textToSpeak, message.id);
								}
							}}
							className="p-1 hover:bg-black/10 rounded flex items-center justify-center"
							title={
								isThisMessagePaused
									? "Resume speaking"
									: speaking && speakingMessageId === message.id
										? "Pause speaking"
										: "Speak message (or selected text)"
							}
						>
							{isThisMessagePaused ? (
								<Play className="h-3 w-3" />
							) : speaking && speakingMessageId === message.id ? (
								<Pause className="h-3 w-3" />
							) : (
								<Volume2 className="h-3 w-3" />
							)}
						</button>

						{/* Copy button */}
						<button
							type="button"
							onClick={() => onCopyMessage(message.id, message.content)}
							className="p-1 hover:bg-black/10 rounded flex items-center justify-center"
							title="Copy message"
						>
							{copiedMessageId === message.id ? (
								<Check className="h-3 w-3 text-green-600" />
							) : (
								<Copy className="h-3 w-3" />
							)}
						</button>

						{/* Collapse/Expand button */}
						<button
							type="button"
							onClick={() => onToggleCollapse(message.id)}
							className="p-1 hover:bg-black/10 rounded flex items-center justify-center"
							title={
								collapsedMessages.has(message.id)
									? "Expand message"
									: "Collapse message"
							}
						>
							{collapsedMessages.has(message.id) ? (
								<ChevronDown className="h-3 w-3" />
							) : (
								<ChevronUp className="h-3 w-3" />
							)}
						</button>
					</div>

					{/* Message content */}
					{message.imageUrl && (
						<div className="mb-2 relative w-full h-48">
							{isScrolling ? (
								<div className="w-full h-full bg-gray-700 rounded-md border flex items-center justify-center">
									<span className="text-gray-400 text-sm">Loading...</span>
								</div>
							) : (
								<Image
									src={message.imageUrl || "/placeholder.svg"}
									alt="Shared image"
									fill
									className="rounded-md border object-contain"
									style={{ objectFit: "contain" }}
								/>
							)}
						</div>
					)}
					<div className="break-words" style={{ fontSize: "inherit" }}>
						<VoiceContent
							content={contentToShow}
							isCurrentlySpeaking={speaking}
							speakingMessageId={speakingMessageId}
							messageId={message.id}
							isPaused={paused && pausedMessageId === message.id}
						/>
					</div>
				</div>
			</div>
		);
	},
);

MessageItem.displayName = "MessageItem";
