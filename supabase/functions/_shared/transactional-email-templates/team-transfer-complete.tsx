import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Oversite'

interface TeamTransferCompleteProps {
  previousOwnerEmail?: string
  dashboardUrl?: string
}

const TeamTransferCompleteEmail = ({
  previousOwnerEmail,
  dashboardUrl,
}: TeamTransferCompleteProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You are now the owner of a {SITE_NAME} account</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Ownership transferred to you</Heading>
        <Text style={text}>
          <strong>{previousOwnerEmail ?? 'The previous owner'}</strong> has
          transferred ownership of their {SITE_NAME} account to you.
        </Text>
        <Text style={text}>
          You now have full control of the account and its dashboard,
          including billing. Sign in to manage your bots and team.
        </Text>
        {dashboardUrl && (
          <Button style={button} href={dashboardUrl}>
            Open dashboard
          </Button>
        )}
        <Text style={footer}>
          If you weren't expecting this transfer, please reply to this email
          right away so we can help secure the account.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TeamTransferCompleteEmail,
  subject: (data: Record<string, any>) =>
    `You are now the owner of a ${SITE_NAME} account`,
  displayName: 'Team ownership transfer complete',
  previewData: {
    previousOwnerEmail: 'previous-owner@example.com',
    dashboardUrl: 'https://oversite.shop/bot-dashboard',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}
const container = { padding: '32px 24px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 24px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const button = {
  backgroundColor: '#0f172a', color: '#ffffff', padding: '12px 20px',
  borderRadius: '8px', textDecoration: 'none', fontSize: '14px',
  fontWeight: 'bold', display: 'inline-block', margin: '8px 0 24px',
}
const footer = { fontSize: '13px', color: '#64748b', margin: '24px 0 0' }
