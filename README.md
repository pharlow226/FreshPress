# FreshPress Laundry Service

A modern, full-stack web application built for FreshPress, a premium laundry and dry-cleaning service based in Lagos, Nigeria. The platform features a customer-facing portal for booking pickups, a secure staff dashboard for managing orders, and an AI-powered voice assistant ("Pressy") that handles customer inquiries and order creation over real-time audio.

## 📋 Table of Contents

- [What It Does](#what-it-does)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Setup & Local Development](#setup--local-development)
- [Environment Variables](#environment-variables)
- [Edge Functions (Supabase)](#edge-functions-supabase)
- [Voice AI Integration (Vapi)](#voice-ai-integration-vapi)
- [License](#license)

---

## What It Does

FreshPress provides an end-to-end operational platform for laundry businesses:
1. **Customer Portal:** Allows users to view pricing, book laundry pickups, and track their order status in real time.
2. **Staff/Admin Dashboard:** A secured area (`/staff`) for employees to view incoming orders, update statuses (Pending, Picked Up, Processing, Ready, Delivered), and generate invoices.
3. **Voice AI Assistant:** A floating widget that allows customers to have natural, real-time phone conversations with "Pressy", an AI agent capable of reading prices, checking order statuses, and scheduling pickups directly into the database.

## Key Features

- **Real-time Order Tracking:** Customers can track their laundry using their `LAU-XXXXXX` order ID.
- **Automated Invoicing:** Admins can generate and send PDF invoices to customers.
- **AI Voice Agent:** Fully integrated Voice AI (via Vapi.ai) that natively queries the Supabase database.
- **Role-Based Access Control:** Supabase Row Level Security (RLS) ensures only authorized staff can manage orders.
- **Responsive Design:** Mobile-first architecture built with Tailwind CSS.

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript
- **Styling:** Tailwind CSS, shadcn/ui components, Lucide Icons
- **Backend & Database:** Supabase (PostgreSQL, Auth, Edge Functions)
- **AI Voice Agent:** Vapi.ai (Powered by LiveKit, Deepgram, and OpenAI)
- **Deployment:** Vercel (Frontend), Supabase (Backend/Functions)

## Repository Structure

```text
.
├── src/
│   ├── components/       # Reusable UI components (shadcn/ui)
│   ├── lib/              # Utility functions and Supabase client
│   ├── routes/
│   │   ├── customer/     # Customer-facing pages (Home, Pricing, Tracking)
│   │   └── staff/        # Admin and staff dashboard pages
│   ├── App.tsx           # Main application router
│   └── main.tsx          # React entry point
├── supabase/
│   └── functions/        # Deno Edge Functions (vapi-webhook, create-order, etc.)
├── index.html            # HTML entry point (includes Open Graph meta tags)
├── package.json          # npm dependencies
└── README.md
```

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for deploying Edge Functions)
- A [Vapi.ai](https://vapi.ai/) account (for Voice AI features)

## Setup & Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/pharlow226/FreshPress.git
   cd FreshPress
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Create a `.env` file in the root directory (see [Environment Variables](#environment-variables) below).

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`.

## Environment Variables

Create a `.env` file in the root directory and configure the following required variables. **Never commit this file to version control.**

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Vapi Voice Assistant Configuration
VITE_VAPI_PUBLIC_KEY=your_vapi_public_key
VITE_VAPI_ASSISTANT_ID=your_vapi_assistant_id
```

## Edge Functions (Supabase)

This project relies on several Supabase Edge Functions (e.g., `vapi-webhook`, `create-order`, `generate-invoice`). 

To deploy an Edge Function using the Supabase CLI:
```bash
# Login to Supabase CLI
supabase login

# Link your local project
supabase link --project-ref your_project_id

# Deploy a specific function (e.g., vapi-webhook)
supabase functions deploy vapi-webhook --no-verify-jwt
```

*Note: Functions triggered by external services like Vapi.ai must be deployed with the `--no-verify-jwt` flag so they are accessible to the webhook.*

## Voice AI Integration (Vapi)

The AI Voice Assistant ("Pressy") is configured via the Vapi dashboard. 
The configuration schema (System Prompt and Database Tool definitions) can be found in `vapi_configuration.json`. 

The Voice AI communicates with the database through the `vapi-webhook` Edge Function, which exposes the following tools:
- `get_pricing`
- `check_order_status`
- `create_pickup_order`

## License

This project is proprietary and confidential. All rights reserved.
