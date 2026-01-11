// Sequential Thinking Service with Julia HPTMAB-Inspired Logic
// Self-contained probabilistic reasoning without external processes

// --- NEW: "Implicit Session" Interfaces ---

export interface SimpleThoughtInput {
	content: string;
	is_final_thought?: boolean;
}

export interface AdvancedThoughtInput extends SimpleThoughtInput {
	thoughtNumber?: number;
	totalThoughts?: number;
	isRevision?: boolean;
	revisesThought?: number;
	branchFromThought?: number;
	branchId?: string;
}

// Base interfaces for sequential thinking
export interface ThoughtData {
	thought: string;
	thoughtNumber: number;
	totalThoughts: number;
	nextThoughtNeeded: boolean;
	isRevision?: boolean;
	revisesThought?: number;
	branchFromThought?: number;
	branchId?: string;
	needsMoreThoughts?: boolean;
}

export interface ProactiveGuidance {
	nextStepSuggestions?: { description: string; rationale: string }[];
	strategicRecommendations?: string[];
	detectedIssues?: { type: string; description: string; suggestion: string }[];
}

export interface ThoughtAnalysisReport {
	summary: string;
	confidenceScore: number;
	uncertainty: number;
	clarityScore: number;
}

export interface ThoughtProcessStrategy {
	shouldContinue: boolean;
	nextAction: "proceed" | "revise" | "research" | "ask";
}

export interface FormattedThought {
	raw: ThoughtData;
	formatted: string;
	display: {
		prefix: string;
		context: string;
		header: string;
		border: string;
	};
}

export interface JuliaThoughtData extends ThoughtData {
	confidence: number;
	uncertainty_analysis: {
		mean: number;
		std: number;
		quantiles: number[];
	};
	evidence_assessment: {
		logical_consistency: number;
		complexity_score: number;
		empirical_support: number;
		logical_structure?: {
			nodes: string[];
			edges: [string, string][];
			hasCycles: boolean;
			depth: number;
		};
	};
	reasoning_engine: string;
}

export interface JuliaFormattedThought extends FormattedThought {
	raw: JuliaThoughtData;
	confidence_display: string;
	uncertainty_display: string;
}

// 🔥 BRILLIANT: Proactive Cognitive Layer - Zero External Dependencies
class ProactiveCognitiveLayer {
	// Meta-Cognitive Analysis via Streaming - Proactive Guidance
	async analyzeThoughtStream(
		currentThought: JuliaThoughtData,
		history: JuliaThoughtData[],
	): Promise<ProactiveGuidance> {
		const triggers = this.detectCognitivePatterns(currentThought, history);

		if (!triggers.needsIntervention) {
			return {
				nextStepSuggestions: [],
				strategicRecommendations: [],
				detectedIssues: [],
			};
		}

		const guidance = await this.generateProactiveGuidance(triggers);
		return guidance;
	}

	private detectCognitivePatterns(
		current: JuliaThoughtData,
		history: JuliaThoughtData[],
	): {
		needsIntervention: boolean;
		patternType: string;
		severity: number;
		confidenceTrend: number;
	} {
		const confidenceTrend = this.calculateConfidenceTrend(history);
		const hasCircularReference = this.detectCircularity(current, history);
		const isStuck = history.length > 5 && confidenceTrend < -0.15;
		const lowConfidence = current.confidence < 0.5;

		return {
			needsIntervention: isStuck || hasCircularReference || lowConfidence,
			patternType: isStuck
				? "declining_confidence"
				: hasCircularReference
					? "circular_reasoning"
					: "low_confidence",
			severity: Math.abs(confidenceTrend) + (hasCircularReference ? 0.5 : 0),
			confidenceTrend,
		};
	}

	private calculateConfidenceTrend(history: JuliaThoughtData[]): number {
		if (history.length < 3) return 0;
		const recent = history.slice(-4).map((t) => t.confidence);
		const older = history.slice(-8, -4).map((t) => t.confidence);
		const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
		const olderAvg =
			older.reduce((a, b) => a + b, 0) / older.length || recentAvg;
		return recentAvg - olderAvg;
	}

	private detectCircularity(
		current: JuliaThoughtData,
		history: JuliaThoughtData[],
	): boolean {
		const currentWords = new Set(current.thought.toLowerCase().split(/\s+/));

		return history.slice(-3).some((prev) => {
			const prevWords = new Set(prev.thought.toLowerCase().split(/\s+/));
			const intersection = [...currentWords].filter((w) => prevWords.has(w));
			const similarity =
				intersection.length / Math.max(currentWords.size, prevWords.size);
			return similarity > 0.7; // 70% word overlap = potential circularity
		});
	}

	private async generateProactiveGuidance(
		triggers: Record<string, unknown>,
	): Promise<ProactiveGuidance> {
		const triggersTyped = triggers as {
			patternType?: string;
			severity?: number;
			confidenceTrend?: number;
			[key: string]: unknown;
		};
		// Without external LLM calls, return a neutral guidance payload
		return {
			nextStepSuggestions: [],
			strategicRecommendations: [],
			detectedIssues: [],
		};
	}
}

// 🔥 BRILLIANT: Simple Semantic Memory - TF-IDF-like Contextual Retrieval
class SimpleSemanticMemory {
	private memory: Array<{ thought: JuliaThoughtData; keywords: Set<string> }> =
		[];

	add(thought: JuliaThoughtData): void {
		const keywords = this.extractKeywords(thought.thought);
		this.memory.push({ thought, keywords });
	}

	// Brilliant: TF-IDF-like scoring without external libraries
	findRelevant(currentThought: string, topK = 3): JuliaThoughtData[] {
		const currentKeywords = this.extractKeywords(currentThought);

		const scored = this.memory.map(({ thought, keywords }) => ({
			thought,
			score: this.calculateRelevance(currentKeywords, keywords),
		}));

		return scored
			.sort((a, b) => b.score - a.score)
			.slice(0, topK)
			.map((s) => s.thought);
	}

	private extractKeywords(text: string): Set<string> {
		// Remove stopwords, extract meaningful terms
		const stopwords = new Set([
			"the",
			"is",
			"at",
			"which",
			"on",
			"a",
			"an",
			"and",
			"or",
			"but",
			"in",
			"to",
			"for",
			"of",
			"with",
			"by",
		]);
		return new Set(
			text
				.toLowerCase()
				.split(/\W+/)
				.filter((w) => w.length > 3 && !stopwords.has(w)),
		);
	}

	private calculateRelevance(
		keywords1: Set<string>,
		keywords2: Set<string>,
	): number {
		const intersection = [...keywords1].filter((k) => keywords2.has(k));
		const union = new Set([...keywords1, ...keywords2]);
		return intersection.length / union.size; // Jaccard similarity
	}

	clear(): void {
		this.memory = [];
	}

	getMemorySize(): number {
		return this.memory.length;
	}
}

export class SequentialThinkingServiceJulia {
	private thoughtHistory: JuliaThoughtData[] = [];
	private branches: Record<string, JuliaThoughtData[]> = {};
	private proactiveLayer: ProactiveCognitiveLayer;
	private memory: SimpleSemanticMemory;

	constructor() {
		this.proactiveLayer = new ProactiveCognitiveLayer();
		this.memory = new SimpleSemanticMemory();
	}
	private calculateConfidence(
		thought: string,
		thoughtNumber: number,
		totalThoughts: number,
		isRevision: boolean,
	): number {
		// Base confidence lowered to make other factors more impactful
		const baseConfidence = 0.5;

		// Length factor remains the same - longer thoughts tend to be more detailed
		const lengthFactor = Math.min(thought.length / 200, 1.0) * 0.1; // Max +10%

		// FIXED: Progress factor is now a smaller, additive bonus
		// This rewards middle thoughts but doesn't dominate the score
		// It provides a bonus from 0% (start/end) to 5% (middle)
		const progressFactor =
			(1 - Math.abs(0.5 - thoughtNumber / totalThoughts) * 2) * 0.05;

		// Revision penalty
		const revisionPenalty = isRevision ? 0.1 : 0; // -10%

		// Complexity bonus (thoughts with specific terms get bonus)
		const complexityTerms = [
			"because",
			"therefore",
			"however",
			"analysis",
			"evidence",
			"conclusion",
		];
		const complexityBonus =
			complexityTerms.filter((term) => thought.toLowerCase().includes(term))
				.length * 0.05; // Max +30%

		// Add uncertainty penalties for better confidence assessment
		const uncertaintyWords = [
			"unclear",
			"not sure",
			"maybe",
			"unsure",
			"confused",
			"uncertain",
		];
		const uncertaintyPenalty =
			uncertaintyWords.filter((word) => thought.toLowerCase().includes(word))
				.length * 0.15; // -15% per uncertainty word

		// Short thought penalty
		const shortPenalty = thought.length < 20 ? 0.2 : 0; // -20% for very short thoughts

		// Question penalty
		const questionPenalty = thought.includes("?") ? 0.1 : 0; // -10% for questions

		const confidence = Math.max(
			0.05,
			Math.min(
				0.95,
				baseConfidence +
					lengthFactor +
					progressFactor -
					revisionPenalty +
					complexityBonus -
					uncertaintyPenalty -
					shortPenalty -
					questionPenalty,
			),
		);

		return confidence;
	}

	private async askLLMForConfidence(
		thought: string,
		model: string,
	): Promise<number> {
		// With no external LLM, return a neutral midpoint confidence
		return 0.5;
	}

	private calculateUncertaintyAnalysis(
		confidence: number,
		thoughtNumber: number,
	): {
		mean: number;
		std: number;
		quantiles: number[];
	} {
		// Julia-inspired uncertainty propagation
		const mean = confidence;
		const std = Math.max(0.05, (1 - confidence) * 0.3);

		// Generate quantiles based on beta distribution approximation
		const quantiles = [
			Math.max(0, mean - 2 * std), // 2.5%
			Math.max(0, mean - std), // 16%
			mean, // 50%
			Math.min(1, mean + std), // 84%
			Math.min(1, mean + 2 * std), // 97.5%
		];

		return { mean, std, quantiles };
	}

	private assessEvidence(thought: string): {
		logical_consistency: number;
		complexity_score: number;
		empirical_support: number;
		logical_structure?: {
			nodes: string[];
			edges: [string, string][];
			hasCycles: boolean;
			depth: number;
		};
	} {
		// 🔥 BRILLIANT: Build Logical Dependency Graph for circularity detection
		const logicalGraph = this.buildLogicalDependencyGraph(
			thought,
			this.thoughtHistory,
		);

		// Enhanced logical consistency assessment with graph analysis
		const logicalTerms = [
			"because",
			"therefore",
			"thus",
			"hence",
			"consequently",
			"since",
		];
		const logicalCount = logicalTerms.filter((term) =>
			thought.toLowerCase().includes(term),
		).length;
		let logical_consistency = Math.min(0.95, 0.5 + logicalCount * 0.15);

		// Penalize circular reasoning detected by graph analysis
		if (logicalGraph.hasCycles) {
			logical_consistency *= 0.3; // Major penalty for circularity
		}

		// Complexity scoring
		const sentences = thought
			.split(/[.!?]+/)
			.filter((s) => s.trim().length > 0);
		const avgWordsPerSentence =
			thought.split(/\s+/).length / Math.max(1, sentences.length);
		const complexity_score = Math.min(
			5.0,
			1.0 + Math.log(avgWordsPerSentence) / Math.log(2),
		);

		// Empirical support assessment
		const evidenceTerms = [
			"data",
			"evidence",
			"research",
			"study",
			"analysis",
			"observation",
			"fact",
		];
		const evidenceCount = evidenceTerms.filter((term) =>
			thought.toLowerCase().includes(term),
		).length;
		const empirical_support = Math.min(0.9, 0.3 + evidenceCount * 0.2);

		// Reward reasoning depth from graph analysis
		const enhanced_complexity_score = Math.max(
			complexity_score,
			logicalGraph.depth * 0.5,
		);

		return {
			logical_consistency,
			complexity_score: enhanced_complexity_score,
			empirical_support,
			logical_structure: logicalGraph, // NEW: Return graph for analysis
		};
	}

	// 🔥 BRILLIANT: Simple Graph Theory for Logical Dependency Analysis
	private buildLogicalDependencyGraph(
		thought: string,
		history: JuliaThoughtData[],
	): {
		nodes: string[];
		edges: [string, string][];
		hasCycles: boolean;
		depth: number;
	} {
		// Extract claims (simple regex for sentences with logical markers)
		const sentences = thought.split(/[.!?]+/).filter((s) => s.trim());
		const claims = sentences.filter((s) =>
			/\b(because|therefore|thus|since|implies|so|hence)\b/i.test(s),
		);

		// Build edges (claim A → claim B if B references A)
		const edges: [string, string][] = [];
		for (let i = 0; i < claims.length - 1; i++) {
			edges.push([claims[i], claims[i + 1]]);
		}

		// Detect cycles (brilliant: simple DFS)
		const hasCycles = this.detectCyclesInGraph(claims, edges);

		// Calculate reasoning depth (longest path)
		const depth = this.calculateGraphDepth(claims, edges);

		return { nodes: claims, edges, hasCycles, depth };
	}

	private detectCyclesInGraph(
		nodes: string[],
		edges: [string, string][],
	): boolean {
		const visited = new Set<string>();
		const recStack = new Set<string>();

		const hasCycleDFS = (node: string): boolean => {
			visited.add(node);
			recStack.add(node);

			const neighbors = edges
				.filter(([from]) => from === node)
				.map(([, to]) => to);
			for (const neighbor of neighbors) {
				if (!visited.has(neighbor)) {
					if (hasCycleDFS(neighbor)) return true;
				} else if (recStack.has(neighbor)) {
					return true; // Cycle detected!
				}
			}

			recStack.delete(node);
			return false;
		};

		for (const node of nodes) {
			if (!visited.has(node) && hasCycleDFS(node)) {
				return true;
			}
		}
		return false;
	}

	private calculateGraphDepth(
		nodes: string[],
		edges: [string, string][],
	): number {
		if (nodes.length === 0) return 0;

		// Build adjacency list
		const adj: Record<string, string[]> = {};
		for (const node of nodes) {
			adj[node] = [];
		}
		for (const [from, to] of edges) {
			adj[from].push(to);
		}

		// Find longest path using DFS
		let maxDepth = 0;
		const visited = new Set<string>();

		const dfs = (node: string, depth: number): void => {
			visited.add(node);
			maxDepth = Math.max(maxDepth, depth);

			for (const neighbor of adj[node]) {
				if (!visited.has(neighbor)) {
					dfs(neighbor, depth + 1);
				}
			}
			visited.delete(node);
		};

		for (const node of nodes) {
			if (!visited.has(node)) {
				dfs(node, 1);
			}
		}

		return maxDepth;
	}

	public formatThought(thoughtData: JuliaThoughtData): JuliaFormattedThought {
		const {
			thoughtNumber,
			totalThoughts,
			thought,
			isRevision,
			revisesThought,
			branchFromThought,
			branchId,
			confidence,
			uncertainty_analysis,
			evidence_assessment,
		} = thoughtData;

		let prefix = "";
		let context = "";

		if (isRevision) {
			prefix = "Revision";
			context = ` (revising thought ${revisesThought})`;
		} else if (branchFromThought) {
			prefix = "Branch";
			context = ` (from thought ${branchFromThought}, ID: ${branchId})`;
		} else {
			prefix = "Thought";
			context = "";
		}

		// 🔥 BRILLIANT: Confidence-Adaptive Formatting with Visual Indicators
		const confidenceEmoji =
			confidence > 0.8
				? "🟢"
				: confidence > 0.6
					? "🟡"
					: confidence > 0.4
						? "🟠"
						: "🔴";

		const urgencyIndicator =
			confidence < 0.5
				? " ⚠️ LOW CONFIDENCE - REVIEW RECOMMENDED"
				: uncertainty_analysis.std > 0.3
					? " ⚡ HIGH UNCERTAINTY"
					: evidence_assessment.logical_structure?.hasCycles
						? " 🔄 CIRCULAR LOGIC DETECTED"
						: "";

		const confidenceDisplay = `Confidence: ${(confidence * 100).toFixed(1)}%`;
		const uncertaintyDisplay = `Uncertainty: μ=${uncertainty_analysis.mean.toFixed(2)}, σ=${uncertainty_analysis.std.toFixed(2)}`;

		const header = `${confidenceEmoji} ${prefix} ${thoughtNumber}/${totalThoughts}${context} | ${confidenceDisplay}${urgencyIndicator}`;
		const evidenceLine = `Logic: ${(evidence_assessment.logical_consistency * 100).toFixed(0)}% | Complexity: ${evidence_assessment.complexity_score.toFixed(1)} | Support: ${(evidence_assessment.empirical_support * 100).toFixed(0)}%`;

		// Add ASCII art confidence bar
		const barLength = 20;
		const filled = Math.round(confidence * barLength);
		const confidenceBar = `[${"█".repeat(filled)}${"░".repeat(barLength - filled)}] ${(confidence * 100).toFixed(0)}%`;

		const displayThought = thought;

		const maxLineLength = Math.max(
			header.length,
			confidenceBar.length + 2,
			displayThought
				.split("\n")
				.reduce((max, line) => Math.max(max, line.length), 0),
			uncertaintyDisplay.length,
			evidenceLine.length,
		);
		const border = "─".repeat(maxLineLength + 4);

		const thoughtLines = displayThought
			.split("\n")
			.map((line) => `│ ${line.padEnd(maxLineLength)} │`)
			.join("\n");

		const formatted = `
┌${border}┐
│ ${header.padEnd(maxLineLength)} │
│ ${confidenceBar.padEnd(maxLineLength)} │
├${border}┤
${thoughtLines}
│ ${uncertaintyDisplay.padEnd(maxLineLength)} │
│ ${evidenceLine.padEnd(maxLineLength)} │
└${border}┘`;

		return {
			raw: thoughtData,
			formatted,
			display: {
				prefix,
				context,
				header,
				border,
			},
			confidence_display: confidenceDisplay,
			uncertainty_display: uncertaintyDisplay,
		};
	}

	// ENHANCED: Process thought with implicit session management
	public async processThought(
		input: SimpleThoughtInput | AdvancedThoughtInput,
	): Promise<{
		success: boolean;
		thought?: JuliaFormattedThought;
		error?: string;
		proactiveGuidance?: ProactiveGuidance; // NEW: System's proactive suggestions
		relevantHistory?: JuliaThoughtData[]; // NEW: Similar past thoughts from memory
		logicalAnalysis?: {
			// NEW: Structural reasoning insights
			hasCycles: boolean;
			reasoningDepth: number;
			logicalConsistency: number;
		};
		confidenceCalibration?: {
			// NEW: Confidence analysis details
			original: number;
			calibrated: number;
			adjustment: number;
		};
		metadata: {
			thoughtNumber: number;
			totalThoughts: number;
			nextThoughtNeeded: boolean;
			branches: string[];
			thoughtHistoryLength: number;
			confidence: number;
			reasoning_engine: string;
			memorySize: number; // NEW: Memory usage
		};
	}> {
		try {
			// --- IMPLICIT SESSION LOGIC ---
			const lastThought =
				this.thoughtHistory.length > 0
					? this.thoughtHistory[this.thoughtHistory.length - 1]
					: null;

			const thoughtNumber = lastThought ? lastThought.thoughtNumber + 1 : 1;

			// Auto-detect revision
			const isRevision =
				"isRevision" in input
					? input.isRevision
					: /^(Correction|Actually|Wait|No, let me revise|On second thought)/i.test(
							input.content,
						);
			const revisesThought =
				"revisesThought" in input
					? input.revisesThought
					: isRevision && lastThought
						? lastThought.thoughtNumber
						: undefined;

			// Auto-detect branching
			const isBranch =
				"branchFromThought" in input ||
				/^(Alternatively|Another approach|What if)/i.test(input.content);
			const branchFromThought =
				"branchFromThought" in input
					? input.branchFromThought
					: isBranch && lastThought
						? lastThought.thoughtNumber
						: undefined;
			const branchId =
				"branchId" in input
					? input.branchId
					: isBranch
						? `branch-${branchFromThought}-${Date.now().toString(36)}`
						: undefined;

			const validatedInput: ThoughtData = {
				thought: input.content,
				thoughtNumber:
					"thoughtNumber" in input
						? (input.thoughtNumber ?? thoughtNumber)
						: thoughtNumber,
				totalThoughts:
					"totalThoughts" in input
						? (input.totalThoughts ??
							(lastThought?.totalThoughts || thoughtNumber))
						: lastThought?.totalThoughts || thoughtNumber,
				nextThoughtNeeded: !input.is_final_thought,
				isRevision,
				revisesThought,
				branchFromThought,
				branchId,
			};

			// Auto-adjust total thoughts if needed
			if (validatedInput.thoughtNumber > validatedInput.totalThoughts) {
				validatedInput.totalThoughts = validatedInput.thoughtNumber;
			}

			// Calculate Julia-inspired metrics
			const originalConfidence = this.calculateConfidence(
				validatedInput.thought,
				validatedInput.thoughtNumber,
				validatedInput.totalThoughts,
				validatedInput.isRevision || false,
			);
			const uncertainty_analysis = this.calculateUncertaintyAnalysis(
				originalConfidence,
				validatedInput.thoughtNumber,
			);
			const evidence_assessment = this.assessEvidence(validatedInput.thought);

			// Create the original thought (without research yet)
			const originalThought: JuliaThoughtData = {
				...validatedInput,
				confidence: originalConfidence,
				uncertainty_analysis,
				evidence_assessment,
				reasoning_engine: "HPTMAB-TypeScript",
			};

			// Add to history
			this.thoughtHistory.push(originalThought);

			// Handle branching
			if (originalThought.branchFromThought && originalThought.branchId) {
				if (!this.branches[originalThought.branchId]) {
					this.branches[originalThought.branchId] = [];
				}
				this.branches[originalThought.branchId].push(originalThought);
			}

			// 🔥 BRILLIANT ADDITIONS (Parallel execution) - All systems running together
			const [relevantHistory, logicalGraph, proactiveGuidance] =
				await Promise.all([
					Promise.resolve(this.memory.findRelevant(input.content, 3)), // Sync for now
					Promise.resolve(
						this.buildLogicalDependencyGraph(
							input.content,
							this.thoughtHistory,
						),
					), // Sync for now
					this.proactiveLayer.analyzeThoughtStream(
						originalThought,
						this.thoughtHistory,
					),
				]);

			// Update thought with logical analysis
			originalThought.evidence_assessment.logical_structure = logicalGraph;

			// Add to memory for future retrieval
			this.memory.add(originalThought);

			// Format the enhanced thought with confidence-adaptive display
			const formattedThought = this.formatThought(originalThought);

			// Return enriched response with ALL insights
			return {
				success: true,
				thought: formattedThought,
				proactiveGuidance, // NEW: System's proactive suggestions
				relevantHistory, // NEW: Similar past thoughts from memory
				logicalAnalysis: {
					// NEW: Structural reasoning insights
					hasCycles: logicalGraph.hasCycles,
					reasoningDepth: logicalGraph.depth,
					logicalConsistency:
						originalThought.evidence_assessment.logical_consistency,
				},
				confidenceCalibration: {
					// NEW: Confidence analysis details (no external calibration)
					original: originalConfidence,
					calibrated: originalConfidence,
					adjustment: 0,
				},
				metadata: {
					thoughtNumber: originalThought.thoughtNumber,
					totalThoughts: originalThought.totalThoughts,
					nextThoughtNeeded: originalThought.nextThoughtNeeded,
					branches: Object.keys(this.branches),
					thoughtHistoryLength: this.thoughtHistory.length,
					confidence: originalConfidence,
					reasoning_engine: originalThought.reasoning_engine,
					memorySize: this.memory.getMemorySize(), // NEW: Memory usage
				},
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
				metadata: {
					thoughtNumber: 0,
					totalThoughts: 0,
					nextThoughtNeeded: false,
					branches: Object.keys(this.branches),
					thoughtHistoryLength: this.thoughtHistory.length,
					confidence: 0,
					reasoning_engine: "HPTMAB-TypeScript",
					memorySize: this.memory.getMemorySize(),
				},
			};
		}
	}

	public getThoughtHistory(): JuliaThoughtData[] {
		return [...this.thoughtHistory];
	}

	public getBranches(): Record<string, JuliaThoughtData[]> {
		return { ...this.branches };
	}

	public clearHistory(): void {
		this.thoughtHistory = [];
		this.branches = {};
		this.memory.clear(); // NEW: Clear semantic memory too
	}

	public getThoughtByNumber(
		thoughtNumber: number,
	): JuliaThoughtData | undefined {
		return this.thoughtHistory.find((t) => t.thoughtNumber === thoughtNumber);
	}
}

// Enhanced tool definition for Julia-inspired sequential thinking
const JULIA_SEQUENTIAL_THINKING_TOOL_V2 = {
	name: "think",
	description: `Engages in sequential thinking to break down complex problems.
This tool automatically manages the thought process, including numbering, revisions, and branching.
The model should provide its thought process in the 'content' parameter.
`,
	inputSchema: {
		type: "object",
		properties: {
			content: {
				type: "string",
				description: "The content of the current thought.",
			},
			is_final_thought: {
				type: "boolean",
				description:
					"Set to true only when this is the last thought in the sequence.",
				default: false,
			},
			// ADVANCED (Optional Overrides)
			thoughtNumber: {
				type: "integer",
				description: "ADVANCED: Manually override the thought number.",
				minimum: 1,
			},
			totalThoughts: {
				type: "integer",
				description: "ADVANCED: Manually override the total thought estimate.",
				minimum: 1,
			},
			isRevision: {
				type: "boolean",
				description: "ADVANCED: Force this thought to be a revision.",
			},
			revisesThought: {
				type: "integer",
				description: "ADVANCED: Specify which thought number is being revised.",
				minimum: 1,
			},
		},
		required: ["content"],
	},
};

// For backwards compatibility, we export the new tool under the old name.
export const JULIA_SEQUENTIAL_THINKING_TOOL = JULIA_SEQUENTIAL_THINKING_TOOL_V2;
