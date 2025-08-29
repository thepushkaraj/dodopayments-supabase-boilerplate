import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Create a Supabase client instance
 * @param supabaseUrl - Supabase project URL
 * @param supabaseKey - Supabase key (anon or service role)
 * @returns Supabase client instance
 */
export function createSupabaseClient(supabaseUrl: string, supabaseKey: string): SupabaseClient {
  return createClient(supabaseUrl, supabaseKey);
}

// Customer operations
export async function createCustomer(
  supabase: SupabaseClient, 
  customer: { email: string; name: string; dodo_customer_id: string }
) {
  const { data, error } = await supabase
    .from('customers')
    .insert([customer])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create customer: ${error.message}`);
  }

  return data;
}

export async function getCustomerByEmail(supabase: SupabaseClient, email: string) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('email', email)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to get customer: ${error.message}`);
  }

  return data;
}

export async function getCustomerByDodoId(supabase: SupabaseClient, dodoCustomerId: string) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('dodo_customer_id', dodoCustomerId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to get customer by Dodo ID: ${error.message}`);
  }

  return data;
}

export async function getCustomerById(supabase: SupabaseClient, customerId: string) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to get customer by ID: ${error.message}`);
  }

  return data;
}

// Subscription operations
export async function createSubscription(
  supabase: SupabaseClient,
  subscription: {
    customer_id: string;
    dodo_subscription_id: string;
    product_id: string;
    status: string;
    billing_interval: string;
    amount: number;
    currency: string;
    next_billing_date?: string;
  }
) {
  const { data, error } = await supabase
    .from('subscriptions')
    .insert([subscription])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create subscription: ${error.message}`);
  }

  return data;
}

export async function updateSubscription(
  supabase: SupabaseClient,
  dodoSubscriptionId: string, 
  updates: {
    status?: string;
    next_billing_date?: string;
    amount?: number;
    updated_at?: string;
  }
) {
  const { data, error } = await supabase
    .from('subscriptions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('dodo_subscription_id', dodoSubscriptionId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update subscription: ${error.message}`);
  }

  return data;
}

export async function getSubscriptionByDodoId(supabase: SupabaseClient, dodoSubscriptionId: string) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('dodo_subscription_id', dodoSubscriptionId)
    .single();

  // Return null if no subscription found (PGRST116 is "not found" error)
  if (error && error.code === 'PGRST116') {
    return null;
  }

  if (error) {
    throw new Error(`Failed to get subscription: ${error.message}`);
  }

  return data;
}



// Webhook operations
export async function logWebhookEvent(
  supabase: SupabaseClient,
  event: {
    event_type: string;
    data: any;
    processed: boolean;
  }
) {
  const { data, error } = await supabase
    .from('webhook_events')
    .insert([event])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to log webhook event: ${error.message}`);
  }

  return data;
}

export async function markWebhookProcessed(supabase: SupabaseClient, eventId: string) {
  const { data, error } = await supabase
    .from('webhook_events')
    .update({ processed: true })
    .eq('id', eventId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to mark webhook as processed: ${error.message}`);
  }

  return data;
}
