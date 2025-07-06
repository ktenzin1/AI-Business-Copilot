import React, { useState } from 'react';
import axios from 'axios';

const UploadForm = () => {
  const [audio, setAudio] = useState(null);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!audio) return;

    const formData = new FormData();
    formData.append('audio', audio);
    setLoading(true);

    try {
      const res = await axios.post('http://localhost:3001/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setTranscript(res.data.transcript);
      setSummary(res.data.summary);
    } catch (err) {
      alert('Error uploading audio.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Upload Meeting Audio</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setAudio(e.target.files[0])}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Processing...' : 'Transcribe + Summarize'}
        </button>
      </form>

      {transcript && (
        <>
          <h3>Transcript</h3>
          <pre>{transcript}</pre>
        </>
      )}
      {summary && (
        <>
          <h3>Summary</h3>
          <p>{summary}</p>
        </>
      )}
    </div>
  );
};

export default UploadForm;
