/** Request header carrying the request path, set by onpageProxy() (see ./proxy). */
export const PATH_HEADER = "x-onpage-path";
/** Says which mode ("edit" | "view") draft mode is in. */
export const MODE_COOKIE = "onpage";
/** Marks a preview-link viewer; its value is the shared page's path. */
export const LINK_COOKIE = "onpage_link";
/** Next.js's draft-mode cookie. */
export const BYPASS_COOKIE = "__prerender_bypass";

const trim = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);
export const samePath = (a: string, b: string) => trim(a) === trim(b);
export const safeDecode = (v: string) => {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
};
