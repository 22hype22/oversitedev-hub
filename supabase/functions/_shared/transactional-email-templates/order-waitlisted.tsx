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

interface OrderWaitlistedProps {
  botName?: string
}

const OrderWaitlistedEmail = ({ botName }: OrderWaitlistedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      Your {SITE_NAME} order is on the waitlist — we'll deploy it the moment a
      slot opens.
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Thank you for your order</Heading>
        <Text style={text}>
          Thank you for your order with {SITE_NAME}. We're currently at capacity
          {botName ? ` and your order for ${botName} has` : ' and your order has'}{' '}
          been placed on our waitlist.
        </Text>
        <Text style={text}>
          As soon as a slot becomes available, your bot will be deployed and
          you'll receive a confirmation email.
        </Text>
        <Text style={text}>
          We appreciate your patience and look forward to working with you.
        </Text>
        <Text style={signature}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrderWaitlistedEmail,
  subject: 'Your Oversite order is on the waitlist',
  displayName: 'Order waitlisted',
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
