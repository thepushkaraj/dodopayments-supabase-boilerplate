# Dodo Payments + Supabase Boilerplate

**A developer-friendly tool for integrating Dodo Payments with Supabase**

This project provides a complete, plug-and-play solution for developers to add payments to their apps using Dodo Payments and Supabase, following clean architecture principles.

## 🎯 Project Overview

**What This Boilerplate Provides:**
1. **Main Application**: Express.js TypeScript server handling customer creation and subscription management
2. **Webhook Processing**: Supabase Edge Function for secure webhook processing and data sync
3. **Database Integration**: Automatic data synchronization between Dodo Payments and Supabase
4. **Plug & Play Setup**: Change API keys and environment variables to get started

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create a `.env` file in the project root:

```env
# Supabase Configuration (get from your project dashboard)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key  
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Dodo Payments Configuration (get from your dashboard)
DODO_PAYMENTS_API_KEY=your_dodo_payments_api_key
DODO_PAYMENTS_ENVIRONMENT=test_mode
DODO_PAYMENTS_WEBHOOK_KEY=your_dodo_payments_webhook_secret
DODO_CHECKOUT_URL=https://test.checkout.dodopayments.com

# Server Configuration
PORT=3000
NODE_ENV=development
```

### 3. Setup Database
```bash
npx supabase db push
```

### 4. Start the Main Application
```bash
# Development mode
npm run dev

# Or build and run production
npm run build
npm start
```

### 5. Deploy Webhook Function
```bash
npx supabase functions deploy webhook
```

### 6. Configure Webhooks
In your Dodo Payments dashboard, set webhook URL to:
```
https://your-project-id.supabase.co/functions/v1/webhook
```

Select these events:
- `subscription.active`
- `subscription.cancelled`  
- `payment.succeeded`

## 🧪 Testing the Flow

### Demo the Integration

1. **Start the application** with `npm run dev` (runs on http://localhost:3000)
2. **Open** `example/demo.html` in your browser
3. **Configure** the demo to point to `http://localhost:3000`
4. **Signup** a new user (creates customer in both Supabase and Dodo Payments)
5. **Create subscription** (initiates Dodo Payments checkout)
6. **Complete payment** (triggers webhook to Supabase function)
7. **Check Supabase tables** to see real-time data synchronization

### Verify Everything Works

```bash
# Check if functions are deployed
npx supabase functions list

# View webhook logs  
npx supabase functions logs webhook

# Check database tables
# Go to your Supabase dashboard → Table Editor
```

## 📁 Project Structure

```
├── src/
│   ├── server.ts        # Main Express.js application (signup, subscribe APIs)
│   ├── modules/         # Business logic functions
│   ├── lib/             # Utility functions for database and API calls
│   └── types.ts         # TypeScript definitions
├── supabase/
│   ├── functions/
│   │   └── webhook/     # Webhook processing (Deno Edge Function)
│   └── migrations/      # Database schema
├── example/
│   └── demo.html        # Frontend demo
```

### 🏗️ Architecture Overview

**Clean Separation of Concerns:**

1. **Main Application (`src/server.ts`)** - Express.js TypeScript Server
   - Handles customer creation and subscription management
   - Provides REST API endpoints for frontend integration
   - Uses utility functions from `src/lib/` and `src/modules/`
   - Runs on Node.js with standard npm dependencies

2. **Webhook Processing (`supabase/functions/webhook/`)** - Deno Edge Function
   - Handles secure webhook events from Dodo Payments
   - Processes payment and subscription status updates
   - Synchronizes data between Dodo Payments and Supabase
   - Runs on Deno runtime in Supabase infrastructure

**Architecture Benefits:**
- ✅ **Best Practices** = Supabase functions only for webhook handling
- ✅ **Clean Boundaries** = Clear separation between API logic and webhook processing  
- ✅ **Developer Friendly** = Standard Express.js patterns for main application
- ✅ **Scalable** = Main app can be deployed anywhere, webhooks stay in Supabase

## 🔧 How It Works

### 1. Customer Creation Flow
```
Frontend → Main App API → Create in Supabase → Create in Dodo Payments → Return Customer
```

### 2. Subscription Flow  
```
Frontend → Main App API → Create Dodo Subscription → Return Payment Link → User Checkout
```

### 3. Webhook Processing (After Payment)
```
Dodo Event → Supabase Function → Verify Signature → Update Database → Sync Status
```

## 🗄️ Database Schema

**Simple 4-table design:**

- `customers` - User info + Dodo customer mapping
- `subscriptions` - Subscription status and billing
- `payments` - Payment transaction records  
- `webhook_events` - Event logging and debugging

## 🛡️ Security Features


- ✅ Environment variable configuration
- ✅ Supabase RLS ready  
- ✅ No hardcoded secrets

## 📡 API Endpoints

### Main Application (Express.js)
```typescript
// Create user + customer
POST http://localhost:3000/api/signup
{ "email": "user@example.com", "name": "John Doe" }

// Create subscription  
POST http://localhost:3000/api/subscribe
{ "customer_email": "user@example.com", "product_id": "pdt_...", "billing_interval": "month" }

// Get customer by email
GET http://localhost:3000/api/customers/:email
```

### Webhook Processing (Supabase Function)
```typescript
// Process webhooks (automatic from Dodo Payments)
POST https://your-project.supabase.co/functions/v1/webhook
```


## 🔍 Key Features

### ✅ Customer Creation
- Automatic customer creation in both systems
- External customer ID persistence

### ✅ Webhook Handling  
- 🔓 **No authentication required** - perfect for testing!
- Event processing (subscription active/cancelled, payments)
- Database updates in real-time

### ✅ Plug & Play
- Change API keys in `.env` and deploy
- Works with any Supabase project
- Minimal frontend included

### ✅ TypeScript First
- Full type safety
- Clear module boundaries
- Easy to extend

## 🚨 Troubleshooting

**Webhook 401 Error?**
```bash
# Deploy without JWT verification
npx supabase functions deploy webhook --no-verify-jwt --use-docker=false
```

**Database Connection Issues?**
```bash
# Reset and try again
npx supabase db reset
npx supabase db push
```

**Missing Environment Variables?**
- Check `.env` file exists and has all required values
- Restart your terminal after setting variables


**Ready to use!** 🚀