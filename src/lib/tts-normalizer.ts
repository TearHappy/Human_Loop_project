/**
 * Text-to-Speech Normalizer Utility
 * Preprocesses text for better TTS pronunciation and clarity
 */

/**
 * Normalizes text for better TTS pronunciation
 * @param text - The raw text to normalize
 * @returns Normalized text optimized for speech synthesis
 */
export function normalizeTextForTTS(text: string): string {
	if (!text) return text;

	let normalized = text;

	// Expand common abbreviations
	normalized = normalized.replace(/\bDr\./g, "Doctor");
	normalized = normalized.replace(/\bMr\./g, "Mister");
	normalized = normalized.replace(/\bMrs\./g, "Missus");
	normalized = normalized.replace(/\bMs\./g, "Miss");
	normalized = normalized.replace(/\bSr\./g, "Senior");
	normalized = normalized.replace(/\bJr\./g, "Junior");
	normalized = normalized.replace(/\betc\./g, "etcetera");
	normalized = normalized.replace(/\bi\.e\./g, "that is");
	normalized = normalized.replace(/\be\.g\./g, "for example");
	normalized = normalized.replace(/\bvs\./g, "versus");

	// Format numbers and percentages for better pronunciation
	normalized = normalized.replace(/\b(\d+)%/g, "$1 percent");

	// Format currency
	normalized = normalized.replace(
		/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g,
		"$1 dollars",
	);

	// Format dates (MM/DD/YYYY -> "month slash day slash year")
	normalized = normalized.replace(
		/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g,
		(match, m, d, y) => {
			return `${m} slash ${d} slash ${y}`;
		},
	);

	// Expand technical acronyms and common terms
	const acronyms: Record<string, string> = {
		API: "A P I",
		URL: "U R L",
		URI: "U R I",
		HTML: "H T M L",
		CSS: "C S S",
		JS: "J S",
		JSON: "J S O N",
		XML: "X M L",
		HTTP: "H T T P",
		HTTPS: "H T T P S",
		MCP: "M C P",
		TTS: "T T S",
		AI: "A I",
		ML: "M L",
		UI: "U I",
		UX: "U X",
		DB: "database",
		DBMS: "database management system",
		SQL: "S Q L",
		NoSQL: "No S Q L",
		REST: "R E S T",
		GraphQL: "Graph Q L",
		JWT: "J W T",
		OAuth: "O Auth",
		Git: "git",
		GitHub: "Git Hub",
		GitLab: "Git Lab",
		Docker: "Docker",
		Kubernetes: "Kubernetes",
		AWS: "A W S",
		GCP: "G C P",
		Azure: "Azure",
		React: "React",
		Vue: "Vue",
		Angular: "Angular",
		Node: "Node",
		TypeScript: "Type Script",
		JavaScript: "Java Script",
		Python: "Python",
		Java: "Java",
		"C++": "C plus plus",
		"C#": "C sharp",
		PHP: "P H P",
		Ruby: "Ruby",
		Go: "Go",
		Rust: "Rust",
	};

	// Apply acronym expansions (case-insensitive, whole word)
	for (const [acronym, expanded] of Object.entries(acronyms)) {
		// Escape special regex characters in acronym
		const escapedAcronym = acronym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const regex = new RegExp(`\\b${escapedAcronym}\\b`, "gi");
		normalized = normalized.replace(regex, expanded);
	}

	// Improve punctuation spacing
	normalized = normalized.replace(/([.!?])([A-Za-z])/g, "$1 $2");
	normalized = normalized.replace(/,([A-Za-z])/g, ", $1");
	normalized = normalized.replace(/([A-Za-z]):([A-Za-z])/g, "$1: $2");

	// Handle special characters and symbols
	normalized = normalized.replace(/&/g, "and");
	normalized = normalized.replace(/@/g, "at");
	normalized = normalized.replace(/#/g, "hash");
	normalized = normalized.replace(/\*/g, "asterisk");
	normalized = normalized.replace(/\+/g, "plus");
	normalized = normalized.replace(/=/g, "equals");
	normalized = normalized.replace(/>/g, "greater than");
	normalized = normalized.replace(/</g, "less than");
	normalized = normalized.replace(/≥/g, "greater than or equal to");
	normalized = normalized.replace(/≤/g, "less than or equal to");
	normalized = normalized.replace(/≠/g, "not equal to");

	// Remove excessive whitespace
	normalized = normalized.replace(/\s+/g, " ").trim();

	// Ensure proper sentence endings
	normalized = normalized.replace(/([.!?])\s*([A-Z])/g, "$1 $2");

	// Handle code-like strings (backticks, quotes)
	normalized = normalized.replace(/`([^`]+)`/g, "code $1 end code");
	normalized = normalized.replace(/"([^"]+)"/g, "$1");

	return normalized.trim();
}

/**
 * Chunk long text into smaller segments for better TTS processing
 * @param text - Text to chunk
 * @param maxLength - Maximum length per chunk (default: 200 characters)
 * @returns Array of text chunks
 */
export function chunkTextIntoSentences(
	text: string,
	maxLength = 200,
): string[] {
	const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
	const chunks: string[] = [];
	let currentChunk = "";

	for (const sentence of sentences) {
		if ((currentChunk + sentence).length <= maxLength) {
			currentChunk += sentence;
		} else {
			if (currentChunk) chunks.push(currentChunk.trim());
			currentChunk = sentence;
		}
	}

	if (currentChunk) chunks.push(currentChunk.trim());
	return chunks;
}
