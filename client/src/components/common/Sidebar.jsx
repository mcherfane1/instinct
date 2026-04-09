import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  ChatBubbleLeftRightIcon,
  DocumentArrowUpIcon,
  MagnifyingGlassIcon,
  ClipboardDocumentListIcon,
  BellAlertIcon,
  Cog6ToothIcon,
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import useEngagementStore from '../../store/engagementStore';
import useUIStore from '../../store/uiStore';

const NAV_ITEMS = [
  { label: 'Knowledge Hub',      path: 'knowledge-hub',  icon: MagnifyingGlassIcon },
  { label: 'Interview Studio',   path: 'interview',      icon: ChatBubbleLeftRightIcon },
  { label: 'Artifact Ingestion', path: 'artifacts',      icon: DocumentArrowUpIcon },
  { label: 'Task Tracker',       path: 'tasks',          icon: ClipboardDocumentListIcon },
];

export default function Sidebar({ engagementId }) {
  const navigate            = useNavigate();
  const { currentEngagement, pendingApprovals } = useEngagementStore();
  const { sidebarCollapsed, toggleSidebar }     = useUIStore();

  return (
    <aside className={`
      flex flex-col bg-hbird-950 text-white shrink-0 transition-all duration-200
      ${sidebarCollapsed ? 'w-16' : 'w-56'}
    `}>
      {/* Brand */}
      <div className={`flex items-center h-14 px-4 border-b border-hbird-800 shrink-0 ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-hbird-600 shrink-0">
          <span className="text-white text-xs font-bold">HI</span>
        </div>
        {!sidebarCollapsed && (
          <span className="text-sm font-semibold text-white truncate">Instinct</span>
        )}
      </div>

      {/* Engagement name */}
      {!sidebarCollapsed && currentEngagement && (
        <div className="px-4 py-3 border-b border-hbird-800">
          <p className="text-xs text-hbird-300 uppercase tracking-wide mb-0.5">Engagement</p>
          <p className="text-sm font-medium text-white truncate">{currentEngagement.engagement_name}</p>
          <p className="text-xs text-hbird-400 truncate">{currentEngagement.client_name}</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={`/engagements/${engagementId}/${path}`}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
              transition-colors duration-100
              ${isActive
                ? 'bg-hbird-600 text-white'
                : 'text-hbird-200 hover:bg-hbird-800 hover:text-white'
              }
              ${sidebarCollapsed ? 'justify-center' : ''}
            `}
            title={sidebarCollapsed ? label : undefined}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {!sidebarCollapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}

        {/* Pending Approvals — Engagement Lead only */}
        <NavLink
          to={`/engagements/${engagementId}/approvals`}
          className={({ isActive }) => `
            flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
            transition-colors duration-100
            ${isActive ? 'bg-hbird-600 text-white' : 'text-hbird-200 hover:bg-hbird-800 hover:text-white'}
            ${sidebarCollapsed ? 'justify-center' : ''}
          `}
          title={sidebarCollapsed ? 'Pending Approvals' : undefined}
        >
          <div className="relative shrink-0">
            <BellAlertIcon className="h-5 w-5" />
            {pendingApprovals > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {pendingApprovals > 9 ? '9+' : pendingApprovals}
              </span>
            )}
          </div>
          {!sidebarCollapsed && (
            <span className="truncate flex-1">Pending Approvals</span>
          )}
          {!sidebarCollapsed && pendingApprovals > 0 && (
            <span className="ml-auto text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5 shrink-0">
              {pendingApprovals}
            </span>
          )}
        </NavLink>
      </nav>

      {/* Bottom: settings + back */}
      <div className="px-2 py-3 border-t border-hbird-800 space-y-0.5 shrink-0">
        <NavLink
          to={`/engagements/${engagementId}/setup`}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-hbird-300 hover:bg-hbird-800 hover:text-white transition-colors"
          title={sidebarCollapsed ? 'Engagement Settings' : undefined}
        >
          <Cog6ToothIcon className="h-5 w-5 shrink-0" />
          {!sidebarCollapsed && <span>Settings</span>}
        </NavLink>

        <button
          onClick={() => navigate('/')}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-hbird-300 hover:bg-hbird-800 hover:text-white transition-colors"
          title={sidebarCollapsed ? 'All Engagements' : undefined}
        >
          <ArrowLeftIcon className="h-5 w-5 shrink-0" />
          {!sidebarCollapsed && <span>All Engagements</span>}
        </button>

        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center py-2 rounded-lg text-hbird-400 hover:text-white hover:bg-hbird-800 transition-colors"
        >
          {sidebarCollapsed
            ? <ChevronRightIcon className="h-4 w-4" />
            : <ChevronLeftIcon className="h-4 w-4" />
          }
        </button>
      </div>
    </aside>
  );
}
