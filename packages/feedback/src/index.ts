// The public entry point of @kete/feedback. Anything not exported here is internal.
export { FeedbackButton, type FeedbackLabels } from './button.js';
export {
  createFeedbackHandler,
  type Feedback,
  FeedbackError,
  feedbackInput,
  type FeedbackKind,
  feedbackKinds,
  feedbackMigrationSql,
  listFeedback,
  submitFeedback,
} from './feedback.js';
export type { FeedbackInput } from './kinds.js';
