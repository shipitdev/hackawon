export function isToolsPath(pathname: string, base: string): boolean {
  const tools = `${base.endsWith("/") ? base : `${base}/`}tools`;
  return pathname === tools || pathname === `${tools}/`;
}
