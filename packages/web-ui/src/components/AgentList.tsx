/**
 * Agent List Component
 */

interface Agent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
}

interface AgentListProps {
  agents: Agent[];
}

export function AgentList({ agents }: AgentListProps) {
  return (
    <div className="agent-list">
      {agents.length === 0 ? (
        <div className="empty-state">No agents found</div>
      ) : (
        <div className="agent-grid">
          {agents.map((agent) => (
            <div key={agent.id} className="agent-card">
              <h3>{agent.name}</h3>
              <p>{agent.description}</p>
              <div className="capabilities">
                {agent.capabilities.map((cap) => (
                  <span key={cap} className="capability-badge">
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

