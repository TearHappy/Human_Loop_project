"use client";

import { Mic, MicOff, X } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "../../components/ui/card";
import { VoicePoweredOrb } from "../../components/ui/voice-powered-orb";

interface ComponentIntegratorProps {
	onExitVoiceMode?: () => void;
}

const ComponentIntegrator: React.FC<ComponentIntegratorProps> = ({
	onExitVoiceMode,
}) => {
	const [isRecording, setIsRecording] = useState(false);
	const [voiceDetected, setVoiceDetected] = useState(false);

	const toggleRecording = () => {
		setIsRecording(!isRecording);
	};

	return (
		<div className="h-full flex flex-col overflow-hidden bg-background text-white relative">
			{/* Exit Button - Top Right Corner */}
			<Button
				variant="ghost"
				size="sm"
				onClick={onExitVoiceMode}
				className="absolute top-4 right-4 z-10 h-8 w-8 p-0 bg-gray-800/50 hover:bg-gray-700/50 text-white"
			>
				<X className="h-4 w-4" />
			</Button>

			<Card className="h-full flex flex-col overflow-hidden bg-background border-gray-800">
				<CardContent className="flex-1 p-0 overflow-y-auto">
					<div className="flex items-center justify-center h-full p-6">
						<div className="flex flex-col items-center justify-center space-y-8 w-full max-w-4xl">
							<div className="w-full max-w-2xl aspect-square relative bg-background rounded-lg overflow-hidden">
								<VoicePoweredOrb
									enableVoiceControl={isRecording}
									className="w-full h-full"
									onVoiceDetected={setVoiceDetected}
								/>
							</div>

							<Button
								onClick={toggleRecording}
								variant={isRecording ? "destructive" : "default"}
								size="lg"
								className="px-8 py-3"
							>
								{isRecording ? (
									<>
										<MicOff className="w-5 h-5 mr-3" />
										Stop Recording
									</>
								) : (
									<>
										<Mic className="w-5 h-5 mr-3" />
										Start Recording
									</>
								)}
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
};

export default ComponentIntegrator;
