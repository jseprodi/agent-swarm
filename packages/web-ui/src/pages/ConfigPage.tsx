/**
 * Configuration Page
 */

import { useQuery } from '@tanstack/react-query';
import { configAPI } from '../services/api';

export function ConfigPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      const response = await configAPI.get();
      return response.data;
    },
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1>Configuration</h1>
      </div>
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div className="config-content">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

