import React, { useState } from 'react';
import UploadForm from './uploadForm.js';
import ClientForm from './ClientForm';
import AssistantPanel from './AssistantPanel.jsx';

function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [selectedClient, setSelectedClient] = useState(null);

  return (
    <div>
      <div className="App p-3">
        <h1 className="text-2xl font-bold mb-6">Buisco AI - Your AI Copilot</h1>
        <h1 className="text-1xl font-bold mb-3">AI Meeting Assistant</h1>
        
        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white p-1 rounded-lg shadow-sm border">
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-6 py-2 rounded-md font-medium transition-colors duration-200 ${
                activeTab === 'upload'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Upload Audio
            </button>
            <button
              onClick={() => setActiveTab('clients')}
              className={`px-6 py-2 rounded-md font-medium transition-colors duration-200 ${
                activeTab === 'clients'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Manage Clients
            </button>
            <button
              onClick={() => setActiveTab('assistant')}
              className={`px-6 py-2 rounded-md font-medium transition-colors duration-200 ${
                activeTab === 'assistant'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              AI Assistant
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-8">
          {activeTab === 'upload' && <UploadForm onClientSelect={setSelectedClient} />}
          {activeTab === 'clients' && <ClientForm />}
          {activeTab === 'assistant' && <AssistantPanel selectedClient={selectedClient} />}
        </div>
      </div>

      <p style={{ textAlign: "center", fontSize: "0.9em" }}>© 2025 Karma Yangchen Tenzin. All rights reserved.</p>
    </div>
  );
}

export default App;