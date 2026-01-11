/**
 * Voice Parser Utility
 * Extracts text from <voice>...</voice> tags in messages
 */

export interface VoiceContent {
	voiceText: string; // Text to be spoken
	cleanText: string; // Text with voice tags removed
	hasVoice: boolean; // Whether voice tags were found
}

/**
 * Parse message for <voice> tags
 * @param message - The message text to parse
 * @returns Object with voice text, clean text, and hasVoice flag
 */
export function parseVoiceTags(message: string): VoiceContent {
	if (!message) {
		return {
			voiceText: "",
			cleanText: "",
			hasVoice: false,
		};
	}

	// Regex to match <voice>...</voice> tags (case-insensitive, multiline)
	const voiceTagRegex = /<voice>([\s\S]*?)<\/voice>/gi;

	// Extract all voice content
	const voiceMatches = message.match(voiceTagRegex);

	if (!voiceMatches || voiceMatches.length === 0) {
		return {
			voiceText: "",
			cleanText: message,
			hasVoice: false,
		};
	}

	// Extract text from voice tags and clean formatting
	const voiceTexts: string[] = [];
	for (const match of voiceMatches) {
		let text = match.replace(/<\/?voice>/gi, "").trim();

		// Remove emojis (Unicode emoji ranges)
		text = text.replace(/[\u{1F600}-\u{1F64F}]/gu, ""); // Emoticons
		text = text.replace(/[\u{1F300}-\u{1F5FF}]/gu, ""); // Misc Symbols and Pictographs
		text = text.replace(/[\u{1F680}-\u{1F6FF}]/gu, ""); // Transport and Map
		text = text.replace(/[\u{1F1E0}-\u{1F1FF}]/gu, ""); // Flags
		text = text.replace(/[\u{2600}-\u{26FF}]/gu, ""); // Misc symbols
		text = text.replace(/[\u{2700}-\u{27BF}]/gu, ""); // Dingbats
		// Variation Selectors - use alternation pattern to avoid character class warning
		text = text.replace(
			/\uFE00|\uFE01|\uFE02|\uFE03|\uFE04|\uFE05|\uFE06|\uFE07|\uFE08|\uFE09|\uFE0A|\uFE0B|\uFE0C|\uFE0D|\uFE0E|\uFE0F/gu,
			"",
		); // Variation Selectors
		text = text.replace(/[\u{1F900}-\u{1F9FF}]/gu, ""); // Supplemental Symbols and Pictographs
		text = text.replace(/[\u{1FA00}-\u{1FA6F}]/gu, ""); // Chess Symbols
		text = text.replace(/[\u{1FA70}-\u{1FAFF}]/gu, ""); // Symbols and Pictographs Extended-A

		// Remove markdown formatting
		text = text.replace(/\*\*/g, ""); // Bold
		text = text.replace(/\*/g, ""); // Italic
		text = text.replace(/_/g, ""); // Underscore
		text = text.replace(/~/g, ""); // Strikethrough
		text = text.replace(/`/g, ""); // Code

		// Clean up extra spaces
		text = text.replace(/\s+/g, " ").trim();

		if (text) {
			voiceTexts.push(text);
		}
	}

	// Combine all voice texts
	const voiceText = voiceTexts.join(" ");

	// Remove voice tags from message to get clean text
	const cleanText = message.replace(voiceTagRegex, "").trim();

	return {
		voiceText,
		cleanText,
		hasVoice: true,
	};
}

/**
 * Check if message contains voice tags
 * @param message - The message text to check
 * @returns True if voice tags are present
 */
export function hasVoiceTags(message: string): boolean {
	if (!message) return false;
	return /<voice>[\s\S]*?<\/voice>/i.test(message);
}

/**
 * Strip voice tags from message
 * @param message - The message text
 * @returns Message with voice tags removed
 */
export function stripVoiceTags(message: string): string {
	if (!message) return "";
	return message.replace(/<voice>[\s\S]*?<\/voice>/gi, "").trim();
}
