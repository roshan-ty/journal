import product from '../product.json' with {type:'json'};
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { emptyState } from "../shared/model.mjs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const require = createRequire(import.meta.url);
const { openStore } = require("../electron/store.cjs");
const directory = path.resolve(".local", `test-${Date.now()}`);
fs.mkdirSync(directory, { recursive: true });
test("SQLite persists state, rolls back stale writes, and retains snapshots", () => {
  const store = openStore(directory);
  const first = store.save(emptyState());
  assert.equal(first.revision, 1);
  const next = {
    ...first.state,
    settings: { ...first.state.settings, brand: "Persisted name" },
  };
  store.save(next, 1);
  assert.throws(() => store.save(emptyState(), 1), /changed/);
  store.close();
  const reopened = openStore(directory);
  assert.equal(reopened.read().state.settings.brand, "Persisted name");
  assert.equal(
    reopened.db.prepare("SELECT count(*) AS n FROM snapshots").get().n,
    1,
  );
  reopened.close();
});
test("MCP performs a real stdio handshake, lists tools, reads state, and queues sync", async () => {
  const client = new Client({ name: "journal-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve("mcp/server.mjs")],
    env: { ...process.env, [product.dataEnvironment]: directory },
    stderr: "pipe",
  });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    assert.ok(tools.tools.find((t) => t.name === "tradersyard_connect"));
    assert.ok(tools.tools.find((t) => t.name === "journal_get_metrics"));
    const result = await client.callTool({
      name: "journal_list_accounts",
      arguments: {},
    });
    assert.deepEqual(JSON.parse(result.content[0].text).accounts, []);
    const request = await client.callTool({
      name: "tradersyard_sync",
      arguments: {},
    });
    const value = JSON.parse(request.content[0].text);
    assert.equal(value.status, "pending");
    const status = await client.callTool({
      name: "journal_request_status",
      arguments: { requestId: value.requestId },
    });
    assert.equal(JSON.parse(status.content[0].text).kind, "sync");
  } finally {
    await client.close();
  }
});
