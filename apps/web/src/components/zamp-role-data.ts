export type RoleProfile = {
  title: string;
  icon: string;
  strengths: string;
  bestUsed: string;
  output: string;
};

const ICON_ROOT = "/zamp-role-icons";

export const ZAMP_ROLE_PROFILES: RoleProfile[] = [
  {
    title: "Accountant",
    icon: `${ICON_ROOT}/agent_1_v2.svg`,
    strengths: "Invoice processing, three-way matching, journal entries, reconciliations, and month-end close support. Works inside your ERP — Oracle, NetSuite, SAP, Coupa — not in a separate window. Reads PDFs, emails, and spreadsheets the way an AP clerk would, then posts clean entries with proper coding and approvals.",
    bestUsed: "Finance teams buried in volume. The recurring, rules-heavy work that has to be right every time — where one typo means a reconciliation nightmare two weeks later.",
    output: "Processed invoices with full audit trail, GL-coded journal entries, reconciliation reports, flagged exceptions with supporting context, month-end close packages.",
  },
  {
    title: "Developer",
    icon: `${ICON_ROOT}/agent_2_v2.svg`,
    strengths: "Writing, reviewing, and debugging code across your stack. Reads the whole codebase before making a change — doesn't just generate snippets in isolation. Follows your conventions, your linting rules, and your team's style without being told.",
    bestUsed: "Engineering teams that want an extra set of capable hands for the work that never gets prioritized: bug triage, PR reviews, documentation, internal tooling, test coverage.",
    output: "Reviewed PRs with actual feedback, debugged code with clear explanations, documented APIs, internal scripts, refactored legacy code.",
  },
  {
    title: "GTM Associate",
    icon: `${ICON_ROOT}/agent_3.svg`,
    strengths: "Prospect sourcing, outreach drafting, follow-up sequencing, meeting prep, and CRM hygiene. Finds the right people, writes the right message, and keeps the pipeline moving. Doesn't spam. Knows the difference between personalization and fake personalization.",
    bestUsed: "Sales teams that need the grunt work done well so humans can focus on the conversations that matter. Top-of-funnel that stays consistent whether your AEs are having a good week or a bad one.",
    output: "Researched prospect lists, personalized outreach drafts, follow-up sequences, meeting prep briefs, cleaned-up CRM records.",
  },
  {
    title: "Recruiter",
    icon: `${ICON_ROOT}/agent_4.svg`,
    strengths: "Sourcing, resume screening, candidate outreach, interview scheduling, and pipeline tracking. Reads every resume in full. Doesn't skim. Knows the difference between a Diamond candidate and a Gold one — and doesn't confuse them.",
    bestUsed: "TA teams running multiple open roles at once. The sourcing and screening work that always becomes a bottleneck when hiring ramps up.",
    output: "Qualified candidate shortlists with notes, personalized outreach, screening summaries, pipeline reports, rejection letters that don't sound like rejection letters.",
  },
  {
    title: "Financial Analyst",
    icon: `${ICON_ROOT}/agent_5_v2.svg`,
    strengths: "Variance analysis, forecasting, management reporting, and ad-hoc modeling. Pulls from ERPs, data warehouses, and spreadsheets. Builds clean models that a CFO can actually read. Flags the story in the numbers, not just the numbers.",
    bestUsed: "FP&A teams that spend too much of the month pulling data and not enough analyzing it. Monthly reporting packages, budget reviews, board prep.",
    output: "Variance commentary, forecast models, board-ready reports, flux analysis, scenario planning.",
  },
  {
    title: "Legal Associate",
    icon: `${ICON_ROOT}/agent_6_v2.svg`,
    strengths: "Contract review, clause extraction, redlining against playbooks, and compliance checks. Reads every page. Catches the thing buried on page 34 that the other side hoped you wouldn't notice.",
    bestUsed: "In-house legal teams buried in NDAs, MSAs, DPAs, and vendor agreements. The high-volume, pattern-heavy review work that doesn't need a partner but still has to be done right.",
    output: "Redlined contracts, issue lists with recommendations, playbook compliance reports, contract summaries, renewal tracking.",
  },
  {
    title: "Customer Success Manager",
    icon: `${ICON_ROOT}/agent_7.svg`,
    strengths: "Account health tracking, meeting prep, follow-up drafting, and usage analysis. Remembers every conversation with every customer. Doesn't ask the same question twice. Notices when an account goes quiet before it becomes a problem.",
    bestUsed: "CS teams managing large books of business where things slip through the cracks. Pre-meeting briefs, QBR prep, churn risk flagging, expansion opportunity spotting.",
    output: "Account health reports, meeting briefs, follow-up emails, QBR decks, churn risk alerts.",
  },
  {
    title: "Support Specialist",
    icon: `${ICON_ROOT}/agent_8_v2.svg`,
    strengths: "Ticket triage, first-response drafting, knowledge base lookups, and escalation routing. Handles Tier 1 completely. Escalates Tier 2 with full context attached — so the human picking it up doesn't have to re-do the discovery.",
    bestUsed: "Support teams getting buried in volume or working across timezones. The repetitive tickets that drain morale and the well-structured ones that just need a fast, accurate response.",
    output: "Resolved tickets, drafted responses, updated knowledge base articles, escalation summaries with full context.",
  },
  {
    title: "Data Analyst",
    icon: `${ICON_ROOT}/agent_9.svg`,
    strengths: "SQL queries, dashboard building, cohort analysis, and data storytelling. Explores the data before answering the question. Knows when the answer the business wants isn't the answer the data supports — and says so.",
    bestUsed: "Data teams with too many ad-hoc requests and not enough time for the real work. Ad-hoc analysis, recurring reports, investigation work.",
    output: "SQL queries, dashboards, written analyses with interpretation, cohort reports, data quality flags.",
  },
  {
    title: "Procurement Analyst",
    icon: `${ICON_ROOT}/agent_10.svg`,
    strengths: "Vendor onboarding, PR-to-PO processing, three-way matching, and policy enforcement. Knows which purchase requests need scrutiny and which can flow. Reads contracts, catalogs, and vendor master data fluently.",
    bestUsed: "Procurement teams drowning in requisitions and vendor paperwork. The policy-heavy review work that slows everything down but can't be skipped.",
    output: "Validated PRs, approved POs, vendor onboarding packages, policy compliance flags, spend analysis reports.",
  },
  {
    title: "Compliance Analyst",
    icon: `${ICON_ROOT}/agent_2_v2.svg`,
    strengths: "Sanctions screening, KYC review, adverse media checks, and audit trail documentation. Does the full investigation — OSINT, registry checks, ownership tracing — not just the first match. Writes disposition notes that hold up in an audit.",
    bestUsed: "Risk and compliance teams doing L1 and L2 review work at volume. Payment screening, onboarding checks, periodic reviews — the work where missing one true match is a regulatory problem.",
    output: "Screening dispositions with full reasoning, KYC review packages, adverse media summaries, SAR drafts, audit-ready investigation files.",
  },
  {
    title: "Marketing Manager",
    icon: `${ICON_ROOT}/agent_5_v2.svg`,
    strengths: "Campaign planning, cross-channel execution, budget tracking, and team coordination. Holds the calendar, owns the briefs, and keeps every moving piece connected. Doesn't lose track of what's live, what's in review, and what's two weeks late. Thinks in quarters but executes week by week.",
    bestUsed: "Marketing teams that need someone keeping the machine running while senior people focus on strategy. The coordination layer — between agencies, contractors, designers, and writers — that usually falls to whoever is least busy.",
    output: "Campaign calendars, creative briefs, launch checklists, budget trackers, weekly status reports, post-campaign reviews.",
  },
  {
    title: "Revenue Operations Analyst",
    icon: `${ICON_ROOT}/agent_4.svg`,
    strengths: "CRM hygiene, pipeline reporting, attribution analysis, and sales process optimization. Lives in Salesforce or HubSpot but thinks beyond it. Spots where deals are stalling, where data is dirty, and where the funnel math doesn't add up. Asks the uncomfortable question: is the pipeline real?",
    bestUsed: "RevOps and sales leadership teams that need clean data and honest reporting. The weekly, monthly, and quarterly work that underpins every forecast conversation.",
    output: "Pipeline health reports, CRM audit logs, attribution dashboards, lead routing rules, forecast decks, territory models.",
  },
  {
    title: "Supply Chain Analyst",
    icon: `${ICON_ROOT}/agent_8_v2.svg`,
    strengths: "Demand forecasting, inventory analysis, supplier performance tracking, and logistics coordination. Reads purchase orders, shipment data, and lead time reports the way a seasoned planner would — and flags the problem before it becomes a stockout or an overage. Connects the dots between procurement, warehousing, and fulfillment without needing to be asked.",
    bestUsed: "Supply chain and operations teams managing complex vendor networks and high SKU volumes. The monitoring and reporting work that has to happen continuously — safety stock reviews, supplier scorecards, inbound tracking — but rarely gets enough attention because everyone is too busy fighting fires.",
    output: "Demand forecasts, inventory health reports, supplier scorecards, inbound shipment trackers, lead time analyses, reorder point recommendations.",
  },
  {
    title: "Risk Analyst",
    icon: `${ICON_ROOT}/agent.svg`,
    strengths: "Risk identification, control testing, incident documentation, and regulatory monitoring. Reads policy frameworks, audit findings, and regulatory guidance without glazing over. Tracks open issues to closure, flags what's past due, and builds the kind of audit trail that holds up under scrutiny. Knows the difference between a risk that needs escalating and one that needs documenting.",
    bestUsed: "Risk, compliance, and internal audit teams that need consistent coverage across a large control environment. The monitoring, testing, and reporting work that has to be done every cycle — and that usually falls to the most junior person in the room.",
    output: "Risk registers, control test results, incident reports, regulatory change summaries, issue tracking logs, audit committee packs.",
  },
];
