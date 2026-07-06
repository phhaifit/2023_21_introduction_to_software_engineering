import { describe, expect, it } from "vitest";

import {
  parseGoogleDriveScopeInput,
  parseGoogleDriveScopeItem
} from "@vcp/frontend/features/knowledge-base-rag/google-drive-id.ts";

describe("Google Drive scope input", () => {
  it("accepts raw IDs and copied suffixes", () => {
    expect(parseGoogleDriveScopeItem("1RAW_file-ID")).toEqual({
      id: "1RAW_file-ID",
      kind: "file"
    });
    expect(parseGoogleDriveScopeItem("1DOC123/edit?tab=t.0")).toEqual({
      id: "1DOC123",
      kind: "file"
    });
  });

  it("normalizes Docs, Drive file, and folder URLs", () => {
    expect(
      parseGoogleDriveScopeItem(
        "https://docs.google.com/document/d/1DOC123/edit?tab=t.0"
      )
    ).toEqual({ id: "1DOC123", kind: "file" });
    expect(
      parseGoogleDriveScopeItem("https://drive.google.com/file/d/1FILE123/view")
    ).toEqual({ id: "1FILE123", kind: "file" });
    expect(
      parseGoogleDriveScopeItem(
        "https://drive.google.com/drive/folders/1FOLDER123?usp=sharing"
      )
    ).toEqual({ id: "1FOLDER123", kind: "folder" });
  });

  it("deduplicates values and rejects invalid input", () => {
    expect(parseGoogleDriveScopeInput("1FILE123\n1FILE123")).toHaveLength(1);
    expect(() => parseGoogleDriveScopeItem("")).toThrow(/valid Google Drive/);
    expect(() => parseGoogleDriveScopeItem("https://example.test/no-drive-id")).toThrow(
      /valid Google Drive/
    );
  });
});
