// AssistantPanel.jsx
import React, { useState } from 'react';

function AssistantPanel() {
const [clientId, setClientId] = useState('');
const [output, setOutput] = useState('');
const [loading, setLoading] = useState(false);

const callEndpoint = async (endpoint, body) => {
setLoading(true);
setOutput('⏳ Generating...');
try {
const res = await fetch(`http://localhost:3001/${endpoint}`, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(body),
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
<h2 className="text-xl font-semibold mb-4">💡 AI Assistant</h2>

bash
Copy
Edit
  <input
    type="text"
    placeholder="Enter clientId (e.g. acme123)"
    className="border p-2 rounded w-full mb-4"
    value={clientId}
    onChange={(e) => setClientId(e.target.value)}
  />

  <div className="flex flex-wrap gap-3 mb-4">
    <button
      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      onClick={() =>
        callEndpoint('draft-followup', {
          clientId,
          emailType: 'thank-you',
          customInstructions: 'Be warm and professional.',
        })
      }
    >
      📬 Draft Follow-up
    </button>

    <button
      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
      onClick={() =>
        callEndpoint('draft-proposal', {
          clientId,
          proposalType: 'service',
          customRequirements: 'Include pricing and timeline.',
        })
      }
    >
      📄 Generate Proposal
    </button>

    <button
      className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800"
      onClick={() =>
        callEndpoint('draft-report', {
          meetingId: 'meeting-001',
          reportType: 'executive',
          includeTranscript: false,
        })
      }
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