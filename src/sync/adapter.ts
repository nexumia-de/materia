// The port an app fills with its storage (a folder, WebDAV, ...). Types only:
// no request is made here (docs/sync.md#storage-adapter).

export type AdapterFailure =
  | 'conflict'
  | 'unauthorised'
  | 'not-found'
  | 'unreachable'
  // The request never got an answer the page may read (for a browser: CORS or a content policy).
  | 'blocked'
  | 'server';

/** `missing` tells the two successes apart: narrow on `ok`, then on `missing`. */
export type ReadResult =
  | { ok: true; missing: false; body: string; etag: string }
  | { ok: true; missing: true }
  | { ok: false; failure: AdapterFailure; detail?: string };

export type WriteResult =
  { ok: true; etag?: string } | { ok: false; failure: AdapterFailure; detail?: string };

export interface StorageAdapter {
  read(path: string): Promise<ReadResult>;
  /** `ifMatch`: an etag the file must still have; `null`: the file must not exist; omitted: unconditional. */
  write(path: string, body: string, ifMatch?: string | null): Promise<WriteResult>;
}
