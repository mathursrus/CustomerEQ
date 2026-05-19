# Azure Communication Services Email Setup

This project can send email through Azure Communication Services when:

1. `EMAIL_PROVIDER=azure-communication-services`
2. The custom domain `customereq.wellnessatwork.me` is verified in Azure Email Communication Services
3. That verified domain is connected to the Azure Communication Services resource whose connection string the app uses
4. A sender username exists for the domain, such as `no-reply`, so the app can send from `no-reply@customereq.wellnessatwork.me`

## Azure resource setup

1. Create or reuse an Azure Communication Services resource.
2. Create an Email Communication Services resource in the same subscription.
3. In the Email Communication Services resource, add the custom domain `customereq.wellnessatwork.me`.
4. Publish the DNS records Azure generates for the domain verification flow.
   Required records typically include the domain verification TXT record plus SPF, DKIM, and DKIM2.
5. Publish a DMARC record for the subdomain if one does not already exist.
6. Wait for Azure to show the custom domain as verified.
7. Link the verified domain to the Azure Communication Services resource.
8. Create a sender username such as `no-reply`.

## Application configuration

Store these values in your runtime secret manager:

```env
EMAIL_PROVIDER=azure-communication-services
AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING=endpoint=https://<resource>.communication.azure.com/;accesskey=<key>
AZURE_COMMUNICATION_SERVICES_EMAIL_FROM=no-reply@customereq.wellnessatwork.me
```

Notes:

- The connection string comes from the Azure Communication Services resource, not the Email Communication Services resource.
- The `AZURE_COMMUNICATION_SERVICES_EMAIL_FROM` address must match a verified sender on the linked domain.
- The worker and `QUEUE_MODE=inline` now use the same delivery path, so local and deployed behavior stay aligned.

## Project behavior

- `apps/worker/src/processors/notifications.ts` now resolves the recipient from `Member.email` if `metadata.to` is not supplied.
- `apps/api/src/queues/bullmq.ts` uses the same delivery helper in inline mode.
- If a member has no email address, delivery is skipped with `reason=recipient_missing`.
- If `EMAIL_PROVIDER=stub`, delivery is skipped with `reason=stub_provider`.

## Recommended first smoke test

1. Set the three env vars above.
2. Start the API and worker with the real secrets loaded.
3. Trigger any existing email-producing flow, such as member enrollment or the public survey trigger endpoint.
4. Confirm the worker logs `notification.email_sent`.
5. Confirm the recipient receives mail from `no-reply@customereq.wellnessatwork.me`.
