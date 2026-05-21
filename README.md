# 🧺 FreshPress — Premium Laundry Services

FreshPress is a state-of-the-art, fully featured laundry service application tailored for Lagos, Nigeria. This repository represents the unified, merged codebase combining the **Customer-Facing Portal**, the **Admin/Staff Management Dashboard**, and the backend **Supabase Edge Functions** into a single, high-performance web application.

---

## ✨ Features & Architecture

The application is structured into three main modules:

### 1. 🛒 Customer Portal
- **Interactive Booking:** Customers can request pickups, select schedules (Morning/Afternoon/Evening), and enter pickup/delivery details.
- **Dynamic Order Tracking:** Live order timeline with progress updates (Order Placed ➜ Picked Up ➜ Processing ➜ Invoice Sent ➜ Ready ➜ Delivered).
- **Dynamic Pricing Explorer:** Loaded directly from Supabase, featuring interactive price cards and an automated, database-backed Minimum Order Surcharge warning (e.g., automatically adjusting when the admin changes it).
- **AI Chat Assistant:** A smart conversational assistant powered by OpenAI GPT-4o-mini and integrated directly with Supabase to answer customer inquiries and track orders in real time.

### 2. 🛡️ Admin & Staff Dashboard
- **Overview Analytics:** Live indicators for active orders, revenue tracking, pending invoices, and staff workloads.
- **Order Management:** Assign, reassign, update delivery status, invoice generation, and delay notifications.
- **Staff Management:** Create, update, or suspend driver/accountant/operations staff accounts securely.
- **Company Settings Panel:** Live administration of payment/bank details, VAT tax rates, geographic coordinate markers (Latitude/Longitude), service areas, and the **Minimum Order Value**.

### 3. ⚡ Supabase Edge Functions (Deno backend)
- **`save-company-settings`**: Sanitizes and saves administrative business profiles, coordinates, and service areas to the database.
- **`chat-assistant`**: Powers the conversational interface, dynamically fetching database settings and tracking orders.
- **`generate-invoice`**: Automatically computes invoice PDFs with accurate VAT tax rates and payment instructions.
- ...and standalone helper functions (`create-order`, `confirm-payment`, `mark-delivered`, etc.) for transactional operations.

---

## 🛠️ Getting Started (Local Development)

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **Git** (v2.54+ installed)
- **Supabase CLI** (for Edge Functions development)

### Setup & Run
1. **Clone & Navigate**
   ```sh
   git clone https://github.com/pharlow226/FreshPress.git
   cd FreshPress
   ```

2. **Install Dependencies**
   ```sh
   npm install
   ```

3. **Configure Environment**
   Duplicate `.env.example` as `.env` and fill in your Supabase project keys, OpenAI keys, and other required variables:
   ```sh
   cp .env.example .env
   ```

4. **Launch Dev Server**
   ```sh
   npm run dev
   ```
   The application will be accessible at: `http://localhost:5173/`

---

## ☁️ Deploying to Vercel (Frontend & UI)

Vercel is the recommended hosting provider for the frontend React/Vite application. It provides a free global CDN, instantaneous build previews, and zero-config deployment for Vite projects.

### Step-by-Step Deployment:

1. **Push your code to GitHub** (Completed! Your code is hosted at `https://github.com/pharlow226/FreshPress.git`).
2. **Log into Vercel**
   - Go to [vercel.com](https://vercel.com/) and log in using your **GitHub account**.
3. **Import the Project**
   - Click the **"New Project"** button in your Vercel dashboard.
   - Under "Import Git Repository", find and select your **`FreshPress`** repository.
4. **Configure Project Settings**
   - **Framework Preset**: Vercel will automatically detect **Vite** as the framework. Keep it as default.
   - **Root Directory**: `./` (Keep as default).
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. **Add Environment Variables**
   - Expand the **"Environment Variables"** dropdown.
   - Add all the variables from your local `.env` file that begin with `VITE_` (Vercel requires these to inject them into the production build bundle). Key variables include:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
     - `VITE_SAVE_COMPANY_SETTINGS_URL`
     - `VITE_CHAT_ASSISTANT_URL`
     - ...and any other custom endpoint URLs.
6. **Deploy!**
   - Click **"Deploy"**. Vercel will build and launch your application in under 60 seconds and provide a production URL (e.g., `https://freshpress-yourusername.vercel.app`).
   - **Continuous Deployment:** Any time you push new commits to your GitHub `main` branch, Vercel will automatically trigger a new build and deploy the changes silently in the background!

---

## ⚡ Deploying Supabase Edge Functions

You can deploy the backend Edge Functions directly to your live Supabase project.

### 1. Login to Supabase CLI
```powershell
supabase login
```

### 2. Deploy All Functions at Once
Use the pre-configured PowerShell script in the root directory to deploy all Edge Functions automatically:
```powershell
powershell -ExecutionPolicy Bypass -File .\deploy-all-functions.ps1
```

### 3. Deploy a Single Function manually
```powershell
& "$env:USERPROFILE\supabase-bin\supabase.exe" functions deploy chat-assistant --project-ref pofiytkpduprbkmgunbg --use-docker=false
```

---

## 📁 Repository Structure
```
FreshPress/
├── src/
│   ├── components/       # Shared UI and layout elements
│   ├── hooks/            # Reusable React hooks
│   ├── lib/              # Database, operational, and Status helpers
│   ├── routes/
│   │   ├── admin/        # Admin Dashboard pages and settings
│   │   ├── customer/     # Customer portal, price cards, order forms
│   │   └── staff/        # Operating crew portal and login pages
│   └── main.tsx          # App bootstrapper
├── supabase/
│   └── functions/        # Deno Edge Functions (Chat, Save, Invoices)
├── .env.example          # Environment boilerplate
├── .gitignore            # File exclusions
├── tailwind.config.ts    # Styling theme
└── vite.config.ts        # Bundler configuration
```

---

## 🛡️ License
Private and confidential. Built for **FreshPress Laundry Services**.
