import { useEffect, useState } from "react";
import type { Workflow } from "../components/WorkflowsPanel";
import { getDefaultPrePrompt, getDefaultSubPrompt } from "../lib/prompts";

interface UsePromptDataOptions {
	ttsEnabled?: boolean;
	storagePrefix?: string;
}

export interface UsePromptDataResult {
	prePrompt: string;
	setPrePrompt: React.Dispatch<React.SetStateAction<string>>;
	subPrompt: string;
	setSubPrompt: React.Dispatch<React.SetStateAction<string>>;
	skills: string[];
	setSkills: React.Dispatch<React.SetStateAction<string[]>>;
	workflows: Workflow[];
	setWorkflows: React.Dispatch<React.SetStateAction<Workflow[]>>;
	workspacePath: string;
	setWorkspacePath: React.Dispatch<React.SetStateAction<string>>;
	getActivePrePrompt: () => string;
	getActiveSubPrompt: () => string;
	loaded: boolean;
}

export function usePromptData(
	options: UsePromptDataOptions = {},
): UsePromptDataResult {
	const { ttsEnabled = false, storagePrefix = "prompt" } = options;

	// State for prompts
	const [prePrompt, setPrePrompt] = useState<string>("");
	const [subPrompt, setSubPrompt] = useState<string>("");
	const [skills, setSkills] = useState<string[]>([]);
	const [workflows, setWorkflows] = useState<Workflow[]>([]);
	const [workspacePath, setWorkspacePath] = useState<string>("");
	const [loaded, setLoaded] = useState(false);

	// Load from localStorage on mount
	useEffect(() => {
		if (typeof window === "undefined") return;

		try {
			const savedPrePrompt = localStorage.getItem(`${storagePrefix}PrePrompt`);
			const savedSubPrompt = localStorage.getItem(`${storagePrefix}SubPrompt`);
			const savedSkills = localStorage.getItem(`${storagePrefix}Skills`);
			const savedWorkflows = localStorage.getItem(`${storagePrefix}Workflows`);
			const savedWorkspacePath = localStorage.getItem(
				`${storagePrefix}WorkspacePath`,
			);

			if (savedPrePrompt !== null) setPrePrompt(savedPrePrompt);
			if (savedSubPrompt !== null) setSubPrompt(savedSubPrompt);
			if (savedWorkspacePath !== null) setWorkspacePath(savedWorkspacePath);
			if (savedSkills !== null) {
				try {
					setSkills(JSON.parse(savedSkills));
				} catch {
					setSkills([]);
				}
			}
			if (savedWorkflows !== null) {
				try {
					setWorkflows(JSON.parse(savedWorkflows));
				} catch {
					setWorkflows([]);
				}
			}
		} catch (error) {
			console.error("[usePromptData] Failed to load from localStorage:", error);
		} finally {
			setLoaded(true);
		}
	}, [storagePrefix]);

	// Save to localStorage when values change (after initial load)
	useEffect(() => {
		if (!loaded || typeof window === "undefined") return;

		try {
			localStorage.setItem(`${storagePrefix}PrePrompt`, prePrompt);
		} catch (error) {
			console.error("[usePromptData] Failed to save prePrompt:", error);
		}
	}, [prePrompt, loaded, storagePrefix]);

	useEffect(() => {
		if (!loaded || typeof window === "undefined") return;

		try {
			localStorage.setItem(`${storagePrefix}SubPrompt`, subPrompt);
		} catch (error) {
			console.error("[usePromptData] Failed to save subPrompt:", error);
		}
	}, [subPrompt, loaded, storagePrefix]);

	useEffect(() => {
		if (!loaded || typeof window === "undefined") return;

		try {
			localStorage.setItem(`${storagePrefix}Skills`, JSON.stringify(skills));
		} catch (error) {
			console.error("[usePromptData] Failed to save skills:", error);
		}
	}, [skills, loaded, storagePrefix]);

	useEffect(() => {
		if (!loaded || typeof window === "undefined") return;

		try {
			localStorage.setItem(
				`${storagePrefix}Workflows`,
				JSON.stringify(workflows),
			);
		} catch (error) {
			console.error("[usePromptData] Failed to save workflows:", error);
		}
	}, [workflows, loaded, storagePrefix]);

	useEffect(() => {
		if (!loaded || typeof window === "undefined") return;

		try {
			localStorage.setItem(`${storagePrefix}WorkspacePath`, workspacePath);
		} catch (error) {
			console.error("[usePromptData] Failed to save workspacePath:", error);
		}
	}, [workspacePath, loaded, storagePrefix]);

	// Helper functions
	const getActivePrePrompt = () =>
		prePrompt.trim() || getDefaultPrePrompt(ttsEnabled);
	const getActiveSubPrompt = () => subPrompt.trim() || getDefaultSubPrompt();

	return {
		prePrompt,
		setPrePrompt,
		subPrompt,
		setSubPrompt,
		skills,
		setSkills,
		workflows,
		setWorkflows,
		workspacePath,
		setWorkspacePath,
		getActivePrePrompt,
		getActiveSubPrompt,
		loaded,
	};
}
