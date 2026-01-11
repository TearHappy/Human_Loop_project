import React, { useEffect, useRef } from "react";

interface CSSPreviewProps {
	content: string;
	className?: string;
}

export function CSSPreview({ content, className = "" }: CSSPreviewProps) {
	const iframeRef = useRef<HTMLIFrameElement>(null);

	useEffect(() => {
		if (iframeRef.current) {
			const iframe = iframeRef.current;
			const iframeDoc =
				iframe.contentDocument || iframe.contentWindow?.document;

			if (iframeDoc) {
				// Create a basic HTML structure with the CSS applied
				const html = `
					<!DOCTYPE html>
					<html lang="en">
					<head>
						<meta charset="UTF-8">
						<meta name="viewport" content="width=device-width, initial-scale=1.0">
						<title>CSS Preview</title>
						<style>
							/* Reset and base styles */
							* {
								box-sizing: border-box;
							}
							body {
								margin: 0;
								padding: 20px;
								font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
								line-height: 1.6;
							}
							/* User's CSS */
							${content}
						</style>
					</head>
					<body>
						<div class="preview-container">
							<h1 style="color: #333; margin-bottom: 20px;">CSS Preview</h1>
							<p style="color: #666; margin-bottom: 20px;">
								This is a preview of your CSS styles. The styles above are applied to this content.
							</p>

							<!-- Sample elements to demonstrate CSS -->
							<div class="sample-section">
								<h2>Sample Elements</h2>
								<button class="sample-button">Button</button>
								<input type="text" class="sample-input" placeholder="Input field" />
								<div class="sample-box">Box</div>
								<a href="#" class="sample-link">Link</a>
							</div>

							<div class="sample-section">
								<h3>Layout Examples</h3>
								<div class="flex-container">
									<div class="flex-item">Item 1</div>
									<div class="flex-item">Item 2</div>
									<div class="flex-item">Item 3</div>
								</div>
							</div>
						</div>
					</body>
					</html>
				`;

				iframeDoc.open();
				iframeDoc.write(html);
				iframeDoc.close();
			}
		}
	}, [content]);

	return (
		<div
			className={`css-preview w-full h-full ${className}`}
			style={{ backgroundColor: "#1a1a1a" }}
		>
			<iframe
				ref={iframeRef}
				className="w-full h-full border rounded-xl"
				style={{
					backgroundColor: "#1a1a1a",
					outline: "none",
				}}
				title="CSS Preview"
				sandbox="allow-scripts allow-same-origin"
			/>
		</div>
	);
}
