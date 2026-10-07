import { describe, expect, test } from "bun:test";
import {
  escapeHtml,
  sanitizeCssColor,
  stripTags,
  wouldExecuteAsHtml,
  escapeForInnerHTML,
} from "./safe-html";
import {
  isSafeHref,
  isSafeImageSrc,
  safeHref,
  safeImageSrc,
  markdownUrlTransform,
} from "./safe-url";
import { scanText } from "./virus-buster";

const HTML_XSS = [
  "<img src=x onerror=alert(1)>",
  "<script>alert(1)</script>",
  '"><svg onload=alert(1)>',
  "';><svg/onload=alert(1)>",
];

describe("escapeHtml blocks executable markup", () => {
  for (const payload of HTML_XSS) {
    test(`escapes ${payload.slice(0, 40)}`, () => {
      const out = escapeHtml(payload);
      expect(out.includes("<script")).toBe(false);
      expect(out.includes("<img")).toBe(false);
      expect(out.includes("<svg")).toBe(false);
      expect(out.includes("<")).toBe(false);
      expect(wouldExecuteAsHtml(out)).toBe(false);
      expect(wouldExecuteAsHtml(payload)).toBe(true);
      expect(escapeForInnerHTML(payload)).toBe(out);
    });
  }
});

describe("safe-url blocks javascript: and data: navigations", () => {
  test("rejects javascript:", () => {
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(safeHref("javascript:alert(1)")).toBe("#");
    expect(markdownUrlTransform("javascript:alert(1)")).toBe("");
  });
  test("rejects data:text/html", () => {
    expect(isSafeHref("data:text/html,<script>alert(1)</script>")).toBe(false);
  });
  test("allows https and relative", () => {
    expect(isSafeHref("https://example.com/x")).toBe(true);
    expect(isSafeHref("/login")).toBe(true);
    expect(isSafeHref("mailto:a@b.com")).toBe(true);
  });
  test("image src allows data:image but not javascript", () => {
    expect(isSafeImageSrc("javascript:alert(1)")).toBe(false);
    expect(isSafeImageSrc("data:image/png;base64,aaa")).toBe(true);
    expect(isSafeImageSrc("https://cdn.example/a.png")).toBe(true);
    expect(safeImageSrc("javascript:alert(1)")).toBe("");
  });
});

describe("sanitizeCssColor", () => {
  test("allows hex/rgb/named", () => {
    expect(sanitizeCssColor("#ff00aa")).toBe("#ff00aa");
    expect(sanitizeCssColor("rgb(1,2,3)")).toBe("rgb(1,2,3)");
    expect(sanitizeCssColor("red")).toBe("red");
  });
  test("rejects expression/url injection", () => {
    expect(sanitizeCssColor("expression(alert(1))")).toBe("transparent");
    expect(sanitizeCssColor("url(javascript:alert(1))")).toBe("transparent");
    expect(sanitizeCssColor("red; background:url(x)")).toBe("transparent");
  });
});

describe("virus-buster scanText", () => {
  const httpXss = [
    "<img src=x onerror=alert(1)>",
    "<script>alert(1)</script>",
    "javascript:alert(1)",
    '"><svg onload=alert(1)>',
    "';><svg/onload=alert(1)>",
  ];
  for (const payload of httpXss) {
    test(`blocks ${payload.slice(0, 40)}`, () => {
      expect(scanText(payload).blocked).toBe(true);
    });
  }
  test("allows benign card names", () => {
    expect(scanText("Charizard VMAX").blocked).toBe(false);
    expect(scanText("30th Celebration Mew").blocked).toBe(false);
  });
});

describe("stripTags", () => {
  test("removes tags", () => {
    expect(stripTags("<img src=x onerror=alert(1)>hi")).toBe("hi");
  });
});
