/**
 * Task Detail Page
 */

import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { taskAPI } from '../services/api';

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: async () => {
      const response = await taskAPI.get(id!);
      return response.data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!data) {
    return <div>Task not found</div>;
  }

  const { task, subtasks, result } = data;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Task Details</h1>
      </div>
      <div className="task-detail">
        <div className="task-info">
          <h2>{task.description}</h2>
          <p>Status: {task.status}</p>
          <p>Created: {new Date(task.createdAt).toLocaleString()}</p>
        </div>
        {subtasks && subtasks.length > 0 && (
          <div className="subtasks">
            <h3>Subtasks</h3>
            <ul>
              {subtasks.map((subtask: any) => (
                <li key={subtask.id}>{subtask.description} - {subtask.status}</li>
              ))}
            </ul>
          </div>
        )}
        {result && (
          <div className="task-result">
            <h3>Result</h3>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

