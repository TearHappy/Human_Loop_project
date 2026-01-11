/**
 * Content Type Detector
 * Detects content type based on syntax patterns
 * Priority: Mermaid > HTML > Text
 * Note: CSS is NOT auto-detected - CSS tab is always for CSS
 */

export type ContentType = "text" | "html" | "css" | "mermaid";

export function detectContentType(content: string): ContentType {
	if (!content || content.trim().length === 0) return "text";

	const trimmed = content.trim();

	// 1. Check for Mermaid (highest priority - most specific)
	if (isMermaidContent(trimmed)) return "mermaid";

	// 2. Check for HTML tags (including DOCTYPE)
	if (isHTMLContent(trimmed)) return "html";

	// 3. Default to plain text (CSS is NOT auto-detected)
	return "text";
}

function isMermaidContent(content: string): boolean {
	const mermaidPatterns = [
		/^graph\s+(TD|LR|TB|BT|RL)/i,
		/^flowchart\s+(TD|LR|TB|BT|RL)/i,
		/^sequenceDiagram/i,
		/^classDiagram/i,
		/^stateDiagram/i,
		/^erDiagram/i,
		/^gantt/i,
		/^pie/i,
		/^gitgraph/i,
		/^journey/i,
		/^quadrantChart/i,
		/^requirement/i,
		/^C4Context/i,
		/^mindmap/i,
		/^timeline/i,
	];

	return mermaidPatterns.some((pattern) => pattern.test(content));
}

function isHTMLContent(content: string): boolean {
	// Check for DOCTYPE or HTML tags (allow leading whitespace for DOCTYPE)
	if (/^\s*<!DOCTYPE\s+html>/i.test(content)) return true;

	// Check for HTML tags (but not just text with < >)
	const htmlPattern = /<\s*([a-z][a-z0-9]*)\b[^>]*>/i;
	return htmlPattern.test(content);
}
