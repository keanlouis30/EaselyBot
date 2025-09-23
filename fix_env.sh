#!/bin/bash

echo "🔧 Fixing .env configuration..."

# Fix Supabase URL
echo "✅ Updating SUPABASE_URL..."
sed -i 's|SUPABASE_URL=https://your-project.supabase.co|SUPABASE_URL=https://xwahxqgraraosrnmqakt.supabase.co|' .env

# Generate and add encryption key if not present
if ! grep -q "ENCRYPTION_KEY=" .env; then
    echo "🔐 Generating ENCRYPTION_KEY..."
    ENCRYPTION_KEY=$(openssl rand -base64 32)
    echo "" >> .env
    echo "# Security" >> .env
    echo "ENCRYPTION_KEY=$ENCRYPTION_KEY" >> .env
    echo "✅ Added ENCRYPTION_KEY"
else
    echo "✅ ENCRYPTION_KEY already exists"
fi

echo ""
echo "📋 Current .env status:"
echo "------------------------"
grep "SUPABASE_URL=" .env
grep "ENCRYPTION_KEY=" .env || echo "ENCRYPTION_KEY=<not found>"

echo ""
echo "✅ .env file has been updated!"
echo ""
echo "🚀 Next steps:"
echo "1. Run the database schema in Supabase SQL Editor"
echo "2. Test your connection with: npm start"
