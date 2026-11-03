# Cloudinary — tenant media (logos, hero, products)

AnantaOne stores each company’s uploads under:

```text
anantaone/tenants/{company-slug}/logo
anantaone/tenants/{company-slug}/hero
anantaone/tenants/{company-slug}/products
anantaone/tenants/{company-slug}/assets
```

## Render (API Web Service only)

Dashboard → **API Web Service** (e.g. `anantaoneapi`) → **Environment**.

**Not** the Static Site. Uploads use the API credentials.

### Option A — single URL (preferred)

| Key | Value |
|---|---|
| `CLOUDINARY_URL` | `cloudinary://<api_key>:<api_secret>@dtd4hpmjb` |

Rules:
- No spaces
- No wrapping quotes (`"` or `'`)
- Cloud name at the end must be `dtd4hpmjb`
- API **Key** is the long number; API **Secret** is the random string
- After save → **Manual Deploy** the API

### Option B — three separate keys

| Key | Value |
|---|---|
| `CLOUDINARY_CLOUD_NAME` | `dtd4hpmjb` |
| `CLOUDINARY_API_KEY` | from Cloudinary console |
| `CLOUDINARY_API_SECRET` | from Cloudinary console |

If both A and B are set, **A (`CLOUDINARY_URL`) wins**.

## “Invalid API key” checklist

1. Env is on the **API** service, not Static Site  
2. Value has **no quotes**  
3. Format is `cloudinary://KEY:SECRET@dtd4hpmjb` (key before secret)  
4. Key/secret are from the **same** Cloudinary cloud (`dtd4hpmjb`)  
5. API was **redeployed** after changing env  
6. Open Owner → **Public shop** — status line should say credentials accepted and show cloud + key hint  

## Local `.env`

```text
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@dtd4hpmjb
```

## Owner usage

1. Log in as **owner** (or manager)
2. **Public shop** (`/#/owner/site`) — upload logo / hero / library  
3. **Company** — logo  
4. **Products** — image on create or per row  
5. Public shop → `/#/shop/{slug}`

## Uploads & HTTP 413

Images are compressed in the browser and uploaded **directly to Cloudinary**
(signed by the API) so large files do not hit Render’s body limit.
