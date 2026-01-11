"use client";

import type React from "react";
import { createContext, useContext, useMemo, useState } from "react";
import type { Socket } from "socket.io-client";

import { useSocket } from "../hooks/useSocket";

export interface ChatMessage {
	id: string;
	type: "user" | "assistant" | "system";
	content: string;
	timestamp: Date;
	requestId?: string;
	imageUrl?: string;
}

interface ChatSessionValue {
	socket: Socket | null;
	connected: boolean;
	error: string | null;
	sendMCPRequest: (method: string, params: Record<string, unknown>) => string;
	sendUserResponse: (requestId: string, response: string) => void;
	updateConfig: (configId: string, updates: Record<string, unknown>) => void;
	messages: ChatMessage[];
	setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
	pendingRequests: Set<string>;
	setPendingRequests: React.Dispatch<React.SetStateAction<Set<string>>>;
}

const ChatSessionContext = createContext<ChatSessionValue | null>(null);

interface ProviderProps {
	token: string;
	children: React.ReactNode;
}

export const ChatSessionProvider: React.FC<ProviderProps> = ({
	token,
	children,
}) => {
	const socketState = useSocket({
		token,
		autoConnect: true,
	});

	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [pendingRequests, setPendingRequests] = useState<Set<string>>(
		new Set(),
	);

	const value = useMemo<ChatSessionValue>(
		() => ({
			...socketState,
			messages,
			setMessages,
			pendingRequests,
			setPendingRequests,
		}),
		[socketState, messages, pendingRequests],
	);

	return (
		<ChatSessionContext.Provider value={value}>
			{children}
		</ChatSessionContext.Provider>
	);
};

export const useChatSession = () => {
	const ctx = useContext(ChatSessionContext);
	if (!ctx) {
		throw new Error("useChatSession must be used within ChatSessionProvider");
	}
	return ctx;
};
