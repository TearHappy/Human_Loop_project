import { useEffect, useRef } from "react";

/**
 * Hook for smart auto-scrolling behavior
 * Auto-scrolls to bottom when new content arrives, but respects user scrolling
 */
export function useAutoScroll<T>(dependencies: T[]) {
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const shouldAutoScrollRef = useRef(true);
	const userHasScrolledRef = useRef(false);

	// Auto-scroll to bottom when dependencies change
	useEffect(() => {
		if (shouldAutoScrollRef.current && scrollContainerRef.current) {
			const scrollElement = scrollContainerRef.current;
			scrollElement.scrollTop = scrollElement.scrollHeight;
		}
	}, dependencies);

	// Handle scroll events to detect user scrolling
	const handleScroll = () => {
		if (!scrollContainerRef.current) return;

		const scrollElement = scrollContainerRef.current;
		const isAtBottom =
			Math.abs(
				scrollElement.scrollHeight -
					scrollElement.scrollTop -
					scrollElement.clientHeight,
			) < 50;

		if (!isAtBottom) {
			userHasScrolledRef.current = true;
			shouldAutoScrollRef.current = false;
		} else if (userHasScrolledRef.current) {
			shouldAutoScrollRef.current = true;
			userHasScrolledRef.current = false;
		}
	};

	return {
		scrollContainerRef,
		handleScroll,
	};
}
