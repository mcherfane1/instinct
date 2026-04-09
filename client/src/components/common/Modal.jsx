import React, { Fragment } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null;

  const WIDTH = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 transition-opacity"
        onClick={onClose}
      />
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className={`relative bg-white rounded-xl shadow-xl w-full ${WIDTH[size] || WIDTH.md} z-10`}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 rounded-lg p-1 hover:bg-gray-100 transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          {/* Body */}
          <div className="px-6 py-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
