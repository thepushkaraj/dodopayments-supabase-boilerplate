import { SupabaseClient } from '@supabase/supabase-js';
import { verifyWebhook } from '../lib/verifyWebhook.js';
import { logWebhookEvent, markWebhookProcessed, createPayment } from '../lib/supabase.js';
import { syncCustomerFromWebhook } from './customer.js';
import { handleSubscriptionWebhook } from './subscription.js';
import { WebhookPayload } from '../types.js';

/**
 * Process incoming webhook from Dodo Payments (based on webhook function logic)
 * @param supabase - Supabase client instance
   * @param rawPayload - Raw webhook payload as string
   * @param headers - Webhook headers for signature verification
 * @param webhookKey - Optional webhook key for verification
   * @returns Processing result
   */
export async function processWebhook(
  supabase: SupabaseClient,
    rawPayload: string,
    headers: {
      'webhook-id'?: string;
      'webhook-signature'?: string;
      'webhook-timestamp'?: string;
  },
  webhookKey?: string
  ) {
    try {
    console.log('📨 Webhook received');

    // Verify webhook signature if webhook key is provided (like webhook function)
    if (webhookKey) {
      try {
        await verifyWebhook(rawPayload, headers, webhookKey);
        console.log('✅ Webhook signature verified');
      } catch (verificationError) {
        console.error('❌ Webhook verification failed:', verificationError);
        throw new Error(`Webhook verification failed: ${verificationError}`);
      }
    } else {
      console.log('🔓 Processing webhook without signature verification (demo mode)');
    }

    const payload = JSON.parse(rawPayload) as any; // Use any since webhook structure varies
    const eventType = payload.type; // Use 'type' field like webhook function
    const eventData = payload.data;

    // Log webhook event for debugging
    const loggedEvent = await logWebhookEvent(supabase, {
      event_type: eventType,
      data: eventData,
      processed: false,
    });

    console.log(`🔄 Processing: ${eventType} (${eventData.payload_type || 'unknown'})`);

    // Process the webhook based on event type (matches webhook function logic)
    switch (eventType) {
      case 'subscription.active':
        await handleSubscriptionEvent(supabase, eventData, 'active');
        break;
      case 'subscription.cancelled':
        await handleSubscriptionEvent(supabase, eventData, 'cancelled');
        break;
      case 'payment.succeeded':
        await handlePaymentEvent(supabase, eventData, 'succeeded');
        break;
      default:
        console.log(`ℹ️ Event ${eventType} logged but not processed`);
    }

    // Mark webhook as processed
    if (loggedEvent?.id) {
      await markWebhookProcessed(supabase, loggedEvent.id);
    }

    console.log('✅ Webhook processed successfully');

    return {
      success: true,
      event_type: eventType,
      message: 'Webhook processed successfully'
    };

      } catch (error) {
    console.error('❌ Webhook processing failed:', error);
    throw new Error(`Webhook processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle subscription events (matches webhook function logic)
 * @param supabase - Supabase client instance
 * @param data - Event data
 * @param status - Subscription status
 */
async function handleSubscriptionEvent(supabase: SupabaseClient, data: any, status: string) {
  const customer = data.customer;
  
  if (!customer) {
    console.warn('No customer data in subscription webhook');
    return;
  }
  
  // Ensure customer exists
  let customerRecord = await supabase
    .from('customers')
    .select('id')
    .eq('dodo_customer_id', customer.customer_id)
    .single();

  if (!customerRecord.data) {
    console.log('Creating new customer from webhook');
    const newCustomerResult = await supabase
      .from('customers')
      .insert([{
        email: customer.email,
        name: customer.name,
        dodo_customer_id: customer.customer_id,
      }])
      .select('id')
      .single();
    customerRecord = newCustomerResult;
  }

  // Use the subscription webhook handler
  await handleSubscriptionWebhook(supabase, data, status);
}

/**
 * Handle payment events (matches webhook function logic)
 * @param supabase - Supabase client instance
 * @param data - Event data
 * @param status - Payment status
 */
async function handlePaymentEvent(supabase: SupabaseClient, data: any, status: string) {
  const customer = data.customer;
  
  if (!customer || !data.payment_id) {
    console.warn('No customer or payment_id in payment webhook');
    return;
  }
  
  // Find customer
  const { data: customerRecord } = await supabase
    .from('customers')
    .select('id')
    .eq('dodo_customer_id', customer.customer_id)
    .single();

  if (customerRecord) {
    // Log the payment using official Dodo webhook structure
    await createPayment(supabase, {
      customer_id: customerRecord.id,
      dodo_payment_id: data.payment_id,
      amount: data.total_amount || 0,
      currency: data.currency || 'USD',
      status,
      payment_method: data.payment_method || null,
    });
    
    console.log(`✅ Logged payment ${status}`);
  } else {
    console.warn('Payment received but customer not found');
  }
}