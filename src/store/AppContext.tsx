import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { Product, Location, Transaction, StockLevel, Contact, User, Role, UserWithPassword, PurchaseOrder, PurchaseOrderStatus, InventoryAdjustment } from '../types';
import { Permission, DEFAULT_ROLE_PERMISSIONS } from '../lib/permissions';
import { defaultProductsOvershark, defaultProductsBravos, defaultProductsBoxPrime, defaultLocations } from '../data/seed-data';
import { dbToProduct, dbToLocation, dbToStock, dbToTx, dbToContact, dbToUser, dbToPO, dbToAdj } from './mappers';

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
  updateUser: (user: UserWithPassword, newPassword?: string) => Promise<void>;
  deleteUser: (id: string) => void;
  addPurchaseOrder: (po: Omit<PurchaseOrder, 'id' | 'date'>) => void;
  updatePurchaseOrder: (po: PurchaseOrder) => void;
  deletePurchaseOrder: (id: string) => void;
  addAdjustment: (adj: Omit<InventoryAdjustment, 'id' | 'date'>) => void;
  rolePermissions: Record<Role, Record<string, Permission>>;
  updateRolePermission: (role: Role, module: string, permission: Permission) => Promise<void>;
  deleteTransaction: (txId: string) => Promise<void>;
  updateTransaction: (txId: string, updates: { reference?: string; contactId?: string | null }) => Promise<void>;
  clearAllTransactions: () => Promise<void>;
  receivePurchaseOrder: (po: PurchaseOrder, receiveQtys: Record<number, number>) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);


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

  const deleteTransaction = async (txId: string): Promise<void> => {
    const tx = transactions.find(t => t.id === txId);
    if (!tx) return;
    const { error } = await supabase.from('transactions').update({ status: 'CANCELLED' }).eq('id', txId);
    if (error) throw new Error(error.message);
    if (tx.status === 'COMPLETED') {
      if (tx.type === 'RECEPTION' && tx.toLocationId) {
        const { data } = await supabase.from('stock_levels').select('quantity').eq('product_id', tx.productId).eq('location_id', tx.toLocationId).eq('brand', activeBrand).maybeSingle();
        if (data) await supabase.from('stock_levels').update({ quantity: Math.max(0, data.quantity - tx.quantity) }).eq('product_id', tx.productId).eq('location_id', tx.toLocationId).eq('brand', activeBrand);
      } else if (tx.type === 'DISPATCH' && tx.fromLocationId) {
        const { data } = await supabase.from('stock_levels').select('quantity').eq('product_id', tx.productId).eq('location_id', tx.fromLocationId).eq('brand', activeBrand).maybeSingle();
        if (data) await supabase.from('stock_levels').update({ quantity: data.quantity + tx.quantity }).eq('product_id', tx.productId).eq('location_id', tx.fromLocationId).eq('brand', activeBrand);
        else await supabase.from('stock_levels').insert({ product_id: tx.productId, location_id: tx.fromLocationId, brand: activeBrand, quantity: tx.quantity });
      } else if (tx.type === 'TRANSFER' && tx.fromLocationId && tx.toLocationId) {
        const [fromR, toR] = await Promise.all([
          supabase.from('stock_levels').select('quantity').eq('product_id', tx.productId).eq('location_id', tx.fromLocationId).eq('brand', activeBrand).maybeSingle(),
          supabase.from('stock_levels').select('quantity').eq('product_id', tx.productId).eq('location_id', tx.toLocationId).eq('brand', activeBrand).maybeSingle(),
        ]);
        if (fromR.data) await supabase.from('stock_levels').update({ quantity: fromR.data.quantity + tx.quantity }).eq('product_id', tx.productId).eq('location_id', tx.fromLocationId).eq('brand', activeBrand);
        if (toR.data) await supabase.from('stock_levels').update({ quantity: Math.max(0, toR.data.quantity - tx.quantity) }).eq('product_id', tx.productId).eq('location_id', tx.toLocationId).eq('brand', activeBrand);
      }
    }
    const [s, t] = await Promise.all([
      supabase.from('stock_levels').select('*').eq('brand', activeBrand),
      supabase.from('transactions').select('*').eq('brand', activeBrand).order('date', { ascending: false }),
    ]);
    if (s.data) setStockLevels(s.data.map(dbToStock));
    if (t.data) setTransactions(t.data.map(dbToTx));
  };

  const updateTransaction = async (txId: string, updates: { reference?: string; contactId?: string | null }): Promise<void> => {
    const dbUpdates: Record<string, any> = {};
    if (updates.reference !== undefined) dbUpdates.reference = updates.reference;
    if ('contactId' in updates) dbUpdates.contact_id = updates.contactId ?? null;
    const { error } = await supabase.from('transactions').update(dbUpdates).eq('id', txId);
    if (error) throw new Error(error.message);
    setTransactions(prev => prev.map(t => t.id === txId ? {
      ...t,
      ...(updates.reference !== undefined ? { reference: updates.reference } : {}),
      ...('contactId' in updates ? { contactId: updates.contactId ?? undefined } : {}),
    } : t));
  };

  const clearAllTransactions = async (): Promise<void> => {
    const { error: txErr } = await supabase.from('transactions').delete().eq('brand', activeBrand);
    if (txErr) throw new Error(txErr.message);
    const { error: slErr } = await supabase.from('stock_levels').delete().eq('brand', activeBrand);
    if (slErr) throw new Error(slErr.message);
    setTransactions([]);
    setStockLevels([]);
  };

  const receivePurchaseOrder = async (po: PurchaseOrder, receiveQtys: Record<number, number>): Promise<void> => {
    for (let i = 0; i < po.items.length; i++) {
      const qty = receiveQtys[i] || 0;
      if (qty <= 0) continue;
      const item = po.items[i];
      await addTransaction({
        type: 'RECEPTION',
        productId: item.productId,
        quantity: qty,
        toLocationId: po.locationId || undefined,
        reference: po.reference,
        user: currentUser.username,
        contactId: po.supplierId || undefined,
      });
    }
    const updatedItems = po.items.map((item, i) => ({
      ...item,
      receivedQuantity: item.receivedQuantity + (receiveQtys[i] || 0),
    }));
    const allComplete = updatedItems.every(i => i.receivedQuantity >= i.quantity);
    const anyReceived = updatedItems.some(i => i.receivedQuantity > 0);
    const newStatus: PurchaseOrderStatus = allComplete ? 'COMPLETED' : anyReceived ? 'PARTIAL' : po.status;
    const updated: PurchaseOrder = { ...po, items: updatedItems, status: newStatus };
    setPurchaseOrders(prev => prev.map(p => p.id === po.id ? updated : p));
    await supabase.from('purchase_orders').update({ status: newStatus }).eq('id', po.id);
    await Promise.all(updatedItems.map(item =>
      supabase.from('purchase_order_items')
        .update({ received_quantity: item.receivedQuantity })
        .eq('purchase_order_id', po.id)
        .eq('product_id', item.productId)
    ));
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
    supabase.from('stock_levels').delete().eq('product_id', productId).eq('location_id', locationId).eq('brand', activeBrand).then(({ error }) => { if (error) loadBrandData(activeBrand); });
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

  const updateUser = async (updated: UserWithPassword, newPassword?: string): Promise<void> => {
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/update-user-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({
        userId: updated.id,
        username: updated.username,
        role: updated.role,
        active: updated.active,
        email: updated.email || undefined,
        password: newPassword || undefined,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('updateUser edge fn error:', err);
      const { data } = await supabase.from('profiles').select('*');
      if (data) setUsers(data.map(dbToUser));
    }
  };

  const deleteUser = (id: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, active: false } : u));
    fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/update-user-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ userId: id, active: false }),
    });
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

  const value = useMemo<AppContextType>(() => ({
    loading, activeBrand, setActiveBrand,
    products, locations, transactions, stockLevels,
    contacts, currentUser, users, purchaseOrders, adjustments,
    addTransaction, deleteTransaction, updateTransaction, clearAllTransactions, addProduct, updateProduct, deleteProduct,
    addLocation, updateLocation, deleteLocation, deleteStockLevel,
    addContact, updateContact, deleteContact, setCurrentUser,
    addUser, updateUser, deleteUser,
    addPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, receivePurchaseOrder,
    addAdjustment,
    rolePermissions, updateRolePermission,
  }), [
    loading, activeBrand, products, locations, transactions, stockLevels,
    contacts, currentUser, users, purchaseOrders, adjustments, rolePermissions,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};
