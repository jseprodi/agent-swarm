/**
 * Create Task Form Component
 */

import { useState, FormEvent } from 'react';

interface CreateTaskFormProps {
  onSubmit: (description: string, metadata?: Record<string, unknown>) => void;
}

export function CreateTaskForm({ onSubmit }: CreateTaskFormProps) {
  const [description, setDescription] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (description.trim()) {
      onSubmit(description.trim());
      setDescription('');
      setIsOpen(false);
    }
  };

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} className="btn btn-primary">
        Create Task
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="create-task-form">
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Enter task description..."
        rows={3}
        className="form-input"
      />
      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          Create
        </button>
        <button type="button" onClick={() => setIsOpen(false)} className="btn btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}

