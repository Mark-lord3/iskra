import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import express from "express";
import { receiveUpload } from "../src/controllers/media-controller";
import { env } from "../src/config/env";

/**
 * A selfie from a recent phone is routinely larger than MAX_IMAGE_SIZE_MB, and
 * a picker can hand over a type outside the allowlist. Both used to reach the
 * uploader as an unactionable 500 "Unexpected server error." or as the plainly
 * untrue "Image file is required." These tests pin the honest answers.
 */
async function post(file: File) {
  const app = express();
  app.post("/upload", receiveUpload, (req, res) => {
    if (!req.file) {
      const rejected = (req as express.Request & { rejectedUpload?: string }).rejectedUpload;
      if (rejected) return res.status(415).json({ message: "unsupported" });
      return res.status(400).json({ message: "missing" });
    }
    return res.status(201).json({ bytes: req.file.size });
  });

  const server = app.listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    const body = new FormData();
    body.set("file", file);
    const response = await fetch(`http://127.0.0.1:${port}/upload`, { method: "POST", body });
    return { status: response.status, body: await response.json() as { message?: string } };
  } finally {
    server.close();
  }
}

const bytes = (mb: number) => new Uint8Array(Math.round(mb * 1024 * 1024));

test("an ordinary phone photo is accepted", async () => {
  const result = await post(new File([bytes(3)], "selfie.jpg", { type: "image/jpeg" }));
  assert.equal(result.status, 201);
});

test("HEIC straight from an iPhone is accepted", async () => {
  const result = await post(new File([bytes(5)], "IMG_0001.HEIC", { type: "image/heic" }));
  assert.equal(result.status, 201);
});

test("an oversized photo is refused with 413 and the limit, never a 500", async () => {
  const result = await post(new File([bytes(env.MAX_IMAGE_SIZE_MB + 1)], "big.jpg", { type: "image/jpeg" }));
  assert.equal(result.status, 413);
  assert.match(String(result.body.message), new RegExp(`${env.MAX_IMAGE_SIZE_MB}MB`));
});

test("an unsupported type is refused as unsupported, not as a missing file", async () => {
  for (const type of ["image/gif", "application/octet-stream", "application/pdf"]) {
    const result = await post(new File([bytes(0.001)], "x", { type }));
    assert.equal(result.status, 415, `${type} should read as unsupported`);
  }
});

test("sending no file at all still reads as a missing file", async () => {
  const app = express();
  app.post("/upload", receiveUpload, (req, res) => res.status(req.file ? 201 : 400).json({}));
  const server = app.listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/upload`, { method: "POST", body: new FormData() });
    assert.equal(response.status, 400);
  } finally {
    server.close();
  }
});
