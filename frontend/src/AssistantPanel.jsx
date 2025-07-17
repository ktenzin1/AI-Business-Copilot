// AssistantPanel.jsx
import React, { useState } from 'react';

function AssistantPanel({ selectedClient }) {
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);

  const callEndpoint = async (endpoint, body) => {
    if (!selectedClient) {
      setOutput('⚠️ Please select a client in the upload form first.');
      return;
    }

    setLoading(true);
    setOutput('⏳ Generating...');
    try {
      const res = await fetch(`https://ai-business-copilot-2.onrender.com/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          clientId: selectedClient.id, // Use the selected client's ID
        }),
      });
      const data = await res.json();
      const result =
        data.draftEmail ||
        data.draftProposal ||
        data.draftReport ||
        'No content returned.';
      setOutput(result);
    } catch (err) {
      setOutput('⚠️ Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border max-w-2xl mx-auto mt-12">
      <h2 className="text-xl font-semibold mb-4">💡 AI Workflow Assistant</h2>

      {/* Show selected client info */}
      <div className="mb-4 p-3 bg-blue-50 rounded border">
        <p className="text-sm text-gray-700">
          <strong>Selected Client:</strong>{' '}
          {selectedClient ? (
            <>
              {selectedClient.name}
              {selectedClient.company && ` (${selectedClient.company})`}
            </>
          ) : (
            <span className="text-red-600">No client selected</span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <button
          className={`px-4 py-2 rounded ${
            selectedClient
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          onClick={() =>
            callEndpoint('draft-followup', {
              emailType: 'thank-you',
              customInstructions: 'Be warm and professional.',
            })
          }
          disabled={!selectedClient}
        >
          📬 Draft Follow-up
        </button>

        <button
          className={`px-4 py-2 rounded ${
            selectedClient
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          onClick={() =>
            callEndpoint('draft-proposal', {
              proposalType: 'service',
              customRequirements: 'Include pricing and timeline.',
            })
          }
          disabled={!selectedClient}
        >
          📄 Generate Proposal
        </button>

        <button
          className={`px-4 py-2 rounded ${
            selectedClient
              ? 'bg-gray-700 text-white hover:bg-gray-800'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          onClick={() =>
            callEndpoint('draft-report', {
              reportType: 'executive',
              includeTranscript: false,
            })
          }
          disabled={!selectedClient}
        >
          🧾 Create Report
        </button>
      </div>

      <pre className="bg-gray-50 border p-4 rounded text-sm whitespace-pre-wrap min-h-[150px]">
        {loading ? '⏳ Loading...' : output}
      </pre>
    </div>
  );
}

export default AssistantPanel;