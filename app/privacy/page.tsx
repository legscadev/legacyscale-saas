import type { Metadata } from 'next'

import { LegalPageShell } from '@/components/marketing/legal/legal-page-shell'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Kondense collects, uses, discloses, and protects information about the people and organizations who use our platform.',
}

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy" effectiveDate="July 24, 2026">
      <p>
        This Privacy Policy (the &ldquo;Policy&rdquo;) describes how Kondense
        (&ldquo;Kondense&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or
        &ldquo;our&rdquo;) collects, uses, discloses, retains, and protects
        personal information when you visit our marketing site, create or
        access an account, or otherwise use the Kondense platform (the
        &ldquo;Service&rdquo;). It also describes the choices and rights you
        have with respect to that information.
      </p>
      <p>
        Kondense is a business-to-business platform. When you use the
        Service as part of an organization&rsquo;s workspace, that
        organization (the &ldquo;Customer&rdquo;) is the
        &ldquo;controller&rdquo; of the personal information you contribute
        or that is generated about your use, and Kondense acts as the
        &ldquo;processor&rdquo; on the Customer&rsquo;s behalf. If you have
        questions about how the Customer uses your information, please
        contact that Customer directly.
      </p>

      <h2>1. Information we collect</h2>

      <h3>a. Information you give us</h3>
      <ul>
        <li>
          <strong>Account details</strong> — name, email address, password
          credentials (stored only as a salted hash by our identity
          provider), profile photo, and any optional fields you complete
          (job title, timezone, communication preferences).
        </li>
        <li>
          <strong>Workspace content</strong> — courses, lessons, videos,
          quizzes, tasks, comments, checklists, notes, announcements,
          policies, uploaded files, and any other content you or your
          teammates create or upload into a workspace.
        </li>
        <li>
          <strong>Billing and organization details</strong> when applicable
          — company name, billing address, tax identifier, and payment
          method information (payment cards themselves are tokenized by our
          payment processor; we never see the raw card number).
        </li>
        <li>
          <strong>Support communications</strong> — messages, screenshots,
          and diagnostic data you send when contacting support.
        </li>
      </ul>

      <h3>b. Information we collect automatically</h3>
      <ul>
        <li>
          <strong>Log and device data</strong> — IP address, browser type
          and version, operating system, device identifiers, referring
          URLs, request timestamps, HTTP response codes.
        </li>
        <li>
          <strong>Usage data</strong> — pages viewed, features accessed,
          time spent on a page, links clicked, search queries typed inside
          the app, video playback events (buffered, played, paused,
          completed), quiz submissions, and lesson-progress markers.
        </li>
        <li>
          <strong>Cookies and similar technologies</strong> — strictly
          necessary cookies for session management (keeping you signed in),
          preference cookies (theme, sidebar state), and, if enabled, a
          minimal set of analytics cookies. See Section 6 below.
        </li>
      </ul>

      <h3>c. Information from third parties</h3>
      <p>
        We may receive information about you from services that integrate
        with the Service (for example, a Discord webhook posting a
        completion celebration, or an OAuth sign-in). We only receive the
        fields those services expose to us as part of the integration you
        or your Customer configured.
      </p>

      <h2>2. How we use information</h2>
      <ul>
        <li>To provide, operate, secure, and maintain the Service.</li>
        <li>
          To authenticate you and enforce access controls (workspace
          membership, role permissions, module grants).
        </li>
        <li>
          To send you transactional messages: password resets, sign-in
          notifications, receipts, security alerts, and Service-critical
          announcements.
        </li>
        <li>
          To send you product updates, tips, or educational material you
          have opted into. You can opt out at any time from your account
          settings or via the unsubscribe link in any such email;
          transactional messages are not opt-out.
        </li>
        <li>
          To detect, prevent, and respond to fraud, abuse, and security
          incidents.
        </li>
        <li>
          To measure and improve the Service — for example, aggregating
          usage data to understand which features are useful. Where
          possible we do this on aggregated or de-identified data.
        </li>
        <li>To comply with legal obligations and to defend legal claims.</li>
      </ul>

      <h2>3. Legal bases (EEA / UK visitors)</h2>
      <p>
        If you are in the European Economic Area, the United Kingdom, or
        Switzerland, our legal bases for processing your personal
        information are:
      </p>
      <ul>
        <li>
          <strong>Contract</strong> — to provide the Service you or your
          Customer signed up for.
        </li>
        <li>
          <strong>Legitimate interests</strong> — to secure the Service,
          prevent abuse, understand product usage, and communicate with you
          about the Service, provided those interests are not overridden by
          your rights.
        </li>
        <li>
          <strong>Consent</strong> — for marketing emails you have opted
          into, and for any analytics cookies that require consent under
          local law. You can withdraw consent at any time.
        </li>
        <li>
          <strong>Legal obligation</strong> — where processing is required
          by applicable law (tax, accounting, responding to a lawful
          request from an authority).
        </li>
      </ul>

      <h2>4. Sharing and disclosure</h2>
      <p>
        We do not sell personal information. We share it only in these
        situations:
      </p>
      <ul>
        <li>
          <strong>Within your workspace</strong> — content you create in a
          workspace is visible to other members of that workspace according
          to their permissions. Workspace administrators can see all
          content in the workspace, including membership, activity logs,
          and audit trails.
        </li>
        <li>
          <strong>Sub-processors</strong> — vetted vendors who process
          personal information on our behalf under contractual terms that
          require them to protect it (Section 5).
        </li>
        <li>
          <strong>Corporate transactions</strong> — if Kondense is involved
          in a merger, acquisition, financing, reorganization, bankruptcy,
          or asset sale, personal information may be transferred as part of
          that transaction; we will notify you before your information
          becomes subject to a different privacy policy.
        </li>
        <li>
          <strong>Legal and safety</strong> — to comply with a valid legal
          request, to enforce our terms, to protect the rights, property,
          or safety of Kondense, our users, or the public, or in
          connection with a criminal investigation.
        </li>
        <li>
          <strong>With your direction</strong> — when you connect a
          third-party integration or explicitly authorize a share.
        </li>
      </ul>

      <h2>5. Sub-processors</h2>
      <p>
        We use the following categories of sub-processors to run the
        Service. Each is bound by written data-protection terms that limit
        their use of personal information to what is necessary to deliver
        their service.
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — authentication, primary database,
          and file storage. Data hosted in the Supabase region we have
          selected for our tenant.
        </li>
        <li>
          <strong>Vercel</strong> — application hosting, edge routing, and
          content delivery.
        </li>
        <li>
          <strong>Mux</strong> — video ingest, hosting, transcoding, and
          playback for course lessons.
        </li>
        <li>
          <strong>Resend</strong> — transactional email delivery (sign-in
          links, receipts, in-app notification emails).
        </li>
        <li>
          <strong>Anthropic</strong> — LLM inference for optional
          AI-assisted features. Content sent to Anthropic is not used to
          train their models.
        </li>
      </ul>
      <p>
        An up-to-date list is available on request. We will notify
        Customers of material changes to sub-processors with at least 30
        days&rsquo; notice so they can object.
      </p>

      <h2>6. Cookies and analytics</h2>
      <p>
        We use a small number of cookies:
      </p>
      <ul>
        <li>
          <strong>Strictly necessary</strong> — session cookies from our
          identity provider that keep you signed in. Without them the
          Service cannot function. These do not require consent under most
          laws.
        </li>
        <li>
          <strong>Preference</strong> — remember your UI settings such as
          theme, sidebar collapse state, and language. First-party only.
        </li>
        <li>
          <strong>Analytics</strong> — if enabled, we collect aggregated,
          pseudonymised event data to understand feature usage. Where the
          law requires consent (e.g. EEA / UK) we ask before setting these.
        </li>
      </ul>
      <p>
        Most browsers let you control cookies through their settings.
        Blocking strictly-necessary cookies will prevent you from signing
        in.
      </p>

      <h2>7. Data retention</h2>
      <p>
        We keep personal information only as long as we need it for the
        purpose we collected it for or as required by law.
      </p>
      <ul>
        <li>
          <strong>Account data</strong> — retained while your account is
          active. When you close your account we delete or anonymize it
          within 90 days, subject to the exceptions below.
        </li>
        <li>
          <strong>Workspace content</strong> — controlled by the
          Customer&rsquo;s retention decisions. Deleted content is
          purged from our production databases within 30 days; encrypted
          backups roll off within 90 days.
        </li>
        <li>
          <strong>Log data</strong> — retained for up to 12 months for
          security, debugging, and abuse prevention.
        </li>
        <li>
          <strong>Financial records</strong> — retained as required by
          applicable tax and accounting laws (typically 7 years).
        </li>
      </ul>

      <h2>8. Your rights</h2>
      <p>Depending on where you live, you may have the right to:</p>
      <ul>
        <li>Access the personal information we hold about you.</li>
        <li>Correct information that is inaccurate or incomplete.</li>
        <li>Delete your account and associated personal information.</li>
        <li>Export your data in a machine-readable format.</li>
        <li>Object to or restrict certain processing.</li>
        <li>Withdraw a previously-given consent.</li>
        <li>
          Lodge a complaint with a data-protection authority (in the EEA /
          UK / Switzerland).
        </li>
      </ul>
      <p>
        You can exercise most rights directly from your account settings.
        For anything the app doesn&rsquo;t expose, email us at the address
        in Section 13; we will respond within 30 days.
      </p>
      <p>
        If you are a resident of California, you may have additional rights
        under the CCPA / CPRA (right to know, right to delete, right to
        correct, right to opt out of &ldquo;sale&rdquo; or
        &ldquo;sharing&rdquo; of personal information, and right to limit
        use of sensitive personal information). We do not sell or share
        personal information as defined by the CCPA / CPRA.
      </p>

      <h2>9. Security</h2>
      <p>
        We take reasonable, industry-standard measures to protect personal
        information: TLS everywhere in transit, encryption at rest for
        databases and file storage, principle-of-least-privilege access
        controls for staff, mandatory two-factor authentication for
        privileged accounts, audit logging, quarterly reviews of
        production access, and periodic third-party security assessments.
        No system is ever perfectly secure; if you become aware of a
        vulnerability please report it responsibly to the address in
        Section 13.
      </p>

      <h2>10. International transfers</h2>
      <p>
        Kondense is operated from the United States. When we transfer
        personal information from the EEA, UK, or Switzerland to a country
        that has not been recognized as providing an adequate level of
        protection, we rely on Standard Contractual Clauses (or equivalent
        transfer mechanisms) with our sub-processors.
      </p>

      <h2>11. Children</h2>
      <p>
        The Service is not intended for children under 13 (or the age of
        digital consent in your country). We do not knowingly collect
        personal information from children. If we learn that we have
        collected such information without a parent&rsquo;s consent we
        will delete it. Contact us if you believe a child has provided us
        with personal information.
      </p>

      <h2>12. Changes to this Policy</h2>
      <p>
        We may update this Policy from time to time. Material changes will
        be announced in-app and, for account holders, by email at least 14
        days before they take effect. The &ldquo;Effective&rdquo; date at
        the top of the page reflects when the current version took effect.
        Previous versions are available on request.
      </p>

      <h2>13. Contact</h2>
      <p>
        Questions, requests, or complaints? Email{' '}
        <a href="mailto:hello@kondense.ai">hello@kondense.ai</a>. If you
        are a Customer, your Data Processing Addendum lists a specific
        privacy contact — use that address for DPA-scoped requests.
      </p>
    </LegalPageShell>
  )
}
