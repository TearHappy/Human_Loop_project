"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { AudioLines } from "lucide-react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

interface LazyMarkdownProps {
	content: string;
	components?: Components;
}

/**
 * Lazy Markdown component that only renders expensive ReactMarkdown when visible
 * Uses Intersection Observer for optimal performance with many messages
 */
const LazyMarkdown: React.FC<LazyMarkdownProps> = React.memo(
	({ content, components }) => {
		const [isVisible, setIsVisible] = useState(false);
		const [hasBeenVisible, setHasBeenVisible] = useState(false);
		const ref = useRef<HTMLDivElement>(null);

		useEffect(() => {
			const element = ref.current;
			if (!element) return;

			// Only create observer if not yet visible
			if (hasBeenVisible) return;

			const observer = new IntersectionObserver(
				(entries) => {
					for (const entry of entries) {
						if (entry.isIntersecting) {
							setIsVisible(true);
							setHasBeenVisible(true);
							observer.disconnect(); // Stop observing once visible
						}
					}
				},
				{
					rootMargin: "50px", // Start rendering slightly before visible
					threshold: 0.1, // Trigger when 10% visible
				},
			);

			observer.observe(element);

			return () => {
				observer.disconnect();
			};
		}, [hasBeenVisible]);

		return (
			<div ref={ref}>
				{isVisible ? (
					<ReactMarkdown
						remarkPlugins={[remarkGfm]}
						rehypePlugins={[rehypeHighlight]}
						components={components}
					>
						{content}
					</ReactMarkdown>
				) : (
					<div className="text-muted-foreground italic">
						{content.substring(0, 100)}
						{content.length > 100 ? "..." : ""}
					</div>
				)}
			</div>
		);
	},
);

interface VoiceTagProps {
	text: string;
	isPlaying?: boolean;
	isPaused?: boolean;
}

export const VoiceTag: React.FC<VoiceTagProps> = ({
	text,
	isPlaying = false,
	isPaused = false,
}) => {
	// Calculate number of bars based on text length
	const numBars = Math.min(Math.max(Math.floor(text.length / 3), 10), 30);

	// Show wave animation only if playing AND not paused
	const showAnimation = isPlaying && !isPaused;

	return (
		<span
			className="inline-flex items-start gap-2 px-3 py-1.5 mx-1 my-0.5"
			title={`Voice: ${text}`}
		>
			{showAnimation ? (
				<div className="flex items-center gap-1">
					{Array.from({ length: numBars }, (_, i) => (
						<span
							key={`wave-bar-${numBars}-${i}-${Math.random()}`}
							className="wave-bar"
							style={{ animationDelay: `${i * 0.08}s` }}
						/>
					))}
				</div>
			) : (
				<>
					<AudioLines className="h-4 w-4 text-gray-400 mt-0.5" />
					<span className="text-gray-400 text-sm font-medium">{text}</span>
				</>
			)}

			<style>{`
        .wave-bar {
          display: inline-block;
          width: 3px;
          background: #ffffff;
          border-radius: 2px;
          animation: wave-bar 1.2s ease-in-out infinite;
        }

        @keyframes wave-bar {
          0%, 100% {
            height: 6px;
          }
          50% {
            height: 24px;
          }
        }
      `}</style>
		</span>
	);
};

interface VoiceContentProps {
	content: string;
	isCurrentlySpeaking?: boolean;
	speakingMessageId?: string | null;
	messageId?: string;
	isPaused?: boolean;
}

/**
 * Component that parses voice tags and renders them with animations
 */
export const VoiceContent: React.FC<VoiceContentProps> = ({
	content,
	isCurrentlySpeaking = false,
	speakingMessageId = null,
	messageId = null,
	isPaused = false,
}) => {
	// Memoize voice tag parsing to prevent re-parsing on every render
	const parts = useMemo(() => {
		// Parse voice tags
		const voiceTagRegex = /<voice>([\s\S]*?)<\/voice>/gi;
		const parsed: Array<{ type: "text" | "voice"; content: string }> = [];

		let lastIndex = 0;
		let match: RegExpExecArray | null = voiceTagRegex.exec(content);

		while (match) {
			// Add text before voice tag
			if (match.index > lastIndex) {
				const textBefore = content.substring(lastIndex, match.index);
				if (textBefore.trim()) {
					parsed.push({ type: "text", content: textBefore });
				}
			}

			// Add voice tag content
			const voiceText = match[1].trim();
			if (voiceText) {
				parsed.push({ type: "voice", content: voiceText });
			}

			lastIndex = match.index + match[0].length;
			match = voiceTagRegex.exec(content);
		}

		// Add remaining text
		if (lastIndex < content.length) {
			const remainingText = content.substring(lastIndex);
			if (remainingText.trim()) {
				parsed.push({ type: "text", content: remainingText });
			}
		}

		// If no voice tags found, just add all content as text
		if (parsed.length === 0 && content.trim()) {
			parsed.push({ type: "text", content });
		}

		return parsed;
	}, [content]);

	// Check if this message is currently speaking
	const isThisMessageSpeaking =
		isCurrentlySpeaking && speakingMessageId === messageId;

	return (
		<>
			{parts.map((part, index) => (
				<React.Fragment
					key={`part-${index}-${part.type}-${part.content.substring(0, 20)}`}
				>
					{part.type === "voice" ? (
						<VoiceTag
							text={part.content}
							isPlaying={isThisMessageSpeaking}
							isPaused={isPaused}
						/>
					) : (
						<LazyMarkdown
							content={part.content}
							components={{
								a: ({ children, href, ...props }) => (
									<a
										href={href}
										target="_blank"
										rel="noopener noreferrer"
										className="text-blue-400 hover:underline"
										{...props}
									>
										{children}
									</a>
								),
								code: ({ className, children, ...props }) => {
									const match = /language-(\w+)/.exec(className || "");
									return match ? (
										<code className={className} {...props}>
											{children}
										</code>
									) : (
										<code
											className="bg-gray-700 px-1 py-0.5 rounded text-xs font-mono"
											{...props}
										>
											{children}
										</code>
									);
								},
								pre: ({ children }) => (
									<pre className="bg-gray-900 p-3 rounded-md overflow-x-auto my-2">
										{children}
									</pre>
								),
								p: ({ children }) => (
									<p className="mb-4 last:mb-0">{children}</p>
								),
								ul: ({ children }) => (
									<ul
										className="list-disc mb-2 space-y-1"
										style={{ listStylePosition: "inside" }}
									>
										{children}
									</ul>
								),
								ol: ({ children }) => (
									<ol
										className="list-decimal mb-2 space-y-1"
										style={{ listStylePosition: "inside" }}
									>
										{children}
									</ol>
								),
								blockquote: ({ children }) => (
									<blockquote className="border-l-4 border-gray-500 pl-4 italic my-2">
										{children}
									</blockquote>
								),
							}}
						/>
					)}
				</React.Fragment>
			))}
		</>
	);
};
