# Environment Variables for Render Deployment

## Backend Environment Variables

Add these environment variables in your Render backend service:

### Server Configuration
- `PORT` = `3000` (Render sets this automatically)
- `NODE_ENV` = `production`
- `BASE_URL` = `https://your-backend-app.onrender.com` (update after deployment)

### Database
- `DATABASE_URL` = `sqlite:./database.sqlite` (Render will handle this)

### Twilio Configuration
- `TWILIO_ACCOUNT_SID` = `your_twilio_account_sid`
- `TWILIO_AUTH_TOKEN` = `your_twilio_auth_token`
- `TWILIO_PHONE_NUMBER` = `+18884719323`
- `LIVE_AGENT_NUMBER` = `+1234567890`

### OpenAI Configuration
- `OPENAI_API_KEY` = `your_openai_api_key`
- `OPENAI_MODEL` = `gpt-4o-mini`

### ElevenLabs Configuration
- `ELEVENLABS_API_KEY` = `your_elevenlabs_api_key`
- `ELEVENLABS_VOICE_ID` = `your_voice_id`

### Google Maps API
- `GOOGLE_MAPS_API_KEY` = `your_google_maps_api_key`

### Frontend URL
- `FRONTEND_URL` = `https://your-frontend-app.onrender.com` (update after frontend deployment)

## Frontend Environment Variables

Add these environment variables in your Render frontend service:

- `NEXT_PUBLIC_API_URL` = `https://your-backend-app.onrender.com` (update after backend deployment) 