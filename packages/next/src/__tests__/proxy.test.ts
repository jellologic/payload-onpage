import { describe, expect, it } from "bun:test";
import { NextRequest } from "next/server.js";
import { withOnPagePath } from "../proxy.ts";

const req = (path: string, cookie: string) => new NextRequest(`http://site.test${path}`, { headers: { cookie } });

describe("withOnPagePath", () => {
  const viewer = "__prerender_bypass=abc; onpage=view; onpage_link=%2F; theme=dark";

  it("passes the request path", () => {
    expect(withOnPagePath(req("/about", "")).get("x-onpage-path")).toBe("/about");
  });
  it("keeps draft mode on the shared page", () => {
    expect(withOnPagePath(req("/", viewer)).get("cookie")).toContain("__prerender_bypass=abc");
  });
  it("drops draft mode for a link viewer anywhere else", () => {
    const cookie = withOnPagePath(req("/products/x", viewer)).get("cookie")!;
    expect(cookie).not.toContain("__prerender_bypass");
    expect(cookie).not.toContain("onpage=view");
    expect(cookie).toContain("theme=dark");
  });
  it("leaves the plugin's endpoints alone (exit needs the cookies)", () => {
    expect(withOnPagePath(req("/api/onpage/exit", viewer)).get("cookie")).toContain("__prerender_bypass");
  });
  it("never touches editors (no link cookie)", () => {
    const editor = "__prerender_bypass=abc; onpage=edit";
    expect(withOnPagePath(req("/anything", editor)).get("cookie")).toBe(editor);
  });
});
