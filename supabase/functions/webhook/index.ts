import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, webhook-id, webhook-signature, webhook-timestamp',
};

interface WebhookPayload {
  business_id: string;
  type: string;
  timestamp: string;
  data: {
    payload_type: "Subscription" | "Refund" | "Dispute" | "LicenseKey";
    subscription_id?: string;
    customer?: {
      customer_id: string;
      email: string;
      name: string;
    };
    product_id?: string;
    status?: string;
    recurring_pre_tax_amount?: number;
    payment_frequency_interval?: string;
    next_billing_date?: string;
    cancelled_at?: string;
    currency?: string;
  };
}

// Initialize webhook verifier
const webhookKey = Deno.env.get('DODO_PAYMENTS_WEBHOOK_KEY');
const webhook = webhookKey ? new Webhook(webhookKey) : null;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Validate required environment variables
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing required environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawBody = await req.text();
    console.log('📨 Webhook received');

    const webhookHeaders = {
      'webhook-id': req.headers.get('webhook-id') || '',
      'webhook-signature': req.headers.get('webhook-signature') || '',
      'webhook-timestamp': req.headers.get('webhook-timestamp') || '',
    };

    // Verify webhook signature
    if (webhook && webhookKey) {
      try {
        await webhook.verify(rawBody, webhookHeaders);
        console.log('✅ Webhook signature verified');
      } catch (verificationError) {
        console.error('❌ Webhook verification failed:', verificationError);
        return new Response(
          JSON.stringify({ 
            error: 'Webhook verification failed',
            details: verificationError instanceof Error ? verificationError.message : 'Invalid signature'
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      console.log('🔓 Processing webhook without signature verification (demo mode - webhook key not configured)');
    }

    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody) as WebhookPayload;
    } catch (parseError) {
      console.error('❌ Failed to parse webhook payload:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const eventType = payload.type;
    const eventData = payload.data;

    console.log(`📋 Webhook payload:`, JSON.stringify(payload, null, 2));

    const logResult = await supabase.from('webhook_events').insert([{
      event_type: eventType,
      data: eventData,
      processed: false,
      created_at: new Date().toISOString()
    }]).select('id').single();

    if (logResult.error) {
      console.error('❌ Failed to log webhook event:', logResult.error);
      return new Response(
        JSON.stringify({ error: 'Failed to log webhook event' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const loggedEventId = logResult.data.id;
    console.log('📝 Webhook event logged with ID:', loggedEventId);

    console.log(`🔄 Processing: ${eventType} (${eventData.payload_type || 'unknown payload type'})`);

    try {
      switch (eventType) {
        case 'subscription.active':
          await handleSubscriptionEvent(supabase, eventData, 'active');
          break;
        case 'subscription.cancelled':
          await handleSubscriptionEvent(supabase, eventData, 'cancelled');
          break;
        case 'subscription.renewed':
          console.log('🔄 Subscription renewed - keeping active status and updating billing date');
          await handleSubscriptionEvent(supabase, eventData, 'active');
          break;
        default:
          console.log(`ℹ️ Event ${eventType} logged but not processed (no handler available)`);
      }
      
      const updateResult = await supabase
        .from('webhook_events')
        .update({ 
          processed: true, 
          processed_at: new Date().toISOString() 
        })
        .eq('id', loggedEventId);
      
      if (updateResult.error) {
        console.error('❌ Failed to mark webhook as processed:', updateResult.error);
      } else {
        console.log('✅ Webhook marked as processed');
      }
    } catch (processingError) {
      console.error('❌ Error processing webhook event:', processingError);
      
      await supabase
        .from('webhook_events')
        .update({ 
          processed: false,
          error_message: processingError instanceof Error ? processingError.message : 'Unknown error',
          processed_at: new Date().toISOString()
        })
        .eq('id', loggedEventId);
      
      throw processingError;
    }

    console.log('✅ Webhook processed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        event_type: eventType,
        event_id: loggedEventId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Webhook processing failed:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleSubscriptionEvent(supabase: SupabaseClient, data: any, status: string) {
  if (!data.customer?.customer_id || !data.subscription_id) {
    throw new Error('Missing required fields: customer_id or subscription_id');
  }

  try {
    console.log('🔄 Processing subscription event:', JSON.stringify(data, null, 2));
    
    const customer = data.customer;
    
    // Ensure customer exists
    console.log(`🔍 Looking for customer with Dodo ID: ${customer.customer_id}`);
    let customerRecord = await supabase
      .from('customers')
      .select('id')
      .eq('dodo_customer_id', customer.customer_id)
      .single();

    if (customerRecord.error && customerRecord.error.code === 'PGRST116') {
      console.log('👤 Creating new customer from webhook');
      
      if (!customer.email) {
        throw new Error('Cannot create customer without email');
      }
      
      const customerInsertResult = await supabase
        .from('customers')
        .insert([{
          email: customer.email,
          name: customer.name || customer.email,
          dodo_customer_id: customer.customer_id,
          created_at: new Date().toISOString()
        }])
        .select('id')
        .single();
      
      if (customerInsertResult.error) {
        console.error('❌ Failed to create customer:', customerInsertResult.error);
        throw new Error(`Failed to create customer: ${customerInsertResult.error.message}`);
      }
      
      customerRecord = customerInsertResult;
      console.log('✅ Customer created successfully');
    } else if (customerRecord.error) {
      console.error('❌ Error fetching customer:', customerRecord.error);
      throw new Error(`Error fetching customer: ${customerRecord.error.message}`);
    }

    const customerId = customerRecord.data.id;
    console.log(`✅ Customer found/created with ID: ${customerId}`);

    console.log('🔍 Looking for pending subscription with temporary ID...');
    const pendingSubscriptionResult = await supabase
      .from('subscriptions')
      .select('*')
      .eq('customer_id', customerId)
      .eq('product_id', data.product_id || 'unknown')
      .eq('status', 'pending')
      .like('dodo_subscription_id', 'temp_%')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const subscriptionData = {
      customer_id: customerId,
      dodo_subscription_id: data.subscription_id,
      product_id: data.product_id || 'unknown',
      status,
      billing_interval: data.payment_frequency_interval?.toLowerCase() || 'month',
      amount: data.recurring_pre_tax_amount || 0,
      currency: data.currency || 'USD',
      next_billing_date: data.next_billing_date || null,
      updated_at: new Date().toISOString()
    };

    if (!pendingSubscriptionResult.error && pendingSubscriptionResult.data) {
      // Update the existing pending subscription with real DodoPayments subscription data
      console.log('📝 Updating existing pending subscription with real DodoPayments data');
      console.log('📋 Updating subscription ID:', pendingSubscriptionResult.data.id);
      
      const updateResult = await supabase
        .from('subscriptions')
        .update(subscriptionData)
        .eq('id', pendingSubscriptionResult.data.id)
        .select();

      if (updateResult.error) {
        console.error('❌ Failed to update pending subscription:', updateResult.error);
        throw new Error(`Failed to update pending subscription: ${updateResult.error.message}`);
      }

      console.log(`✅ Updated pending subscription to ${status} status`);
      console.log('📋 Updated subscription result:', JSON.stringify(updateResult.data[0], null, 2));
    } else {
      // No pending subscription found
      console.log('📝 No pending subscription found, using upsert logic');
      console.log('📋 Upserting subscription data:', JSON.stringify(subscriptionData, null, 2));

      const upsertResult = await supabase
        .from('subscriptions')
        .upsert(subscriptionData, { 
          onConflict: 'dodo_subscription_id',
          ignoreDuplicates: false 
        })
        .select();

      if (upsertResult.error) {
        console.error('❌ Failed to upsert subscription:', upsertResult.error);
        throw new Error(`Failed to upsert subscription: ${upsertResult.error.message}`);
      }

      console.log(`✅ Subscription upserted with ${status} status`);
      console.log('📋 Subscription result:', JSON.stringify(upsertResult.data[0], null, 2));
    }

  } catch (error) {
    console.error('❌ Error in handleSubscriptionEvent:', error);
    console.error('❌ Raw webhook data:', JSON.stringify(data, null, 2));
    throw error;
  }
}


