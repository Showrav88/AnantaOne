# AnantaOne — Git Workflow

## Branch map

```
main          ← production (stable, deployable)
 ↑
 ├── local-dev   ← your PC (home, office laptop)
 └── cloud-dev   ← Cursor Cloud Agent (mobile, web)
      ↑
 feature/*      ← one task per branch
```

## Who uses which branch

| Environment | Default branch | Example |
|---|---|---|
| **Local PC** | `local-dev` | Coding on `D:\AnantaOne` |
| **Cloud Agent (mobile/web)** | `cloud-dev` | Cursor app, cursor.com |
| **Production** | `main` | Live deploy only |

---

## Local PC workflow

```bash
git checkout local-dev
git pull origin local-dev
git checkout -b feature/auth-module

# ... code, test, commit ...
git push -u origin feature/auth-module

# Merge to local-dev (PR or direct)
git checkout local-dev
git merge feature/auth-module
git push origin local-dev
```

---

## Cloud Agent workflow

```bash
git checkout cloud-dev
git pull origin cloud-dev
git checkout -b feature/inventory-api

# ... cloud agent codes, commits, pushes ...
git push -u origin feature/inventory-api

# Merge to cloud-dev
git checkout cloud-dev
git merge feature/inventory-api
git push origin cloud-dev
```

**Cloud Agent settings:**
- Repo: `Showrav88/AnantaOne`
- Branch: **`cloud-dev`**

---

## Sync local ↔ cloud

Both dev branches should stay in sync. After finishing work on one side:

### Local finished → update cloud

```bash
# On local PC
git push origin local-dev

# On cloud agent (or pull on PC before cloud session)
git checkout cloud-dev
git pull origin local-dev
git push origin cloud-dev
```

### Cloud finished → update local

```bash
# Cloud agent pushes cloud-dev

# On local PC
git checkout local-dev
git pull origin cloud-dev
```

### Shared feature branch (easiest)

Both environments use the **same feature branch**:

```bash
git checkout -b feature/orders
git push -u origin feature/orders

# Local works → push
# Cloud pulls feature/orders → continues → push
# Local pulls → continues
```

---

## Merge to production

```bash
# When local-dev AND cloud-dev are tested and synced:
git checkout main
git pull origin main
git merge local-dev    # or merge via GitHub PR
git push origin main
```

**Rule:** Only merge to `main` when both environments agree the code is stable.

---

## Branch naming

| Pattern | Example | Use |
|---|---|---|
| `feature/*` | `feature/buyer-portal` | New feature |
| `fix/*` | `fix/stock-calculation` | Bug fix |
| `hotfix/*` | `hotfix/payment-webhook` | Urgent production fix |

---

## Daily checklist

| Step | Local PC | Cloud Agent |
|---|---|---|
| 1. Pull latest | `git pull origin local-dev` | `git pull origin cloud-dev` |
| 2. Create branch | `git checkout -b feature/x` | `git checkout -b feature/x` |
| 3. Work & commit | Yes | Yes |
| 4. Push | `git push origin feature/x` | `git push origin feature/x` |
| 5. Merge to dev branch | → `local-dev` | → `cloud-dev` |
| 6. Sync other env | Push local-dev, pull on cloud | Push cloud-dev, pull on PC |

---

## What NOT to do

- Do not commit directly to `main`
- Do not work on `develop` (renamed to `local-dev`)
- Do not keep code only on one PC without pushing
- Do not commit `.env` or secrets

---

## GitHub repo

```
https://github.com/Showrav88/AnantaOne.git

Branches:
  main       → production
  local-dev  → local PC
  cloud-dev  → cloud agents
```
