# Log

## 2026-11-18

- **Sync module added, version 0.2.0**: `src/sync/` with the record merge (newest wins, tombstones, symmetric and idempotent), places and the combined view, the plain place document, the encrypted envelope, the storage adapter types and `planSync`; new public exports `mergeRecords`, `mergePlace`, `combinePlaces`, `parseDocument`, `buildDocument`, `parseEnvelope`, `buildEnvelope`, `envelopeAad`, `planSync`, `instantMs`, `DOCUMENT_FORMAT`, `DOCUMENT_VERSION`, `ENVELOPE_FORMAT`, `ENVELOPE_VERSION` and their types. Vectors in `vectors/sync/`. See [sync](sync.md).
- **Repository set up and the general model moved in** (#1): `ingredients/`, `templates/`, `specs/`, `stock/` and `shelf/` copied unchanged from Mixtura's engine (after its extraction steps 1 to 7), with an explicit public entry, the purity rule and its test, vectors, CI with a check that installs the package the way the apps do, and Dependabot. No unit system: amounts stay in Mixtura. See [modules](modules.md) and [development](development.md).
