import Link from 'next/link'

export const metadata = {
  title: 'Security — CustomerEQ',
  description:
    'How CustomerEQ protects customer data: infrastructure, encryption, access controls, vulnerability management, and incident response.',
}

const LAST_UPDATED = 'April 17, 2026'

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-200 px-6 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">C</span>
            </div>
            <span className="text-lg font-semibold text-gray-900">CustomerEQ</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-sm text-gray-700 hover:text-indigo-600">
              Privacy
            </Link>
            <Link href="/terms" className="text-sm text-gray-700 hover:text-indigo-600">
              Terms
            </Link>
            <Link
              href="/request-demo"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Request Demo
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">Security at CustomerEQ</h1>
        <p className="mt-3 text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>

        <p className="mt-6 text-lg text-gray-700 leading-8">
          Our customers trust CustomerEQ with sensitive customer-experience data — surveys, reviews, loyalty
          records, support conversations, and the derived insights we compute on top. This page describes how we
          protect that information across our infrastructure, applications, and operations.
        </p>

        <div className="mt-12 space-y-10 text-gray-700 leading-7">
          <section>
            <h2 className="text-xl font-semibold text-gray-900">1. Infrastructure</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>The Service runs on reputable cloud providers whose data centers maintain SOC 2, ISO 27001, and similar compliance attestations.</li>
              <li>Production workloads are isolated from development and staging environments with separate networks, credentials, and access policies.</li>
              <li>Managed PostgreSQL is used for primary data storage, with point-in-time recovery, automated snapshots, and encryption at rest.</li>
              <li>Secrets (API keys, OAuth tokens, database credentials) are stored in a dedicated secret manager and rotated on a defined schedule and after any suspected exposure.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">2. Encryption</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li><strong>In transit:</strong> all traffic to and from the Service is encrypted using TLS 1.2 or higher. HSTS is enabled on our web properties.</li>
              <li><strong>At rest:</strong> databases, object storage, and automated backups are encrypted at rest using AES-256.</li>
              <li><strong>Sensitive fields:</strong> OAuth refresh tokens and credentials used to access third-party APIs (including Google Business Profile) are stored encrypted with an application-level key separate from the storage layer key.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">3. Access control</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Employee access to production systems requires multi-factor authentication and is granted on a least-privilege basis.</li>
              <li>Access to Customer data is restricted to personnel who need it to deliver and operate the Service. Access is logged and reviewed periodically.</li>
              <li>Within the application, role-based access controls (admin, manager, analyst, member) govern which features and data a user can see. Customers can create and assign roles appropriate to their organization.</li>
              <li>OAuth tokens used to access third-party APIs are scoped to the minimum permissions required for the requested functionality.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">4. Application security</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Authentication is performed against a managed identity provider with secure password storage (hashed, salted), account lockout protections, and optional SSO.</li>
              <li>APIs enforce authentication and authorization on every request; inputs are validated using schema validators.</li>
              <li>Standard web-application protections are applied, including CSRF protection on state-changing routes, Content-Security-Policy headers, and protections against SQL injection, XSS, and open redirects.</li>
              <li>Dependencies are monitored for known vulnerabilities and patched on a regular cadence; critical vulnerabilities are patched out-of-band.</li>
              <li>Automated unit, integration, and end-to-end tests run on every change before deployment.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">5. Secure software development</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Source code is version-controlled, code-reviewed, and changes to production systems are deployed through CI/CD pipelines with audit trails.</li>
              <li>Secret scanning and dependency scanning run on every commit.</li>
              <li>Security reviews are performed on material changes to authentication, authorization, data handling, or third-party integrations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">6. Monitoring and logging</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Application and infrastructure logs are centralized and retained in a write-protected store for investigation and audit purposes.</li>
              <li>Errors and anomalies are tracked via an error-monitoring service; alerting covers availability, latency, and error-rate regressions.</li>
              <li>Access to production and admin consoles is audit-logged with user attribution.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">7. Backups and business continuity</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Databases are backed up automatically with point-in-time recovery.</li>
              <li>Backups are encrypted and retained according to a documented retention schedule.</li>
              <li>Restore procedures are exercised periodically.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">8. Incident response</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>We maintain an incident response plan covering triage, containment, eradication, recovery, and post-incident review.</li>
              <li>If a security incident affects Customer data, we will notify affected Customers without undue delay and provide information that enables them to meet their own notification obligations.</li>
              <li>We will cooperate with Customers and regulators as required by applicable law.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">9. Vendor management</h2>
            <p className="mt-3">
              We carefully select subprocessors and service providers that handle Customer data. We evaluate
              their security, privacy, and compliance practices, sign data-processing agreements where applicable,
              and share data with them only to the extent required to deliver the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">10. Third-party APIs (including Google Business Profile)</h2>
            <p className="mt-3">
              When a Customer authorizes CustomerEQ to connect to a third-party service (for example, Google
              Business Profile), we follow these practices:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>We use OAuth wherever available and request only the minimum scopes required for the requested functionality (for example, read-only access to reviews).</li>
              <li>We store refresh tokens encrypted and use short-lived access tokens at runtime.</li>
              <li>We never post, edit, or delete content on behalf of a Customer unless they explicitly request that action.</li>
              <li>We honor revocation: when a Customer disconnects an integration, we stop using the corresponding tokens and purge them on our next credential-rotation pass.</li>
              <li>Our use of information received from Google APIs adheres to the <a className="text-indigo-600 underline" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">11. Responsible disclosure</h2>
            <p className="mt-3">
              If you believe you have discovered a security vulnerability in the Service, please email us at{' '}
              <a className="text-indigo-600 underline" href="mailto:sid.mathur@gmail.com">
                sid.mathur@gmail.com
              </a>{' '}
              with details and any proof-of-concept. Please give us a reasonable opportunity to investigate and
              remediate before public disclosure. We will acknowledge valid reports and credit reporters where
              appropriate.
            </p>
            <p className="mt-3">
              Please do not test for vulnerabilities against real customer data, perform denial-of-service
              testing, or access data belonging to other Customers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">12. Compliance roadmap</h2>
            <p className="mt-3">
              CustomerEQ is building toward formal attestations (for example, SOC 2 Type II) as the business
              matures. Customers with specific compliance or contractual requirements can contact us to discuss
              current posture and timelines.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">13. Contact</h2>
            <p className="mt-3">
              Security questions, due-diligence requests, or vulnerability reports can be sent to{' '}
              <a className="text-indigo-600 underline" href="mailto:sid.mathur@gmail.com">
                sid.mathur@gmail.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-16 border-t border-gray-200 pt-8 text-sm text-gray-500">
          <Link href="/" className="hover:text-indigo-600">&larr; Back to home</Link>
        </div>
      </main>
    </div>
  )
}
