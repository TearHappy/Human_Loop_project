"use client";

import { Switch } from "@/components/ui/switch";
import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface NotificationToggleProps {
	initialEnabled?: boolean;
}

export function NotificationToggle({
	initialEnabled = false,
}: NotificationToggleProps) {
	const [notificationsEnabled, setNotificationsEnabled] =
		useState<boolean>(initialEnabled);

	// Initialize from localStorage after mount
	useEffect(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("notificationsEnabled");
			setNotificationsEnabled(saved === "true");
		}
	}, []);

	const handleNotificationToggle = async (enabled: boolean) => {
		if (enabled && "Notification" in window) {
			if (Notification.permission !== "granted") {
				const permission = await Notification.requestPermission();
				if (permission !== "granted") {
					toast.error("Notification permission denied");
					setNotificationsEnabled(false);
					localStorage.setItem("notificationsEnabled", "false");
					return;
				}
			}
		}

		setNotificationsEnabled(enabled);
		localStorage.setItem("notificationsEnabled", enabled.toString());
		toast.success(enabled ? "Notifications enabled" : "Notifications disabled");

		// Dispatch custom event to notify parent components
		window.dispatchEvent(
			new CustomEvent("notificationPreferenceChanged", {
				detail: { enabled },
			}),
		);
	};

	return (
		<div className="flex items-center space-x-2 text-sm text-gray-600">
			{notificationsEnabled ? (
				<Bell className="h-4 w-4 text-blue-500" />
			) : (
				<BellOff className="h-4 w-4" />
			)}
			<Switch
				checked={notificationsEnabled}
				onCheckedChange={handleNotificationToggle}
				aria-label="Toggle notifications"
			/>
		</div>
	);
}
