# FreshPress Laundry Service

A modern, full-stack web application built for FreshPress, a premium laundry and dry-cleaning service based in Lagos, Nigeria. The platform features a customer-facing portal for booking pickups, a secure staff dashboard for managing orders, and dual AI-powered assistants (Text and Voice) that handle customer inquiries and order creation in real-time.

## 📋 Table of Contents

- [What It Does](#what-it-does)
- [Key Features](#key-features)
- [Staff Roles & Permissions](#staff-roles--permissions)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Setup & Local Development](#setup--local-development)
- [Environment Variables](#environment-variables)
- [Edge Functions (Supabase)](#edge-functions-supabase)
- [AI Integrations](#ai-integrations)
- [License](#license)

---

## What It Does

FreshPress provides an end-to-end operational platform for laundry businesses:
1. **Customer Portal:** Allows users to view pricing, book laundry pickups, and track their order status in real time.
2. **Staff/Admin Dashboard:** A secured area (`/staff`) for employees to view incoming orders, update statuses, and generate invoices.
3. **AI Chat & Voice Assistants:** Dual AI widgets (Text chat and Voice call) that allow customers to have natural conversations with "Pressy". The AI can instantly read live prices, check order statuses, and automatically schedule pickups into the database.

## Key Features

- **Automated Order Assignment:** When a customer creates a new order (via the website or AI Assistant), the system uses a **Round-Robin algorithm** to automatically assign the order to an available Pickup Staff member.
- **Real-time Order Tracking:** Customers can track their laundry using their `LAU-XXXXXX` order ID.
- **Automated Invoicing:** Admins and Accountants can generate and send PDF invoices directly to customers' emails.
- **AI Assistants (Voice & Chat):** Fully integrated AI agents that natively query the Supabase database to provide 24/7 customer service.
- **Role-Based Access Control:** Supabase Row Level Security (RLS) ensures distinct permissions for Admins, Accountants, and Pickup Staff.

## Staff Roles & Permissions

The system uses a strict role-based access control architecture. Each staff member can only see and interact with data relevant to their role:

### 1. Admin
- **Full System Access:** Can view, edit, and delete all orders, customers, and pricing data.
- **Staff Management:** Can create, delete, and manage other staff accounts.
- **Order Overrides:** Can manually re-assign orders to different pickup staff or mark orders as delayed.

### 2. Accountant
- **Financial Access:** Can view all orders but is primarily focused on payments.
- **Invoicing:** Can generate PDF invoices and trigger emails to customers.
- **Payment Confirmation:** Can update an order's payment status to "Paid" once bank transfers or POS payments are confirmed.

### 3. Pickup Staff
- **Restricted View:** Can *only* see orders specifically assigned to them by the round-robin system.
- **Order Status Updates:** Can update the status of their assigned orders (e.g., marking an order as "Picked Up" or "Delivered").
- **Customer Contact:** Can view the customer's phone number and address for their assigned pickups.

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript
- **Styling:** Tailwind CSS, shadcn/ui components, Lucide Icons
- **Backend & Database:** Supabase (PostgreSQL, Auth, Edge Functions)
- **AI Voice Agent:** Vapi.ai (Powered by LiveKit, Deepgram, and OpenAI)
- **AI Chat Agent:** Supabase Edge Functions with OpenAI API
- **Deployment:** Vercel (Frontend), Supabase (Backend/Functions)

## Repository Structure

```text
.
├── src/
│   ├── components/       # Reusable UI components (shadcn/ui)
│   ├── lib/              # Utility functions and Supabase client
│   ├── routes/
│   │   ├── customer/     # Customer-facing pages (Home, Pricing, Tracking)
│   │   └── staff/        # Admin, Accountant, and Pickup Staff dashboards
│   ├── App.tsx           # Main application router
│   └── main.tsx          # React entry point
├── supabase/
│   └── functions/        # Deno Edge Functions (create-order, vapi-webhook, chat-assistant, etc.)
├── index.html            # HTML entry point (includes Open Graph meta tags)
├── package.json          # npm dependencies
└── README.md
```

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for deploying Edge Functions)
- A [Vapi.ai](https://vapi.ai/) account (for Voice AI features)
- An [OpenAI](https://platform.openai.com/) API Key (for Text Chat AI)

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

This project relies on several Supabase Edge Functions to handle backend logic securely. For example, `create-order` handles the round-robin assignment and email notifications, while `vapi-webhook` and `chat-assistant` handle AI communications.

To deploy an Edge Function using the Supabase CLI:
```bash
# Login to Supabase CLI
supabase login

# Link your local project
supabase link --project-ref your_project_id

# Deploy a specific function
supabase functions deploy create-order --no-verify-jwt
```

## AI Integrations

### Voice AI (Vapi.ai)
The Voice Assistant is configured via the Vapi dashboard. The AI communicates with the database through the `vapi-webhook` Edge Function. The configuration schema (System Prompt and Tool definitions) can be found in `vapi_configuration.json`.

### Text Chat AI
The text-based chat widget communicates directly with the `chat-assistant` Supabase Edge Function, which securely queries the OpenAI API to provide dynamic responses based on live database data.

## License

This project is proprietary and confidential. All rights reserved.
