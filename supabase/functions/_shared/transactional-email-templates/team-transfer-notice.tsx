import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Oversite'

interface TeamTransferNoticeProps {
  memberEmail?: string
}

const TeamTransferNoticeEmail = ({ memberEmail }: TeamTransferNoticeProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Ownership transfer requested on your {SITE_NAME} account</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Ownership transfer requested</Heading>
        <Text style={text}>
          You just requested to transfer ownership of your {SITE_NAME} account
          to <strong>{memberEmail ?? 'a team member'}</strong>.
        </Text>
        <Text style={text}>
          We've sent them a confirmation email. The transfer only takes effect
          once they click the confirmation link and sign in. They have 7 days
          to confirm.
        </Text>
        <Text style={text}>
          When the transfer completes, you'll automatically be demoted from
          Owner to Co-Owner and will keep access to most of the account.
        </Text>
        <Text style={footer}>
          Didn't request this? Open the Team Management hub in your dashboard
          and cancel the pending transfer right away, then change your
          password.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TeamTransferNoticeEmail,
  subject: () => `Ownership transfer requested on your ${SITE_NAME} account`,
  displayName: 'Team ownership transfer notice (owner copy)',
  previewData: { memberEmail: 'newowner@example.com' },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}
const container = { padding: '32px 24px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 24px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const footer = { fontSize: '13px', color: '#64748b', margin: '24px 0 0' }
