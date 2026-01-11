"use client";

import { PenTool } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileTabsHeader } from "./FileTabsHeader";
import { WebviewTab } from "./WebviewTab";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

// Main NotesPanel component (now only handles preview/canvas/edit/webview modes)
export function NotesPanel({
	notesTab,
	setNotesTab,
	dynamicChatInput,
	onV0Submit,
	PreviewTabComponent,
	isExpanded,
	onToggleExpand,
	// Preview state (now handles both HTML and Mermaid files)
	previewFiles,
	previewActiveTab,
	previewSelectedFileId,
	previewIsPlaying,
	onPreviewSelectFile,
	onPreviewCreateFile,
	onPreviewDeleteFile,
	onPreviewSetActiveTab,
}: {
	notesTab: "preview" | "canvas" | "edit" | "webview";
	setNotesTab: (tab: "preview" | "canvas" | "edit" | "webview") => void;
	dynamicChatInput: React.ReactNode;
	onV0Submit: (
		payload: string | { type: string; [key: string]: unknown },
	) => void;
	PreviewTabComponent: React.ComponentType<{
		notesTab: "preview" | "canvas" | "edit";
		dynamicChatInput: React.ReactNode;
		onV0Submit: (
			payload: string | { type: string; [key: string]: unknown },
		) => void;
		onModeChange?: (mode: "preview" | "canvas" | "edit") => void;
	}>;
	// Preview state (now handles both HTML and Mermaid files)
	previewFiles?: Array<{ id: string; name: string }>;
	previewActiveTab?: "html" | "css";
	previewSelectedFileId?: string | null;
	previewIsPlaying?: boolean;
	onPreviewSelectFile?: (id: string) => void;
	onPreviewCreateFile?: () => void;
	onPreviewDeleteFile?: (id: string) => Promise<void>;
	onPreviewSetActiveTab?: (tab: "html" | "css") => void;
	isExpanded?: boolean;
	onToggleExpand?: () => void;
}) {
	// Webview state (only when notesTab === "webview")
	const [webviewCurrentUrl, setWebviewCurrentUrl] = useState(() => {
		if (typeof window !== "undefined") {
			return (
				localStorage.getItem("webviewCurrentUrl") || "http://localhost:3000"
			);
		}
		return "http://localhost:3000";
	});

	const [webviewInputUrl, setWebviewInputUrl] = useState(() => {
		if (typeof window !== "undefined") {
			return localStorage.getItem("webviewInputUrl") || "http://localhost:3000";
		}
		return "http://localhost:3000";
	});

	const [webviewSelectorEnabled, setWebviewSelectorEnabled] = useState(false);
	const webviewIframeRef = useRef<HTMLIFrameElement>(null);

	// Save webview URLs to localStorage
	useEffect(() => {
		if (typeof window !== "undefined" && notesTab === "webview") {
			localStorage.setItem("webviewCurrentUrl", webviewCurrentUrl);
		}
	}, [webviewCurrentUrl, notesTab]);

	useEffect(() => {
		if (typeof window !== "undefined" && notesTab === "webview") {
			localStorage.setItem("webviewInputUrl", webviewInputUrl);
		}
	}, [webviewInputUrl, notesTab]);

	const handleWebviewNavigate = () => {
		const url = webviewInputUrl.startsWith("http")
			? webviewInputUrl
			: `http://${webviewInputUrl}`;
		setWebviewCurrentUrl(url);
	};

	const handleWebviewRefresh = () => {
		if (webviewIframeRef.current) {
			const currentSrc = webviewIframeRef.current.src;
			webviewIframeRef.current.src = currentSrc;
		}
	};

	const handleWebviewToggleSelector = () => {
		setWebviewSelectorEnabled(!webviewSelectorEnabled);
	};

	// Determine which files to show in header
	// All modes (preview/canvas/edit) use preview files
	let headerFiles: Array<{ id: string; name: string }>;
	let headerActiveFileId: string | null;
	let handleSelectFile: (id: string) => void;
	let handleCreateFile: () => void;
	let handleDeleteFile: (id: string) => Promise<void>;

	if (notesTab === "webview") {
		// webview mode - no files, single window
		headerFiles = [];
		headerActiveFileId = null;
		handleSelectFile = () => {};
		handleCreateFile = () => {};
		handleDeleteFile = async () => Promise.resolve();
	} else {
		// preview/canvas/edit modes all use preview files
		headerFiles = previewFiles || [];
		headerActiveFileId = previewSelectedFileId ?? null;
		handleSelectFile = onPreviewSelectFile || (() => {});
		handleCreateFile = onPreviewCreateFile || (() => {});
		handleDeleteFile = onPreviewDeleteFile || (async () => Promise.resolve());
	}

	// Extra tabs - removed CSS tab (now in footer)
	const extraTabs = undefined;

	return (
		<Card
			className={`w-full h-full flex flex-col overflow-hidden ${
				isExpanded ? "sm:w-1/2" : "sm:w-1/4"
			}`}
		>
			<CardContent className="flex-1 flex flex-col p-0 min-h-0">
				{/* New FileTabsHeader */}
				<FileTabsHeader
					mode={
						notesTab === "edit"
							? "preview"
							: notesTab === "webview"
								? "webview"
								: notesTab
					}
					onModeChange={(newMode) => {
						// Set the new mode directly since FileTabsHeader only returns valid modes
						setNotesTab(newMode);
					}}
					files={headerFiles}
					activeFileId={headerActiveFileId}
					onSelectFile={handleSelectFile}
					onCreateFile={handleCreateFile}
					onDeleteFile={handleDeleteFile}
					extraTabs={extraTabs}
					// NEW WEBVIEW PROPS:
					webviewCurrentUrl={webviewCurrentUrl}
					webviewInputUrl={webviewInputUrl}
					webviewSelectorEnabled={webviewSelectorEnabled}
					onWebviewInputUrlChange={setWebviewInputUrl}
					onWebviewNavigate={handleWebviewNavigate}
					onWebviewRefresh={handleWebviewRefresh}
					onWebviewToggleSelector={handleWebviewToggleSelector}
					isNotesExpanded={isExpanded}
					onToggleNotesExpand={onToggleExpand}
				/>

				{/* Content Area */}
				<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
					{notesTab === "webview" ? (
						<WebviewTab
							notesTab={notesTab}
							currentUrl={webviewCurrentUrl}
							inputUrl={webviewInputUrl}
							selectorEnabled={webviewSelectorEnabled}
							onUrlChange={setWebviewCurrentUrl}
							onInputUrlChange={setWebviewInputUrl}
							onNavigate={handleWebviewNavigate}
							onRefresh={handleWebviewRefresh}
							onToggleSelector={handleWebviewToggleSelector}
							iframeRef={webviewIframeRef}
						/>
					) : (
						<PreviewTabComponent
							notesTab={notesTab}
							dynamicChatInput={dynamicChatInput}
							onV0Submit={onV0Submit}
							onModeChange={setNotesTab}
						/>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

export default NotesPanel;
