import DodoPayments from 'dodopayments';
import { CreateCustomerRequest } from '../types.js';

/**
 * Create a Dodo Payments client instance
 * @param bearerToken - Dodo Payments API key
 * @param environment - Environment ('test_mode' | 'live_mode')
 * @returns Dodo Payments client instance
 */
export function createDodoClient(bearerToken: string, environment: 'test_mode' | 'live_mode'): DodoPayments {
  return new DodoPayments({
    bearerToken,
    environment,
  });
}

// Customer operations
export async function createDodoCustomer(
  dodoClient: DodoPayments, 
  customerData: CreateCustomerRequest
) {
  try {
    const customer = await dodoClient.customers.create({
      email: customerData.email,
      name: customerData.name,
    });

    return customer;
  } catch (error) {
    throw new Error(`Failed to create Dodo customer: ${error}`);
  }
}

export async function getDodoCustomer(dodoClient: DodoPayments, customerId: string) {
  try {
    const customer = await dodoClient.customers.retrieve(customerId);
    return customer;
  } catch (error) {
    throw new Error(`Failed to retrieve Dodo customer: ${error}`);
  }
}

export async function updateDodoCustomer(
  dodoClient: DodoPayments, 
  customerId: string, 
  updates: { email?: string; name?: string }
) {
  try {
    const customer = await dodoClient.customers.update(customerId, updates);
    return customer;
  } catch (error) {
    throw new Error(`Failed to update Dodo customer: ${error}`);
  }
}

// Subscription operations
export async function createDodoSubscription(
  dodoClient: DodoPayments,
  subscriptionData: {
    customer_id: string;
    product_id: string;
    billing_interval: string;
    quantity?: number;
    trial_period_days?: number;
    payment_frequency_count?: number;
    payment_frequency_interval?: string;
  }
) {
  try {
    const subscription = await dodoClient.subscriptions.create({
      customer: { customer_id: subscriptionData.customer_id },
      product_id: subscriptionData.product_id,
      quantity: subscriptionData.quantity || 1,
      trial_period_days: subscriptionData.trial_period_days,
      payment_frequency_count: subscriptionData.payment_frequency_count || 1,
      payment_frequency_interval: subscriptionData.payment_frequency_interval || subscriptionData.billing_interval,
      billing: {
        city: 'Default City',
        country: 'US' as any,
        state: 'Default State',
        street: 'Default Street',
        zipcode: '00000'
      },
    } as any);

    return subscription;
  } catch (error) {
    throw new Error(`Failed to create Dodo subscription: ${error}`);
  }
}

export async function getDodoSubscription(dodoClient: DodoPayments, subscriptionId: string) {
  try {
    const subscription = await dodoClient.subscriptions.retrieve(subscriptionId);
    return subscription;
  } catch (error) {
    throw new Error(`Failed to retrieve Dodo subscription: ${error}`);
  }
}

export async function updateDodoSubscription(
  dodoClient: DodoPayments, 
  subscriptionId: string, 
  updates: any
) {
  try {
    const subscription = await dodoClient.subscriptions.update(subscriptionId, updates);
    return subscription;
  } catch (error) {
    throw new Error(`Failed to update Dodo subscription: ${error}`);
  }
}

export async function cancelDodoSubscription(dodoClient: DodoPayments, subscriptionId: string) {
  try {
    const subscription = await dodoClient.subscriptions.update(subscriptionId, {
      cancel_at_next_billing_date: true
    });
    return subscription;
  } catch (error) {
    throw new Error(`Failed to cancel Dodo subscription: ${error}`);
  }
}

// Payment operations
export async function createDodoPayment(
  dodoClient: DodoPayments,
  paymentData: {
    customer_id: string;
    product_cart: Array<{ product_id: string; quantity: number }>;
    billing: {
      city: string;
      country: any;
      state: string;
      street: string;
      zipcode: string;
    };
  }
) {
  try {
    const payment = await dodoClient.payments.create({
      customer: { customer_id: paymentData.customer_id },
      product_cart: paymentData.product_cart,
      billing: paymentData.billing,
    });

    return payment;
  } catch (error) {
    throw new Error(`Failed to create Dodo payment: ${error}`);
  }
}

export async function getDodoPayment(dodoClient: DodoPayments, paymentId: string) {
  try {
    const payment = await dodoClient.payments.retrieve(paymentId);
    return payment;
  } catch (error) {
    throw new Error(`Failed to retrieve Dodo payment: ${error}`);
  }
}

// Product operations
export async function createDodoProduct(
  dodoClient: DodoPayments,
  productData: {
    name: string;
    price: number;
    currency: any;
    description?: string;
    tax_category?: any;
  }
) {
  try {
    const product = await dodoClient.products.create({
      name: productData.name,
      price: productData.price as any,
      description: productData.description,
      tax_category: productData.tax_category || 'standard',
    } as any);

    return product;
  } catch (error) {
    throw new Error(`Failed to create Dodo product: ${error}`);
  }
}

export async function getDodoProduct(dodoClient: DodoPayments, productId: string) {
  try {
    const product = await dodoClient.products.retrieve(productId);
    return product;
  } catch (error) {
    throw new Error(`Failed to retrieve Dodo product: ${error}`);
  }
}
