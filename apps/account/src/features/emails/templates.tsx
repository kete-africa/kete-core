import { defineEmailTemplate } from '@kete/notify';
import { Body, Button, Container, Head, Html, Section, Text } from '@react-email/components';
import type { ReactNode } from 'react';
import * as m from '../../paraglide/messages.js';

type Locale = 'fr' | 'en';
const localeOf = (locale: string): Locale => (locale === 'en' ? 'en' : 'fr');

// Kete's colours (@kete/design, v1 rectangle): e-mail clients need inline styles, so the few that
// matter are repeated here.
const colors = { primary: '#b8321f', text: '#2a1d16', muted: '#6b5a4e', paper: '#fbf8f4' };

function Layout({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <Html lang={locale}>
      <Head />
      <Body style={{ backgroundColor: colors.paper, fontFamily: 'Arial, sans-serif' }}>
        <Container style={{ maxWidth: '560px', padding: '24px', color: colors.text }}>
          <Text style={{ fontSize: '20px', fontWeight: 700, color: colors.primary }}>
            {m.email_brand({}, { locale })}
          </Text>
          <Text>{m.email_greeting({}, { locale })}</Text>
          {children}
          <Text style={{ fontSize: '12px', color: colors.muted, marginTop: '32px' }}>
            {m.email_footer({}, { locale })}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

function Action({ href, label }: { href: string; label: string }) {
  return (
    <Section style={{ margin: '24px 0' }}>
      <Button
        href={href}
        style={{ backgroundColor: colors.primary, color: '#ffffff', padding: '12px 20px' }}
      >
        {label}
      </Button>
    </Section>
  );
}

/** An invitation to join an organization (Better Auth's organization plugin). */
export const invitationEmail = defineEmailTemplate<{
  inviter: string;
  organization: string;
  link: string;
}>({
  name: 'invitation',
  render: (values, requested) => {
    const locale = localeOf(requested);
    return {
      subject: m.email_invitation_subject(values, { locale }),
      body: (
        <Layout locale={locale}>
          <Text>{m.email_invitation_body(values, { locale })}</Text>
          <Action href={values.link} label={m.email_invitation_action({}, { locale })} />
        </Layout>
      ),
    };
  },
});

/** The link to choose a new password, for an account that has one. */
export const passwordResetEmail = defineEmailTemplate<{ link: string }>({
  name: 'password-reset',
  render: ({ link }, requested) => {
    const locale = localeOf(requested);
    return {
      subject: m.email_reset_subject({}, { locale }),
      body: (
        <Layout locale={locale}>
          <Text>{m.email_reset_body({}, { locale })}</Text>
          <Action href={link} label={m.email_reset_action({}, { locale })} />
        </Layout>
      ),
    };
  },
});

/**
 * For an account without a password (passkeys only, or provisioned by phone): nothing to reset, and
 * no password is ever added through e-mail (spec 016).
 */
export const passwordResetUnavailableEmail = defineEmailTemplate<Record<string, never>>({
  name: 'password-reset-unavailable',
  render: (_values, requested) => {
    const locale = localeOf(requested);
    return {
      subject: m.email_reset_unavailable_subject({}, { locale }),
      body: (
        <Layout locale={locale}>
          <Text>{m.email_reset_unavailable_body({}, { locale })}</Text>
        </Layout>
      ),
    };
  },
});
