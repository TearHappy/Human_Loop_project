"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GitBranch, MessageCircle, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import SequentialThinkingSkeleton from "../../components/SequentialThinkingSkeleton";
import type {
	FormattedThought,
	ThoughtData,
} from "../lib/sequential-thinking/SequentialThinkingServiceJulia";

interface SequentialThinkingPanelProps {
	thoughts: FormattedThought[];
	isActive: boolean;
	onClear?: () => void;
}

export const SequentialThinkingPanel = ({
	thoughts,
	isActive, // This now represents the socket connection status
	onClear,
}: SequentialThinkingPanelProps) => {
	const [expandedThoughts, setExpandedThoughts] = useState<Set<number>>(
		new Set(),
	);

	const toggleThought = useCallback((thoughtNumber: number) => {
		setExpandedThoughts((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(thoughtNumber)) {
				newSet.delete(thoughtNumber);
			} else {
				newSet.add(thoughtNumber);
			}
			return newSet;
		});
	}, []);

	const getThoughtBadgeVariant = (thought: ThoughtData) => {
		if (thought.isRevision) return "secondary";
		if (thought.branchFromThought) return "outline";
		if (!thought.nextThoughtNeeded) return "default";
		return "secondary";
	};

	const formatThoughtContent = (content: string) => {
		// Split by lines and format with proper spacing
		const lines = content.split("\n");
		return lines.map((line, index) => (
			<div
				key={`line-${index}-${line.substring(0, 10)}`}
				className={line.trim() === "" ? "h-2" : ""}
			>
				{line}
			</div>
		));
	};

	return (
		<>
			<CardContent className="flex-1 flex flex-col p-0">
				<div className="flex-1 overflow-hidden">
					<ScrollArea className="h-full px-4 py-4">
						{thoughts.length === 0 ? (
							<div className="px-1 grid grid-cols-1 gap-6">
								{/* Sequential Thinking skeleton with all details preserved - immune to external CSS */}
								<SequentialThinkingSkeleton
									items={3}
									showRevisionBadges={true}
									showMiniBadges={true}
								/>
							</div>
						) : (
							<div className="space-y-5">
								{thoughts
									.slice()
									.reverse()
									.map((formattedThought, index) => {
										const thought = formattedThought.raw;
										const isExpanded = expandedThoughts.has(
											thought.thoughtNumber,
										);

										// Create a unique key that accounts for revisions and branches
										const uniqueKey = thought.isRevision
											? `${thought.thoughtNumber}-rev-${thought.revisesThought}`
											: thought.branchFromThought
												? `${thought.thoughtNumber}-branch-${thought.branchFromThought}-${thought.branchId}`
												: `${thought.thoughtNumber}`;

										return (
											<div
												key={uniqueKey}
												className="border border-[#333333] rounded-lg bg-[#121212] p-3 transition-all duration-200 hover:border-[#444444]"
												style={{
													boxShadow:
														"0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2)",
												}}
											>
												<button
													type="button"
													className="flex items-center justify-between cursor-pointer w-full text-left"
													onClick={() => toggleThought(thought.thoughtNumber)}
												>
													<div className="flex items-center space-x-2">
														<Badge
															variant={getThoughtBadgeVariant(thought)}
															className="text-xs flex items-center gap-1"
														>
															<MessageCircle className="h-3 w-3" />
															{formattedThought.display.prefix}{" "}
															{thought.thoughtNumber}/{thought.totalThoughts}
														</Badge>
														{thought.isRevision && thought.revisesThought && (
															<Badge variant="outline" className="text-xs">
																Revises #{thought.revisesThought}
															</Badge>
														)}
														{thought.branchFromThought && (
															<Badge variant="outline" className="text-xs">
																Branch from #{thought.branchFromThought}
															</Badge>
														)}
													</div>
													<div className="flex items-center space-x-2">
														<span className="text-xs text-muted-foreground">
															{isExpanded ? "−" : "+"}
														</span>
													</div>
												</button>

												{isExpanded && (
													<div className="mt-3 pt-3 border-t">
														<div className="text-sm font-mono bg-muted/30 rounded p-2 whitespace-pre-wrap">
															{formatThoughtContent(thought.thought)}
														</div>

														{(thought.branchId ||
															thought.needsMoreThoughts) && (
															<div className="mt-2 flex flex-wrap gap-1">
																{thought.branchId && (
																	<Badge variant="outline" className="text-xs">
																		Branch ID: {thought.branchId}
																	</Badge>
																)}
																{thought.needsMoreThoughts && (
																	<Badge
																		variant="secondary"
																		className="text-xs"
																	>
																		Needs More Thoughts
																	</Badge>
																)}
															</div>
														)}
													</div>
												)}
											</div>
										);
									})}

								{/* Summary at the bottom */}
								{thoughts.length > 0 && (
									<div className="mt-4 p-3 bg-muted/30 rounded-lg">
										<div className="text-xs text-muted-foreground space-y-1">
											<div>Total Thoughts: {thoughts.length}</div>
											<div>
												Revisions:{" "}
												{thoughts.filter((t) => t.raw.isRevision).length}
											</div>
											<div>
												Branches:{" "}
												{
													new Set(
														thoughts
															.filter((t) => t.raw.branchId)
															.map((t) => t.raw.branchId),
													).size
												}
											</div>
											<div>
												Status:{" "}
												{thoughts[thoughts.length - 1]?.raw.nextThoughtNeeded
													? "In Progress"
													: "Complete"}
											</div>
										</div>
									</div>
								)}
							</div>
						)}
					</ScrollArea>
				</div>
			</CardContent>
		</>
	);
};
