// Google Fonts Dynamic Loader
// Extracted from superdesign ThemePreview.tsx

// Google Fonts that we support
const SUPPORTED_GOOGLE_FONTS = [
	"JetBrains Mono",
	"Fira Code",
	"Source Code Pro",
	"IBM Plex Mono",
	"Roboto Mono",
	"Space Mono",
	"Geist Mono",
	"Inter",
	"Roboto",
	"Open Sans",
	"Poppins",
	"Montserrat",
	"Outfit",
	"Plus Jakarta Sans",
	"DM Sans",
	"Geist",
	"Oxanium",
	"Architects Daughter",
	"Merriweather",
	"Playfair Display",
	"Lora",
	"Source Serif Pro",
	"Libre Baskerville",
	"Space Grotesk",
];

// System fonts that should not be loaded from Google Fonts
const SYSTEM_FONTS = [
	"system-ui",
	"sans-serif",
	"serif",
	"monospace",
	"cursive",
	"fantasy",
	"ui-sans-serif",
	"ui-serif",
	"ui-monospace",
	"ui-rounded",
	"Arial",
	"Helvetica",
	"Times",
	"Times New Roman",
	"Courier",
	"Courier New",
	"Georgia",
	"Verdana",
	"Tahoma",
	"Trebuchet MS",
	"Impact",
	"Comic Sans MS",
	"MS Sans Serif",
	"MS Serif",
	"Pixelated MS Sans Serif",
];

/**
 * Extract font families from CSS variables or font-family declarations
 */
export const extractFontsFromCSS = (cssSheet: string): string[] => {
	const fonts = new Set<string>();

	// Look for font-family declarations (both CSS variables and direct declarations)
	const fontRegex = /(?:--font-[^:]*|font-family)\s*:\s*["']?([^"';,\n]+)/g;
	let match: RegExpExecArray | null;

	match = fontRegex.exec(cssSheet);
	while (match !== null) {
		const fontName = match[1].trim();

		// Skip system fonts, empty values, and CSS variables
		if (
			fontName &&
			!fontName.startsWith("var(") &&
			!SYSTEM_FONTS.includes(fontName)
		) {
			fonts.add(fontName);
		}
		match = fontRegex.exec(cssSheet);
	}

	return Array.from(fonts);
};

/**
 * Load Google Fonts dynamically with fallback
 */
export const loadGoogleFonts = (fontNames: string[]): Promise<void> => {
	if (fontNames.length === 0) return Promise.resolve();

	return new Promise((resolve) => {
		try {
			// Check if we already have a Google Fonts link
			const existingLink = document.querySelector(
				'link[href*="fonts.googleapis.com"]',
			) as HTMLLinkElement;

			// Convert font names to Google Fonts URL format
			const fontParams = fontNames
				.map((name) => {
					try {
						const urlName = name.replace(/\s+/g, "+");
						// Load multiple weights for better coverage
						return `${urlName}:300,400,500,600,700`;
					} catch (error) {
						console.warn(`Failed to process font name: ${name}`, error);
						return null;
					}
				})
				.filter(Boolean)
				.join("&family=");

			// If no valid fonts to load, just resolve
			if (!fontParams) {
				resolve();
				return;
			}

			const fontUrl = `https://fonts.googleapis.com/css2?family=${fontParams}&display=swap`;

			// Fallback timeout - resolve after 2 seconds even if fonts haven't loaded
			const timeoutId = setTimeout(() => {
				console.warn("Google Fonts loading timeout for:", fontNames);
				resolve();
			}, 2000);

			if (existingLink) {
				existingLink.href = fontUrl;
				const originalOnload = existingLink.onload;
				existingLink.onload = () => {
					clearTimeout(timeoutId);
					resolve();
				};
				existingLink.onerror = (error) => {
					clearTimeout(timeoutId);
					console.warn(
						"Failed to load Google Fonts (existing link):",
						fontNames,
						error,
					);
					resolve(); // Continue even if fonts fail to load
				};
			} else {
				const link = document.createElement("link");
				link.rel = "stylesheet";
				link.href = fontUrl;
				link.onload = () => {
					clearTimeout(timeoutId);
					resolve();
				};
				link.onerror = (error) => {
					clearTimeout(timeoutId);
					console.warn(
						"Failed to load Google Fonts (new link):",
						fontNames,
						error,
					);
					resolve(); // Continue even if fonts fail to load
				};
				document.head.appendChild(link);
			}
		} catch (error) {
			console.warn("Error in loadGoogleFonts:", error);
			resolve(); // Always resolve, never reject
		}
	});
};

/**
 * Check if a font is a Google Font
 */
export const isGoogleFont = (fontName: string): boolean => {
	return SUPPORTED_GOOGLE_FONTS.includes(fontName);
};

/**
 * Check if a font is a system font
 */
export const isSystemFont = (fontName: string): boolean => {
	return SYSTEM_FONTS.includes(fontName);
};
