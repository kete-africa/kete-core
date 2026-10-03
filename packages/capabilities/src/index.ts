// The public entry point of @kete/capabilities. Anything not exported here is internal.

export {
  defineCapability,
  modeFor,
  type Autonomy,
  type CapabilityContext,
  type CapabilityDefinition,
  type DecisionCapability,
  type DecisionResult,
  type DraftReview,
  type InvocationResult,
  type ReadCapability,
  type ReversibleCapability,
} from './capability.js';
export {
  createMcpHandler,
  protectedResourceMetadata,
  VIEW_MIME_TYPE,
  type McpHandlerOptions,
  type ViewResource,
} from './mcp.js';
export {
  createCapabilityRegistry,
  DRAFT_REVIEW_VIEW,
  type Caller,
  type CapabilityHost,
  type CapabilityRegistry,
  type CapabilityTool,
  type Decision,
  type Invocation,
} from './registry.js';
export {
  createDatasetRegistry,
  defineDataset,
  describeDataset,
  type DatasetDefinition,
  type DatasetQuery,
  type DatasetRead,
  type DatasetRegistry,
} from './datasets.js';
export { createHttpApi, type HttpApiOptions } from './http.js';
