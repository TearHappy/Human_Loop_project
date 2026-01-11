import type React from "react";
import styles from "./SequentialThinkingSkeleton.module.css";

interface SequentialThinkingSkeletonProps {
	items?: number;
	showRevisionBadges?: boolean;
	showMiniBadges?: boolean;
}

export const SequentialThinkingSkeleton: React.FC<
	SequentialThinkingSkeletonProps
> = ({ items = 3, showRevisionBadges = false, showMiniBadges = false }) => {
	return (
		<div className={styles.skeletonContainer}>
			{[1, 2, 3].map((i) => (
				<div key={i} className={styles.skeletonCard}>
					{/* Header with badge placeholders */}
					<div className={styles.skeletonHeader}>
						<div className={styles.skeletonHeaderLeft}>
							{/* Main thought badge skeleton */}
							<div className={styles.skeletonThoughtBadge}>
								<div className={styles.skeletonBadgeCircle} />
								<div className={styles.skeletonBadgeText} />
							</div>

							{/* Optional revision badge skeleton for variation */}
							{showRevisionBadges && i > 1 && (
								<div className={styles.skeletonRevisionBadge}>
									<div className={styles.skeletonRevisionText} />
								</div>
							)}
						</div>

						{/* Expand/collapse indicator skeleton */}
						<div className={styles.skeletonExpandIndicator} />
					</div>

					{/* Expanded content placeholder - matching actual expanded state */}
					<div className={styles.skeletonExpandedContent}>
						<div className={styles.skeletonContentLines}>
							<div
								className={`${styles.skeletonContentLine} ${styles.width100}`}
							/>
							<div
								className={`${styles.skeletonContentLine} ${styles.width95}`}
							/>
							<div
								className={`${styles.skeletonContentLine} ${styles.width80}`}
							/>

							{/* Additional line for variation */}
							{i === 2 && (
								<div
									className={`${styles.skeletonContentLine} ${styles.width88}`}
								/>
							)}
						</div>

						{/* Mini badges at bottom for variation */}
						{showMiniBadges && i > 1 && (
							<div className={styles.skeletonMiniBadges}>
								<div
									className={`${styles.skeletonMiniBadge} ${styles.width70}`}
								/>
								<div
									className={`${styles.skeletonMiniBadge} ${styles.width90}`}
								/>
							</div>
						)}
					</div>
				</div>
			))}

			{/* Summary skeleton at bottom */}
			<div className={styles.skeletonSummary}>
				<div className={styles.skeletonSummaryLines}>
					<div className={`${styles.skeletonSummaryLine} ${styles.width128}`} />
					<div className={`${styles.skeletonSummaryLine} ${styles.width96}`} />
					<div className={`${styles.skeletonSummaryLine} ${styles.width112}`} />
					<div className={`${styles.skeletonSummaryLine} ${styles.width80}`} />
				</div>
			</div>
		</div>
	);
};

export default SequentialThinkingSkeleton;
