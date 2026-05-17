import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Oversite'

interface TeamInviteProps {
  inviterEmail?: string
  role?: string
  acceptUrl?: string
}

const ROLE_LABEL: Record<string, string> = {
  co_owner: 'Co-Owner',
  admin: 'Admin',
  moderator: 'Moderator',
  viewer: 'Viewer',
}

const TeamInviteEmail = ({ inviterEmail, role, acceptUrl }: TeamInviteProps) => {
  const roleLabel = role ? (ROLE_LABEL[role] ?? role) : 'team member'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>You've been invited to a {SITE_NAME} team</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>You've been invited</Heading>
          <Text style={text}>
            <strong>{inviterEmail ?? 'A teammate'}</strong> has invited you to
            join their {SITE_NAME} account as a <strong>{roleLabel}</strong>.
          </Text>
          <Text style={text}>
            Click the button below to accept the invite. If you don't have an
            account yet, you'll be able to create one with this email — and
            you'll automatically join their team.
          </Text>
          {acceptUrl && (
            <Button style={button} href={acceptUrl}>
              Accept invite
            </Button>
          )}
          <Text style={footer}>
            If you weren't expecting this invite, you can safely ignore this
            email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: TeamInviteEmail,
  subject: (data: Record<string, any>) =>
    `${data.inviterEmail ?? 'Someone'} invited you to their ${SITE_NAME} team`,
  displayName: 'Team invite',
  previewData: {
    inviterEmail: 'owner@example.com',
    role: 'admin',
    acceptUrl: 'https://oversite.shop/auth?team_invite=abc',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}
const container = { padding: '32px 24px', maxWidth: '560px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold',
  color: '#0f172a',
  margin: '0 0 24px',
}
const text = {
  fontSize: '15px',
  color: '#334155',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const button = {
  backgroundColor: '#0f172a',
  color: '#ffffff',
  padding: '12px 20px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 'bold',
  display: 'inline-block',
  margin: '8px 0 24px',
}
const footer = {
  fontSize: '13px',
  color: '#64748b',
  margin: '24px 0 0',
}
