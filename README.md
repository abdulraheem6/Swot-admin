# Swot Ads Cloud — Dynamic Ad Engine & Android API

A modern, dynamic ad-management dashboard and serverless edge API built for **Cloudflare Pages & Workers KV**, designed to effortlessly serve structured ad campaigns directly to your **Android Application** in real-time.

---

## 🌟 Key Features

1. **Modern Dynamic Dashboard (`public/index.html` & `public/admin/index.html`)**:
   - Built with Tailwind CSS, Lucide Icons, and responsive design.
   - **Interactive Live Android Device Simulator**: Watch your ad changes update in real-time inside a simulated Android smartphone feed (supports **Banner**, **Photo Cards**, and playable **Video Stream MP4s**).
   - **Multi-Scope City Management**: Seamlessly switch between **Global Ads** (`scope: "global"`) and **City-Specific Ads** (e.g. `city: "Nizamabad"`, `Hyderabad`, etc.) with one-click "+ Add City".
   - **Instant CRUD Actions**:
     - ➕ Create Ad with smart auto-ID generation and field validation.
     - 📱 Preview in Android Phone Simulator.
     - ✏️ Edit Ad with live interactive preview.
     - 📄 Duplicate / Clone Ad in 1 click.
     - ⬆️ / ⬇️ Reorder ads in the array.
     - 🗑️ Delete Ad (with multi-select bulk delete).
     - ⚡ Master Toggle: Enable / Pause ad serving for any city with one click.
   - **Presets & Demo Sets**: Preloaded with exact Global & Nizamabad datasets.
   - **Raw JSON Editor**: Inspect, format, validate, and download or upload full documents.

2. **Android Developer Integration Hub**:
   - Ready-to-use **Kotlin Data Classes** (`AdsResponse`, `AdItem`).
   - Retrofit API service interface.
   - CORS headers (`Access-Control-Allow-Origin: *`) enabled for all public and admin endpoints.
   - Conditional caching with **ETag** and **304 Not Modified** to optimize mobile data consumption.

---

## 📱 JSON Payload Formats Served to Android App

### 1. Global Ads Endpoint: `GET /ads/global.json`

```json
{
  "scope": "global",
  "enabled": true,
  "ads": [
    {
      "id": "global_banner_01",
      "type": "banner",
      "title": "Global Secure Cloud Backup Pro",
      "subtitle": "Zero-knowledge encrypted cloud vault synchronization across Android & Web.",
      "description": "Protect all your passwords, documents, and family records with military-grade AES-256 encryption.",
      "mediaUrl": "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=600&q=80",
      "actionUrl": "https://example.com/cloud-backup-pro",
      "actionLabel": "Upgrade",
      "sponsorTag": "Global Sponsor · Featured",
      "badgeText": "PRO",
      "isDismissible": true,
      "locationInfo": "Worldwide Service",
      "rating": 4.9
    },
    {
      "id": "global_video_02",
      "type": "video",
      "title": "Smart Home AI Security Hub",
      "subtitle": "Seamless Integration with Vault Alarms & Sensors",
      "description": "Get instant intrusion alerts and automated emergency calling right on your phone.",
      "mediaUrl": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      "actionUrl": "https://example.com/smart-home-hub",
      "actionLabel": "Learn More",
      "sponsorTag": "Global Sponsor · Tech",
      "badgeText": "NEW",
      "isDismissible": true,
      "locationInfo": "Global Availability",
      "rating": 4.7
    }
  ]
}
```

### 2. City-Specific Ads Endpoint: `GET /ads/{city}.json` (e.g. `nizamabad.json`)

```json
{
  "city": "Nizamabad",
  "enabled": true,
  "ads": [
    {
      "id": "nzb_banner_01",
      "type": "banner",
      "title": "Nizamabad Fresh Organic Farm Mart",
      "subtitle": "Farm fresh spices, cold-pressed oils & grains directly from Armoor & Bodhan farms.",
      "description": "Get same-day door delivery across Nizamabad town. Special 25% launch discount on your first grocery basket.",
      "mediaUrl": "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80",
      "actionUrl": "https://example.com/nizamabad-mart",
      "actionLabel": "Order Now",
      "sponsorTag": "Sponsored · Nizamabad",
      "badgeText": "25% OFF",
      "isDismissible": true,
      "locationInfo": "Khaleelwadi, Nizamabad",
      "rating": 4.8
    },
    {
      "id": "nzb_photo_02",
      "type": "photo",
      "title": "Sri Mahalaxmi Jewellers — Nizamabad",
      "subtitle": "Festive Gold & Silver Collection",
      "description": "Exquisite 916 BIS Hallmarked wedding jewellery, lightweight daily wear gold, and pure silver artifacts. Visit our main showroom on Subhash Road.",
      "mediaUrl": "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=800&q=80",
      "actionUrl": "https://example.com/mahalaxmi-jewellers",
      "actionLabel": "View Catalogue",
      "sponsorTag": "Local Partner · Subhash Road",
      "badgeText": "FESTIVE SALE",
      "isDismissible": true,
      "locationInfo": "Subhash Road, Nizamabad",
      "rating": 4.9
    },
    {
      "id": "nzb_video_03",
      "type": "video",
      "title": "Nizamabad Smart E-Bikes & Scooters",
      "subtitle": "Zero Emission, 120km Range per Charge",
      "description": "Experience silent high-torque electric mobility designed for Telangana roads. Book a free test ride at our Khaleelwadi dealership.",
      "mediaUrl": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      "actionUrl": "https://example.com/ev-testride",
      "actionLabel": "Book Test Ride",
      "sponsorTag": "Sponsored · Nizamabad EV",
      "badgeText": "SUBSIDY AVAILABLE",
      "isDismissible": true,
      "locationInfo": "Near RTC Complex, Nizamabad",
      "rating": 4.7
    }
  ]
}
```

---

## 📊 Scalability & Cost Analysis (1 Lakh / 100,000 Daily Mobile Phones)

If **1 lakh (100,000) mobile phones** read this JSON daily, here is the traffic breakdown, services used, and cost analysis:

### 1. Traffic Calculations

| Metric | 1 Fetch / Phone / Day | 2 Fetches / Phone / Day *(Global + City)* |
|---|---|---|
| **Daily Requests** | 100,000 requests / day | 200,000 requests / day |
| **Monthly Requests** (30 days) | **3,000,000 (3 Million)** | **6,000,000 (6 Million)** |
| **JSON Payload Size** | ~1.2 KB (gzipped: ~500 B) | ~1.2 KB (gzipped: ~500 B) |
| **Monthly Bandwidth** | ~3.6 GB to 4.5 GB | ~7.2 GB to 9 GB |

### 2. Services Used in this Architecture

1. **Cloudflare Pages**:
   - Hosts the admin dashboard web application (`/` and `/admin/`).
   - **Cost**: **$0.00 / month** (Unlimited static requests & bandwidth included free).

2. **Cloudflare Pages Functions (Workers Runtime)**:
   - Executes `/ads/[city].json.js` to serve the API to Android clients and handles admin changes.
   - Computes ETags and handles cache routing.

3. **Cloudflare Workers KV (`ADS_KV`)**:
   - High-performance, globally replicated Key-Value database that stores your ads JSON documents.

4. **Cloudflare Global Edge Cache & CDN**:
   - Automatically caches `/ads/global.json` and `/ads/nizamabad.json` across Cloudflare's 330+ global edge locations using the configured `Cache-Control: public, max-age=60, s-maxage=300` headers.
   - **Over 90% - 95% of requests are served directly from Cloudflare's edge RAM**, meaning the KV database is only queried occasionally on cache misses.

5. **External Media Storage**:
   - Images and videos are referenced via URLs (`mediaUrl`) pointing to external CDNs (Unsplash, Google Storage, AWS S3, or Cloudflare R2).

### 3. Monthly Cost Breakdown

| Service | Cloudflare Free Tier | Cloudflare Workers Paid ($5/mo) | Your Estimated Monthly Bill |
|---|---|---|---|
| **Cloudflare Pages** | Free (Unlimited) | Free (Unlimited) | **$0.00** |
| **Functions (3M – 6M reqs)** | 100k/day free | 10M included | **$0.00** or **$5.00** |
| **Workers KV Reads** | 100k/day free | 10M included | **$0.00** |
| **Egress Bandwidth** | Free ($0) | Free ($0) | **$0.00** |
| **Total Estimated Cost** | **$0 / month** | **$5 / month (~₹420 INR)** | **Max $5 / month** |

- **Free Tier ($0 / month)**: Covers up to 100,000 requests/day (~3M requests/month) for free.
- **Workers Paid Plan ($5 / month, ~₹420 INR)**: Highly recommended for production. Includes **10 Million requests/month** and **10 Million KV reads/month**, easily supporting 100,000 to 300,000 daily active users with zero overages and zero throttling.

---

## 🤖 Android Implementation (Kotlin)

### Data Models
```kotlin
data class AdsResponse(
    val scope: String? = null,
    val city: String? = null,
    val enabled: Boolean = true,
    val ads: List<AdItem> = emptyList()
)

data class AdItem(
    val id: String,
    val type: String, // "banner", "photo", "video"
    val title: String,
    val subtitle: String? = null,
    val description: String? = null,
    val mediaUrl: String,
    val actionUrl: String,
    val actionLabel: String,
    val sponsorTag: String? = null,
    val badgeText: String? = null,
    val isDismissible: Boolean = true,
    val locationInfo: String? = null,
    val rating: Double? = null
)
```

### Retrofit Service with OkHttp Cache
```kotlin
interface AdsApiService {
    @GET("ads/global.json")
    suspend fun getGlobalAds(): AdsResponse

    @GET("ads/{city}.json")
    suspend fun getCityAds(@Path("city") city: String): AdsResponse
}

// Recommended OkHttpClient setup with cache (supports 304 Not Modified)
fun createOkHttpClient(context: Context): OkHttpClient {
    val cacheSize = 10L * 1024 * 1024 // 10 MB
    val cache = Cache(context.cacheDir, cacheSize)
    return OkHttpClient.Builder()
        .cache(cache)
        .build()
}
```

### Android Best Practices
1. **Enable HTTP Caching / ETag**: Because the backend provides `ETag` and `Cache-Control`, OkHttp automatically caches the JSON. When the ads haven't changed, Cloudflare returns a `304 Not Modified` status, consuming **0 body bytes**.
2. **Fetch Frequency**: Trigger ad requests on app launch or at reasonable intervals (e.g. once every 2–4 hours or during a pull-to-refresh) rather than on every screen navigation.

---

## 🚀 Cloudflare Pages Deployment & Setup

1. **Deploy to Cloudflare Pages**:
   - Connect your Git repository (`Swot-admin`).
   - Build output directory: `public`
   - Build command: *(leave empty or `echo 'Static build'`)*

2. **Configure Cloudflare KV**:
   - In Cloudflare Dashboard, go to **Workers & Pages > KV** and create a namespace named `SWOT_ADS_KV`.
   - In your Pages project, go to **Settings > Functions > KV namespace bindings**:
     - Variable name: `ADS_KV`
     - KV namespace: select `SWOT_ADS_KV`.

3. **Admin Token Authentication & Sign Out**:
   - In Cloudflare Pages, go to **Settings > Environment variables** and add `ADMIN_TOKEN` with your secret passkey.
   - When visiting the website, users are greeted with an **Admin Sign-In Gate** requesting the access token.
   - The token is verified against `/admin/verify` and securely saved in `localStorage` or `sessionStorage` (with a "Remember on this browser" option).
   - Once authenticated, the header displays a live status indicator: `🛡️ Authenticated: ••••<last4>`.
   - Click the **Sign Out** button in the top navigation bar (or inside Settings ⚙️) to immediately revoke the local session, clear tokens, and lock the console.
   - If `ADMIN_TOKEN` is not yet set in Cloudflare, access remains open with an option to continue in Local / Preview Mode.
