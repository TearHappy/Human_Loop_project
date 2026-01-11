import { Plus } from "lucide-react";
import type React from "react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

// ===== TYPES =====

type MenuOption = "Auto" | "Max" | "Search" | "Plan";

interface ChatInputProps {
	placeholder?: string;
	onSubmit?: (value: string) => void;
	disabled?: boolean;
	glowIntensity?: number;
	expandOnFocus?: boolean;
	animationDuration?: number;
	textColor?: string;
	backgroundOpacity?: number;
	showEffects?: boolean;
	menuOptions?: MenuOption[];
}

// ===== OPTIMIZED COMPONENT =====

export default function V0InputField({
	placeholder = "Ask Qlaus",
	onSubmit = (value: string) => console.log("Submitted:", value),
	disabled = false,
	glowIntensity = 0.4,
	expandOnFocus = true,
	animationDuration = 500,
	textColor = "#0A1217",
	backgroundOpacity = 0.15,
	showEffects = true,
	menuOptions = ["Auto", "Max", "Search", "Plan"] as MenuOption[],
}: ChatInputProps) {
	// State
	const [value, setValue] = useState("");
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [selectedOptions, setSelectedOptions] = useState<MenuOption[]>([]);

	// Refs
	const containerRef = useRef<HTMLDivElement | null>(null);
	const glowOverlayRef = useRef<HTMLDivElement | null>(null);
	const menuRef = useRef<HTMLDivElement | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const rafIdRef = useRef<number | null>(null);

	// Close menu when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setIsMenuOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	// Auto-resize textarea
	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			const scrollHeight = textareaRef.current.scrollHeight;
			const maxHeight = 22 * 4 + 16; // 4 lines max
			textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
		}
	}, []);

	// RAF-batched mouse tracking (10x faster)
	const handleMouseMove = useCallback(
		(e: React.MouseEvent) => {
			if (!showEffects || !glowOverlayRef.current || !containerRef.current)
				return;

			// Skip if RAF already scheduled
			if (rafIdRef.current) return;

			rafIdRef.current = requestAnimationFrame(() => {
				const rect = containerRef.current?.getBoundingClientRect();
				if (rect && glowOverlayRef.current) {
					const x = e.clientX - rect.left;
					const y = e.clientY - rect.top;

					// Direct DOM update - no React re-render!
					glowOverlayRef.current.style.setProperty("--glow-x", `${x}px`);
					glowOverlayRef.current.style.setProperty("--glow-y", `${y}px`);
				}
				rafIdRef.current = null;
			});
		},
		[showEffects],
	);

	const handleMouseEnter = useCallback(() => {
		if (glowOverlayRef.current) {
			glowOverlayRef.current.style.setProperty("--glow-opacity", "1");
		}
	}, []);

	const handleMouseLeave = useCallback(() => {
		if (glowOverlayRef.current) {
			glowOverlayRef.current.style.setProperty("--glow-opacity", "0");
		}
	}, []);

	// Handle submit
	const handleSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();
			if (value.trim() && onSubmit && !disabled) {
				onSubmit(value.trim());
				setValue("");
				setSelectedOptions([]);
			}
		},
		[value, onSubmit, disabled],
	);

	// Handle key down
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSubmit(e as React.FormEvent);
			}
		},
		[handleSubmit],
	);

	const toggleMenu = useCallback(() => setIsMenuOpen((prev) => !prev), []);

	const selectOption = useCallback((option: MenuOption) => {
		setSelectedOptions((prev) =>
			prev.includes(option) ? prev : [...prev, option],
		);
		setIsMenuOpen(false);
	}, []);

	const removeOption = useCallback((option: MenuOption) => {
		setSelectedOptions((prev) => prev.filter((opt) => opt !== option));
	}, []);

	const isSubmitDisabled = disabled || !value.trim();
	const hasModeSelected = selectedOptions.length > 0;
	const shouldExpandOnFocus = expandOnFocus && !hasModeSelected;
	const baseWidth = hasModeSelected ? "24rem" : "14rem";
	const focusWidth = shouldExpandOnFocus ? "24rem" : "14rem";

	return (
		<form
			onSubmit={handleSubmit}
			style={{
				position: "sticky",
				bottom: "1rem",
				left: "50%",
				transform: "translateX(-50%)",
				zIndex: 50,
				margin: "0 auto",
				minHeight: "3rem",
				width: baseWidth,
				transition: `all ${animationDuration}ms ease`,
			}}
			onFocus={(e) => {
				if (
					shouldExpandOnFocus &&
					e.currentTarget === e.target.closest("form")
				) {
					e.currentTarget.style.width = focusWidth;
				}
			}}
			onBlur={(e) => {
				if (
					shouldExpandOnFocus &&
					!e.currentTarget.contains(e.relatedTarget as Node)
				) {
					e.currentTarget.style.width = baseWidth;
				}
			}}
		>
			<div
				ref={containerRef}
				onMouseMove={handleMouseMove}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				style={{
					position: "relative",
					display: "flex",
					flexDirection: "column",
					width: "100%",
					minHeight: "100%",
					background: `rgba(255, 255, 255, ${backgroundOpacity})`,
					backdropFilter: "blur(16px)",
					boxShadow:
						"0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
					borderRadius: "1.5rem",
					padding: "0.5rem",
					overflow: "visible",
					transition: `all ${animationDuration}ms ease`,
				}}
			>
				{/* GPU-accelerated glow overlay (CSS mask) */}
				{showEffects && (
					<div
						ref={glowOverlayRef}
						style={
							{
								position: "absolute",
								inset: 0,
								borderRadius: "1.5rem",
								pointerEvents: "none",
								transition: "opacity 300ms ease",
								boxShadow: `
                0 0 0 1px rgba(147, 51, 234, ${0.2 * glowIntensity}),
                0 0 8px rgba(147, 51, 234, ${0.3 * glowIntensity}),
                0 0 16px rgba(236, 72, 153, ${0.2 * glowIntensity}),
                0 0 24px rgba(59, 130, 246, ${0.15 * glowIntensity})
              `,
								willChange: "opacity",
								opacity: "var(--glow-opacity, 0)",
								// @ts-ignore CSS variables
								"--glow-x": "50%",
								"--glow-y": "50%",
								"--glow-opacity": "0",
							} as React.CSSProperties
						}
						className="glow-overlay"
					/>
				)}

				{/* CSS-only gradient mask overlay */}
				{showEffects && (
					<style
						// biome-ignore lint/security/noDangerouslySetInnerHtml: Safe CSS content for glow effects
						dangerouslySetInnerHTML={{
							__html: `
            .glow-overlay::after {
              content: '';
              position: absolute;
              inset: 0;
              border-radius: 1.5rem;
              opacity: var(--glow-opacity, 0);
              mask: radial-gradient(
                circle 120px at var(--glow-x) var(--glow-y),
                rgba(147,51,234,0.08) 0%,
                rgba(236,72,153,0.05) 30%,
                rgba(59,130,246,0.04) 60%,
                transparent 100%
              );
              background: linear-gradient(135deg, #9333ea, #ec4899, #3b82f6);
              pointer-events: none;
              will-change: mask;
              transition: opacity 300ms ease;
            }
            textarea.v0-textarea {
              background: transparent !important;
              background-color: transparent !important;
            }
            textarea.v0-textarea:focus {
              background: transparent !important;
              background-color: transparent !important;
            }
            textarea.v0-textarea::placeholder {
              color: #D1D5DB !important;
              opacity: 1;
            }
            textarea.v0-textarea:-webkit-autofill,
            textarea.v0-textarea:-webkit-autofill:hover,
            textarea.v0-textarea:-webkit-autofill:focus,
            textarea.v0-textarea:-webkit-autofill:active {
              -webkit-text-fill-color: ${textColor} !important;
              -webkit-box-shadow: 0 0 0px 1000px transparent inset !important;
              box-shadow: 0 0 0px 1000px transparent inset !important;
              background-color: transparent !important;
              background: transparent !important;
              transition: background-color 5000s ease-in-out 0s;
            }
          `,
						}}
					/>
				)}

				{/* Input row */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						position: "relative",
						zIndex: 20,
					}}
				>
					{/* Menu button */}
					<div ref={menuRef} style={{ position: "relative" }}>
						<button
							type="button"
							onClick={toggleMenu}
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								width: "2rem",
								height: "2rem",
								borderRadius: "50%",
								background: `rgba(${textColor === "#0A1217" ? "10, 18, 23" : "255, 255, 255"}, 0.1)`,
								border: "none",
								color: textColor,
								margin: "0 0.25rem",
								cursor: "pointer",
								transition: "all 0.2s ease",
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.background = `rgba(${textColor === "#0A1217" ? "10, 18, 23" : "255, 255, 255"}, 0.2)`;
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.background = `rgba(${textColor === "#0A1217" ? "10, 18, 23" : "255, 255, 255"}, 0.1)`;
							}}
						>
							<Plus size={16} />
						</button>

						{/* Options menu */}
						{isMenuOpen && (
							<div
								style={{
									position: "absolute",
									top: "100%",
									left: 0,
									marginTop: "0.25rem",
									background: "white",
									borderRadius: "0.5rem",
									boxShadow:
										"0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
									overflow: "hidden",
									zIndex: 30,
									minWidth: "120px",
								}}
							>
								<ul
									style={{ listStyle: "none", padding: "0.25rem 0", margin: 0 }}
								>
									{menuOptions.map((option) => (
										<button
											type="button"
											key={option}
											onClick={() => selectOption(option)}
											style={{
												width: "100%",
												border: "none",
												background: "transparent",
												textAlign: "left",
												padding: "0.5rem 1rem",
												color: textColor,
												fontSize: "0.875rem",
												fontWeight: 500,
												fontFamily: '"Inter", sans-serif',
												cursor: "pointer",
												transition: "background-color 0.2s ease",
											}}
											onMouseEnter={(e) => {
												e.currentTarget.style.backgroundColor = "#f3f4f6";
											}}
											onMouseLeave={(e) => {
												e.currentTarget.style.backgroundColor = "transparent";
											}}
										>
											{option}
										</button>
									))}
								</ul>
							</div>
						)}
					</div>

					{/* Input area */}
					<div
						style={{
							flex: 1,
							position: "relative",
							height: "100%",
							display: "flex",
							alignItems: "center",
						}}
					>
						<textarea
							ref={textareaRef}
							value={value}
							onChange={(e) => setValue(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder={placeholder}
							rows={1}
							disabled={disabled}
							className="v0-textarea"
							style={{
								width: "100%",
								minHeight: "2rem",
								maxHeight: "6rem",
								background: "transparent",
								backgroundColor: "transparent",
								color: textColor,
								fontSize: "0.875rem",
								fontWeight: 400,
								fontFamily: '"Inter", sans-serif',
								letterSpacing: "-0.014px",
								lineHeight: "22px",
								textAlign: "left",
								alignSelf: "center",
								border: "none",
								outline: "none",
								padding: "0.25rem 2.5rem 0.25rem 0.75rem",
								zIndex: 20,
								position: "relative",
								resize: "none",
								overflowY: "auto",
								WebkitAppearance: "none",
								MozAppearance: "none",
								appearance: "none",
								boxShadow: "none",
							}}
						/>

						{/* Send button */}
						<button
							type="submit"
							disabled={isSubmitDisabled}
							style={{
								marginLeft: "auto",
								alignSelf: "center",
								width: "2rem",
								height: "2rem",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								borderRadius: "50%",
								border: "none",
								padding: 0,
								zIndex: 20,
								transition: "all 0.2s ease",
								cursor: isSubmitDisabled ? "not-allowed" : "pointer",
								opacity: isSubmitDisabled ? 0.4 : 0.9,
								backgroundColor: isSubmitDisabled ? "#9ca3af" : "#0a1217",
								color: "white",
							}}
							onMouseEnter={(e) => {
								if (!isSubmitDisabled) {
									e.currentTarget.style.opacity = "1";
									e.currentTarget.style.boxShadow =
										"0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)";
								}
							}}
							onMouseLeave={(e) => {
								if (!isSubmitDisabled) {
									e.currentTarget.style.opacity = "0.9";
									e.currentTarget.style.boxShadow = "none";
								}
							}}
						>
							<svg
								width="32"
								height="32"
								viewBox="0 0 32 32"
								fill="none"
								role="img"
								aria-label="Submit"
							>
								<title>Submit</title>
								<path
									d="M16 22L16 10M16 10L11 15M16 10L21 15"
									stroke="currentColor"
									strokeWidth="1.7"
									strokeLinecap="round"
									strokeLinejoin="round"
									style={{ opacity: isSubmitDisabled ? 0.5 : 1 }}
								/>
							</svg>
						</button>
					</div>
				</div>

				{/* Selected options */}
				{selectedOptions.length > 0 && (
					<div
						style={{
							display: "flex",
							flexWrap: "wrap",
							gap: "0.5rem",
							marginTop: "0.5rem",
							padding: "0 0.75rem",
							zIndex: 20,
							position: "relative",
						}}
					>
						{selectedOptions.map((option) => (
							<div
								key={option}
								style={{
									display: "flex",
									alignItems: "center",
									gap: "0.25rem",
									background: `rgba(${textColor === "#0A1217" ? "10, 18, 23" : "255, 255, 255"}, 0.1)`,
									padding: "0.25rem 0.5rem",
									borderRadius: "0.375rem",
									fontSize: "0.75rem",
									color: textColor,
									fontFamily: '"Inter", sans-serif',
								}}
							>
								<span>{option}</span>
								<button
									type="button"
									onClick={() => removeOption(option)}
									style={{
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										width: "1rem",
										height: "1rem",
										borderRadius: "50%",
										background: "transparent",
										border: "none",
										color: textColor,
										opacity: 0.7,
										cursor: "pointer",
										transition: "all 0.2s ease",
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.background = `rgba(${textColor === "#0A1217" ? "10, 18, 23" : "255, 255, 255"}, 0.2)`;
										e.currentTarget.style.opacity = "1";
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.background = "transparent";
										e.currentTarget.style.opacity = "0.7";
									}}
								>
									<svg
										width="10"
										height="10"
										viewBox="0 0 24 24"
										fill="none"
										role="img"
										aria-label="Remove option"
									>
										<title>Remove option</title>
										<path
											d="M18 6L6 18M6 6l12 12"
											stroke="currentColor"
											strokeWidth="2"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								</button>
							</div>
						))}
					</div>
				)}
			</div>
		</form>
	);
}
