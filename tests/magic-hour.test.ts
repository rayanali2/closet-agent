import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { Client } from "magic-hour";
import { createTryOn, getTryOn, logMagicHourError } from "../src/lib/magic-hour.ts";
import { garments } from "../src/lib/wardrobe-agent.ts";

test("official SDK: uploads bytes, submits exact payload once, and polls the same project", async (t) => {
  let baseUrl = "";
  let status = "queued";
  let createStatus = 200;
  const requests: { method: string; url: string; body: Buffer; authorization?: string }[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks);
    requests.push({ method: request.method!, url: request.url!, body, authorization: request.headers.authorization });
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/v1/files/upload-urls") {
      response.end(JSON.stringify({ items: ["person", "garment"].map((name) => ({
        upload_url: `${baseUrl}/upload/${name}`, file_path: `api-assets/test/${name}.jpg`, expires_at: "2030-01-01T00:00:00Z",
      })) }));
    } else if (request.url?.startsWith("/upload/")) {
      response.end();
    } else if (request.url === "/v1/ai-clothes-changer") {
      response.statusCode = createStatus;
      response.end(JSON.stringify(createStatus === 200 ? { id: "test-project", credits_charged: 25 } : { code: "internal_server_error", message: "Fixture failure" }));
    } else if (request.url === "/v1/image-projects/test-project") {
      response.end(JSON.stringify({ id: "test-project", name: "Test", status, type: "CLOTHES_CHANGER", image_count: 1,
        created_at: "2026-01-01T00:00:00Z", enabled: true, credits_charged: 25,
        downloads: status === "complete" ? [{ url: "https://videos.magichour.ai/test/output.png?signature=preserved", expires_at: "2030-01-01T00:00:00Z" }] : [],
        error: status === "error" ? { code: "no_source_face", message: "No detectable face" } : null,
      }));
    } else { response.statusCode = 404; response.end("{}"); }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
  const client = new Client({ token: "fixture-token", baseUrl, timeout: 1000 });
  const photo = new Uint8Array(await readFile("public/demo-result.jpg"));
  const id = await createTryOn(photo, "jpg", garments[0], client);
  assert.equal(id, "test-project");
  assert.deepEqual(JSON.parse(requests.find((r) => r.url === "/v1/files/upload-urls")!.body.toString()), { items: [{ type: "image", extension: "jpg" }, { type: "image", extension: "jpg" }] });
  assert.deepEqual(requests.find((r) => r.url === "/upload/person")!.body, Buffer.from(photo));
  assert.deepEqual(requests.find((r) => r.url === "/upload/garment")!.body, await readFile("public/closet/black-overshirt.jpg"));
  assert.ok(requests.filter((r) => r.url.startsWith("/upload/")).every((r) => r.method === "PUT" && !r.authorization));
  const creation = requests.find((r) => r.url === "/v1/ai-clothes-changer")!;
  assert.equal(creation.authorization, "Bearer fixture-token");
  assert.deepEqual(JSON.parse(creation.body.toString()).assets, {
    person_file_path: "api-assets/test/person.jpg", garment_file_path: "api-assets/test/garment.jpg", garment_type: "upper_body",
  });
  assert.deepEqual(await getTryOn(id, client), { status: "queued" });
  status = "rendering";
  assert.deepEqual(await getTryOn(id, client), { status: "rendering" });
  status = "complete";
  assert.deepEqual(await getTryOn(id, client), { status: "complete", imageUrl: "https://videos.magichour.ai/test/output.png?signature=preserved" });
  assert.equal(requests.filter((r) => r.url === "/v1/ai-clothes-changer").length, 1);
  status = "error";
  await assert.rejects(getTryOn(id, client), /No detectable face/);
  status = "canceled";
  await assert.rejects(getTryOn(id, client), /canceled/);
  createStatus = 500;
  await assert.rejects(createTryOn(photo, "jpg", garments[0], client));
  assert.equal(requests.filter((r) => r.url === "/v1/ai-clothes-changer").length, 2, "failed creation is not automatically retried");
});

test("server logging redacts the actual API key", async (t) => {
  const originalKey = process.env.MAGIC_HOUR_API_KEY;
  const originalLog = console.error;
  const logs: string[] = [];
  process.env.MAGIC_HOUR_API_KEY = "private-fixture-secret";
  console.error = (...args: unknown[]) => logs.push(args.join(" "));
  t.after(() => { console.error = originalLog; if (originalKey === undefined) delete process.env.MAGIC_HOUR_API_KEY; else process.env.MAGIC_HOUR_API_KEY = originalKey; });
  await logMagicHourError(new Error("Failed private-fixture-secret Bearer another-secret"));
  assert.equal(logs.length, 1);
  assert.ok(!logs[0].includes("private-fixture-secret"));
  assert.ok(!logs[0].includes("another-secret"));
  assert.match(logs[0], /REDACTED/);
});
