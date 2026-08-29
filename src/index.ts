import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_URL = (
  process.env.SHOANTA_API_URL || "http://localhost:3000"
).replace(/\/+$/, "");
const TOKEN = process.env.SHOANTA_API_TOKEN;

if (!TOKEN) {
  console.error(
    "SHOANTA_API_TOKEN is required (create one in Shoanta workspace settings)",
  );
  process.exit(1);
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `${res.status} ${(data as { error?: string })?.error ?? res.statusText}: ${JSON.stringify(data)}`,
    );
  }
  return data as T;
}

const server = new McpServer({
  name: "shoanta",
  version: "0.1.0",
});

const propertiesSchema = z
  .record(
    z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
      z.array(z.string()),
    ]),
  )
  .describe(
    'Property values keyed by property name, e.g. {"Status":"Done","Priority":"High"}',
  );

server.registerTool(
  "list_databases",
  {
    title: "List databases",
    description: "List all databases (boards) in the Shoanta workspace.",
  },
  async () => {
    const data = await api<
      { id: string; title: string; icon: string | null; createdAt: string }[]
    >("/databases");
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

server.registerTool(
  "list_tickets",
  {
    title: "List tickets",
    description: "List all tickets (pages/cards) in a database board.",
    inputSchema: {
      databaseId: z.string().describe("ID of the database/board"),
    },
  },
  async ({ databaseId }) => {
    const data = await api<{ tickets: unknown[] }>(
      `/databases/${databaseId}/tickets`,
    );
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

server.registerTool(
  "get_ticket",
  {
    title: "Get ticket",
    description: "Get a single ticket by ID, including its property values.",
    inputSchema: {
      ticketId: z.string().describe("Ticket ID"),
    },
  },
  async ({ ticketId }) => {
    const data = await api<unknown>(`/tickets/${ticketId}`);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

server.registerTool(
  "create_ticket",
  {
    title: "Create ticket",
    description: "Create a new ticket (card) in a database board.",
    inputSchema: {
      databaseId: z.string().describe("ID of the database/board"),
      title: z.string().describe("Ticket title"),
      content: z.string().optional().describe("Ticket content (markdown)"),
      properties: propertiesSchema.optional(),
    },
  },
  async ({ databaseId, title, content, properties }) => {
    const data = await api<{ ticket: unknown }>(
      `/databases/${databaseId}/tickets`,
      {
        method: "POST",
        body: JSON.stringify({ title, content, properties }),
      },
    );
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

server.registerTool(
  "update_ticket",
  {
    title: "Update ticket",
    description:
      "Update ticket title, content, and/or property values. Only provided fields are changed.",
    inputSchema: {
      ticketId: z.string().describe("Ticket ID"),
      title: z.string().optional().describe("New title"),
      content: z.string().optional().describe("New content (markdown)"),
      properties: propertiesSchema.optional(),
    },
  },
  async ({ ticketId, title, content, properties }) => {
    const body: Record<string, unknown> = {};
    if (title !== undefined) body.title = title;
    if (content !== undefined) body.content = content;
    if (properties !== undefined) body.properties = properties;
    const data = await api<{ ticket: unknown }>(`/tickets/${ticketId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

server.registerTool(
  "delete_ticket",
  {
    title: "Delete ticket",
    description:
      "Delete a ticket. If archive is true, it is moved to trash instead of being permanently deleted.",
    inputSchema: {
      ticketId: z.string().describe("Ticket ID"),
      archive: z
        .boolean()
        .optional()
        .describe("Archive instead of hard-delete"),
    },
  },
  async ({ ticketId, archive }) => {
    const qs = archive ? "?archive=true" : "";
    const data = await api<{ ok: boolean }>(`/tickets/${ticketId}${qs}`, {
      method: "DELETE",
    });
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

server.registerTool(
  "list_comments",
  {
    title: "List comments",
    description: "List comments on a ticket.",
    inputSchema: {
      ticketId: z.string().describe("Ticket ID"),
    },
  },
  async ({ ticketId }) => {
    const data = await api<{ comments: unknown[] }>(
      `/tickets/${ticketId}/comments`,
    );
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

server.registerTool(
  "add_comment",
  {
    title: "Add comment",
    description: "Add a comment to a ticket.",
    inputSchema: {
      ticketId: z.string().describe("Ticket ID"),
      body: z.string().describe("Comment body"),
    },
  },
  async ({ ticketId, body }) => {
    const data = await api<{ comment: unknown }>(
      `/tickets/${ticketId}/comments`,
      {
        method: "POST",
        body: JSON.stringify({ body }),
      },
    );
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);