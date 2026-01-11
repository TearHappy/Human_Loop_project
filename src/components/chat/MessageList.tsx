"use client";

import { MessageSquare, Search } from "lucide-react";
import React, { useState } from "react";
import { useAutoScroll } from "../../hooks/useAutoScroll";
import { MessageItem } from "./MessageItem";
import "../../styles/scrollbar.css";

interface Message {
	id: string;
	type: "user" | "assistant" | "system";
	content: string;
	timestamp: Date;
	requestId?: string;
	imageUrl?: string;
}

interface MessageListProps {
	messages: Message[];
	filteredMessages: Message[];
	searchQuery: string;
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
	onCopyMessage: (messageId: string, content: string) => Promise<void>;
	onToggleCollapse: (messageId: string) => void;
	onSpeakMessage: (text: string, messageId: string) => void;
	onCancelSpeak: (messageId: string) => void;
	onResumeSpeak: () => void;
}

export const MessageList: React.FC<MessageListProps> = React.memo(
	({
		messages,
		filteredMessages,
		searchQuery,
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
		const [isScrolling, setIsScrolling] = useState(false);
		const { scrollContainerRef, handleScroll } = useAutoScroll([
			filteredMessages,
		]);

		if (messages.length === 0) {
			return (
				<div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground">
					<MessageSquare className="h-12 w-12 mb-4 opacity-50" />
					<p>No messages yet. Start a conversation!</p>
				</div>
			);
		}

		if (filteredMessages.length === 0) {
			return (
				<div className="text-center text-muted-foreground py-8">
					<Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
					<p>No results found for &quot;{searchQuery}&quot;</p>
					<p className="text-sm mt-2">Try a different search term</p>
				</div>
			);
		}

		return (
			<div
				ref={scrollContainerRef}
				onScroll={handleScroll}
				className="flex-1 h-full overflow-y-auto scroll-smooth custom-scrollbar"
			>
				{filteredMessages.map((message) => (
					<div key={message.id} className="py-2">
						<MessageItem
							message={message}
							isScrolling={isScrolling}
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
							onCopyMessage={onCopyMessage}
							onToggleCollapse={onToggleCollapse}
							onSpeakMessage={onSpeakMessage}
							onCancelSpeak={onCancelSpeak}
							onResumeSpeak={onResumeSpeak}
						/>
					</div>
				))}
			</div>
		);
	},
	(prevProps, nextProps) => {
		// Return true if props are equal (skip re-render)
		// Return false if props changed (re-render needed)
		return (
			prevProps.filteredMessages === nextProps.filteredMessages &&
			prevProps.searchQuery === nextProps.searchQuery &&
			prevProps.chatFontFamily === nextProps.chatFontFamily &&
			prevProps.chatFontScale === nextProps.chatFontScale &&
			prevProps.chatTextAlign === nextProps.chatTextAlign &&
			prevProps.chatBubbleBackground === nextProps.chatBubbleBackground &&
			prevProps.collapsedMessages === nextProps.collapsedMessages &&
			prevProps.copiedMessageId === nextProps.copiedMessageId &&
			prevProps.speaking === nextProps.speaking &&
			prevProps.paused === nextProps.paused &&
			prevProps.speakingMessageId === nextProps.speakingMessageId &&
			prevProps.pausedMessageId === nextProps.pausedMessageId
		);
	},
);

MessageList.displayName = "MessageList";
