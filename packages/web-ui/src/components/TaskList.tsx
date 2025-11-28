/**
 * Task List Component
 */

import { Link } from 'react-router-dom';

interface Task {
  id: string;
  description: string;
  status: string;
  createdAt: string;
}

interface TaskListProps {
  tasks: Task[];
}

export function TaskList({ tasks }: TaskListProps) {
  return (
    <div className="task-list">
      {tasks.length === 0 ? (
        <div className="empty-state">No tasks found</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Description</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>
                  <Link to={`/tasks/${task.id}`}>{task.id.substring(0, 8)}</Link>
                </td>
                <td>{task.description}</td>
                <td>
                  <span className={`status-badge status-${task.status}`}>
                    {task.status}
                  </span>
                </td>
                <td>{new Date(task.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

