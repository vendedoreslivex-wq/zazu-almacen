import { describe, it, expect } from 'vitest';
import { canView, canEdit, DEFAULT_ROLE_PERMISSIONS } from './permissions';

describe('permissions', () => {
  it('ADMIN_GENERAL has full access to every module', () => {
    for (const module of Object.keys(DEFAULT_ROLE_PERMISSIONS.ADMIN_GENERAL)) {
      expect(canView('ADMIN_GENERAL', module)).toBe(true);
      expect(canEdit('ADMIN_GENERAL', module)).toBe(true);
    }
  });

  it('JEFE_ALMACEN cannot see users or warehouse-map', () => {
    expect(canView('JEFE_ALMACEN', 'users')).toBe(false);
    expect(canView('JEFE_ALMACEN', 'warehouse-map')).toBe(false);
  });

  it('JEFE_ALMACEN has full access to operations and inventory', () => {
    expect(canEdit('JEFE_ALMACEN', 'operations')).toBe(true);
    expect(canEdit('JEFE_ALMACEN', 'inventory')).toBe(true);
  });

  it('CEO and ADMINISTRADOR can only view history (not edit)', () => {
    expect(canView('CEO', 'history')).toBe(true);
    expect(canEdit('CEO', 'history')).toBe(false);
    expect(canView('ADMINISTRADOR', 'history')).toBe(true);
    expect(canEdit('ADMINISTRADOR', 'history')).toBe(false);
  });

  it('custom permissions override defaults', () => {
    const custom = {
      ...DEFAULT_ROLE_PERMISSIONS,
      JEFE_ALMACEN: { ...DEFAULT_ROLE_PERMISSIONS.JEFE_ALMACEN, users: 'view' as const },
    };
    expect(canView('JEFE_ALMACEN', 'users', custom)).toBe(true);
    expect(canEdit('JEFE_ALMACEN', 'users', custom)).toBe(false);
  });

  it('unknown module defaults to no access', () => {
    expect(canView('ADMIN_GENERAL', 'nonexistent-module')).toBe(false);
    expect(canEdit('ADMIN_GENERAL', 'nonexistent-module')).toBe(false);
  });
});
