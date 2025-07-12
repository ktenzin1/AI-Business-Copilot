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

// File paths
const CLIENTS_PATH = path.join(__dirname, 'clients.json');
const MEETINGS_PATH = path.join(__dirname, 'meetings.json');
const EMBEDDINGS_PATH = path.join(__dirname, 'embeddings.json');

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Vector Search System Class (JSON-based)
class JSONVectorSearch {
  constructor() {
    this.openai = openai;
    this.embeddingsPath = EMBEDDINGS_PATH;
  }

  // Load embeddings from JSON file
  loadEmbeddings() {
    if (!fs.existsSync(this.embeddingsPath)) {
      return [];
    }
    try {
      return JSON.parse(fs.readFileSync(this.embeddingsPath, 'utf8'));
    } catch (error) {
      console.error('Error loading embeddings:', error);
      return [];
    }
  }

  // Save embeddings to JSON file
  saveEmbeddings(embeddings) {
    try {
      fs.writeFileSync(this.embeddingsPath, JSON.stringify(embeddings, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving embeddings:', error);
      return false;
    }
  }

  // Get embedding from OpenAI
  async getEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text.substring(0, 8000) // Limit text length
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('❌ Embedding error:', error);
      throw error;
    }
  }

  // Split text into chunks
  chunkText(text, maxLength = 1500) {
    const words = text.split(' ');
    const chunks = [];
    let currentChunk = [];
    let currentLength = 0;

    for (const word of words) {
      if (currentLength + word.length > maxLength && currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
        currentChunk = [word];
        currentLength = word.length;
      } else {
        currentChunk.push(word);
        currentLength += word.length + 1;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
    }

    return chunks;
  }

  // Calculate cosine similarity between two vectors
  cosineSimilarity(a, b) {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  // Store meeting embeddings in JSON
  async storeMeetingEmbeddings(meetingId, clientId, content, metadata = {}) {
    try {
      const embeddings = this.loadEmbeddings();
      const chunks = this.chunkText(content);
      
      for (let i = 0; i < chunks.length; i++) {
        const embedding = await this.getEmbedding(chunks[i]);
        
        const embeddingRecord = {
          id: `${meetingId}_chunk_${i}`,
          meetingId,
          clientId,
          content: chunks[i],
          embedding,
          metadata: {
            ...metadata,
            chunkIndex: i,
            totalChunks: chunks.length,
            createdAt: new Date().toISOString()
          }
        };
        
        embeddings.push(embeddingRecord);
      }
      
      this.saveEmbeddings(embeddings);
      console.log(`✅ Stored ${chunks.length} embeddings for meeting ${meetingId}`);
      return true;
    } catch (error) {
      console.error('❌ Error storing embeddings:', error);
      return false;
    }
  }

  // Semantic search using cosine similarity
  async semanticSearch(query, clientId = null, limit = 5) {
    try {
      const embeddings = this.loadEmbeddings();
      
      if (embeddings.length === 0) {
        console.log('⚠️ No embeddings found');
        return [];
      }
      
      const queryEmbedding = await this.getEmbedding(query);
      const results = [];
      
      for (const embedding of embeddings) {
        // Filter by client if specified
        if (clientId && embedding.clientId !== clientId) {
          continue;
        }
        
        const similarity = this.cosineSimilarity(queryEmbedding, embedding.embedding);
        
        if (similarity > 0.6) { // Lowered threshold for better recall
          results.push({
            ...embedding,
            similarity
          });
        }
      }
      
      // Sort by similarity and limit results
      results.sort((a, b) => b.similarity - a.similarity);
      console.log(`🔍 Found ${results.length} relevant matches for query: "${query}"`);
      return results.slice(0, limit);
      
    } catch (error) {
      console.error('❌ Semantic search error:', error);
      return [];
    }
  }

  // Get context for AI prompts
  async getContextForPrompt(currentContext, clientId = null) {
    const similarMeetings = await this.semanticSearch(currentContext, clientId, 3);
    
    if (!similarMeetings.length) {
      console.log('⚠️ No similar meetings found for context');
      return "";
    }

    const contextParts = [];
    for (const meeting of similarMeetings) {
      contextParts.push(`Previous meeting context (similarity: ${meeting.similarity.toFixed(2)}):`);
      contextParts.push(meeting.content);
      contextParts.push(`Date: ${meeting.metadata.createdAt || 'Unknown'}`);
      contextParts.push("---");
    }

    console.log(`📚 Generated context from ${similarMeetings.length} similar meetings`);
    return contextParts.join('\n');
  }

  // Get embeddings stats
  getStats() {
    const embeddings = this.loadEmbeddings();
    const clientStats = {};
    
    embeddings.forEach(emb => {
      if (!clientStats[emb.clientId]) {
        clientStats[emb.clientId] = 0;
      }
      clientStats[emb.clientId]++;
    });
    
    return {
      totalEmbeddings: embeddings.length,
      totalClients: Object.keys(clientStats).length,
      embeddingsPerClient: clientStats
    };
  }
}

// Initialize vector search system
const vectorSearch = new JSONVectorSearch();

// Helper functions for file operations
function loadClients() {
  if (!fs.existsSync(CLIENTS_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(CLIENTS_PATH, 'utf8'));
  } catch (error) {
    console.error('Error loading clients:', error);
    return [];
  }
}

function saveClient(clientData) {
  const clients = loadClients();
  
  // Check if client already exists
  const existingClient = clients.find(c => c.name.toLowerCase() === clientData.name.toLowerCase());
  if (existingClient) {
    console.log(`👤 Client ${clientData.name} already exists with ID: ${existingClient.id}`);
    return existingClient;
  }
  
  const newClient = {
    id: Date.now().toString(),
    ...clientData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  clients.push(newClient);
  fs.writeFileSync(CLIENTS_PATH, JSON.stringify(clients, null, 2));
  console.log(`👤 Created new client: ${newClient.name} with ID: ${newClient.id}`);
  return newClient;
}

function loadMeetings() {
  if (!fs.existsSync(MEETINGS_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(MEETINGS_PATH, 'utf8'));
  } catch (error) {
    console.error('Error loading meetings:', error);
    return [];
  }
}

function saveMeeting(meetingData) {
  const meetings = loadMeetings();
  const newMeeting = {
    id: Date.now().toString(),
    ...meetingData,
    createdAt: new Date().toISOString()
  };
  meetings.push(newMeeting);
  fs.writeFileSync(MEETINGS_PATH, JSON.stringify(meetings, null, 2));
  console.log(`📅 Saved meeting: ${newMeeting.title} (ID: ${newMeeting.id})`);
  return newMeeting;
}

// Auto-create or find client endpoint
app.post('/ensure-client', (req, res) => {
  try {
    const { name, company, goals, notes } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Client name is required' });
    }
    
    const client = saveClient({ name, company, goals, notes });
    
    res.json({
      message: client.createdAt === client.updatedAt ? 'Client created' : 'Client found',
      client,
      wasCreated: client.createdAt === client.updatedAt
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to ensure client' });
  }
});

// Client endpoints
app.post('/client', (req, res) => {
  try {
    const savedClient = saveClient(req.body);
    res.status(200).json({ message: 'Client saved', client: savedClient });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save client' });
  }
});

app.get('/clients', (req, res) => {
  try {
    const clients = loadClients();
    res.json(clients);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load clients' });
  }
});

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

// Meeting endpoints
app.get('/meetings', (req, res) => {
  try {
    const meetings = loadMeetings();
    const { clientId } = req.query;
    
    if (clientId) {
      const filteredMeetings = meetings.filter(m => m.clientId === clientId);
      return res.json(filteredMeetings);
    }
    
    res.json(meetings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load meetings' });
  }
});

app.get('/meeting/:id', (req, res) => {
  try {
    const meetings = loadMeetings();
    const meeting = meetings.find(m => m.id === req.params.id);
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    res.json(meeting);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load meeting' });
  }
});

// Delete meeting endpoint
app.delete('/meeting/:id', (req, res) => {
  try {
    const meetings = loadMeetings();
    const meetingIndex = meetings.findIndex(m => m.id === req.params.id);
    
    if (meetingIndex === -1) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    const deletedMeeting = meetings.splice(meetingIndex, 1)[0];
    fs.writeFileSync(MEETINGS_PATH, JSON.stringify(meetings, null, 2));
    
    // Also remove embeddings for this meeting
    const embeddings = vectorSearch.loadEmbeddings();
    const filteredEmbeddings = embeddings.filter(e => e.meetingId !== req.params.id);
    vectorSearch.saveEmbeddings(filteredEmbeddings);
    
    res.json({ message: 'Meeting deleted', meeting: deletedMeeting });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete meeting' });
  }
});

// Semantic search endpoint
app.post('/search', async (req, res) => {
  try {
    const { query, clientId, limit = 5 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    const results = await vectorSearch.semanticSearch(query, clientId, limit);
    
    res.json({
      query,
      results,
      totalResults: results.length
    });
  } catch (error) {
    console.error('❌ Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// AI insights endpoint
app.post('/insights', async (req, res) => {
  try {
    const { query, clientId } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    // Get relevant context from past meetings
    const pastContext = await vectorSearch.getContextForPrompt(query, clientId);
    
    // Get client context
    let clientContext = '';
    if (clientId) {
      const clients = loadClients();
      const client = clients.find(c => c.id === clientId);
      if (client) {
        clientContext = `
Client: ${client.name}
Company: ${client.company || 'N/A'}
Goals: ${client.goals || 'N/A'}
Notes: ${client.notes || 'N/A'}
        `;
      }
    }
    
    // Generate contextual insights
    const prompt = `You are an AI Business Copilot with access to past meeting history. 
    
${clientContext}

RELEVANT PAST MEETINGS:
${pastContext}

CURRENT QUERY: ${query}

Based on the client context and past meeting history, provide comprehensive insights including:
1. Direct answer to the query
2. Relevant connections to past discussions
3. Actionable recommendations
4. Important patterns or trends you notice
5. Follow-up questions to consider

Format your response clearly with sections and bullet points where appropriate.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages: [
        {
          role: 'system',
          content: 'You are an AI Business Copilot that analyzes client interactions and provides strategic insights.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.3
    });
    
    res.json({
      query,
      insights: response.choices[0].message.content,
      contextUsed: pastContext ? 'Yes' : 'No',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Insights error:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

// Enhanced upload endpoint with guaranteed context linking
app.post('/upload', upload.single('audio'), async (req, res) => {
  console.log('📁 Upload endpoint hit');
  
  try {
    const { clientName, meetingTitle, meetingDate, company, goals, notes } = req.body;
    
    if (!clientName) {
      return res.status(400).json({ error: 'Client name is required' });
    }
    
    // STEP 1: Ensure client exists (auto-create if needed)
    console.log('👤 Ensuring client exists:', clientName);
    const client = saveClient({ 
      name: clientName, 
      company: company || '', 
      goals: goals || '', 
      notes: notes || '' 
    });
    
    const clientId = client.id;
    console.log('✅ Client confirmed - ID:', clientId);
    
    // STEP 2: Check existing context
    const existingEmbeddings = vectorSearch.loadEmbeddings();
    const clientEmbeddings = existingEmbeddings.filter(e => e.clientId === clientId);
    console.log('📊 Existing embeddings for client:', clientEmbeddings.length);
    
    const clientContext = `
Client Context:
- Name: ${client.name}
- Company: ${client.company || 'N/A'}
- Goals: ${client.goals || 'N/A'}
- Notes: ${client.notes || 'N/A'}
- Previous meetings: ${clientEmbeddings.length > 0 ? 'Yes' : 'No'}
    `;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    console.log('📄 File uploaded:', req.file.originalname, req.file.size, 'bytes');
    const audioBuffer = fs.readFileSync(req.file.path);
    
    // STEP 3: Transcribe with Deepgram
    console.log('🎤 Starting transcription...');
    const transcriptionResponse = await axios.post(
      'https://api.deepgram.com/v1/listen',
      audioBuffer,
      {
        headers: {
          'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
          'Content-Type': 'audio/wav',
        },
        params: {
          punctuate: true,
          model: 'nova-2',
          language: 'en-US',
        },
      }
    );

    const transcript = transcriptionResponse.data.results?.channels?.[0]?.alternatives?.[0]?.transcript;
    
    if (!transcript) {
      return res.status(500).json({ error: 'No transcript returned from Deepgram' });
    }

    console.log('📝 Transcript received:', transcript.substring(0, 100) + '...');

    // STEP 4: Get relevant past context for AI analysis
    console.log('🔍 Searching for relevant past context...');
    const pastContext = await vectorSearch.getContextForPrompt(transcript, clientId);
    console.log('📚 Past context retrieved:', pastContext ? 'Yes' : 'No');
    console.log('📏 Past context length:', pastContext.length);
    
    // STEP 5: Generate enhanced AI insights with context
    const contextualPrompt = `You are an AI Business Copilot analyzing a meeting transcript.

${clientContext}

RELEVANT PAST MEETINGS:
${pastContext}

INSTRUCTIONS:
- If this is the first meeting (no past context), focus on understanding the client's needs and setting up future engagement
- If there are past meetings, explicitly reference and connect to previous discussions
- Always identify action items, commitments, and next steps
- Note any changes in client sentiment or priorities

Given this context, analyze the current meeting and provide:
1. Key discussion points and decisions
2. Connections to previous meetings and ongoing themes (if any)
3. Action items and next steps
4. Important dates, numbers, or commitments
5. Overall meeting sentiment and client satisfaction
6. Strategic recommendations based on the full context

Format your response with clear sections and bullet points.`;
    
    let summary = 'AI analysis temporarily unavailable';
    
    try {
      console.log('🤖 Generating AI insights...');
      const summaryResponse = await openai.chat.completions.create({
        model: 'gpt-4.1-nano',
        messages: [
          {
            role: 'system',
            content: contextualPrompt
          },
          {
            role: 'user',
            content: `Meeting transcript to analyze:\n\n${transcript}`
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      });
      
      summary = summaryResponse.choices[0].message.content;
      console.log('✅ AI insights generated with context');
      
    } catch (openaiError) {
      console.error('❌ OpenAI error:', openaiError);
      summary = `AI analysis error: ${openaiError.message}`;
    }

    // STEP 6: Save meeting to local storage
    const meetingData = {
      clientId,
      clientName: client.name,
      title: meetingTitle || 'Untitled Meeting',
      date: meetingDate || new Date().toISOString(),
      transcript,
      summary,
      audioFileName: req.file.originalname,
      confidence: transcriptionResponse.data.results?.channels?.[0]?.alternatives?.[0]?.confidence || null,
      contextUsed: pastContext ? 'Yes' : 'No',
      previousMeetings: clientEmbeddings.length
    };
    
    const savedMeeting = saveMeeting(meetingData);
    console.log('💾 Meeting saved with ID:', savedMeeting.id);
    
    // STEP 7: Store in vector database for future context
    console.log('🧠 Storing embeddings for future context...');
    const meetingContent = `
Meeting: ${meetingData.title}
Date: ${meetingData.date}
Client: ${client.name}
Transcript: ${transcript}
Summary: ${summary}
      `;
      
    const embeddingStored = await vectorSearch.storeMeetingEmbeddings(
      savedMeeting.id,
      clientId,
      meetingContent,
      {
        meetingTitle: meetingData.title,
        meetingDate: meetingData.date,
        clientName: client.name
      }
    );
    
    console.log('✅ Processing complete!');
    
    res.json({
      success: true,
      meetingId: savedMeeting.id,
      clientId: clientId,
      clientName: client.name,
      transcript,
      summary,
      confidence: meetingData.confidence,
      contextLinking: {
        clientFound: true,
        previousMeetings: clientEmbeddings.length,
        pastContextUsed: pastContext ? 'Yes' : 'No',
        pastContextLength: pastContext.length,
        embeddingStored: embeddingStored
      },
      processingTime: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Server error:', error);
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

// System stats endpoint
app.get('/stats', (req, res) => {
  try {
    const clients = loadClients();
    const meetings = loadMeetings();
    const embeddingStats = vectorSearch.getStats();
    
    res.json({
      clients: clients.length,
      meetings: meetings.length,
      embeddings: embeddingStats.totalEmbeddings,
      embeddingsByClient: embeddingStats.embeddingsPerClient,
      lastMeeting: meetings.length > 0 ? meetings[meetings.length - 1].createdAt : null
    });
  } catch (error) {
    console.error('❌ Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    features: {
      transcription: !!process.env.DEEPGRAM_API_KEY,
      ai_analysis: !!process.env.OPENAI_API_KEY,
      vector_search: 'JSON-based',
      context_linking: 'enabled'
    }
  });
});

// Debug endpoint for context linking
app.get('/debug/context/:clientName', async (req, res) => {
  try {
    const clientName = req.params.clientName;
    const clients = loadClients();
    const client = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const embeddings = vectorSearch.loadEmbeddings();
    const clientEmbeddings = embeddings.filter(e => e.clientId === client.id);
    const meetings = loadMeetings().filter(m => m.clientId === client.id);
    
    // Test semantic search
    const testQuery = "meeting summary";
    const searchResults = await vectorSearch.semanticSearch(testQuery, client.id, 3);
    
    res.json({
      client: {
        id: client.id,
        name: client.name,
        company: client.company
      },
      contextData: {
        totalMeetings: meetings.length,
        totalEmbeddings: clientEmbeddings.length,
        embeddingChunks: clientEmbeddings.map(e => ({
          id: e.id,
          meetingId: e.meetingId,
          contentPreview: e.content.substring(0, 100),
          createdAt: e.metadata.createdAt
        }))
      },
      searchTest: {
        query: testQuery,
        results: searchResults.length,
        topResult: searchResults[0] ? {
          similarity: searchResults[0].similarity,
          contentPreview: searchResults[0].content.substring(0, 100)
        } : null
      }
    });
  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch debug info' });
  }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ AI Business Copilot running on http://localhost:${PORT}`);
  console.log('🧠 Vector search: JSON-based with context linking');
  console.log('🎤 Transcription enabled:', !!process.env.DEEPGRAM_API_KEY);
  console.log('🤖 AI analysis enabled:', !!process.env.OPENAI_API_KEY);
  console.log('🔗 Context linking: ENABLED');
});