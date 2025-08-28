import { SupabaseClient } from '@supabase/supabase-js';
import DodoPayments from 'dodopayments';
import {
  createSubscription,
  updateSubscription,
  getSubscriptionByDodoId,
  getCustomerByEmail,
  getCustomerById
} from '../lib/supabase.js';
import { createDodoSubscription, getDodoSubscription } from '../lib/dodo.js';
import { createCheckoutUrl } from '../config.js';
import { CreateSubscriptionRequest, Subscription } from '../types.js';

/**
 * Create a new subscription for a customer
 * Based on subscribe function logic
 * @param supabase - Supabase client instance
 * @param dodoClient - Dodo Payments client instance
 * @param subscriptionData - Subscription information
 * @returns Created subscription with payment link
 */
export async function createSubscriptionFlow(
  supabase: SupabaseClient,
  dodoClient: DodoPayments,
  subscriptionData: {
    customer_email: string;
    product_id: string;
    billing_interval: string;
    trial_period_days?: number;
  }
) {
  try {
    // Get customer by email (like subscribe function)
    const customer = await getCustomerByEmail(supabase, subscriptionData.customer_email);
    if (!customer) {
      throw new Error('Customer not found. Please sign up first.');
    }

    console.log('Creating subscription in Dodo Payments...');
    
    const dodoSubscription = await createDodoSubscription(dodoClient, {
      customer_id: customer.dodo_customer_id,
      product_id: subscriptionData.product_id,
      billing_interval: subscriptionData.billing_interval,
      trial_period_days: subscriptionData.trial_period_days,
      payment_frequency_count: 1,
      payment_frequency_interval: subscriptionData.billing_interval,
    });

    if (!dodoSubscription || !dodoSubscription.subscription_id) {
      throw new Error('Failed to create subscription in Dodo Payments');
    }

    // Create subscription record in Supabase
    console.log('Creating subscription in Supabase...');
    const supabaseSubscription = await createSubscription(supabase, {
      customer_id: customer.id,
      dodo_subscription_id: dodoSubscription.subscription_id,
      product_id: subscriptionData.product_id,
      status: 'pending',
      billing_interval: subscriptionData.billing_interval,
      amount: dodoSubscription.recurring_pre_tax_amount || 0,
      currency: 'USD',
    });

    console.log('Subscription created successfully:', supabaseSubscription.id);
    
    const checkoutUrl = createCheckoutUrl(subscriptionData.product_id, subscriptionData.customer_email);
    
    return {
      subscription: supabaseSubscription,
      payment_link: checkoutUrl,
      client_secret: dodoSubscription.client_secret || null,
      dodo_subscription_id: dodoSubscription.subscription_id,
    };

  } catch (error) {
    console.error('Error creating subscription:', error);
    throw new Error(`Failed to create subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle subscription webhook events (based on webhook function logic)
 * @param supabase - Supabase client instance
 * @param subscriptionData - Subscription data from webhook
 * @param status - New subscription status
 * @returns Updated subscription
 */
export async function handleSubscriptionWebhook(
  supabase: SupabaseClient,
  subscriptionData: any,
  status: string
): Promise<void> {
  try {
    // Update or create subscription (matches webhook function logic)
    const existing = await getSubscriptionByDodoId(supabase, subscriptionData.subscription_id);

    if (existing) {
      // Update existing subscription
      await updateSubscription(supabase, subscriptionData.subscription_id, { 
        status, 
        updated_at: new Date().toISOString() 
      });
      console.log(`✅ Updated subscription to ${status}`);
    } else {
      // Create new subscription (needs customer_id from the webhook customer data)
      const customerRecord = await supabase
        .from('customers')
        .select('id')
        .eq('dodo_customer_id', subscriptionData.customer.customer_id)
        .single();

      if (customerRecord.data) {
        await createSubscription(supabase, {
          customer_id: customerRecord.data.id,
          dodo_subscription_id: subscriptionData.subscription_id,
          product_id: subscriptionData.product_id,
          status,
          billing_interval: subscriptionData.payment_frequency_interval?.toLowerCase() || 'month',
          amount: subscriptionData.recurring_pre_tax_amount || 0,
          currency: subscriptionData.currency || 'USD',
          next_billing_date: subscriptionData.next_billing_date,
        });
        console.log(`✅ Created new subscription with ${status} status`);
      }
    }
  } catch (error) {
    console.error('Error handling subscription webhook:', error);
    throw error;
  }
}
