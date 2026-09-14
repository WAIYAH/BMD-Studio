import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom renders slowly on a busy machine. The default one-second wait for
// async queries makes the suite flaky there without making it any stricter.
configure({ asyncUtilTimeout: 3000 });

afterEach(() => {
  cleanup();
});
