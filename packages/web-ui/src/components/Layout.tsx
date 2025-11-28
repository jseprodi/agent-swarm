/**
 * Main Layout Component
 */

import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>Agent Swarm</h1>
        </div>
        <nav className="sidebar-nav">
          <Link
            to="/tasks"
            className={location.pathname.startsWith('/tasks') ? 'active' : ''}
          >
            Tasks
          </Link>
          <Link
            to="/agents"
            className={location.pathname === '/agents' ? 'active' : ''}
          >
            Agents
          </Link>
          <Link
            to="/mcp"
            className={location.pathname === '/mcp' ? 'active' : ''}
          >
            MCP Servers
          </Link>
          <Link
            to="/config"
            className={location.pathname === '/config' ? 'active' : ''}
          >
            Configuration
          </Link>
        </nav>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}

