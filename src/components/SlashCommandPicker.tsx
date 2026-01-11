// src/components/SlashCommandPicker.tsx

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Command, FileCode, Terminal, X, Zap } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";

export interface SlashCommand {
	id: string;
	name: string;
	description: string;
	template: string;
	icon?: "zap" | "file" | "terminal";
}

interface SlashCommandPickerProps {
	onSelect: (command: SlashCommand) => void;
	onClose: () => void;
	searchQuery?: string;
}

const DEFAULT_COMMANDS: SlashCommand[] = [
	{
		id: "fix",
		name: "fix",
		description: "Fix bugs in the code",
		template: "Please fix the bugs in the following code:\n\n",
		icon: "zap",
	},
	{
		id: "explain",
		name: "explain",
		description: "Explain code or concept",
		template: "Please explain:\n\n",
		icon: "file",
	},
	{
		id: "optimize",
		name: "optimize",
		description: "Optimize code performance",
		template: "Please optimize this code:\n\n",
		icon: "zap",
	},
	{
		id: "test",
		name: "test",
		description: "Generate tests",
		template: "Please generate tests for:\n\n",
		icon: "terminal",
	},
	{
		id: "refactor",
		name: "refactor",
		description: "Refactor code",
		template: "Please refactor this code:\n\n",
		icon: "file",
	},
];

const getIcon = (icon?: string) => {
	switch (icon) {
		case "zap":
			return Zap;
		case "file":
			return FileCode;
		case "terminal":
			return Terminal;
		default:
			return Command;
	}
};

export const SlashCommandPicker: React.FC<SlashCommandPickerProps> = ({
	onSelect,
	onClose,
	searchQuery = "",
}) => {
	const [commands] = useState<SlashCommand[]>(DEFAULT_COMMANDS);
	const [filteredCommands, setFilteredCommands] =
		useState<SlashCommand[]>(DEFAULT_COMMANDS);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const listRef = useRef<HTMLDivElement>(null);

	// Filter commands based on search
	useEffect(() => {
		const query = searchQuery.toLowerCase();
		if (!query) {
			setFilteredCommands(commands);
		} else {
			const filtered = commands.filter(
				(cmd) =>
					cmd.name.toLowerCase().includes(query) ||
					cmd.description.toLowerCase().includes(query),
			);
			setFilteredCommands(filtered);
		}
		setSelectedIndex(0);
	}, [searchQuery, commands]);

	// Keyboard navigation
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			switch (e.key) {
				case "Escape":
					e.preventDefault();
					onClose();
					break;
				case "Enter":
					e.preventDefault();
					if (filteredCommands.length > 0) {
						onSelect(filteredCommands[selectedIndex]);
					}
					break;
				case "ArrowUp":
					e.preventDefault();
					setSelectedIndex((prev) => Math.max(0, prev - 1));
					break;
				case "ArrowDown":
					e.preventDefault();
					setSelectedIndex((prev) =>
						Math.min(filteredCommands.length - 1, prev + 1),
					);
					break;
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [filteredCommands, selectedIndex, onSelect, onClose]);

	// Scroll selected into view
	useEffect(() => {
		if (listRef.current) {
			const selected = listRef.current.querySelector(
				`[data-index="${selectedIndex}"]`,
			);
			if (selected) {
				selected.scrollIntoView({ block: "nearest", behavior: "smooth" });
			}
		}
	}, [selectedIndex]);

	if (filteredCommands.length === 0) {
		return (
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: 10 }}
				className="absolute bottom-full mb-2 left-0 w-full bg-card border border-border rounded-lg shadow-lg p-4"
			>
				<div className="text-center text-sm text-muted-foreground">
					No commands found for "{searchQuery}"
				</div>
			</motion.div>
		);
	}

	return (
		<motion.div
			initial={{ opacity: 0, y: -10 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -10 }}
			className="fixed bottom-auto top-auto left-0 z-50 w-full max-w-md bg-card border border-border rounded-lg shadow-lg overflow-hidden"
			style={{
				position: "absolute",
				bottom: "100%",
				marginBottom: "0.5rem",
			}}
		>
			{/* Header */}
			<div className="border-b border-border p-2 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Command className="h-3.5 w-3.5 text-muted-foreground" />
					<span className="text-xs font-medium">Slash Commands</span>
				</div>
				<Button
					onClick={onClose}
					size="sm"
					variant="ghost"
					className="h-6 w-6 p-0 hover:bg-transparent"
				>
					<X className="h-3 w-3" />
				</Button>
			</div>

			{/* Command list */}
			<div ref={listRef} className="max-h-64 overflow-y-auto p-1">
				{filteredCommands.map((command, index) => {
					const Icon = getIcon(command.icon);
					const isSelected = index === selectedIndex;

					return (
						<button
							type="button"
							key={command.id}
							data-index={index}
							onClick={() => onSelect(command)}
							onMouseEnter={() => setSelectedIndex(index)}
							className={`w-full flex items-start gap-3 p-2 rounded-md text-left transition-all duration-200 ${
								isSelected ? "bg-white text-black" : "hover:bg-accent/50"
							}`}
						>
							<Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
							<div className="flex-1 min-w-0">
								<div className="text-sm font-medium">/{command.name}</div>
								<div className="text-xs text-muted-foreground line-clamp-1">
									{command.description}
								</div>
							</div>
						</button>
					);
				})}
			</div>

			{/* Footer */}
			<div className="border-t border-border p-2">
				<div className="text-xs text-muted-foreground text-center">
					↑↓ Navigate • Enter Select • Esc Close
				</div>
			</div>
		</motion.div>
	);
};
