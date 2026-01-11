export interface SocketEvents {
	// Client to server events
	mcp_request: (data: {
		method: string;
		params: Record<string, unknown>;
		requestId: string;
	}) => void;

	user_response: (data: {
		requestId: string;
		response: unknown;
	}) => void;

	update_config: (data: {
		configId: string;
		updates: Record<string, unknown>;
	}) => void;

	get_queue_status: () => void;

	// Server to client events
	mcp_response: (data: {
		requestId: string;
		response: unknown;
	}) => void;

	mcp_error: (data: {
		requestId: string;
		error: string;
	}) => void;

	request_queued: (data: {
		requestId: string;
		method: string;
		queueLength: number;
	}) => void;

	queue_status: (data: {
		queueLength: number;
		nextRequest: { method: string; requestId: string } | null;
	}) => void;

	human_question: (data: {
		requestId: string;
		question: string;
		userId: string;
		timestamp: number;
	}) => void;

	config_updated: (data: {
		configId: string;
	}) => void;

	config_error: (data: {
		error: string;
	}) => void;

	response_sent: (data: {
		requestId: string;
	}) => void;

	error: (data: {
		message: string;
	}) => void;
}
