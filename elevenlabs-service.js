const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class ElevenLabsService {
  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY;
    this.voiceId = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // Default voice
    this.baseUrl = 'https://api.elevenlabs.io/v1';
    this.audioDir = path.join(__dirname, 'audio');
    
    // Create audio directory if it doesn't exist
    this.ensureAudioDirectory();
  }

  async ensureAudioDirectory() {
    try {
      await fs.mkdir(this.audioDir, { recursive: true });
    } catch (error) {
      console.error('Error creating audio directory:', error);
    }
  }

  async generateSpeech(text, options = {}) {
    console.log('[ElevenLabs] generateSpeech called with text:', text);
    if (!this.apiKey || this.apiKey === 'your_elevenlabs_api_key_here') {
      console.log('[ElevenLabs] API key not configured, using Twilio TTS');
      return null;
    }

    try {
      const requestData = {
        text: text,
        model_id: options.modelId || "eleven_monolingual_v1",
        voice_settings: {
          stability: options.stability || 0.5,
          similarity_boost: options.similarityBoost || 0.5,
          style: options.style || 0.0,
          use_speaker_boost: options.useSpeakerBoost || true
        }
      };

      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${this.voiceId}`,
        requestData,
        {
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey
          },
          responseType: 'arraybuffer'
        }
      );

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `speech_${timestamp}.mp3`;
      const filepath = path.join(this.audioDir, filename);

      // Save audio file
      await fs.writeFile(filepath, response.data);

      console.log('[ElevenLabs] Audio file generated:', filename);

      return {
        success: true,
        filepath: filepath,
        filename: filename,
        url: `/audio/${filename}`,
        size: response.data.length
      };

    } catch (error) {
      console.error('[ElevenLabs] API error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message,
        fallback: true
      };
    }
  }

  async generateSpeechStream(text, options = {}) {
    if (!this.apiKey || this.apiKey === 'your_elevenlabs_api_key_here') {
      return null;
    }

    try {
      const requestData = {
        text: text,
        model_id: options.modelId || "eleven_monolingual_v1",
        voice_settings: {
          stability: options.stability || 0.5,
          similarity_boost: options.similarityBoost || 0.5
        }
      };

      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${this.voiceId}/stream`,
        requestData,
        {
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey
          },
          responseType: 'stream'
        }
      );

      return response.data;

    } catch (error) {
      console.error('ElevenLabs streaming error:', error.message);
      return null;
    }
  }

  async getVoices() {
    if (!this.apiKey || this.apiKey === 'your_elevenlabs_api_key_here') {
      return null;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      return response.data.voices;
    } catch (error) {
      console.error('Error fetching voices:', error.message);
      return null;
    }
  }

  async getVoiceSettings(voiceId = null) {
    const targetVoiceId = voiceId || this.voiceId;
    
    if (!this.apiKey || this.apiKey === 'your_elevenlabs_api_key_here') {
      return null;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/voices/${targetVoiceId}/settings`, {
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching voice settings:', error.message);
      return null;
    }
  }

  // Clean up old audio files (call periodically)
  async cleanupAudioFiles(maxAgeHours = 24) {
    try {
      const files = await fs.readdir(this.audioDir);
      const now = Date.now();
      const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds

      for (const file of files) {
        if (file.endsWith('.mp3')) {
          const filepath = path.join(this.audioDir, file);
          const stats = await fs.stat(filepath);
          
          if (now - stats.mtime.getTime() > maxAge) {
            await fs.unlink(filepath);
            console.log(`Cleaned up old audio file: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up audio files:', error);
    }
  }

  // Get audio file URL for serving
  getAudioUrl(filename) {
    return `/audio/${filename}`;
  }

  // Check if ElevenLabs is properly configured
  isConfigured() {
    return this.apiKey && this.apiKey !== 'your_elevenlabs_api_key_here';
  }
}

module.exports = ElevenLabsService;

