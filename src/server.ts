import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createSupabaseClient } from './lib/supabase.js';
import { createDodoClient } from './lib/dodo.js';
import { createCustomerFlow } from './modules/customer.js';
import { createSubscriptionFlow } from './modules/subscription.js';
import { createCheckoutUrl } from './config.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DODO_PAYMENTS_API_KEY',
  'DODO_PAYMENTS_ENVIRONMENT',
  'DODO_CHECKOUT_URL'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const supabase = createSupabaseClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const dodoClient = createDodoClient(
  process.env.DODO_PAYMENTS_API_KEY!,
  process.env.DODO_PAYMENTS_ENVIRONMENT as 'test_mode' | 'live_mode'
);

app.get('/', (req, res) => {
  res.json({ 
    message: 'Dodo Payments + Supabase Boilerplate API',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/signup', async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({ 
        error: 'Email and name are required' 
      });
    }

    const customer = await createCustomerFlow(supabase, dodoClient, { email, name });

    res.status(201).json({
      success: true,
      customer: customer,
      message: 'Customer created successfully'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('already exists')) {
      return res.status(409).json({ 
        error: 'Customer already exists',
        details: errorMessage
      });
    }

    res.status(500).json({ 
      error: 'Internal server error',
      details: errorMessage
    });
  }
});

app.post('/api/subscribe', async (req, res) => {
  try {
    const { 
      customer_email, 
      product_id, 
      billing_interval, 
      trial_period_days 
    } = req.body;

    if (!customer_email || !product_id || !billing_interval) {
      return res.status(400).json({ 
        error: 'customer_email, product_id, and billing_interval are required' 
      });
    }

    const result = await createSubscriptionFlow(supabase, dodoClient, {
      customer_email,
      product_id,
      billing_interval,
      trial_period_days
    });

    const checkoutUrl = createCheckoutUrl(product_id);

    res.status(201).json({
      success: true,
      subscription: result.subscription,
      payment_link: checkoutUrl,
      dodo_subscription_id: result.dodo_subscription_id,
      message: 'Subscription created successfully'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('not found')) {
      return res.status(404).json({ 
        error: 'Customer not found. Please sign up first.',
        details: errorMessage
      });
    }

    res.status(500).json({ 
      error: 'Internal server error',
      details: errorMessage
    });
  }
});

app.get('/api/customers/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    const { data: customer, error } = await supabase
      .from('customers')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get customer: ${error.message}`);
    }

    if (!customer) {
      return res.status(404).json({ 
        error: 'Customer not found' 
      });
    }

    res.json({
      success: true,
      customer: customer
    });

  } catch (error) {
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.status(500).json({ 
    error: 'Internal server error',
    details: err.message
  });
});
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    available_endpoints: [
      'GET /',
      'POST /api/signup',
      'POST /api/subscribe',
      'GET /api/customers/:email'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`🚀 API running on port ${PORT}`);
});

export { app };
