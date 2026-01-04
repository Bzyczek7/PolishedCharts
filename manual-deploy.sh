#!/bin/bash
cd /home/marek/DQN/TradingAlert/frontend

# Build
echo "Building..."
VITE_API_URL=https://polishedcharts-backend.onrender.com/api/v1 npx vite build > /dev/null 2>&1

# Create temp dir for gh-pages
TMPDIR=$(mktemp -d)
echo "Using temp dir: $TMPDIR"

# Copy dist files
cp -r dist/* "$TMPDIR/"
cd "$TMPDIR"

# Init git repo
git init
git checkout -b gh-pages

# Configure git
git config user.email "deploy@example.com"
git config user.name "Deploy"

# Add all files
git add .
git commit -m "Deploy" -q

# Push to GitHub (delete old gh-pages, push new one)
git push https://github.com/Bzyczek7/PolishedCharts.git gh-pages:gh-pages --force

# Cleanup
cd /home/marek/DQN/TradingAlert
rm -rf "$TMPDIR"

echo "✓ Deployed!"
