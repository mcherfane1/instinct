import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-5xl font-bold text-gray-200 mb-4">404</p>
        <p className="text-gray-700 font-medium mb-2">Page not found</p>
        <button
          onClick={() => navigate('/')}
          className="text-sm text-hbird-600 hover:underline"
        >
          ← Back to engagements
        </button>
      </div>
    </div>
  );
}
