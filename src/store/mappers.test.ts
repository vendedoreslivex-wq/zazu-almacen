import { describe, it, expect } from 'vitest';
import {
  dbToProduct, dbToLocation, dbToStock, dbToTx, dbToContact,
  dbToUser, dbToPO, dbToAdj, dbToSubscriber,
} from './mappers';

describe('mappers — snake_case (DB) to camelCase (TS)', () => {
  it('dbToProduct strips nulls into undefined for optional fields', () => {
    const row = {
      id: 'p1', code: 'SKU-1', name: 'Camiseta', color: null, size: null,
      category: 'Ropa', low_stock_threshold: null, cost_price: null, sell_price: null,
    };
    expect(dbToProduct(row)).toEqual({
      id: 'p1', code: 'SKU-1', name: 'Camiseta',
      color: undefined, size: undefined, category: 'Ropa',
      lowStockThreshold: undefined, costPrice: undefined, sellPrice: undefined,
    });
  });

  it('dbToLocation preserves the typed enum', () => {
    expect(dbToLocation({ id: 'L1', name: 'Rack A', type: 'RACK' })).toEqual({
      id: 'L1', name: 'Rack A', type: 'RACK',
    });
  });

  it('dbToStock maps product_id and location_id', () => {
    expect(dbToStock({ id: 'S1', product_id: 'p1', location_id: 'L1', quantity: 5 })).toEqual({
      id: 'S1', productId: 'p1', locationId: 'L1', quantity: 5,
    });
  });

  it('dbToTx maps all camelCase fields and skips nulls', () => {
    const row = {
      id: 'T1', date: '2026-05-22T10:00:00Z', type: 'RECEPTION', product_id: 'p1',
      quantity: 10, from_location_id: null, to_location_id: 'L1',
      reference: 'GR-1', user_name: 'BENJAMIN', status: 'COMPLETED',
      signature: null, contact_id: null, serial_number: null,
    };
    expect(dbToTx(row)).toMatchObject({
      id: 'T1', type: 'RECEPTION', productId: 'p1',
      fromLocationId: undefined, toLocationId: 'L1',
      reference: 'GR-1', user: 'BENJAMIN', status: 'COMPLETED',
      signature: undefined, contactId: undefined, serialNumber: undefined,
    });
  });

  it('dbToContact maps document and email', () => {
    expect(dbToContact({
      id: 'C1', type: 'SUPPLIER', name: 'Acme', document: '20123', phone: '999', email: 'x@y.z',
    })).toEqual({
      id: 'C1', type: 'SUPPLIER', name: 'Acme', document: '20123', phone: '999', email: 'x@y.z',
    });
  });

  it('dbToUser ignores stored password and exposes empty string', () => {
    const row = { id: 'u1', username: 'ADMIN', role: 'ADMIN_GENERAL', email: 'a@b.c', email_personal: 'p@b.c', active: true };
    expect(dbToUser(row)).toEqual({
      id: 'u1', username: 'ADMIN', role: 'ADMIN_GENERAL',
      password: '', email: 'a@b.c', emailPersonal: 'p@b.c', active: true,
    });
  });

  it('dbToPO maps nested purchase_order_items', () => {
    const row = {
      id: 'PO1', date: '2026-05-22', supplier_id: 'C1', status: 'APPROVED',
      reference: 'OC-001', notes: null, location_id: 'L1',
      purchase_order_items: [
        { product_id: 'p1', quantity: 10, unit_cost: 5.5, received_quantity: 0 },
        { product_id: 'p2', quantity: 3, unit_cost: 1.0, received_quantity: 3 },
      ],
    };
    const po = dbToPO(row);
    expect(po.items).toHaveLength(2);
    expect(po.items[0]).toEqual({ productId: 'p1', quantity: 10, unitCost: 5.5, receivedQuantity: 0 });
    expect(po.items[1].receivedQuantity).toBe(3);
  });

  it('dbToAdj maps user_name to user', () => {
    expect(dbToAdj({
      id: 'A1', date: '2026-05-22', product_id: 'p1', location_id: 'L1',
      previous_quantity: 10, new_quantity: 8, reason: 'DAMAGE', notes: null, user_name: 'BENJAMIN',
    })).toEqual({
      id: 'A1', date: '2026-05-22', productId: 'p1', locationId: 'L1',
      previousQuantity: 10, newQuantity: 8, reason: 'DAMAGE', notes: undefined, user: 'BENJAMIN',
    });
  });

  it('dbToSubscriber maps active boolean', () => {
    expect(dbToSubscriber({ id: 's1', name: 'Rubén', email: 'a@b.c', active: true })).toEqual({
      id: 's1', name: 'Rubén', email: 'a@b.c', active: true,
    });
  });
});
