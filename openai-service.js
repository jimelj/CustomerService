const OpenAI = require('openai');

class OpenAIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // System prompt that defines the AI's role and behavior
    this.systemPrompt = `You are a helpful customer service agent for a newspaper and circulars distribution company. Your role is to:

1. Help customers with delivery service requests (start, stop, report missed deliveries)
2. Collect necessary information (address, name) in a natural, conversational way
3. Be polite, professional, and empathetic
4. Keep responses concise but friendly
5. Handle small talk and clarifications naturally

IMPORTANT RULES:
- Always be helpful and patient
- If you don't understand something, ask for clarification
- Don't make up information or promises you can't keep
- Keep the conversation focused on delivery service requests
- If someone asks for something outside your scope, politely redirect them

Your responses should sound natural and human-like, not robotic.`;

    // Context for different conversation stages
    this.contexts = {
      greeting: "The customer has just called and you need to greet them and ask how you can help.",
      intent_clarification: "The customer's request is unclear. Ask them to clarify what they want to do (start, stop, or report missed delivery).",
      address_request: "Ask the customer for their full address including street number, street name, city, and zip code.",
      address_confirmation: "Confirm the address you heard and ask if it's correct.",
      name_request: "Ask the customer for their first and last name.",
      completion: "Thank the customer and confirm their request has been submitted.",
      small_talk: "Handle general conversation, questions about the company, or other non-service requests.",
      error_recovery: "Something went wrong or the customer seems confused. Help them get back on track."
    };
  }

  /**
   * Generate a natural response for a specific context
   * @param {string} context - The conversation context (e.g., 'greeting', 'address_request')
   * @param {string} userInput - What the user just said (optional)
   * @param {object} additionalInfo - Any additional context (e.g., detected address, intent)
   * @returns {Promise<string>} - The generated response
   */
  async generateResponse(context, userInput = '', additionalInfo = {}) {
    try {
      console.log('[OpenAI] Generating response for context:', context);
      
      let prompt = this.systemPrompt + '\n\n';
      prompt += `Current context: ${this.contexts[context]}\n`;
      
      if (userInput) {
        prompt += `Customer just said: "${userInput}"\n`;
      }
      
      if (additionalInfo.address) {
        prompt += `Address to confirm: "${additionalInfo.address}"\n`;
      }
      
      if (additionalInfo.intent) {
        prompt += `Detected intent: ${additionalInfo.intent}\n`;
      }
      
      // Special handling for greeting: instruct GPT to ONLY output the agent's greeting line
      if (context === 'greeting') {
        prompt += '\nRespond ONLY with what the agent should say to greet the customer. Do NOT include any "Customer:" or "Agent:" prefixes, and do NOT include any sample conversation. Just the agent greeting.';
      }
      
      prompt += '\nGenerate a natural, helpful response:';

      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: this.systemPrompt },
          { role: "user", content: prompt }
        ],
        max_tokens: 100, // Lower max tokens for speed
        temperature: 0.6, // Slightly lower for more direct answers
      });

      let response = completion.choices[0].message.content.trim();
      // Post-process: For greeting, strip any 'Customer:' or 'Agent:' prefixes and only use the last line
      if (context === 'greeting') {
        response = response.replace(/^.*Agent:\s*/i, '').replace(/^Customer:.*$/i, '').trim();
        // If response is multi-line, use only the last line
        if (response.includes('\n')) {
          const lines = response.split('\n').map(l => l.trim()).filter(Boolean);
          response = lines[lines.length - 1];
        }
      }
      console.log('[OpenAI] Generated response:', response);
      
      return response;
    } catch (error) {
      console.error('[OpenAI] Error generating response:', error);
      // Fallback to default responses
      return this.getFallbackResponse(context);
    }
  }

  /**
   * Detect intent and extract entities from user input
   * @param {string} userInput - What the user said
   * @returns {Promise<object>} - Intent and entities
   */
  async detectIntent(userInput) {
    try {
      console.log('[OpenAI] Detecting intent for:', userInput);
      
      const prompt = `Analyze this customer request and extract the intent and any relevant information:

Customer: "${userInput}"

Please respond in this exact JSON format:
{
  "intent": "start|stop|missed|live_agent|unknown",
  "confidence": 0.0-1.0,
  "entities": {
    "address": "extracted address if mentioned",
    "name": "extracted name if mentioned"
  },
  "reasoning": "brief explanation of why this intent was chosen"
}

Intent meanings:
- "start": Customer wants to start delivery service
- "stop": Customer wants to stop delivery service  
- "missed": Customer is reporting a missed delivery
- "live_agent": Customer wants to speak to a human
- "unknown": Intent is unclear or doesn't match above`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are an intent detection system. Always respond with valid JSON." },
          { role: "user", content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.1, // Low temperature for consistent intent detection
      });

      const response = completion.choices[0].message.content.trim();
      console.log('[OpenAI] Intent detection response:', response);
      
      // Try to parse the JSON response
      try {
        const result = JSON.parse(response);
        return {
          intent: result.intent || 'unknown',
          confidence: result.confidence || 0.5,
          entities: result.entities || {},
          reasoning: result.reasoning || '',
          method: 'openai'
        };
      } catch (parseError) {
        console.error('[OpenAI] Failed to parse JSON response:', parseError);
        return this.fallbackIntentDetection(userInput);
      }
    } catch (error) {
      console.error('[OpenAI] Error detecting intent:', error);
      return this.fallbackIntentDetection(userInput);
    }
  }

  /**
   * Fallback intent detection using your existing rule-based logic
   */
  fallbackIntentDetection(userInput) {
    const lowerText = userInput.toLowerCase();
    
    if (lowerText.includes('start') || lowerText.includes('begin') || lowerText.includes('new')) {
      return { intent: 'start', confidence: 0.8, entities: {}, method: 'fallback' };
    } else if (lowerText.includes('missed') || lowerText.includes('missing') || lowerText.includes('didn\'t get')) {
      return { intent: 'missed', confidence: 0.8, entities: {}, method: 'fallback' };
    } else if (lowerText.includes('stop') || lowerText.includes('cancel') || lowerText.includes('end')) {
      return { intent: 'stop', confidence: 0.8, entities: {}, method: 'fallback' };
    } else if (lowerText.includes('human') || lowerText.includes('representative') || lowerText.includes('agent')) {
      return { intent: 'live_agent', confidence: 0.8, entities: {}, method: 'fallback' };
    }
    
    return { intent: 'unknown', confidence: 0.3, entities: {}, method: 'fallback' };
  }

  /**
   * Get fallback responses if OpenAI fails
   */
  getFallbackResponse(context) {
    const fallbacks = {
      greeting: "Thank you for calling the distribution center. How can I help you today?",
      intent_clarification: "I'm having trouble understanding your request. Could you please tell me if you want to start delivery service, report a missed delivery, or stop your delivery service?",
      address_request: "Please provide your full address including street number, street name, city, and zip code.",
      address_confirmation: "I heard your address as: {address}. Is this correct?",
      name_request: "Please provide your first and last name.",
      completion: "Thank you for your request. It has been submitted and will be processed shortly.",
      small_talk: "I'm here to help with your delivery service needs. How can I assist you today?",
      error_recovery: "I apologize for the confusion. Let me help you with your delivery service request."
    };
    
    return fallbacks[context] || fallbacks.error_recovery;
  }

  /**
   * Check if OpenAI is properly configured
   */
  isConfigured() {
    return process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here';
  }
}

module.exports = OpenAIService; 