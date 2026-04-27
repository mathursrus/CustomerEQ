import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service — CustomerEQ',
  description:
    'The agreement governing use of the CustomerEQ customer-experience analytics platform, including acceptable use, content ownership, and service terms.',
}

const LAST_UPDATED = 'April 17, 2026'
const EFFECTIVE = 'April 17, 2026'

export default function TermsPage() {
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
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">Terms of Service</h1>
        <p className="mt-3 text-sm text-gray-500">
          Last updated: {LAST_UPDATED} &middot; Effective: {EFFECTIVE}
        </p>

        <div className="mt-8 space-y-8 text-gray-700 leading-7">
          <section>
            <h2 className="text-xl font-semibold text-gray-900">1. Agreement</h2>
            <p className="mt-3">
              These Terms of Service (&quot;Terms&quot;) govern your access to and use of the CustomerEQ customer-experience
              analytics platform and all related websites, applications, and APIs (collectively, the
              &quot;Service&quot;) provided by CustomerEQ (&quot;CustomerEQ&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). By using the Service,
              you agree to these Terms. If you are using the Service on behalf of an organization, you represent
              that you have authority to bind that organization to these Terms, and &quot;you&quot; refers to both you
              individually and the organization.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">2. Your account</h2>
            <p className="mt-3">
              To use the Service you must create an account. You agree to provide accurate information, keep your
              credentials confidential, and be responsible for all activity that occurs under your account. Notify
              us promptly at <a className="text-indigo-600 underline" href="mailto:sid.mathur@gmail.com">sid.mathur@gmail.com</a> if
              you suspect unauthorized use.
            </p>
            <p className="mt-3">
              You must be at least 18 years old and legally able to form a binding contract to use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">3. Acceptable use</h2>
            <p className="mt-3">You agree not to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Use the Service in violation of any applicable law, regulation, or contractual obligation.</li>
              <li>Upload or process information for which you do not have a lawful basis.</li>
              <li>Attempt to probe, scan, or test the vulnerability of the Service without our prior written consent.</li>
              <li>Interfere with or disrupt the integrity, performance, or availability of the Service.</li>
              <li>Reverse-engineer, decompile, or attempt to extract the source code of the Service, except where applicable law permits.</li>
              <li>Use the Service to send spam, malware, or any other unwanted or harmful content.</li>
              <li>Use the Service to infringe the intellectual property or privacy rights of any person.</li>
              <li>Resell, sublicense, or white-label the Service without a written commercial agreement with us.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">4. Content and ownership</h2>
            <h3 className="mt-4 font-semibold text-gray-900">4.1 Your content</h3>
            <p className="mt-2">
              You retain ownership of data and content you upload, create, or import into the Service
              (&quot;Customer Content&quot;), including content you collect from your own customers (surveys, reviews, loyalty
              events, support messages, etc.). You grant CustomerEQ a limited, worldwide, non-exclusive,
              royalty-free license to host, store, process, transmit, and display Customer Content solely for the
              purpose of operating and improving the Service for you, and to comply with legal obligations. You
              represent that you have all necessary rights and consents to provide Customer Content to us.
            </p>

            <h3 className="mt-4 font-semibold text-gray-900">4.2 Third-party content</h3>
            <p className="mt-2">
              The Service can retrieve content from third-party platforms (such as Google Business Profile)
              at your direction. That content — including review text, ratings, reviewer display names, and
              timestamps — belongs to the platforms and/or the original authors. You agree to use such content
              only as permitted by the applicable third-party terms (including the{' '}
              <a
                className="text-indigo-600 underline"
                href="https://developers.google.com/terms"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google APIs Terms of Service
              </a>
              ) and solely within the Service.
            </p>

            <h3 className="mt-4 font-semibold text-gray-900">4.3 Our intellectual property</h3>
            <p className="mt-2">
              CustomerEQ, including its software, designs, logos, and documentation, is owned by us or our
              licensors and is protected by intellectual property laws. We grant you a limited, non-exclusive,
              non-transferable, revocable license to use the Service in accordance with these Terms. All rights
              not expressly granted are reserved.
            </p>

            <h3 className="mt-4 font-semibold text-gray-900">4.4 Feedback</h3>
            <p className="mt-2">
              If you provide us with feedback or suggestions about the Service, you grant us a perpetual,
              irrevocable, worldwide, royalty-free license to use that feedback without obligation to you.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">5. Fees and billing</h2>
            <p className="mt-3">
              Some features of the Service may be offered under paid plans. Fees, billing frequency, and the scope
              of any paid plan will be set out in an order form, online sign-up flow, or written agreement between
              you and us. Unless otherwise stated, fees are non-refundable and exclude applicable taxes. We may
              change prices for future billing periods upon reasonable notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">6. Third-party services and integrations</h2>
            <p className="mt-3">
              The Service may interoperate with third-party services (such as Google Business Profile, email
              providers, CRM systems, or LLM providers). Your use of those third-party services is governed by
              their own terms, and we are not responsible for their availability, performance, or actions. You are
              responsible for obtaining any authorizations required to grant the Service access to your third-party
              accounts and for complying with the terms of each third-party service you connect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">7. Privacy and data protection</h2>
            <p className="mt-3">
              Our <Link href="/privacy" className="text-indigo-600 underline">Privacy Policy</Link> describes how we
              collect, use, and protect information. By using the Service you acknowledge the Privacy Policy.
              Where CustomerEQ acts as a processor of personal data on your behalf, the terms of a separate Data
              Processing Addendum (DPA) may apply; we will make a DPA available on request.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">8. Security</h2>
            <p className="mt-3">
              We implement the security measures described on our{' '}
              <Link href="/security" className="text-indigo-600 underline">Security page</Link>. You are responsible
              for configuring the Service securely within the controls we provide (including strong credentials,
              least-privilege access, and careful handling of API keys and OAuth tokens).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">9. Availability and modifications</h2>
            <p className="mt-3">
              We strive to keep the Service available and will provide reasonable notice of planned downtime where
              practical. We may add, change, or remove features at any time. We may suspend or terminate access in
              cases of misuse, security incidents, non-payment, or legal requirement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">10. Termination</h2>
            <p className="mt-3">
              You may stop using the Service at any time and close your account by contacting us. We may suspend or
              terminate your access if you materially breach these Terms or applicable law. On termination, your
              right to use the Service ends and we will handle your data as described in the Privacy Policy.
              Sections of these Terms that by their nature survive termination (ownership, disclaimers, limitation
              of liability, indemnification, governing law) will survive.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">11. Disclaimers</h2>
            <p className="mt-3">
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
              IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
              NON-INFRINGEMENT, AND ANY WARRANTIES ARISING OUT OF COURSE OF DEALING OR USAGE OF TRADE. WE DO NOT
              WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, ERROR-FREE, OR THAT ANY CONTENT OR ANALYSIS
              GENERATED BY THE SERVICE WILL BE ACCURATE OR RELIABLE.
            </p>
            <p className="mt-3">
              OUTPUTS FROM AI/ML COMPONENTS OF THE SERVICE (INCLUDING SUMMARIES, CLASSIFICATIONS, SCORES, AND
              SUGGESTIONS) ARE PROBABILISTIC AND MAY CONTAIN ERRORS. YOU ARE RESPONSIBLE FOR REVIEWING AI-GENERATED
              OUTPUTS BEFORE RELYING ON THEM FOR ANY DECISION.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">12. Limitation of liability</h2>
            <p className="mt-3">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT WILL CUSTOMEREQ, ITS AFFILIATES, OR ITS
              LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR
              ANY LOSS OF PROFITS, REVENUES, DATA, OR GOODWILL, ARISING OUT OF OR RELATED TO THESE TERMS OR THE
              SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR AGGREGATE LIABILITY
              FOR ALL CLAIMS ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE WILL NOT EXCEED THE GREATER
              OF (A) THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE CLAIM OR (B) USD
              $100.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">13. Indemnification</h2>
            <p className="mt-3">
              You agree to defend, indemnify, and hold harmless CustomerEQ and its officers, directors, employees,
              and agents from and against any claims, damages, liabilities, costs, and expenses (including
              reasonable attorneys&apos; fees) arising out of or related to: (a) your use of the Service in violation
              of these Terms or applicable law; (b) Customer Content or your processing of End user data; or (c)
              your violation of any third-party right, including third-party service terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">14. Governing law and disputes</h2>
            <p className="mt-3">
              These Terms are governed by the laws of the State of Washington, USA, without regard to its conflict
              of laws principles. The federal and state courts located in King County, Washington will have
              exclusive jurisdiction over any dispute arising out of or related to these Terms, and you consent to
              the personal jurisdiction of those courts. Nothing in this section prevents either party from
              seeking injunctive or equitable relief in any court of competent jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">15. Changes to these Terms</h2>
            <p className="mt-3">
              We may update these Terms from time to time. For material changes we will provide reasonable advance
              notice (for example, by email to account administrators or a banner in the Service). Your continued
              use of the Service after the effective date of the updated Terms constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">16. Miscellaneous</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li><strong>Entire agreement.</strong> These Terms, together with the Privacy Policy and any order form or addendum we execute with you, constitute the entire agreement between the parties regarding the Service.</li>
              <li><strong>Severability.</strong> If any provision is held unenforceable, the rest remains in effect.</li>
              <li><strong>No waiver.</strong> A failure to enforce any provision is not a waiver of that provision.</li>
              <li><strong>Assignment.</strong> You may not assign these Terms without our prior written consent; we may assign these Terms in connection with a merger, acquisition, or sale of assets.</li>
              <li><strong>Notices.</strong> Notices to us should be sent to <a className="text-indigo-600 underline" href="mailto:sid.mathur@gmail.com">sid.mathur@gmail.com</a>.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">17. Contact</h2>
            <p className="mt-3">
              Questions about these Terms can be sent to{' '}
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
