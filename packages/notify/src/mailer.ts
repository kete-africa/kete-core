import { render } from '@react-email/render';
import type { ReactElement } from 'react';
import type { EmailSender, OutgoingEmail, SentEmail } from './email.js';

/** An e-mail of a product, in the recipient's language: its subject, and its body as React Email. */
export interface EmailTemplate<Values> {
  name: string;
  render(values: Values, locale: string): { subject: string; body: ReactElement };
}

/** Declares a template once; the product's catalogs give it its words (no hard-coded text). */
export function defineEmailTemplate<Values>(
  template: EmailTemplate<Values>,
): EmailTemplate<Values> {
  if (!/^[a-z][a-z0-9_-]*$/.test(template.name)) {
    throw new Error(`A template is named in lowercase: ${template.name}`);
  }
  return template;
}

/** Renders a React Email body to the HTML and the plain text every e-mail carries. */
export async function renderEmail(body: ReactElement): Promise<{ html: string; text: string }> {
  const [html, text] = await Promise.all([render(body), render(body, { plainText: true })]);
  return { html, text };
}

export interface MailerOptions {
  sender: EmailSender;
  /** `Kete <compte@kete.africa>`. */
  from: string;
  replyTo?: string;
}

export interface Mailer {
  send<Values>(
    template: EmailTemplate<Values>,
    message: {
      to: string | string[];
      values: Values;
      locale: string;
      metadata?: Record<string, string>;
    },
  ): Promise<SentEmail>;
}

/** Renders a template in the recipient's language and sends it through the port. */
export function createMailer(options: MailerOptions): Mailer {
  return {
    async send(template, message) {
      const { subject, body } = template.render(message.values, message.locale);
      const { html, text } = await renderEmail(body);
      const email: OutgoingEmail = {
        from: options.from,
        to: message.to,
        subject,
        html,
        text,
        metadata: { template: template.name, ...message.metadata },
        ...(options.replyTo ? { replyTo: options.replyTo } : {}),
      };
      return options.sender.send(email);
    },
  };
}
