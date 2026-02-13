# Wocket Demo Deployment Guide

This is the production-ready demo version of Wocket with curated NYC building data.

## 🎯 What's Included

- **Frontend**: Next.js app optimized for production
- **Backend**: FastAPI server with PostgreSQL
- **Demo Data**: ~500 carefully selected NYC buildings including:
  - 251 W 92nd St (our main test case)
  - Grade F buildings with 10+ Class C violations
  - Buildings with expired TCOs
  - High ECB penalty buildings
  - Famous addresses (Trump properties, etc.)

## 🚀 Deployment Steps

### 1. Create Accounts (5 minutes)

Create these accounts (all free tiers available):

1. **Vercel** (frontend hosting): https://vercel.com
   - Sign up with GitHub
2. **Railway** (backend hosting): https://railway.app  
   - Sign up with GitHub
3. **Supabase** (database): https://supabase.com
   - Sign up with GitHub

### 2. Set Up Database (10 minutes)

1. **In Supabase**:
   - Create new project: "wocket-demo"
   - Go to Settings → Database
   - Copy the connection string (starts with `postgresql://`)
   - Save it somewhere secure

2. **Load demo data**:
   ```bash
   cd wocket-demo
   export DATABASE_URL="your-supabase-connection-string-here"
   python3 create_demo_db.py
   ```

### 3. Deploy Backend (5 minutes)

1. **In Railway**:
   - Click "New Project" 
   - Choose "Deploy from GitHub repo"
   - Select your wocket-demo repository
   - Railway will automatically detect the `railway.toml`

2. **Set environment variables** in Railway:
   - `DATABASE_URL`: Your Supabase connection string
   - `PORT`: 8000 (Railway sets this automatically)

3. **Deploy**: Railway will build and deploy automatically
4. **Copy the URL**: You'll get something like `https://your-app.railway.app`

### 4. Deploy Frontend (5 minutes)

1. **In Vercel**:
   - Click "New Project"
   - Import your GitHub repository
   - Choose the `frontend` folder as root directory

2. **Set environment variables** in Vercel:
   - `NEXT_PUBLIC_API_URL`: Your Railway backend URL

3. **Deploy**: Click deploy and wait ~2 minutes

### 5. Test Everything

1. Visit your Vercel URL
2. Search for "251 w 92" - should find our test building
3. Generate a report - should work end-to-end
4. Try searching other demo buildings

## 🔧 Environment Variables Summary

**Vercel (Frontend)**:
- `NEXT_PUBLIC_API_URL`: https://your-backend.railway.app

**Railway (Backend)**:  
- `DATABASE_URL`: postgresql://user:pass@host:port/dbname

**Local Development**:
- `DATABASE_URL`: Your Supabase connection string

## 🎮 Demo Features Enabled

- Building search and report cards
- All violation types (HPD, ECB, Safety, Complaints)
- PDF report generation
- Legal context notes
- Days open tracking
- Owner portfolios
- HPD litigation tracking

## 🔒 Security Notes

- Demo database contains only curated public data
- No sensitive development credentials exposed  
- All data sourced from official NYC Open Data
- Production environment isolated from development

## 📊 Demo Data Stats

- ~500 buildings (interesting cases only)
- ~5,000 open violations
- ~2,000 ECB violations  
- ~1,000 complaints
- ~1,000 HPD litigations
- ~2,000 permits/jobs
- Focus on Grade D/E/F buildings with issues

## 🐛 Troubleshooting

**Frontend won't load**: Check that `NEXT_PUBLIC_API_URL` points to your Railway backend

**Backend errors**: Check Railway logs and verify `DATABASE_URL` is correct

**Database connection issues**: Verify Supabase connection string and whitelist Railway's IPs

**Build failures**: Check the logs in Vercel/Railway dashboard

## 🔄 Updating the Demo

After making code changes:
1. Push to GitHub
2. Vercel and Railway auto-deploy
3. No manual intervention needed

---

**Questions?** Check the deployment service dashboards for logs and error details.