/**
 * MCP Servers Page
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mcpAPI } from '../services/api';
import { MCPServerList } from '../components/MCPServerList';

export function MCPServersPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['mcp-servers'],
    queryFn: async () => {
      const response = await mcpAPI.listServers();
      return response.data;
    },
  });

  const connectMutation = useMutation({
    mutationFn: (serverId: string) => mcpAPI.connect(serverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-servers'] });
    },
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1>MCP Servers</h1>
      </div>
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <MCPServerList
          servers={data?.servers || []}
          onConnect={(id) => connectMutation.mutate(id)}
        />
      )}
    </div>
  );
}

