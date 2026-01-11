import React from "react";
import type { MermaidState } from "./mermaidTypes";

interface MermaidEditorProps {
	sourceContent: string;
	mermaidState: MermaidState;
	selectedFileId: string | null;
	onModeChange?: (mode: "preview" | "canvas" | "edit" | "diagram") => void;
}

export function MermaidEditor({
	sourceContent,
	mermaidState,
	selectedFileId,
}: MermaidEditorProps) {
	const { saveTimeoutRef, lastSavedSourceRef, updateSource } = mermaidState;

	return (
		<textarea
			value={sourceContent}
			onChange={(e) => {
				const newContent = e.target.value;
				mermaidState.sourceContent = newContent;
				mermaidState.sourcePending = newContent !== lastSavedSourceRef.current;

				// Real-time autosave with debounce
				if (saveTimeoutRef.current) {
					clearTimeout(saveTimeoutRef.current);
				}
				saveTimeoutRef.current = setTimeout(async () => {
					if (selectedFileId) {
						try {
							await updateSource(newContent, selectedFileId);
						} catch (error) {
							console.error("[MermaidEditor] Auto-save failed:", error);
						}
					}
				}, 1000);
			}}
			className="w-full h-full p-4 font-mono text-sm resize-none border-none focus:outline-none"
			placeholder="Edit Mermaid source code..."
			style={{
				fontFamily:
					'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
			}}
		/>
	);
}
