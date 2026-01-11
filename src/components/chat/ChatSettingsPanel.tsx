"use client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Check, Copy, RotateCcw, Volume2, VolumeX } from "lucide-react";
import React from "react";
import ReactDOM from "react-dom";

interface ChatSettingsPanelProps {
	showSettings: boolean;
	setShowSettings: (show: boolean) => void;
	chatFontFamily: string;
	setChatFontFamily: (font: string) => void;
	chatFontScale: number;
	setChatFontScale: (scale: number) => void;
	chatTextAlign: "left" | "center" | "right";
	setChatTextAlign: (align: "left" | "center" | "right") => void;
	chatBubbleBackground: string;
	setChatBubbleBackground: (bg: string) => void;
	supported: boolean;
	ttsAutoPlay: boolean;
	setTtsAutoPlay: (enabled: boolean) => void;
	speak: (options: { text: string }) => void;
	setTtsActivated: (activated: boolean) => void;
	handleCopyAll: () => Promise<void>;
	copySuccess: boolean;
	filteredMessages: Array<{
		id: string;
		role: string;
		content: string;
		[key: string]: unknown;
	}>;
	clearChat: () => void;
	// Optional: positioning and extra field support
	anchorSelector?: string; // CSS selector for the button that opened this panel
	workspacePath?: string;
	setWorkspacePath?: (path: string) => void;
}

export const ChatSettingsPanel: React.FC<ChatSettingsPanelProps> = React.memo(
	({
		showSettings,
		setShowSettings,
		chatFontFamily,
		setChatFontFamily,
		chatFontScale,
		setChatFontScale,
		chatTextAlign,
		setChatTextAlign,
		chatBubbleBackground,
		setChatBubbleBackground,
		supported,
		ttsAutoPlay,
		setTtsAutoPlay,
		speak,
		setTtsActivated,
		handleCopyAll,
		copySuccess,
		filteredMessages,
		clearChat,
		anchorSelector,
		workspacePath,
		setWorkspacePath,
	}) => {
		if (!showSettings || typeof window === "undefined") {
			return null;
		}

		const isMobile = window.innerWidth < 640;

		// Resolve anchor for positioning (default: Chat settings button)
		const anchor = document.querySelector(
			anchorSelector || '[title="Chat settings"]',
		) as HTMLElement | null;
		const top = anchor ? anchor.getBoundingClientRect().bottom + 8 : 64;
		const right = anchor
			? window.innerWidth - anchor.getBoundingClientRect().right
			: 24;

		return ReactDOM.createPortal(
			<>
				{/* Backdrop for click-out-to-close (desktop only to avoid immediate close on mobile) */}
				{!isMobile && (
					<div
						className="fixed inset-0 z-[9998]"
						onClick={() => setShowSettings(false)}
						onKeyDown={(e) => {
							if (e.key === "Escape") {
								setShowSettings(false);
							}
						}}
						style={{ backgroundColor: "transparent" }}
						tabIndex={0}
						role="button"
						aria-label="Close settings"
					/>
				)}
				{/* Dropdown */}
				<div
					className="fixed z-[9999] p-4"
					style={{
						backgroundColor: "#000000",
						border: "1px solid #333333",
						borderRadius: "8px",
						boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
						top: isMobile ? 16 : `${top}px`,
						right: isMobile ? 16 : `${right}px`,
						left: isMobile ? 16 : undefined,
						width: isMobile ? "calc(100% - 32px)" : "16rem",
					}}
				>
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<span className="text-sm font-medium text-white">
								Chat settings
							</span>
							<button
								type="button"
								onClick={() => setShowSettings(false)}
								className="text-white text-sm px-2 py-1 rounded border border-gray-600 hover:bg-gray-800"
								aria-label="Close settings"
							>
								Close
							</button>
						</div>
						{/* Optional Workspace Path (for Thinking panel) */}
						{typeof workspacePath === "string" &&
							typeof setWorkspacePath === "function" && (
								<div>
									<label
										htmlFor="workspace-path-input"
										className="text-sm font-medium block mb-2 text-white"
									>
										Workspace Path
									</label>
									<input
										id="workspace-path-input"
										type="text"
										value={workspacePath}
										onChange={(e) => setWorkspacePath(e.target.value)}
										onBlur={() => {
											try {
												localStorage.setItem(
													"codeIndexFolderPath",
													workspacePath,
												);
												try {
													window.dispatchEvent(
														new CustomEvent("workspacePathChanged", {
															detail: workspacePath,
														}),
													);
												} catch {}
											} catch {}
										}}
										placeholder="C:\\path\\to\\project"
										className="w-full p-2 text-white text-sm bg-black border border-gray-500 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
									/>
								</div>
							)}

						<div>
							<label
								htmlFor="font-family-select"
								className="text-sm font-medium block mb-2 text-white"
							>
								Font Family
							</label>
							<select
								id="font-family-select"
								value={chatFontFamily}
								onChange={(e) => setChatFontFamily(e.target.value)}
								className="w-full p-2 text-white text-sm bg-black border border-gray-500 rounded"
							>
								<option value="system-ui">System UI</option>
								<option value="Arial">Arial</option>
								<option value="Helvetica">Helvetica</option>
								<option value="Times New Roman">Times New Roman</option>
								<option value="Georgia">Georgia</option>
								<option value="Courier New">Courier New</option>
								<option value="Verdana">Verdana</option>
								<option value="Comic Sans MS">Comic Sans MS</option>
								<option value="monospace">Monospace</option>
							</select>
						</div>
						<div className="border-t border-gray-500" />
						<div>
							<label
								htmlFor="font-size-slider"
								className="text-sm font-medium block mb-2 text-white"
							>
								Font Size: {Math.round(chatFontScale * 100)}%
							</label>
							<input
								id="font-size-slider"
								type="range"
								min="0.75"
								max="1.5"
								step="0.05"
								value={chatFontScale}
								onChange={(e) => setChatFontScale(Number(e.target.value))}
								className="w-full bg-black border border-gray-500 rounded"
							/>
						</div>
						<div className="border-t border-gray-500" />
						<div>
							<span className="text-sm font-medium block mb-2 text-white">
								Text Alignment
							</span>
							<div className="flex gap-2">
								<Button
									variant={chatTextAlign === "left" ? "default" : "outline"}
									size="sm"
									onClick={() => setChatTextAlign("left")}
									className="flex-1"
								>
									Left
								</Button>
								<Button
									variant={chatTextAlign === "center" ? "default" : "outline"}
									size="sm"
									onClick={() => setChatTextAlign("center")}
									className="flex-1"
								>
									Center
								</Button>
								<Button
									variant={chatTextAlign === "right" ? "default" : "outline"}
									size="sm"
									onClick={() => setChatTextAlign("right")}
									className="flex-1"
								>
									Right
								</Button>
							</div>
						</div>
						<div className="border-t border-gray-500" />
						<div>
							<span className="text-sm font-medium block mb-2 text-white">
								Bubble Background
							</span>
							<div className="flex gap-2">
								{/* Transparent option - border only */}
								<button
									type="button"
									onClick={() => setChatBubbleBackground("transparent")}
									className={`w-12 h-12 rounded border-2 ${
										chatBubbleBackground === "transparent"
											? "border-white ring-2 ring-blue-500"
											: "border-gray-500"
									}`}
									style={{ backgroundColor: "transparent" }}
									title="Transparent"
								/>
								{/* Dark Gray option */}
								<button
									type="button"
									onClick={() => setChatBubbleBackground("#1C1C1C")}
									className={`w-12 h-12 rounded border-2 ${
										chatBubbleBackground === "#1C1C1C"
											? "border-white ring-2 ring-blue-500"
											: "border-gray-500"
									}`}
									style={{ backgroundColor: "#1C1C1C" }}
									title="Dark Gray"
								/>
								{/* Very Dark Gray option */}
								<button
									type="button"
									onClick={() => setChatBubbleBackground("#0a0a0a")}
									className={`w-12 h-12 rounded border-2 ${
										chatBubbleBackground === "#0a0a0a"
											? "border-white ring-2 ring-blue-500"
											: "border-gray-500"
									}`}
									style={{ backgroundColor: "#0a0a0a" }}
									title="Very Dark Gray"
								/>
								{/* Black option */}
								<button
									type="button"
									onClick={() => setChatBubbleBackground("#000000")}
									className={`w-12 h-12 rounded border-2 ${
										chatBubbleBackground === "#000000"
											? "border-white ring-2 ring-blue-500"
											: "border-gray-500"
									}`}
									style={{ backgroundColor: "#000000" }}
									title="Black"
								/>
							</div>
						</div>
						<div className="border-t border-gray-500" />
						{/* TTS Toggle Section */}
						{supported && (
							<>
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										{ttsAutoPlay ? (
											<Volume2 className="h-4 w-4 text-white" />
										) : (
											<VolumeX className="h-4 w-4 text-white" />
										)}
										<label
											htmlFor="tts-toggle"
											className="text-sm font-medium text-white cursor-pointer"
										>
											TTS Autoplay
										</label>
									</div>
									<Switch
										id="tts-toggle"
										checked={ttsAutoPlay}
										className="h-9 w-16 bg-gray-600 data-[state=checked]:bg-blue-500 data-[state=unchecked]:bg-gray-500"
										onCheckedChange={(enabled) => {
											console.log("[TTS] Toggle changed to:", enabled);
											setTtsAutoPlay(enabled);
											if (typeof window !== "undefined") {
												localStorage.setItem("ttsAutoPlay", enabled.toString());
											}
											if (enabled) {
												speak({ text: "TTS enabled" });
												setTtsActivated(true);
												if (typeof window !== "undefined") {
													localStorage.setItem("ttsActivated", "true");
												}
											}
										}}
										aria-label="Toggle TTS auto-play"
									/>
								</div>
								<div className="border-t border-gray-500" />
							</>
						)}
						{/* Copy All Button */}
						<div className="pt-2">
							<button
								type="button"
								onClick={async () => {
									await handleCopyAll();
									setShowSettings(false);
								}}
								disabled={filteredMessages.length === 0}
								className="w-full flex items-center justify-center gap-2 text-center text-base px-3 py-3 rounded bg-black border border-gray-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{copySuccess ? (
									<Check className="h-5 w-5 text-green-600" />
								) : (
									<Copy className="h-5 w-5" />
								)}
								<span>Copy All Messages</span>
							</button>
						</div>
						<div className="border-t border-gray-500" />
						<div className="pt-2">
							<button
								type="button"
								onClick={() => {
									clearChat();
									setShowSettings(false);
								}}
								className="w-full flex items-center justify-center gap-2 text-center text-base px-3 py-3 rounded bg-black border border-gray-500 text-white"
							>
								<RotateCcw className="h-5 w-5" />
								<span>Reset chat</span>
							</button>
						</div>
					</div>
				</div>
			</>,
			document.body,
		);
	},
);
