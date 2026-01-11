"use client";

import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	type ReactNode,
	useCallback,
} from "react";
import { indexedDB as db } from "../lib/indexeddb";

interface PreviewContextType {
	htmlContent: string;
	cssContent: string;
	setHtmlContent: (html: string) => void;
	setCssContent: (css: string) => void;
	updatePreview: (html: string, css: string) => void;
	isHydrated: boolean;
	onNewFileReceived?: () => void;
}

const PreviewContext = createContext<PreviewContextType | undefined>(undefined);

export function PreviewProvider({ children }: { children: ReactNode }) {
	const [htmlContent, setHtmlContent] = useState("");
	const [cssContent, setCssContent] = useState("");
	const [loaded, setLoaded] = useState(false);

	// PreviewContext is now STATELESS - does NOT load from IndexedDB
	// HTML loaded from htmlFiles table (in page.tsx)
	// CSS loaded from globalCss table (in page.tsx)
	// Preview table NO LONGER USED for persistence
	useEffect(() => {
		console.log(
			"[PreviewContext] ✅ Initialized (stateless mode - no DB loading)",
		);
		setLoaded(true);
	}, []);

	const updatePreview = useCallback((html: string, css: string) => {
		setHtmlContent(html);
		setCssContent(css);
	}, []);

	return (
		<PreviewContext.Provider
			value={{
				htmlContent,
				cssContent,
				setHtmlContent,
				setCssContent,
				updatePreview,
				isHydrated: loaded,
			}}
		>
			{children}
		</PreviewContext.Provider>
	);
}

export function usePreview() {
	const context = useContext(PreviewContext);
	if (context === undefined) {
		throw new Error("usePreview must be used within a PreviewProvider");
	}
	return context;
}
