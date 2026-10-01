// What the button and the server share, with no server dependency: the button ships to browsers.
export const feedbackKinds = ['problem', 'idea', 'praise'] as const;
export type FeedbackKind = (typeof feedbackKinds)[number];

export interface FeedbackInput {
  kind: FeedbackKind;
  message: string;
  /** The screen she was on (a path, never a full address with its query). */
  page?: string;
}
