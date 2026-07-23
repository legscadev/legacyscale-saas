import type { Metadata } from 'next'

import { LegalPageShell } from '@/components/marketing/legal/legal-page-shell'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The contract that governs your use of Kondense — what we provide, what you agree to, and how disputes are handled.',
}

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of Service" effectiveDate="July 24, 2026">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) form a legally binding
        agreement between you and Kondense (&ldquo;Kondense&rdquo;,
        &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) governing
        your access to and use of the Kondense platform, marketing site,
        APIs, and any related services we make available (collectively,
        the &ldquo;Service&rdquo;). By creating an account, clicking
        &ldquo;I agree,&rdquo; or otherwise using the Service, you accept
        these Terms. If you do not agree, do not use the Service.
      </p>
      <p>
        If you are entering into these Terms on behalf of an organization
        (a &ldquo;Customer&rdquo;), you represent that you have the
        authority to bind that organization, and &ldquo;you&rdquo; refers
        to that organization. Individual users invited into a Customer
        workspace also agree to these Terms with respect to their
        individual use.
      </p>

      <h2>1. Eligibility and accounts</h2>
      <p>
        You must be at least 13 years old (or the age of digital consent
        in your jurisdiction) to use the Service. You are responsible for:
      </p>
      <ul>
        <li>The accuracy of the information you provide when registering.</li>
        <li>
          Keeping your credentials confidential and using two-factor
          authentication where offered.
        </li>
        <li>
          Every activity that occurs under your account, whether or not
          authorized by you.
        </li>
        <li>
          Notifying us immediately at{' '}
          <a href="mailto:hello@kondense.ai">hello@kondense.ai</a> if you
          suspect any unauthorized access or breach.
        </li>
      </ul>

      <h2>2. The Service</h2>
      <p>
        Kondense provides a members platform for creators, coaches, and
        course sellers — including a course library, video hosting,
        internal task tracking, policies, org-board management, and
        related tools. Specific features may be added, changed, or removed
        over time. Beta features are marked as such and provided
        &ldquo;as is&rdquo; without any commitment; we may modify or
        withdraw them at any time.
      </p>

      <h2>3. Customer and User relationships</h2>
      <p>
        When you use the Service through a Customer&rsquo;s workspace, the
        Customer is responsible for that workspace and its members. The
        Customer&rsquo;s administrators may:
      </p>
      <ul>
        <li>Invite, remove, or suspend users.</li>
        <li>Access, modify, or delete content in the workspace.</li>
        <li>Configure integrations and change workspace settings.</li>
        <li>Export workspace data.</li>
      </ul>
      <p>
        If you use the Service through an employer or organization,
        contact that organization&rsquo;s administrator with questions
        about their workspace policies.
      </p>

      <h2>4. Fees, billing, and taxes</h2>
      <p>
        Some plans require payment. When you subscribe to a paid plan:
      </p>
      <ul>
        <li>
          Fees, billing intervals, currency, and applicable taxes are shown
          before you complete the purchase. All fees are exclusive of
          taxes unless stated.
        </li>
        <li>
          Subscriptions renew automatically at the end of each billing
          period unless you cancel before the renewal date. You authorize
          us (or our payment processor) to charge the payment method on
          file for renewals.
        </li>
        <li>
          If a payment fails we may retry it, suspend paid features until
          resolved, and downgrade the account after a reasonable grace
          period.
        </li>
        <li>
          Except where required by law, fees paid are non-refundable. If
          we materially reduce Service functionality mid-term without
          notice, contact us and we will consider a pro-rated refund on a
          case-by-case basis.
        </li>
        <li>
          You are responsible for all taxes assessed on fees you pay
          (VAT, sales tax, GST, etc.), other than taxes on our net income.
        </li>
      </ul>

      <h2>5. Your content and license</h2>
      <p>
        You retain ownership of any content, data, or materials you upload
        to or create in the Service (&ldquo;Your Content&rdquo;). You
        grant Kondense a worldwide, non-exclusive, royalty-free license to
        host, store, transmit, back up, display, and process Your Content
        solely to operate and improve the Service on your behalf. This
        license ends when the content is deleted from the Service,
        subject to reasonable retention for backups and legal compliance.
      </p>
      <p>
        You represent and warrant that you have all rights necessary to
        upload Your Content and to grant the license above, and that Your
        Content does not violate any law or third-party rights.
      </p>

      <h2>6. Acceptable use</h2>
      <p>You agree not to, and not to allow anyone to:</p>
      <ul>
        <li>
          Use the Service to violate any law, regulation, or the rights
          of others (including intellectual property, privacy, and
          contractual rights).
        </li>
        <li>
          Upload content that is unlawful, deceptive, defamatory, obscene,
          hateful, harassing, or that promotes violence, self-harm, or
          discrimination.
        </li>
        <li>
          Distribute malware, phishing links, or otherwise attempt to
          harm users or systems.
        </li>
        <li>
          Circumvent, disable, or otherwise interfere with security,
          rate limits, or access controls.
        </li>
        <li>
          Reverse-engineer, decompile, or attempt to derive source code
          from the Service, except where such restriction is prohibited
          by law.
        </li>
        <li>
          Access the Service to build a competing product or copy any
          feature or user interface.
        </li>
        <li>
          Resell, sublicense, or share the Service (including account
          access) with anyone outside your workspace without our written
          consent.
        </li>
        <li>
          Run automated scraping, benchmarking, or load-testing against the
          Service without prior written consent.
        </li>
      </ul>
      <p>
        We may suspend or terminate access, remove content, or take other
        reasonable action if we believe in good faith that these
        restrictions have been violated.
      </p>

      <h2>7. Intellectual property and feedback</h2>
      <p>
        The Service, including all software, design, text, graphics,
        logos, and documentation (other than Your Content), is owned by
        Kondense and its licensors and is protected by intellectual
        property laws. We grant you a limited, non-exclusive,
        non-transferable, revocable right to access and use the Service in
        accordance with these Terms.
      </p>
      <p>
        If you provide feedback, suggestions, or ideas about the Service,
        you grant Kondense a perpetual, irrevocable, worldwide,
        royalty-free license to use them for any purpose, without
        obligation or attribution.
      </p>

      <h2>8. Third-party services</h2>
      <p>
        The Service may interoperate with third-party services (video
        hosting, email delivery, Discord, calendaring, payment, and so
        on). Your use of a third-party service is governed by that
        provider&rsquo;s terms and privacy policy. Kondense is not
        responsible for third-party services, their availability, or the
        content they surface.
      </p>

      <h2>9. Copyright and DMCA</h2>
      <p>
        If you believe content on the Service infringes your copyright,
        send a notice to{' '}
        <a href="mailto:hello@kondense.ai">hello@kondense.ai</a> including
        (a) your contact information, (b) a description of the copyrighted
        work, (c) the URL or other identification of the allegedly
        infringing material, (d) a statement made under penalty of
        perjury that you are authorized to act on behalf of the copyright
        owner, and (e) your physical or electronic signature. We may
        remove the material, notify the affected user, and terminate
        repeat infringers.
      </p>

      <h2>10. Confidentiality</h2>
      <p>
        Each party may access non-public information of the other
        (&ldquo;Confidential Information&rdquo;), including workspace
        content, pricing, and roadmap details. Each party will (a) use
        Confidential Information only to perform under these Terms, (b)
        protect it with the same care it uses for its own confidential
        information (and never less than reasonable care), and (c) not
        disclose it to third parties except to employees, contractors,
        and advisors bound by comparable confidentiality obligations, or
        as required by law.
      </p>

      <h2>11. Warranty disclaimer</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; and &ldquo;as
        available.&rdquo; To the fullest extent permitted by law,
        Kondense and its licensors disclaim all warranties, whether
        express, implied, statutory, or otherwise, including any
        warranties of merchantability, fitness for a particular purpose,
        title, non-infringement, and any warranties arising from course
        of dealing or usage of trade. We do not warrant that the Service
        will be uninterrupted, error-free, or secure, or that any content
        will be preserved without loss.
      </p>

      <h2>12. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law:
      </p>
      <ul>
        <li>
          Kondense will not be liable for any indirect, incidental,
          consequential, special, punitive, or exemplary damages, or for
          lost profits, lost revenue, lost data, or business
          interruption, even if advised of the possibility of such
          damages.
        </li>
        <li>
          Kondense&rsquo;s aggregate liability for all claims arising out
          of or relating to these Terms or the Service will not exceed
          the greater of (a) the fees you paid us for the Service in the
          twelve (12) months preceding the event giving rise to the
          liability, or (b) one hundred US dollars ($100).
        </li>
      </ul>
      <p>
        These limits apply to the maximum extent permitted by law even if
        a remedy fails of its essential purpose. Some jurisdictions do
        not allow certain limitations, so some of the above may not apply
        to you.
      </p>

      <h2>13. Indemnification</h2>
      <p>
        You will defend, indemnify, and hold harmless Kondense and its
        officers, directors, employees, and agents from and against any
        claims, damages, liabilities, and expenses (including reasonable
        attorneys&rsquo; fees) arising out of or related to (a) Your
        Content, (b) your use of the Service in violation of these Terms
        or applicable law, or (c) your violation of a third-party right.
      </p>

      <h2>14. Term, suspension, and termination</h2>
      <p>
        These Terms remain in effect while you use the Service. You may
        stop using the Service at any time. Paid subscriptions continue
        through the end of the current billing period unless cancelled
        earlier under a right of withdrawal that applies to you.
      </p>
      <p>
        We may suspend or terminate your access, with or without notice,
        if we reasonably believe you have violated these Terms, if
        continued provision would expose Kondense or its users to legal,
        security, or financial risk, or if required by law. Upon
        termination:
      </p>
      <ul>
        <li>Your right to access the Service ends immediately.</li>
        <li>
          You may export Your Content for a reasonable window after
          termination (typically 30 days) unless the termination was for
          cause; after that window we may delete it.
        </li>
        <li>
          Provisions that by their nature should survive (ownership,
          disclaimers, limitations of liability, indemnification, dispute
          resolution) will survive.
        </li>
      </ul>

      <h2>15. Changes to the Service and to these Terms</h2>
      <p>
        We continuously improve the Service. That means features may be
        added, changed, or removed. We aim to give reasonable advance
        notice of material changes that reduce functionality you rely on.
      </p>
      <p>
        We may update these Terms from time to time. Material changes
        will be announced in-app and, for account holders, by email at
        least 14 days before they take effect. The &ldquo;Effective&rdquo;
        date at the top of the page reflects the current version.
        Continued use of the Service after the effective date constitutes
        acceptance of the updated Terms.
      </p>

      <h2>16. Governing law and disputes</h2>
      <p>
        These Terms are governed by the laws of the jurisdiction in which
        Kondense is incorporated, without regard to conflict-of-laws
        principles. The parties will attempt to resolve any dispute
        informally first by contacting{' '}
        <a href="mailto:hello@kondense.ai">hello@kondense.ai</a>. If a
        dispute is not resolved within 30 days, it will be brought
        exclusively in the state or federal courts located in that
        jurisdiction, and you consent to the personal jurisdiction of
        those courts. Nothing in this section prevents either party from
        seeking injunctive relief for infringement of intellectual
        property rights in any court of competent jurisdiction.
      </p>

      <h2>17. Force majeure</h2>
      <p>
        Neither party is liable for any failure or delay in performance
        caused by circumstances beyond its reasonable control, including
        natural disasters, war, terrorism, labor disputes, government
        acts, internet or utility outages, and failures of third-party
        services.
      </p>

      <h2>18. Assignment</h2>
      <p>
        You may not assign or transfer these Terms without our prior
        written consent. Kondense may assign these Terms in connection
        with a merger, acquisition, reorganization, or sale of assets.
        Any prohibited assignment is void.
      </p>

      <h2>19. Notices</h2>
      <p>
        We may deliver notices to you in-app, by email to the address on
        your account, or by any other reasonable means. Notices to
        Kondense should be sent to{' '}
        <a href="mailto:hello@kondense.ai">hello@kondense.ai</a> and are
        effective when actually received.
      </p>

      <h2>20. Entire agreement and severability</h2>
      <p>
        These Terms, together with any order form, Data Processing
        Addendum, or other document expressly incorporated, are the
        entire agreement between you and Kondense regarding the Service,
        and supersede all prior agreements on that subject. If any
        provision is held to be unenforceable, the remaining provisions
        remain in full force and effect, and the unenforceable provision
        will be construed to the maximum extent permitted by law.
      </p>

      <h2>21. Contact</h2>
      <p>
        Questions about these Terms? Email{' '}
        <a href="mailto:hello@kondense.ai">hello@kondense.ai</a>.
      </p>
    </LegalPageShell>
  )
}
