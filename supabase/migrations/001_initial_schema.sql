-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create customers table
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    dodo_customer_id VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create subscriptions table
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    dodo_subscription_id VARCHAR(255) UNIQUE NOT NULL,
    product_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'cancelled', 'paused', 'expired', 'failed')),
    billing_interval VARCHAR(50) NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0, -- Amount in cents
    currency VARCHAR(3) DEFAULT 'USD',
    next_billing_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create payments table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    dodo_payment_id VARCHAR(255) UNIQUE NOT NULL,
    amount INTEGER NOT NULL, -- Amount in cents
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'processing', 'cancelled')),
    payment_method VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create webhook_events table for logging
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    data JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_dodo_id ON customers(dodo_customer_id);
CREATE INDEX idx_subscriptions_customer_id ON subscriptions(customer_id);
CREATE INDEX idx_subscriptions_dodo_id ON subscriptions(dodo_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_payments_customer_id ON payments(customer_id);
CREATE INDEX idx_payments_subscription_id ON payments(subscription_id);
CREATE INDEX idx_payments_dodo_id ON payments(dodo_payment_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX idx_webhook_events_created_at ON webhook_events(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data for testing (optional)
-- You can uncomment these if you want test data

/*
INSERT INTO customers (email, name, dodo_customer_id) VALUES
    ('test@example.com', 'Test User', 'cust_test123'),
    ('demo@example.com', 'Demo User', 'cust_demo456');

INSERT INTO subscriptions (customer_id, dodo_subscription_id, product_id, status, billing_interval, amount, currency) VALUES
    ((SELECT id FROM customers WHERE email = 'test@example.com'), 'sub_test123', 'prod_monthly', 'active', 'month', 2999, 'USD'),
    ((SELECT id FROM customers WHERE email = 'demo@example.com'), 'sub_demo456', 'prod_yearly', 'active', 'year', 29999, 'USD');
*/

-- Row Level Security (RLS) policies
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Allow service role to do everything
CREATE POLICY "Service role can do everything on customers" ON customers
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can do everything on subscriptions" ON subscriptions
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can do everything on payments" ON payments
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can do everything on webhook_events" ON webhook_events
    FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated users to read their own data
CREATE POLICY "Users can read their own customer data" ON customers
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can read their own subscriptions" ON subscriptions
    FOR SELECT USING (customer_id IN (SELECT id FROM customers WHERE auth.uid()::text = id::text));

CREATE POLICY "Users can read their own payments" ON payments
    FOR SELECT USING (customer_id IN (SELECT id FROM customers WHERE auth.uid()::text = id::text));

-- Comments for documentation
COMMENT ON TABLE customers IS 'Customer records linking Supabase users to Dodo Payments customers';
COMMENT ON TABLE subscriptions IS 'Subscription records linking local subscriptions to Dodo Payments subscriptions';
COMMENT ON TABLE payments IS 'Payment records for tracking payment history';
COMMENT ON TABLE webhook_events IS 'Log of all webhook events received from Dodo Payments';

COMMENT ON COLUMN customers.dodo_customer_id IS 'External customer ID from Dodo Payments';
COMMENT ON COLUMN subscriptions.dodo_subscription_id IS 'External subscription ID from Dodo Payments';
COMMENT ON COLUMN subscriptions.amount IS 'Subscription amount in cents';
COMMENT ON COLUMN payments.dodo_payment_id IS 'External payment ID from Dodo Payments';
COMMENT ON COLUMN payments.amount IS 'Payment amount in cents';
COMMENT ON COLUMN webhook_events.data IS 'Full webhook payload as JSON';
COMMENT ON COLUMN webhook_events.processed IS 'Whether this webhook event has been processed';
