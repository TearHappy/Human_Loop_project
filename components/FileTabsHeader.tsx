"use client";

import {
	Globe,
	Home,
	Network,
	Play,
	Plus,
	RotateCcw,
	SquareDashedMousePointer,
	XIcon,
} from "lucide-react";
import type React from "react";
import { Input } from "./ui/input";

interface FileTabsHeaderProps {
	// Tab mode - supports canvas and preview
	mode: "preview" | "canvas" | "webview";
	onModeChange: (newMode: "preview" | "canvas" | "webview") => void;

	// Files
	files: Array<{ id: string; name: string }>;
	activeFileId: string | null;
	onSelectFile: (id: string) => void;
	onCreateFile: () => void;
	onDeleteFile: (id: string) => Promise<void>;

	// Optional: Conditional rendering (like CSS tab in edit mode)
	extraTabs?: React.ReactNode;

	// NEW WEBVIEW PROPS:
	webviewCurrentUrl?: string;
	webviewInputUrl?: string;
	webviewSelectorEnabled?: boolean;
	onWebviewInputUrlChange?: (url: string) => void;
	onWebviewNavigate?: () => void;
	onWebviewRefresh?: () => void;
	onWebviewToggleSelector?: () => void;
	// Notes panel sizing (desktop only)
	isNotesExpanded?: boolean;
	onToggleNotesExpand?: () => void;
}

export function FileTabsHeader({
	mode,
	onModeChange,
	files,
	activeFileId,
	onSelectFile,
	onCreateFile,
	onDeleteFile,
	extraTabs,
	// Webview props:
	webviewCurrentUrl,
	webviewInputUrl,
	webviewSelectorEnabled,
	onWebviewInputUrlChange,
	onWebviewNavigate,
	onWebviewRefresh,
	onWebviewToggleSelector,
	// Notes sizing
	isNotesExpanded,
	onToggleNotesExpand,
}: FileTabsHeaderProps) {
	// Determine active icon and label based on current mode
	const getIconAndLabel = (m: "preview" | "canvas" | "webview") => {
		switch (m) {
			case "preview":
				return { icon: Play, label: "Preview" };
			case "canvas":
				return { icon: Home, label: "Canvas" };
			case "webview":
				return { icon: Globe, label: "Webview" };
		}
	};

	const active = getIconAndLabel(mode);
	const ActiveIconComponent = active.icon;
	const activeLabel = active.label;

	// Get all inactive modes (all modes except current) - Fixed order: Canvas, Preview
	const allModes: Array<"preview" | "canvas" | "webview"> = [
		"canvas",
		"preview",
		"webview",
	];
	const inactiveModes = allModes.filter((m) => m !== mode);

	return (
		<div className="flex items-center bg-background flex-shrink-0 relative">
			{/* Left Side: Inactive mode buttons (icon only, no labels) */}
			<div className="flex items-center">
				{inactiveModes.map((inactiveMode) => {
					const inactive = getIconAndLabel(inactiveMode);
					const InactiveIconComponent = inactive.icon;

					return (
						<button
							type="button"
							key={inactiveMode}
							onClick={() => onModeChange(inactiveMode)}
							className="p-2 relative flex items-center"
							title={inactive.label}
						>
							<InactiveIconComponent className="h-4 w-4 text-gray-400" />
						</button>
					);
				})}
			</div>

			{/* Right Side: Active Tab with Label + Separator + File Tabs OR Webview Controls */}
			<div className="flex-1 flex items-center overflow-hidden">
				{/* Active Icon + Label */}
				<div className="flex items-center px-2 py-2 flex-shrink-0">
					<ActiveIconComponent className="h-4 w-4 mr-2 text-white" />
					<span className="text-xs font-medium text-white">{activeLabel}</span>
				</div>

				{mode === "webview" ? (
					/* WEBVIEW CONTROLS */
					<div className="flex-1 flex items-center gap-1 px-2">
						{/* Address Bar - takes maximum horizontal space */}
						<Input
							value={webviewInputUrl || ""}
							onChange={(e) => onWebviewInputUrlChange?.(e.target.value)}
							onKeyPress={(e) => {
								if (e.key === "Enter") {
									onWebviewNavigate?.();
								}
							}}
							placeholder="Enter URL..."
							className="flex-1 text-xs font-mono h-7 min-w-0"
						/>

						{/* Select Button - icon only */}
						<button
							type="button"
							onClick={onWebviewToggleSelector}
							className="h-7 w-7 text-gray-400 hover:text-white hover:bg-transparent flex items-center justify-center flex-shrink-0"
							title="Toggle element selector"
						>
							<SquareDashedMousePointer className="h-4 w-4" />
						</button>

						{/* Refresh Button - icon only */}
						<button
							type="button"
							onClick={onWebviewRefresh}
							className="h-7 w-7 text-gray-400 hover:text-white hover:bg-transparent flex items-center justify-center flex-shrink-0"
							title="Refresh"
						>
							<RotateCcw className="h-4 w-4" />
						</button>
					</div>
				) : (
					/* EXISTING FILE TABS LOGIC */
					<>
						{/* Separator */}
						<div className="w-px h-6 bg-gray-700 flex-shrink-0" />

						{/* Extra Tabs */}
						{extraTabs && (
							<div className="flex items-center gap-1 px-2">{extraTabs}</div>
						)}

						{/* File Tabs */}
						<div className="flex items-center gap-1 px-2 flex-1">
							{files.map((file) => (
								<div key={file.id} className="relative group flex-shrink-0">
									<button
										type="button"
										onClick={() => onSelectFile(file.id)}
										className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap transition-colors ${
											activeFileId === file.id
												? "bg-white/10 text-white"
												: "bg-black/20 text-white hover:bg-black/30"
										}`}
									>
										{file.name}
									</button>

									{/* Delete button - positioned absolutely on the right, visible on hover */}
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											onDeleteFile(file.id);
										}}
										className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center hover:scale-110"
										title="Delete"
									>
										<XIcon className="h-3 w-3 text-gray-400 hover:text-white" />
									</button>
								</div>
							))}

							{/* Add New File Button */}
							<button
								type="button"
								onClick={onCreateFile}
								className="px-1.5 py-1.5 text-xs font-medium rounded text-white/70 hover:text-white transition-transform duration-200 hover:scale-125 flex-shrink-0"
								title="Create new file"
							>
								<Plus className="h-3 w-3" />
							</button>
						</div>
					</>
				)}
			</div>

			{/* Desktop-only expand/collapse for NotesPanel aligned to absolute right */}
			<div className="hidden sm:flex items-center gap-1 px-2 flex-shrink-0 absolute right-2 top-1/2 -translate-y-1/2">
				<button
					type="button"
					onClick={onToggleNotesExpand}
					className="h-8 w-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
					title={isNotesExpanded ? "Collapse notes to 25%" : "Expand notes to 50%"}
				>
					{isNotesExpanded ? (
						<svg
							xmlns="http://www.w3.org/2000/svg"
							height="24"
							viewBox="0 -960 960 960"
							width="24"
							fill="#e3e3e3"
						>
							<path d="M440-440v240h-80v-160H200v-80h240Zm160-320v160h160v80H520v-240h80Z" />
						</svg>
					) : (
						<svg
							xmlns="http://www.w3.org/2000/svg"
							height="24"
							viewBox="0 -960 960 960"
							width="24"
							fill="#e3e3e3"
						>
							<path d="M200-200v-240h80v160h160v80H200Zm480-320v-160H520v-80h240v240h-80Z" />
						</svg>
					)}
				</button>
			</div>
		</div>
	);
}

export default FileTabsHeader;
