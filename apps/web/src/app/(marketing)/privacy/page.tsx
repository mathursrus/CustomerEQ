import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — CustomerEQ',
  description:
    'How CustomerEQ collects, uses, stores, and protects customer and end-user data, including data retrieved from third-party services such as Google Business Profile.',
}

const LAST_UPDATED = 'April 17, 2026'
const EFFECTIVE = 'April 17, 2026'

export default function PrivacyPage() {
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
            <Link href="/terms" className="text-sm text-gray-700 hover:text-indigo-600">
              Terms
            </Link>
            <Link href="/security" className="text-sm text-gray-700 hover:text-indigo-600">
              Security
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
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">Privacy Policy</h1>
        <p className="mt-3 text-sm text-gray-500">
          Last updated: {LAST_UPDATED} &middot; Effective: {EFFECTIVE}
        </p>

        <div className="mt-8 space-y-8 text-gray-700 leading-7">
          <section>
            <h2 className="text-xl font-semibold text-gray-900">1. Overview</h2>
            <p className="mt-3">
              CustomerEQ (&quot;CustomerEQ&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) provides a customer-experience analytics
              platform that helps businesses ingest customer feedback signals — including surveys, NPS responses,
              support conversations, reviews, loyalty events, and rep observations — and surface AI-driven insights
              to improve customer outcomes. This Privacy Policy explains what information we collect, how we use it,
              with whom we share it, how we secure it, and the rights you have with respect to your information.
            </p>
            <p className="mt-3">
              This policy applies to the CustomerEQ website, web application, APIs, and all related services
              (collectively, the &quot;Service&quot;). By using the Service, you agree to the practices described here.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">2. Who this policy applies to</h2>
            <p className="mt-3">CustomerEQ interacts with several categories of people:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                <strong>Customers</strong> — businesses that sign up to use CustomerEQ to analyze their own
                customers&apos; feedback.
              </li>
              <li>
                <strong>Authorized users</strong> — employees, contractors, or agents of a Customer who access the
                Service on the Customer&apos;s behalf.
              </li>
              <li>
                <strong>End users</strong> — the Customer&apos;s own customers, whose feedback, profile data, loyalty
                events, or reviews flow into the Service.
              </li>
              <li>
                <strong>Website visitors</strong> — anyone who visits our marketing website.
              </li>
            </ul>
            <p className="mt-3">
              For Customers and Authorized users, CustomerEQ acts as a data <em>controller</em> for the account and
              billing data we collect directly. For End user data that flows into the Service through a
              Customer&apos;s use of it, CustomerEQ acts as a data <em>processor</em> on behalf of that Customer.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">3. Information we collect</h2>

            <h3 className="mt-4 font-semibold text-gray-900">3.1 Information you provide directly</h3>
            <ul className="mt-2 list-disc space-y-2 pl-6">
              <li>Account information: name, email, password hash, company name, role.</li>
              <li>Billing information: payment details handled by our payment processor; we do not store full card numbers.</li>
              <li>Content you upload: survey questions, campaign configurations, knowledge-base articles, rewards catalog, and any other content you create within the Service.</li>
              <li>Communications: messages you send us via email, support chat, or feedback forms.</li>
            </ul>

            <h3 className="mt-4 font-semibold text-gray-900">3.2 Information collected automatically</h3>
            <ul className="mt-2 list-disc space-y-2 pl-6">
              <li>Log data: IP address, browser type, pages visited, timestamps, referrer URLs.</li>
              <li>Device information: operating system, device identifiers, screen size.</li>
              <li>Cookies and similar technologies: authentication cookies, preference cookies, and limited first-party analytics as described in Section 8.</li>
            </ul>

            <h3 className="mt-4 font-semibold text-gray-900">3.3 Information from third-party services</h3>
            <p className="mt-2">
              CustomerEQ connects to third-party platforms at a Customer&apos;s explicit direction, and only after the
              Customer authorizes access through OAuth or by providing credentials. These integrations may include
              (but are not limited to):
            </p>
            <ul className="mt-2 list-disc space-y-2 pl-6">
              <li>
                <strong>Google Business Profile (Google My Business) API</strong> — we retrieve public review
                content (review text, star rating, reviewer display name, review timestamps, and reviewer replies)
                for business locations the Customer owns or manages. We request only the minimum scopes required
                to read review data; we do not post, edit, or delete reviews or Business Profile content.
              </li>
              <li>Email providers, CRM systems, e-commerce platforms, and other review, survey, or analytics tools.</li>
            </ul>
            <p className="mt-3">
              Data retrieved from third-party services is stored and processed as End user data under this policy
              and the terms of the Customer&apos;s agreement with us. CustomerEQ&apos;s use of information received from
              Google APIs will adhere to the{' '}
              <a
                className="text-indigo-600 underline"
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>

            <h3 className="mt-4 font-semibold text-gray-900">3.4 End user data</h3>
            <p className="mt-2">
              When a Customer uses CustomerEQ, we process End user data on their behalf. This may include
              contact details (name, email, phone), purchase history, survey responses, NPS scores, support
              messages, review content, loyalty points balances, and tags or notes entered by the Customer&apos;s
              staff. The Customer determines what End user data flows into the Service and is responsible for
              having a lawful basis to do so.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">4. How we use information</h2>
            <p className="mt-3">We use information for the following purposes:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Providing, operating, and maintaining the Service.</li>
              <li>Authenticating users and securing the Service against fraud and abuse.</li>
              <li>Computing analytics, health scores, sentiment classifications, topic clusters, and anomaly detections requested by the Customer.</li>
              <li>Displaying retrieved third-party content (including Google reviews) back to the authorized Customer within the CustomerEQ dashboard.</li>
              <li>Sending transactional emails such as account confirmations, password resets, and service notifications.</li>
              <li>Responding to support requests and communicating with Customers about the Service.</li>
              <li>Improving the Service, diagnosing technical issues, and developing new features.</li>
              <li>Complying with legal obligations and enforcing our Terms of Service.</li>
            </ul>
            <p className="mt-3">
              <strong>We do not sell personal information.</strong> We do not use End user data retrieved from Google
              APIs to serve advertising, to build generalized AI/ML models that are used outside the Service, or for
              any purpose that is not disclosed to and authorized by the Customer.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">5. AI and automated processing</h2>
            <p className="mt-3">
              CustomerEQ uses machine-learning models — including large language models (LLMs) operated by third-party
              AI providers — to classify sentiment, cluster topics, detect anomalies, score customer health, and
              generate summaries. When we send content to an LLM provider:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>We send only the content required for the analysis.</li>
              <li>We use providers whose enterprise terms prohibit training their models on our data.</li>
              <li>We do not instruct models to generate, post, or publish content on your behalf without explicit user action.</li>
            </ul>
            <p className="mt-3">
              Data retrieved from Google APIs is not used to train AI/ML models. Automated inferences stored in the
              Service (such as a sentiment label on a review) are treated as derived content and inherit the same
              retention and access-control rules as the source content.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">6. How we share information</h2>
            <p className="mt-3">We share information only in these circumstances:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                <strong>With Authorized users of the same Customer account</strong> — so teammates can collaborate.
              </li>
              <li>
                <strong>With subprocessors</strong> — service providers who process data on our behalf under a data
                processing agreement. Current categories include cloud hosting, managed databases, email delivery,
                payment processing, error monitoring, and LLM/AI providers. A current list is available on request.
              </li>
              <li>
                <strong>When legally required</strong> — in response to valid legal process, or to protect the
                rights, safety, and property of CustomerEQ, our Customers, or the public.
              </li>
              <li>
                <strong>In a business transfer</strong> — if CustomerEQ is involved in a merger, acquisition, or
                sale of assets, data may be transferred as part of that transaction, subject to the protections of
                this policy.
              </li>
            </ul>
            <p className="mt-3">
              We never sell personal information, and we do not share End user data with third parties for their
              own marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">7. Data retention and deletion</h2>
            <p className="mt-3">
              We retain information for as long as a Customer&apos;s account is active and as needed to provide the
              Service. When an account is closed, we delete or de-identify Customer and End user data within
              ninety (90) days, except where we are legally required to retain certain records (e.g., tax or
              billing records).
            </p>
            <p className="mt-3">
              End users who want their data removed from a Customer&apos;s CustomerEQ environment should first contact
              the Customer. CustomerEQ will cooperate with Customers to honor verified deletion requests. For Google
              review content specifically, if a reviewer deletes their review on Google, we will remove it from the
              Customer&apos;s CustomerEQ view on the next sync, and in any case no later than thirty (30) days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">8. Cookies and analytics</h2>
            <p className="mt-3">
              We use a small number of first-party cookies for authentication and user preferences. We may use
              privacy-preserving analytics to understand aggregate usage of the marketing website. We do not use
              cookies to build cross-site advertising profiles, and we do not participate in third-party
              advertising networks. You can disable cookies in your browser settings, though this may affect the
              Service&apos;s functionality.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">9. Data security</h2>
            <p className="mt-3">
              We implement administrative, technical, and physical safeguards designed to protect your information,
              including encryption in transit (TLS 1.2 or higher), encryption at rest, role-based access controls,
              audit logging, and secret management. See our <Link href="/security" className="text-indigo-600 underline">Security page</Link> for
              more detail. No system is perfectly secure, and we cannot guarantee absolute security; however, we
              continuously work to harden the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">10. International data transfers</h2>
            <p className="mt-3">
              CustomerEQ is based in the United States, and information we collect will be processed and stored in
              the United States and other countries where our subprocessors operate. If you access the Service from
              outside the United States, you consent to the transfer and processing of your information in the
              United States. Where required, we rely on Standard Contractual Clauses or equivalent safeguards for
              international transfers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">11. Your rights</h2>
            <p className="mt-3">
              Depending on where you live, you may have rights including: access to the personal information we
              hold about you, correction of inaccurate information, deletion, portability, restriction of
              processing, and the right to object to certain processing. California residents have specific rights
              under the CCPA/CPRA, including the right to know, delete, correct, and opt out of sale or sharing of
              personal information (CustomerEQ does not sell personal information).
            </p>
            <p className="mt-3">
              To exercise these rights, email <a className="text-indigo-600 underline" href="mailto:sid.mathur@gmail.com">sid.mathur@gmail.com</a>.
              If you are an End user whose data was submitted by a CustomerEQ Customer, please contact that Customer
              directly; we will assist them in responding to verified requests.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">12. Children&apos;s privacy</h2>
            <p className="mt-3">
              The Service is not directed to children under 13 (or under 16 in jurisdictions where that is the
              applicable age), and we do not knowingly collect personal information from children. If you believe
              a child has provided us information, please contact us and we will delete it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">13. Changes to this policy</h2>
            <p className="mt-3">
              We may update this Privacy Policy from time to time. When we do, we will update the &quot;Last updated&quot;
              date above. For material changes, we will provide prominent notice (for example, by email to account
              administrators or a banner in the Service) before the change takes effect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">14. Contact us</h2>
            <p className="mt-3">
              Questions about this policy, or requests related to your information, can be sent to{' '}
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
