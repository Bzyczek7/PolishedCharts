#!/bin/bash
cd /home/marek/DQN/TradingAlert

echo "Building frontend..."
cd frontend
npm run deploy > /dev/null 2>&1 || VITE_API_URL=https://polishedcharts-backend.onrender.com/api/v1 npx vite build
cd ..

echo "Deploying to gh-pages..."

# Use gh-pages npm package which handles this correctly
cd frontend
npx gh-pages --dist dist --branch gh-pages --dotfiles=true 2>&1 || npx gh-pages --dist dist --branch gh-pages

echo "✓ Deployed! Check https://bzyczek7.github.io/PolishedCharts/ in 2-3 minutes"
