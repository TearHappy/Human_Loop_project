import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeTextForTTS } from "../lib/tts-normalizer";

interface SpeakOptions {
	text: string;
	voice?: SpeechSynthesisVoice;
	rate?: number;
	pitch?: number;
	volume?: number;
}

interface UseSpeechSynthesisReturn {
	speak: (options: SpeakOptions) => void;
	cancel: () => void;
	pause: () => void;
	resume: () => void;
	speaking: boolean;
	paused: boolean;
	supported: boolean;
	voices: SpeechSynthesisVoice[];
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
	const [speaking, setSpeaking] = useState(false);
	const [paused, setPaused] = useState(false);
	const [supported, setSupported] = useState(false);
	const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
	const synthRef = useRef<SpeechSynthesis | null>(null);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Initialize speech synthesis
	useEffect(() => {
		if (typeof window !== "undefined" && "speechSynthesis" in window) {
			synthRef.current = window.speechSynthesis;
			setSupported(true);
		} else {
			setSupported(false);
		}
	}, []);

	// Load voices asynchronously (handles browser gotcha)
	const populateVoiceList = useCallback(() => {
		if (!synthRef.current) return;

		const availableVoices = synthRef.current.getVoices();
		setVoices(availableVoices);
		console.log("[TTS] Voices loaded:", availableVoices.length);
	}, []);

	useEffect(() => {
		if (!synthRef.current) return;

		// Initial load
		populateVoiceList();

		// Handle async voice loading (browser compatibility)
		if (synthRef.current.onvoiceschanged !== undefined) {
			synthRef.current.onvoiceschanged = populateVoiceList;
		}

		return () => {
			if (synthRef.current) {
				synthRef.current.onvoiceschanged = null;
			}
		};
	}, [populateVoiceList]);

	// Select best available voice based on quality and language preferences
	const selectBestVoice = useCallback(
		(availableVoices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
			// Priority order:
			// 1. Neural voices (contain "Neural" in name, en-US preferred)
			// 2. Google voices (en-US, Female preferred)
			// 3. Any en-US voice
			// 4. Any English voice (fallback)

			// 1. Neural voices with en-US preference
			const neuralVoices = availableVoices.filter(
				(v) =>
					v.name.toLowerCase().includes("neural") && v.lang.startsWith("en"),
			);
			if (neuralVoices.length > 0) {
				// Prefer en-US neural voices
				const usNeuralVoices = neuralVoices.filter((v) =>
					v.lang.startsWith("en-US"),
				);
				if (usNeuralVoices.length > 0) {
					return usNeuralVoices[0]; // Return first available US neural voice
				}
				return neuralVoices[0]; // Return first available neural voice
			}

			// 2. Google voices (en-US, Female preferred)
			const googleVoices = availableVoices.filter(
				(v) => v.name.includes("Google") && v.lang.startsWith("en-US"),
			);
			if (googleVoices.length > 0) {
				// Prefer female Google voices
				const femaleGoogleVoices = googleVoices.filter((v) =>
					v.name.toLowerCase().includes("female"),
				);
				if (femaleGoogleVoices.length > 0) {
					return femaleGoogleVoices[0];
				}
				return googleVoices[0]; // Return first available Google voice
			}

			// 3. Any en-US voice
			const usVoices = availableVoices.filter((v) =>
				v.lang.startsWith("en-US"),
			);
			if (usVoices.length > 0) {
				return usVoices[0];
			}

			// 4. Any English voice (fallback)
			const englishVoices = availableVoices.filter((v) =>
				v.lang.startsWith("en"),
			);
			if (englishVoices.length > 0) {
				return englishVoices[0];
			}

			// No suitable voice found
			return null;
		},
		[],
	);

	// Speak function
	const speak = useCallback(
		(options: SpeakOptions) => {
			if (!synthRef.current || !supported) {
				console.warn("[TTS] Speech synthesis not supported");
				return;
			}

			// CRITICAL FIX: Cancel any existing speech first
			synthRef.current.cancel();

			// Clear any existing timeout to prevent memory leaks
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}

			// CRITICAL FIX: Chrome needs a small delay after cancel before speaking
			// This is a known Chrome bug - without this delay, speak() silently fails
			timeoutRef.current = setTimeout(() => {
				if (!synthRef.current) return;

				const utterance = new SpeechSynthesisUtterance(
					normalizeTextForTTS(options.text),
				);

				// Set language to English
				utterance.lang = "en-US";

				// Set voice if provided, or select best available voice
				if (options.voice) {
					utterance.voice = options.voice;
				} else if (voices.length > 0) {
					const selectedVoice = selectBestVoice(voices);
					if (selectedVoice) {
						utterance.voice = selectedVoice;
						console.log("[TTS] Using selected voice:", selectedVoice.name);
					} else {
						console.log("[TTS] No suitable voice found. Available voices:");
						for (const v of voices) {
							console.log(`  - ${v.name} (${v.lang})`);
						}
					}
				}

				// Set optional parameters with defaults
				utterance.rate = options.rate !== undefined ? options.rate : 1.25;
				utterance.pitch = options.pitch !== undefined ? options.pitch : 1.0;
				utterance.volume = options.volume !== undefined ? options.volume : 1.0;

				// Event handlers
				utterance.onstart = () => {
					setSpeaking(true);
					console.log("[TTS] Started speaking:", options.text.substring(0, 50));
				};

				utterance.onend = () => {
					setSpeaking(false);
					console.log("[TTS] Finished speaking");
				};

				utterance.onerror = (event) => {
					setSpeaking(false);
					// Silently handle TTS errors (especially "not-allowed" on first load and "interrupted")
					if (event.error !== "not-allowed" && event.error !== "interrupted") {
						console.error("[TTS] Error:", event.error, event);
					}
				};

				// CRITICAL FIX: Speak with error handling
				try {
					synthRef.current.speak(utterance);
					console.log("[TTS] Utterance queued successfully");
				} catch (error) {
					console.error("[TTS] Failed to queue utterance:", error);
					setSpeaking(false);
				}
			}, 100); // 100ms delay is the sweet spot for Chrome reliability
		},
		[supported, voices, selectBestVoice],
	);

	// Cancel function
	const cancel = useCallback(() => {
		if (synthRef.current) {
			synthRef.current.cancel();
			setSpeaking(false);
			console.log("[TTS] Cancelled");
		}
	}, []);

	// Pause function
	const pause = useCallback(() => {
		if (synthRef.current) {
			synthRef.current.pause();
			setPaused(true);
			console.log("[TTS] Paused");
		}
	}, []);

	// Resume function
	const resume = useCallback(() => {
		if (synthRef.current) {
			synthRef.current.resume();
			setPaused(false);
			console.log("[TTS] Resumed");
		}
	}, []);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (synthRef.current) {
				synthRef.current.cancel();
			}
			// Clear any pending timeouts to prevent memory leaks
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
		};
	}, []);

	return {
		speak,
		cancel,
		pause,
		resume,
		speaking,
		paused,
		supported,
		voices,
	};
}
