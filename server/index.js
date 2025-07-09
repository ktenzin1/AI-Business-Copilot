const express = require('express');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const fs = require('fs');
const OpenAI = require('openai');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

// Debug: Check if API keys are loaded
console.log('Deepgram API Key loaded:', deepgramApiKey ? 'Yes' : 'No');
console.log('OpenAI API Key loaded:', openaiApiKey ? 'Yes' : 'No');

if (!deepgramApiKey) {
  console.error('❌ DEEPGRAM_API_KEY not found in environment variables');
  process.exit(1);
}

if (!openaiApiKey) {
  console.error('❌ OPENAI_API_KEY not found in environment variables');
  process.exit(1);
}

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: openaiApiKey });

app.post('/upload', upload.single('audio'), async (req, res) => {
  console.log('📁 Upload endpoint hit');
  
  try {
    // Debug: Check if file was uploaded
    if (!req.file) {
      console.log('❌ No file uploaded');
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    console.log('📄 File uploaded:', req.file.originalname, req.file.size, 'bytes');

    // Read the audio file
    const audioBuffer = fs.readFileSync(req.file.path);
    console.log('🔄 Sending to Deepgram...');

    // Send to Deepgram for transcription
    const response = await axios.post(
      'https://api.deepgram.com/v1/listen',
      audioBuffer,
      {
        headers: {
          'Authorization': `Token ${deepgramApiKey}`,
          'Content-Type': 'audio/wav', // Adjust based on your audio format
        },
        params: {
          punctuate: true,
          model: 'nova-2',
          language: 'en-US',
        },
      }
    );

    console.log('✅ Deepgram response received');
    
    // Extract transcript from response
    const transcript = response.data.results?.channels?.[0]?.alternatives?.[0]?.transcript;
    
    if (!transcript) {
      console.log('❌ No transcript found in response');
      return res.status(500).json({ error: 'No transcript returned from Deepgram' });
    }

    console.log('📝 Transcript:', transcript.substring(0, 100) + '...');

    // Generate AI insights using OpenAI
    console.log('🤖 Generating AI insights...');
    let summary = 'Summary feature temporarily unavailable';
    
    try {
      const summaryResponse = await openai.chat.completions.create({
        model: 'gpt-4.1-nano', // Use correct model name
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant specialized in analyzing meeting transcripts and audio content. 
            Provide comprehensive insights including:
            1. Key points and main topics discussed
            2. Action items and decisions made
            3. Important dates, numbers, or deadlines mentioned
            4. Overall sentiment and tone
            5. Participants' roles (if identifiable)
            
            Format your response in a clear, structured way with bullet points where appropriate.`
          },
          {
            role: 'user',
            content: `Please analyze this transcript and provide detailed insights:\n\n${transcript}`,
          },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      });
      
      summary = summaryResponse.choices[0].message.content;
      console.log('✅ AI insights generated');
      
    } catch (openaiError) {
      console.error('❌ OpenAI error:', openaiError.message);
      summary = 'AI insights temporarily unavailable. Please try again later.';
    }

    console.log('🎉 Sending response...');
    res.json({
      transcript: transcript,
      summary: summary,
      confidence: response.data.results?.channels?.[0]?.alternatives?.[0]?.confidence || null,
      processingTime: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ Server error:', error.message);
    
    // Log more details for debugging
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    res.status(500).json({ error: error.message || 'Failed to process audio' });
  } finally {
    // Clean up uploaded file
    if (req.file?.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
        else console.log('🗑️ Cleaned up uploaded file');
      });
    }
  }
});

app.listen(3001, () => {
  console.log('✅ Server listening on http://localhost:3001');
});