export type Product = {
  id: string;
  code: string;
  name: string;
  color?: string;
  size?: string;
  category: string;
  lowStockThreshold?: number;
  costPrice?: number;
  sellPrice?: number;
};

export type Location = {
  id: string;
  name: string;
  type: 'ZONE' | 'RACK' | 'BIN' | 'EXTERNAL' | 'WAREHOUSE';
};

export type TransactionType = 'RECEPTION' | 'DISPATCH' | 'TRANSFER';

export type Transaction = {
  id: string;
  date: string;
  type: TransactionType;
  productId: string;
  quantity: number;
  fromLocationId?: string;
  toLocationId?: string;
  reference: string;
  user: string;
  status: 'COMPLETED' | 'PENDING' | 'CANCELLED' | 'PREPARING';
  signature?: string;
  contactId?: string;
  serialNumber?: string;
};

export type StockLevel = {
  id: string;
  productId: string;
  locationId: string;
  quantity: number;
};

export type Role = 'ADMIN_GENERAL' | 'CEO' | 'ADMINISTRADOR' | 'JEFE_ALMACEN';

export type User = {
  id: string;
  username: string;
  role: Role;
};

export type ContactType = 'SUPPLIER' | 'CLIENT';

export type Contact = {
  id: string;
  type: ContactType;
  name: string;
  document: string;
  phone?: string;
  email?: string;
};

export type UserWithPassword = User & {
  password: string;
  email?: string;
  active: boolean;
};

export type PurchaseOrderStatus = 'DRAFT' | 'APPROVED' | 'PARTIAL' | 'COMPLETED' | 'CANCELLED';

export type PurchaseOrderItem = {
  productId: string;
  quantity: number;
  unitCost: number;
  receivedQuantity: number;
};

export type PurchaseOrder = {
  id: string;
  date: string;
  supplierId: string;
  status: PurchaseOrderStatus;
  items: PurchaseOrderItem[];
  reference: string;
  notes?: string;
  locationId?: string;
};

export type AdjustmentReason = 'DAMAGE' | 'LOSS' | 'COUNT' | 'RETURN' | 'OTHER';

export type InventoryAdjustment = {
  id: string;
  date: string;
  productId: string;
  locationId: string;
  previousQuantity: number;
  newQuantity: number;
  reason: AdjustmentReason;
  notes?: string;
  user: string;
};
