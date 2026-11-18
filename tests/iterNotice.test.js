const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const request = require("http");
const mongoose = require("mongoose");
const app = require("../app");
const IterNotice = require("../src/models/iterNotice.model");
require("dotenv").config();

let server;
let baseUrl;

before(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (server) server.close();
  await mongoose.connection.close();
});

function httpGet(path) {
  return new Promise((resolve, reject) => {
    request.get(`${baseUrl}${path}`, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    }).on("error", reject);
  });
}

describe("ITER Notices System Tests", () => {
  test("GET /api/v1/academics/iter-notices returns Page 1 notices list", async () => {
    const res = await httpGet("/api/v1/academics/iter-notices");
    assert.strictEqual(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.success, true);
    assert.ok(Array.isArray(json.notices));
    assert.ok(json.notices.length > 0, "Should have notices synced from Page 1");
  });

  test("GET /api/v1/academics/iter-notices?category=exam filters examination circulars", async () => {
    const res = await httpGet("/api/v1/academics/iter-notices?category=exam");
    assert.strictEqual(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.success, true);
    assert.ok(Array.isArray(json.notices));
    json.notices.forEach((n) => {
      assert.strictEqual(n.category, "exam");
    });
  });

  test("GET /api/v1/academics/iter-notices/:id returns detail of specific notice", async () => {
    const notice = await IterNotice.findOne();
    assert.ok(notice, "Must have at least one notice in DB");

    const res = await httpGet(`/api/v1/academics/iter-notices/${notice.noticeId}`);
    assert.strictEqual(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.notice.noticeId, notice.noticeId);
    assert.ok(json.notice.title);
  });

  test("GET /api/v1/academics/iter-notices/:id/download serves PDF with attachment header", async () => {
    const notice = await IterNotice.findOne({ boxPreviewUrl: { $ne: "" } });
    if (!notice) return; // Skip if no notice has preview

    const res = await httpGet(`/api/v1/academics/iter-notices/${notice.noticeId}/download`);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers["content-type"], "application/pdf");
    assert.ok(res.headers["content-disposition"].includes("attachment"));
    assert.ok(res.headers["content-disposition"].includes(".pdf"));
  });
});
