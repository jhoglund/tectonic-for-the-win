/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Mimir ingest token for the `tectonic` project. */
  readonly VITE_MIMIR_TOKEN?: string;
  /** URL the Mimir SDK script is loaded from. */
  readonly VITE_MIMIR_SCRIPT_URL?: string;
  /** URL Mimir events are POSTed to. */
  readonly VITE_MIMIR_ENDPOINT?: string;
  /** App version reported with every Mimir event. */
  readonly VITE_MIMIR_APP_VERSION?: string;
  /** Profile-sync Worker origin (no trailing slash) — enables sync when set (ADR-0020). */
  readonly VITE_SYNC_URL?: string;
  /** Bearer secret for the sync Worker — ships in the bundle (single-user, low stakes). */
  readonly VITE_SYNC_SECRET?: string;
}
