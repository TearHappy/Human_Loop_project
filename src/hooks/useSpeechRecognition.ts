import { useCallback, useEffect, useRef, useState } from "react";

// Web Speech API types
interface SpeechRecognitionEvent {
	resultIndex: number;
	results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
	length: number;
	[index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
	isFinal: boolean;
	[index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
	transcript: string;
	confidence: number;
}

interface SpeechRecognitionErrorEvent {
	error: string;
	message: string;
}

interface SpeechRecognitionInstance {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	onstart: (() => void) | null;
	onresult: ((event: SpeechRecognitionEvent) => void) | null;
	onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
	onaudioend: (() => void) | null;
	onend: (() => void) | null;
	start: () => void;
	stop: () => void;
	abort: () => void;
}

interface WindowWithSpeechRecognition extends Window {
	SpeechRecognition?: new () => SpeechRecognitionInstance;
	webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
}

interface UseSpeechRecognitionReturn {
	isListening: boolean;
	transcript: string;
	interimTranscript: string;
	startListening: () => void;
	stopListening: () => void;
	resetTranscript: () => void;
	supported: boolean;
	error: string | null;
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
	const [isListening, setIsListening] = useState(false);
	const [transcript, setTranscript] = useState("");
	const [interimTranscript, setInterimTranscript] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [supported, setSupported] = useState(false);
	const processedResultsRef = useRef<Set<string>>(new Set());

	const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
	// Represents actual recognition engine state
	const isListeningRef = useRef(false);
	// Represents user intent to continue listening (start/stop requests)
	const desiredListeningRef = useRef(false);
	// Track restart timer to avoid dangling timeouts on unmount
	const restartTimeoutRef = useRef<number | null>(null);
	// Track clear-text timer from stopListening to avoid setting state after unmount
	const clearTextTimeoutRef = useRef<number | null>(null);
	// Track retry attempts to prevent infinite retry loops
	const retryCountRef = useRef(0);
	const maxRetryAttempts = 5; // Maximum retry attempts before giving up

	// Initialize speech recognition
	useEffect(() => {
		if (typeof window === "undefined") return;

		const windowWithSpeech = window as unknown as WindowWithSpeechRecognition;
		const SpeechRecognition =
			windowWithSpeech.SpeechRecognition ||
			windowWithSpeech.webkitSpeechRecognition;

		if (!SpeechRecognition) {
			setSupported(false);
			console.warn("[Speech] Speech recognition not supported");
			return;
		}

		setSupported(true);
		const recognition = new SpeechRecognition();

		// Simple configuration
		recognition.continuous = true; // Keep listening
		recognition.interimResults = true; // Show interim results
		recognition.lang = "en-US";

		// Event handlers
		recognition.onstart = () => {
			console.log("[Speech] Started");
			setIsListening(true);
			isListeningRef.current = true;
			setError(null);
		};

		recognition.onresult = (event: SpeechRecognitionEvent) => {
			let finalTranscript = "";
			let newInterimTranscript = "";

			// Only process NEW results starting from resultIndex
			for (let i = event.resultIndex; i < event.results.length; i++) {
				const transcript = event.results[i][0].transcript;
				const resultKey = `${i}-${transcript}`;

				if (event.results[i].isFinal) {
					// Only add if we haven't processed this exact result before
					if (!processedResultsRef.current.has(resultKey)) {
						finalTranscript += `${transcript} `;
						processedResultsRef.current.add(resultKey);
					}
				} else {
					newInterimTranscript += transcript;
				}
			}

			console.log("[Speech] Result:", {
				final: finalTranscript,
				interim: newInterimTranscript,
			});

			// Update interim transcript for real-time display - use functional update to preserve existing interim text
			if (newInterimTranscript) {
				setInterimTranscript((prev) => {
					// If we have final results coming, don't append interim
					// Otherwise, update with new interim (replaces previous interim for same event)
					return newInterimTranscript;
				});
			}

			// Only update transcript when we have final results
			if (finalTranscript) {
				setTranscript((prev) => prev + finalTranscript);
				// Clear interim only after final results are processed
				setInterimTranscript("");
			}
		};

		recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
			console.error("[Speech] Error:", event.error);
			// If user does not intend to keep listening, just ensure we don't restart
			if (!desiredListeningRef.current) {
				setError(event.error);
				setIsListening(false);
				isListeningRef.current = false;
				return;
			}
			// For "no-speech" while user still wants to listen, we let onend handle restart
			if (event.error === "no-speech") {
				console.warn(
					"[Speech] No speech detected - continuing (will restart on end if intended)",
				);
				return;
			}
			// For other errors while user still wants to listen, try ending; onend will restart if intended
			setError(event.error);
		};

		recognition.onaudioend = () => {
			console.log("[Speech] Audio ended - user stopped speaking");
			// Don't clear transcript here - let parent component handle it
		};

		recognition.onend = () => {
			console.log("[Speech] Recognition ended");
			const wasListening = isListeningRef.current;
			setIsListening(false);
			isListeningRef.current = false;

			// Auto-restart IFF user still intends to keep listening
			if (desiredListeningRef.current) {
				// Check retry limit before attempting restart
				if (retryCountRef.current >= maxRetryAttempts) {
					console.error(
						`[Speech] Maximum retry attempts (${maxRetryAttempts}) reached. Stopping auto-restart.`,
					);
					desiredListeningRef.current = false;
					setError("Maximum retry attempts reached");
					retryCountRef.current = 0; // Reset for next manual start
					return;
				}

				retryCountRef.current += 1;
				console.log(
					`[Speech] Auto-restarting recognition for continuous listening (attempt ${retryCountRef.current}/${maxRetryAttempts})`,
				);
				// Clear any prior restart timer before scheduling a new one
				if (restartTimeoutRef.current !== null) {
					clearTimeout(restartTimeoutRef.current);
					restartTimeoutRef.current = null;
				}
				restartTimeoutRef.current = window.setTimeout(() => {
					// Only restart if user still intends to listen and recognition is not already running
					if (
						recognitionRef.current &&
						desiredListeningRef.current === true &&
						!isListeningRef.current
					) {
						try {
							recognitionRef.current.start();
							// Reset retry count on successful restart
							retryCountRef.current = 0;
						} catch (err) {
							console.error("[Speech] Auto-restart failed:", err);
							// Retry count will increment again on next onend
						}
					}
				}, 100);
			} else {
				// Reset retry count when user stops listening
				retryCountRef.current = 0;
			}
		};

		recognitionRef.current = recognition;

		return () => {
			// Prevent any further auto-restarts
			desiredListeningRef.current = false;
			// Reset retry count
			retryCountRef.current = 0;
			// Clear pending timers
			if (restartTimeoutRef.current !== null) {
				clearTimeout(restartTimeoutRef.current);
				restartTimeoutRef.current = null;
			}
			if (clearTextTimeoutRef.current !== null) {
				clearTimeout(clearTextTimeoutRef.current);
				clearTextTimeoutRef.current = null;
			}
			if (recognitionRef.current) {
				// Null out handlers to break references for GC and avoid callbacks after unmount
				recognitionRef.current.onstart = null;
				recognitionRef.current.onresult = null;
				recognitionRef.current.onerror = null;
				recognitionRef.current.onaudioend = null;
				recognitionRef.current.onend = null;
				recognitionRef.current.abort();
				recognitionRef.current = null;
			}
		};
	}, []);

	// Start listening
	const startListening = useCallback(() => {
		if (!recognitionRef.current || !supported) {
			console.warn("[Speech] Cannot start - not supported");
			return;
		}

		// Use ref for critical state check to avoid race conditions
		if (isListeningRef.current) {
			console.warn("[Speech] Already listening");
			return;
		}

		try {
			desiredListeningRef.current = true;
			// Reset retry count on manual start
			retryCountRef.current = 0;
			// Clear processed results for new session
			processedResultsRef.current.clear();
			recognitionRef.current.start();
		} catch (err) {
			console.error("[Speech] Start error:", err);
			setError("Failed to start");
			isListeningRef.current = false;
			desiredListeningRef.current = false;
		}
	}, [supported]);

	// Stop listening
	const stopListening = useCallback(() => {
		if (!recognitionRef.current) return;

		// Use ref for critical state check to avoid race conditions
		if (!isListeningRef.current) {
			console.warn("[Speech] Not listening");
			return;
		}

		try {
			// User no longer intends to listen; prevent auto-restart
			desiredListeningRef.current = false;
			isListeningRef.current = false;
			recognitionRef.current.stop();

			// Clear any existing clear-text timeout before setting a new one
			if (clearTextTimeoutRef.current !== null) {
				clearTimeout(clearTextTimeoutRef.current);
				clearTextTimeoutRef.current = null;
			}

			// Clear transcript after a delay to prevent accumulation across sessions
			// Store timeout in ref for proper cleanup
			clearTextTimeoutRef.current = window.setTimeout(() => {
				setTranscript("");
				setInterimTranscript("");
				clearTextTimeoutRef.current = null;
			}, 500);
		} catch (err) {
			console.error("[Speech] Stop error:", err);
		}
	}, []);

	// Reset transcript
	const resetTranscript = useCallback(() => {
		setTranscript("");
		setInterimTranscript("");
		setError(null);
	}, []);

	return {
		isListening,
		transcript,
		interimTranscript,
		startListening,
		stopListening,
		resetTranscript,
		supported,
		error,
	};
}
