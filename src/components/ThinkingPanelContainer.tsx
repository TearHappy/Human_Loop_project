"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, RotateCcw } from "lucide-react";
import React from "react";
import type { FormattedThought } from "../lib/sequential-thinking/SequentialThinkingServiceJulia";
import { SequentialThinkingPanel } from "./SequentialThinkingPanel";

interface ThinkingPanelContainerProps {
	thoughts: FormattedThought[];
	isActive: boolean;
	onClear?: () => void;
}

export function ThinkingPanelContainer({
	thoughts,
	isActive,
	onClear,
}: ThinkingPanelContainerProps) {
	return (
		<Card className="h-full bg-background">
			<CardHeader className="flex flex-row items-center justify-between px-3 py-2 border-b border-border">
				<div className="flex items-center gap-2">
					<Brain className="h-4 w-4 text-muted-foreground" />
					<CardTitle className="text-sm font-medium text-foreground mb-0">
						Thinking Panel
					</CardTitle>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						onClick={onClear}
						title="Clear thoughts"
						aria-label="Clear thoughts"
					>
						<RotateCcw className="h-4 w-4" />
					</Button>
				</div>
			</CardHeader>
			<CardContent className="p-0 h-full">
				<SequentialThinkingPanel
					thoughts={thoughts}
					onClear={onClear}
					isActive={isActive}
				/>
			</CardContent>
		</Card>
	);
}

export default ThinkingPanelContainer;
