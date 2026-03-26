# Configuration

## Settings

Open **Settings** (Ctrl+,) and search for "Sourcerer". The following settings are available:

### `sourcerer.apiUrl`

- **Type:** `string`
- **Default:** `https://sourcerer.genropy.net`
- **Description:** Base URL of the Sourcerer API.

### `sourcerer.token`

- **Type:** `string`
- **Default:** _(empty)_
- **Description:** Bearer authentication token. Required for API access.

### `sourcerer.cacheTtlSeconds`

- **Type:** `number`
- **Default:** `300`
- **Description:** How long API responses are cached locally (in seconds). Set to `0` to disable caching.

## Verifying the Connection

Run the command **Sourcerer: Check Connection** from the Command Palette (Ctrl+Shift+P) to verify that the extension can reach the API with your current settings.

## Settings JSON Example

```json
{
  "sourcerer.apiUrl": "https://sourcerer.genropy.net",
  "sourcerer.token": "your-token-here",
  "sourcerer.cacheTtlSeconds": 300
}
```
