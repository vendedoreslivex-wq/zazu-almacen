import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { Product, Location, Transaction, StockLevel, Contact, User, Role, UserWithPassword, PurchaseOrder, PurchaseOrderItem, InventoryAdjustment } from '../types';
import { Permission, DEFAULT_ROLE_PERMISSIONS } from '../lib/permissions';

export type Brand = 'OVERSHARK' | 'BRAVOS' | 'BOX_PRIME';

interface AppContextType {
  loading: boolean;
  activeBrand: Brand;
  setActiveBrand: (brand: Brand) => void;
  products: Product[];
  locations: Location[];
  transactions: Transaction[];
  stockLevels: StockLevel[];
  contacts: Contact[];
  currentUser: User;
  users: UserWithPassword[];
  purchaseOrders: PurchaseOrder[];
  adjustments: InventoryAdjustment[];
  addTransaction: (tx: Omit<Transaction, 'id' | 'date' | 'status'> & { forceNewEntry?: boolean }) => Promise<void>;
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  addLocation: (location: Omit<Location, 'id'>) => void;
  updateLocation: (location: Location) => void;
  deleteLocation: (id: string) => void;
  deleteStockLevel: (productId: string, locationId: string) => void;
  addContact: (contact: Omit<Contact, 'id'>) => void;
  updateContact: (contact: Contact) => void;
  deleteContact: (id: string) => void;
  setCurrentUser: (user: User) => void;
  addUser: (user: Omit<UserWithPassword, 'id'>) => Promise<void>;
  updateUser: (user: UserWithPassword) => void;
  deleteUser: (id: string) => void;
  addPurchaseOrder: (po: Omit<PurchaseOrder, 'id' | 'date'>) => void;
  updatePurchaseOrder: (po: PurchaseOrder) => void;
  deletePurchaseOrder: (id: string) => void;
  addAdjustment: (adj: Omit<InventoryAdjustment, 'id' | 'date'>) => void;
  rolePermissions: Record<Role, Record<string, Permission>>;
  updateRolePermission: (role: Role, module: string, permission: Permission) => Promise<void>;
}

const defaultProductsOvershark: Product[] = [
  { id: 'p1000', code: 'CAM-1000', name: 'CAMISA WAFFLE', color: 'Beige', size: 'S', category: 'Polos' },
  { id: 'p1001', code: 'CAM-1001', name: 'CAMISA WAFFLE', color: 'Beige', size: 'M', category: 'Polos' },
  { id: 'p1002', code: 'CAM-1002', name: 'CAMISA WAFFLE', color: 'Beige', size: 'L', category: 'Polos' },
  { id: 'p1003', code: 'CAM-1003', name: 'CAMISA WAFFLE', color: 'Beige', size: 'XL', category: 'Polos' },
  { id: 'p1004', code: 'CAM-1004', name: 'CAMISA WAFFLE', color: 'Botella', size: 'S', category: 'Polos' },
  { id: 'p1005', code: 'CAM-1005', name: 'CAMISA WAFFLE', color: 'Botella', size: 'M', category: 'Polos' },
  { id: 'p1006', code: 'CAM-1006', name: 'CAMISA WAFFLE', color: 'Botella', size: 'L', category: 'Polos' },
  { id: 'p1007', code: 'CAM-1007', name: 'CAMISA WAFFLE', color: 'Botella', size: 'XL', category: 'Polos' },
  { id: 'p1008', code: 'CAM-1008', name: 'CAMISA WAFFLE', color: 'Cemento', size: 'S', category: 'Polos' },
  { id: 'p1009', code: 'CAM-1009', name: 'CAMISA WAFFLE', color: 'Cemento', size: 'M', category: 'Polos' },
  { id: 'p1010', code: 'CAM-1010', name: 'CAMISA WAFFLE', color: 'Cemento', size: 'L', category: 'Polos' },
  { id: 'p1011', code: 'CAM-1011', name: 'CAMISA WAFFLE', color: 'Cemento', size: 'XL', category: 'Polos' },
  { id: 'p1012', code: 'CAM-1012', name: 'CAMISA WAFFLE', color: 'Denim', size: 'S', category: 'Polos' },
  { id: 'p1013', code: 'CAM-1013', name: 'CAMISA WAFFLE', color: 'Denim', size: 'M', category: 'Polos' },
  { id: 'p1014', code: 'CAM-1014', name: 'CAMISA WAFFLE', color: 'Denim', size: 'L', category: 'Polos' },
  { id: 'p1015', code: 'CAM-1015', name: 'CAMISA WAFFLE', color: 'Denim', size: 'XL', category: 'Polos' },
  { id: 'p1016', code: 'CAM-1016', name: 'CAMISA WAFFLE', color: 'Melanqe O.', size: 'S', category: 'Polos' },
  { id: 'p1017', code: 'CAM-1017', name: 'CAMISA WAFFLE', color: 'Melanqe O.', size: 'M', category: 'Polos' },
  { id: 'p1018', code: 'CAM-1018', name: 'CAMISA WAFFLE', color: 'Melanqe O.', size: 'L', category: 'Polos' },
  { id: 'p1019', code: 'CAM-1019', name: 'CAMISA WAFFLE', color: 'Melanqe O.', size: 'XL', category: 'Polos' },
  { id: 'p1020', code: 'CAM-1020', name: 'CAMISA WAFFLE', color: 'Negro', size: 'S', category: 'Polos' },
  { id: 'p1021', code: 'CAM-1021', name: 'CAMISA WAFFLE', color: 'Negro', size: 'M', category: 'Polos' },
  { id: 'p1022', code: 'CAM-1022', name: 'CAMISA WAFFLE', color: 'Negro', size: 'L', category: 'Polos' },
  { id: 'p1023', code: 'CAM-1023', name: 'CAMISA WAFFLE', color: 'Negro', size: 'XL', category: 'Polos' },
  { id: 'p1024', code: 'CAM-1024', name: 'CAMISA WAFFLE', color: 'Pacay', size: 'S', category: 'Polos' },
  { id: 'p1025', code: 'CAM-1025', name: 'CAMISA WAFFLE', color: 'Pacay', size: 'M', category: 'Polos' },
  { id: 'p1026', code: 'CAM-1026', name: 'CAMISA WAFFLE', color: 'Pacay', size: 'L', category: 'Polos' },
  { id: 'p1027', code: 'CAM-1027', name: 'CAMISA WAFFLE', color: 'Pacay', size: 'XL', category: 'Polos' },
  { id: 'p1028', code: 'CAM-1028', name: 'CAMISA WAFFLE', color: 'P.Rosa', size: 'S', category: 'Polos' },
  { id: 'p1029', code: 'CAM-1029', name: 'CAMISA WAFFLE', color: 'P.Rosa', size: 'M', category: 'Polos' },
  { id: 'p1030', code: 'CAM-1030', name: 'CAMISA WAFFLE', color: 'P.Rosa', size: 'L', category: 'Polos' },
  { id: 'p1031', code: 'CAM-1031', name: 'CAMISA WAFFLE', color: 'P.Rosa', size: 'XL', category: 'Polos' },
  { id: 'p1032', code: 'CAM-1032', name: 'CAMISA WAFFLE', color: 'Perla', size: 'S', category: 'Polos' },
  { id: 'p1033', code: 'CAM-1033', name: 'CAMISA WAFFLE', color: 'Perla', size: 'M', category: 'Polos' },
  { id: 'p1034', code: 'CAM-1034', name: 'CAMISA WAFFLE', color: 'Perla', size: 'L', category: 'Polos' },
  { id: 'p1035', code: 'CAM-1035', name: 'CAMISA WAFFLE', color: 'Perla', size: 'XL', category: 'Polos' },
  { id: 'p1036', code: 'CAM-1036', name: 'CAMISA WAFFLE', color: 'Vino', size: 'S', category: 'Polos' },
  { id: 'p1037', code: 'CAM-1037', name: 'CAMISA WAFFLE', color: 'Vino', size: 'M', category: 'Polos' },
  { id: 'p1038', code: 'CAM-1038', name: 'CAMISA WAFFLE', color: 'Vino', size: 'L', category: 'Polos' },
  { id: 'p1039', code: 'CAM-1039', name: 'CAMISA WAFFLE', color: 'Vino', size: 'XL', category: 'Polos' },
  { id: 'p1040', code: 'CAM-1040', name: 'CAMISERO JERSEY', color: 'Azul', size: 'S', category: 'Polos' },
  { id: 'p1041', code: 'CAM-1041', name: 'CAMISERO JERSEY', color: 'Azul', size: 'M', category: 'Polos' },
  { id: 'p1042', code: 'CAM-1042', name: 'CAMISERO JERSEY', color: 'Azul', size: 'L', category: 'Polos' },
  { id: 'p1043', code: 'CAM-1043', name: 'CAMISERO JERSEY', color: 'Azul', size: 'XL', category: 'Polos' },
  { id: 'p1044', code: 'CAM-1044', name: 'CAMISERO JERSEY', color: 'Beige', size: 'S', category: 'Polos' },
  { id: 'p1045', code: 'CAM-1045', name: 'CAMISERO JERSEY', color: 'Beige', size: 'M', category: 'Polos' },
  { id: 'p1046', code: 'CAM-1046', name: 'CAMISERO JERSEY', color: 'Beige', size: 'L', category: 'Polos' },
  { id: 'p1047', code: 'CAM-1047', name: 'CAMISERO JERSEY', color: 'Beige', size: 'XL', category: 'Polos' },
  { id: 'p1048', code: 'CAM-1048', name: 'CAMISERO JERSEY', color: 'Botella', size: 'S', category: 'Polos' },
  { id: 'p1049', code: 'CAM-1049', name: 'CAMISERO JERSEY', color: 'Botella', size: 'M', category: 'Polos' },
  { id: 'p1050', code: 'CAM-1050', name: 'CAMISERO JERSEY', color: 'Botella', size: 'L', category: 'Polos' },
  { id: 'p1051', code: 'CAM-1051', name: 'CAMISERO JERSEY', color: 'Botella', size: 'XL', category: 'Polos' },
  { id: 'p1052', code: 'CAM-1052', name: 'CAMISERO JERSEY', color: 'Camote', size: 'S', category: 'Polos' },
  { id: 'p1053', code: 'CAM-1053', name: 'CAMISERO JERSEY', color: 'Camote', size: 'M', category: 'Polos' },
  { id: 'p1054', code: 'CAM-1054', name: 'CAMISERO JERSEY', color: 'Camote', size: 'L', category: 'Polos' },
  { id: 'p1055', code: 'CAM-1055', name: 'CAMISERO JERSEY', color: 'Camote', size: 'XL', category: 'Polos' },
  { id: 'p1056', code: 'CAM-1056', name: 'CAMISERO JERSEY', color: 'Cemento', size: 'S', category: 'Polos' },
  { id: 'p1057', code: 'CAM-1057', name: 'CAMISERO JERSEY', color: 'Cemento', size: 'M', category: 'Polos' },
  { id: 'p1058', code: 'CAM-1058', name: 'CAMISERO JERSEY', color: 'Cemento', size: 'L', category: 'Polos' },
  { id: 'p1059', code: 'CAM-1059', name: 'CAMISERO JERSEY', color: 'Cemento', size: 'XL', category: 'Polos' },
  { id: 'p1060', code: 'CAM-1060', name: 'CAMISERO JERSEY', color: 'Denim', size: 'S', category: 'Polos' },
  { id: 'p1061', code: 'CAM-1061', name: 'CAMISERO JERSEY', color: 'Denim', size: 'M', category: 'Polos' },
  { id: 'p1062', code: 'CAM-1062', name: 'CAMISERO JERSEY', color: 'Denim', size: 'L', category: 'Polos' },
  { id: 'p1063', code: 'CAM-1063', name: 'CAMISERO JERSEY', color: 'Denim', size: 'XL', category: 'Polos' },
  { id: 'p1064', code: 'CAM-1064', name: 'CAMISERO JERSEY', color: 'Marron', size: 'S', category: 'Polos' },
  { id: 'p1065', code: 'CAM-1065', name: 'CAMISERO JERSEY', color: 'Marron', size: 'M', category: 'Polos' },
  { id: 'p1066', code: 'CAM-1066', name: 'CAMISERO JERSEY', color: 'Marron', size: 'L', category: 'Polos' },
  { id: 'p1067', code: 'CAM-1067', name: 'CAMISERO JERSEY', color: 'Marron', size: 'XL', category: 'Polos' },
  { id: 'p1068', code: 'CAM-1068', name: 'CAMISERO JERSEY', color: 'Melanqe O.', size: 'S', category: 'Polos' },
  { id: 'p1069', code: 'CAM-1069', name: 'CAMISERO JERSEY', color: 'Melanqe O.', size: 'M', category: 'Polos' },
  { id: 'p1070', code: 'CAM-1070', name: 'CAMISERO JERSEY', color: 'Melanqe O.', size: 'L', category: 'Polos' },
  { id: 'p1071', code: 'CAM-1071', name: 'CAMISERO JERSEY', color: 'Melanqe O.', size: 'XL', category: 'Polos' },
  { id: 'p1072', code: 'CAM-1072', name: 'CAMISERO JERSEY', color: 'Negro', size: 'S', category: 'Polos' },
  { id: 'p1073', code: 'CAM-1073', name: 'CAMISERO JERSEY', color: 'Negro', size: 'M', category: 'Polos' },
  { id: 'p1074', code: 'CAM-1074', name: 'CAMISERO JERSEY', color: 'Negro', size: 'L', category: 'Polos' },
  { id: 'p1075', code: 'CAM-1075', name: 'CAMISERO JERSEY', color: 'Negro', size: 'XL', category: 'Polos' },
  { id: 'p1076', code: 'CAM-1076', name: 'CAMISERO JERSEY', color: 'Topo', size: 'S', category: 'Polos' },
  { id: 'p1077', code: 'CAM-1077', name: 'CAMISERO JERSEY', color: 'Topo', size: 'M', category: 'Polos' },
  { id: 'p1078', code: 'CAM-1078', name: 'CAMISERO JERSEY', color: 'Topo', size: 'L', category: 'Polos' },
  { id: 'p1079', code: 'CAM-1079', name: 'CAMISERO JERSEY', color: 'Topo', size: 'XL', category: 'Polos' },
  { id: 'p1080', code: 'CAM-1080', name: 'CAMISERO JERSEY', color: 'Pacay', size: 'S', category: 'Polos' },
  { id: 'p1081', code: 'CAM-1081', name: 'CAMISERO JERSEY', color: 'Pacay', size: 'M', category: 'Polos' },
  { id: 'p1082', code: 'CAM-1082', name: 'CAMISERO JERSEY', color: 'Pacay', size: 'L', category: 'Polos' },
  { id: 'p1083', code: 'CAM-1083', name: 'CAMISERO JERSEY', color: 'Pacay', size: 'XL', category: 'Polos' },
  { id: 'p1084', code: 'CAM-1084', name: 'CAMISERO JERSEY', color: 'P.Rosa', size: 'S', category: 'Polos' },
  { id: 'p1085', code: 'CAM-1085', name: 'CAMISERO JERSEY', color: 'P.Rosa', size: 'M', category: 'Polos' },
  { id: 'p1086', code: 'CAM-1086', name: 'CAMISERO JERSEY', color: 'P.Rosa', size: 'L', category: 'Polos' },
  { id: 'p1087', code: 'CAM-1087', name: 'CAMISERO JERSEY', color: 'P.Rosa', size: 'XL', category: 'Polos' },
  { id: 'p1088', code: 'CAM-1088', name: 'CAMISERO JERSEY', color: 'Perla', size: 'S', category: 'Polos' },
  { id: 'p1089', code: 'CAM-1089', name: 'CAMISERO JERSEY', color: 'Perla', size: 'M', category: 'Polos' },
  { id: 'p1090', code: 'CAM-1090', name: 'CAMISERO JERSEY', color: 'Perla', size: 'L', category: 'Polos' },
  { id: 'p1091', code: 'CAM-1091', name: 'CAMISERO JERSEY', color: 'Perla', size: 'XL', category: 'Polos' },
  { id: 'p1092', code: 'CAM-1092', name: 'CAMISERO JERSEY', color: 'Plomo', size: 'S', category: 'Polos' },
  { id: 'p1093', code: 'CAM-1093', name: 'CAMISERO JERSEY', color: 'Plomo', size: 'M', category: 'Polos' },
  { id: 'p1094', code: 'CAM-1094', name: 'CAMISERO JERSEY', color: 'Plomo', size: 'L', category: 'Polos' },
  { id: 'p1095', code: 'CAM-1095', name: 'CAMISERO JERSEY', color: 'Plomo', size: 'XL', category: 'Polos' },
  { id: 'p1096', code: 'CAM-1096', name: 'CAMISERO JERSEY', color: 'Vino', size: 'S', category: 'Polos' },
  { id: 'p1097', code: 'CAM-1097', name: 'CAMISERO JERSEY', color: 'Vino', size: 'M', category: 'Polos' },
  { id: 'p1098', code: 'CAM-1098', name: 'CAMISERO JERSEY', color: 'Vino', size: 'L', category: 'Polos' },
  { id: 'p1099', code: 'CAM-1099', name: 'CAMISERO JERSEY', color: 'Vino', size: 'XL', category: 'Polos' },
  { id: 'p1100', code: 'CAM-1100', name: 'CAMISERO PIKE', color: 'Azul', size: 'S', category: 'Polos' },
  { id: 'p1101', code: 'CAM-1101', name: 'CAMISERO PIKE', color: 'Azul', size: 'M', category: 'Polos' },
  { id: 'p1102', code: 'CAM-1102', name: 'CAMISERO PIKE', color: 'Azul', size: 'L', category: 'Polos' },
  { id: 'p1103', code: 'CAM-1103', name: 'CAMISERO PIKE', color: 'Azul', size: 'XL', category: 'Polos' },
  { id: 'p1104', code: 'CAM-1104', name: 'CAMISERO PIKE', color: 'Beige', size: 'S', category: 'Polos' },
  { id: 'p1105', code: 'CAM-1105', name: 'CAMISERO PIKE', color: 'Beige', size: 'M', category: 'Polos' },
  { id: 'p1106', code: 'CAM-1106', name: 'CAMISERO PIKE', color: 'Beige', size: 'L', category: 'Polos' },
  { id: 'p1107', code: 'CAM-1107', name: 'CAMISERO PIKE', color: 'Beige', size: 'XL', category: 'Polos' },
  { id: 'p1108', code: 'CAM-1108', name: 'CAMISERO PIKE', color: 'Botella', size: 'S', category: 'Polos' },
  { id: 'p1109', code: 'CAM-1109', name: 'CAMISERO PIKE', color: 'Botella', size: 'M', category: 'Polos' },
  { id: 'p1110', code: 'CAM-1110', name: 'CAMISERO PIKE', color: 'Botella', size: 'L', category: 'Polos' },
  { id: 'p1111', code: 'CAM-1111', name: 'CAMISERO PIKE', color: 'Botella', size: 'XL', category: 'Polos' },
  { id: 'p1112', code: 'CAM-1112', name: 'CAMISERO PIKE', color: 'Camote', size: 'S', category: 'Polos' },
  { id: 'p1113', code: 'CAM-1113', name: 'CAMISERO PIKE', color: 'Camote', size: 'M', category: 'Polos' },
  { id: 'p1114', code: 'CAM-1114', name: 'CAMISERO PIKE', color: 'Camote', size: 'L', category: 'Polos' },
  { id: 'p1115', code: 'CAM-1115', name: 'CAMISERO PIKE', color: 'Camote', size: 'XL', category: 'Polos' },
  { id: 'p1116', code: 'CAM-1116', name: 'CAMISERO PIKE', color: 'Cemento', size: 'S', category: 'Polos' },
  { id: 'p1117', code: 'CAM-1117', name: 'CAMISERO PIKE', color: 'Cemento', size: 'M', category: 'Polos' },
  { id: 'p1118', code: 'CAM-1118', name: 'CAMISERO PIKE', color: 'Cemento', size: 'L', category: 'Polos' },
  { id: 'p1119', code: 'CAM-1119', name: 'CAMISERO PIKE', color: 'Cemento', size: 'XL', category: 'Polos' },
  { id: 'p1120', code: 'CAM-1120', name: 'CAMISERO PIKE', color: 'Denim', size: 'S', category: 'Polos' },
  { id: 'p1121', code: 'CAM-1121', name: 'CAMISERO PIKE', color: 'Denim', size: 'M', category: 'Polos' },
  { id: 'p1122', code: 'CAM-1122', name: 'CAMISERO PIKE', color: 'Denim', size: 'L', category: 'Polos' },
  { id: 'p1123', code: 'CAM-1123', name: 'CAMISERO PIKE', color: 'Denim', size: 'XL', category: 'Polos' },
  { id: 'p1124', code: 'CAM-1124', name: 'CAMISERO PIKE', color: 'Marron', size: 'S', category: 'Polos' },
  { id: 'p1125', code: 'CAM-1125', name: 'CAMISERO PIKE', color: 'Marron', size: 'M', category: 'Polos' },
  { id: 'p1126', code: 'CAM-1126', name: 'CAMISERO PIKE', color: 'Marron', size: 'L', category: 'Polos' },
  { id: 'p1127', code: 'CAM-1127', name: 'CAMISERO PIKE', color: 'Marron', size: 'XL', category: 'Polos' },
  { id: 'p1128', code: 'CAM-1128', name: 'CAMISERO PIKE', color: 'Melanqe O.', size: 'S', category: 'Polos' },
  { id: 'p1129', code: 'CAM-1129', name: 'CAMISERO PIKE', color: 'Melanqe O.', size: 'M', category: 'Polos' },
  { id: 'p1130', code: 'CAM-1130', name: 'CAMISERO PIKE', color: 'Melanqe O.', size: 'L', category: 'Polos' },
  { id: 'p1131', code: 'CAM-1131', name: 'CAMISERO PIKE', color: 'Melanqe O.', size: 'XL', category: 'Polos' },
  { id: 'p1132', code: 'CAM-1132', name: 'CAMISERO PIKE', color: 'Negro', size: 'S', category: 'Polos' },
  { id: 'p1133', code: 'CAM-1133', name: 'CAMISERO PIKE', color: 'Negro', size: 'M', category: 'Polos' },
  { id: 'p1134', code: 'CAM-1134', name: 'CAMISERO PIKE', color: 'Negro', size: 'L', category: 'Polos' },
  { id: 'p1135', code: 'CAM-1135', name: 'CAMISERO PIKE', color: 'Negro', size: 'XL', category: 'Polos' },
  { id: 'p1136', code: 'CAM-1136', name: 'CAMISERO PIKE', color: 'Topo', size: 'S', category: 'Polos' },
  { id: 'p1137', code: 'CAM-1137', name: 'CAMISERO PIKE', color: 'Topo', size: 'M', category: 'Polos' },
  { id: 'p1138', code: 'CAM-1138', name: 'CAMISERO PIKE', color: 'Topo', size: 'L', category: 'Polos' },
  { id: 'p1139', code: 'CAM-1139', name: 'CAMISERO PIKE', color: 'Topo', size: 'XL', category: 'Polos' },
  { id: 'p1140', code: 'CAM-1140', name: 'CAMISERO PIKE', color: 'Pacay', size: 'S', category: 'Polos' },
  { id: 'p1141', code: 'CAM-1141', name: 'CAMISERO PIKE', color: 'Pacay', size: 'M', category: 'Polos' },
  { id: 'p1142', code: 'CAM-1142', name: 'CAMISERO PIKE', color: 'Pacay', size: 'L', category: 'Polos' },
  { id: 'p1143', code: 'CAM-1143', name: 'CAMISERO PIKE', color: 'Pacay', size: 'XL', category: 'Polos' },
  { id: 'p1144', code: 'CAM-1144', name: 'CAMISERO PIKE', color: 'P.Rosa', size: 'S', category: 'Polos' },
  { id: 'p1145', code: 'CAM-1145', name: 'CAMISERO PIKE', color: 'P.Rosa', size: 'M', category: 'Polos' },
  { id: 'p1146', code: 'CAM-1146', name: 'CAMISERO PIKE', color: 'P.Rosa', size: 'L', category: 'Polos' },
  { id: 'p1147', code: 'CAM-1147', name: 'CAMISERO PIKE', color: 'P.Rosa', size: 'XL', category: 'Polos' },
  { id: 'p1148', code: 'CAM-1148', name: 'CAMISERO PIKE', color: 'Perla', size: 'S', category: 'Polos' },
  { id: 'p1149', code: 'CAM-1149', name: 'CAMISERO PIKE', color: 'Perla', size: 'M', category: 'Polos' },
  { id: 'p1150', code: 'CAM-1150', name: 'CAMISERO PIKE', color: 'Perla', size: 'L', category: 'Polos' },
  { id: 'p1151', code: 'CAM-1151', name: 'CAMISERO PIKE', color: 'Perla', size: 'XL', category: 'Polos' },
  { id: 'p1152', code: 'CAM-1152', name: 'CAMISERO PIKE', color: 'Plomo', size: 'S', category: 'Polos' },
  { id: 'p1153', code: 'CAM-1153', name: 'CAMISERO PIKE', color: 'Plomo', size: 'M', category: 'Polos' },
  { id: 'p1154', code: 'CAM-1154', name: 'CAMISERO PIKE', color: 'Plomo', size: 'L', category: 'Polos' },
  { id: 'p1155', code: 'CAM-1155', name: 'CAMISERO PIKE', color: 'Plomo', size: 'XL', category: 'Polos' },
  { id: 'p1156', code: 'CAM-1156', name: 'CAMISERO PIKE', color: 'Vino', size: 'S', category: 'Polos' },
  { id: 'p1157', code: 'CAM-1157', name: 'CAMISERO PIKE', color: 'Vino', size: 'M', category: 'Polos' },
  { id: 'p1158', code: 'CAM-1158', name: 'CAMISERO PIKE', color: 'Vino', size: 'L', category: 'Polos' },
  { id: 'p1159', code: 'CAM-1159', name: 'CAMISERO PIKE', color: 'Vino', size: 'XL', category: 'Polos' },
  { id: 'p1160', code: 'WAF-1160', name: 'WAFFLE', color: 'Azul', size: 'S', category: 'Polos' },
  { id: 'p1161', code: 'WAF-1161', name: 'WAFFLE', color: 'Azul', size: 'M', category: 'Polos' },
  { id: 'p1162', code: 'WAF-1162', name: 'WAFFLE', color: 'Azul', size: 'L', category: 'Polos' },
  { id: 'p1163', code: 'WAF-1163', name: 'WAFFLE', color: 'Azul', size: 'XL', category: 'Polos' },
  { id: 'p1164', code: 'WAF-1164', name: 'WAFFLE', color: 'Beige', size: 'S', category: 'Polos' },
  { id: 'p1165', code: 'WAF-1165', name: 'WAFFLE', color: 'Beige', size: 'M', category: 'Polos' },
  { id: 'p1166', code: 'WAF-1166', name: 'WAFFLE', color: 'Beige', size: 'L', category: 'Polos' },
  { id: 'p1167', code: 'WAF-1167', name: 'WAFFLE', color: 'Beige', size: 'XL', category: 'Polos' },
  { id: 'p1168', code: 'WAF-1168', name: 'WAFFLE', color: 'Botella', size: 'S', category: 'Polos' },
  { id: 'p1169', code: 'WAF-1169', name: 'WAFFLE', color: 'Botella', size: 'M', category: 'Polos' },
  { id: 'p1170', code: 'WAF-1170', name: 'WAFFLE', color: 'Botella', size: 'L', category: 'Polos' },
  { id: 'p1171', code: 'WAF-1171', name: 'WAFFLE', color: 'Botella', size: 'XL', category: 'Polos' },
  { id: 'p1172', code: 'WAF-1172', name: 'WAFFLE', color: 'Camote', size: 'S', category: 'Polos' },
  { id: 'p1173', code: 'WAF-1173', name: 'WAFFLE', color: 'Camote', size: 'M', category: 'Polos' },
  { id: 'p1174', code: 'WAF-1174', name: 'WAFFLE', color: 'Camote', size: 'L', category: 'Polos' },
  { id: 'p1175', code: 'WAF-1175', name: 'WAFFLE', color: 'Camote', size: 'XL', category: 'Polos' },
  { id: 'p1176', code: 'WAF-1176', name: 'WAFFLE', color: 'Cemento', size: 'S', category: 'Polos' },
  { id: 'p1177', code: 'WAF-1177', name: 'WAFFLE', color: 'Cemento', size: 'M', category: 'Polos' },
  { id: 'p1178', code: 'WAF-1178', name: 'WAFFLE', color: 'Cemento', size: 'L', category: 'Polos' },
  { id: 'p1179', code: 'WAF-1179', name: 'WAFFLE', color: 'Cemento', size: 'XL', category: 'Polos' },
  { id: 'p1180', code: 'WAF-1180', name: 'WAFFLE', color: 'Denim', size: 'S', category: 'Polos' },
  { id: 'p1181', code: 'WAF-1181', name: 'WAFFLE', color: 'Denim', size: 'M', category: 'Polos' },
  { id: 'p1182', code: 'WAF-1182', name: 'WAFFLE', color: 'Denim', size: 'L', category: 'Polos' },
  { id: 'p1183', code: 'WAF-1183', name: 'WAFFLE', color: 'Denim', size: 'XL', category: 'Polos' },
  { id: 'p1184', code: 'WAF-1184', name: 'WAFFLE', color: 'Marron', size: 'S', category: 'Polos' },
  { id: 'p1185', code: 'WAF-1185', name: 'WAFFLE', color: 'Marron', size: 'M', category: 'Polos' },
  { id: 'p1186', code: 'WAF-1186', name: 'WAFFLE', color: 'Marron', size: 'L', category: 'Polos' },
  { id: 'p1187', code: 'WAF-1187', name: 'WAFFLE', color: 'Marron', size: 'XL', category: 'Polos' },
  { id: 'p1188', code: 'WAF-1188', name: 'WAFFLE', color: 'Melanqe O.', size: 'S', category: 'Polos' },
  { id: 'p1189', code: 'WAF-1189', name: 'WAFFLE', color: 'Melanqe O.', size: 'M', category: 'Polos' },
  { id: 'p1190', code: 'WAF-1190', name: 'WAFFLE', color: 'Melanqe O.', size: 'L', category: 'Polos' },
  { id: 'p1191', code: 'WAF-1191', name: 'WAFFLE', color: 'Melanqe O.', size: 'XL', category: 'Polos' },
  { id: 'p1192', code: 'WAF-1192', name: 'WAFFLE', color: 'Negro', size: 'S', category: 'Polos' },
  { id: 'p1193', code: 'WAF-1193', name: 'WAFFLE', color: 'Negro', size: 'M', category: 'Polos' },
  { id: 'p1194', code: 'WAF-1194', name: 'WAFFLE', color: 'Negro', size: 'L', category: 'Polos' },
  { id: 'p1195', code: 'WAF-1195', name: 'WAFFLE', color: 'Negro', size: 'XL', category: 'Polos' },
  { id: 'p1196', code: 'WAF-1196', name: 'WAFFLE', color: 'Topo', size: 'S', category: 'Polos' },
  { id: 'p1197', code: 'WAF-1197', name: 'WAFFLE', color: 'Topo', size: 'M', category: 'Polos' },
  { id: 'p1198', code: 'WAF-1198', name: 'WAFFLE', color: 'Topo', size: 'L', category: 'Polos' },
  { id: 'p1199', code: 'WAF-1199', name: 'WAFFLE', color: 'Topo', size: 'XL', category: 'Polos' },
  { id: 'p1200', code: 'WAF-1200', name: 'WAFFLE', color: 'Pacay', size: 'S', category: 'Polos' },
  { id: 'p1201', code: 'WAF-1201', name: 'WAFFLE', color: 'Pacay', size: 'M', category: 'Polos' },
  { id: 'p1202', code: 'WAF-1202', name: 'WAFFLE', color: 'Pacay', size: 'L', category: 'Polos' },
  { id: 'p1203', code: 'WAF-1203', name: 'WAFFLE', color: 'Pacay', size: 'XL', category: 'Polos' },
  { id: 'p1204', code: 'WAF-1204', name: 'WAFFLE', color: 'P.Rosa', size: 'S', category: 'Polos' },
  { id: 'p1205', code: 'WAF-1205', name: 'WAFFLE', color: 'P.Rosa', size: 'M', category: 'Polos' },
  { id: 'p1206', code: 'WAF-1206', name: 'WAFFLE', color: 'P.Rosa', size: 'L', category: 'Polos' },
  { id: 'p1207', code: 'WAF-1207', name: 'WAFFLE', color: 'P.Rosa', size: 'XL', category: 'Polos' },
  { id: 'p1208', code: 'WAF-1208', name: 'WAFFLE', color: 'Perla', size: 'S', category: 'Polos' },
  { id: 'p1209', code: 'WAF-1209', name: 'WAFFLE', color: 'Perla', size: 'M', category: 'Polos' },
  { id: 'p1210', code: 'WAF-1210', name: 'WAFFLE', color: 'Perla', size: 'L', category: 'Polos' },
  { id: 'p1211', code: 'WAF-1211', name: 'WAFFLE', color: 'Perla', size: 'XL', category: 'Polos' },
  { id: 'p1212', code: 'WAF-1212', name: 'WAFFLE', color: 'Plomo', size: 'S', category: 'Polos' },
  { id: 'p1213', code: 'WAF-1213', name: 'WAFFLE', color: 'Plomo', size: 'M', category: 'Polos' },
  { id: 'p1214', code: 'WAF-1214', name: 'WAFFLE', color: 'Plomo', size: 'L', category: 'Polos' },
  { id: 'p1215', code: 'WAF-1215', name: 'WAFFLE', color: 'Plomo', size: 'XL', category: 'Polos' },
  { id: 'p1216', code: 'WAF-1216', name: 'WAFFLE', color: 'Vino', size: 'S', category: 'Polos' },
  { id: 'p1217', code: 'WAF-1217', name: 'WAFFLE', color: 'Vino', size: 'M', category: 'Polos' },
  { id: 'p1218', code: 'WAF-1218', name: 'WAFFLE', color: 'Vino', size: 'L', category: 'Polos' },
  { id: 'p1219', code: 'WAF-1219', name: 'WAFFLE', color: 'Vino', size: 'XL', category: 'Polos' },
  { id: 'p1220', code: 'WAF-1220', name: 'WAFFLE CAMISERO', color: 'Azul', size: 'S', category: 'Polos' },
  { id: 'p1221', code: 'WAF-1221', name: 'WAFFLE CAMISERO', color: 'Azul', size: 'M', category: 'Polos' },
  { id: 'p1222', code: 'WAF-1222', name: 'WAFFLE CAMISERO', color: 'Azul', size: 'L', category: 'Polos' },
  { id: 'p1223', code: 'WAF-1223', name: 'WAFFLE CAMISERO', color: 'Azul', size: 'XL', category: 'Polos' },
  { id: 'p1224', code: 'WAF-1224', name: 'WAFFLE CAMISERO', color: 'Beige', size: 'S', category: 'Polos' },
  { id: 'p1225', code: 'WAF-1225', name: 'WAFFLE CAMISERO', color: 'Beige', size: 'M', category: 'Polos' },
  { id: 'p1226', code: 'WAF-1226', name: 'WAFFLE CAMISERO', color: 'Beige', size: 'L', category: 'Polos' },
  { id: 'p1227', code: 'WAF-1227', name: 'WAFFLE CAMISERO', color: 'Beige', size: 'XL', category: 'Polos' },
  { id: 'p1228', code: 'WAF-1228', name: 'WAFFLE CAMISERO', color: 'Botella', size: 'S', category: 'Polos' },
  { id: 'p1229', code: 'WAF-1229', name: 'WAFFLE CAMISERO', color: 'Botella', size: 'M', category: 'Polos' },
  { id: 'p1230', code: 'WAF-1230', name: 'WAFFLE CAMISERO', color: 'Botella', size: 'L', category: 'Polos' },
  { id: 'p1231', code: 'WAF-1231', name: 'WAFFLE CAMISERO', color: 'Botella', size: 'XL', category: 'Polos' },
  { id: 'p1232', code: 'WAF-1232', name: 'WAFFLE CAMISERO', color: 'Camote', size: 'S', category: 'Polos' },
  { id: 'p1233', code: 'WAF-1233', name: 'WAFFLE CAMISERO', color: 'Camote', size: 'M', category: 'Polos' },
  { id: 'p1234', code: 'WAF-1234', name: 'WAFFLE CAMISERO', color: 'Camote', size: 'L', category: 'Polos' },
  { id: 'p1235', code: 'WAF-1235', name: 'WAFFLE CAMISERO', color: 'Camote', size: 'XL', category: 'Polos' },
  { id: 'p1236', code: 'WAF-1236', name: 'WAFFLE CAMISERO', color: 'Cemento', size: 'S', category: 'Polos' },
  { id: 'p1237', code: 'WAF-1237', name: 'WAFFLE CAMISERO', color: 'Cemento', size: 'M', category: 'Polos' },
  { id: 'p1238', code: 'WAF-1238', name: 'WAFFLE CAMISERO', color: 'Cemento', size: 'L', category: 'Polos' },
  { id: 'p1239', code: 'WAF-1239', name: 'WAFFLE CAMISERO', color: 'Cemento', size: 'XL', category: 'Polos' },
  { id: 'p1240', code: 'WAF-1240', name: 'WAFFLE CAMISERO', color: 'Denim', size: 'S', category: 'Polos' },
  { id: 'p1241', code: 'WAF-1241', name: 'WAFFLE CAMISERO', color: 'Denim', size: 'M', category: 'Polos' },
  { id: 'p1242', code: 'WAF-1242', name: 'WAFFLE CAMISERO', color: 'Denim', size: 'L', category: 'Polos' },
  { id: 'p1243', code: 'WAF-1243', name: 'WAFFLE CAMISERO', color: 'Denim', size: 'XL', category: 'Polos' },
  { id: 'p1244', code: 'WAF-1244', name: 'WAFFLE CAMISERO', color: 'Marron', size: 'S', category: 'Polos' },
  { id: 'p1245', code: 'WAF-1245', name: 'WAFFLE CAMISERO', color: 'Marron', size: 'M', category: 'Polos' },
  { id: 'p1246', code: 'WAF-1246', name: 'WAFFLE CAMISERO', color: 'Marron', size: 'L', category: 'Polos' },
  { id: 'p1247', code: 'WAF-1247', name: 'WAFFLE CAMISERO', color: 'Marron', size: 'XL', category: 'Polos' },
  { id: 'p1248', code: 'WAF-1248', name: 'WAFFLE CAMISERO', color: 'Melanqe O.', size: 'S', category: 'Polos' },
  { id: 'p1249', code: 'WAF-1249', name: 'WAFFLE CAMISERO', color: 'Melanqe O.', size: 'M', category: 'Polos' },
  { id: 'p1250', code: 'WAF-1250', name: 'WAFFLE CAMISERO', color: 'Melanqe O.', size: 'L', category: 'Polos' },
  { id: 'p1251', code: 'WAF-1251', name: 'WAFFLE CAMISERO', color: 'Melanqe O.', size: 'XL', category: 'Polos' },
  { id: 'p1252', code: 'WAF-1252', name: 'WAFFLE CAMISERO', color: 'Negro', size: 'S', category: 'Polos' },
  { id: 'p1253', code: 'WAF-1253', name: 'WAFFLE CAMISERO', color: 'Negro', size: 'M', category: 'Polos' },
  { id: 'p1254', code: 'WAF-1254', name: 'WAFFLE CAMISERO', color: 'Negro', size: 'L', category: 'Polos' },
  { id: 'p1255', code: 'WAF-1255', name: 'WAFFLE CAMISERO', color: 'Negro', size: 'XL', category: 'Polos' },
  { id: 'p1256', code: 'WAF-1256', name: 'WAFFLE CAMISERO', color: 'Topo', size: 'S', category: 'Polos' },
  { id: 'p1257', code: 'WAF-1257', name: 'WAFFLE CAMISERO', color: 'Topo', size: 'M', category: 'Polos' },
  { id: 'p1258', code: 'WAF-1258', name: 'WAFFLE CAMISERO', color: 'Topo', size: 'L', category: 'Polos' },
  { id: 'p1259', code: 'WAF-1259', name: 'WAFFLE CAMISERO', color: 'Topo', size: 'XL', category: 'Polos' },
  { id: 'p1260', code: 'WAF-1260', name: 'WAFFLE CAMISERO', color: 'Pacay', size: 'S', category: 'Polos' },
  { id: 'p1261', code: 'WAF-1261', name: 'WAFFLE CAMISERO', color: 'Pacay', size: 'M', category: 'Polos' },
  { id: 'p1262', code: 'WAF-1262', name: 'WAFFLE CAMISERO', color: 'Pacay', size: 'L', category: 'Polos' },
  { id: 'p1263', code: 'WAF-1263', name: 'WAFFLE CAMISERO', color: 'Pacay', size: 'XL', category: 'Polos' },
  { id: 'p1264', code: 'WAF-1264', name: 'WAFFLE CAMISERO', color: 'P.Rosa', size: 'S', category: 'Polos' },
  { id: 'p1265', code: 'WAF-1265', name: 'WAFFLE CAMISERO', color: 'P.Rosa', size: 'M', category: 'Polos' },
  { id: 'p1266', code: 'WAF-1266', name: 'WAFFLE CAMISERO', color: 'P.Rosa', size: 'L', category: 'Polos' },
  { id: 'p1267', code: 'WAF-1267', name: 'WAFFLE CAMISERO', color: 'P.Rosa', size: 'XL', category: 'Polos' },
  { id: 'p1268', code: 'WAF-1268', name: 'WAFFLE CAMISERO', color: 'Perla', size: 'S', category: 'Polos' },
  { id: 'p1269', code: 'WAF-1269', name: 'WAFFLE CAMISERO', color: 'Perla', size: 'M', category: 'Polos' },
  { id: 'p1270', code: 'WAF-1270', name: 'WAFFLE CAMISERO', color: 'Perla', size: 'L', category: 'Polos' },
  { id: 'p1271', code: 'WAF-1271', name: 'WAFFLE CAMISERO', color: 'Perla', size: 'XL', category: 'Polos' },
  { id: 'p1272', code: 'WAF-1272', name: 'WAFFLE CAMISERO', color: 'Plomo', size: 'S', category: 'Polos' },
  { id: 'p1273', code: 'WAF-1273', name: 'WAFFLE CAMISERO', color: 'Plomo', size: 'M', category: 'Polos' },
  { id: 'p1274', code: 'WAF-1274', name: 'WAFFLE CAMISERO', color: 'Plomo', size: 'L', category: 'Polos' },
  { id: 'p1275', code: 'WAF-1275', name: 'WAFFLE CAMISERO', color: 'Plomo', size: 'XL', category: 'Polos' },
  { id: 'p1276', code: 'WAF-1276', name: 'WAFFLE CAMISERO', color: 'Vino', size: 'S', category: 'Polos' },
  { id: 'p1277', code: 'WAF-1277', name: 'WAFFLE CAMISERO', color: 'Vino', size: 'M', category: 'Polos' },
  { id: 'p1278', code: 'WAF-1278', name: 'WAFFLE CAMISERO', color: 'Vino', size: 'L', category: 'Polos' },
  { id: 'p1279', code: 'WAF-1279', name: 'WAFFLE CAMISERO', color: 'Vino', size: 'XL', category: 'Polos' },
  { id: 'p1280', code: 'WAF-1280', name: 'WAFFLE MANGA LARGA', color: 'Azul', size: 'S', category: 'Polos' },
  { id: 'p1281', code: 'WAF-1281', name: 'WAFFLE MANGA LARGA', color: 'Azul', size: 'M', category: 'Polos' },
  { id: 'p1282', code: 'WAF-1282', name: 'WAFFLE MANGA LARGA', color: 'Azul', size: 'L', category: 'Polos' },
  { id: 'p1283', code: 'WAF-1283', name: 'WAFFLE MANGA LARGA', color: 'Azul', size: 'XL', category: 'Polos' },
  { id: 'p1284', code: 'WAF-1284', name: 'WAFFLE MANGA LARGA', color: 'Beige', size: 'S', category: 'Polos' },
  { id: 'p1285', code: 'WAF-1285', name: 'WAFFLE MANGA LARGA', color: 'Beige', size: 'M', category: 'Polos' },
  { id: 'p1286', code: 'WAF-1286', name: 'WAFFLE MANGA LARGA', color: 'Beige', size: 'L', category: 'Polos' },
  { id: 'p1287', code: 'WAF-1287', name: 'WAFFLE MANGA LARGA', color: 'Beige', size: 'XL', category: 'Polos' },
  { id: 'p1288', code: 'WAF-1288', name: 'WAFFLE MANGA LARGA', color: 'Botella', size: 'S', category: 'Polos' },
  { id: 'p1289', code: 'WAF-1289', name: 'WAFFLE MANGA LARGA', color: 'Botella', size: 'M', category: 'Polos' },
  { id: 'p1290', code: 'WAF-1290', name: 'WAFFLE MANGA LARGA', color: 'Botella', size: 'L', category: 'Polos' },
  { id: 'p1291', code: 'WAF-1291', name: 'WAFFLE MANGA LARGA', color: 'Botella', size: 'XL', category: 'Polos' },
  { id: 'p1292', code: 'WAF-1292', name: 'WAFFLE MANGA LARGA', color: 'Camote', size: 'S', category: 'Polos' },
  { id: 'p1293', code: 'WAF-1293', name: 'WAFFLE MANGA LARGA', color: 'Camote', size: 'M', category: 'Polos' },
  { id: 'p1294', code: 'WAF-1294', name: 'WAFFLE MANGA LARGA', color: 'Camote', size: 'L', category: 'Polos' },
  { id: 'p1295', code: 'WAF-1295', name: 'WAFFLE MANGA LARGA', color: 'Camote', size: 'XL', category: 'Polos' },
  { id: 'p1296', code: 'WAF-1296', name: 'WAFFLE MANGA LARGA', color: 'Cemento', size: 'S', category: 'Polos' },
  { id: 'p1297', code: 'WAF-1297', name: 'WAFFLE MANGA LARGA', color: 'Cemento', size: 'M', category: 'Polos' },
  { id: 'p1298', code: 'WAF-1298', name: 'WAFFLE MANGA LARGA', color: 'Cemento', size: 'L', category: 'Polos' },
  { id: 'p1299', code: 'WAF-1299', name: 'WAFFLE MANGA LARGA', color: 'Cemento', size: 'XL', category: 'Polos' },
  { id: 'p1300', code: 'WAF-1300', name: 'WAFFLE MANGA LARGA', color: 'Denim', size: 'S', category: 'Polos' },
  { id: 'p1301', code: 'WAF-1301', name: 'WAFFLE MANGA LARGA', color: 'Denim', size: 'M', category: 'Polos' },
  { id: 'p1302', code: 'WAF-1302', name: 'WAFFLE MANGA LARGA', color: 'Denim', size: 'L', category: 'Polos' },
  { id: 'p1303', code: 'WAF-1303', name: 'WAFFLE MANGA LARGA', color: 'Denim', size: 'XL', category: 'Polos' },
  { id: 'p1304', code: 'WAF-1304', name: 'WAFFLE MANGA LARGA', color: 'Marron', size: 'S', category: 'Polos' },
  { id: 'p1305', code: 'WAF-1305', name: 'WAFFLE MANGA LARGA', color: 'Marron', size: 'M', category: 'Polos' },
  { id: 'p1306', code: 'WAF-1306', name: 'WAFFLE MANGA LARGA', color: 'Marron', size: 'L', category: 'Polos' },
  { id: 'p1307', code: 'WAF-1307', name: 'WAFFLE MANGA LARGA', color: 'Marron', size: 'XL', category: 'Polos' },
  { id: 'p1308', code: 'WAF-1308', name: 'WAFFLE MANGA LARGA', color: 'Melanqe O.', size: 'S', category: 'Polos' },
  { id: 'p1309', code: 'WAF-1309', name: 'WAFFLE MANGA LARGA', color: 'Melanqe O.', size: 'M', category: 'Polos' },
  { id: 'p1310', code: 'WAF-1310', name: 'WAFFLE MANGA LARGA', color: 'Melanqe O.', size: 'L', category: 'Polos' },
  { id: 'p1311', code: 'WAF-1311', name: 'WAFFLE MANGA LARGA', color: 'Melanqe O.', size: 'XL', category: 'Polos' },
  { id: 'p1312', code: 'WAF-1312', name: 'WAFFLE MANGA LARGA', color: 'Negro', size: 'S', category: 'Polos' },
  { id: 'p1313', code: 'WAF-1313', name: 'WAFFLE MANGA LARGA', color: 'Negro', size: 'M', category: 'Polos' },
  { id: 'p1314', code: 'WAF-1314', name: 'WAFFLE MANGA LARGA', color: 'Negro', size: 'L', category: 'Polos' },
  { id: 'p1315', code: 'WAF-1315', name: 'WAFFLE MANGA LARGA', color: 'Negro', size: 'XL', category: 'Polos' },
  { id: 'p1316', code: 'WAF-1316', name: 'WAFFLE MANGA LARGA', color: 'Topo', size: 'S', category: 'Polos' },
  { id: 'p1317', code: 'WAF-1317', name: 'WAFFLE MANGA LARGA', color: 'Topo', size: 'M', category: 'Polos' },
  { id: 'p1318', code: 'WAF-1318', name: 'WAFFLE MANGA LARGA', color: 'Topo', size: 'L', category: 'Polos' },
  { id: 'p1319', code: 'WAF-1319', name: 'WAFFLE MANGA LARGA', color: 'Topo', size: 'XL', category: 'Polos' },
  { id: 'p1320', code: 'WAF-1320', name: 'WAFFLE MANGA LARGA', color: 'Pacay', size: 'S', category: 'Polos' },
  { id: 'p1321', code: 'WAF-1321', name: 'WAFFLE MANGA LARGA', color: 'Pacay', size: 'M', category: 'Polos' },
  { id: 'p1322', code: 'WAF-1322', name: 'WAFFLE MANGA LARGA', color: 'Pacay', size: 'L', category: 'Polos' },
  { id: 'p1323', code: 'WAF-1323', name: 'WAFFLE MANGA LARGA', color: 'Pacay', size: 'XL', category: 'Polos' },
  { id: 'p1324', code: 'WAF-1324', name: 'WAFFLE MANGA LARGA', color: 'P.Rosa', size: 'S', category: 'Polos' },
  { id: 'p1325', code: 'WAF-1325', name: 'WAFFLE MANGA LARGA', color: 'P.Rosa', size: 'M', category: 'Polos' },
  { id: 'p1326', code: 'WAF-1326', name: 'WAFFLE MANGA LARGA', color: 'P.Rosa', size: 'L', category: 'Polos' },
  { id: 'p1327', code: 'WAF-1327', name: 'WAFFLE MANGA LARGA', color: 'P.Rosa', size: 'XL', category: 'Polos' },
  { id: 'p1328', code: 'WAF-1328', name: 'WAFFLE MANGA LARGA', color: 'Perla', size: 'S', category: 'Polos' },
  { id: 'p1329', code: 'WAF-1329', name: 'WAFFLE MANGA LARGA', color: 'Perla', size: 'M', category: 'Polos' },
  { id: 'p1330', code: 'WAF-1330', name: 'WAFFLE MANGA LARGA', color: 'Perla', size: 'L', category: 'Polos' },
  { id: 'p1331', code: 'WAF-1331', name: 'WAFFLE MANGA LARGA', color: 'Perla', size: 'XL', category: 'Polos' },
  { id: 'p1332', code: 'WAF-1332', name: 'WAFFLE MANGA LARGA', color: 'Plomo', size: 'S', category: 'Polos' },
  { id: 'p1333', code: 'WAF-1333', name: 'WAFFLE MANGA LARGA', color: 'Plomo', size: 'M', category: 'Polos' },
  { id: 'p1334', code: 'WAF-1334', name: 'WAFFLE MANGA LARGA', color: 'Plomo', size: 'L', category: 'Polos' },
  { id: 'p1335', code: 'WAF-1335', name: 'WAFFLE MANGA LARGA', color: 'Plomo', size: 'XL', category: 'Polos' },
  { id: 'p1336', code: 'WAF-1336', name: 'WAFFLE MANGA LARGA', color: 'Vino', size: 'S', category: 'Polos' },
  { id: 'p1337', code: 'WAF-1337', name: 'WAFFLE MANGA LARGA', color: 'Vino', size: 'M', category: 'Polos' },
  { id: 'p1338', code: 'WAF-1338', name: 'WAFFLE MANGA LARGA', color: 'Vino', size: 'L', category: 'Polos' },
  { id: 'p1339', code: 'WAF-1339', name: 'WAFFLE MANGA LARGA', color: 'Vino', size: 'XL', category: 'Polos' },
  { id: 'p1340', code: 'CUE-1340', name: 'CUELLO CHINO', color: 'Azul', size: 'S', category: 'Polos' },
  { id: 'p1341', code: 'CUE-1341', name: 'CUELLO CHINO', color: 'Azul', size: 'M', category: 'Polos' },
  { id: 'p1342', code: 'CUE-1342', name: 'CUELLO CHINO', color: 'Azul', size: 'L', category: 'Polos' },
  { id: 'p1343', code: 'CUE-1343', name: 'CUELLO CHINO', color: 'Azul', size: 'XL', category: 'Polos' },
  { id: 'p1344', code: 'CUE-1344', name: 'CUELLO CHINO', color: 'Beige', size: 'S', category: 'Polos' },
  { id: 'p1345', code: 'CUE-1345', name: 'CUELLO CHINO', color: 'Beige', size: 'M', category: 'Polos' },
  { id: 'p1346', code: 'CUE-1346', name: 'CUELLO CHINO', color: 'Beige', size: 'L', category: 'Polos' },
  { id: 'p1347', code: 'CUE-1347', name: 'CUELLO CHINO', color: 'Beige', size: 'XL', category: 'Polos' },
  { id: 'p1348', code: 'CUE-1348', name: 'CUELLO CHINO', color: 'Botella', size: 'S', category: 'Polos' },
  { id: 'p1349', code: 'CUE-1349', name: 'CUELLO CHINO', color: 'Botella', size: 'M', category: 'Polos' },
  { id: 'p1350', code: 'CUE-1350', name: 'CUELLO CHINO', color: 'Botella', size: 'L', category: 'Polos' },
  { id: 'p1351', code: 'CUE-1351', name: 'CUELLO CHINO', color: 'Botella', size: 'XL', category: 'Polos' },
  { id: 'p1352', code: 'CUE-1352', name: 'CUELLO CHINO', color: 'Cemento', size: 'S', category: 'Polos' },
  { id: 'p1353', code: 'CUE-1353', name: 'CUELLO CHINO', color: 'Cemento', size: 'M', category: 'Polos' },
  { id: 'p1354', code: 'CUE-1354', name: 'CUELLO CHINO', color: 'Cemento', size: 'L', category: 'Polos' },
  { id: 'p1355', code: 'CUE-1355', name: 'CUELLO CHINO', color: 'Cemento', size: 'XL', category: 'Polos' },
  { id: 'p1356', code: 'CUE-1356', name: 'CUELLO CHINO', color: 'Negro', size: 'S', category: 'Polos' },
  { id: 'p1357', code: 'CUE-1357', name: 'CUELLO CHINO', color: 'Negro', size: 'M', category: 'Polos' },
  { id: 'p1358', code: 'CUE-1358', name: 'CUELLO CHINO', color: 'Negro', size: 'L', category: 'Polos' },
  { id: 'p1359', code: 'CUE-1359', name: 'CUELLO CHINO', color: 'Negro', size: 'XL', category: 'Polos' },
  { id: 'p1360', code: 'CUE-1360', name: 'CUELLO CHINO', color: 'Topo', size: 'S', category: 'Polos' },
  { id: 'p1361', code: 'CUE-1361', name: 'CUELLO CHINO', color: 'Topo', size: 'M', category: 'Polos' },
  { id: 'p1362', code: 'CUE-1362', name: 'CUELLO CHINO', color: 'Topo', size: 'L', category: 'Polos' },
  { id: 'p1363', code: 'CUE-1363', name: 'CUELLO CHINO', color: 'Topo', size: 'XL', category: 'Polos' },
  { id: 'p1364', code: 'CUE-1364', name: 'CUELLO CHINO', color: 'P.Rosa', size: 'S', category: 'Polos' },
  { id: 'p1365', code: 'CUE-1365', name: 'CUELLO CHINO', color: 'P.Rosa', size: 'M', category: 'Polos' },
  { id: 'p1366', code: 'CUE-1366', name: 'CUELLO CHINO', color: 'P.Rosa', size: 'L', category: 'Polos' },
  { id: 'p1367', code: 'CUE-1367', name: 'CUELLO CHINO', color: 'P.Rosa', size: 'XL', category: 'Polos' },
  { id: 'p1368', code: 'CUE-1368', name: 'CUELLO CHINO', color: 'Perla', size: 'S', category: 'Polos' },
  { id: 'p1369', code: 'CUE-1369', name: 'CUELLO CHINO', color: 'Perla', size: 'M', category: 'Polos' },
  { id: 'p1370', code: 'CUE-1370', name: 'CUELLO CHINO', color: 'Perla', size: 'L', category: 'Polos' },
  { id: 'p1371', code: 'CUE-1371', name: 'CUELLO CHINO', color: 'Perla', size: 'XL', category: 'Polos' },
  { id: 'p1372', code: 'CUE-1372', name: 'CUELLO CHINO', color: 'Vino', size: 'S', category: 'Polos' },
  { id: 'p1373', code: 'CUE-1373', name: 'CUELLO CHINO', color: 'Vino', size: 'M', category: 'Polos' },
  { id: 'p1374', code: 'CUE-1374', name: 'CUELLO CHINO', color: 'Vino', size: 'L', category: 'Polos' },
  { id: 'p1375', code: 'CUE-1375', name: 'CUELLO CHINO', color: 'Vino', size: 'XL', category: 'Polos' },
  { id: 'p1376', code: 'CUE-1376', name: 'CUELLO CHINO WAFFLE', color: 'Azul', size: 'S', category: 'Polos' },
  { id: 'p1377', code: 'CUE-1377', name: 'CUELLO CHINO WAFFLE', color: 'Azul', size: 'M', category: 'Polos' },
  { id: 'p1378', code: 'CUE-1378', name: 'CUELLO CHINO WAFFLE', color: 'Azul', size: 'L', category: 'Polos' },
  { id: 'p1379', code: 'CUE-1379', name: 'CUELLO CHINO WAFFLE', color: 'Azul', size: 'XL', category: 'Polos' },
  { id: 'p1380', code: 'CUE-1380', name: 'CUELLO CHINO WAFFLE', color: 'Botella', size: 'S', category: 'Polos' },
  { id: 'p1381', code: 'CUE-1381', name: 'CUELLO CHINO WAFFLE', color: 'Botella', size: 'M', category: 'Polos' },
  { id: 'p1382', code: 'CUE-1382', name: 'CUELLO CHINO WAFFLE', color: 'Botella', size: 'L', category: 'Polos' },
  { id: 'p1383', code: 'CUE-1383', name: 'CUELLO CHINO WAFFLE', color: 'Botella', size: 'XL', category: 'Polos' },
  { id: 'p1384', code: 'CUE-1384', name: 'CUELLO CHINO WAFFLE', color: 'Cemento', size: 'S', category: 'Polos' },
  { id: 'p1385', code: 'CUE-1385', name: 'CUELLO CHINO WAFFLE', color: 'Cemento', size: 'M', category: 'Polos' },
  { id: 'p1386', code: 'CUE-1386', name: 'CUELLO CHINO WAFFLE', color: 'Cemento', size: 'L', category: 'Polos' },
  { id: 'p1387', code: 'CUE-1387', name: 'CUELLO CHINO WAFFLE', color: 'Cemento', size: 'XL', category: 'Polos' },
  { id: 'p1388', code: 'CUE-1388', name: 'CUELLO CHINO WAFFLE', color: 'Negro', size: 'S', category: 'Polos' },
  { id: 'p1389', code: 'CUE-1389', name: 'CUELLO CHINO WAFFLE', color: 'Negro', size: 'M', category: 'Polos' },
  { id: 'p1390', code: 'CUE-1390', name: 'CUELLO CHINO WAFFLE', color: 'Negro', size: 'L', category: 'Polos' },
  { id: 'p1391', code: 'CUE-1391', name: 'CUELLO CHINO WAFFLE', color: 'Negro', size: 'XL', category: 'Polos' },
  { id: 'p1392', code: 'CUE-1392', name: 'CUELLO CHINO WAFFLE', color: 'Pacay', size: 'S', category: 'Polos' },
  { id: 'p1393', code: 'CUE-1393', name: 'CUELLO CHINO WAFFLE', color: 'Pacay', size: 'M', category: 'Polos' },
  { id: 'p1394', code: 'CUE-1394', name: 'CUELLO CHINO WAFFLE', color: 'Pacay', size: 'L', category: 'Polos' },
  { id: 'p1395', code: 'CUE-1395', name: 'CUELLO CHINO WAFFLE', color: 'Pacay', size: 'XL', category: 'Polos' },
  { id: 'p1396', code: 'CUE-1396', name: 'CUELLO CHINO WAFFLE', color: 'P.Rosa', size: 'S', category: 'Polos' },
  { id: 'p1397', code: 'CUE-1397', name: 'CUELLO CHINO WAFFLE', color: 'P.Rosa', size: 'M', category: 'Polos' },
  { id: 'p1398', code: 'CUE-1398', name: 'CUELLO CHINO WAFFLE', color: 'P.Rosa', size: 'L', category: 'Polos' },
  { id: 'p1399', code: 'CUE-1399', name: 'CUELLO CHINO WAFFLE', color: 'P.Rosa', size: 'XL', category: 'Polos' },
  { id: 'p1400', code: 'CUE-1400', name: 'CUELLO CHINO WAFFLE', color: 'Perla', size: 'S', category: 'Polos' },
  { id: 'p1401', code: 'CUE-1401', name: 'CUELLO CHINO WAFFLE', color: 'Perla', size: 'M', category: 'Polos' },
  { id: 'p1402', code: 'CUE-1402', name: 'CUELLO CHINO WAFFLE', color: 'Perla', size: 'L', category: 'Polos' },
  { id: 'p1403', code: 'CUE-1403', name: 'CUELLO CHINO WAFFLE', color: 'Perla', size: 'XL', category: 'Polos' },
  { id: 'p1404', code: 'CUE-1404', name: 'CUELLO CHINO WAFFLE', color: 'Plomo', size: 'S', category: 'Polos' },
  { id: 'p1405', code: 'CUE-1405', name: 'CUELLO CHINO WAFFLE', color: 'Plomo', size: 'M', category: 'Polos' },
  { id: 'p1406', code: 'CUE-1406', name: 'CUELLO CHINO WAFFLE', color: 'Plomo', size: 'L', category: 'Polos' },
  { id: 'p1407', code: 'CUE-1407', name: 'CUELLO CHINO WAFFLE', color: 'Plomo', size: 'XL', category: 'Polos' },
  { id: 'p1408', code: 'CUE-1408', name: 'CUELLO CHINO WAFFLE', color: 'Vino', size: 'S', category: 'Polos' },
  { id: 'p1409', code: 'CUE-1409', name: 'CUELLO CHINO WAFFLE', color: 'Vino', size: 'M', category: 'Polos' },
  { id: 'p1410', code: 'CUE-1410', name: 'CUELLO CHINO WAFFLE', color: 'Vino', size: 'L', category: 'Polos' },
  { id: 'p1411', code: 'CUE-1411', name: 'CUELLO CHINO WAFFLE', color: 'Vino', size: 'XL', category: 'Polos' },
  { id: 'p1412', code: 'JER-1412', name: 'JERSEY MANGA LARGA', color: 'Azul', size: 'S', category: 'Polos' },
  { id: 'p1413', code: 'JER-1413', name: 'JERSEY MANGA LARGA', color: 'Azul', size: 'M', category: 'Polos' },
  { id: 'p1414', code: 'JER-1414', name: 'JERSEY MANGA LARGA', color: 'Azul', size: 'L', category: 'Polos' },
  { id: 'p1415', code: 'JER-1415', name: 'JERSEY MANGA LARGA', color: 'Azul', size: 'XL', category: 'Polos' },
  { id: 'p1416', code: 'JER-1416', name: 'JERSEY MANGA LARGA', color: 'Beige', size: 'S', category: 'Polos' },
  { id: 'p1417', code: 'JER-1417', name: 'JERSEY MANGA LARGA', color: 'Beige', size: 'M', category: 'Polos' },
  { id: 'p1418', code: 'JER-1418', name: 'JERSEY MANGA LARGA', color: 'Beige', size: 'L', category: 'Polos' },
  { id: 'p1419', code: 'JER-1419', name: 'JERSEY MANGA LARGA', color: 'Beige', size: 'XL', category: 'Polos' },
  { id: 'p1420', code: 'JER-1420', name: 'JERSEY MANGA LARGA', color: 'Cemento', size: 'S', category: 'Polos' },
  { id: 'p1421', code: 'JER-1421', name: 'JERSEY MANGA LARGA', color: 'Cemento', size: 'M', category: 'Polos' },
  { id: 'p1422', code: 'JER-1422', name: 'JERSEY MANGA LARGA', color: 'Cemento', size: 'L', category: 'Polos' },
  { id: 'p1423', code: 'JER-1423', name: 'JERSEY MANGA LARGA', color: 'Cemento', size: 'XL', category: 'Polos' },
  { id: 'p1424', code: 'JER-1424', name: 'JERSEY MANGA LARGA', color: 'Denim', size: 'S', category: 'Polos' },
  { id: 'p1425', code: 'JER-1425', name: 'JERSEY MANGA LARGA', color: 'Denim', size: 'M', category: 'Polos' },
  { id: 'p1426', code: 'JER-1426', name: 'JERSEY MANGA LARGA', color: 'Denim', size: 'L', category: 'Polos' },
  { id: 'p1427', code: 'JER-1427', name: 'JERSEY MANGA LARGA', color: 'Denim', size: 'XL', category: 'Polos' },
  { id: 'p1428', code: 'JER-1428', name: 'JERSEY MANGA LARGA', color: 'Melanqe O.', size: 'S', category: 'Polos' },
  { id: 'p1429', code: 'JER-1429', name: 'JERSEY MANGA LARGA', color: 'Melanqe O.', size: 'M', category: 'Polos' },
  { id: 'p1430', code: 'JER-1430', name: 'JERSEY MANGA LARGA', color: 'Melanqe O.', size: 'L', category: 'Polos' },
  { id: 'p1431', code: 'JER-1431', name: 'JERSEY MANGA LARGA', color: 'Melanqe O.', size: 'XL', category: 'Polos' },
  { id: 'p1432', code: 'JER-1432', name: 'JERSEY MANGA LARGA', color: 'Negro', size: 'S', category: 'Polos' },
  { id: 'p1433', code: 'JER-1433', name: 'JERSEY MANGA LARGA', color: 'Negro', size: 'M', category: 'Polos' },
  { id: 'p1434', code: 'JER-1434', name: 'JERSEY MANGA LARGA', color: 'Negro', size: 'L', category: 'Polos' },
  { id: 'p1435', code: 'JER-1435', name: 'JERSEY MANGA LARGA', color: 'Negro', size: 'XL', category: 'Polos' },
  { id: 'p1436', code: 'JER-1436', name: 'JERSEY MANGA LARGA', color: 'Topo', size: 'S', category: 'Polos' },
  { id: 'p1437', code: 'JER-1437', name: 'JERSEY MANGA LARGA', color: 'Topo', size: 'M', category: 'Polos' },
  { id: 'p1438', code: 'JER-1438', name: 'JERSEY MANGA LARGA', color: 'Topo', size: 'L', category: 'Polos' },
  { id: 'p1439', code: 'JER-1439', name: 'JERSEY MANGA LARGA', color: 'Topo', size: 'XL', category: 'Polos' },
  { id: 'p1440', code: 'JER-1440', name: 'JERSEY MANGA LARGA', color: 'Pacay', size: 'S', category: 'Polos' },
  { id: 'p1441', code: 'JER-1441', name: 'JERSEY MANGA LARGA', color: 'Pacay', size: 'M', category: 'Polos' },
  { id: 'p1442', code: 'JER-1442', name: 'JERSEY MANGA LARGA', color: 'Pacay', size: 'L', category: 'Polos' },
  { id: 'p1443', code: 'JER-1443', name: 'JERSEY MANGA LARGA', color: 'Pacay', size: 'XL', category: 'Polos' },
  { id: 'p1444', code: 'JER-1444', name: 'JERSEY MANGA LARGA', color: 'P.Rosa', size: 'S', category: 'Polos' },
  { id: 'p1445', code: 'JER-1445', name: 'JERSEY MANGA LARGA', color: 'P.Rosa', size: 'M', category: 'Polos' },
  { id: 'p1446', code: 'JER-1446', name: 'JERSEY MANGA LARGA', color: 'P.Rosa', size: 'L', category: 'Polos' },
  { id: 'p1447', code: 'JER-1447', name: 'JERSEY MANGA LARGA', color: 'P.Rosa', size: 'XL', category: 'Polos' },
  { id: 'p1448', code: 'JER-1448', name: 'JERSEY MANGA LARGA', color: 'Perla', size: 'S', category: 'Polos' },
  { id: 'p1449', code: 'JER-1449', name: 'JERSEY MANGA LARGA', color: 'Perla', size: 'M', category: 'Polos' },
  { id: 'p1450', code: 'JER-1450', name: 'JERSEY MANGA LARGA', color: 'Perla', size: 'L', category: 'Polos' },
  { id: 'p1451', code: 'JER-1451', name: 'JERSEY MANGA LARGA', color: 'Perla', size: 'XL', category: 'Polos' },
  { id: 'p1452', code: 'JER-1452', name: 'JERSEY MANGA LARGA', color: 'Plomo', size: 'S', category: 'Polos' },
  { id: 'p1453', code: 'JER-1453', name: 'JERSEY MANGA LARGA', color: 'Plomo', size: 'M', category: 'Polos' },
  { id: 'p1454', code: 'JER-1454', name: 'JERSEY MANGA LARGA', color: 'Plomo', size: 'L', category: 'Polos' },
  { id: 'p1455', code: 'JER-1455', name: 'JERSEY MANGA LARGA', color: 'Plomo', size: 'XL', category: 'Polos' },
  { id: 'p1456', code: 'JER-1456', name: 'JERSEY MANGA LARGA', color: 'Vino', size: 'S', category: 'Polos' },
  { id: 'p1457', code: 'JER-1457', name: 'JERSEY MANGA LARGA', color: 'Vino', size: 'M', category: 'Polos' },
  { id: 'p1458', code: 'JER-1458', name: 'JERSEY MANGA LARGA', color: 'Vino', size: 'L', category: 'Polos' },
  { id: 'p1459', code: 'JER-1459', name: 'JERSEY MANGA LARGA', color: 'Vino', size: 'XL', category: 'Polos' },
  { id: 'p1460', code: 'BAB-1460', name: 'BABY TY ESCOTE', color: 'Azul', size: 'S', category: 'Polos' },
  { id: 'p1461', code: 'BAB-1461', name: 'BABY TY ESCOTE', color: 'Azul', size: 'M', category: 'Polos' },
  { id: 'p1462', code: 'BAB-1462', name: 'BABY TY ESCOTE', color: 'Azul', size: 'L', category: 'Polos' },
  { id: 'p1463', code: 'BAB-1463', name: 'BABY TY ESCOTE', color: 'Beige', size: 'S', category: 'Polos' },
  { id: 'p1464', code: 'BAB-1464', name: 'BABY TY ESCOTE', color: 'Beige', size: 'M', category: 'Polos' },
  { id: 'p1465', code: 'BAB-1465', name: 'BABY TY ESCOTE', color: 'Beige', size: 'L', category: 'Polos' },
  { id: 'p1466', code: 'BAB-1466', name: 'BABY TY ESCOTE', color: 'Cemento', size: 'S', category: 'Polos' },
  { id: 'p1467', code: 'BAB-1467', name: 'BABY TY ESCOTE', color: 'Cemento', size: 'M', category: 'Polos' },
  { id: 'p1468', code: 'BAB-1468', name: 'BABY TY ESCOTE', color: 'Cemento', size: 'L', category: 'Polos' },
  { id: 'p1469', code: 'BAB-1469', name: 'BABY TY ESCOTE', color: 'Denim', size: 'S', category: 'Polos' },
  { id: 'p1470', code: 'BAB-1470', name: 'BABY TY ESCOTE', color: 'Denim', size: 'M', category: 'Polos' },
  { id: 'p1471', code: 'BAB-1471', name: 'BABY TY ESCOTE', color: 'Denim', size: 'L', category: 'Polos' },
  { id: 'p1472', code: 'BAB-1472', name: 'BABY TY ESCOTE', color: 'Negro', size: 'S', category: 'Polos' },
  { id: 'p1473', code: 'BAB-1473', name: 'BABY TY ESCOTE', color: 'Negro', size: 'M', category: 'Polos' },
  { id: 'p1474', code: 'BAB-1474', name: 'BABY TY ESCOTE', color: 'Negro', size: 'L', category: 'Polos' },
  { id: 'p1475', code: 'BAB-1475', name: 'BABY TY ESCOTE', color: 'Pacay', size: 'S', category: 'Polos' },
  { id: 'p1476', code: 'BAB-1476', name: 'BABY TY ESCOTE', color: 'Pacay', size: 'M', category: 'Polos' },
  { id: 'p1477', code: 'BAB-1477', name: 'BABY TY ESCOTE', color: 'Pacay', size: 'L', category: 'Polos' },
  { id: 'p1478', code: 'BAB-1478', name: 'BABY TY ESCOTE', color: 'P.Rosa', size: 'S', category: 'Polos' },
  { id: 'p1479', code: 'BAB-1479', name: 'BABY TY ESCOTE', color: 'P.Rosa', size: 'M', category: 'Polos' },
  { id: 'p1480', code: 'BAB-1480', name: 'BABY TY ESCOTE', color: 'P.Rosa', size: 'L', category: 'Polos' },
  { id: 'p1481', code: 'BAB-1481', name: 'BABY TY ESCOTE', color: 'Perla', size: 'S', category: 'Polos' },
  { id: 'p1482', code: 'BAB-1482', name: 'BABY TY ESCOTE', color: 'Perla', size: 'M', category: 'Polos' },
  { id: 'p1483', code: 'BAB-1483', name: 'BABY TY ESCOTE', color: 'Perla', size: 'L', category: 'Polos' },
  { id: 'p1484', code: 'BAB-1484', name: 'BABY TY ESCOTE', color: 'Plomo', size: 'S', category: 'Polos' },
  { id: 'p1485', code: 'BAB-1485', name: 'BABY TY ESCOTE', color: 'Plomo', size: 'M', category: 'Polos' },
  { id: 'p1486', code: 'BAB-1486', name: 'BABY TY ESCOTE', color: 'Plomo', size: 'L', category: 'Polos' },
  { id: 'p1487', code: 'BAB-1487', name: 'BABY TY ESCOTE', color: 'Vino', size: 'S', category: 'Polos' },
  { id: 'p1488', code: 'BAB-1488', name: 'BABY TY ESCOTE', color: 'Vino', size: 'M', category: 'Polos' },
  { id: 'p1489', code: 'BAB-1489', name: 'BABY TY ESCOTE', color: 'Vino', size: 'L', category: 'Polos' },
  { id: 'p1490', code: 'BAB-1490', name: 'BABY TY', color: 'Azul', size: 'S', category: 'Polos' },
  { id: 'p1491', code: 'BAB-1491', name: 'BABY TY', color: 'Azul', size: 'M', category: 'Polos' },
  { id: 'p1492', code: 'BAB-1492', name: 'BABY TY', color: 'Azul', size: 'L', category: 'Polos' },
  { id: 'p1493', code: 'BAB-1493', name: 'BABY TY', color: 'Beige', size: 'S', category: 'Polos' },
  { id: 'p1494', code: 'BAB-1494', name: 'BABY TY', color: 'Beige', size: 'M', category: 'Polos' },
  { id: 'p1495', code: 'BAB-1495', name: 'BABY TY', color: 'Beige', size: 'L', category: 'Polos' },
  { id: 'p1496', code: 'BAB-1496', name: 'BABY TY', color: 'Cemento', size: 'S', category: 'Polos' },
  { id: 'p1497', code: 'BAB-1497', name: 'BABY TY', color: 'Cemento', size: 'M', category: 'Polos' },
  { id: 'p1498', code: 'BAB-1498', name: 'BABY TY', color: 'Cemento', size: 'L', category: 'Polos' },
  { id: 'p1499', code: 'BAB-1499', name: 'BABY TY', color: 'Denim', size: 'S', category: 'Polos' },
  { id: 'p1500', code: 'BAB-1500', name: 'BABY TY', color: 'Denim', size: 'M', category: 'Polos' },
  { id: 'p1501', code: 'BAB-1501', name: 'BABY TY', color: 'Denim', size: 'L', category: 'Polos' },
  { id: 'p1502', code: 'BAB-1502', name: 'BABY TY', color: 'Melanqe O.', size: 'S', category: 'Polos' },
  { id: 'p1503', code: 'BAB-1503', name: 'BABY TY', color: 'Melanqe O.', size: 'M', category: 'Polos' },
  { id: 'p1504', code: 'BAB-1504', name: 'BABY TY', color: 'Melanqe O.', size: 'L', category: 'Polos' },
  { id: 'p1505', code: 'BAB-1505', name: 'BABY TY', color: 'Negro', size: 'S', category: 'Polos' },
  { id: 'p1506', code: 'BAB-1506', name: 'BABY TY', color: 'Negro', size: 'M', category: 'Polos' },
  { id: 'p1507', code: 'BAB-1507', name: 'BABY TY', color: 'Negro', size: 'L', category: 'Polos' },
  { id: 'p1508', code: 'BAB-1508', name: 'BABY TY', color: 'Pacay', size: 'S', category: 'Polos' },
  { id: 'p1509', code: 'BAB-1509', name: 'BABY TY', color: 'Pacay', size: 'M', category: 'Polos' },
  { id: 'p1510', code: 'BAB-1510', name: 'BABY TY', color: 'Pacay', size: 'L', category: 'Polos' },
  { id: 'p1511', code: 'BAB-1511', name: 'BABY TY', color: 'P.Rosa', size: 'S', category: 'Polos' },
  { id: 'p1512', code: 'BAB-1512', name: 'BABY TY', color: 'P.Rosa', size: 'M', category: 'Polos' },
  { id: 'p1513', code: 'BAB-1513', name: 'BABY TY', color: 'P.Rosa', size: 'L', category: 'Polos' },
  { id: 'p1514', code: 'BAB-1514', name: 'BABY TY', color: 'Perla', size: 'S', category: 'Polos' },
  { id: 'p1515', code: 'BAB-1515', name: 'BABY TY', color: 'Perla', size: 'M', category: 'Polos' },
  { id: 'p1516', code: 'BAB-1516', name: 'BABY TY', color: 'Perla', size: 'L', category: 'Polos' },
  { id: 'p1517', code: 'BAB-1517', name: 'BABY TY', color: 'Plomo', size: 'S', category: 'Polos' },
  { id: 'p1518', code: 'BAB-1518', name: 'BABY TY', color: 'Plomo', size: 'M', category: 'Polos' },
  { id: 'p1519', code: 'BAB-1519', name: 'BABY TY', color: 'Plomo', size: 'L', category: 'Polos' },
  { id: 'p1520', code: 'BAB-1520', name: 'BABY TY', color: 'Vino', size: 'S', category: 'Polos' },
  { id: 'p1521', code: 'BAB-1521', name: 'BABY TY', color: 'Vino', size: 'M', category: 'Polos' },
  { id: 'p1522', code: 'BAB-1522', name: 'BABY TY', color: 'Vino', size: 'L', category: 'Polos' },
  { id: 'p1523', code: 'BAB-1523', name: 'BABY TY', color: 'Menta', size: 'S', category: 'Polos' },
  { id: 'p1524', code: 'BAB-1524', name: 'BABY TY', color: 'Menta', size: 'M', category: 'Polos' },
  { id: 'p1525', code: 'BAB-1525', name: 'BABY TY', color: 'Menta', size: 'L', category: 'Polos' },
  { id: 'p1526', code: 'BAB-1526', name: 'BABY TY ESCOTADO MANGA', color: 'Azul', size: 'S', category: 'Polos' },
  { id: 'p1527', code: 'BAB-1527', name: 'BABY TY ESCOTADO MANGA', color: 'Azul', size: 'M', category: 'Polos' },
  { id: 'p1528', code: 'BAB-1528', name: 'BABY TY ESCOTADO MANGA', color: 'Azul', size: 'L', category: 'Polos' },
  { id: 'p1529', code: 'BAB-1529', name: 'BABY TY ESCOTADO MANGA', color: 'Beige', size: 'S', category: 'Polos' },
  { id: 'p1530', code: 'BAB-1530', name: 'BABY TY ESCOTADO MANGA', color: 'Beige', size: 'M', category: 'Polos' },
  { id: 'p1531', code: 'BAB-1531', name: 'BABY TY ESCOTADO MANGA', color: 'Beige', size: 'L', category: 'Polos' },
  { id: 'p1532', code: 'BAB-1532', name: 'BABY TY ESCOTADO MANGA', color: 'Cemento', size: 'S', category: 'Polos' },
  { id: 'p1533', code: 'BAB-1533', name: 'BABY TY ESCOTADO MANGA', color: 'Cemento', size: 'M', category: 'Polos' },
  { id: 'p1534', code: 'BAB-1534', name: 'BABY TY ESCOTADO MANGA', color: 'Cemento', size: 'L', category: 'Polos' },
  { id: 'p1535', code: 'BAB-1535', name: 'BABY TY ESCOTADO MANGA', color: 'Denim', size: 'S', category: 'Polos' },
  { id: 'p1536', code: 'BAB-1536', name: 'BABY TY ESCOTADO MANGA', color: 'Denim', size: 'M', category: 'Polos' },
  { id: 'p1537', code: 'BAB-1537', name: 'BABY TY ESCOTADO MANGA', color: 'Denim', size: 'L', category: 'Polos' },
  { id: 'p1538', code: 'BAB-1538', name: 'BABY TY ESCOTADO MANGA', color: 'Negro', size: 'S', category: 'Polos' },
  { id: 'p1539', code: 'BAB-1539', name: 'BABY TY ESCOTADO MANGA', color: 'Negro', size: 'M', category: 'Polos' },
  { id: 'p1540', code: 'BAB-1540', name: 'BABY TY ESCOTADO MANGA', color: 'Negro', size: 'L', category: 'Polos' },
  { id: 'p1541', code: 'BAB-1541', name: 'BABY TY ESCOTADO MANGA', color: 'Pacay', size: 'S', category: 'Polos' },
  { id: 'p1542', code: 'BAB-1542', name: 'BABY TY ESCOTADO MANGA', color: 'Pacay', size: 'M', category: 'Polos' },
  { id: 'p1543', code: 'BAB-1543', name: 'BABY TY ESCOTADO MANGA', color: 'Pacay', size: 'L', category: 'Polos' },
  { id: 'p1544', code: 'BAB-1544', name: 'BABY TY ESCOTADO MANGA', color: 'P.Rosa', size: 'S', category: 'Polos' },
  { id: 'p1545', code: 'BAB-1545', name: 'BABY TY ESCOTADO MANGA', color: 'P.Rosa', size: 'M', category: 'Polos' },
  { id: 'p1546', code: 'BAB-1546', name: 'BABY TY ESCOTADO MANGA', color: 'P.Rosa', size: 'L', category: 'Polos' },
  { id: 'p1547', code: 'BAB-1547', name: 'BABY TY ESCOTADO MANGA', color: 'Perla', size: 'S', category: 'Polos' },
  { id: 'p1548', code: 'BAB-1548', name: 'BABY TY ESCOTADO MANGA', color: 'Perla', size: 'M', category: 'Polos' },
  { id: 'p1549', code: 'BAB-1549', name: 'BABY TY ESCOTADO MANGA', color: 'Perla', size: 'L', category: 'Polos' },
  { id: 'p1550', code: 'BAB-1550', name: 'BABY TY ESCOTADO MANGA', color: 'Plomo', size: 'S', category: 'Polos' },
  { id: 'p1551', code: 'BAB-1551', name: 'BABY TY ESCOTADO MANGA', color: 'Plomo', size: 'M', category: 'Polos' },
  { id: 'p1552', code: 'BAB-1552', name: 'BABY TY ESCOTADO MANGA', color: 'Plomo', size: 'L', category: 'Polos' },
  { id: 'p1553', code: 'BAB-1553', name: 'BABY TY ESCOTADO MANGA', color: 'Vino', size: 'S', category: 'Polos' },
  { id: 'p1554', code: 'BAB-1554', name: 'BABY TY ESCOTADO MANGA', color: 'Vino', size: 'M', category: 'Polos' },
  { id: 'p1555', code: 'BAB-1555', name: 'BABY TY ESCOTADO MANGA', color: 'Vino', size: 'L', category: 'Polos' },
  { id: 'p1556', code: 'BAB-1556', name: 'BABY TY MANGA', color: 'Azul', size: 'S', category: 'Polos' },
  { id: 'p1557', code: 'BAB-1557', name: 'BABY TY MANGA', color: 'Azul', size: 'M', category: 'Polos' },
  { id: 'p1558', code: 'BAB-1558', name: 'BABY TY MANGA', color: 'Azul', size: 'L', category: 'Polos' },
  { id: 'p1559', code: 'BAB-1559', name: 'BABY TY MANGA', color: 'Beige', size: 'S', category: 'Polos' },
  { id: 'p1560', code: 'BAB-1560', name: 'BABY TY MANGA', color: 'Beige', size: 'M', category: 'Polos' },
  { id: 'p1561', code: 'BAB-1561', name: 'BABY TY MANGA', color: 'Beige', size: 'L', category: 'Polos' },
  { id: 'p1562', code: 'BAB-1562', name: 'BABY TY MANGA', color: 'Cemento', size: 'S', category: 'Polos' },
  { id: 'p1563', code: 'BAB-1563', name: 'BABY TY MANGA', color: 'Cemento', size: 'M', category: 'Polos' },
  { id: 'p1564', code: 'BAB-1564', name: 'BABY TY MANGA', color: 'Cemento', size: 'L', category: 'Polos' },
  { id: 'p1565', code: 'BAB-1565', name: 'BABY TY MANGA', color: 'Denim', size: 'S', category: 'Polos' },
  { id: 'p1566', code: 'BAB-1566', name: 'BABY TY MANGA', color: 'Denim', size: 'M', category: 'Polos' },
  { id: 'p1567', code: 'BAB-1567', name: 'BABY TY MANGA', color: 'Denim', size: 'L', category: 'Polos' },
  { id: 'p1568', code: 'BAB-1568', name: 'BABY TY MANGA', color: 'Melanqe O.', size: 'S', category: 'Polos' },
  { id: 'p1569', code: 'BAB-1569', name: 'BABY TY MANGA', color: 'Melanqe O.', size: 'M', category: 'Polos' },
  { id: 'p1570', code: 'BAB-1570', name: 'BABY TY MANGA', color: 'Melanqe O.', size: 'L', category: 'Polos' },
  { id: 'p1571', code: 'BAB-1571', name: 'BABY TY MANGA', color: 'Negro', size: 'S', category: 'Polos' },
  { id: 'p1572', code: 'BAB-1572', name: 'BABY TY MANGA', color: 'Negro', size: 'M', category: 'Polos' },
  { id: 'p1573', code: 'BAB-1573', name: 'BABY TY MANGA', color: 'Negro', size: 'L', category: 'Polos' },
  { id: 'p1574', code: 'BAB-1574', name: 'BABY TY MANGA', color: 'Pacay', size: 'S', category: 'Polos' },
  { id: 'p1575', code: 'BAB-1575', name: 'BABY TY MANGA', color: 'Pacay', size: 'M', category: 'Polos' },
  { id: 'p1576', code: 'BAB-1576', name: 'BABY TY MANGA', color: 'Pacay', size: 'L', category: 'Polos' },
  { id: 'p1577', code: 'BAB-1577', name: 'BABY TY MANGA', color: 'P.Rosa', size: 'S', category: 'Polos' },
  { id: 'p1578', code: 'BAB-1578', name: 'BABY TY MANGA', color: 'P.Rosa', size: 'M', category: 'Polos' },
  { id: 'p1579', code: 'BAB-1579', name: 'BABY TY MANGA', color: 'P.Rosa', size: 'L', category: 'Polos' },
  { id: 'p1580', code: 'BAB-1580', name: 'BABY TY MANGA', color: 'Perla', size: 'S', category: 'Polos' },
  { id: 'p1581', code: 'BAB-1581', name: 'BABY TY MANGA', color: 'Perla', size: 'M', category: 'Polos' },
  { id: 'p1582', code: 'BAB-1582', name: 'BABY TY MANGA', color: 'Perla', size: 'L', category: 'Polos' },
  { id: 'p1583', code: 'BAB-1583', name: 'BABY TY MANGA', color: 'Plomo', size: 'S', category: 'Polos' },
  { id: 'p1584', code: 'BAB-1584', name: 'BABY TY MANGA', color: 'Plomo', size: 'M', category: 'Polos' },
  { id: 'p1585', code: 'BAB-1585', name: 'BABY TY MANGA', color: 'Plomo', size: 'L', category: 'Polos' },
  { id: 'p1586', code: 'BAB-1586', name: 'BABY TY MANGA', color: 'Vino', size: 'S', category: 'Polos' },
  { id: 'p1587', code: 'BAB-1587', name: 'BABY TY MANGA', color: 'Vino', size: 'M', category: 'Polos' },
  { id: 'p1588', code: 'BAB-1588', name: 'BABY TY MANGA', color: 'Vino', size: 'L', category: 'Polos' },
  { id: 'p1589', code: 'BAB-1589', name: 'BABY TY MANGA', color: 'Menta', size: 'S', category: 'Polos' },
  { id: 'p1590', code: 'BAB-1590', name: 'BABY TY MANGA', color: 'Menta', size: 'M', category: 'Polos' },
  { id: 'p1591', code: 'BAB-1591', name: 'BABY TY MANGA', color: 'Menta', size: 'L', category: 'Polos' },
  { id: 'p1592', code: 'TOP-1592', name: 'TOP RIB', color: 'Azul', size: 'S', category: 'Polos' },
  { id: 'p1593', code: 'TOP-1593', name: 'TOP RIB', color: 'Beige', size: 'S', category: 'Polos' },
  { id: 'p1594', code: 'TOP-1594', name: 'TOP RIB', color: 'Cemento', size: 'S', category: 'Polos' },
  { id: 'p1595', code: 'TOP-1595', name: 'TOP RIB', color: 'Denim', size: 'S', category: 'Polos' },
  { id: 'p1596', code: 'TOP-1596', name: 'TOP RIB', color: 'Negro', size: 'S', category: 'Polos' },
  { id: 'p1597', code: 'TOP-1597', name: 'TOP RIB', color: 'Pacay', size: 'S', category: 'Polos' },
  { id: 'p1598', code: 'TOP-1598', name: 'TOP RIB', color: 'P.Rosa', size: 'S', category: 'Polos' },
  { id: 'p1599', code: 'TOP-1599', name: 'TOP RIB', color: 'Perla', size: 'S', category: 'Polos' },
  { id: 'p1600', code: 'TOP-1600', name: 'TOP RIB', color: 'Vino', size: 'S', category: 'Polos' },
  { id: 'p1601', code: 'TOP-1601', name: 'TOP RIB MANGA', color: 'Azul', size: 'S', category: 'Polos' },
  { id: 'p1602', code: 'TOP-1602', name: 'TOP RIB MANGA', color: 'Beige', size: 'S', category: 'Polos' },
  { id: 'p1603', code: 'TOP-1603', name: 'TOP RIB MANGA', color: 'Cemento', size: 'S', category: 'Polos' },
  { id: 'p1604', code: 'TOP-1604', name: 'TOP RIB MANGA', color: 'Denim', size: 'S', category: 'Polos' },
  { id: 'p1605', code: 'TOP-1605', name: 'TOP RIB MANGA', color: 'Negro', size: 'S', category: 'Polos' },
  { id: 'p1606', code: 'TOP-1606', name: 'TOP RIB MANGA', color: 'Pacay', size: 'S', category: 'Polos' },
  { id: 'p1607', code: 'TOP-1607', name: 'TOP RIB MANGA', color: 'P.Rosa', size: 'S', category: 'Polos' },
  { id: 'p1608', code: 'TOP-1608', name: 'TOP RIB MANGA', color: 'Perla', size: 'S', category: 'Polos' },
  { id: 'p1609', code: 'TOP-1609', name: 'TOP RIB MANGA', color: 'Vino', size: 'S', category: 'Polos' },
  { id: 'p1610', code: 'CLA-1610', name: 'CLASICO', color: 'Azul', size: 'S', category: 'Polos' },
  { id: 'p1611', code: 'CLA-1611', name: 'CLASICO', color: 'Azul', size: 'M', category: 'Polos' },
  { id: 'p1612', code: 'CLA-1612', name: 'CLASICO', color: 'Azul', size: 'L', category: 'Polos' },
  { id: 'p1613', code: 'CLA-1613', name: 'CLASICO', color: 'Azul', size: 'XL', category: 'Polos' },
  { id: 'p1614', code: 'CLA-1614', name: 'CLASICO', color: 'Beige', size: 'S', category: 'Polos' },
  { id: 'p1615', code: 'CLA-1615', name: 'CLASICO', color: 'Beige', size: 'M', category: 'Polos' },
  { id: 'p1616', code: 'CLA-1616', name: 'CLASICO', color: 'Beige', size: 'L', category: 'Polos' },
  { id: 'p1617', code: 'CLA-1617', name: 'CLASICO', color: 'Beige', size: 'XL', category: 'Polos' },
  { id: 'p1618', code: 'CLA-1618', name: 'CLASICO', color: 'Botella', size: 'S', category: 'Polos' },
  { id: 'p1619', code: 'CLA-1619', name: 'CLASICO', color: 'Botella', size: 'M', category: 'Polos' },
  { id: 'p1620', code: 'CLA-1620', name: 'CLASICO', color: 'Botella', size: 'L', category: 'Polos' },
  { id: 'p1621', code: 'CLA-1621', name: 'CLASICO', color: 'Botella', size: 'XL', category: 'Polos' },
  { id: 'p1622', code: 'CLA-1622', name: 'CLASICO', color: 'Camote', size: 'S', category: 'Polos' },
  { id: 'p1623', code: 'CLA-1623', name: 'CLASICO', color: 'Camote', size: 'M', category: 'Polos' },
  { id: 'p1624', code: 'CLA-1624', name: 'CLASICO', color: 'Camote', size: 'L', category: 'Polos' },
  { id: 'p1625', code: 'CLA-1625', name: 'CLASICO', color: 'Camote', size: 'XL', category: 'Polos' },
  { id: 'p1626', code: 'CLA-1626', name: 'CLASICO', color: 'Cemento', size: 'S', category: 'Polos' },
  { id: 'p1627', code: 'CLA-1627', name: 'CLASICO', color: 'Cemento', size: 'M', category: 'Polos' },
  { id: 'p1628', code: 'CLA-1628', name: 'CLASICO', color: 'Cemento', size: 'L', category: 'Polos' },
  { id: 'p1629', code: 'CLA-1629', name: 'CLASICO', color: 'Cemento', size: 'XL', category: 'Polos' },
  { id: 'p1630', code: 'CLA-1630', name: 'CLASICO', color: 'Denim', size: 'S', category: 'Polos' },
  { id: 'p1631', code: 'CLA-1631', name: 'CLASICO', color: 'Denim', size: 'M', category: 'Polos' },
  { id: 'p1632', code: 'CLA-1632', name: 'CLASICO', color: 'Denim', size: 'L', category: 'Polos' },
  { id: 'p1633', code: 'CLA-1633', name: 'CLASICO', color: 'Denim', size: 'XL', category: 'Polos' },
  { id: 'p1634', code: 'CLA-1634', name: 'CLASICO', color: 'Marron', size: 'S', category: 'Polos' },
  { id: 'p1635', code: 'CLA-1635', name: 'CLASICO', color: 'Marron', size: 'M', category: 'Polos' },
  { id: 'p1636', code: 'CLA-1636', name: 'CLASICO', color: 'Marron', size: 'L', category: 'Polos' },
  { id: 'p1637', code: 'CLA-1637', name: 'CLASICO', color: 'Marron', size: 'XL', category: 'Polos' },
  { id: 'p1638', code: 'CLA-1638', name: 'CLASICO', color: 'Melanqe O.', size: 'S', category: 'Polos' },
  { id: 'p1639', code: 'CLA-1639', name: 'CLASICO', color: 'Melanqe O.', size: 'M', category: 'Polos' },
  { id: 'p1640', code: 'CLA-1640', name: 'CLASICO', color: 'Melanqe O.', size: 'L', category: 'Polos' },
  { id: 'p1641', code: 'CLA-1641', name: 'CLASICO', color: 'Melanqe O.', size: 'XL', category: 'Polos' },
  { id: 'p1642', code: 'CLA-1642', name: 'CLASICO', color: 'Negro', size: 'S', category: 'Polos' },
  { id: 'p1643', code: 'CLA-1643', name: 'CLASICO', color: 'Negro', size: 'M', category: 'Polos' },
  { id: 'p1644', code: 'CLA-1644', name: 'CLASICO', color: 'Negro', size: 'L', category: 'Polos' },
  { id: 'p1645', code: 'CLA-1645', name: 'CLASICO', color: 'Negro', size: 'XL', category: 'Polos' },
  { id: 'p1646', code: 'CLA-1646', name: 'CLASICO', color: 'Topo', size: 'S', category: 'Polos' },
  { id: 'p1647', code: 'CLA-1647', name: 'CLASICO', color: 'Topo', size: 'M', category: 'Polos' },
  { id: 'p1648', code: 'CLA-1648', name: 'CLASICO', color: 'Topo', size: 'L', category: 'Polos' },
  { id: 'p1649', code: 'CLA-1649', name: 'CLASICO', color: 'Topo', size: 'XL', category: 'Polos' },
  { id: 'p1650', code: 'CLA-1650', name: 'CLASICO', color: 'Pacay', size: 'S', category: 'Polos' },
  { id: 'p1651', code: 'CLA-1651', name: 'CLASICO', color: 'Pacay', size: 'M', category: 'Polos' },
  { id: 'p1652', code: 'CLA-1652', name: 'CLASICO', color: 'Pacay', size: 'L', category: 'Polos' },
  { id: 'p1653', code: 'CLA-1653', name: 'CLASICO', color: 'Pacay', size: 'XL', category: 'Polos' },
  { id: 'p1654', code: 'CLA-1654', name: 'CLASICO', color: 'P.Rosa', size: 'S', category: 'Polos' },
  { id: 'p1655', code: 'CLA-1655', name: 'CLASICO', color: 'P.Rosa', size: 'M', category: 'Polos' },
  { id: 'p1656', code: 'CLA-1656', name: 'CLASICO', color: 'P.Rosa', size: 'L', category: 'Polos' },
  { id: 'p1657', code: 'CLA-1657', name: 'CLASICO', color: 'P.Rosa', size: 'XL', category: 'Polos' },
  { id: 'p1658', code: 'CLA-1658', name: 'CLASICO', color: 'Perla', size: 'S', category: 'Polos' },
  { id: 'p1659', code: 'CLA-1659', name: 'CLASICO', color: 'Perla', size: 'M', category: 'Polos' },
  { id: 'p1660', code: 'CLA-1660', name: 'CLASICO', color: 'Perla', size: 'L', category: 'Polos' },
  { id: 'p1661', code: 'CLA-1661', name: 'CLASICO', color: 'Perla', size: 'XL', category: 'Polos' },
  { id: 'p1662', code: 'CLA-1662', name: 'CLASICO', color: 'Plomo', size: 'S', category: 'Polos' },
  { id: 'p1663', code: 'CLA-1663', name: 'CLASICO', color: 'Plomo', size: 'M', category: 'Polos' },
  { id: 'p1664', code: 'CLA-1664', name: 'CLASICO', color: 'Plomo', size: 'L', category: 'Polos' },
  { id: 'p1665', code: 'CLA-1665', name: 'CLASICO', color: 'Plomo', size: 'XL', category: 'Polos' },
  { id: 'p1666', code: 'CLA-1666', name: 'CLASICO', color: 'Vino', size: 'S', category: 'Polos' },
  { id: 'p1667', code: 'CLA-1667', name: 'CLASICO', color: 'Vino', size: 'M', category: 'Polos' },
  { id: 'p1668', code: 'CLA-1668', name: 'CLASICO', color: 'Vino', size: 'L', category: 'Polos' },
  { id: 'p1669', code: 'CLA-1669', name: 'CLASICO', color: 'Vino', size: 'XL', category: 'Polos' },
  { id: 'p1670', code: 'OVE-1670', name: 'OVERSIZE', color: 'Azul', size: 'S', category: 'Polos' },
  { id: 'p1671', code: 'OVE-1671', name: 'OVERSIZE', color: 'Azul', size: 'M', category: 'Polos' },
  { id: 'p1672', code: 'OVE-1672', name: 'OVERSIZE', color: 'Azul', size: 'L', category: 'Polos' },
  { id: 'p1673', code: 'OVE-1673', name: 'OVERSIZE', color: 'Azul', size: 'XL', category: 'Polos' },
  { id: 'p1674', code: 'OVE-1674', name: 'OVERSIZE', color: 'Beige', size: 'S', category: 'Polos' },
  { id: 'p1675', code: 'OVE-1675', name: 'OVERSIZE', color: 'Beige', size: 'M', category: 'Polos' },
  { id: 'p1676', code: 'OVE-1676', name: 'OVERSIZE', color: 'Beige', size: 'L', category: 'Polos' },
  { id: 'p1677', code: 'OVE-1677', name: 'OVERSIZE', color: 'Beige', size: 'XL', category: 'Polos' },
  { id: 'p1678', code: 'OVE-1678', name: 'OVERSIZE', color: 'Botella', size: 'S', category: 'Polos' },
  { id: 'p1679', code: 'OVE-1679', name: 'OVERSIZE', color: 'Botella', size: 'M', category: 'Polos' },
  { id: 'p1680', code: 'OVE-1680', name: 'OVERSIZE', color: 'Botella', size: 'L', category: 'Polos' },
  { id: 'p1681', code: 'OVE-1681', name: 'OVERSIZE', color: 'Botella', size: 'XL', category: 'Polos' },
  { id: 'p1682', code: 'OVE-1682', name: 'OVERSIZE', color: 'Camote', size: 'S', category: 'Polos' },
  { id: 'p1683', code: 'OVE-1683', name: 'OVERSIZE', color: 'Camote', size: 'M', category: 'Polos' },
  { id: 'p1684', code: 'OVE-1684', name: 'OVERSIZE', color: 'Camote', size: 'L', category: 'Polos' },
  { id: 'p1685', code: 'OVE-1685', name: 'OVERSIZE', color: 'Camote', size: 'XL', category: 'Polos' },
  { id: 'p1686', code: 'OVE-1686', name: 'OVERSIZE', color: 'Cemento', size: 'S', category: 'Polos' },
  { id: 'p1687', code: 'OVE-1687', name: 'OVERSIZE', color: 'Cemento', size: 'M', category: 'Polos' },
  { id: 'p1688', code: 'OVE-1688', name: 'OVERSIZE', color: 'Cemento', size: 'L', category: 'Polos' },
  { id: 'p1689', code: 'OVE-1689', name: 'OVERSIZE', color: 'Cemento', size: 'XL', category: 'Polos' },
  { id: 'p1690', code: 'OVE-1690', name: 'OVERSIZE', color: 'Denim', size: 'S', category: 'Polos' },
  { id: 'p1691', code: 'OVE-1691', name: 'OVERSIZE', color: 'Denim', size: 'M', category: 'Polos' },
  { id: 'p1692', code: 'OVE-1692', name: 'OVERSIZE', color: 'Denim', size: 'L', category: 'Polos' },
  { id: 'p1693', code: 'OVE-1693', name: 'OVERSIZE', color: 'Denim', size: 'XL', category: 'Polos' },
  { id: 'p1694', code: 'OVE-1694', name: 'OVERSIZE', color: 'Marron', size: 'S', category: 'Polos' },
  { id: 'p1695', code: 'OVE-1695', name: 'OVERSIZE', color: 'Marron', size: 'M', category: 'Polos' },
  { id: 'p1696', code: 'OVE-1696', name: 'OVERSIZE', color: 'Marron', size: 'L', category: 'Polos' },
  { id: 'p1697', code: 'OVE-1697', name: 'OVERSIZE', color: 'Marron', size: 'XL', category: 'Polos' },
  { id: 'p1698', code: 'OVE-1698', name: 'OVERSIZE', color: 'Melanqe O.', size: 'S', category: 'Polos' },
  { id: 'p1699', code: 'OVE-1699', name: 'OVERSIZE', color: 'Melanqe O.', size: 'M', category: 'Polos' },
  { id: 'p1700', code: 'OVE-1700', name: 'OVERSIZE', color: 'Melanqe O.', size: 'L', category: 'Polos' },
  { id: 'p1701', code: 'OVE-1701', name: 'OVERSIZE', color: 'Melanqe O.', size: 'XL', category: 'Polos' },
  { id: 'p1702', code: 'OVE-1702', name: 'OVERSIZE', color: 'Negro', size: 'S', category: 'Polos' },
  { id: 'p1703', code: 'OVE-1703', name: 'OVERSIZE', color: 'Negro', size: 'M', category: 'Polos' },
  { id: 'p1704', code: 'OVE-1704', name: 'OVERSIZE', color: 'Negro', size: 'L', category: 'Polos' },
  { id: 'p1705', code: 'OVE-1705', name: 'OVERSIZE', color: 'Negro', size: 'XL', category: 'Polos' },
  { id: 'p1706', code: 'OVE-1706', name: 'OVERSIZE', color: 'Topo', size: 'S', category: 'Polos' },
  { id: 'p1707', code: 'OVE-1707', name: 'OVERSIZE', color: 'Topo', size: 'M', category: 'Polos' },
  { id: 'p1708', code: 'OVE-1708', name: 'OVERSIZE', color: 'Topo', size: 'L', category: 'Polos' },
  { id: 'p1709', code: 'OVE-1709', name: 'OVERSIZE', color: 'Topo', size: 'XL', category: 'Polos' },
  { id: 'p1710', code: 'OVE-1710', name: 'OVERSIZE', color: 'Pacay', size: 'S', category: 'Polos' },
  { id: 'p1711', code: 'OVE-1711', name: 'OVERSIZE', color: 'Pacay', size: 'M', category: 'Polos' },
  { id: 'p1712', code: 'OVE-1712', name: 'OVERSIZE', color: 'Pacay', size: 'L', category: 'Polos' },
  { id: 'p1713', code: 'OVE-1713', name: 'OVERSIZE', color: 'Pacay', size: 'XL', category: 'Polos' },
  { id: 'p1714', code: 'OVE-1714', name: 'OVERSIZE', color: 'P.Rosa', size: 'S', category: 'Polos' },
  { id: 'p1715', code: 'OVE-1715', name: 'OVERSIZE', color: 'P.Rosa', size: 'M', category: 'Polos' },
  { id: 'p1716', code: 'OVE-1716', name: 'OVERSIZE', color: 'P.Rosa', size: 'L', category: 'Polos' },
  { id: 'p1717', code: 'OVE-1717', name: 'OVERSIZE', color: 'P.Rosa', size: 'XL', category: 'Polos' },
  { id: 'p1718', code: 'OVE-1718', name: 'OVERSIZE', color: 'Perla', size: 'S', category: 'Polos' },
  { id: 'p1719', code: 'OVE-1719', name: 'OVERSIZE', color: 'Perla', size: 'M', category: 'Polos' },
  { id: 'p1720', code: 'OVE-1720', name: 'OVERSIZE', color: 'Perla', size: 'L', category: 'Polos' },
  { id: 'p1721', code: 'OVE-1721', name: 'OVERSIZE', color: 'Perla', size: 'XL', category: 'Polos' },
  { id: 'p1722', code: 'OVE-1722', name: 'OVERSIZE', color: 'Plomo', size: 'S', category: 'Polos' },
  { id: 'p1723', code: 'OVE-1723', name: 'OVERSIZE', color: 'Plomo', size: 'M', category: 'Polos' },
  { id: 'p1724', code: 'OVE-1724', name: 'OVERSIZE', color: 'Plomo', size: 'L', category: 'Polos' },
  { id: 'p1725', code: 'OVE-1725', name: 'OVERSIZE', color: 'Plomo', size: 'XL', category: 'Polos' },
  { id: 'p1726', code: 'OVE-1726', name: 'OVERSIZE', color: 'Vino', size: 'S', category: 'Polos' },
  { id: 'p1727', code: 'OVE-1727', name: 'OVERSIZE', color: 'Vino', size: 'M', category: 'Polos' },
  { id: 'p1728', code: 'OVE-1728', name: 'OVERSIZE', color: 'Vino', size: 'L', category: 'Polos' },
  { id: 'p1729', code: 'OVE-1729', name: 'OVERSIZE', color: 'Vino', size: 'XL', category: 'Polos' },
  { id: 'p1730', code: 'MED-1730', name: 'MEDIAS LARGAS', color: 'Melanqe', size: '(talla única)', category: 'Medias' },
  { id: 'p1731', code: 'MED-1731', name: 'MEDIAS LARGAS', color: 'Negro', size: '(talla única)', category: 'Medias' },
  { id: 'p1732', code: 'MED-1732', name: 'MEDIAS LARGAS', color: 'Perla', size: '(talla única)', category: 'Medias' },
  { id: 'p1733', code: 'MED-1733', name: 'MEDIAS LARGAS', color: 'Plomo', size: '(talla única)', category: 'Medias' },
  { id: 'p1734', code: 'MED-1734', name: 'MEDIAS CORTAS', color: 'Melanqe', size: '(talla única)', category: 'Medias' },
  { id: 'p1735', code: 'MED-1735', name: 'MEDIAS CORTAS', color: 'Negro', size: '(talla única)', category: 'Medias' },
  { id: 'p1736', code: 'MED-1736', name: 'MEDIAS CORTAS', color: 'Perla', size: '(talla única)', category: 'Medias' },
  { id: 'p1737', code: 'MED-1737', name: 'MEDIAS CORTAS', color: 'Plomo', size: '(talla única)', category: 'Medias' },
];

const BRAVOS_SEED_V = 'v3_expanded';
const BOX_PRIME_SEED_V = 'v3_expanded';

function makeBravosProducts(): Product[] {
  const items: Product[] = [];
  let n = 1;
  const add = (name: string, category: string, colors: string[], sizes: string[]) => {
    for (const color of colors) {
      for (const size of sizes) {
        const code = `BRV-${String(n).padStart(4, '0')}`;
        items.push({ id: `bv${String(n).padStart(4, '0')}`, code, name, color, size, category });
        n++;
      }
    }
  };
  add('POLERA BOXYFIT', 'Poleras', ['Azul','Beige','Botella','Cemento','Denim','Negro','Pacay','P.Rosa','Perla','Plomo','Vino'], ['S','M','L']);
  add('POLERA NERU', 'Poleras', ['Azul','Beige','Botella','Cemento','Denim','Melange','Negro','Topo','Pacay','P.Rosa','Perla','Plomo','Vino'], ['S','M','L','XL']);
  add('CLASICOS DE REGALO', 'Poleras', ['Cemento','Negro'], ['S','M','L','XL']);
  add('PANTALON BRATZ', 'Pantalones', ['Azul','Beige','Botella','Cemento','Denim','Negro','Pacay','P.Rosa','Perla','Plomo','Vino'], ['S','M','L']);
  add('PANTALON OPRA', 'Pantalones', ['Azul','Beige','Botella','Cemento','Denim','Negro','Pacay','P.Rosa','Perla','Plomo'], ['S','M','L']);
  return items;
}

function makeBoxPrimeProducts(): Product[] {
  const items: Product[] = [];
  let n = 1;
  const single = (name: string, category: string) => {
    items.push({ id: `bp${String(n).padStart(4, '0')}`, code: `BX-${String(n).padStart(4, '0')}`, name, category });
    n++;
  };
  const withColors = (name: string, category: string, colors: string[]) => {
    for (const color of colors) {
      items.push({ id: `bp${String(n).padStart(4, '0')}`, code: `BX-${String(n).padStart(4, '0')}`, name, color, category });
      n++;
    }
  };
  const withSizes = (name: string, category: string, sizes: string[]) => {
    for (const size of sizes) {
      items.push({ id: `bp${String(n).padStart(4, '0')}`, code: `BX-${String(n).padStart(4, '0')}`, name, size, category });
      n++;
    }
  };
  // Single-SKU products
  single('CASE LA BUBU', 'Accesorios');
  single('CABLE C A LIGHTNING', 'Cables');
  single('CEPILLO ELECTRÓNICO', 'Salud');
  single('CABLE C A C', 'Cables');
  single('DRON', 'Electrónica');
  single('AIRPODS PRO 2', 'Audio');
  single('AIRPODS PRO TACTIL', 'Audio');
  single('CUBO 20W', 'Energía');
  // Products with color variants
  withColors('IRRIGADOR ELECTRÓNICO', 'Salud', ['Blanco','Rosado','Verde']);
  withColors('AIRPODS PRO MAX', 'Audio', ['Azul','Blanco','Negro','Anaranjado']);
  withSizes('BATTERY', 'Energía', ['10k','20k']);
  withColors('VENTILADOR', 'Hogar', ['Azul','Blanco','Negro','Verde']);
  withColors('CASE CLASICO', 'Accesorios', ['Azul','Celeste','Morado','Negro','Plomo','Rojo','Rosado','Verde']);
  return items;
}

const defaultProductsBravos: Product[] = makeBravosProducts();
const defaultProductsBoxPrime: Product[] = makeBoxPrimeProducts();

const defaultLocations: Location[] = [
  { id: 'l1', name: 'Almacén Principal - Pasillo 1', type: 'ZONE' },
  { id: 'l2', name: 'Estante A - Nivel 1', type: 'RACK' },
  { id: 'l3', name: 'Estante B - Nivel 2', type: 'RACK' },
  { id: 'l-ext', name: 'Tienda Exhibición', type: 'EXTERNAL' },
];

const defaultStock: StockLevel[] = [];

const defaultTransactions: Transaction[] = [];

const AppContext = createContext<AppContextType | undefined>(undefined);

// --- DB mappers ---
const dbToProduct = (r: any): Product => ({ id: r.id, code: r.code, name: r.name, color: r.color ?? undefined, size: r.size ?? undefined, category: r.category, lowStockThreshold: r.low_stock_threshold ?? undefined, costPrice: r.cost_price ?? undefined, sellPrice: r.sell_price ?? undefined });
const dbToLocation = (r: any): Location => ({ id: r.id, name: r.name, type: r.type });
const dbToStock = (r: any): StockLevel => ({ id: r.id, productId: r.product_id, locationId: r.location_id, quantity: r.quantity });
const dbToTx = (r: any): Transaction => ({ id: r.id, date: r.date, type: r.type, productId: r.product_id, quantity: r.quantity, fromLocationId: r.from_location_id ?? undefined, toLocationId: r.to_location_id ?? undefined, reference: r.reference, user: r.user_name, status: r.status, signature: r.signature ?? undefined, contactId: r.contact_id ?? undefined, serialNumber: r.serial_number ?? undefined });
const dbToContact = (r: any): Contact => ({ id: r.id, type: r.type, name: r.name, document: r.document, phone: r.phone ?? undefined, email: r.email ?? undefined });
const dbToUser = (r: any): UserWithPassword => ({ id: r.id, username: r.username, role: r.role as Role, password: '', email: r.email ?? undefined, emailPersonal: r.email_personal ?? undefined, active: r.active });
const dbToPO = (r: any): PurchaseOrder => ({ id: r.id, date: r.date, supplierId: r.supplier_id, status: r.status, reference: r.reference, notes: r.notes ?? undefined, locationId: r.location_id ?? undefined, items: (r.purchase_order_items ?? []).map((i: any): PurchaseOrderItem => ({ productId: i.product_id, quantity: i.quantity, unitCost: i.unit_cost, receivedQuantity: i.received_quantity })) });
const dbToAdj = (r: any): InventoryAdjustment => ({ id: r.id, date: r.date, productId: r.product_id, locationId: r.location_id, previousQuantity: r.previous_quantity, newQuantity: r.new_quantity, reason: r.reason, notes: r.notes ?? undefined, user: r.user_name });

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [activeBrand, setActiveBrand] = useState<Brand>('OVERSHARK');
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [currentUser, setCurrentUser] = useState<User>({ id: '', username: '', role: 'JEFE_ALMACEN' });
  const [users, setUsers] = useState<UserWithPassword[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<Role, Record<string, Permission>>>(DEFAULT_ROLE_PERMISSIONS);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setCurrentUser({ id: data.id, username: data.username, role: data.role as Role });
  };

  const loadBrandData = useCallback(async (brand: Brand) => {
    setLoading(true);
    try {
      const [p, l, s, t, c, po, adj, u] = await Promise.all([
        supabase.from('products').select('*').eq('brand', brand),
        supabase.from('locations').select('*').eq('brand', brand),
        supabase.from('stock_levels').select('*').eq('brand', brand),
        supabase.from('transactions').select('*').eq('brand', brand).order('date', { ascending: false }),
        supabase.from('contacts').select('*').eq('brand', brand),
        supabase.from('purchase_orders').select('*, purchase_order_items(*)').eq('brand', brand).order('date', { ascending: false }),
        supabase.from('inventory_adjustments').select('*').eq('brand', brand).order('date', { ascending: false }),
        supabase.from('profiles').select('*'),
      ]);
      const loadedProducts = (p.data || []).map(dbToProduct);
      setProducts(loadedProducts);
      setLocations((l.data || []).map(dbToLocation));
      setStockLevels((s.data || []).map(dbToStock));
      setTransactions((t.data || []).map(dbToTx));
      setContacts((c.data || []).map(dbToContact));
      setPurchaseOrders((po.data || []).map(dbToPO));
      setAdjustments((adj.data || []).map(dbToAdj));
      setUsers((u.data || []).map(dbToUser));

      if (loadedProducts.length === 0) {
        const seedProds = brand === 'OVERSHARK' ? defaultProductsOvershark : brand === 'BRAVOS' ? defaultProductsBravos : defaultProductsBoxPrime;
        const BATCH = 200;
        for (let i = 0; i < seedProds.length; i += BATCH) {
          const batch = seedProds.slice(i, i + BATCH).map(prod => ({
            id: prod.id, brand, code: prod.code, name: prod.name,
            color: prod.color || null, size: prod.size || null, category: prod.category,
            low_stock_threshold: prod.lowStockThreshold || null,
            cost_price: prod.costPrice || null, sell_price: prod.sellPrice || null,
          }));
          await supabase.from('products').upsert(batch, { onConflict: 'id' });
        }
        const { count: locCount } = await supabase.from('locations').select('*', { count: 'exact', head: true }).eq('brand', brand);
        if (!locCount) {
          await supabase.from('locations').insert(defaultLocations.map(loc => ({ id: loc.id, brand, name: loc.name, type: loc.type })));
        }
        const [p2, l2] = await Promise.all([
          supabase.from('products').select('*').eq('brand', brand),
          supabase.from('locations').select('*').eq('brand', brand),
        ]);
        setProducts((p2.data || []).map(dbToProduct));
        setLocations((l2.data || []).map(dbToLocation));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) loadProfile(s.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) loadProfile(s.user.id);
      else { setCurrentUser({ id: '', username: '', role: 'JEFE_ALMACEN' }); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load data on brand/session change — use stable user ID to avoid re-fetching on token refresh
  const sessionUserId = session?.user?.id;
  useEffect(() => {
    if (!sessionUserId) return;
    loadBrandData(activeBrand);
  }, [activeBrand, sessionUserId, loadBrandData]);

  // Load custom role permissions once on login (not brand-dependent)
  useEffect(() => {
    if (!sessionUserId) return;
    supabase.from('role_permissions').select('*').then(({ data }) => {
      if (!data || data.length === 0) return;
      setRolePermissions(prev => {
        const next: Record<Role, Record<string, Permission>> = {
          ADMIN_GENERAL: { ...prev.ADMIN_GENERAL },
          CEO: { ...prev.CEO },
          ADMINISTRADOR: { ...prev.ADMINISTRADOR },
          JEFE_ALMACEN: { ...prev.JEFE_ALMACEN },
        };
        for (const row of data) {
          if (next[row.role as Role]) next[row.role as Role][row.module] = row.permission as Permission;
        }
        return next;
      });
    });
  }, [sessionUserId]);

  const updateRolePermission = async (role: Role, module: string, permission: Permission): Promise<void> => {
    setRolePermissions(prev => ({
      ...prev,
      [role]: { ...prev[role], [module]: permission },
    }));
    await supabase.from('role_permissions').upsert({ role, module, permission }, { onConflict: 'role,module' });
  };

  // Real-time subscriptions
  useEffect(() => {
    if (!session) return;
    const channel = supabase.channel(`brand_${activeBrand}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_levels', filter: `brand=eq.${activeBrand}` },
        () => supabase.from('stock_levels').select('*').eq('brand', activeBrand).then(({ data }) => { if (data) setStockLevels(data.map(dbToStock)); }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `brand=eq.${activeBrand}` },
        () => supabase.from('transactions').select('*').eq('brand', activeBrand).order('date', { ascending: false }).then(({ data }) => { if (data) setTransactions(data.map(dbToTx)); }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeBrand, session]);

  // --- CRUD ---

  const addTransaction = async (txInputs: Omit<Transaction, 'id' | 'date' | 'status'> & { forceNewEntry?: boolean }): Promise<void> => {
    const { forceNewEntry, ...tx } = txInputs;
    const { error } = await supabase.rpc('execute_transaction', {
      p_brand: activeBrand, p_type: tx.type, p_product_id: tx.productId,
      p_quantity: tx.quantity, p_from_location_id: tx.fromLocationId || null,
      p_to_location_id: tx.toLocationId || null, p_reference: tx.reference,
      p_user_name: tx.user, p_contact_id: tx.contactId || null,
      p_signature: tx.signature || null, p_serial_number: tx.serialNumber || null,
      p_force_new_entry: forceNewEntry ?? false,
    });
    if (error) throw new Error(error.message);
    const [s, t] = await Promise.all([
      supabase.from('stock_levels').select('*').eq('brand', activeBrand),
      supabase.from('transactions').select('*').eq('brand', activeBrand).order('date', { ascending: false }),
    ]);
    if (s.data) setStockLevels(s.data.map(dbToStock));
    if (t.data) setTransactions(t.data.map(dbToTx));
  };

  const addProduct = (p: Omit<Product, 'id'>) => {
    const tempId = crypto.randomUUID();
    setProducts(prev => [...prev, { ...p, id: tempId }]);
    supabase.from('products').insert([{ brand: activeBrand, code: p.code, name: p.name, color: p.color || null, size: p.size || null, category: p.category, low_stock_threshold: p.lowStockThreshold || null, cost_price: p.costPrice || null, sell_price: p.sellPrice || null }]).select().single()
      .then(({ data, error }) => {
        if (error) { setProducts(prev => prev.filter(x => x.id !== tempId)); return; }
        if (data) setProducts(prev => prev.map(x => x.id === tempId ? dbToProduct(data) : x));
      });
  };

  const updateProduct = (updated: Product) => {
    setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
    supabase.from('products').update({ code: updated.code, name: updated.name, color: updated.color || null, size: updated.size || null, category: updated.category, low_stock_threshold: updated.lowStockThreshold || null, cost_price: updated.costPrice || null, sell_price: updated.sellPrice || null }).eq('id', updated.id)
      .then(({ error }) => { if (error) loadBrandData(activeBrand); });
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    supabase.from('products').delete().eq('id', id).then(({ error }) => { if (error) loadBrandData(activeBrand); });
  };

  const addLocation = (l: Omit<Location, 'id'>) => {
    const tempId = crypto.randomUUID();
    setLocations(prev => [...prev, { ...l, id: tempId }]);
    supabase.from('locations').insert([{ brand: activeBrand, name: l.name, type: l.type }]).select().single()
      .then(({ data, error }) => {
        if (error) { setLocations(prev => prev.filter(x => x.id !== tempId)); return; }
        if (data) setLocations(prev => prev.map(x => x.id === tempId ? dbToLocation(data) : x));
      });
  };

  const updateLocation = (updated: Location) => {
    setLocations(prev => prev.map(l => l.id === updated.id ? updated : l));
    supabase.from('locations').update({ name: updated.name, type: updated.type }).eq('id', updated.id)
      .then(({ error }) => { if (error) loadBrandData(activeBrand); });
  };

  const deleteLocation = (id: string) => {
    const hasStock = stockLevels.some(s => s.locationId === id && s.quantity > 0);
    if (hasStock) throw new Error('No se puede eliminar una ubicación con stock');
    setLocations(prev => prev.filter(l => l.id !== id));
    supabase.from('locations').delete().eq('id', id).then(({ error }) => { if (error) loadBrandData(activeBrand); });
  };

  const deleteStockLevel = (productId: string, locationId: string) => {
    setStockLevels(prev => prev.filter(s => !(s.productId === productId && s.locationId === locationId)));
    supabase.from('stock_levels').delete().eq('product_id', productId).eq('location_id', locationId).eq('brand', activeBrand);
  };

  const addContact = (contact: Omit<Contact, 'id'>) => {
    const tempId = crypto.randomUUID();
    setContacts(prev => [...prev, { ...contact, id: tempId }]);
    supabase.from('contacts').insert([{ brand: activeBrand, type: contact.type, name: contact.name, document: contact.document, phone: contact.phone || null, email: contact.email || null }]).select().single()
      .then(({ data, error }) => {
        if (error) { setContacts(prev => prev.filter(x => x.id !== tempId)); return; }
        if (data) setContacts(prev => prev.map(x => x.id === tempId ? dbToContact(data) : x));
      });
  };

  const updateContact = (updated: Contact) => {
    setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
    supabase.from('contacts').update({ type: updated.type, name: updated.name, document: updated.document, phone: updated.phone || null, email: updated.email || null }).eq('id', updated.id)
      .then(({ error }) => { if (error) loadBrandData(activeBrand); });
  };

  const deleteContact = (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
    supabase.from('contacts').delete().eq('id', id).then(({ error }) => { if (error) loadBrandData(activeBrand); });
  };

  const addUser = async (u: Omit<UserWithPassword, 'id'>): Promise<void> => {
    if (!u.email) throw new Error('El email es obligatorio para crear usuarios');
    const { data, error } = await supabase.auth.signUp({ email: u.email, password: u.password, options: { data: { username: u.username, role: u.role } } });
    if (error) throw error;
    if (data.user) {
      await supabase.from('profiles').update({ username: u.username, role: u.role, active: u.active }).eq('id', data.user.id);
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
      if (prof) setUsers(prev => [...prev.filter(x => x.id !== prof.id), dbToUser(prof)]);
    }
  };

  const updateUser = (updated: UserWithPassword) => {
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
    supabase.from('profiles').update({ username: updated.username, role: updated.role, active: updated.active }).eq('id', updated.id)
      .then(({ error }) => { if (error) supabase.from('profiles').select('*').then(({ data }) => { if (data) setUsers(data.map(dbToUser)); }); });
  };

  const deleteUser = (id: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, active: false } : u));
    supabase.from('profiles').update({ active: false }).eq('id', id);
  };

  const addPurchaseOrder = (po: Omit<PurchaseOrder, 'id' | 'date'>) => {
    const tempId = crypto.randomUUID();
    const date = new Date().toISOString();
    setPurchaseOrders(prev => [{ ...po, id: tempId, date }, ...prev]);
    supabase.from('purchase_orders').insert([{ brand: activeBrand, supplier_id: po.supplierId || null, status: po.status, reference: po.reference, notes: po.notes || null, location_id: po.locationId || null }]).select().single()
      .then(async ({ data, error }) => {
        if (error || !data) { setPurchaseOrders(prev => prev.filter(x => x.id !== tempId)); return; }
        if (po.items.length > 0) {
          await supabase.from('purchase_order_items').insert(po.items.map(i => ({ purchase_order_id: data.id, product_id: i.productId, quantity: i.quantity, unit_cost: i.unitCost, received_quantity: i.receivedQuantity })));
        }
        setPurchaseOrders(prev => prev.map(x => x.id === tempId ? { ...po, id: data.id, date: data.date } : x));
      });
  };

  const updatePurchaseOrder = (updated: PurchaseOrder) => {
    setPurchaseOrders(prev => prev.map(po => po.id === updated.id ? updated : po));
    supabase.from('purchase_orders').update({ status: updated.status, reference: updated.reference, notes: updated.notes || null, location_id: updated.locationId || null }).eq('id', updated.id)
      .then(({ error }) => { if (error) loadBrandData(activeBrand); });
  };

  const deletePurchaseOrder = (id: string) => {
    setPurchaseOrders(prev => prev.filter(po => po.id !== id));
    supabase.from('purchase_orders').delete().eq('id', id).then(({ error }) => { if (error) loadBrandData(activeBrand); });
  };

  const addAdjustment = (adj: Omit<InventoryAdjustment, 'id' | 'date'>) => {
    const tempAdj: InventoryAdjustment = { ...adj, id: crypto.randomUUID(), date: new Date().toISOString() };
    setAdjustments(prev => [tempAdj, ...prev]);
    setStockLevels(prev => {
      const existing = prev.find(s => s.productId === adj.productId && s.locationId === adj.locationId);
      if (existing) return prev.map(s => s.productId === adj.productId && s.locationId === adj.locationId ? { ...s, quantity: adj.newQuantity } : s).filter(s => s.quantity > 0);
      if (adj.newQuantity > 0) return [...prev, { id: crypto.randomUUID(), productId: adj.productId, locationId: adj.locationId, quantity: adj.newQuantity }];
      return prev;
    });
    supabase.rpc('execute_adjustment', { p_brand: activeBrand, p_product_id: adj.productId, p_location_id: adj.locationId, p_previous_quantity: adj.previousQuantity, p_new_quantity: adj.newQuantity, p_reason: adj.reason, p_notes: adj.notes || null, p_user_name: adj.user })
      .then(({ error }) => { if (error) loadBrandData(activeBrand); });
  };

  return (
    <AppContext.Provider value={{
      loading, activeBrand, setActiveBrand,
      products, locations, transactions, stockLevels,
      contacts, currentUser, users, purchaseOrders, adjustments,
      addTransaction, addProduct, updateProduct, deleteProduct,
      addLocation, updateLocation, deleteLocation, deleteStockLevel,
      addContact, updateContact, deleteContact, setCurrentUser,
      addUser, updateUser, deleteUser,
      addPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder,
      addAdjustment,
      rolePermissions, updateRolePermission,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};
