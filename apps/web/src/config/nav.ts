import {
  Activity,
  AtSign,
  Ban,
  Bookmark,
  Clock,
  Cpu,
  Database,
  FileText,
  Globe,
  Inbox,
  LayoutDashboard,
  ListChecks,
  PenLine,
  ScrollText,
  Search,
  Send,
  Settings,
  Share2,
  Swords,
  Tag,
  Target,
  TrendingUp,
  User,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavItem = {
  label: string
  path: string
  icon: LucideIcon
  phase?: number
  summary?: string
}

export type NavSection = { label: string; items: NavItem[] }

export const NAV: NavSection[] = [
  {
    label: 'OVERVIEW',
    items: [{ label: 'Dashboard', path: '/', icon: LayoutDashboard }],
  },
  {
    label: 'DISCOVERY',
    items: [
      { label: 'Discover Businesses', path: '/discover', icon: Search, phase: 2, summary: 'Find businesses by country, city and industry, filtered by what contact details they publish.' },
      { label: 'Saved Searches', path: '/saved-searches', icon: Bookmark, phase: 2, summary: 'Re-run the discovery searches you use most.' },
      { label: 'Discovery History', path: '/discovery-history', icon: Clock, phase: 2, summary: 'Every discovery run with its sources, counts and errors.' },
    ],
  },
  {
    label: 'INTELLIGENCE',
    items: [
      { label: 'Contact Intelligence', path: '/contacts', icon: AtSign, phase: 3, summary: 'Public emails, phone numbers and contact pages, each tied to its evidence.' },
      { label: 'Owner Intelligence', path: '/owners', icon: User, phase: 9, summary: 'Publicly disclosed owners and decision-makers, with sources and confidence.' },
      { label: 'Website Intelligence', path: '/websites', icon: Globe, phase: 4, summary: 'Performance, SEO, mobile and technical audits with measurable findings.' },
      { label: 'Competitor Intelligence', path: '/competitors', icon: Swords, phase: 9, summary: 'Evidence-based comparisons against competing websites.' },
      { label: 'Opportunity Intelligence', path: '/opportunities', icon: Target, phase: 6, summary: 'Ranked problems, matched services and explainable scores.' },
    ],
  },
  {
    label: 'REPORTS',
    items: [
      { label: 'Internal Reports', path: '/reports/internal', icon: FileText, phase: 5, summary: 'Private research reports with full evidence and notes.' },
      { label: 'Shared Reports', path: '/reports/shared', icon: Share2, phase: 5, summary: 'Polished business-facing reports and private share links.' },
    ],
  },
  {
    label: 'OUTREACH',
    items: [
      { label: 'Pitch Intelligence', path: '/pitch', icon: Send, phase: 7, summary: 'Evidence-based outreach composition with quality checks.' },
      { label: 'Drafts', path: '/drafts', icon: PenLine, phase: 7, summary: 'Generated drafts waiting for review.' },
      { label: 'Approval Queue', path: '/approvals', icon: ListChecks, phase: 7, summary: 'Nothing is sent without human approval and a suppression check.' },
      { label: 'Outreach History', path: '/outreach-history', icon: Inbox, phase: 8, summary: 'Sent messages, replies, bounces and outcomes.' },
    ],
  },
  {
    label: 'MANAGEMENT',
    items: [
      { label: 'Lead Database', path: '/leads', icon: Database, phase: 8, summary: 'Every business with advanced filters and statuses.' },
      { label: 'Custom Lists', path: '/lists', icon: ListChecks, phase: 8, summary: 'Hand-built and saved lead lists.' },
      { label: 'Tags', path: '/tags', icon: Tag, phase: 8, summary: 'Tag and organise leads your way.' },
      { label: 'Activity History', path: '/activity', icon: Activity, phase: 8, summary: 'A timeline of everything that happened to a lead.' },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { label: 'Scraping Jobs', path: '/jobs', icon: Cpu, phase: 2, summary: 'Background jobs with pause, resume, cancel and retry.' },
      { label: 'Worker Monitoring', path: '/workers', icon: Activity, phase: 10, summary: 'Live worker load, speed and concurrency.' },
      { label: 'Failed URLs', path: '/failed-urls', icon: Ban, phase: 10, summary: 'Failures grouped by reason, with one-click retry.' },
      { label: 'Job Logs', path: '/job-logs', icon: ScrollText, phase: 10, summary: 'Detailed execution logs for every job.' },
    ],
  },
  {
    label: 'ANALYTICS',
    items: [
      { label: 'Business Analytics', path: '/analytics/business', icon: TrendingUp, phase: 10, summary: 'Discovery volume, industries and countries over time.' },
      { label: 'Website Analytics', path: '/analytics/websites', icon: Globe, phase: 10, summary: 'Technology, CMS and health distributions.' },
      { label: 'Opportunity Analytics', path: '/analytics/opportunities', icon: Target, phase: 10, summary: 'Which problems and services come up most.' },
      { label: 'Outreach Performance', path: '/analytics/outreach', icon: Send, phase: 10, summary: 'Replies and outcomes by approach.' },
    ],
  },
  {
    label: 'SETTINGS',
    items: [
      { label: 'Settings', path: '/settings', icon: Settings, phase: 2, summary: 'Data sources, crawl limits, concurrency, scoring and email settings.' },
    ],
  },
]

export const ALL_ITEMS: NavItem[] = NAV.flatMap((s) => s.items)
export const PLANNED_ITEMS: NavItem[] = ALL_ITEMS.filter((i) => i.phase !== undefined)

export function findNavItem(pathname: string): NavItem | undefined {
  return ALL_ITEMS.find((i) => i.path === pathname)
}