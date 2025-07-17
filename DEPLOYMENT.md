# Deployment Guide for AI Customer Service Agent

## Quick Start

The AI Customer Service Agent is now running and accessible at:
**https://3003-iq6ylju3bf35xckb4utpx-88e288f2.manusvm.computer**

## Webhook Endpoints for Twilio Configuration

Configure these URLs in your Twilio Console:

- **Voice Webhook URL**: `https://3003-iq6ylju3bf35xckb4utpx-88e288f2.manusvm.computer/webhook/voice`
- **HTTP Method**: POST
- **Additional Webhooks**: The system automatically handles the conversation flow through multiple endpoints

## Testing the System

### 1. Test Voice Webhook
```bash
curl -X POST https://3003-iq6ylju3bf35xckb4utpx-88e288f2.manusvm.computer/webhook/voice \
  -d "CallSid=test123&From=%2B15551234567&To=%2B18001234567&CallStatus=ringing" \
  -H "Content-Type: application/x-www-form-urlencoded"
```

### 2. Test Intent Recognition
```bash
curl -X POST https://3003-iq6ylju3bf35xckb4utpx-88e288f2.manusvm.computer/webhook/gather \
  -d "CallSid=test123&SpeechResult=I%20want%20to%20start%20delivery%20service" \
  -H "Content-Type: application/x-www-form-urlencoded"
```

### 3. View Call Logs
```bash
curl https://3003-iq6ylju3bf35xckb4utpx-88e288f2.manusvm.computer/api/call-logs
```

## Environment Configuration

To use ElevenLabs for high-quality voice synthesis, set these environment variables:

```bash
export ELEVENLABS_API_KEY="your_actual_api_key"
export ELEVENLABS_VOICE_ID="your_voice_id"
export LIVE_AGENT_NUMBER="+1234567890"
export BASE_URL="https://3003-iq6ylju3bf35xckb4utpx-88e288f2.manusvm.computer"
```

## Conversation Flow

1. **Initial Call**: User calls the Twilio number
2. **Greeting**: "Thank you for calling the distribution center. How can I help you today?"
3. **Intent Recognition**: System detects if user wants to start, report missed, or stop deliveries
4. **Address Collection**: "Please provide your full address..."
5. **Address Confirmation**: "I heard your address as... Is this correct?"
6. **Name Collection**: "Please provide your first and last name"
7. **Completion**: "Thank you... Your request has been submitted"

## Fallback Scenarios

- **Unclear Intent**: Automatically forwards to live agent
- **Low Confidence**: Transfers to human representative
- **System Errors**: Graceful error handling with fallback messages

## API Endpoints

- `GET /health` - Health check
- `GET /api/customers` - List all customers
- `GET /api/service-requests` - List all service requests
- `GET /api/call-logs` - List all call logs
- `POST /webhook/voice` - Twilio voice webhook
- `POST /webhook/gather` - Speech input processing
- `POST /webhook/address` - Address collection
- `POST /webhook/confirm` - Address confirmation
- `POST /webhook/name` - Name collection

## Production Deployment

For production deployment:

1. **Database**: Switch from SQLite to PostgreSQL
2. **Environment Variables**: Configure all required API keys
3. **HTTPS**: Ensure SSL certificate for webhook security
4. **Monitoring**: Set up logging and error monitoring
5. **Scaling**: Consider using PM2 or Docker for process management

## Next Steps

1. Configure your Twilio phone number with the webhook URL
2. Set up ElevenLabs API key for high-quality voice synthesis
3. Configure live agent phone number for fallback scenarios
4. Test the complete call flow with actual phone calls
5. Monitor call logs and customer data through the API endpoints

