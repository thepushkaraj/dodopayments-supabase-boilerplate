import { SupabaseClient } from '@supabase/supabase-js';
import DodoPayments from 'dodopayments';
import { 
  createCustomer, 
  getCustomerByEmail, 
  getCustomerByDodoId, 
  getCustomerById 
} from '../lib/supabase.js';
import { createDodoCustomer, getDodoCustomer, updateDodoCustomer } from '../lib/dodo.js';
import { CreateCustomerRequest, Customer } from '../types.js';

/**
 * Create a new customer in both Supabase and Dodo Payments
 * Based on signup function logic
 * @param supabase - Supabase client instance
 * @param dodoClient - Dodo Payments client instance
 * @param customerData - Customer information
 * @returns Created customer with Dodo customer ID
 */
export async function createCustomerFlow(
  supabase: SupabaseClient,
  dodoClient: DodoPayments,
  customerData: CreateCustomerRequest
): Promise<Customer> {
  try {
    // Check if customer already exists (like signup function)
    const existingCustomer = await getCustomerByEmail(supabase, customerData.email);
    if (existingCustomer) {
      throw new Error(`Customer with email ${customerData.email} already exists`);
    }

    console.log('Creating customer in Dodo Payments...');
    const dodoCustomer = await createDodoCustomer(dodoClient, customerData);
    
    if (!dodoCustomer || !dodoCustomer.customer_id) {
      throw new Error('Failed to create customer in Dodo Payments - no customer ID returned');
    }

    console.log('Creating customer in Supabase...');
    const supabaseCustomer = await createCustomer(supabase, {
      email: customerData.email,
      name: customerData.name,
      dodo_customer_id: dodoCustomer.customer_id,
    });

    console.log('Customer created successfully:', supabaseCustomer.id);
    return supabaseCustomer;

  } catch (error) {
    console.error('Error creating customer:', error);
    throw new Error(`Failed to create customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Sync customer data from Dodo Payments to Supabase (used in webhook handling)
 * Based on webhook function logic
 * @param supabase - Supabase client instance
 * @param dodoClient - Dodo Payments client instance
 * @param dodoCustomerId - Dodo customer ID
 * @param customerData - Customer data from webhook
 * @returns Synced customer data
 */
export async function syncCustomerFromWebhook(
  supabase: SupabaseClient,
  dodoCustomerId: string,
  customerData: { email: string; name: string }
): Promise<Customer> {
  try {
    let supabaseCustomer = await getCustomerByDodoId(supabase, dodoCustomerId);

    if (!supabaseCustomer) {
      console.log('Creating new customer from webhook');
      supabaseCustomer = await createCustomer(supabase, {
        email: customerData.email,
        name: customerData.name,
        dodo_customer_id: dodoCustomerId,
      });
    }

    return supabaseCustomer;

  } catch (error) {
    console.error('Error syncing customer from webhook:', error);
    throw new Error(`Failed to sync customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
