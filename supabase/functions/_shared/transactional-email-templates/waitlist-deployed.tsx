import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Oversite'

interface WaitlistDeployedProps {
  botName?: string
}

const WaitlistDeployedEmail = ({ botName }: WaitlistDeployedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      A slot opened up — your {SITE_NAME} bot is being deployed now.
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Good news — your bot is on its way</Heading>
        <Text style={text}>
          A slot has just opened up and{' '}
          {botName ? `${botName} is` : 'your bot is'} now being deployed.
        </Text>
        <Text style={text}>
          You can track its build progress and manage it from your {SITE_NAME}{' '}
          dashboard. We'll send a final confirmation as soon as it's online.
        </Text>
        <Text style={text}>
          Thank you for your patience — we're delighted to have you with us.
        </Text>
        <Text style={signature}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WaitlistDeployedEmail,
  subject: 'Your Oversite bot is being deployed',
  displayName: 'Waitlist promoted — deployment started',
  previewData: { botName: 'My Custom Bot' },
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
const signature = {
  fontSize: '14px',
  color: '#64748b',
  margin: '32px 0 0',
}
