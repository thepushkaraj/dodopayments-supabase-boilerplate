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

    console.log('Creating subscription flow - NOT creating in DodoPayments yet...');
    
    // NOTE: We no longer create the subscription in DodoPayments here
    // Instead, we only create the database record and the checkout URL
    // The actual DodoPayments subscription will be created when the user pays
    // This prevents duplicate subscriptions in DodoPayments dashboard
    
    // Generate a temporary subscription ID for database record
    const tempSubscriptionId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create subscription record in Supabase with pending status
    console.log('Creating pending subscription in Supabase...');
    const supabaseSubscription = await createSubscription(supabase, {
      customer_id: customer.id,
      dodo_subscription_id: tempSubscriptionId, // Temporary ID until actual payment
      product_id: subscriptionData.product_id,
      status: 'pending',
      billing_interval: subscriptionData.billing_interval,
      amount: 0, // Will be updated when subscription is actually created in DodoPayments
      currency: 'USD',
    });

    console.log('Pending subscription created successfully:', supabaseSubscription.id);
    
    const checkoutUrl = createCheckoutUrl(subscriptionData.product_id, subscriptionData.customer_email);
    
    return {
      subscription: supabaseSubscription,
      payment_link: checkoutUrl,
      client_secret: null, // No client secret since no DodoPayments subscription yet
      dodo_subscription_id: tempSubscriptionId,
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
    console.log('🔄 Processing subscription webhook:', JSON.stringify(subscriptionData, null, 2));
    
    if (!subscriptionData.subscription_id) {
      console.warn('❌ No subscription_id in webhook data');
      return;
    }

    // Check for existing subscription first (by actual DodoPayments subscription ID)
    console.log(`🔍 Looking for subscription with Dodo ID: ${subscriptionData.subscription_id}`);
    const existing = await getSubscriptionByDodoId(supabase, subscriptionData.subscription_id);

    if (existing) {
      // Update existing subscription
      console.log(`📝 Updating existing subscription (current status: ${existing.status})`);
      await updateSubscription(supabase, subscriptionData.subscription_id, { 
        status, 
        updated_at: new Date().toISOString() 
      });
      console.log(`✅ Updated subscription from ${existing.status} to ${status}`);
    } else {
      // No existing subscription found - check for pending subscription with temp ID
      console.log('📝 No existing subscription found, checking for pending subscription');
      
      if (!subscriptionData.customer || !subscriptionData.customer.customer_id) {
        console.warn('❌ No customer data in subscription webhook');
        return;
      }

      const customerRecord = await supabase
        .from('customers')
        .select('id')
        .eq('dodo_customer_id', subscriptionData.customer.customer_id)
        .single();

      if (customerRecord.error) {
        console.error('❌ Customer not found for subscription:', customerRecord.error);
        throw new Error(`Customer not found: ${customerRecord.error.message}`);
      }

      if (customerRecord.data) {
        const customerId = customerRecord.data.id;
        
        // Check if there's a pending subscription with a temporary ID for this customer and product
        console.log('🔍 Looking for pending subscription with temporary ID...');
        const pendingSubscriptionResult = await supabase
          .from('subscriptions')
          .select('*')
          .eq('customer_id', customerId)
          .eq('product_id', subscriptionData.product_id || 'unknown')
          .eq('status', 'pending')
          .like('dodo_subscription_id', 'temp_%')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const newSubscriptionData = {
          customer_id: customerId,
          dodo_subscription_id: subscriptionData.subscription_id,
          product_id: subscriptionData.product_id || 'unknown',
          status,
          billing_interval: subscriptionData.payment_frequency_interval?.toLowerCase() || 'month',
          amount: subscriptionData.recurring_pre_tax_amount || 0,
          currency: subscriptionData.currency || 'USD',
          next_billing_date: subscriptionData.next_billing_date,
        };

        if (!pendingSubscriptionResult.error && pendingSubscriptionResult.data) {
          console.log('📝 Updating existing pending subscription with real DodoPayments data');
          
          const updateResult = await supabase
            .from('subscriptions')
            .update(newSubscriptionData)
            .eq('id', pendingSubscriptionResult.data.id)
            .select();

          if (updateResult.error) {
            console.error('❌ Failed to update pending subscription:', updateResult.error);
            throw new Error(`Failed to update pending subscription: ${updateResult.error.message}`);
          }

          console.log(`✅ Updated pending subscription to ${status} status`);
        } else {
          // No pending subscription found, create new one
          console.log('📋 Creating new subscription:', JSON.stringify(newSubscriptionData, null, 2));
          await createSubscription(supabase, newSubscriptionData);
          console.log(`✅ Created new subscription with ${status} status`);
        }
      }
    }
  } catch (error) {
    console.error('Error handling subscription webhook:', error);
    throw error;
  }
}
