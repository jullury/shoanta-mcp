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
  version: "0.2.0",
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
  "list_collections",
  {
    title: "List collections",
    description: "List all collections (databases) in the Shoanta workspace.",
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
  "list_documents",
  {
    title: "List documents",
    description: "List all documents in a collection.",
    inputSchema: {
      collectionId: z.string().describe("ID of the collection (database)"),
    },
  },
  async ({ collectionId }) => {
    const data = await api<{ documents: unknown[] }>(
      `/databases/${collectionId}/documents`,
    );
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

server.registerTool(
  "get_document",
  {
    title: "Get document",
    description: "Get a single document by ID, including its property values.",
    inputSchema: {
      documentId: z.string().describe("Document ID"),
    },
  },
  async ({ documentId }) => {
    const data = await api<unknown>(`/documents/${documentId}`);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

server.registerTool(
  "create_document",
  {
    title: "Create document",
    description: "Create a new document in a collection.",
    inputSchema: {
      collectionId: z.string().describe("ID of the collection (database)"),
      title: z.string().describe("Document title"),
      content: z.string().optional().describe("Document content (markdown)"),
      properties: propertiesSchema.optional(),
    },
  },
  async ({ collectionId, title, content, properties }) => {
    const data = await api<{ document: unknown }>(
      `/databases/${collectionId}/documents`,
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
  "update_document",
  {
    title: "Update document",
    description:
      "Update document title, content, and/or property values. Only provided fields are changed.",
    inputSchema: {
      documentId: z.string().describe("Document ID"),
      title: z.string().optional().describe("New title"),
      content: z.string().optional().describe("New content (markdown)"),
      properties: propertiesSchema.optional(),
    },
  },
  async ({ documentId, title, content, properties }) => {
    const body: Record<string, unknown> = {};
    if (title !== undefined) body.title = title;
    if (content !== undefined) body.content = content;
    if (properties !== undefined) body.properties = properties;
    const data = await api<{ document: unknown }>(`/documents/${documentId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

server.registerTool(
  "delete_document",
  {
    title: "Delete document",
    description:
      "Delete a document. If archive is true, it is moved to trash instead of being permanently deleted.",
    inputSchema: {
      documentId: z.string().describe("Document ID"),
      archive: z
        .boolean()
        .optional()
        .describe("Archive instead of hard-delete"),
    },
  },
  async ({ documentId, archive }) => {
    const qs = archive ? "?archive=true" : "";
    const data = await api<{ ok: boolean }>(`/documents/${documentId}${qs}`, {
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
    description: "List comments on a document.",
    inputSchema: {
      documentId: z.string().describe("Document ID"),
    },
  },
  async ({ documentId }) => {
    const data = await api<{ comments: unknown[] }>(
      `/documents/${documentId}/comments`,
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
    description: "Add a comment to a document.",
    inputSchema: {
      documentId: z.string().describe("Document ID"),
      body: z.string().describe("Comment body"),
    },
  },
  async ({ documentId, body }) => {
    const data = await api<{ comment: unknown }>(
      `/documents/${documentId}/comments`,
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

server.registerTool(
  "list_properties",
  {
    title: "List properties",
    description: "List all property (column) definitions for a collection.",
    inputSchema: {
      collectionId: z.string().describe("ID of the collection (database)"),
    },
  },
  async ({ collectionId }) => {
    const data = await api<unknown[]>(`/databases/${collectionId}/properties`);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

server.registerTool(
  "add_property",
  {
    title: "Add property",
    description:
      "Add a new property (column) to a collection. Type one of TEXT, NUMBER, SELECT, MULTI_SELECT, DATE, CHECKBOX, URL, FORMULA, RELATION (default TEXT). For SELECT/MULTI_SELECT, pass options as [{value, color?}].",
    inputSchema: {
      collectionId: z.string().describe("ID of the collection (database)"),
      name: z.string().describe("Property name (column header)"),
      type: z
        .enum([
          "TEXT",
          "NUMBER",
          "SELECT",
          "MULTI_SELECT",
          "DATE",
          "CHECKBOX",
          "URL",
          "FORMULA",
          "RELATION",
        ])
        .optional()
        .describe("Property type (default TEXT)"),
      options: z
        .array(
          z.object({
            value: z.string(),
            color: z.string().optional(),
          }),
        )
        .optional()
        .describe("Options for SELECT/MULTI_SELECT properties"),
    },
  },
  async ({ collectionId, name, type, options }) => {
    const body: Record<string, unknown> = { name };
    if (type !== undefined) body.type = type;
    if (options !== undefined) body.options = options;
    const data = await api<unknown>(`/databases/${collectionId}/properties`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

server.registerTool(
  "delete_property",
  {
    title: "Delete property",
    description:
      "Delete a property (column) from a collection by name. Removes the column and all its values.",
    inputSchema: {
      collectionId: z.string().describe("ID of the collection (database)"),
      name: z.string().describe("Property name (column header) to delete"),
    },
  },
  async ({ collectionId, name }) => {
    const props = await api<{ id: string; name: string }[]>(
      `/databases/${collectionId}/properties`,
    );
    const prop = props.find((p) => p.name === name);
    if (!prop) {
      throw new Error(`Property "${name}" not found in collection`);
    }
    const data = await api<{ ok: boolean }>(
      `/databases/${collectionId}/properties/${prop.id}`,
      { method: "DELETE" },
    );
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
