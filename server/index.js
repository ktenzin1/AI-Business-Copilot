const express = require('express');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

const CLIENTS_PATH = path.join(__dirname, 'clients.json');

// Helper to load or init file
function loadClients() {
  if (!fs.existsSync(CLIENTS_PATH)) return [];
  return JSON.parse(fs.readFileSync(CLIENTS_PATH));
}

// Helper to save clients with ID generation
function saveClient(clientData) {
  const clients = loadClients();
  const newClient = {
    id: Date.now().toString(), // Simple ID generation
    ...clientData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  clients.push(newClient);
  fs.writeFileSync(CLIENTS_PATH, JSON.stringify(clients, null, 2));
  return newClient;
}

// POST /client - Save client info
app.post('/client', (req, res) => {
  try {
    const savedClient = saveClient(req.body);
    res.status(200).json({ message: 'Client saved', client: savedClient });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save client' });
  }
});

// GET /clients - Get all clients (for dropdown/search)
app.get('/clients', (req, res) => {
  try {
    const clients = loadClients();
    res.json(clients);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load clients' });
  }
});

// GET /client/:identifier - Retrieve by name or ID
app.get('/client/:identifier', (req, res) => {
  const identifier = req.params.identifier.toLowerCase();
  const clients = loadClients();
  const client = clients.find(c => 
    c.name.toLowerCase() === identifier || 
    c.id === req.params.identifier
  );
  if (client) {
    res.json(client);
  } else {
    res.status(404).json({ error: 'Client not found' });
  }
});

// PUT /client/:id - Update client info
app.put('/client/:id', (req, res) => {
  try {
    const clients = loadClients();
    const clientIndex = clients.findIndex(c => c.id === req.params.id);
    
    if (clientIndex === -1) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    clients[clientIndex] = {
      ...clients[clientIndex],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(CLIENTS_PATH, JSON.stringify(clients, null, 2));
    res.json({ message: 'Client updated', client: clients[clientIndex] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

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

// Enhanced upload endpoint with client context
app.post('/upload', upload.single('audio'), async (req, res) => {
  console.log('📁 Upload endpoint hit');
  
  try {
    // Get client name from request (you'll send this from frontend)
    const clientName = req.body.clientName;
    let clientContext = '';
    
    // If client name provided, get their context
    if (clientName) {
      try {
        const clients = loadClients();
        const client = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());
        if (client) {
          clientContext = `
Client Context:
- Name: ${client.name}
- Company: ${client.company}
- Goals: ${client.goals}
- Notes: ${client.notes}
- Previous interactions: ${client.createdAt ? 'Client since ' + new Date(client.createdAt).toDateString() : 'New client'}
          `;
          console.log('📋 Client context loaded for:', client.name);
        }
      } catch (err) {
        console.log('⚠️ Could not load client context:', err.message);
      }
    }
    
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
          'Content-Type': 'audio/wav',
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

    // Generate AI insights using OpenAI with client context
    console.log('🤖 Generating AI insights with client context...');
    let summary = 'Summary feature temporarily unavailable';
    
    try {
      const contextualPrompt = clientContext ? 
        `You are an AI assistant specialized in analyzing meeting transcripts. ${clientContext}

Given the client context above, provide comprehensive insights including:
1. Key points and main topics discussed
2. How the discussion relates to the client's stated goals
3. Action items and decisions made
4. Important dates, numbers, or deadlines mentioned
5. Overall sentiment and tone
6. Recommendations based on the client's context

Format your response in a clear, structured way with bullet points where appropriate.` :
        `You are an AI assistant specialized in analyzing meeting transcripts and audio content. 
        Provide comprehensive insights including:
        1. Key points and main topics discussed
        2. Action items and decisions made
        3. Important dates, numbers, or deadlines mentioned
        4. Overall sentiment and tone
        5. Participants' roles (if identifiable)
        
        Format your response in a clear, structured way with bullet points where appropriate.`;
      
      const summaryResponse = await openai.chat.completions.create({
        model: 'gpt-4.1-nano',
        messages: [
          {
            role: 'system',
            content: contextualPrompt
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
      console.log('✅ AI insights generated with client context');
      console.log('📝 Summary preview:', summary.substring(0, 200) + '...');
      
    } catch (openaiError) {
      console.error('❌ OpenAI error details:');
      console.error('Message:', openaiError.message);
      console.error('Code:', openaiError.code);
      console.error('Type:', openaiError.type);
      console.error('Status:', openaiError.status);
      
      if (openaiError.response) {
        console.error('Response status:', openaiError.response.status);
        console.error('Response data:', openaiError.response.data);
      }
      
      summary = `AI insights error: ${openaiError.message}`;
    }

    console.log('🎉 Sending response...');
    res.json({
      transcript: transcript,
      summary: summary,
      clientContext: clientContext ? 'Client context applied' : 'No client context',
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