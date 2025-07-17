require('dotenv').config();
const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
const axios = require('axios');
const path = require('path');
const { sequelize, Customer, ServiceRequest, CallLog } = require('./models');
const NLUService = require('./nlu-service');
const ElevenLabsService = require('./elevenlabs-service');
const OpenAIService = require('./openai-service');

const app = express();
const port = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Store conversation state in memory (in production, use Redis or database)
const conversationState = new Map();

// Initialize services
const nluService = new NLUService();
const elevenLabsService = new ElevenLabsService();
const openaiService = new OpenAIService();

// ElevenLabs configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || 'your_elevenlabs_api_key';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'your_voice_id';

// Live agent phone number
const LIVE_AGENT_NUMBER = process.env.LIVE_AGENT_NUMBER || '+1234567890';

// Serve static audio files
app.use('/audio', express.static(path.join(__dirname, 'audio')));

// Helper function to generate speech with ElevenLabs
async function generateSpeechUrl(text) {
  console.log('[DEBUG] generateSpeechUrl called with text:', text);
  if (elevenLabsService.isConfigured()) {
    console.log('[DEBUG] ElevenLabs isConfigured() returned true');
    const result = await elevenLabsService.generateSpeech(text);
    if (result && result.success) {
      const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
      return `${baseUrl}${result.url}`;
    } else {
      console.error('[DEBUG] ElevenLabs failed to generate speech:', result && result.error);
      return null;
    }
  } else {
    console.log('[DEBUG] ElevenLabs isConfigured() returned false');
    return null;
  }
}

// Helper function to create TwiML response with optional audio URL
async function createTwiMLResponse(text, gather = null, dial = null) {
  let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';

  // Try to generate speech with ElevenLabs
  const audioUrl = await generateSpeechUrl(text);

  if (gather) {
    twiml += `<Gather input="speech" action="${gather.action}" method="POST" speechTimeout="${gather.speechTimeout || 3}" timeout="${gather.timeout || 10}">`;

    if (audioUrl) {
      twiml += `<Play>${audioUrl}</Play>`;
    } else {
      console.error('[DEBUG] No ElevenLabs audio generated, not falling back to Twilio TTS');
      // Optionally, play a silent audio file or just close the gather
      // twiml += `<Play>https://example.com/silence.mp3</Play>`;
    }

    twiml += '</Gather>';
    // No fallback <Say> for debugging
  } else if (dial) {
    if (audioUrl) {
      twiml += `<Play>${audioUrl}</Play>`;
    } else {
      console.error('[DEBUG] No ElevenLabs audio generated for dial, not falling back to Twilio TTS');
    }
    twiml += `<Dial>${dial}</Dial>`;
  } else {
    if (audioUrl) {
      twiml += `<Play>${audioUrl}</Play>`;
    } else {
      console.error('[DEBUG] No ElevenLabs audio generated, not falling back to Twilio TTS');
    }
  }

  if (!dial) {
    twiml += '<Hangup/>';
  }

  twiml += '</Response>';
  return twiml;
}

// Helper function to generate natural responses using OpenAI
async function generateNaturalResponse(context, userInput = '', additionalInfo = {}) {
  if (openaiService.isConfigured()) {
    try {
      return await openaiService.generateResponse(context, userInput, additionalInfo);
    } catch (error) {
      console.error('[ERROR] OpenAI response generation failed:', error);
    }
  }

  // Fallback to default responses
  return openaiService.getFallbackResponse(context);
}

// Import address validation service
const { validateAddress, isAddressComplete: validateAddressComplete } = require('./address-validation-service');

// Helper: Check if address is complete using Google Maps API
async function isAddressComplete(address) {
  if (!address) return false;
  
  try {
    const result = await validateAddress(address);
    console.log('[DEBUG] Address completeness check:', {
      address,
      isComplete: result.isValid && result.confidence >= 0.5
    });
    return result.isValid && result.confidence >= 0.5;
  } catch (error) {
    console.error('[DEBUG] Address validation error:', error);
    // Fall back to basic validation
    const basic = require('./address-validation-service').basicAddressValidation(address);
    return basic.isValid;
  }
}

// Helper: Merge new address info with previous (simple append if not duplicate)
function mergeAddress(prev, next) {
  if (!prev) return next;
  if (!next) return prev;
  // If next is already in prev, don't append
  if (prev.includes(next)) return prev;
  // If prev is already in next, return next
  if (next.includes(prev)) return next;
  // Otherwise, append
  return prev.trim() + ', ' + next.trim();
}

// Routes

// Initial voice webhook - handles incoming calls
app.post('/webhook/voice', async (req, res) => {
  console.log('[WEBHOOK] /webhook/voice called:', req.body);
  try {
    const { CallSid, From, To, CallStatus } = req.body;

    // Check if call log already exists, if not create it
    let callLog = await CallLog.findOne({ where: { callSid: CallSid } });
    if (!callLog) {
      callLog = await CallLog.create({
        callSid: CallSid,
        phoneNumber: From,
        callStatus: CallStatus,
        conversationLog: JSON.stringify([])
      });
    }

    // Initialize conversation state
    conversationState.set(CallSid, {
      step: 'greeting',
      intent: null,
      address: null,
      name: null
    });

    // Generate natural greeting using OpenAI
    const greetingText = await generateNaturalResponse('greeting');

    const twiml = await createTwiMLResponse(
      greetingText,
      {
        action: '/webhook/gather',
        speechTimeout: 5,
        timeout: 15,
        fallback: "I'm sorry, I didn't hear anything. Please call back."
      }
    );

    res.type('text/xml').send(twiml);
  } catch (error) {
    console.error('Error in voice webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Handle speech input
app.post('/webhook/gather', async (req, res) => {
  console.log('[WEBHOOK] /webhook/gather called:', req.body);
  try {
    const { SpeechResult, CallSid } = req.body;
    const speech = SpeechResult ? SpeechResult.toLowerCase() : '';
    console.log('[DEBUG] Raw SpeechResult from Twilio:', SpeechResult);

    // Get conversation state
    const state = conversationState.get(CallSid) || {};

    // Update call log
    const callLog = await CallLog.findOne({ where: { callSid: CallSid } });
    if (callLog) {
      const conversation = JSON.parse(callLog.conversationLog || '[]');
      conversation.push({ user: speech, timestamp: new Date().toISOString() });
      await callLog.update({ conversationLog: JSON.stringify(conversation) });
    }

    // Use OpenAI for intent detection (with fallback to rule-based)
    let nluResult;
    if (openaiService.isConfigured()) {
      nluResult = await openaiService.detectIntent(SpeechResult || '');
    } else {
      nluResult = await nluService.detectIntent(speech);
    }
    console.log('[DEBUG] NLU Result:', nluResult);

    if (!nluResult.intent || nluResult.intent === 'live_agent') {
      // Forward to live agent if intent unclear or explicitly requested
      const message = nluResult.intent === 'live_agent'
        ? "I'll connect you to a live representative right away."
        : await generateNaturalResponse('intent_clarification', SpeechResult);

      const twiml = await createTwiMLResponse(
        message,
        null,
        LIVE_AGENT_NUMBER
      );

      // Update call status
      if (callLog) {
        await callLog.update({ callStatus: 'forwarded' });
      }

      res.type('text/xml').send(twiml);
      return;
    }

    // Update state with intent
    state.intent = nluResult.intent;
    state.nluResult = nluResult;
    conversationState.set(CallSid, state);

    // Generate natural response for address request
    const responseText = await generateNaturalResponse('address_request', SpeechResult, { intent: nluResult.intent });

    const twiml = await createTwiMLResponse(
      responseText,
      {
        action: '/webhook/address',
        speechTimeout: 5,
        timeout: 20,
        fallback: "I didn't receive your address. Please call back."
      }
    );

    res.type('text/xml').send(twiml);
  } catch (error) {
    console.error('[ERROR] in gather webhook:', error);
    // Always return a valid TwiML response on error
    const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Sorry, an error occurred. Please try again later.</Say><Hangup/></Response>';
    res.type('text/xml').send(twiml);
  }
});

// Handle address input
app.post('/webhook/address', async (req, res) => {
  console.log('[WEBHOOK] /webhook/address called:', req.body);
  try {
    const { SpeechResult, CallSid } = req.body;
    const newAddress = SpeechResult || '';
    
    console.log('[DEBUG] Address webhook called:', {
      callSid: CallSid,
      newAddress: newAddress,
      existingState: conversationState.get(CallSid)
    });

    // Get conversation state
    const state = conversationState.get(CallSid) || {};
    // Merge new address info with previous
    state.address = mergeAddress(state.address, newAddress);
    conversationState.set(CallSid, state);
    
    console.log('[DEBUG] Updated conversation state:', {
      callSid: CallSid,
      address: state.address
    });

    // Update call log
    const callLog = await CallLog.findOne({ where: { callSid: CallSid } });
    if (callLog) {
      const conversation = JSON.parse(callLog.conversationLog || '[]');
      conversation.push({ address: newAddress, timestamp: new Date().toISOString() });
      await callLog.update({ conversationLog: JSON.stringify(conversation) });
    }

    // Check if address is complete (async)
    const isComplete = await isAddressComplete(state.address);
    console.log('[DEBUG] Address completeness check:', {
      address: state.address,
      isComplete: isComplete
    });
    
    if (isComplete) {
      console.log('[DEBUG] Address complete, proceeding to confirmation');
      // Generate natural address confirmation
      const confirmationText = await generateNaturalResponse('address_confirmation', state.address, { address: state.address });
      const twiml = await createTwiMLResponse(
        confirmationText,
        {
          action: '/webhook/confirm',
          speechTimeout: 3,
          timeout: 10,
          fallback: "I didn't hear a response. Please call back."
        }
      );
      res.type('text/xml').send(twiml);
    } else {
      console.log('[DEBUG] Address incomplete, asking for more info');
      // Ask for missing parts
      const askText = await generateNaturalResponse('address_request', state.address, { address: state.address });
      const twiml = await createTwiMLResponse(
        askText,
        {
          action: '/webhook/address',
          speechTimeout: 5,
          timeout: 20,
          fallback: "I didn't receive your address. Please call back."
        }
      );
      res.type('text/xml').send(twiml);
    }
  } catch (error) {
    console.error('Error in address webhook:', error);
    // Always return a valid TwiML response on error
    const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Sorry, an error occurred. Please try again later.</Say><Hangup/></Response>';
    res.type('text/xml').send(twiml);
  }
});

// Handle address confirmation
app.post('/webhook/confirm', async (req, res) => {
  console.log('[WEBHOOK] /webhook/confirm called:', req.body);
  try {
    const { SpeechResult, CallSid } = req.body;
    const confirmation = SpeechResult ? SpeechResult.toLowerCase() : '';
    
    console.log('[DEBUG] Address confirmation received:', {
      original: SpeechResult,
      lowercase: confirmation,
      callSid: CallSid,
      conversationState: conversationState.get(CallSid)
    });

    // Check if this is a confirmation or if user is explaining their intent
    const confirmationWords = ['yes', 'yeah', 'correct', 'right', 'that\'s', 'sure', 'okay', 'ok'];
    const isConfirmation = confirmationWords.some(word => confirmation.includes(word));
    
    // Check if user is explaining their intent (like "I didn't get the delivery")
    const intentExplanationWords = ['didn\'t get', 'didn\'t receive', 'missed', 'delivery', 'start', 'stop', 'cancel'];
    const isIntentExplanation = intentExplanationWords.some(word => confirmation.includes(word));
    
    if (isConfirmation || isIntentExplanation) {
      console.log('[DEBUG] Address confirmed, proceeding to name request');
      // Ask for name with natural response
      const nameRequestText = await generateNaturalResponse('name_request', SpeechResult);

      const twiml = await createTwiMLResponse(
        nameRequestText,
        {
          action: '/webhook/name',
          speechTimeout: 5,
          timeout: 15,
          fallback: "I didn't receive your name. Please call back."
        }
      );
      res.type('text/xml').send(twiml);
    } else {
      console.log('[DEBUG] Address not confirmed, asking for address again. Confirmation was:', confirmation);
      // Ask for address again with natural response
      const addressRequestText = await generateNaturalResponse('address_request', SpeechResult);

      const twiml = await createTwiMLResponse(
        addressRequestText,
        {
          action: '/webhook/address',
          speechTimeout: 5,
          timeout: 20,
          fallback: "I didn't receive your address. Please call back."
        }
      );
      res.type('text/xml').send(twiml);
    }
  } catch (error) {
    console.error('Error in confirm webhook:', error);
    // Always return a valid TwiML response on error
    const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Sorry, an error occurred. Please try again later.</Say><Hangup/></Response>';
    res.type('text/xml').send(twiml);
  }
});

// Handle name input and complete the service request
app.post('/webhook/name', async (req, res) => {
  console.log('[WEBHOOK] /webhook/name called:', req.body);
  try {
    const { SpeechResult, CallSid } = req.body;
    const name = SpeechResult || '';

    // Get conversation state
    const state = conversationState.get(CallSid) || {};

    // Get call log
    const callLog = await CallLog.findOne({ where: { callSid: CallSid } });
    if (!callLog) {
      throw new Error('Call log not found');
    }

    // Parse name from natural language
    let firstName = 'Unknown';
    let lastName = '';
    
    // Try to extract names from phrases like "My first name is X. My last name is Y."
    const firstNameMatch = name.match(/first name is ([^.]+)/i);
    const lastNameMatch = name.match(/last name is ([^.]+)/i);
    
    if (firstNameMatch) {
      firstName = firstNameMatch[1].trim();
    }
    if (lastNameMatch) {
      lastName = lastNameMatch[1].trim();
    }
    
    // Fallback to simple split if no pattern match
    if (firstName === 'Unknown') {
      const nameParts = name.trim().split(' ');
      firstName = nameParts[0] || 'Unknown';
      lastName = nameParts.slice(1).join(' ') || '';
    }

    // Clean up the address - take the last confirmed version
    let cleanAddress = state.address || 'Address not provided';
    if (cleanAddress.includes(',')) {
      // If address has multiple parts (from multiple attempts), take the last one
      const addressParts = cleanAddress.split(',').map(part => part.trim());
      // Find the most complete address part (has street, city, zip)
      const completeAddress = addressParts.find(part => 
        /\d+/.test(part) && // has number
        /(street|avenue|road|drive|lane|court|boulevard|place|way)/i.test(part) && // has street type
        /\d{5}/.test(part) // has zip
      );
      if (completeAddress) {
        cleanAddress = completeAddress;
      } else {
        // Fallback: take the last part that looks like an address
        cleanAddress = addressParts[addressParts.length - 1];
      }
    }
    
    // Create customer record
    const customer = await Customer.create({
      firstName: firstName,
      lastName: lastName,
      address: cleanAddress,
      phoneNumber: callLog.phoneNumber
    });

    // Create service request
    await ServiceRequest.create({
      customerId: customer.id,
      intent: state.intent || 'unknown',
      status: 'pending'
    });

    // Update call log
    const conversation = JSON.parse(callLog.conversationLog || '[]');
    conversation.push({ name: name, timestamp: new Date().toISOString() });
    await callLog.update({
      customerId: customer.id,
      callStatus: 'completed',
      conversationLog: JSON.stringify(conversation)
    });

    // Clean up conversation state
    conversationState.delete(CallSid);

    // Generate natural completion message
    const intentMessage = {
      'start': 'start your delivery service',
      'missed': 'report your missed delivery',
      'stop': 'stop your delivery service'
    }[state.intent] || 'process your request';

    const completionText = await generateNaturalResponse('completion', SpeechResult, {
      firstName: firstName,
      intent: intentMessage,
      address: state.address
    });

    const twiml = await createTwiMLResponse(completionText);

    res.type('text/xml').send(twiml);
  } catch (error) {
    console.error('Error in name webhook:', error);
    // Always return a valid TwiML response on error
    const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Sorry, an error occurred. Please try again later.</Say><Hangup/></Response>';
    res.type('text/xml').send(twiml);
  }
});

// API Routes for data access
app.get('/api/customers', async (req, res) => {
  // Add CORS headers
  res.header('Access-Control-Allow-Origin', 'http://localhost:3001');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  try {
    const customers = await Customer.findAll({
      include: [
        { model: ServiceRequest, as: 'serviceRequests' },
        { model: CallLog, as: 'callLogs' }
      ]
    });
    res.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/service-requests', async (req, res) => {
  // Add CORS headers
  res.header('Access-Control-Allow-Origin', 'http://localhost:3001');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  try {
    const requests = await ServiceRequest.findAll({
      include: [{ model: Customer, as: 'customer' }]
    });
    res.json(requests);
  } catch (error) {
    console.error('Error fetching service requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/call-logs', async (req, res) => {
  // Add CORS headers
  res.header('Access-Control-Allow-Origin', 'http://localhost:3001');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  try {
    const logs = await CallLog.findAll({
      include: [{ 
        model: Customer, 
        as: 'customer',
        include: [{ model: ServiceRequest, as: 'serviceRequests' }]
      }]
    });
    res.json(logs);
  } catch (error) {
    console.error('Error fetching call logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  // Add CORS headers
  res.header('Access-Control-Allow-Origin', 'http://localhost:3001');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  try {
    // Check database connection
    await sequelize.authenticate();
    
    // Get basic stats
    const callCount = await CallLog.count();
    const customerCount = await Customer.count();
    const requestCount = await ServiceRequest.count();
    
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      database: 'connected',
      stats: {
        totalCalls: callCount,
        totalCustomers: customerCount,
        totalRequests: requestCount
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ 
      status: 'unhealthy', 
      timestamp: new Date().toISOString(),
      error: error.message 
    });
  }
});

// Initialize database and start server
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    await sequelize.sync({ force: false });
    console.log('Database synchronized.');

    app.listen(port, '0.0.0.0', () => {
      console.log(`CBA Customer Service server running on port ${port}`);
      if (isProduction) {
        console.log(`Webhook URL: https://your-domain.com/webhook/voice`);
      } else {
        console.log(`Webhook URL: http://localhost:${port}/webhook/voice`);
      }
    });
  } catch (error) {
    console.error('Unable to start server:', error);
  }
}

startServer();

