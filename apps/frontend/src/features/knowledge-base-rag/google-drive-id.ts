export type ParsedGoogleDriveScopeItem = {
  id: string;
  kind: "file" | "folder";
};

const DRIVE_ID_PATTERN = /^[a-zA-Z0-9_-]{3,200}$/;

export function parseGoogleDriveScopeInput(
  value: string
): ParsedGoogleDriveScopeItem[] {
  const items = value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map(parseGoogleDriveScopeItem);
  const unique = new Map(items.map((item) => [`${item.kind}:${item.id}`, item]));
  return [...unique.values()];
}

export function parseGoogleDriveScopeItem(
  value: string
): ParsedGoogleDriveScopeItem {
  const input = value.trim();
  let id = "";
  let kind: ParsedGoogleDriveScopeItem["kind"] = "file";
  try {
    const url = new URL(input);
    kind = url.pathname.includes("/folders/") ? "folder" : "file";
    id =
      url.pathname.match(
        /\/(?:document\/d|spreadsheets\/d|presentation\/d|file\/d|drive\/folders)\/([^/]+)/
      )?.[1] ?? "";
  } catch {
    id = input.split(/[/?#]/, 1)[0] ?? "";
  }
  if (!DRIVE_ID_PATTERN.test(id)) {
    throw new Error("Enter a valid Google Drive file or folder ID or URL.");
  }
  return { id, kind };
}
