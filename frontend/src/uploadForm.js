import React, { useState, useEffect } from 'react';
import axios from 'axios';

const UploadForm = ({ onClientSelect }) => {
  const [audio, setAudio] = useState(null);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState('');
  const [clientName, setClientName] = useState('');
  const [clients, setClients] = useState([]);

  // Load clients on component mount
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await axios.get('https://ai-business-copilot-2.onrender.com/clients');
        setClients(response.data);
      } catch (err) {
        console.error('Error fetching clients:', err);
      }
    };
    fetchClients();
  }, []);

  // Handle client selection and pass to parent
  const handleClientChange = (e) => {
    const selectedClientName = e.target.value;
    setClientName(selectedClientName);
    
    // Find the full client object and pass it to parent
    const selectedClient = clients.find(client => client.name === selectedClientName);
    onClientSelect(selectedClient || null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!audio) return;

    const formData = new FormData();
    formData.append('audio', audio);
    
    // Add client name if selected
    if (clientName) {
      formData.append('clientName', clientName);
    }
    
    setLoading(true);

    try {
      const res = await axios.post('https://ai-business-copilot-2.onrender.com/upload', formData, {
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
        {/* Client Selection */}
        <div>
          <label htmlFor="client-select">Select Client (Optional):</label>
          <select
            id="client-select"
            value={clientName}
            onChange={handleClientChange}
            style={{ marginLeft: '10px', padding: '5px', minWidth: '200px' }}
          >
            <option value="">-- No client context --</option>
            {clients.map(client => (
              <option key={client.id} value={client.name}>
                {client.name} {client.company && `(${client.company})`}
              </option>
            ))}
          </select>
        </div>
        
        <br />
        
        <label htmlFor="audio-upload">Select audio file:</label>
        <input
          id="audio-upload"
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
          <h3>Summary {clientName && `(with ${clientName} context)`}</h3>
          <p>{summary}</p>
        </>
      )}
    </div>
  );
};

export default UploadForm;