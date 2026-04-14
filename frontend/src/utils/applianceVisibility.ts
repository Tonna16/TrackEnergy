import type { Appliance } from '../context/AppContext'

export function isInactiveAppliance(app: Appliance): boolean {
  return app.active === false
}

export function isDeletedAppliance(app: Appliance): boolean {
  return app.deleted === true
}

export function isVisibleAppliance(app: Appliance, includeInactive = false): boolean {
  if (isDeletedAppliance(app)) return false
  if (!includeInactive && isInactiveAppliance(app)) return false
  return true
}

export function withVisibilityDefaults<T extends Partial<Appliance>>(app: T): T & Pick<Appliance, 'active' | 'deleted'> {
  return {
    ...app,
    active: app.active ?? true,
    deleted: app.deleted ?? false,
  }
}
