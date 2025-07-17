const axios = require('axios');

class NLUService {
  constructor() {
    // For now, we'll use a simple rule-based approach
    // This can be replaced with Rasa NLU later
    this.rasaEndpoint = process.env.RASA_ENDPOINT || 'http://localhost:5005';
    this.useRasa = process.env.USE_RASA === 'true';
  }

  async detectIntent(text, confidence_threshold = 0.7) {
    if (this.useRasa) {
      return await this.detectIntentWithRasa(text, confidence_threshold);
    } else {
      return this.detectIntentRuleBased(text);
    }
  }

  async detectIntentWithRasa(text, confidence_threshold) {
    try {
      const response = await axios.post(`${this.rasaEndpoint}/model/parse`, {
        text: text
      });

      const { intent, entities } = response.data;
      
      if (intent.confidence >= confidence_threshold) {
        return {
          intent: intent.name,
          confidence: intent.confidence,
          entities: entities,
          method: 'rasa'
        };
      } else {
        return {
          intent: null,
          confidence: intent.confidence,
          entities: entities,
          method: 'rasa',
          reason: 'low_confidence'
        };
      }
    } catch (error) {
      console.error('Rasa NLU error:', error.message);
      // Fallback to rule-based detection
      return this.detectIntentRuleBased(text);
    }
  }

  detectIntentRuleBased(text) {
    const lowerText = text.toLowerCase();
    
    // Define intent patterns
    const intentPatterns = {
      start: [
        'start', 'begin', 'new', 'subscribe', 'sign up', 'get started',
        'want to start', 'need to start', 'would like to start'
      ],
      missed: [
        'missed', 'missing', 'didn\'t get', 'didn\'t receive', 'not delivered',
        'haven\'t received', 'where is my', 'delivery problem'
      ],
      stop: [
        'stop', 'cancel', 'end', 'unsubscribe', 'discontinue', 'quit',
        'want to stop', 'need to cancel', 'would like to stop'
      ],
      live_agent: [
        'speak to someone', 'talk to person', 'human', 'representative',
        'agent', 'help me', 'customer service', 'support'
      ]
    };

    // Calculate confidence based on keyword matches
    let bestIntent = null;
    let bestConfidence = 0;
    let matchedKeywords = [];

    for (const [intent, keywords] of Object.entries(intentPatterns)) {
      let matches = 0;
      let currentMatches = [];
      
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          matches++;
          currentMatches.push(keyword);
        }
      }
      
      // Calculate confidence (simple approach)
      const confidence = Math.min(matches / keywords.length * 2, 1.0);
      
      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestIntent = intent;
        matchedKeywords = currentMatches;
      }
    }

    // Extract entities (simple approach)
    const entities = this.extractEntities(text);

    return {
      intent: bestConfidence > 0.15 ? bestIntent : null,
      confidence: bestConfidence,
      entities: entities,
      matchedKeywords: matchedKeywords,
      method: 'rule_based'
    };
  }

  extractEntities(text) {
    const entities = [];
    
    // Simple entity extraction patterns
    const patterns = {
      phone: /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      address_number: /\b\d{1,5}\b/g,
      zip_code: /\b\d{5}(-\d{4})?\b/g
    };

    for (const [entityType, pattern] of Object.entries(patterns)) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          entities.push({
            entity: entityType,
            value: match,
            start: text.indexOf(match),
            end: text.indexOf(match) + match.length
          });
        });
      }
    }

    return entities;
  }

  // Validate address format
  validateAddress(address) {
    const addressText = address.toLowerCase();
    
    // Check for basic address components
    const hasNumber = /\d/.test(addressText);
    const hasStreet = /street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|way|court|ct|place|pl/.test(addressText);
    const hasCity = addressText.split(' ').length >= 3; // Simple heuristic
    
    return {
      isValid: hasNumber && (hasStreet || hasCity),
      hasNumber,
      hasStreet,
      hasCity,
      confidence: (hasNumber + hasStreet + hasCity) / 3
    };
  }

  // Parse name into first and last
  parseName(nameText) {
    const parts = nameText.trim().split(/\s+/);
    
    if (parts.length === 0) {
      return { firstName: 'Unknown', lastName: '' };
    } else if (parts.length === 1) {
      return { firstName: parts[0], lastName: '' };
    } else {
      return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' ')
      };
    }
  }

  // Generate response based on intent and context
  generateResponse(intent, context = {}) {
    const responses = {
      start: {
        address_request: "I understand you want to start delivery service. Please provide your full address including street number, street name, city, and zip code.",
        confirmation: "Great! I'll help you start your delivery service.",
        error: "I'm having trouble understanding your request to start delivery service."
      },
      missed: {
        address_request: "I understand you want to report a missed delivery. Please provide your full address where the delivery was supposed to be made.",
        confirmation: "I'll help you report the missed delivery.",
        error: "I'm having trouble understanding your missed delivery report."
      },
      stop: {
        address_request: "I understand you want to stop your delivery service. Please provide your address to locate your account.",
        confirmation: "I'll help you stop your delivery service.",
        error: "I'm having trouble understanding your request to stop delivery service."
      },
      live_agent: {
        transfer: "I understand you'd like to speak with a live representative. Let me connect you now.",
        unavailable: "I'm sorry, but our live representatives are currently unavailable. Please try calling back during business hours."
      },
      unknown: {
        clarification: "I'm having trouble understanding your request. Could you please tell me if you want to start delivery service, report a missed delivery, or stop your delivery service?",
        transfer: "I'm having difficulty understanding your request. Let me connect you to a live representative who can better assist you."
      }
    };

    const intentResponses = responses[intent] || responses.unknown;
    const responseType = context.responseType || 'confirmation';
    
    return intentResponses[responseType] || intentResponses.confirmation || responses.unknown.clarification;
  }
}

module.exports = NLUService;

