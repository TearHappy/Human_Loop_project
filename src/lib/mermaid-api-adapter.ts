import type {
	DiagramData,
	EdgeArrowDirection,
	EdgeData,
	EdgeKind,
	LayoutUpdate,
	NodeData,
	Point,
	Size,
	StyleUpdate,
} from "../../lib/mermaid-types";
import { indexedDB } from "./indexeddb";

// Global state for current diagram file
let currentDiagramFileId: string | null = null;

// Default diagram data for new diagrams
const DEFAULT_DIAGRAM: Omit<DiagramData, "sourcePath"> = {
	background: "white",
	autoSize: { width: 800, height: 600 },
	renderSize: { width: 800, height: 600 },
	nodes: [],
	edges: [],
	subgraphs: [],
	source: `graph TD
    A[Start] --> B[Process]
    B --> C[End]`,
};

// Orthogonal edge routing algorithm
function computeOrthogonalRoute(
	sourceNode: { x: number; y: number },
	targetNode: { x: number; y: number },
): Point[] {
	const NODE_MARGIN = 20; // Extra margin around nodes to avoid overlap

	// Calculate node bounding boxes with margin
	const sourceBox = {
		left: sourceNode.x - 70 - NODE_MARGIN, // 70 is half node width
		right: sourceNode.x + 70 + NODE_MARGIN,
		top: sourceNode.y - 30 - NODE_MARGIN, // 30 is half node height
		bottom: sourceNode.y + 30 + NODE_MARGIN,
	};

	const targetBox = {
		left: targetNode.x - 70 - NODE_MARGIN,
		right: targetNode.x + 70 + NODE_MARGIN,
		top: targetNode.y - 30 - NODE_MARGIN,
		bottom: targetNode.y + 30 + NODE_MARGIN,
	};

	const source = { x: sourceNode.x, y: sourceNode.y };
	const target = { x: targetNode.x, y: targetNode.y };

	// Determine the best routing direction based on relative positions
	const deltaX = target.x - source.x;
	const deltaY = target.y - source.y;

	// Choose routing strategy: prefer horizontal-then-vertical (L-shape) or vertical-then-horizontal
	const useHorizontalFirst = Math.abs(deltaX) > Math.abs(deltaY);

	let points: Point[];

	if (useHorizontalFirst) {
		// L-shape: horizontal first, then vertical
		const midX = (source.x + target.x) / 2;
		// Ensure the bend point doesn't intersect with node boxes
		let bendX = midX;
		if (bendX > sourceBox.left && bendX < sourceBox.right) {
			bendX = bendX < source.x ? sourceBox.left : sourceBox.right;
		}
		if (bendX > targetBox.left && bendX < targetBox.right) {
			bendX = bendX < target.x ? targetBox.left : targetBox.right;
		}

		points = [
			{ x: source.x, y: source.y },
			{ x: bendX, y: source.y },
			{ x: bendX, y: target.y },
			{ x: target.x, y: target.y },
		];
	} else {
		// L-shape: vertical first, then horizontal
		const midY = (source.y + target.y) / 2;
		// Ensure the bend point doesn't intersect with node boxes
		let bendY = midY;
		if (bendY > sourceBox.top && bendY < sourceBox.bottom) {
			bendY = bendY < source.y ? sourceBox.top : sourceBox.bottom;
		}
		if (bendY > targetBox.top && bendY < targetBox.bottom) {
			bendY = bendY < target.y ? targetBox.top : targetBox.bottom;
		}

		points = [
			{ x: source.x, y: source.y },
			{ x: source.x, y: bendY },
			{ x: target.x, y: bendY },
			{ x: target.x, y: target.y },
		];
	}

	// Simplify the path by removing unnecessary intermediate points
	const simplified: Point[] = [points[0]];
	for (let i = 1; i < points.length - 1; i++) {
		const prev = points[i - 1];
		const curr = points[i];
		const next = points[i + 1];

		// Keep point if direction changes (bend point)
		if (
			(curr.x !== prev.x && curr.y !== next.y) ||
			(curr.y !== prev.y && curr.x !== next.x)
		) {
			simplified.push(curr);
		}
	}
	simplified.push(points[points.length - 1]);

	return simplified;
}

// Recompute orthogonal routes for edges affected by node movements
function recomputeAffectedRoutes(
	diagram: DiagramData,
	movedNodeIds: string[],
): DiagramData {
	const movedNodeIdsSet = new Set(movedNodeIds);
	const updatedDiagram = { ...diagram };

	// Get current node positions
	const nodePositions = new Map<string, Point>();
	for (const node of updatedDiagram.nodes) {
		const pos = node.overridePosition ?? node.renderedPosition;
		nodePositions.set(node.id, pos);
	}

	// Recompute routes for edges connected to moved nodes
	for (const edge of updatedDiagram.edges) {
		// Skip edges with overridePoints - they should be preserved
		if (edge.overridePoints) {
			continue;
		}

		// Check if either endpoint node was moved
		if (movedNodeIdsSet.has(edge.from) || movedNodeIdsSet.has(edge.to)) {
			const sourcePos = nodePositions.get(edge.from) ?? { x: 0, y: 0 };
			const targetPos = nodePositions.get(edge.to) ?? { x: 100, y: 0 };

			// Recompute orthogonal route
			const newRouted = computeOrthogonalRoute(sourcePos, targetPos);
			edge.autoPoints = newRouted;
			edge.renderedPoints = newRouted;
		}
	}

	return updatedDiagram;
}

// Parse Mermaid source with simple layout extraction and edge routing
export function parseMermaidSource(source: string): DiagramData {
	const clean = source.split("\n").map((l) => l.replace(/\r$/, ""));

	const nodes: Record<string, { id: string; label: string }> = {};
	const edges: Array<{ from: string; to: string; label?: string }> = [];

	const nodeRegex = /(\w+)\[([^\]]+)\]/g;
	let m: RegExpExecArray | null = nodeRegex.exec(source);
	while (m !== null) {
		const id = m[1];
		const label = m[2];
		nodes[id] = { id, label };
		m = nodeRegex.exec(source);
	}

	// Parse edges - first find edge pattern, then extract label if present
	// Supports: A --> B (no label), A -->|Yes| B (with label)
	for (const line of clean) {
		// Try solid arrow first
		let parts = line.split("-->");
		let kind: "solid" | "dashed" = "solid";

		// If no solid arrow, try dashed
		if (parts.length === 1) {
			parts = line.split("-.->");
			if (parts.length > 1) {
				kind = "dashed";
			}
		}

		// If we found an edge pattern
		if (parts.length === 2) {
			const lhs = parts[0].trim();
			const rhs = parts[1].trim();

			// Extract label if present: -->|label| format
			let label: string | undefined;
			let rhsClean = rhs;

			if (rhs.startsWith("|")) {
				const endIdx = rhs.indexOf("|", 1);
				if (endIdx > 0) {
					label = rhs.substring(1, endIdx).trim();
					rhsClean = rhs.substring(endIdx + 1).trim();
				}
			}

			// Extract node IDs (simple version - just get word characters)
			const fromMatch = lhs.match(/(\w+)/);
			const toMatch = rhsClean.match(/(\w+)/);

			if (fromMatch && toMatch) {
				edges.push({
					from: fromMatch[1],
					to: toMatch[1],
					label,
				});
			}
		}
	}

	// Initial grid layout for nodes (deterministic)
	const nodeIds = Object.keys(nodes);
	const cols = Math.max(1, Math.ceil(Math.sqrt(nodeIds.length)));
	const NODE_X = 180;
	const NODE_Y = 120;

	const positions = new Map<string, Point>();
	nodeIds.forEach((id, idx) => {
		const col = idx % cols;
		const row = Math.floor(idx / cols);
		positions.set(id, { x: 100 + col * NODE_X, y: 100 + row * NODE_Y });
	});

	// Parse layout override comments
	// %% mermaid-node-<id>: x,y
	// %% mermaid-edge-<id>: x1,y1;x2,y2;...
	const nodeOverrideRegex =
		/^%%\s*mermaid-node-(\w+):\s*([+-]?\d+(?:\.\d+)?),\s*([+-]?\d+(?:\.\d+)?)\s*$/i;
	const edgeOverrideRegex = /^%%\s*mermaid-edge-([^:]+):\s*(.+)$/i;
	for (const line of clean) {
		const n = nodeOverrideRegex.exec(line.trim());
		if (n) {
			const id = n[1];
			const x = Number.parseFloat(n[2]);
			const y = Number.parseFloat(n[3]);
			positions.set(id, { x, y });
			continue;
		}
		const e = edgeOverrideRegex.exec(line.trim());
		if (e) {
		}
	}

	const diagram: DiagramData = {
		sourcePath: currentDiagramFileId
			? `${currentDiagramFileId}.mmd`
			: "diagram.mmd",
		background: "white",
		autoSize: { width: 800, height: 600 },
		renderSize: { width: 800, height: 600 },
		nodes: [],
		edges: [],
		subgraphs: [],
		source,
	};

	// Build nodes
	for (const id of nodeIds) {
		const pos = positions.get(id) ?? { x: 100, y: 100 };
		diagram.nodes.push({
			id,
			label: nodes[id].label,
			shape: "rectangle",
			autoPosition: { ...pos },
			renderedPosition: { ...pos },
		});
	}

	// Build edges with straight-line routing between node centers
	const overrideEdgePoints: Record<string, Point[]> = {};
	const edgeLabelPositions: Record<string, Point> = {};
	const edgeLabelRegex =
		/^%%\s*mermaid-edge-label-([^:]+):\s*([+-]?\d+(?:\.\d+)?),\s*([+-]?\d+(?:\.\d+)?)\s*$/i;
	for (const line of clean) {
		const e = edgeOverrideRegex.exec(line.trim());
		if (e) {
			const edgeId = e[1];
			const parts = e[2]
				.split(";")
				.map((s) => s.trim())
				.filter(Boolean);
			const pts: Point[] = [];
			for (const part of parts) {
				const [sx, sy] = part.split(",");
				const x = Number.parseFloat(sx);
				const y = Number.parseFloat(sy);
				if (Number.isFinite(x) && Number.isFinite(y)) {
					pts.push({ x, y });
				}
			}
			if (pts.length > 0) {
				overrideEdgePoints[edgeId] = pts;
			}
		}
		const l = edgeLabelRegex.exec(line.trim());
		if (l) {
			const edgeId = l[1];
			const x = Number.parseFloat(l[2]);
			const y = Number.parseFloat(l[3]);
			if (Number.isFinite(x) && Number.isFinite(y)) {
				edgeLabelPositions[edgeId] = { x, y };
			}
		}
	}

	for (const { from, to, label } of edges) {
		const id = `edge-${from}-${to}`;
		const sourcePos = positions.get(from) ?? { x: 0, y: 0 };
		const targetPos = positions.get(to) ?? { x: 100, y: 0 };
		const override = overrideEdgePoints[id];

		// Use orthogonal routing for auto-generated paths, preserve overridePoints
		const routed = override
			? override
			: computeOrthogonalRoute(sourcePos, targetPos);

		const labelPosition = edgeLabelPositions[id];
		diagram.edges.push({
			id,
			from,
			to,
			...(label ? { label } : {}),
			kind: "solid",
			autoPoints: routed,
			renderedPoints: routed,
			...(override ? { overridePoints: override } : {}),
			...(labelPosition ? { labelPosition } : {}),
		});
	}

	// Compute render size to fit content with margin
	const MARGIN = 80;
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const n of diagram.nodes) {
		minX = Math.min(minX, n.renderedPosition.x - 70);
		maxX = Math.max(maxX, n.renderedPosition.x + 70);
		minY = Math.min(minY, n.renderedPosition.y - 30);
		maxY = Math.max(maxY, n.renderedPosition.y + 30);
	}
	if (!Number.isFinite(minX)) {
		minX = 0;
		minY = 0;
		maxX = 800;
		maxY = 600;
	}
	const width = Math.max(200, maxX - minX + MARGIN * 2);
	const height = Math.max(200, maxY - minY + MARGIN * 2);
	diagram.autoSize = { width, height };
	diagram.renderSize = { width, height };

	return diagram;
}

// Convert diagram data back to Mermaid source with JSON layout block (mermaid format)
export function diagramToMermaidSource(diagram: DiagramData): string {
	// Remove old-style override comments and layout block if present
	const baseLines = diagram.source
		.split("\n")
		.map((l) => l.replace(/\r$/, ""))
		.filter((l) => {
			const trimmed = l.trim();
			return (
				!trimmed.startsWith("%% OXDRAW LAYOUT START") &&
				!trimmed.startsWith("%% OXDRAW LAYOUT END") &&
				!/^%%\s*["{}\[\]]/.test(trimmed) &&
				!/^%%\s*mermaid-/.test(trimmed) &&
				trimmed !== "%% Layout overrides"
			);
		});

	const cleanSource = baseLines.join("\n").trimEnd();

	// Build layout overrides object
	const overrides: {
		nodes?: Record<string, { x: number; y: number }>;
		edges?: Record<string, { points: Array<{ x: number; y: number }> }>;
		node_styles?: Record<
			string,
			{ fill?: string; stroke?: string; text?: string }
		>;
		edge_styles?: Record<
			string,
			{ line?: string; color?: string; arrow?: string }
		>;
	} = {};

	// Collect node position overrides
	const nodeOverrides: Record<string, { x: number; y: number }> = {};
	for (const node of diagram.nodes) {
		if (node.overridePosition) {
			nodeOverrides[node.id] = {
				x: node.overridePosition.x,
				y: node.overridePosition.y,
			};
		}
	}
	if (Object.keys(nodeOverrides).length > 0) {
		overrides.nodes = nodeOverrides;
	}

	// Collect edge point overrides
	const edgeOverrides: Record<
		string,
		{ points: Array<{ x: number; y: number }> }
	> = {};
	for (const edge of diagram.edges) {
		if (edge.overridePoints && edge.overridePoints.length > 0) {
			edgeOverrides[edge.id] = {
				points: edge.overridePoints.map((p) => ({ x: p.x, y: p.y })),
			};
		}
	}
	if (Object.keys(edgeOverrides).length > 0) {
		overrides.edges = edgeOverrides;
	}

	// If no overrides, return clean source
	if (Object.keys(overrides).length === 0) {
		return cleanSource;
	}

	// Build JSON block with %% prefix like mermaid
	const jsonStr = JSON.stringify(overrides, null, 2);
	const jsonLines = jsonStr.split("\n").map((line) => `%% ${line}`);

	return `${cleanSource}\n\n%% OXDRAW LAYOUT START\n${jsonLines.join("\n")}\n%% OXDRAW LAYOUT END`;
}

function serializeDiagramToMermaid(diagram: DiagramData): string {
	const lines: string[] = ["graph TD"]; // simple default direction
	for (const n of diagram.nodes) {
		lines.push(`${n.id}[${n.label}]`);
	}
	for (const e of diagram.edges) {
		lines.push(`${e.from} --> ${e.to}`);
	}
	const tmp: DiagramData = { ...diagram, source: lines.join("\n") };
	return diagramToMermaidSource(tmp);
}

// Set the current diagram file ID for operations
export function setCurrentDiagramFile(fileId: string): void {
	currentDiagramFileId = fileId;
}

// API adapter functions that mimic mermaid's API but use IndexedDB
export async function fetchDiagram(fileId?: string): Promise<DiagramData> {
	const targetFileId = fileId || currentDiagramFileId;
	if (!targetFileId) {
		throw new Error("No diagram file selected");
	}

	try {
		const file = await indexedDB.getFile(targetFileId);
		if (!file) {
			// Create default diagram if file doesn't exist
			const defaultDiagram: DiagramData = {
				...DEFAULT_DIAGRAM,
				sourcePath: `${targetFileId}.mmd`,
			};
			return defaultDiagram;
		}

		// Verify it's a mermaid file
		if (file.detectedType !== "mermaid") {
			throw new Error(
				`File ${targetFileId} is not a mermaid diagram (type: ${file.detectedType})`,
			);
		}

		// If we have a stored diagram object, use it (includes styles)
		if (file.diagramData) {
			// Return a deep clone to ensure React detects changes
			return JSON.parse(JSON.stringify(file.diagramData));
		}

		// Otherwise parse Mermaid source to diagram data
		return parseMermaidSource(file.content);
	} catch (error) {
		console.error("Failed to fetch diagram:", error);
		throw new Error(`Failed to load diagram: ${error}`);
	}
}

export async function updateLayout(
	update: LayoutUpdate,
	fileId?: string,
): Promise<void> {
	const targetFileId = fileId || currentDiagramFileId;
	if (!targetFileId) {
		throw new Error("No diagram file selected");
	}

	try {
		// Get current file
		const file = await indexedDB.getFile(targetFileId);
		if (!file) {
			throw new Error("Diagram file not found");
		}

		// Verify it's a mermaid file
		if (file.detectedType !== "mermaid") {
			throw new Error(
				`File ${targetFileId} is not a mermaid diagram (type: ${file.detectedType})`,
			);
		}

		// Parse current diagram
		const diagram = parseMermaidSource(file.content);

		// Apply layout updates
		const movedNodeIds: string[] = [];
		if (update.nodes) {
			for (const [nodeId, position] of Object.entries(update.nodes)) {
				const node = diagram.nodes.find((n) => n.id === nodeId);
				if (node) {
					node.overridePosition = position || undefined;
					movedNodeIds.push(nodeId);
				}
			}
		}

		if (update.edges) {
			for (const [edgeId, edgeUpdate] of Object.entries(update.edges) as [
				string,
				{ points?: Point[] | null },
			][]) {
				const edge = diagram.edges.find((e) => e.id === edgeId);
				if (edge && edgeUpdate.points !== undefined) {
					edge.overridePoints = edgeUpdate.points || undefined;
				}
			}
		}

		// Recompute orthogonal routes for moved nodes (but preserve overridePoints)
		if (movedNodeIds.length > 0) {
			const updatedDiagram = recomputeAffectedRoutes(diagram, movedNodeIds);
			Object.assign(diagram, updatedDiagram);
		}

		// Convert back to Mermaid source and save
		const updatedSource = diagramToMermaidSource(diagram);
		await indexedDB.saveFile({
			...file,
			content: updatedSource,
			detectedType: "mermaid", // Ensure type is preserved
			diagramData: diagram,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Failed to update layout:", error);
		throw new Error(`Failed to update layout: ${error}`);
	}
}

export async function updateSource(
	source: string,
	fileId?: string,
): Promise<void> {
	const targetFileId = fileId || currentDiagramFileId;
	if (!targetFileId) {
		throw new Error("No diagram file selected");
	}

	try {
		const file = await indexedDB.getFile(targetFileId);
		if (!file) {
			throw new Error("Diagram file not found");
		}

		// Verify it's a mermaid file
		if (file.detectedType !== "mermaid") {
			throw new Error(
				`File ${targetFileId} is not a mermaid diagram (type: ${file.detectedType})`,
			);
		}

		// Parse the new source to create diagram object
		const diagram = parseMermaidSource(source);

		await indexedDB.saveFile({
			...file,
			content: source,
			detectedType: "mermaid", // Ensure type is preserved
			diagramData: diagram,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Failed to update source:", error);
		throw new Error(`Failed to update source: ${error}`);
	}
}

export async function updateStyle(
	update: StyleUpdate,
	fileId?: string,
): Promise<void> {
	const targetFileId = fileId || currentDiagramFileId;
	if (!targetFileId) {
		throw new Error("No diagram file selected");
	}

	try {
		// Get current file
		const file = await indexedDB.getFile(targetFileId);
		if (!file) {
			throw new Error("Diagram file not found");
		}

		// Verify it's a mermaid file
		if (file.detectedType !== "mermaid") {
			throw new Error(
				`File ${targetFileId} is not a mermaid diagram (type: ${file.detectedType})`,
			);
		}

		// Use existing diagramData if available, otherwise parse from source
		let diagram = file.diagramData;
		if (!diagram) {
			diagram = parseMermaidSource(file.content);
		}

		// Apply style updates
		if (update.nodeStyles) {
			for (const [nodeId, style] of Object.entries(update.nodeStyles) as [
				string,
				{ fill?: string; stroke?: string; text?: string },
			][]) {
				const node = diagram.nodes.find((n: NodeData) => n.id === nodeId);
				if (node && style) {
					if (style.fill !== undefined) node.fillColor = style.fill;
					if (style.stroke !== undefined) node.strokeColor = style.stroke;
					if (style.text !== undefined) node.textColor = style.text;
				}
			}
		}

		if (update.edgeStyles) {
			for (const [edgeId, style] of Object.entries(update.edgeStyles) as [
				string,
				{ line?: string; color?: string; arrow?: string },
			][]) {
				const edge = diagram.edges.find((e: EdgeData) => e.id === edgeId);
				if (edge && style) {
					if (style.line !== undefined) edge.kind = style.line as EdgeKind;
					if (style.color !== undefined) edge.color = style.color;
					if (style.arrow !== undefined)
						edge.arrowDirection = style.arrow as EdgeArrowDirection;
				}
			}
		}

		// Convert back to Mermaid source and save
		const updatedSource = diagramToMermaidSource(diagram);
		await indexedDB.saveFile({
			...file,
			content: updatedSource,
			detectedType: "mermaid", // Ensure type is preserved
			diagramData: diagram,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Failed to update style:", error);
		throw new Error(`Failed to update style: ${error}`);
	}
}

export async function deleteNode(
	nodeId: string,
	fileId?: string,
): Promise<void> {
	const targetFileId = fileId || currentDiagramFileId;
	if (!targetFileId) {
		throw new Error("No diagram file selected");
	}

	try {
		// Get current file
		const file = await indexedDB.getFile(targetFileId);
		if (!file) {
			throw new Error("Diagram file not found");
		}

		// Parse current diagram
		const diagram = parseMermaidSource(file.content);

		// Remove node and connected edges
		diagram.nodes = diagram.nodes.filter((node) => node.id !== nodeId);
		diagram.edges = diagram.edges.filter(
			(edge) => edge.from !== nodeId && edge.to !== nodeId,
		);

		// Rebuild Mermaid source with clean comments (removes stale node/edge comments)
		const updatedSource = diagramToMermaidSource(diagram);
		await indexedDB.saveFile({
			...file,
			content: updatedSource,
			diagramData: diagram,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Failed to delete node:", error);
		throw new Error(`Failed to delete node: ${error}`);
	}
}

export async function deleteEdge(
	edgeId: string,
	fileId?: string,
): Promise<void> {
	const targetFileId = fileId || currentDiagramFileId;
	if (!targetFileId) {
		throw new Error("No diagram file selected");
	}

	try {
		// Get current file
		const file = await indexedDB.getFile(targetFileId);
		if (!file) {
			throw new Error("Diagram file not found");
		}

		// Parse current diagram
		const diagram = parseMermaidSource(file.content);

		// Remove edge
		diagram.edges = diagram.edges.filter((edge) => edge.id !== edgeId);

		// Rebuild Mermaid source with clean comments (removes stale edge comments)
		const updatedSource = diagramToMermaidSource(diagram);
		await indexedDB.saveFile({
			...file,
			content: updatedSource,
			diagramData: diagram,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Failed to delete edge:", error);
		throw new Error(`Failed to delete edge: ${error}`);
	}
}
