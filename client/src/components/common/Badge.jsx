import React from 'react';

const COLORS = {
  green:  'bg-green-100 text-green-800',
  blue:   'bg-blue-100 text-blue-800',
  gray:   'bg-gray-100 text-gray-700',
  amber:  'bg-amber-100 text-amber-800',
  red:    'bg-red-100 text-red-800',
  orange: 'bg-orange-100 text-orange-800',
  purple: 'bg-purple-100 text-purple-800',
  teal:   'bg-teal-100 text-teal-800',
};

export default function Badge({ children, color = 'gray', className = '' }) {
  return (
    <span className={`
      inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
      ${COLORS[color] || COLORS.gray} ${className}
    `}>
      {children}
    </span>
  );
}

// Convenience: status badge that maps common statuses to colors
export function StatusBadge({ status }) {
  const MAP = {
    'Active':           ['Active', 'green'],
    'Closed':           ['Closed', 'gray'],
    'Archived':         ['Archived', 'gray'],
    'Needs Review':     ['Needs Review', 'orange'],
    'Confirmed':        ['Confirmed', 'blue'],
    'Rejected':         ['Rejected', 'red'],
    'Superseded':       ['Superseded', 'gray'],
    'Open':             ['Open', 'amber'],
    'In Progress':      ['In Progress', 'blue'],
    'Complete':         ['Complete', 'green'],
    'Cancelled':        ['Cancelled', 'gray'],
    'Pending':          ['Pending', 'amber'],
    'Processed':        ['Processed', 'green'],
    'Processing':       ['Processing', 'blue'],
    'Failed':           ['Failed', 'red'],
    'High':             ['High', 'red'],
    'Medium':           ['Medium', 'amber'],
    'Low':              ['Low', 'gray'],
    'Unverified':       ['Unverified', 'orange'],
    'Promoted':         ['Promoted', 'teal'],
    'Draft':            ['Draft', 'gray'],
    'PHI':              ['PHI', 'red'],
  };

  const [label, color] = MAP[status] || [status, 'gray'];
  return <Badge color={color}>{label}</Badge>;
}
