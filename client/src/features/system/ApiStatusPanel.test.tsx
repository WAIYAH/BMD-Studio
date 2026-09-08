import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ApiClientError } from '@/lib/api-client';
import { ApiStatusPanel } from './ApiStatusPanel';
import * as systemApi from './api';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('ApiStatusPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a loading state before the probe resolves', () => {
    vi.spyOn(systemApi, 'fetchHealth').mockReturnValue(new Promise(() => {}));
    render(<ApiStatusPanel />, { wrapper });
    expect(screen.getByRole('status')).toHaveTextContent(/checking api connection/i);
  });

  it('renders what the API reported', async () => {
    vi.spyOn(systemApi, 'fetchHealth').mockResolvedValue({
      status: 'ok',
      service: 'bmd-studio-api',
      version: '0.1.0',
      environment: 'development',
      timezone: 'Africa/Nairobi',
      uptimeSeconds: 3_720,
      timestamp: new Date().toISOString(),
    });

    render(<ApiStatusPanel />, { wrapper });

    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Africa/Nairobi')).toBeInTheDocument();
    expect(screen.getByText('1h 2m')).toBeInTheDocument();
  });

  it('reports the failure instead of a reassuring green light', async () => {
    vi.spyOn(systemApi, 'fetchHealth').mockRejectedValue(
      new ApiClientError('Could not reach the server.', {
        code: 'UPSTREAM_ERROR',
        status: 0,
        requestId: 'req-123',
      }),
    );

    render(<ApiStatusPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/api unreachable/i);
    });
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
    expect(screen.getByText(/req-123/)).toBeInTheDocument();
  });
});
