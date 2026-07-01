import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { KnowledgeDocumentParserError } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-document-text-extractor.ts";
import { RuntimeKnowledgeDocumentTextExtractor } from "@vcp/backend/modules/knowledge-base-rag/infrastructure/knowledge-document-text-extractor.ts";
import { LocalKnowledgeFileStorage } from "@vcp/backend/modules/knowledge-base-rag/infrastructure/local-knowledge-file-storage.ts";
import { StoredKnowledgeDocumentContentReader } from "@vcp/backend/modules/knowledge-base-rag/infrastructure/stored-knowledge-document-content-reader.ts";

const TXT = "text/plain";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF = "application/pdf";
const extractor = new RuntimeKnowledgeDocumentTextExtractor();

await testTxtExtraction();
await testDocxExtraction();
await testPdfExtraction();
await testSafeFailures();
await testStoredDocumentIntegration();

console.log("knowledge-base-rag document extraction checks passed");

async function testTxtExtraction() {
  const result = await extract(
    TXT,
    "notes.txt",
    Buffer.from("  First\tline.\r\n\r\n\r\n Second   paragraph.  ")
  );

  assert.equal(result.text, "First line.\n\nSecond paragraph.");
  assert.equal(result.characterCount, result.text.length);
  assert.deepEqual(result.attribution, {
    workspaceId: "workspace-a",
    documentId: "document-a",
    fileName: "notes.txt",
    mediaType: TXT
  });

  await assertParserFailure(TXT, "empty.txt", Buffer.from(" \n\t "), "empty");
  await assertParserFailure(TXT, "null.txt", Buffer.from([65, 0, 66]), "invalid");
  await assertParserFailure(TXT, "invalid.txt", Buffer.from([0xc3, 0x28]), "invalid");
}

async function testDocxExtraction() {
  const result = await extract(
    DOCX,
    "handbook.docx",
    createDocx(["Employee handbook", "Escalation procedure"])
  );
  assert.equal(result.text, "Employee handbook\n\nEscalation procedure");

  await assertParserFailure(DOCX, "corrupt.docx", Buffer.from("not a zip"), "failed");
  await assertParserFailure(DOCX, "empty.docx", createDocx([]), "empty");
}

async function testPdfExtraction() {
  const result = await extract(PDF, "policy.pdf", createPdf("Remote work policy"));
  assert.match(result.text, /Remote work policy/);

  await assertParserFailure(PDF, "corrupt.pdf", Buffer.from("%PDF-corrupt"), "failed");
  await assertParserFailure(PDF, "empty.pdf", createPdf(""), "empty");
}

async function testSafeFailures() {
  await assertParserFailure(
    "application/octet-stream",
    "../../private.bin",
    Buffer.from("storageKey=/private/path secret token raw XML"),
    "unsupported"
  );

  try {
    await extract(DOCX, "private.docx", Buffer.from("privateUrl /tmp/secret.docx"));
    assert.fail("corrupt DOCX should fail");
  } catch (error) {
    assert.ok(error instanceof KnowledgeDocumentParserError);
    const serialized = JSON.stringify({
      name: error.name,
      code: error.errorCode,
      message: error.message
    });
    for (const forbidden of [
      "storageKey",
      "privateUrl",
      "/tmp/secret.docx",
      "raw XML",
      "token"
    ]) {
      assert.equal(serialized.includes(forbidden), false);
    }
    assert.equal("cause" in error, false);
  }
}

async function testStoredDocumentIntegration() {
  const root = await mkdtemp(join(tmpdir(), "kb-rag-extraction-"));
  const storage = new LocalKnowledgeFileStorage(root);
  const reader = new StoredKnowledgeDocumentContentReader(storage, extractor);

  try {
    for (const candidate of [
      { mediaType: TXT, fileName: "stored.txt", content: Buffer.from("Stored TXT") },
      {
        mediaType: DOCX,
        fileName: "stored.docx",
        content: createDocx(["Stored DOCX"])
      },
      { mediaType: PDF, fileName: "stored.pdf", content: createPdf("Stored PDF") }
    ]) {
      const documentId = `document-${candidate.fileName}`;
      const stored = await storage.store({
        workspaceId: "workspace-a",
        documentId,
        fileName: candidate.fileName,
        mediaType: candidate.mediaType,
        content: candidate.content
      });
      const text = await reader.readText({
        workspaceId: "workspace-a",
        document: createDocument({
          documentId,
          fileName: candidate.fileName,
          mimeType: candidate.mediaType,
          fileType: candidate.fileName.split(".").pop(),
          storageKey: stored.storageKey
        })
      });
      assert.match(text, /Stored (TXT|DOCX|PDF)/);
    }

    await assert.rejects(
      () =>
        reader.readText({
          workspaceId: "workspace-a",
          document: createDocument({ storageKey: "missing/private/file.txt" })
        }),
      (error) =>
        error instanceof KnowledgeDocumentParserError &&
        error.errorCode === "knowledge.document_storage_read_failed" &&
        !error.message.includes("missing/private/file.txt")
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function extract(mediaType, fileName, content) {
  return extractor.extract({
    content,
    attribution: {
      workspaceId: "workspace-a",
      documentId: "document-a",
      fileName,
      mediaType
    }
  });
}

async function assertParserFailure(mediaType, fileName, content, codeFragment) {
  await assert.rejects(
    () => extract(mediaType, fileName, content),
    (error) =>
      error instanceof KnowledgeDocumentParserError &&
      error.errorCode.includes(codeFragment) &&
      !error.message.includes(fileName)
  );
}

function createDocument(overrides = {}) {
  return {
    documentId: "document-a",
    workspaceId: "workspace-a",
    uploadedByUserId: "user-a",
    displayName: "Document",
    fileName: "document.txt",
    mimeType: TXT,
    fileType: "txt",
    sizeBytes: 10,
    sourceType: "upload",
    status: "pending",
    ingestionStatus: "pending",
    indexingStatus: "pending",
    chunkCount: 0,
    indexedChunkCount: 0,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides
  };
}

function createDocx(paragraphs) {
  const documentXml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
    "<w:body>",
    ...paragraphs.map(
      (text) => `<w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p>`
    ),
    "</w:body></w:document>"
  ].join("");
  return createZip([
    {
      name: "[Content_Types].xml",
      data:
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        "</Types>"
    },
    {
      name: "_rels/.rels",
      data:
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        "</Relationships>"
    },
    { name: "word/document.xml", data: documentXml }
  ]);
}

function createZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const data = Buffer.from(entry.data);
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }

  const directory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, directory, end]);
}

function createPdf(text) {
  const escapedText = text.replace(/([\\()])/g, "\\$1");
  const stream = text ? `BT /F1 18 Tf 72 720 Td (${escapedText}) Tj ET` : "";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body);
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
