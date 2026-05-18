# GitHub Pages Deployment Guide

## Setup Instructions

Your Banahub platform is ready to deploy on GitHub Pages.

### Step 1: Enable GitHub Pages

1. Go to: https://github.com/Ibthisam29/Banahub-platform
2. Click **Settings** (top right)
3. Click **Pages** (left sidebar)
4. Under **"Source"**:
   - Select **Deploy from a branch**
   - Select branch: **main**
   - Select folder: **/ (root)** or **/banahub-site**
   - Click **Save**

### Step 2: Add Custom Domain

1. In **Settings > Pages**
2. Under **"Custom domain"**:
   - Enter: `banahub.com`
   - Click **Save**

GitHub will create a `CNAME` file automatically.

### Step 3: Update GoDaddy DNS

1. Go to **GoDaddy.com** → **Domains** → **banahub.com**
2. Click **Manage DNS**
3. Add/Update these **A records**:

   | Type | Host | Points to | TTL |
   |------|------|-----------|-----|
   | A | @ | 185.199.108.153 | Auto |
   | A | @ | 185.199.109.153 | Auto |
   | A | @ | 185.199.110.153 | Auto |
   | A | @ | 185.199.111.153 | Auto |

4. Add/Update this **CNAME record**:

   | Type | Host | Points to | TTL |
   |------|------|-----------|-----|
   | CNAME | www | Ibthisam29.github.io | Auto |

5. **Keep your Google Workspace MX records** (do not delete!)

### Step 4: Wait for DNS Propagation

- Wait **5-15 minutes** for DNS to propagate

### Step 5: Verify HTTPS

1. Go back to GitHub **Settings > Pages**
2. Check **"Enforce HTTPS"**
3. Wait 1-5 minutes for SSL certificate

### Step 6: Test Your Domain

1. Open: **https://banahub.com**
2. **You should see your Banahub platform!** ✅

---

## ✅ Final Checklist

- [ ] Enabled GitHub Pages
- [ ] Added custom domain: banahub.com
- [ ] Added 4 A records in GoDaddy
- [ ] Added CNAME record for www
- [ ] Kept Google Workspace MX records
- [ ] Waited 5-15 minutes for DNS
- [ ] Enabled HTTPS enforcement
- [ ] Tested: banahub.com loads ✅
- [ ] Email still works ✅

---

## 📝 Notes

- No Cloudflare account needed
- HTTPS is free and automatic
- Your site updates when you push to GitHub
- Email routing continues working (GoDaddy MX records)

---

**Ready to proceed? Follow the steps above!**
