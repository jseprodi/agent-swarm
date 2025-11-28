/**
 * Agents Page
 */

import { useQuery } from '@tanstack/react-query';
import { agentAPI } from '../services/api';
import { AgentList } from '../components/AgentList';

export function AgentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const response = await agentAPI.list();
      return response.data;
    },
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1>Agents</h1>
      </div>
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <AgentList agents={data?.agents || []} />
      )}
    </div>
  );
}

