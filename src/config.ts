import { DodoConfig, SupabaseConfig } from './types.js';

export const dodoConfig: DodoConfig = {
  bearerToken: process.env.DODO_PAYMENTS_API_KEY || '',
  environment: (process.env.DODO_PAYMENTS_ENVIRONMENT as 'test_mode' | 'live_mode') || 'test_mode',
};

export const supabaseConfig: SupabaseConfig = {
  url: process.env.SUPABASE_URL || '',
  anonKey: process.env.SUPABASE_ANON_KEY || '',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
};

export const appConfig = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY || '',
  checkoutUrl: process.env.DODO_CHECKOUT_URL || 'https://test.checkout.dodopayments.com',
};

// Utility function to create checkout URLs
export function createCheckoutUrl(productId: string): string {
  return `${appConfig.checkoutUrl}/buy/${productId}`;
}

// Validate required environment variables
export function validateConfig(): void {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY', 
    'SUPABASE_SERVICE_ROLE_KEY',
    'DODO_PAYMENTS_API_KEY',
    'DODO_PAYMENTS_WEBHOOK_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
