#!/bin/bash

# Wocket Demo Deployment Helper
echo "🚀 Wocket Demo Deployment Helper"
echo "================================="

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo "Please set it with your Supabase connection string:"
    echo 'export DATABASE_URL="postgresql://user:pass@host:port/dbname"'
    exit 1
fi

echo "✓ DATABASE_URL is set"

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ ERROR: python3 not found"
    echo "Please install Python 3.7+ to continue"
    exit 1
fi

echo "✓ Python 3 found"

# Install required Python packages
echo "📦 Installing Python dependencies..."
pip3 install psycopg2-binary requests fastapi uvicorn

# Run the database setup
echo "🗄️ Setting up demo database..."
python3 create_demo_db.py

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Demo database setup complete!"
    echo ""
    echo "Next steps:"
    echo "1. Push this code to your GitHub repository"
    echo "2. Deploy backend to Railway (connect to your GitHub repo)"
    echo "3. Deploy frontend to Vercel (connect to your GitHub repo)" 
    echo "4. Set environment variables in both services"
    echo ""
    echo "Your demo will include ~500 NYC buildings with interesting violations!"
else
    echo "❌ Database setup failed. Check the error messages above."
    exit 1
fi