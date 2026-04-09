import React from 'react';

const VARIANTS = {
  primary:   'bg-hbird-600 text-white hover:bg-hbird-700 focus-visible:ring-hbird-600',
  secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus-visible:ring-gray-400',
  danger:    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600',
  ghost:     'bg-transparent text-gray-600 hover:bg-gray-100 focus-visible:ring-gray-400',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon: Icon,
  onClick,
  type = 'button',
  className = '',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`
        inline-flex items-center justify-center font-medium rounded-lg
        transition-colors duration-150 focus-visible:outline-none
        focus-visible:ring-2 focus-visible:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${VARIANTS[variant] || VARIANTS.primary}
        ${SIZES[size] || SIZES.md}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : Icon ? (
        <Icon className="h-4 w-4 shrink-0" />
      ) : null}
      {children}
    </button>
  );
}
