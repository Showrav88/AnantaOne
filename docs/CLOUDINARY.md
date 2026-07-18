# Cloudinary — tenant media (logos, hero, products)

AnantaOne stores each company’s uploads under:

```text
anantaone/tenants/{company-slug}/logo
anantaone/tenants/{company-slug}/hero
anantaone/tenants/{company-slug}/products
anantaone/tenants/{company-slug}/assets
```

## Render (API Web Service)

Dashboard → **AnantaOneApi** (or your API service) → **Environment** → add:

| Key | Value |
|---|---|
| `CLOUDINARY_URL` | `cloudinary://<api_key>:<api_secret>@dtd4hpmjb` |

Replace `<api_key>` and `<api_secret>` with the values from the Cloudinary console.  
**Never commit the secret** to git.

Example shape (placeholders only):

```text
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@dtd4hpmjb
```

Then **Save** → **Manual Deploy** the API service so the env is loaded.

## Local `.env`

In `apps/api/.env` (or repo root `.env` loaded by the API):

```text
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@dtd4hpmjb
```

## Redeploy both services from `cloud-dev`

Uploads only appear after the **Static Site** is rebuilt from `cloud-dev`.  
Uploads only succeed after the **API** has `CLOUDINARY_URL` and is redeployed.

## Owner usage

1. Log in as **owner** (or manager) — employees are read-only
2. Sidebar → **Public shop** (`/#/owner/site`) — file pickers at the top
3. Or **Company** → logo file picker
4. Or **Products** → choose image while creating a product, or on each row later
5. Open **Open public shop** → `#/shop/{your-slug}`

## Uploads & HTTP 413

Images are **compressed in the browser** and uploaded **directly to Cloudinary**
(signed by the API). That avoids Render “413 Payload Too Large” when the file
never passes through the API body.

## Public URLs

| Page | Path |
|---|---|
| Tenant shop | `/#/shop/{slug}` |
| Product tag QR | `/#/tag/{slug}/{sku}/{batch}` |
| Invoice QR | `/#/invoice/{slug}/{invoiceCode}` |

Each active company can look different via its own branding fields.
