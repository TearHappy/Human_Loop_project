"use client";

import { RotateCw } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { generateElementSelectorScript } from "../lib/element-selector-script";
import { Button } from "./ui/button";

interface WebviewTabProps {
	notesTab: "notes" | "preview" | "canvas" | "edit" | "diagram" | "webview";
	initialUrl?: string;
	// NEW PROPS:
	currentUrl: string;
	inputUrl: string;
	selectorEnabled: boolean;
	onUrlChange: (url: string) => void;
	onInputUrlChange: (url: string) => void;
	onNavigate: () => void;
	onRefresh: () => void;
	onToggleSelector: () => void;
	iframeRef: React.RefObject<HTMLIFrameElement | null>;
}

export function WebviewTab({
	notesTab,
	initialUrl = "http://localhost:3000",
	currentUrl,
	inputUrl,
	selectorEnabled,
	onUrlChange,
	onInputUrlChange,
	onNavigate,
	onRefresh,
	onToggleSelector,
	iframeRef,
}: WebviewTabProps) {
	// State management (KISS - only what's needed)
	const [isLoading, setIsLoading] = useState(false);
	const [hasError, setHasError] = useState(false);

	// Toggle selector via postMessage
	useEffect(() => {
		const iframe = iframeRef.current;
		if (iframe?.contentWindow) {
			iframe.contentWindow.postMessage(
				{ type: "toggleSelector", enabled: selectorEnabled },
				"*",
			);
		}
	}, [selectorEnabled, iframeRef]);

	// Inject selector script on load (for all websites)
	useEffect(() => {
		const iframe = iframeRef.current;
		if (!iframe) return;

		const handleLoad = () => {
			if (iframe.contentWindow) {
				try {
					const script = iframe.contentWindow.document.createElement("script");
					script.textContent = generateElementSelectorScript("webview");
					iframe.contentWindow.document.body.appendChild(script);
				} catch (e) {
					console.log(
						"[Webview] Could not inject selector script (CORS restriction):",
						e,
					);
				}
			}
		};

		iframe.addEventListener("load", handleLoad);
		return () => iframe.removeEventListener("load", handleLoad);
	}, [iframeRef]);

	// URL validation function
	const isValidUrl = (url: string): boolean => {
		try {
			const urlObj = new URL(url.startsWith("http") ? url : `http://${url}`);
			return urlObj.protocol === "http:" || urlObj.protocol === "https:";
		} catch {
			return false;
		}
	};

	// Event handlers (pure functions)
	const handleRefresh = () => {
		if (iframeRef.current) {
			const currentSrc = iframeRef.current.src;
			iframeRef.current.src = currentSrc; // Reload the iframe
			setIsLoading(true);
			setHasError(false);
		}
	};

	const handleIframeLoad = () => {
		setIsLoading(false);
		setHasError(false);
	};

	const handleIframeError = () => {
		setIsLoading(false);
		setHasError(true);
	};

	// Render
	return (
		<div className="flex flex-col h-full">
			{/* Main Content */}
			<div className="flex-1 relative bg-background">
				{isLoading && (
					<div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
						<div className="flex flex-col items-center gap-2">
							<RotateCw className="h-8 w-8 animate-spin text-muted-foreground" />
							<span className="text-sm text-muted-foreground">Loading...</span>
						</div>
					</div>
				)}
				{hasError ? (
					<div className="absolute inset-0 flex items-center justify-center bg-background">
						<div className="text-center p-6">
							<div className="text-4xl mb-2">⚠️</div>
							<p className="text-lg font-medium text-foreground mb-2">
								Failed to load page
							</p>
							<p className="text-sm text-muted-foreground mb-4">
								Please check the URL and try again
							</p>
							<Button size="sm" onClick={handleRefresh} variant="outline">
								Retry
							</Button>
						</div>
					</div>
				) : notesTab === "webview" ? (
					// Only render iframe when webview tab is active (performance optimization)
					<iframe
						ref={iframeRef}
						src={currentUrl}
						className="w-full h-full border-0"
						sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
						loading="lazy"
						onLoad={handleIframeLoad}
						onError={handleIframeError}
						title="Webview"
					/>
				) : null}
			</div>
		</div>
	);
}
