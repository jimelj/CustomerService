# CBA Customer Service Agent

An automated customer service system for newspaper and circulars distribution companies, built with Node.js, Express, Twilio Voice API, and ElevenLabs Text-to-Speech.

## Features

- **Automated Voice Response**: Handles incoming calls with AI-powered conversation flow
- **Intent Recognition**: Understands customer requests for starting, reporting missed, or stopping deliveries
- **Address Collection & Confirmation**: Collects and verifies customer addresses
- **Customer Data Management**: Stores customer information and service requests in database
- **Live Agent Fallback**: Forwards calls to live representatives when AI cannot understand
- **ElevenLabs Integration**: High-quality text-to-speech for natural-sounding responses
- **Twilio Integration**: Robust phone system with speech recognition

## System Architecture

1. **Incoming Call**: Customer calls the 1800 number
2. **Twilio Webhook**: Twilio sends call data to Express server
3. **Conversation Flow**: AI guides customer through structured conversation
4. **Intent Detection**: System identifies customer's intent (start/missed/stop)
5. **Data Collection**: Collects address and customer name with confirmation
6. **Database Storage**: Saves customer info and service requests
7. **Fallback Handling**: Forwards complex cases to live agents

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ai_customer_service
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your actual API keys and configuration
```

4. Start the server:
```bash
npm start
```

## Configuration

### Required Environment Variables

- `ELEVENLABS_API_KEY`: Your ElevenLabs API key
- `ELEVENLABS_VOICE_ID`: Voice ID from ElevenLabs
- `LIVE_AGENT_NUMBER`: Phone number for live agent fallback
- `PORT`: Server port (default: 3000)

### Twilio Setup

1. Create a Twilio account and get your Account SID and Auth Token
2. Purchase a phone number in Twilio Console
3. Configure the webhook URL in Twilio Console:
   - Voice webhook URL: `https://your-domain.com/webhook/voice`
   - HTTP method: POST

### ElevenLabs Setup

1. Create an ElevenLabs account
2. Generate an API key
3. Choose or create a voice and get the Voice ID

## API Endpoints

### Twilio Webhooks
- `POST /webhook/voice` - Initial call handling
- `POST /webhook/gather` - Speech input processing
- `POST /webhook/address` - Address collection
- `POST /webhook/confirm` - Address confirmation
- `POST /webhook/name` - Name collection and request completion

### Data API
- `GET /api/customers` - List all customers
- `GET /api/service-requests` - List all service requests
- `GET /api/call-logs` - List all call logs
- `GET /health` - Health check endpoint

## Database Schema

### Customers
- `id`: Primary key
- `firstName`: Customer's first name
- `lastName`: Customer's last name
- `address`: Full address
- `phoneNumber`: Phone number
- `created_at`, `updated_at`: Timestamps

### Service Requests
- `id`: Primary key
- `customerId`: Foreign key to customers
- `intent`: Request type ('start', 'missed', 'stop')
- `status`: Processing status ('pending', 'processed', 'completed')
- `notes`: Additional notes
- `created_at`, `updated_at`: Timestamps

### Call Logs
- `id`: Primary key
- `callSid`: Twilio call identifier
- `customerId`: Foreign key to customers (nullable)
- `phoneNumber`: Caller's phone number
- `callStatus`: Call outcome ('completed', 'forwarded', 'failed')
- `duration`: Call duration in seconds
- `conversationLog`: JSON log of conversation
- `created_at`, `updated_at`: Timestamps

## Conversation Flow

1. **Greeting**: "Thank you for calling the distribution center. How can I help you today?"
2. **Intent Recognition**: Identifies if customer wants to start, report missed, or stop deliveries
3. **Address Collection**: "Please provide your full address..."
4. **Address Confirmation**: "I heard your address as... Is this correct?"
5. **Name Collection**: "Please provide your first and last name"
6. **Completion**: "Thank you... Your request has been submitted"

## Fallback Scenarios

- **Unclear Intent**: Forwards to live agent
- **No Speech Detected**: Asks customer to call back
- **System Errors**: Graceful error handling with fallback messages

## Development

### Running in Development Mode
```bash
npm run dev
```

### Testing Webhooks Locally
Use ngrok to expose your local server:
```bash
ngrok http 3000
```
Then update your Twilio webhook URL to the ngrok URL.

## Deployment

The application is designed to run on any Node.js hosting platform:

1. **Environment Setup**: Ensure all environment variables are configured
2. **Database**: Switch to PostgreSQL for production by updating the Sequelize configuration
3. **HTTPS**: Ensure your deployment supports HTTPS (required by Twilio)
4. **Scaling**: Consider using PM2 or similar for process management

## Future Enhancements

- **Rasa NLU Integration**: Replace basic intent detection with Rasa for better understanding
- **Advanced Speech Processing**: Implement more sophisticated speech analysis
- **Multi-language Support**: Add support for multiple languages
- **Analytics Dashboard**: Build a web interface for monitoring calls and requests
- **SMS Integration**: Add SMS notifications for service updates

## License

ISC License

