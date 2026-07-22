# Lunara

A gentle, AI-powered perimenopause and menopause wellness companion for women aged 30 to 55. Built for New Zealand and Australia.

## What is this?

Lunara is a mobile web app (PWA) that helps women track symptoms, chat with an AI companion named Luna, read educational articles, connect with a community, and build personalised daily wellness plans.

## Project Structure

```
lunara/
├── index.html          # Main app file (all screens)
├── css/
│   └── style.css       # All styling, animations, themes
├── js/
│   └── app.js          # All logic, AI chat, navigation
├── assets/             # Images and icons (empty for now)
└── README.md           # This file
```

## How to run locally

1. Open `index.html` in your browser. That is it. No server needed.

## How to deploy to Vercel

### Step 1: Create a GitHub repository
1. Go to github.com and sign in
2. Click the + button → New repository
3. Name it `lunara`
4. Make it public
5. Do NOT add a README (we already have one)

### Step 2: Upload your files
Option A — Git command line:
```bash
cd lunara
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/lunara.git
git push -u origin main
```

Option B — GitHub website:
1. Go to your new repo
2. Click "Add file" → "Upload files"
3. Drag and drop all files from this folder
4. Click "Commit changes"

### Step 3: Deploy on Vercel
1. Go to vercel.com and sign in with GitHub
2. Click "Add New Project"
3. Select your `lunara` repository
4. Framework Preset: Select "Other"
5. Click "Deploy"
6. Wait 30 seconds. Done. You will get a live URL.

## Features

- Onboarding flow with symptom selection
- Home dashboard with wellness score
- Symptom tracker with weekly chart
- AI Health Insights
- Personalised Daily Plan
- Community Support
- Education Hub with articles
- AI Chat (Luna) with 3 free messages/day
- Premium subscription screen
- Dark/Light mode
- English and Arabic support
- Localised for NZ/AU (British spelling, local references)

## Tech Stack

- Pure HTML, CSS, JavaScript
- No frameworks, no build step
- LocalStorage for data persistence
- Google Fonts (Outfit + Noto Naskh Arabic)

## Notes

- This is a frontend demo. No backend or real payments.
- Premium is toggled via local state for demo purposes.
- All data stays in your browser.
