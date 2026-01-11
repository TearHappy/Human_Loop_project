import { Brain, MessageSquare, StickyNote } from "lucide-react";
import type React from "react";

interface MobilePanelNavigatorProps {
	activePanel: "thinking" | "chat" | "notes";
	onPanelChange: (panel: "thinking" | "chat" | "notes") => void;
}

export const MobilePanelNavigator: React.FC<MobilePanelNavigatorProps> = ({
	activePanel,
	onPanelChange,
}) => {
	const panels: Array<"thinking" | "chat" | "notes"> = [
		"thinking",
		"chat",
		"notes",
	];
	const currentIndex = panels.indexOf(activePanel);

	return (
		<div className="sm:hidden fixed bottom-0 left-0 right-0 bg-[#1C1C1C] border-t border-[#333333] z-50">
			<div className="flex justify-around items-center py-2 px-4">
				<button
					type="button"
					onClick={() => onPanelChange("thinking")}
					className={`flex flex-col items-center p-2 rounded-lg transition-colors flex-1 ${
						activePanel === "thinking"
							? "text-white bg-[#2A2A2A]"
							: "text-gray-400 hover:text-white"
					}`}
				>
					<Brain className="h-5 w-5 mb-1" />
					<span className="text-xs">Thinking</span>
				</button>

				<button
					type="button"
					onClick={() => onPanelChange("chat")}
					className={`flex flex-col items-center p-2 rounded-lg transition-colors flex-1 ${
						activePanel === "chat"
							? "text-white bg-[#2A2A2A]"
							: "text-gray-400 hover:text-white"
					}`}
				>
					<MessageSquare className="h-5 w-5 mb-1" />
					<span className="text-xs">Chat</span>
				</button>

				<button
					type="button"
					onClick={() => onPanelChange("notes")}
					className={`flex flex-col items-center p-2 rounded-lg transition-colors flex-1 ${
						activePanel === "notes"
							? "text-white bg-[#2A2A2A]"
							: "text-gray-400 hover:text-white"
					}`}
				>
					<StickyNote className="h-5 w-5 mb-1" />
					<span className="text-xs">Notes</span>
				</button>
			</div>
		</div>
	);
};
