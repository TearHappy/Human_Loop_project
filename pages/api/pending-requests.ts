import type { NextApiRequest, NextApiResponse } from "next";
import { DatabaseService } from "../../src/lib/database";

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	if (req.method !== "GET") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	try {
		// For now, return all pending requests for mock user
		// In production, this would be filtered by authenticated user
		const userId = "mock-user-123";

		// Use the new decoded method - automatically decodes TOON params and responses
		const pendingRequests =
			DatabaseService.getPendingRequestsByUserDecoded(userId);
		console.log(
			`[API] Found ${pendingRequests.length} total requests for user ${userId}`,
		);

		// Filter only pending status
		const activePending = pendingRequests.filter(
			(req) => req.status === "pending",
		);
		console.log(`[API] Found ${activePending.length} pending requests`);

		res.status(200).json(activePending);
	} catch (error) {
		console.error("[API] Error fetching pending requests:", error);
		res.status(500).json({ error: "Failed to fetch pending requests" });
	}
}
