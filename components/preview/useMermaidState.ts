import { useCallback, useEffect, useRef, useState } from "react";
import type { DiagramData, LayoutUpdate, Point } from "../../lib/mermaid-types";
import { indexedDB } from "../../src/lib/indexeddb";
import {
	deleteEdge,
	deleteNode,
	diagramToMermaidSource,
	fetchDiagram,
	parseMermaidSource,
	setCurrentDiagramFile,
	updateLayout,
	updateSource,
	updateStyle,
} from "../../src/lib/mermaid-api-adapter";
import type { MermaidState } from "./mermaidTypes";

export function useMermaidState(selectedFileId: string | null): MermaidState {
	// Diagram data
	const [diagram, setDiagram] = useState<DiagramData | null>(null);
	const diagramRef = useRef<DiagramData | null>(null);

	// Loading states
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);

	// Selection states
	const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
	const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
	const [dragging, setDragging] = useState(false);

	// Editor states
	const [showSourceEditor, setShowSourceEditor] = useState(false);
	const [sourceContent, setSourceContent] = useState("");
	const [sourceError, setSourceError] = useState<string | null>(null);
	const [sourcePending, setSourcePending] = useState(false);

	// Refs for autosave
	const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const lastSavedSourceRef = useRef<string>("");

	// Load diagram when selectedFileId changes
	const loadDiagram = useCallback(async (fileId: string) => {
		try {
			setLoading(true);
			console.log("[MermaidState] Loading diagram for file:", fileId);
			setCurrentDiagramFile(fileId);
			const diagramData = await fetchDiagram(fileId);
			setDiagram(diagramData);
			diagramRef.current = diagramData;
			setSourceContent(diagramToMermaidSource(diagramData));
			console.log("[MermaidState] Diagram loaded:", diagramData);
		} catch (error) {
			console.error("[MermaidState] Failed to load diagram:", error);
		} finally {
			setLoading(false);
		}
	}, []);

	// Load diagram when selectedFileId changes (only for diagram files)
	useEffect(() => {
		if (!selectedFileId) return;
		// Only load if it's actually a diagram file - check via indexedDB
		const checkAndLoad = async () => {
			try {
				const file = await indexedDB.getFile(selectedFileId);
				if (file && file.detectedType === "mermaid") {
					loadDiagram(selectedFileId);
				}
			} catch (error) {
				console.error("[MermaidState] Failed to check file type:", error);
			}
		};
		checkAndLoad();
	}, [selectedFileId, loadDiagram]);

	// Handle node move
	const handleNodeMove = useCallback(
		async (id: string, position: { x: number; y: number }) => {
			// Update local state IMMEDIATELY for instant visual feedback
			setDiagram((prev) => {
				if (!prev) return prev;
				const updated: DiagramData = {
					...prev,
					nodes: prev.nodes.map((n) =>
						n.id === id ? { ...n, overridePosition: position || undefined } : n,
					),
				};
				return updated;
			});

			// Then save to IndexedDB in background
			try {
				const layoutUpdate: LayoutUpdate = {
					nodes: { [id]: position },
				};
				await updateLayout(layoutUpdate, selectedFileId || undefined);
				// Update ref after successful save
				const savedDiagram = await fetchDiagram(selectedFileId || undefined);
				diagramRef.current = savedDiagram;
			} catch (error) {
				console.error("[MermaidState] Failed to update node position:", error);
			}
		},
		[selectedFileId],
	);

	// Handle edge move
	const handleEdgeMove = useCallback(
		async (id: string, points: Point[] | null) => {
			// Update local state IMMEDIATELY for instant visual feedback
			setDiagram((prev) => {
				if (!prev) return prev;
				const updated: DiagramData = {
					...prev,
					edges: prev.edges.map((e) =>
						e.id === id ? { ...e, overridePoints: points || undefined } : e,
					),
				};
				return updated;
			});

			// Then save to IndexedDB in background
			try {
				const layoutUpdate: LayoutUpdate = {
					edges: { [id]: { points: points || undefined } },
				};
				await updateLayout(layoutUpdate, selectedFileId || undefined);
				// Update ref after successful save
				const savedDiagram = await fetchDiagram(selectedFileId || undefined);
				diagramRef.current = savedDiagram;
			} catch (error) {
				console.error("[MermaidState] Failed to update edge points:", error);
			}
		},
		[selectedFileId],
	);

	// Handle layout update
	const handleLayoutUpdate = useCallback(
		async (update: LayoutUpdate) => {
			try {
				await updateLayout(update, selectedFileId || undefined);
			} catch (error) {
				console.error("[MermaidState] Failed to update layout:", error);
			}
		},
		[selectedFileId],
	);

	// Handle node selection
	const handleSelectNode = useCallback((id: string | null) => {
		setSelectedNodeId(id);
		setSelectedEdgeId(null);
	}, []);

	// Handle edge selection
	const handleSelectEdge = useCallback((id: string | null) => {
		setSelectedEdgeId(id);
		if (id) {
			setSelectedNodeId(null);
		}
	}, []);

	// Handle delete node
	const handleDeleteNode = useCallback(
		async (id: string) => {
			if (saving || !selectedFileId) return;

			try {
				console.log("[MermaidState] Deleting node:", id);
				setSaving(true);
				await deleteNode(id, selectedFileId);

				// Reload diagram and validate selection
				const updatedDiagram = await fetchDiagram(selectedFileId);
				setDiagram(updatedDiagram);
				diagramRef.current = updatedDiagram;
				const generatedSource = diagramToMermaidSource(updatedDiagram);
				setSourceContent(generatedSource);
				lastSavedSourceRef.current = generatedSource;

				// Clear selection if the node no longer exists
				setSelectedNodeId((current) =>
					current && updatedDiagram.nodes.some((node) => node.id === current)
						? current
						: null,
				);
				setSelectedEdgeId(null);

				console.log("[MermaidState] Node deleted, diagram reloaded");
			} catch (error) {
				console.error("[MermaidState] Failed to delete node:", error);
			} finally {
				setSaving(false);
			}
		},
		[selectedFileId, saving],
	);

	// Handle delete edge
	const handleDeleteEdge = useCallback(
		async (id: string) => {
			if (saving || !selectedFileId) return;

			try {
				console.log("[MermaidState] Deleting edge:", id);
				setSaving(true);
				await deleteEdge(id, selectedFileId);

				// Reload diagram and validate selection
				const updatedDiagram = await fetchDiagram(selectedFileId);
				setDiagram(updatedDiagram);
				diagramRef.current = updatedDiagram;
				const generatedSource = diagramToMermaidSource(updatedDiagram);
				setSourceContent(generatedSource);
				lastSavedSourceRef.current = generatedSource;

				// Clear selection if the edge no longer exists
				setSelectedEdgeId((current) =>
					current && updatedDiagram.edges.some((edge) => edge.id === current)
						? current
						: null,
				);

				console.log("[MermaidState] Edge deleted, diagram reloaded");
			} catch (error) {
				console.error("[MermaidState] Failed to delete edge:", error);
			} finally {
				setSaving(false);
			}
		},
		[selectedFileId, saving],
	);

	// Handle add node
	const handleAddNode = useCallback(async () => {
		if (!selectedFileId || !diagram) return;
		try {
			// Generate new node ID
			const existingIds = diagram.nodes.map((n) => n.id);
			let newId = "N1";
			let counter = 1;
			while (existingIds.includes(newId)) {
				counter++;
				newId = `N${counter}`;
			}
			// Add node to Mermaid source
			const newSource = `${diagram.source}\n${newId}[New Node]`;
			setSourceContent(newSource);
			// Auto-save
			await updateSource(newSource, selectedFileId);
			const updated = await fetchDiagram(selectedFileId);
			setDiagram(updated);
			diagramRef.current = updated;
			setSourceContent(diagramToMermaidSource(updated));
			console.log("[MermaidState] Added new node:", newId);
		} catch (error) {
			console.error("[MermaidState] Failed to add node:", error);
		}
	}, [selectedFileId, diagram]);

	// Handle source update with autosave
	const updateSourceHandler = useCallback(
		async (source: string, fileId?: string) => {
			const currentFileId = fileId || selectedFileId;
			if (!currentFileId) return;

			try {
				setSaving(true);
				setSourcePending(false);
				await updateSource(source, currentFileId);
				const updatedDiagram = await fetchDiagram(currentFileId);
				setDiagram(updatedDiagram);
				diagramRef.current = updatedDiagram;
				lastSavedSourceRef.current = source;
				setSaving(false);
				console.log("[MermaidState] Auto-saved source");
			} catch (error) {
				setSaving(false);
				setSourceError((error as Error).message);
				console.error("[MermaidState] Auto-save failed:", error);
			}
		},
		[selectedFileId],
	);

	return {
		// State
		diagram,
		diagramRef,
		loading,
		saving,
		selectedNodeId,
		selectedEdgeId,
		dragging,
		showSourceEditor,
		sourceContent,
		sourceError,
		sourcePending,
		saveTimeoutRef,
		lastSavedSourceRef,

		// Handlers
		loadDiagram,
		updateSource: updateSourceHandler,
		handleNodeMove,
		handleEdgeMove,
		handleLayoutUpdate,
		handleSelectNode,
		handleSelectEdge,
		handleDeleteNode,
		handleDeleteEdge,
		handleAddNode,
		setShowSourceEditor,
	};
}
