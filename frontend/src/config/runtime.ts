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
// Production constants let Vite discard server-only imports in the default build.
export const BACKEND_ENABLED = import.meta.env.PROD ? __ENERGYIQ_BACKEND_ENABLED__ : runtimeMode.backendEnabled;
export const DEMO_MODE = import.meta.env.PROD ? !__ENERGYIQ_BACKEND_ENABLED__ : runtimeMode.demoMode;
