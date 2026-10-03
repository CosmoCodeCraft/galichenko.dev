import { site } from "../config/site";

export function canonicalPath(path: string) {
  const pathname = path.startsWith("/") ? path : `/${path}`;
  return pathname === "/" ? pathname : `${pathname.replace(/\/+$/, "")}/`;
}

export function absoluteSiteUrl(path: string) {
  return new URL(canonicalPath(path), site.url).href;
}
