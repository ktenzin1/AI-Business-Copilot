import React, { useState } from 'react';
import UploadForm from './uploadForm.js';
import ClientForm from './ClientForm';

function App() {
  const [activeTab, setActiveTab] = useState('upload');

  return (
    <div className="App p-4">
      <h1 className="text-2xl font-bold mb-6">AI Meeting Assistant MVP</h1>
      
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
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-8">
        {activeTab === 'upload' && <UploadForm />}
        {activeTab === 'clients' && <ClientForm />}
      </div>
    </div>
  );
}

export default App;