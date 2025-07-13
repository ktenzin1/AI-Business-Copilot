import React, { useState } from 'react';
import axios from 'axios';

const ClientForm = () => {
  const [client, setClient] = useState({
    name: '',
    company: '',
    goals: '',
    notes: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleChange = (e) => {
    setClient({ ...client, [e.target.name]: e.target.value });
    // Clear messages when user starts typing
    if (message.text) {
      setMessage({ type: '', text: '' });
    }
  };

  const validateForm = () => {
    if (!client.name.trim()) {
      setMessage({ type: 'error', text: 'Name is required' });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    setMessage({ type: '', text: '' });
    
    try {
      await axios.post('https://ai-business-copilot-2.onrender.com/client', client);
      setMessage({ type: 'success', text: '✅ Client saved successfully!' });
      setClient({ name: '', company: '', goals: '', notes: '' });
    } catch (err) {
      console.error(err);
      const errorMessage = err.response?.data?.message || 'Failed to save client. Please try again.';
      setMessage({ type: 'error', text: `❌ ${errorMessage}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const messageClasses = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800'
  };

  return (
    <div className="max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="p-6 border rounded-lg shadow-sm bg-white">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">Client Information</h2>
        
        {message.text && (
          <div className={`mb-4 p-3 border rounded-md ${messageClasses[message.type]}`}>
            {message.text}
          </div>
        )}
        
        <div className="mb-7">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            placeholder="Enter client name"
            value={client.name}
            onChange={handleChange}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            required
            disabled={isSubmitting}
          />
        </div>
        
        <div className="mb-7">
          <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-2">
            Company
          </label>
          <input
            type="text"
            id="company"
            name="company"
            placeholder="Enter company name"
            value={client.company}
            onChange={handleChange}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            disabled={isSubmitting}
          />
        </div>
        
        <div className="mb-7">
          <label htmlFor="goals" className="block text-sm font-medium text-gray-700 mb-2">
            Goals
          </label>
          <textarea
            id="goals"
            name="goals"
            placeholder="Enter client goals"
            value={client.goals}
            onChange={handleChange}
            rows="3"
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-vertical"
            disabled={isSubmitting}
          />
        </div>
        
        <div className="mb-7">
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            placeholder="Enter additional notes"
            value={client.notes}
            onChange={handleChange}
            rows="3"
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-vertical"
            disabled={isSubmitting}
          />
        </div>
        
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-md transition-colors duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 outline-none"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </span>
          ) : (
            'Save Client'
          )}
        </button>
      </form>
    </div>
  );
};

export default ClientForm;