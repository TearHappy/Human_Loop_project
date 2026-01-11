# How to Add New MCP Tools

This guide documents the complete flow for adding new MCP tools based on the `send_to_preview` implementation.

## Architecture Overview

```
AI Assistant (Cascade/Claude)
    ↓ calls tool
MCP Server (mcp-server.js)
    ↓ emits socket event
Next.js Socket API (pages/api/socket.ts)
    ↓ broadcasts to clients
React UI (ChatInterface.tsx or other components)
    ↓ updates state/context
UI Components (PreviewTab, MemoryTab, etc.)
```

## Step-by-Step Guide

### 1. Define Tool in MCP Server (`mcp-server.js`)

**Location:** `mcp-server.js` lines 104-142 (TOOLS array)

Add your tool definition:

```javascript
{
  name: 'your_tool_name',
  description: 'Clear description of what the tool does',
  inputSchema: {
    type: 'object',
    properties: {
      param1: { 
        type: 'string', 
        description: 'Description of parameter 1' 
      },
      param2: { 
        type: 'number', 
        description: 'Description of parameter 2' 
      }
    },
    required: ['param1'] // List required parameters
  }
}
```

**Example (send_to_preview):**
```javascript
{
  name: 'send_to_preview',
  description: 'Send HTML and CSS code to the Preview tab for visual rendering and editing.',
  inputSchema: {
    type: 'object',
    properties: {
      html: { 
        type: 'string', 
        description: 'HTML code (body content only, no DOCTYPE or html/head/body tags)' 
      },
      css: { 
        type: 'string', 
        description: 'CSS code (optional, can be empty string)' 
      }
    },
    required: ['html']
  }
}
```

### 2. Add Tool Handler in MCP Server

**Location:** `mcp-server.js` lines 175-198 (tool call handler)

Add your tool's execution logic:

```javascript
if (name === 'your_tool_name') {
  // Call the socket bridge method
  socket.yourMethod(args.param1, args.param2);
  
  return {
    content: [{ type: 'text', text: 'Success message to AI' }]
  };
}
```

**Example (send_to_preview):**
```javascript
if (name === 'send_to_preview') {
  console.error('[MCP] send_to_preview tool called with args:', { 
    htmlLength: args.html?.length, 
    cssLength: args.css?.length 
  });
  socket.sendToPreview(args.html, args.css || '');
  console.error('[MCP] socket.sendToPreview method called');
  return {
    content: [{ type: 'text', text: 'HTML/CSS sent to Preview tab successfully.' }]
  };
}
```

### 3. Add Socket Bridge Method in MCP Server

**Location:** `mcp-server.js` lines 32-100 (SocketBridge class)

Add a method to emit the event to Next.js:

```javascript
yourMethod(param1, param2) {
  console.error('[MCP] yourMethod called with:', param1, param2);
  console.error('[MCP] Socket connected?', this.socket.connected);
  console.error('[MCP] Socket ID:', this.socket.id);
  
  const data = { param1, param2 };
  console.error('[MCP] Data to emit:', JSON.stringify(data));
  this.socket.emit('your_event_name', data);
  
  console.error('[MCP] your_event_name event emitted');
}
```

**Example (send_to_preview):**
```javascript
sendToPreview(html, css) {
  console.error('[MCP] sendToPreview called with html length:', html?.length, 'css length:', css?.length);
  console.error('[MCP] Socket connected?', this.socket.connected);
  console.error('[MCP] Socket ID:', this.socket.id);
  console.error('[MCP] Emitting send_to_preview event...');
  
  const data = { html, css };
  console.error('[MCP] Data to emit:', JSON.stringify(data).substring(0, 200));
  this.socket.emit('send_to_preview', data);
  
  console.error('[MCP] send_to_preview event emitted');
}
```

### 4. Add Socket Listener in Next.js API

**Location:** `pages/api/socket.ts` lines 200-240 (socket connection handler)

Add a listener to receive the event from MCP bridge and broadcast to clients:

```javascript
// Broadcast your_event_name events from MCP bridge to all clients
socket.on('your_event_name', (data: any) => {
  console.log('[Socket.IO] Received your_event_name from MCP bridge:', data);
  try {
    io.emit('your_event_name', data); // Broadcast to ALL clients
    console.log('[Socket.IO] Broadcasted your_event_name to ALL clients');
  } catch (error) {
    console.error('[Socket.IO] Failed to broadcast your_event_name:', error);
  }
});
```

**Example (send_to_preview):**
```javascript
// Broadcast send_to_preview events from MCP bridge to all clients
socket.on('send_to_preview', (data: any) => {
  console.log('[Socket.IO] ========== SEND_TO_PREVIEW LISTENER TRIGGERED ==========');
  console.log('[Socket.IO] Received send_to_preview from MCP bridge:', data);
  try {
    io.emit('send_to_preview', data);
    console.log('[Socket.IO] Broadcasted send_to_preview to ALL clients');
  } catch (error) {
    console.error('[Socket.IO] Failed to broadcast send_to_preview:', error);
  }
});
```

**Important Notes:**
- Use `io.emit()` to broadcast to ALL clients (MCP bridge has no userId)
- Use `io.to('user:${userId}')` only if you have authenticated user context
- Add extensive logging for debugging

### 5. Add Client Listener in React Component

**Location:** Component that needs to handle the event (e.g., `ChatInterface.tsx`)

Add a socket listener in the useEffect that manages socket events:

```javascript
// Listen for your_event_name events
socket.on("your_event_name", (data) => {
  console.log("[Component] Received your_event_name event:", data)
  
  // Validate data
  if (data && typeof data.param1 === 'string') {
    // Update state/context
    yourUpdateFunction(data.param1, data.param2)
    console.log("[Component] yourUpdateFunction called")
  } else {
    console.error("[Component] Invalid your_event_name data:", data)
  }
})
```

**Example (send_to_preview in ChatInterface.tsx):**
```javascript
// Listen for send_to_preview events
socket.on("send_to_preview", (data) => {
  console.log("[Chat] Received send_to_preview event:", data)
  if (data && typeof data.html === 'string') {
    const css = typeof data.css === 'string' ? data.css : ''
    updatePreview(data.html, css)
    console.log("[Chat] updatePreview called with html length:", data.html.length)
  } else {
    console.error("[Chat] Invalid send_to_preview data:", data)
  }
})
```

Don't forget to add cleanup:

```javascript
return () => {
  socket.off("your_event_name")
}
```

### 6. Update Context/State (if needed)

If your tool updates shared state, create or use an existing React Context:

**Example (PreviewContext.tsx):**
```javascript
const updatePreview = (html: string, css: string) => {
  console.log('[PreviewContext] updatePreview called with:', { 
    htmlLength: html?.length, 
    cssLength: css?.length 
  });
  setHtmlContent(html);
  setCssContent(css);
};
```

### 7. Sync UI Component with Context

If you have a UI component that displays the data, sync it with the context:

**Example (PreviewTab in page.tsx):**
```javascript
const { htmlContent: contextHtml, cssContent: contextCss } = usePreview();
const [htmlContent, setHtmlContent] = useState(contextHtml || '');

useEffect(() => {
  if (typeof contextHtml === 'string' && contextHtml !== htmlContent) {
    setHtmlContent(contextHtml);
  }
}, [contextHtml]);
```

## Complete Flow Example: send_to_preview

1. **AI calls tool:** `mcp4_send_to_preview(html="<div>test</div>", css="")`
2. **MCP Server receives:** Tool handler in `mcp-server.js` line 185
3. **Socket bridge emits:** `socket.sendToPreview()` line 85 → `socket.emit('send_to_preview', data)` line 93
4. **Next.js receives:** Socket listener in `pages/api/socket.ts` line 221
5. **Broadcast to clients:** `io.emit('send_to_preview', data)` line 225
6. **ChatInterface receives:** Socket listener line 706 in `ChatInterface.tsx`
7. **Update context:** `updatePreview(data.html, css)` line 710
8. **PreviewContext updates:** `setHtmlContent(html)` line 23 in `PreviewContext.tsx`
9. **PreviewTab syncs:** useEffect detects context change line 196 in `page.tsx`
10. **UI updates:** `setHtmlContent(contextHtml)` line 198

## Common Pitfalls

### ❌ Wrong: Broadcasting to user room when MCP bridge has no userId
```javascript
io.to(`user:${socket.userId}`).emit('your_event') // userId is undefined!
```

### ✅ Correct: Broadcast to all clients
```javascript
io.emit('your_event', data)
```

### ❌ Wrong: Forgetting to add socket cleanup
```javascript
socket.on("your_event", handler)
// Missing: socket.off("your_event") in cleanup
```

### ✅ Correct: Always clean up listeners
```javascript
socket.on("your_event", handler)
return () => {
  socket.off("your_event")
}
```

### ❌ Wrong: Not validating data types
```javascript
updateFunction(data.param) // What if param is undefined?
```

### ✅ Correct: Always validate
```javascript
if (data && typeof data.param === 'string') {
  updateFunction(data.param)
}
```

## Testing Your Tool

1. **Add console.error logs** at each step (MCP server uses stderr for logs)
2. **Check browser console** for client-side logs
3. **Check terminal** running Next.js for socket.ts logs
4. **Check mcp-server logs** in `logs/mcp-server-error.log`
5. **Test with minimal data** first, then add complexity

## Tools Reference

Existing tools you can reference:
- `ask_human` - Request-response pattern with correlator
- `send_to_preview` - One-way broadcast pattern
- `sequentialthinking` - Streaming data pattern

## File Locations Summary

- **Tool definitions:** `mcp-server.js` lines 104-142
- **Tool handlers:** `mcp-server.js` lines 175-198
- **Socket bridge:** `mcp-server.js` lines 32-100
- **Next.js socket API:** `pages/api/socket.ts`
- **Client listeners:** `src/components/ChatInterface.tsx` or relevant component
- **Contexts:** `src/contexts/` directory
- **UI components:** `app/page.tsx` or `src/components/`
