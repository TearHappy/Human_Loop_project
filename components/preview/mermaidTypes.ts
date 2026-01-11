import type { DiagramData, LayoutUpdate } from "../../lib/mermaid-types";

export interface MmdFile {
	id: string;
	name: string;
	content: string;
	diagramData?: DiagramData;
	timestamp: string;
}

export interface MermaidState {
	// Diagram data
	diagram: DiagramData | null;
	diagramRef: React.RefObject<DiagramData | null>;

	// Loading states
	loading: boolean;
	saving: boolean;

	// Selection states
	selectedNodeId: string | null;
	selectedEdgeId: string | null;
	dragging: boolean;

	// Editor states
	showSourceEditor: boolean;
	sourceContent: string;
	sourceError: string | null;
	sourcePending: boolean;

	// Refs for autosave
	saveTimeoutRef: React.RefObject<NodeJS.Timeout | null>;
	lastSavedSourceRef: React.RefObject<string>;

	// Handlers
	loadDiagram: (fileId: string) => Promise<void>;
	updateSource: (source: string, fileId?: string) => Promise<void>;
	handleNodeMove: (
		nodeId: string,
		position: { x: number; y: number },
	) => Promise<void>;
	handleEdgeMove: (
		edgeId: string,
		points: Array<{ x: number; y: number }> | null,
	) => Promise<void>;
	handleLayoutUpdate: (layout: LayoutUpdate, fileId?: string) => Promise<void>;
	handleSelectNode: (nodeId: string | null) => void;
	handleSelectEdge: (edgeId: string | null) => void;
	handleDeleteNode: (nodeId: string) => Promise<void>;
	handleDeleteEdge: (edgeId: string) => Promise<void>;
	handleAddNode: () => Promise<void>;
	setShowSourceEditor: (show: boolean) => void;
}

export const DEFAULT_MERMAID_CONTENT = `graph TD
    A[Start] --> B[Process]
    B --> C[End]`;
