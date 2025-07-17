const NodeGeocoder = require('node-geocoder');
require('dotenv').config();

// Initialize Google Maps Geocoder
const geocoder = NodeGeocoder({
  provider: 'google',
  apiKey: process.env.GOOGLE_MAPS_API_KEY,
  formatter: null
});

/**
 * Validate and standardize an address using Google Maps Geocoding API
 * @param {string} address - The address to validate
 * @returns {Promise<Object>} - Validation result with standardized address
 */
async function validateAddress(address) {
  try {
    console.log('[Address Validation] Validating address:', address);
    
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      console.warn('[Address Validation] No Google Maps API key found, falling back to basic validation');
      return basicAddressValidation(address);
    }

    // Geocode the address
    const results = await geocoder.geocode(address);
    
    if (!results || results.length === 0) {
      console.log('[Address Validation] No results found for address:', address);
      return {
        isValid: false,
        standardizedAddress: null,
        confidence: 0,
        error: 'Address not found',
        originalAddress: address
      };
    }

    const result = results[0];
    const components = result.extra || {};
    
    // Extract address components with better fallbacks
    const streetNumber = result.streetNumber || '';
    const streetName = result.streetName || '';
    let city = result.city || '';
    // Prefer 2-letter state code if available
    let state = (result.administrativeLevels && result.administrativeLevels.level1short) || result.stateCode || result.state || '';
    const zipcode = result.zipcode || '';
    const country = result.country || '';
    
    // If city/state not found in result, try to extract from formatted address
    if (!city || !state) {
      const formattedAddress = result.formattedAddress || '';
      const addressParts = formattedAddress.split(',').map(part => part.trim());
      
      // Look for city and state in formatted address
      for (let i = 0; i < addressParts.length; i++) {
        const part = addressParts[i];
        // Check if this looks like a state (2-3 letter code or full state name)
        if (!state && (part.length === 2 || part.length === 3 || 
            /^(new york|new jersey|connecticut|pennsylvania|california|texas|florida|illinois|ohio|michigan|georgia|north carolina|virginia|washington|colorado|arizona|tennessee|indiana|massachusetts|wisconsin|missouri|maryland|minnesota|louisiana|alabama|south carolina|kentucky|oregon|oklahoma|iowa|arkansas|mississippi|kansas|utah|nevada|new mexico|west virginia|nebraska|idaho|hawaii|new hampshire|maine|montana|rhode island|delaware|south dakota|north dakota|alaska|vermont|wyoming)$/i.test(part))) {
          state = part;
        }
        // If we found state, the previous part is likely the city
        else if (state && !city && i > 0) {
          city = addressParts[i - 1];
        }
      }
    }
    
    // Build standardized address
    const standardizedAddress = [
      streetNumber,
      streetName,
      city,
      state,
      zipcode,
      country
    ].filter(Boolean).join(', ');
    
    // Calculate confidence based on result quality
    const confidence = calculateConfidence(result, components);
    
    // Determine if address is valid (has street number, street name, city, state, zip)
    const isValid = !!(streetNumber && streetName && city && state && zipcode);
    
    console.log('[Address Validation] Validation result:', {
      original: address,
      standardized: standardizedAddress,
      isValid,
      confidence,
      components: {
        streetNumber,
        streetName,
        city,
        state,
        zipcode,
        country
      }
    });
    
    return {
      isValid,
      standardizedAddress,
      confidence,
      components: {
        streetNumber,
        streetName,
        city,
        state,
        zipcode,
        country
      },
      originalAddress: address,
      formattedAddress: result.formattedAddress
    };
    
  } catch (error) {
    console.error('[Address Validation] Error validating address:', error);
    
    // Fall back to basic validation if API fails
    return basicAddressValidation(address);
  }
}

/**
 * Calculate confidence score based on geocoding result quality
 */
function calculateConfidence(result, components) {
  let confidence = 0.5; // Base confidence
  
  // Increase confidence for exact matches
  if (components.confidence) {
    confidence = Math.min(confidence + components.confidence, 1.0);
  }
  
  // Increase confidence for complete address components
  if (result.streetNumber && result.streetName) confidence += 0.2;
  if (result.city) confidence += 0.1;
  if (result.state) confidence += 0.1;
  if (result.zipcode) confidence += 0.1;
  
  return Math.min(confidence, 1.0);
}

/**
 * Basic address validation fallback (regex-based)
 */
function basicAddressValidation(address) {
  if (!address) {
    return {
      isValid: false,
      standardizedAddress: null,
      confidence: 0,
      error: 'No address provided',
      originalAddress: address
    };
  }
  
  const cleanAddress = address.toLowerCase().trim();
  
  // Basic validation patterns
  const hasNumber = /\d+/.test(cleanAddress);
  const hasStreet = /(street|st\.|avenue|ave\.|road|rd\.|court|ct\.|lane|ln\.|drive|dr\.|boulevard|blvd\.|place|pl\.|parkway|pkwy\.|circle|cir\.|terrace|ter\.|way|wy\.|trail|trl\.|highway|hwy)/i.test(cleanAddress);
  const hasCityState = /,\s*[A-Za-z ]+/.test(cleanAddress) || /(new york|new jersey|connecticut|pennsylvania|california|texas|florida|illinois|ohio|michigan|georgia|north carolina|virginia|washington|colorado|arizona|tennessee|indiana|massachusetts|wisconsin|missouri|maryland|minnesota|louisiana|alabama|south carolina|kentucky|oregon|oklahoma|iowa|arkansas|mississippi|kansas|utah|nevada|new mexico|west virginia|nebraska|idaho|hawaii|new hampshire|maine|montana|rhode island|delaware|south dakota|north dakota|alaska|vermont|wyoming)/i.test(cleanAddress);
  const hasZip = /\d{4,5}/.test(cleanAddress);
  
  const isValid = hasNumber && hasStreet && hasCityState && hasZip;
  const confidence = isValid ? 0.3 : 0.1; // Lower confidence for basic validation
  
  return {
    isValid,
    standardizedAddress: isValid ? address : null,
    confidence,
    error: isValid ? null : 'Incomplete address',
    originalAddress: address,
    components: {
      hasNumber,
      hasStreet,
      hasCityState,
      hasZip
    }
  };
}

/**
 * Check if an address is complete enough for confirmation
 */
function isAddressComplete(address) {
  if (!address) return false;
  
  // Use Google validation if available, otherwise fall back to basic
  return validateAddress(address).then(result => {
    return result.isValid && result.confidence >= 0.5;
  }).catch(() => {
    // Fall back to basic validation
    const basic = basicAddressValidation(address);
    return basic.isValid;
  });
}

module.exports = {
  validateAddress,
  isAddressComplete,
  basicAddressValidation
}; 