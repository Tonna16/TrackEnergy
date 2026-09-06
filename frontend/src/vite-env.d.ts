/// <reference types="vite/client" />
declare const __ENERGYIQ_BACKEND_ENABLED__: boolean;

interface ImportMetaEnv {
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_BACKEND_ENABLED?: string;
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
