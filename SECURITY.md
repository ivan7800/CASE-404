# Security Policy — CASE 404

CASE 404 is a local-first static web application. It has no backend, account system, telemetry, CDN runtime dependency or remote API integration.

## Data model

- Case data is stored in the browser with IndexedDB.
- UI preferences are stored in localStorage.
- PWA assets are stored in Cache Storage.
- Exported `.case404` and backup files can contain the complete case, including portable attachments and Evidence Board photos.

Treat exported case files as potentially sensitive documents.

## Import boundary

Imported `.case404` / JSON data is treated as untrusted input. The application:

- limits an import file to 64 MB;
- rejects packages newer than the supported format version;
- refuses non-object case entries and oversized multi-case packages;
- does not overwrite a local UUID collision silently;
- escapes user-controlled text before dynamic HTML rendering;
- whitelists dynamic Timeline state classes;
- only renders Evidence Board images from safe base64 image data URLs;
- only opens portable attachments from accepted base64 `data:` formats.

## Reporting a vulnerability

When reporting a security issue, include the affected version, reproduction steps, the smallest safe proof of concept and the expected impact. Do not include real confidential case data, credentials, tokens or personal information in a public issue.
