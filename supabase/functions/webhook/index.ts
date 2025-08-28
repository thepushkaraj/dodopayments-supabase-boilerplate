import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, webhook-id, webhook-signature, webhook-timestamp',
};



interface WebhookPayload {
  business_id: string;
  type: string; // This is the correct field name from Dodo
  timestamp: string;
  data: {
    payload_type: "Payment" | "Subscription" | "Refund" | "Dispute" | "LicenseKey";
    // Subscription data structure
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
    // Payment data structure
    payment_id?: string;
    total_amount?: number;
    payment_method?: string;
    // Additional fields can be added based on payload_type
  };
}

// Initialize webhook verifier - will use environment variable if available
const webhookKey = Deno.env.get('DODO_PAYMENTS_WEBHOOK_KEY');
const webhook = webhookKey ? new Webhook(webhookKey) : null;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const rawBody = await req.text();
    console.log('📨 Webhook received');

    // Extract webhook headers for verification
    const webhookHeaders = {
      'webhook-id': req.headers.get('webhook-id') || '',
      'webhook-signature': req.headers.get('webhook-signature') || '',
      'webhook-timestamp': req.headers.get('webhook-timestamp') || '',
    };

    // Verify webhook signature if webhook key is configured
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
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      console.log('🔓 Processing webhook without signature verification (demo mode - webhook key not configured)');
    }

    const payload = JSON.parse(rawBody) as WebhookPayload;
    const eventType = payload.type; // Correct field name from Dodo
    const eventData = payload.data;

    // Log webhook event for debugging
    const { data: loggedEvent } = await supabase.from('webhook_events').insert([{
      event_type: eventType,
      data: eventData,
      processed: false,
    }]).select('id').single();

    console.log(`🔄 Processing: ${eventType} (${eventData.payload_type})`);

    // Handle events based on official Dodo webhook structure
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
      await supabase
        .from('webhook_events')
        .update({ processed: true })
        .eq('id', loggedEvent.id);
    }

    console.log('✅ Webhook processed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        event_type: eventType 
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
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Webhook event handlers updated for official Dodo payload structure
async function handleSubscriptionEvent(supabase: any, data: any, status: string) {
  // Data is now in the flat structure from official Dodo webhooks
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
    const { data: newCustomer } = await supabase
      .from('customers')
      .insert([{
        email: customer.email,
        name: customer.name,
        dodo_customer_id: customer.customer_id,
      }])
      .select('id')
      .single();
    customerRecord.data = newCustomer;
  }

  // Update or create subscription
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('dodo_subscription_id', data.subscription_id)
    .single();

  if (existing) {
    // Update existing subscription
    await supabase
      .from('subscriptions')
      .update({ 
        status, 
        updated_at: new Date().toISOString() 
      })
      .eq('dodo_subscription_id', data.subscription_id);
    console.log(`✅ Updated subscription to ${status}`);
  } else {
    // Create new subscription
    await supabase
      .from('subscriptions')
      .insert([{
        customer_id: customerRecord.data.id,
        dodo_subscription_id: data.subscription_id,
        product_id: data.product_id,
        status,
        billing_interval: data.payment_frequency_interval?.toLowerCase() || 'month',
        amount: data.recurring_pre_tax_amount || 0,
        currency: data.currency || 'USD',
        next_billing_date: data.next_billing_date,
      }]);
    console.log(`✅ Created new subscription with ${status} status`);
  }
}

// Payment handler updated for official Dodo webhook structure
async function handlePaymentEvent(supabase: any, data: any, status: string) {
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
    await supabase
      .from('payments')
      .insert([{
        customer_id: customerRecord.id,
        dodo_payment_id: data.payment_id,
        amount: data.total_amount || 0,
        currency: data.currency || 'USD',
        status,
        payment_method: data.payment_method || null,
      }]);
    
    console.log(`✅ Logged payment ${status}`);
  } else {
    console.warn('Payment received but customer not found');
  }
}