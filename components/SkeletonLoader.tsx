import type React from "react";
import styles from "./SkeletonLoader.module.css";

interface SkeletonLoaderProps {
	type?: "lines" | "card" | "header";
	lines?: number;
	showHeader?: boolean;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
	type = "lines",
	lines = 3,
	showHeader = false,
}) => {
	if (type === "card") {
		return (
			<div className={styles.skeletonContainer}>
				{showHeader && <div className={styles.skeletonHeader} />}
				<div className={styles.skeletonBlock} />
				<div className={`${styles.skeletonLine} ${styles.width80}`} />
				<div className={`${styles.skeletonLine} ${styles.width100}`} />
				<div className={`${styles.skeletonLine} ${styles.width60}`} />
			</div>
		);
	}

	return (
		<div className={styles.skeletonContainer}>
			{showHeader && <div className={styles.skeletonHeader} />}
			{Array.from({ length: lines }, (_, i) => {
				const lineId = `skeleton-line-${type}-${i}-${lines}`;
				return (
					<div
						key={lineId}
						className={`${styles.skeletonLine} ${
							i === 0
								? styles.width80
								: i === lines - 1
									? styles.width60
									: styles.width100
						}`}
					/>
				);
			})}
		</div>
	);
};

// Individual components for specific use cases
export const SkeletonLineLoader: React.FC<{
	width?: string;
	height?: string;
}> = ({ width, height }) => (
	<div
		className={styles.skeletonLine}
		style={{ width: width || "100%", height: height || "14px" }}
	/>
);

export const SkeletonCardLoader: React.FC = () => (
	<div className={styles.skeletonContainer}>
		<div className={styles.skeletonHeader} />
		<div className={styles.skeletonBlock} />
		<div className={`${styles.skeletonLine} ${styles.width90}`} />
		<div className={`${styles.skeletonLine} ${styles.width70}`} />
	</div>
);

export default SkeletonLoader;
