import { loadRepositoryEnv } from '../src/env.js';

// Local runs read the repository's .env; CI provides the variables directly.
loadRepositoryEnv(import.meta.dirname);
