/**
 * MCP Server List Component
 */

interface MCPServer {
  id: string;
  name: string;
  status: string;
  description?: string;
}

interface MCPServerListProps {
  servers: MCPServer[];
  onConnect: (id: string) => void;
}

export function MCPServerList({ servers, onConnect }: MCPServerListProps) {
  return (
    <div className="mcp-server-list">
      {servers.length === 0 ? (
        <div className="empty-state">No MCP servers found</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {servers.map((server) => (
              <tr key={server.id}>
                <td>{server.name}</td>
                <td>
                  <span className={`status-badge status-${server.status}`}>
                    {server.status}
                  </span>
                </td>
                <td>{server.description || '-'}</td>
                <td>
                  {server.status !== 'connected' && (
                    <button
                      onClick={() => onConnect(server.id)}
                      className="btn btn-sm btn-primary"
                    >
                      Connect
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

