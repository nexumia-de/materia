---
type: Specification
title: Sync
description: The pure parts of stock sync - the record merge and its rules, places and the combined view, the plain place document, the encrypted envelope, the storage adapter port and the plan of one sync cycle, with the stated limits.
tags: [sync, merge, format, api]
generated: { by: claude-code/2.1.327, at: 2026-11-18 }
---

# Sync

The general part of "stock sync" for the apps: a user keeps records per
_place_ (for example the stock of a flat); each place can be synced as
one file in storage the user chose; the app encrypts the file. This
package holds only the pure parts: no cryptography, no base64 coding, no
requests, no clock. Code is in `src/sync/`, vectors in `vectors/sync/`
(run by `test/sync-vectors.test.ts`).

## Record merge

`mergeRecords(local, remote)` merges two lists of
`SyncRecord { key, updatedAt, deleted?: true, value? }`. `updatedAt` is a
UTC timestamp `YYYY-MM-DDThh:mm:ss[.fff]Z`, compared as time by
`instantMs` (not as text). A tombstone (`deleted: true`) has no value.

1. Per key the record with the later `updatedAt` wins, value or tombstone.
2. A key on one side only is kept.
3. Equal `updatedAt` (as time): a tombstone beats a value; two values:
   the greater canonical JSON (keys sorted, `undefined` dropped) as a
   string wins; if those are equal too, the greater `updatedAt` text
   wins (the same instant may be spelled with and without fractions).
   Identical records are no change. The result does not depend on which
   side is local.
4. Invalid records are rejected and take no part: bad `updatedAt`, empty
   or non-string key, a tombstone with a value, a non-tombstone without
   a value, `deleted` other than `true`. A `null` value is a value.
   Duplicates of a key within one side: the later one by rules 1 and 3.
5. The value is opaque: unknown fields in it are kept as they are.
   Unknown fields of the record itself are dropped.
6. Idempotent: merging the result with either input changes nothing.

The result lists `records` (sorted by plain string order of the key),
`changedLocal` (the app must store these), `changedRemote` (the file must
be written) and `rejected` (`local:<key>` or `remote:<key>`; the index
when there is no usable key). Tombstones are never removed by the merge.

## Places

`mergePlace(local, remote)`: the newest name wins, ties as above (the
greater name). The id stays the local one. A place with an unreadable
time loses against any readable one.

`combinePlaces(byPlace, ticked)` is the derived view over ticked places.
`byPlace` is a plain object from place id to that place's records (not a
`Map`, so vectors stay JSON). For every key some ticked place holds a
live record of, one entry with the holders in the order of `ticked`;
tombstones, invalid records, unticked and unknown places do not count; a
repeated id counts once; entries sorted by key. Nothing is stored.

## The document

What gets encrypted, as compact JSON (`buildDocument`, `parseDocument`):

| Field      | Meaning                                                              |
| ---------- | -------------------------------------------------------------------- |
| `format`   | `materia-place`                                                      |
| `version`  | `1`                                                                  |
| `place`    | `{ id, name, updatedAt }`, id and name text, `updatedAt` a timestamp |
| `records`  | `SyncRecord[]`, written sorted by key                                |
| `entities` | `SyncRecord[]` the records refer to, merged like records             |
| `moved`    | optional `{ at, note? }`: the place moved, members are to join again |

`parseDocument` errors: `not-json`; `not-a-document` (not an object or
another `format`); `newer-version` (a `version` number above 1, checked
before the rest, so the app can tell the user to update); `invalid` (any
other frame problem: version not 1, broken place, `records` or
`entities` not an array of objects, broken `moved`). Unknown top-level
fields are ignored. Single bad records are not an error here; the merge
rejects them. `buildDocument` writes a fixed key order (record: `key`,
`updatedAt`, `deleted`, `value`), sorts records and entities by key and
sorts the keys inside values, so equal content gives equal text.

Implementation note: the file is `document.ts`, and the result field
`document` and the error code `not-a-document` are assembled at run time,
because the bundle check (`check-dist.mjs`) rejects the bare word
"document" anywhere in the bundle, strings included.

## The envelope

The file as stored (`buildEnvelope`, `parseEnvelope`):

| Field                  | Meaning                                            |
| ---------------------- | -------------------------------------------------- |
| `format`, `version`    | `materia-sync`, `1`                                |
| `kdf.name`, `kdf.hash` | non-empty names of the key derivation and its hash |
| `kdf.iterations`       | positive integer                                   |
| `kdf.salt`             | base64, `/^[A-Za-z0-9+/]+={0,2}$/`                 |
| `cipher.name`          | non-empty                                          |
| `cipher.nonce`         | base64                                             |
| `data`                 | ciphertext, base64                                 |

Errors: `not-json`, `not-an-envelope`, `newer-version`, `invalid`, with
the same meaning as for the document. `envelopeAad` gives
`materia-sync/1`, the additional data the cipher binds to the
ciphertext. The `Cipher` port (`seal`, `open`) is a type the app fills;
`open` throws when the passphrase is wrong or the data changed, and what
is thrown is the app's choice.

## Storage adapter

Types only (`src/sync/adapter.ts`). `read(path)` gives
`{ ok: true, missing: false, body, etag }`, `{ ok: true, missing: true }`
or `{ ok: false, failure, detail? }`; narrow on `ok`, then on `missing`.
`write(path, body, ifMatch?)`: `ifMatch` is an etag the file must still
have, `null` means the file must not exist, omitted means unconditional;
it gives `{ ok: true, etag? }` or a failure. Failures: `conflict`,
`unauthorised`, `not-found`, `unreachable`, `blocked` (no answer the
page may read, for a browser CORS or a content policy), `server`.

## The plan

`planSync(local, remote)` is the pure step of one cycle. `local` is
`{ place, records, entities }`; `remote` is the parsed document or
`undefined` when there is no file yet. Records, entities and the place
are merged. The result:

- `local`, `localChanged`: what the app stores. `localChanged` is true
  when anything differs from the input, including dropped records.
- `write`: the document to write, or absent when the remote already
  equals the merge. Without a remote file it is always set.
- `moved`: set when the remote says the place moved; the merged local
  state is still returned (nothing local is lost) and nothing is
  written.
- `rejected`: as for the merge; entity entries start with `entity:`.

A remote document of another place id gives `{ error: 'other-place' }`.
After a successful write and storing `local`, a second cycle finds
nothing to do (a property test).

## Limits of this version

- "Newest wins" compares the clocks of the devices. A device with a
  wrong clock can win or lose wrongly; nothing here detects it.
- Tombstones are kept forever, so a place only grows.
