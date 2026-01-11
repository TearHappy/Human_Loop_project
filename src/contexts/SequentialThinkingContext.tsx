"use client";

import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	type AdvancedThoughtInput,
	type FormattedThought,
	SequentialThinkingServiceJulia,
	type SimpleThoughtInput,
} from "../lib/sequential-thinking/SequentialThinkingServiceJulia";

interface SequentialThinkingContextType {
	thoughts: FormattedThought[];
	isActive: boolean;
	addThought: (
		thoughtData: SimpleThoughtInput | AdvancedThoughtInput,
	) => Promise<void>;
	clearThoughts: () => void;
	setActive: (active: boolean) => void;
}

const SequentialThinkingContext = createContext<
	SequentialThinkingContextType | undefined
>(undefined);

export const useSequentialThinking = () => {
	const context = useContext(SequentialThinkingContext);
	if (!context) {
		throw new Error(
			"useSequentialThinking must be used within a SequentialThinkingProvider",
		);
	}
	return context;
};

interface SequentialThinkingProviderProps {
	children: React.ReactNode;
}

export const SequentialThinkingProvider = ({
	children,
}: SequentialThinkingProviderProps) => {
	const [thoughts, setThoughts] = useState<FormattedThought[]>([]);
	const [isActive, setIsActive] = useState(false);
	const [service] = useState(() => new SequentialThinkingServiceJulia());

	const thoughtsRef = useRef(thoughts);
	useEffect(() => {
		thoughtsRef.current = thoughts;
	}, [thoughts]);
	const startNewRun = useCallback(() => {
		service.clearHistory();
		setThoughts([]);
		setIsActive(false);
	}, [service]);

	const addThought = useCallback(
		async (thoughtData: SimpleThoughtInput | AdvancedThoughtInput) => {
			try {
				// If a new sequential thinking stream starts at 1 while we still have
				// previous thoughts, treat it as a new run to avoid duplicate numbering/key
				// collisions like 1/2 appearing multiple times.
				if (
					"thoughtNumber" in thoughtData &&
					thoughtData.thoughtNumber === 1 &&
					thoughtsRef.current.length > 0
				) {
					startNewRun();
				}

				const result = await service.processThought(thoughtData);
				if (result.success && result.thought) {
					const thought = result.thought;
					if (!thought) return;
					setThoughts((prev) => [...prev, thought]);
					setIsActive(result.metadata.nextThoughtNeeded);
				} else {
					console.error(
						"[SequentialThinking] Failed to process thought:",
						result.error,
					);
				}
			} catch (error) {
				console.error("[SequentialThinking] Error processing thought:", error);
			}
		},
		[service, startNewRun],
	);

	const clearThoughts = useCallback(() => {
		startNewRun();
	}, [startNewRun]);

	const setActive = useCallback((active: boolean) => {
		setIsActive(active);
	}, []);

	const value = useMemo<SequentialThinkingContextType>(
		() => ({
			thoughts,
			isActive,
			addThought,
			clearThoughts,
			setActive,
		}),
		[thoughts, isActive, addThought, clearThoughts, setActive],
	);

	return (
		<SequentialThinkingContext.Provider value={value}>
			{children}
		</SequentialThinkingContext.Provider>
	);
};
