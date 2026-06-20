import { Role } from '../types';

export type Permission = 'none' | 'view' | 'full';

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Record<string, Permission>> = {
  ADMIN_GENERAL: {
    dashboard: 'full', analysis: 'full', inventory: 'full', locations: 'full',
    operations: 'full', adjustments: 'full', 'purchase-orders': 'full',
    history: 'full', contacts: 'full', reports: 'full', labels: 'full',
    'warehouse-map': 'full', users: 'full', 'operation-history': 'full',
    reservations: 'full', 'odoo-stock': 'full',
  },
  CEO: {
    dashboard: 'full', analysis: 'full', inventory: 'full', locations: 'full',
    operations: 'full', adjustments: 'full', 'purchase-orders': 'full',
    history: 'view', contacts: 'full', reports: 'full', labels: 'view',
    'warehouse-map': 'view', users: 'view', 'operation-history': 'none',
    reservations: 'full', 'odoo-stock': 'full',
  },
  ADMINISTRADOR: {
    dashboard: 'full', analysis: 'full', inventory: 'full', locations: 'full',
    operations: 'full', adjustments: 'full', 'purchase-orders': 'full',
    history: 'view', contacts: 'full', reports: 'full', labels: 'view',
    'warehouse-map': 'view', users: 'view', 'operation-history': 'none',
    reservations: 'full', 'odoo-stock': 'full',
  },
  JEFE_ALMACEN: {
    dashboard: 'view', analysis: 'view', inventory: 'full', locations: 'full',
    operations: 'full', adjustments: 'full', 'purchase-orders': 'none',
    history: 'full', contacts: 'view', reports: 'view', labels: 'none',
    'warehouse-map': 'none', users: 'none', 'operation-history': 'none',
    reservations: 'full', 'odoo-stock': 'view',
  },
  DESPACHADOR: {
    dashboard: 'view', analysis: 'none', inventory: 'view', locations: 'view',
    operations: 'full', adjustments: 'none', 'purchase-orders': 'none',
    history: 'view', contacts: 'view', reports: 'none', labels: 'full',
    'warehouse-map': 'view', users: 'none', 'operation-history': 'none',
    reservations: 'full', 'odoo-stock': 'none',
  },
};

export const ROLE_PERMISSIONS = DEFAULT_ROLE_PERMISSIONS;

export const canView = (role: Role, tab: string, perms?: Record<Role, Record<string, Permission>>): boolean =>
  ((perms ?? DEFAULT_ROLE_PERMISSIONS)[role]?.[tab] ?? 'none') !== 'none';

export const canEdit = (role: Role, tab: string, perms?: Record<Role, Record<string, Permission>>): boolean =>
  ((perms ?? DEFAULT_ROLE_PERMISSIONS)[role]?.[tab] ?? 'none') === 'full';
