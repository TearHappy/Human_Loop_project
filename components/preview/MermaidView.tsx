import { Edit, Plus } from "lucide-react";
import React from "react";
import type { DiagramData } from "../../lib/mermaid-types";
import { fetchDiagram, updateStyle } from "../../src/lib/mermaid-api-adapter";
import DiagramCanvas from "../DiagramCanvas";
import { Button } from "../ui/button";
import type { MermaidState } from "./mermaidTypes";

interface MermaidViewProps {
	diagram: DiagramData | null;
	mermaidState: MermaidState;
	selectedFileId: string | null;
	onDiagramUpdate?: (diagram: DiagramData) => void;
	onModeChange?: (mode: "preview" | "canvas" | "edit" | "diagram") => void;
}

export function MermaidView({
	diagram,
	mermaidState,
	selectedFileId,
	onDiagramUpdate,
	onModeChange,
}: MermaidViewProps) {
	const {
		selectedNodeId,
		selectedEdgeId,
		dragging,
		handleNodeMove,
		handleEdgeMove,
		handleLayoutUpdate,
		handleSelectNode,
		handleSelectEdge,
		handleDeleteNode,
		handleDeleteEdge,
		handleAddNode,
		setShowSourceEditor,
	} = mermaidState;

	if (!diagram) {
		return (
			<div
				className="w-full h-full relative overflow-hidden rounded-xl flex items-center justify-center"
				style={{ backgroundColor: "#1a1a1a" }}
			>
				<span className="text-gray-400">No diagram data</span>
			</div>
		);
	}

	return (
		<div
			className="w-full h-full relative overflow-hidden rounded-xl"
			style={{ backgroundColor: "#1a1a1a" }}
		>
			<DiagramCanvas
				diagram={diagram}
				onNodeMove={handleNodeMove}
				onLayoutUpdate={handleLayoutUpdate}
				onEdgeMove={handleEdgeMove}
				selectedNodeId={selectedNodeId}
				selectedEdgeId={selectedEdgeId}
				onSelectNode={handleSelectNode}
				onSelectEdge={handleSelectEdge}
				onDragStateChange={(isDragging) => {
					mermaidState.dragging = isDragging;
				}}
				onDeleteNode={handleDeleteNode}
				onDeleteEdge={handleDeleteEdge}
			/>
		</div>
	);
}
