import type { Product, Location, StockLevel, Transaction, Contact, Role, UserWithPassword, PurchaseOrder, PurchaseOrderItem, InventoryAdjustment, NotificationSubscriber, AuditLogEntry } from '../types';

export const dbToProduct = (r: any): Product => ({ id: r.id, code: r.code, name: r.name, color: r.color ?? undefined, size: r.size ?? undefined, category: r.category, lowStockThreshold: r.low_stock_threshold ?? undefined, costPrice: r.cost_price ?? undefined, sellPrice: r.sell_price ?? undefined });
export const dbToLocation = (r: any): Location => ({ id: r.id, name: r.name, type: r.type });
export const dbToStock = (r: any): StockLevel => ({ id: r.id, productId: r.product_id, locationId: r.location_id, quantity: r.quantity });
export const dbToTx = (r: any): Transaction => ({ id: r.id, date: r.date, type: r.type, productId: r.product_id, quantity: r.quantity, fromLocationId: r.from_location_id ?? undefined, toLocationId: r.to_location_id ?? undefined, reference: r.reference, user: r.user_name, status: r.status, signature: r.signature ?? undefined, contactId: r.contact_id ?? undefined, serialNumber: r.serial_number ?? undefined });
export const dbToContact = (r: any): Contact => ({ id: r.id, type: r.type, name: r.name, document: r.document, phone: r.phone ?? undefined, email: r.email ?? undefined });
export const dbToUser = (r: any): UserWithPassword => ({ id: r.id, username: r.username, role: r.role as Role, password: '', email: r.email ?? undefined, emailPersonal: r.email_personal ?? undefined, active: r.active });
export const dbToPO = (r: any): PurchaseOrder => ({ id: r.id, date: r.date, supplierId: r.supplier_id, status: r.status, reference: r.reference, notes: r.notes ?? undefined, locationId: r.location_id ?? undefined, items: (r.purchase_order_items ?? []).map((i: any): PurchaseOrderItem => ({ productId: i.product_id, quantity: i.quantity, unitCost: i.unit_cost, receivedQuantity: i.received_quantity })) });
export const dbToAdj = (r: any): InventoryAdjustment => ({ id: r.id, date: r.date, productId: r.product_id, locationId: r.location_id, previousQuantity: r.previous_quantity, newQuantity: r.new_quantity, reason: r.reason, notes: r.notes ?? undefined, user: r.user_name });
export const dbToSubscriber = (r: any): NotificationSubscriber => ({ id: r.id, name: r.name, email: r.email, active: r.active });
export const dbToAuditEntry = (r: any): AuditLogEntry => ({
  id: r.id,
  occurredAt: r.occurred_at,
  userId: r.user_id ?? undefined,
  userName: r.user_name ?? undefined,
  action: r.action,
  tableName: r.table_name,
  recordId: r.record_id ?? undefined,
  brand: r.brand ?? undefined,
  oldData: r.old_data ?? undefined,
  newData: r.new_data ?? undefined,
});
