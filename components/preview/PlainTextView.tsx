import React, { useState } from "react";

interface PlainTextViewProps {
	content: string;
	className?: string;
}

export function PlainTextView({ content, className = "" }: PlainTextViewProps) {
	// State to track checkbox states
	const [checkboxStates, setCheckboxStates] = useState<Record<string, boolean>>(
		{},
	);

	// Debug: Log className changes
	React.useEffect(() => {
		console.log("[PlainTextView] Received className:", className);
	}, [className]);

	// Text rendering with full formatting support (headers, bold, italic, lists, checkboxes, etc.)
	const renderText = (text: string): React.ReactElement => {
		// Split into lines and process each line
		const lines = text.split("\n");
		const elements: React.ReactElement[] = [];
		let key = 0;

		const parseInline = (s: string): React.ReactNode[] => {
			const parts: React.ReactNode[] = [];
			let lastIndex = 0;
			let partKey = 0;

			// Bold **text**
			const boldPattern = /\*\*(.*?)\*\*/g;
			let match: RegExpExecArray | null;
			while (true) {
				const match = boldPattern.exec(s);
				if (match === null) break;

				// Add text before match
				if (match.index > lastIndex) {
					parts.push(s.slice(lastIndex, match.index));
				}
				// Add bold text
				parts.push(<strong key={`bold-${partKey++}`}>{match[1]}</strong>);
				lastIndex = boldPattern.lastIndex;
			}

			// Bold __text__
			const underlineBoldPattern = /__(.*?)__/g;
			const remainingText = s.slice(lastIndex);
			let remainingParts: React.ReactNode[] = [remainingText];

			let underlineMatch: RegExpExecArray | null;
			while (true) {
				underlineMatch = underlineBoldPattern.exec(remainingText);
				if (underlineMatch === null) break;

				remainingParts = [];
				const before = remainingText.slice(0, underlineMatch.index);
				if (before) remainingParts.push(before);
				remainingParts.push(
					<strong key={`underline-bold-${partKey++}`}>
						{underlineMatch[1]}
					</strong>,
				);
				const after = remainingText.slice(underlineBoldPattern.lastIndex);
				if (after) remainingParts.push(after);
				break;
			}

			// Italic *text*
			const italicPattern = /\*(.*?)\*/g;
			const finalParts: React.ReactNode[] = [];
			remainingParts.forEach((part, idx) => {
				if (typeof part === "string") {
					let lastItalicIndex = 0;
					let italicMatch: RegExpExecArray | null;
					const italicParts: React.ReactNode[] = [];

					while (true) {
						const italicMatch = italicPattern.exec(part);
						if (italicMatch === null) break;

						// Add text before match
						if (italicMatch.index > lastItalicIndex) {
							italicParts.push(part.slice(lastItalicIndex, italicMatch.index));
						}
						// Add italic text
						italicParts.push(
							<em key={`italic-${partKey++}`}>{italicMatch[1]}</em>,
						);
						lastItalicIndex = italicPattern.lastIndex;
					}

					// Add remaining text
					if (lastItalicIndex < part.length) {
						italicParts.push(part.slice(lastItalicIndex));
					}

					finalParts.push(...italicParts);
				} else {
					finalParts.push(part);
				}
			});

			// Italic _text_
			const finalFinalParts: React.ReactNode[] = [];
			finalParts.forEach((part, idx) => {
				if (typeof part === "string") {
					const underlineItalicPattern = /_(.*?)_/g;
					let lastUnderlineItalicIndex = 0;
					let underlineItalicMatch: RegExpExecArray | null;
					const underlineItalicParts: React.ReactNode[] = [];

					while (true) {
						const underlineItalicMatch = underlineItalicPattern.exec(part);
						if (underlineItalicMatch === null) break;

						// Add text before match
						if (underlineItalicMatch.index > lastUnderlineItalicIndex) {
							underlineItalicParts.push(
								part.slice(
									lastUnderlineItalicIndex,
									underlineItalicMatch.index,
								),
							);
						}
						// Add italic text
						underlineItalicParts.push(
							<em key={`underline-italic-${partKey++}`}>
								{underlineItalicMatch[1]}
							</em>,
						);
						lastUnderlineItalicIndex = underlineItalicPattern.lastIndex;
					}

					// Add remaining text
					if (lastUnderlineItalicIndex < part.length) {
						underlineItalicParts.push(part.slice(lastUnderlineItalicIndex));
					}

					finalFinalParts.push(...underlineItalicParts);
				} else {
					finalFinalParts.push(part);
				}
			});

			// Inline code `text`
			const codeParts: React.ReactNode[] = [];
			finalFinalParts.forEach((part, idx) => {
				if (typeof part === "string") {
					const codePattern = /`([^`]+)`/g;
					let lastCodeIndex = 0;
					let codeMatch: RegExpExecArray | null;
					const codeInnerParts: React.ReactNode[] = [];

					while (true) {
						codeMatch = codePattern.exec(part);
						if (codeMatch === null) break;

						// Add text before match
						if (codeMatch.index > lastCodeIndex) {
							codeInnerParts.push(part.slice(lastCodeIndex, codeMatch.index));
						}
						// Add code text
						codeInnerParts.push(
							<code
								key={`code-${partKey++}`}
								className="bg-blue-500 px-1 py-0.5 rounded text-sm"
							>
								{codeMatch[1]}
							</code>,
						);
						lastCodeIndex = codePattern.lastIndex;
					}

					// Add remaining text
					if (lastCodeIndex < part.length) {
						codeInnerParts.push(part.slice(lastCodeIndex));
					}

					codeParts.push(...codeInnerParts);
				} else {
					codeParts.push(part);
				}
			});

			// Links [text](url)
			const linkParts: React.ReactNode[] = [];
			codeParts.forEach((part, idx) => {
				if (typeof part === "string") {
					const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
					let lastLinkIndex = 0;
					let linkMatch: RegExpExecArray | null;
					const linkInnerParts: React.ReactNode[] = [];

					while (true) {
						const linkMatch = linkPattern.exec(part);
						if (linkMatch === null) break;

						// Add text before match
						if (linkMatch.index > lastLinkIndex) {
							linkInnerParts.push(part.slice(lastLinkIndex, linkMatch.index));
						}
						// Add link
						linkInnerParts.push(
							<a
								key={`link-${partKey++}`}
								href={linkMatch[2]}
								className="text-blue-600 hover:underline"
							>
								{linkMatch[1]}
							</a>,
						);
						lastLinkIndex = linkPattern.lastIndex;
					}

					// Add remaining text
					if (lastLinkIndex < part.length) {
						linkInnerParts.push(part.slice(lastLinkIndex));
					}

					linkParts.push(...linkInnerParts);
				} else {
					linkParts.push(part);
				}
			});

			if (linkParts.length === 0 && parts.length === 0) {
				return [s];
			}

			if (linkParts.length === 0) return parts;
			if (parts.length === 0) return linkParts;
			return [...parts, ...linkParts];
		};

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			// Horizontal rule ---
			if (/^\s*-{3,}\s*$/.test(line)) {
				elements.push(
					<hr key={key++} className="my-4 border-t border-gray-600" />,
				);
				continue;
			}

			// Headers
			const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
			if (headerMatch) {
				const level = headerMatch[1].length;
				const text = headerMatch[2];
				const headerTag = `h${level}`;
				elements.push(
					React.createElement(
						headerTag,
						{
							key: key++,
							className: `text-${
								level === 1 ? "3xl" : level === 2 ? "2xl" : "xl"
							} font-bold mb-4 mt-6 first:mt-0`,
						},
						parseInline(text),
					),
				);
				continue;
			}

			// Lists (including indented/nested items)
			if (line.match(/^\s*[-*+]\s+/) || line.match(/^\s*\d+\.\s+/)) {
				// Simple list item processing
				const listItems: React.ReactElement[] = [];
				let j = i;

				// Check if it's a numbered list
				const isNumbered = line.match(/^\s*\d+\.\s+/);

				while (
					j < lines.length &&
					(lines[j].match(/^\s*[-*+]\s+/) || lines[j].match(/^\s*\d+\.\s+/))
				) {
					// Task list checkbox support: - [ ] item or - [x] item
					const rawItem = lines[j]
						.replace(/^\s*[-*+]\s+/, "")
						.replace(/^\s*\d+\.\s+/, "");
					const taskMatch = rawItem.match(/^\[( |x|X)\]\s+(.*)$/);
					if (taskMatch) {
						const initialChecked = taskMatch[1].toLowerCase() === "x";
						const label = taskMatch[2];
						const checkboxId = `checkbox-${key}`;

						// Initialize state if not already set
						if (!(checkboxId in checkboxStates)) {
							setCheckboxStates((prev) => ({
								...prev,
								[checkboxId]: initialChecked,
							}));
						}

						listItems.push(
							<li key={key++} className="mb-1 list-none">
								<label className="inline-flex items-start gap-2">
									<input
										type="checkbox"
										checked={checkboxStates[checkboxId] ?? initialChecked}
										onChange={(e) =>
											setCheckboxStates((prev) => ({
												...prev,
												[checkboxId]: e.target.checked,
											}))
										}
										className="accent-blue-500 h-4 w-4 align-middle"
									/>
									<span
										className={
											(checkboxStates[checkboxId] ?? initialChecked)
												? "line-through text-gray-500"
												: ""
										}
									>
										{parseInline(label)}
									</span>
								</label>
							</li>,
						);
					} else {
						// Regular list item (no checkbox)
						listItems.push(
							<li key={key++} className="mb-1">
								{parseInline(rawItem)}
							</li>,
						);
					}
					j++;
				}

				const ListTag = isNumbered ? "ol" : "ul";
				elements.push(
					<ListTag
						key={key++}
						className={`mb-4 ml-6 ${isNumbered ? "list-decimal" : "list-disc"}`}
					>
						{listItems}
					</ListTag>,
				);
				i = j - 1;
				continue;
			}

			// Standalone task checkbox lines (not in list)
			const soloTask = line.match(/^\s*\[( |x|X)\]\s+(.*)$/);
			if (soloTask) {
				const initialChecked = soloTask[1].toLowerCase() === "x";
				const label = soloTask[2];
				const checkboxId = `solo-checkbox-${key}`;

				// Initialize state if not already set
				if (!(checkboxId in checkboxStates)) {
					setCheckboxStates((prev) => ({
						...prev,
						[checkboxId]: initialChecked,
					}));
				}

				elements.push(
					<p key={key++} className="mb-3">
						<label className="inline-flex items-start gap-2">
							<input
								type="checkbox"
								checked={checkboxStates[checkboxId] ?? initialChecked}
								onChange={(e) =>
									setCheckboxStates((prev) => ({
										...prev,
										[checkboxId]: e.target.checked,
									}))
								}
								className="accent-blue-500 h-4 w-4 align-middle"
							/>
							<span
								className={
									(checkboxStates[checkboxId] ?? initialChecked)
										? "line-through text-gray-500"
										: ""
								}
							>
								{parseInline(label)}
							</span>
						</label>
					</p>,
				);
				continue;
			}

			// Blockquotes
			if (line.startsWith("> ")) {
				const quoteLines: string[] = [];
				let j = i;
				while (j < lines.length && lines[j].startsWith("> ")) {
					quoteLines.push(lines[j].substring(2));
					j++;
				}
				elements.push(
					<blockquote
						key={key++}
						className="border-l-4 border-gray-300 pl-4 italic mb-4"
					>
						<div>{parseInline(quoteLines.join("\n"))}</div>
					</blockquote>,
				);
				i = j - 1;
				continue;
			}

			// Code blocks
			if (line.startsWith("```")) {
				const codeLines: string[] = [];
				let j = i + 1;
				while (j < lines.length && !lines[j].startsWith("```")) {
					codeLines.push(lines[j]);
					j++;
				}
				elements.push(
					<pre
						key={key++}
						className="bg-gray-100 dark:bg-gray-800 p-4 rounded mb-4 overflow-x-auto"
					>
						<code>{codeLines.join("\n")}</code>
					</pre>,
				);
				i = j;
				continue;
			}

			// Inline formatting and regular paragraphs
			if (line.trim()) {
				elements.push(
					<p key={key++} className="mb-4">
						{parseInline(line)}
					</p>,
				);
			} else if (elements.length > 0) {
				// Add spacing between paragraphs
				elements.push(<div key={key++} className="h-2" />);
			}
		}

		return <div>{elements}</div>;
	};

	return (
		<div
			className="plain-text-view w-full h-full p-6 overflow-auto max-w-none prose prose-gray dark:prose-invert"
			style={{ backgroundColor: "#121212" }}
		>
			<div className={className}>{renderText(content)}</div>
			<style jsx global>{`
				.plain-text-view {
					scrollbar-color: #2a2a2a #121212; /* firefox */
				}
				.plain-text-view::-webkit-scrollbar {
					width: 10px;
					height: 10px;
					background: #121212;
				}
				.plain-text-view::-webkit-scrollbar-track {
					background: #121212;
				}
				.plain-text-view::-webkit-scrollbar-thumb {
					background: #2a2a2a;
					border-radius: 8px;
				}
			`}</style>
		</div>
	);
}
