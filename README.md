# Shoanta MCP Server

A **stdio-based MCP (Model Context Protocol) server** that lets any AI agent
(Claude, opencode, Cursor, Windsurf, etc.) read and update Shoanta documents
through the Shoanta REST API (`/api/v1`).

The MCP server is a thin proxy: it calls the Shoanta HTTP API using a
workspace-scoped API token, so all agents share the same auth and data.

This folder is **standalone** — copy it into any project (or keep it here) and
build it there.

## Building

```bash
cd mcp
pnpm install   # or: npm install
pnpm build     # bundles to dist/index.mjs (self-contained, no install needed at runtime)
```

The built `dist/index.mjs` inlines all dependencies, so it runs anywhere with
Node 20+.

## Configuration

The server needs two environment variables:

| Variable            | Description                                                |
| ------------------- | ---------------------------------------------------------- |
| `SHOANTA_API_URL`   | Shoanta base URL, e.g. `https://shoanta.jullury.com`       |
| `SHOANTA_API_TOKEN` | API token created in **Workspace Settings → API tokens**   |

The token is workspace-scoped, so the server derives the workspace from the
token itself — you don't need to configure a workspace slug.

Create a token in the Shoanta app, add the two values to your environment,
and run the server:

```bash
SHOANTA_API_URL=https://shoanta.jullury.com \
SHOANTA_API_TOKEN=shoanta_... \
node dist/index.mjs
```

## Tools

| Tool                   | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `list_collections`     | List all collections (databases) in the workspace |
| `list_documents`       | List all documents in a collection                |
| `get_document`         | Get one document by ID (with property values)     |
| `create_document`      | Create a document in a collection                 |
| `update_document`      | Update title, content, and/or property values     |
| `delete_document`      | Delete a document (or archive with `archive: true`) |
| `list_comments`        | List comments on a document                       |
| `add_comment`          | Add a comment to a document                       |

## Connecting an agent

Point your agent's MCP config at the built file with stdio transport.

### opencode

```jsonc
// opencode.json
{
  "mcp": {
    "Shoanta": {
      "type": "local",
      "command": ["node", "/path/to/your/project/mcp/dist/index.mjs"],
      "enabled": true,
      "environment": {
        "SHOANTA_API_URL": "https://shoanta.jullury.com",
        "SHOANTA_API_TOKEN": "shoanta_..."
      }
    }
  }
}
```

### Claude Desktop

```jsonc
// claude_desktop_config.json
{
  "mcpServers": {
    "shoanta": {
      "command": "node",
      "args": ["/path/to/your/project/mcp/dist/index.mjs"],
      "env": {
        "SHOANTA_API_URL": "https://shoanta.jullury.com",
        "SHOANTA_API_TOKEN": "shoanta_..."
      }
    }
  }
}
```

### Cursor / Windsurf

Add the server with `command: node`, args pointing to `mcp/dist/index.mjs`,
and the two environment variables set.
