import { describe, expect, test } from "bun:test";
import { scanText, scanRequest, scanShellCommand, BLOCK_PATTERNS } from "./virus-buster";

describe("virus-buster patterns", () => {
  test("has svg/iframe + data-html shields", () => {
    const names = BLOCK_PATTERNS.map((p) => p.name);
    expect(names).toContain("xss-svg-iframe");
    expect(names).toContain("data-html-url");
  });

  test("blocks svg onload", () => {
    expect(scanText('<svg onload=alert(1)>').blocked).toBe(true);
  });

  test("blocks iframe", () => {
    expect(scanText('<iframe src=https://evil>').blocked).toBe(true);
  });

  test("blocks data:text/html", () => {
    expect(scanText("data:text/html,<script>alert(1)</script>").blocked).toBe(true);
  });

  test("scanRequest blocks evil query", async () => {
    const req = new Request("https://x.test/api?q=<script>alert(1)</script>");
    const r = await scanRequest(req);
    expect(r.blocked).toBe(true);
  });

  test("scanRequest allows clean GET", async () => {
    const req = new Request("https://x.test/api/public/ebay-sold?q=Charizard");
    const r = await scanRequest(req);
    expect(r.blocked).toBe(false);
  });
});

describe("virus-buster shell injection", () => {
  test("blocks ; id style probe via scanText", () => {
    expect(scanText("foo; id").blocked).toBe(true);
    expect(scanText("x && curl evil").blocked).toBe(true);
  });

  test("scanShellCommand rejects metacharacters", () => {
    expect(scanShellCommand("; id").blocked).toBe(true);
    expect(scanShellCommand("$(whoami)").blocked).toBe(true);
    expect(scanShellCommand("| cat /etc/passwd").blocked).toBe(true);
    expect(scanShellCommand("`id`").blocked).toBe(true);
    expect(scanShellCommand("uptime").blocked).toBe(false);
    expect(scanShellCommand("whoami").blocked).toBe(false);
  });
});
