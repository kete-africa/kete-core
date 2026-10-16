import { loadRepositoryEnv } from '@kete/testing';

// Local runs read the repository's .env; CI provides the variables directly.
loadRepositoryEnv(import.meta.dirname);
