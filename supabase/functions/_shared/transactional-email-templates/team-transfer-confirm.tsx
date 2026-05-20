import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Oversite'

interface TeamTransferProps {
  ownerEmail?: string
  confirmUrl?: string
  botNames?: string[]
}

const TeamTransferConfirmEmail = ({ ownerEmail, confirmUrl, botNames }: TeamTransferProps) => {
  const list = Array.isArray(botNames) ? botNames.filter(Boolean) : []
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Confirm bot ownership transfer on {SITE_NAME}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Confirm bot ownership transfer</Heading>
          <Text style={text}>
            <strong>{ownerEmail ?? 'The current owner'}</strong> wants to
            transfer ownership of the following bot{list.length === 1 ? '' : 's'} to you:
          </Text>
          {list.length > 0 && (
            <ul style={listStyle}>
              {list.map((name) => (
                <li key={name} style={listItem}>{name}</li>
              ))}
            </ul>
          )}
          <Text style={text}>
            Click the button below to confirm. You must be signed in to the
            {' '}{SITE_NAME} account this email was sent to. Once confirmed,
            the selected bots will move to your account.
          </Text>
          {confirmUrl && (
            <Button style={button} href={confirmUrl}>
              Confirm transfer
            </Button>
          )}
          <Text style={footer}>
            If you weren't expecting this, you can safely ignore this email and
            the transfer will not happen. This link expires in 7 days.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: TeamTransferConfirmEmail,
  subject: (data: Record<string, any>) =>
    `Confirm ownership transfer of a ${SITE_NAME} account`,
  displayName: 'Team ownership transfer',
  previewData: {
    ownerEmail: 'owner@example.com',
    confirmUrl: 'https://oversite.shop/auth?team_transfer=abc',
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
