export function resolveRuntimeMode(demoValue?: string, backendValue?: string) {
  const demoSetting = demoValue?.trim().toLowerCase();
  const backendSetting = backendValue?.trim().toLowerCase();
  const demoMode = demoSetting === 'true' || backendSetting !== 'true';
  return {
    demoMode,
    backendEnabled: !demoMode && backendSetting === 'true',
  };
}

// Demo mode is deliberately fail-safe: it is the default and wins if both
// flags are enabled.
const runtimeMode = resolveRuntimeMode(import.meta.env.VITE_DEMO_MODE, import.meta.env.VITE_BACKEND_ENABLED);
export const DEMO_MODE = runtimeMode.demoMode;
export const BACKEND_ENABLED = runtimeMode.backendEnabled;
