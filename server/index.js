const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const upload = multer({ dest: 'Uploads' });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

app.post('/upload', upload.single('audio'), async (req, res) => {
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: req.file,
      model: 'whisper-1',
    });

    const summaryPrompt = `
      Summarize the following meeting transcript into a concise summary with key points and action items:

      ${transcription.text}
    `;

    const summaryRes = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: summaryPrompt }],
    });

    res.json({
      transcript: transcription.text,
      summary: summaryRes.choices[0].message.content,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process audio' });
  }
});

app.listen(3001, () => console.log('✅ Server listening on http://localhost:3001'));
