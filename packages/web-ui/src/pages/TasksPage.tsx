/**
 * Tasks Page
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskAPI } from '../services/api';
import { TaskList } from '../components/TaskList';
import { CreateTaskForm } from '../components/CreateTaskForm';
import { useWebSocket } from '../hooks/useWebSocket';

export function TasksPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const response = await taskAPI.list();
      return response.data;
    },
  });

  // Subscribe to task updates via WebSocket
  useWebSocket((message) => {
    if (message.type === 'task_completed' || message.type === 'task_failed') {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });

  const createMutation = useMutation({
    mutationFn: ({ description, metadata }: { description: string; metadata?: Record<string, unknown> }) =>
      taskAPI.create(description, metadata),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1>Tasks</h1>
        <CreateTaskForm onSubmit={(desc, meta) => createMutation.mutate({ description: desc, metadata: meta })} />
      </div>
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <TaskList tasks={data?.tasks || []} />
      )}
    </div>
  );
}

