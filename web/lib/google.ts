/**
 * Google Docs + Drive helper for invoice PDF generation.
 * Uses raw fetch() against Google APIs — no googleapis npm package needed.
 */

const DOCS_API = "https://docs.googleapis.com/v1/documents";
const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";

function headers(accessToken: string, contentType?: string): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
  if (contentType) h["Content-Type"] = contentType;
  return h;
}

/* ---------- Internal helpers ---------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readDocument(accessToken: string, docId: string): Promise<any> {
  const res = await fetch(`${DOCS_API}/${docId}`, { headers: headers(accessToken) });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to read document: ${res.status} ${err}`);
  }
  return res.json();
}

/**
 * Sliding-window rate limiter for Google Docs write API.
 * Quota: 60 writes/min/user.  We allow bursts of up to 50 writes
 * (leaving 10 as buffer), then wait only when the window fills up.
 * A single invoice pair (~20 writes) fires with ZERO artificial delays.
 */
const QUOTA_LIMIT = 50; // stay safely under 60/min
const WINDOW_MS = 60_000;
const writeTimestamps: number[] = [];

async function waitForQuota() {
  // Purge timestamps older than 60 s
  const now = Date.now();
  while (writeTimestamps.length && writeTimestamps[0]! < now - WINDOW_MS) {
    writeTimestamps.shift();
  }
  // If at the limit, wait until the oldest write falls outside the window
  if (writeTimestamps.length >= QUOTA_LIMIT) {
    const waitMs = writeTimestamps[0]! + WINDOW_MS - now + 500; // +500ms buffer
    if (waitMs > 0) {
      console.log(`Rate limiter: pausing ${(waitMs / 1000).toFixed(1)}s (${writeTimestamps.length} writes in last 60s)`);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
  writeTimestamps.push(Date.now());
}

/** Global serial queue — prevents concurrent writes from racing. */
let writeQueue: Promise<void> = Promise.resolve();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function batchUpdateDoc(accessToken: string, docId: string, requests: any[]): Promise<void> {
  if (!requests.length) return;

  const task = writeQueue.then(async () => {
    await waitForQuota();

    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const res = await fetch(`${DOCS_API}/${docId}:batchUpdate`, {
        method: "POST",
        headers: headers(accessToken, "application/json"),
        body: JSON.stringify({ requests }),
      });
      if (res.ok) return;
      if (res.status === 429 && attempt < MAX_RETRIES) {
        const delay = 15000 * Math.pow(2, attempt); // 15s, 30s, 60s
        console.warn(`Docs API 429, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      const err = await res.text();
      throw new Error(`Docs batchUpdate failed: ${res.status} ${err}`);
    }
  });

  writeQueue = task.catch(() => {});
  return task;
}

/* ---------- Public API ---------- */

/**
 * Copy a Google Doc template to create a new editable document.
 */
export async function copyTemplate(
  accessToken: string,
  templateId: string,
  title: string,
  folderId?: string
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = { name: title };
  if (folderId) {
    body.parents = [folderId];
  }

  const res = await fetch(`${DRIVE_API}/${templateId}/copy?supportsAllDrives=true`, {
    method: "POST",
    headers: headers(accessToken, "application/json"),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to copy template: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.id as string;
}

/**
 * Replace placeholder text in a Google Doc with actual values.
 * Placeholders should be in the format {{placeholder}}.
 */
export async function fillPlaceholders(
  accessToken: string,
  docId: string,
  replacements: Record<string, string>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requests: any[] = [];

  for (const [placeholder, value] of Object.entries(replacements)) {
    requests.push({
      replaceAllText: {
        containsText: {
          text: `{{${placeholder}}}`,
          matchCase: false,
        },
        replaceText: value || "",
      },
    });
  }

  if (requests.length === 0) return;

  await batchUpdateDoc(accessToken, docId, requests);
}

/**
 * Insert a dynamic table into a Google Doc.
 * Finds the {{markerName}} placeholder, removes it, and inserts a
 * fully populated table with a bold header row + one row per record.
 *
 * @param markerName  Placeholder name (e.g. 'recordsTable' → finds {{recordsTable}})
 * @param columns  Ordered list of { key, label, widthPt? } defining columns
 * @param records  Array of key→value maps (one per row)
 */
export async function insertRecordsTable(
  accessToken: string,
  docId: string,
  markerName: string,
  columns: { key: string; label: string; widthPt?: number }[],
  records: Array<Record<string, string>>
): Promise<void> {
  if (!records.length || !columns.length) return;

  // 1. Read doc to find placeholder index
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = await readDocument(accessToken, docId);
  const marker = `{{${markerName}}}`;
  let placeholderStart = -1;
  let placeholderEnd = -1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const el of doc.body.content) {
    if (!el.paragraph) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const pe of (el.paragraph.elements || [])) {
      const text: string = pe.textRun?.content || "";
      const idx = text.indexOf(marker);
      if (idx >= 0) {
        placeholderStart = pe.startIndex + idx;
        placeholderEnd = placeholderStart + marker.length;
        break;
      }
    }
    if (placeholderStart >= 0) break;
  }

  if (placeholderStart < 0) return; // placeholder not found, skip

  const numRows = records.length + 1; // header + data
  const numCols = columns.length;

  // 2. Delete placeholder text, then insert table at same position
  await batchUpdateDoc(accessToken, docId, [
    {
      deleteContentRange: {
        range: { startIndex: placeholderStart, endIndex: placeholderEnd },
      },
    },
    {
      insertTable: {
        rows: numRows,
        columns: numCols,
        location: { index: placeholderStart },
      },
    },
  ]);

  // 3. Re-read doc to get cell indices of the new table
  const doc2 = await readDocument(accessToken, docId);

  // Find the table near the original placeholder position
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tableData: any = null;
  let tableStartIndex = -1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const el of doc2.body.content) {
    if (el.table && el.startIndex >= placeholderStart - 2) {
      tableData = el.table;
      tableStartIndex = el.startIndex;
      break;
    }
  }
  if (!tableData || tableStartIndex < 0) return;

  // 4. Set column widths (if specified)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const structRequests: any[] = [];

  // Column widths
  for (let ci = 0; ci < numCols; ci++) {
    if (columns[ci].widthPt) {
      structRequests.push({
        updateTableColumnProperties: {
          tableStartLocation: { index: tableStartIndex },
          columnIndices: [ci],
          tableColumnProperties: {
            widthType: "FIXED_WIDTH",
            width: { magnitude: columns[ci].widthPt, unit: "PT" },
          },
          fields: "widthType,width",
        },
      });
    }
  }

  // Header row light gray background
  structRequests.push({
    updateTableCellStyle: {
      tableRange: {
        tableCellLocation: {
          tableStartLocation: { index: tableStartIndex },
          rowIndex: 0,
          columnIndex: 0,
        },
        rowSpan: 1,
        columnSpan: numCols,
      },
      tableCellStyle: {
        backgroundColor: {
          color: { rgbColor: { red: 0.93, green: 0.93, blue: 0.93 } },
        },
      },
      fields: "backgroundColor",
    },
  });

  // 5. Fill cells + apply structure in one batch — process from bottom-right to top-left so indices stay valid
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fillRequests: any[] = [...structRequests];

  // Data rows (bottom to top, right to left)
  for (let ri = records.length - 1; ri >= 0; ri--) {
    const row = tableData.tableRows[ri + 1]; // +1 for header row
    if (!row) continue;
    for (let ci = numCols - 1; ci >= 0; ci--) {
      const cell = row.tableCells[ci];
      if (!cell?.content?.[0]) continue;
      const startIdx = cell.content[0].startIndex;
      const value = records[ri][columns[ci].key] || "";
      if (value) {
        fillRequests.push({
          insertText: { location: { index: startIdx }, text: value },
        });
      }
    }
  }

  // Header row (right to left) — insert text then bold it
  const headerRow = tableData.tableRows[0];
  for (let ci = numCols - 1; ci >= 0; ci--) {
    const cell = headerRow.tableCells[ci];
    if (!cell?.content?.[0]) continue;
    const startIdx = cell.content[0].startIndex;
    const label = columns[ci].label;

    // Insert header label
    fillRequests.push({
      insertText: { location: { index: startIdx }, text: label },
    });
    // Bold the header label
    fillRequests.push({
      updateTextStyle: {
        range: { startIndex: startIdx, endIndex: startIdx + label.length },
        textStyle: { bold: true },
        fields: "bold",
      },
    });
  }

  await batchUpdateDoc(accessToken, docId, fillRequests);

  // 6. Center-align all cells except column 0 (Terminal Name)
  const doc3 = await readDocument(accessToken, docId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tableData3: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const el of doc3.body.content) {
    if (el.table && el.startIndex >= placeholderStart - 2) {
      tableData3 = el.table;
      break;
    }
  }

  if (tableData3) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const styleRequests: any[] = [];
    for (let ri = 0; ri < numRows; ri++) {
      const row = tableData3.tableRows[ri];
      if (!row) continue;
      for (let ci = 0; ci < numCols; ci++) {
        const cell = row.tableCells[ci];
        if (!cell?.content?.[0]) continue;
        const pStart = cell.content[0].startIndex;
        const pEnd = cell.content[cell.content.length - 1].endIndex;

        // Center-align all columns
        styleRequests.push({
          updateParagraphStyle: {
            range: { startIndex: pStart, endIndex: pEnd },
            paragraphStyle: { alignment: "CENTER" },
            fields: "alignment",
          },
        });

        // Data rows: explicitly un-bold
        if (ri > 0 && pEnd - 1 > pStart) {
          styleRequests.push({
            updateTextStyle: {
              range: { startIndex: pStart, endIndex: pEnd - 1 },
              textStyle: { bold: false },
              fields: "bold",
            },
          });
        }
      }
    }
    if (styleRequests.length) {
      await batchUpdateDoc(accessToken, docId, styleRequests);
    }
  }
}

/**
 * Export a Google Doc as PDF and return the buffer.
 */
export async function exportAsPdf(
  accessToken: string,
  docId: string
): Promise<Buffer> {
  const res = await fetch(
    `${DRIVE_API}/${docId}/export?mimeType=application/pdf`,
    {
      headers: headers(accessToken),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to export PDF: ${res.status} ${err}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Upload a PDF buffer to Google Drive and return the file's web view link.
 */
export async function uploadPdfToDrive(
  accessToken: string,
  pdfBuffer: Buffer,
  filename: string,
  folderId: string
): Promise<string> {
  // Multipart upload: metadata + PDF content
  const boundary = "invoice_pdf_boundary_" + Date.now();
  const metadata = JSON.stringify({
    name: filename,
    mimeType: "application/pdf",
    parents: [folderId],
  });

  // Build multipart body manually
  const parts = [
    `--${boundary}\r\n`,
    "Content-Type: application/json; charset=UTF-8\r\n\r\n",
    metadata,
    `\r\n--${boundary}\r\n`,
    "Content-Type: application/pdf\r\n\r\n",
  ];

  const encoder = new TextEncoder();
  const beforePdf = encoder.encode(parts.join(""));
  const afterPdf = encoder.encode(`\r\n--${boundary}--`);

  const body = Buffer.concat([
    Buffer.from(beforePdf),
    pdfBuffer,
    Buffer.from(afterPdf),
  ]);

  const res = await fetch(
    `${DRIVE_UPLOAD_API}?uploadType=multipart&supportsAllDrives=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to upload PDF: ${res.status} ${err}`);
  }

  const data = await res.json();
  return `https://drive.google.com/file/d/${data.id}/view`;
}

/**
 * Delete a Google Doc (used to clean up the filled copy after PDF export).
 */
export async function deleteDoc(
  accessToken: string,
  docId: string
): Promise<void> {
  await fetch(`${DRIVE_API}/${docId}?supportsAllDrives=true`, {
    method: "DELETE",
    headers: headers(accessToken),
  });
}

export type TableDef = {
  marker: string;
  columns: { key: string; label: string; widthPt?: number }[];
  records: Array<Record<string, string>>;
};

export type PicturesGridDef = {
  marker: string;
  title: string;
  imageUrls: string[];
};

/**
 * Insert a titled 2-column image grid into a Google Doc.
 * Finds the {{marker}} placeholder, replaces it with a styled title
 * and a borderless table containing the images.
 */
export async function insertPicturesGrid(
  accessToken: string,
  docId: string,
  grid: PicturesGridDef
): Promise<void> {
  const { marker: markerName, title, imageUrls } = grid;
  const validUrls = imageUrls.filter(u => u && u.trim());
  if (!validUrls.length) return;

  // 1. Find marker
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = await readDocument(accessToken, docId);
  const markerText = `{{${markerName}}}`;
  let phStart = -1;
  let phEnd = -1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const el of doc.body.content) {
    if (!el.paragraph) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const pe of (el.paragraph.elements || [])) {
      const text: string = pe.textRun?.content || "";
      const idx = text.indexOf(markerText);
      if (idx >= 0) {
        phStart = pe.startIndex + idx;
        phEnd = phStart + markerText.length;
        break;
      }
    }
    if (phStart >= 0) break;
  }

  if (phStart < 0) return; // marker not found

  // 2. Delete marker and insert styled title in one batch
  const titleText = `${title}\n`;
  await batchUpdateDoc(accessToken, docId, [
    { deleteContentRange: { range: { startIndex: phStart, endIndex: phEnd } } },
    { insertText: { text: titleText, location: { index: phStart } } },
    {
      updateParagraphStyle: {
        range: { startIndex: phStart, endIndex: phStart + titleText.length },
        paragraphStyle: {
          alignment: "CENTER",
          shading: {
            backgroundColor: { color: { rgbColor: { red: 0, green: 0, blue: 0 } } },
          },
        },
        fields: "alignment,shading",
      },
    },
    {
      updateTextStyle: {
        range: { startIndex: phStart, endIndex: phStart + title.length },
        textStyle: {
          bold: true,
          fontSize: { magnitude: 16, unit: "PT" },
          foregroundColor: { color: { rgbColor: { red: 1, green: 1, blue: 1 } } },
        },
        fields: "bold,fontSize,foregroundColor",
      },
    },
  ]);

  // 4. Insert 2-column borderless table for images
  const numRows = Math.ceil(validUrls.length / 2);
  const tableInsertIdx = phStart + titleText.length;

  await batchUpdateDoc(accessToken, docId, [
    { insertTable: { rows: numRows, columns: 2, location: { index: tableInsertIdx } } },
  ]);

  // 5. Re-read doc to find table cell positions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc2 = await readDocument(accessToken, docId);
  const cellStarts: number[] = [];
  let tableStartIdx = -1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const el of doc2.body.content) {
    if (el.table && el.startIndex >= tableInsertIdx) {
      tableStartIdx = el.startIndex;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const row of el.table.tableRows) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const cell of row.tableCells) {
          const firstPara = cell.content?.[0];
          if (firstPara) {
            cellStarts.push(firstPara.startIndex);
          }
        }
      }
      break;
    }
  }

  if (!cellStarts.length) return;

  // 6. Insert images from last to first (reverse order to avoid index shifts)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imgRequests: any[] = [];
  for (let i = validUrls.length - 1; i >= 0; i--) {
    const cellIdx = cellStarts[i];
    if (cellIdx == null) continue;

    // Normalize Drive URLs to a directly fetchable format
    let uri = validUrls[i];
    const driveMatch = uri.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
      uri = `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
    }
    const openMatch = uri.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
    if (openMatch) {
      uri = `https://lh3.googleusercontent.com/d/${openMatch[1]}`;
    }

    imgRequests.push({
      insertInlineImage: {
        uri,
        location: { index: cellIdx },
        objectSize: {
          width: { magnitude: 234, unit: "PT" },
          height: { magnitude: 234, unit: "PT" },
        },
      },
    });
  }

  if (imgRequests.length) {
    try {
      await batchUpdateDoc(accessToken, docId, imgRequests);
    } catch (err) {
      console.error("Failed to insert pictures batch, trying one-by-one:", err);
      // Fallback: insert one by one, skipping failures
      for (const req of imgRequests) {
        try {
          await batchUpdateDoc(accessToken, docId, [req]);
        } catch (e) {
          console.warn("Skipping image:", (e as Error).message);
        }
      }
    }
  }

  // 7. Make table borderless
  if (tableStartIdx >= 0) {
    const noBorder = {
      color: { color: { rgbColor: { red: 1, green: 1, blue: 1 } } },
      width: { magnitude: 0, unit: "PT" },
      dashStyle: "SOLID",
    };
    try {
      await batchUpdateDoc(accessToken, docId, [{
        updateTableCellStyle: {
          tableCellStyle: {
            borderBottom: noBorder,
            borderTop: noBorder,
            borderLeft: noBorder,
            borderRight: noBorder,
          },
          tableStartLocation: { index: tableStartIdx },
          fields: "borderBottom,borderTop,borderLeft,borderRight",
        },
      }]);
    } catch {
      // Non-critical — borders remain visible but invoice still works
    }
  }
}

/**
 * Full pipeline: copy template → insert dynamic tables → insert pictures → fill placeholders → export PDF → upload → cleanup.
 * Returns the Google Drive URL of the uploaded PDF.
 */
export async function generateInvoicePdf(
  accessToken: string,
  templateId: string,
  replacements: Record<string, string>,
  pdfFilename: string,
  folderId: string,
  tables?: TableDef[],
  picturesGrids?: PicturesGridDef[]
): Promise<string> {
  // 1. Copy template to a new doc
  const docId = await copyTemplate(accessToken, templateId, `TEMP_${pdfFilename}`, folderId);

  try {
    // 2. Insert dynamic tables (if provided)
    if (tables && tables.length > 0) {
      for (const t of tables) {
        if (t.records.length > 0) {
          await insertRecordsTable(accessToken, docId, t.marker, t.columns, t.records);
        }
      }
    }

    // 3. Insert picture grids (if provided)
    if (picturesGrids && picturesGrids.length > 0) {
      for (const pg of picturesGrids) {
        if (pg.imageUrls.length > 0) {
          await insertPicturesGrid(accessToken, docId, pg);
        }
      }
    }

    // 4. Fill header-level placeholders
    await fillPlaceholders(accessToken, docId, replacements);

    // 5. Export as PDF
    const pdfBuffer = await exportAsPdf(accessToken, docId);

    // 6. Upload PDF to Drive
    const url = await uploadPdfToDrive(accessToken, pdfBuffer, pdfFilename, folderId);

    return url;
  } finally {
    // 7. Clean up the temporary filled doc
    await deleteDoc(accessToken, docId).catch(() => {});
  }
}
