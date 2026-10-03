import { supabase } from '../lib/supabase';

/* ---------- Autenticación ---------- */

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export const signOut = () => supabase.auth.signOut();

export async function checkIsAdmin(userId) {
  const { data, error } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

/* ---------- Productos ---------- */

export async function saveProduct(product) {
  const payload = {
    name: product.name,
    description: product.description || null,
    price: Number(product.price),
    category_id: product.category_id || null,
    sizes: product.sizes,
    image_url: product.image_url || null,
    stock: Number(product.stock),
  };

  const query = product.id
    ? supabase.from('products').update(payload).eq('id', product.id)
    : supabase.from('products').insert(payload);

  const { error } = await query;
  if (error) throw error;
}

export async function deleteProduct(id) {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadProductImage(file) {
  const ext = file.name.split('.').pop();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('products').upload(path, file);
  if (error) throw error;
  return supabase.storage.from('products').getPublicUrl(path).data.publicUrl;
}

/* ---------- Categorías ---------- */

export async function saveCategory(category) {
  const payload = { name: category.name, slug: category.slug };
  const query = category.id
    ? supabase.from('categories').update(payload).eq('id', category.id)
    : supabase.from('categories').insert(payload);
  const { error } = await query;
  if (error) throw error;
}

export async function deleteCategory(id) {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

/* ---------- Pedidos ---------- */

export async function fetchOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(quantity, size, price, products(name))')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateOrder(id, { status, tracking_guide, refund_note }) {
  const { error } = await supabase
    .from('orders')
    .update({
      status,
      tracking_guide: tracking_guide || null,
      refund_note: status === 'Reembolsado' ? refund_note || null : null,
    })
    .eq('id', id);
  if (error) throw error;
}
