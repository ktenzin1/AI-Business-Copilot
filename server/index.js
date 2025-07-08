const express = require('express');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

const deepgramApiKey = process.env.DEEPGRAM_API_KEY;

// Debug: Check if API key is loaded
console.log('Deepgram API Key loaded:', deepgramApiKey ? 'Yes' : 'No');
if (!deepgramApiKey) {
  console.error('❌ DEEPGRAM_API_KEY not found in environment variables');
  process.exit(1);
}

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

    // Step 4: Use OpenAI GPT (or any other) to summarize transcription
    // For example, here you can use your OpenAI client to send transcript to GPT for summary.

    // --- Example summary using OpenAI GPT-4o (replace with your setup) ---
    // const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // const summaryResponse = await openai.chat.completions.create({
    //   model: 'gpt-4o',
    //   messages: [
    //     {
    //       role: 'user',
    //       content: `Summarize this meeting transcript into key points and action items:\n\n${transcript}`,
    //     },
    //   ],
    // });
    // const summary = summaryResponse.choices[0].message.content;

    console.log('🎉 Sending response...');
    res.json({
      transcript: transcript,
      summary: 'Summary feature coming soon!', // replace with real summary
      confidence: response.data.results?.channels?.[0]?.alternatives?.[0]?.confidence || null,
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