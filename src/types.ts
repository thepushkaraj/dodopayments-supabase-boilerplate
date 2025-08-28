export interface Customer {
  id: string;
  email: string;
  name: string;
  dodo_customer_id: string;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  customer_id: string;
  dodo_subscription_id: string;
  product_id: string;
  status: 'active' | 'cancelled' | 'paused' | 'expired' | 'pending';
  billing_interval: string;
  amount: number;
  currency: string;
  next_billing_date?: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  customer_id: string;
  subscription_id?: string;
  dodo_payment_id: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'failed' | 'processing' | 'cancelled';
  payment_method?: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookEvent {
  id: string;
  event_type: string;
  data: any;
  processed: boolean;
  created_at: string;
}

export interface CreateCustomerRequest {
  email: string;
  name: string;
}

export interface CreateSubscriptionRequest {
  customer_id: string;
  product_id: string;
  billing_interval: string;
}

export interface WebhookPayload {
  event_type: string;
  data: {
    subscription?: {
      subscription_id: string;
      customer: {
        customer_id: string;
        email: string;
        name: string;
      };
      product_id: string;
      status: string;
      recurring_pre_tax_amount: number;
      payment_frequency_interval: string;
      next_billing_date?: string;
      cancelled_at?: string;
    };
    payment?: {
      payment_id: string;
      customer: {
        customer_id: string;
        email: string;
        name: string;
      };
      total_amount: number;
      currency: string;
      status: string;
      payment_method?: string;
    };
  };
  timestamp: string;
}

export interface DodoConfig {
  bearerToken: string;
  environment: 'test_mode' | 'live_mode';
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}
