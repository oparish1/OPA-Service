import '@testing-library/jest-dom/vitest';
import { setProviderRegistry } from './src/core/providers/active';
import { TEST_PROVIDER_MODULE } from './src/core/testing/providers';

// Core tests never compose a real provider; provider tests install their own module.
setProviderRegistry([TEST_PROVIDER_MODULE]);
