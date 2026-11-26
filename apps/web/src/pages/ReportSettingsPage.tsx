import { PLACEHOLDER_ORG, resolveHeader, type BrandMode, type ReportSettingsDto } from '@meridian/shared/api-types'
import { Image as ImageIcon, Upload, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { StaticWordmark } from '../components/brand/StaticWordmark'
import {
  useRemoveReportLogo,
  useReportSettings,
  useSaveReportSettings,
  useUploadReportLogo,
} from '../lib/queries'

const MODES: { id: BrandMode; label: string; hint: string }[] = [
  { id: 'auto', label: 'Automatic', hint: 'Meridian until you set a name or logo, then your brand with a small credit.' },
  { id: 'own', label: 'My brand', hint: 'Your logo or name leads. The Meridian credit is optional.' },
  { id: 'cobrand', label: 'Meridian × my brand', hint: 'Both side by side. Reads as a partnership.' },
  { id: 'meridian', label: 'Meridian only', hint: 'The Meridian wordmark, with your contact line.' },
]

const MUTED = 'text-[#6a7266]'

function Preview({
  s, orgName, contactLine, mode, credit,
}: {
  s: ReportSettingsDto
  orgName: string
  contactLine: string
  mode: BrandMode
  credit: boolean
}) {
  const header = resolveHeader({ orgName, logoPath: s.logoPath, brandMode: mode })
  const name = orgName.trim() || PLACEHOLDER_ORG
  const mine = s.logoPath ? (
    <img
      src={`/api/v1/report-settings/logo?t=${s.updatedAt}`}
      alt={name}
      className="h-9 w-auto max-w-[8rem] object-contain"
    />
  ) : (
    <span className="text-sm font-semibold text-[#0b0f0a]">{name}</span>
  )
  const showName = header === 'meridian' && name !== PLACEHOLDER_ORG

  return (
    <div className="rounded-lg border border-border bg-white p-5 text-[#0b0f0a]">
      <div className="flex items-center justify-between gap-4 border-b border-[#e3e6dc] pb-3">
        <div className="flex items-center gap-3">
          {header === 'meridian' && <StaticWordmark className="text-2xl" />}
          {header === 'own' && mine}
          {header === 'cobrand' && (
            <>
              <StaticWordmark className="text-2xl" />
              <span className={`text-lg ${MUTED}`}>×</span>
              {mine}
            </>
          )}
        </div>
        <div className={`text-right text-xs ${MUTED}`}>
          {showName && <div className="font-medium text-[#0b0f0a]">{name}</div>}
          {contactLine.trim() || 'you@example.com'}
        </div>
      </div>
      <div className={`py-4 text-sm ${MUTED}`}>Website review · Example Hotel · sample header</div>
      <div className={`flex items-center gap-1.5 border-t border-[#e3e6dc] pt-2 text-[11px] ${MUTED}`}>
        {header === 'own' && credit ? (
          <>
            Analysis by <StaticWordmark className="text-xs" /> · every finding links to its evidence
          </>
        ) : (
          'Every finding links to its evidence'
        )}
      </div>
    </div>
  )
}

export function ReportSettingsPage() {
  const settings = useReportSettings()
  const save = useSaveReportSettings()
  const uploadLogo = useUploadReportLogo()
  const removeLogo = useRemoveReportLogo()

  const [orgName, setOrgName] = useState('')
  const [contactLine, setContactLine] = useState('')
  const [brandMode, setBrandMode] = useState<BrandMode>('auto')
  const [credit, setCredit] = useState(true)

  useEffect(() => {
    if (settings.data) {
      setOrgName(settings.data.orgName)
      setContactLine(settings.data.contactLine)
      setBrandMode(settings.data.brandMode)
      setCredit(settings.data.showMeridianCredit)
    }
  }, [settings.data])

  const s = settings.data
  const dirty =
    s &&
    (orgName !== s.orgName ||
      contactLine !== s.contactLine ||
      brandMode !== s.brandMode ||
      credit !== s.showMeridianCredit)
  const resolved = s ? resolveHeader({ orgName, logoPath: s.logoPath, brandMode }) : 'meridian'

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <div>
        <h1 className="text-lg font-medium">Report settings</h1>
        <p className="mt-1 text-sm text-muted">
          This name, contact line, logo and branding appear on every business-facing report. Internal reports always
          carry the Meridian brand.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
        <label className="block text-sm">
          <span className="text-muted">Name on the report</span>
          <input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder={PLACEHOLDER_ORG}
            maxLength={200}
            className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-line/60"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Contact line</span>
          <input
            value={contactLine}
            onChange={(e) => setContactLine(e.target.value)}
            placeholder="you@example.com · yourcompany.com"
            maxLength={300}
            className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-line/60"
          />
        </label>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <span className="text-sm text-muted">Logo</span>
        <div className="flex items-center gap-4">
          {s?.logoPath ? (
            <img
              src={`/api/v1/report-settings/logo?t=${s.updatedAt}`}
              alt="Report logo"
              className="h-16 w-16 rounded-md border border-border bg-white object-contain p-1"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-border text-muted">
              <ImageIcon size={20} />
            </div>
          )}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-border/40">
            <Upload size={14} />
            {s?.logoPath ? 'Replace logo' : 'Upload logo'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) uploadLogo.mutate(file)
                e.target.value = ''
              }}
            />
          </label>
          {s?.logoPath && (
            <button
              type="button"
              onClick={() => removeLogo.mutate()}
              className="inline-flex items-center gap-1 text-sm text-muted hover:text-danger"
            >
              <X size={14} /> Remove
            </button>
          )}
        </div>
        <p className="text-xs text-muted">PNG, JPG, WebP or SVG, up to 2 MB.</p>
        {(uploadLogo.isError || removeLogo.isError) && <p className="text-xs text-danger">That didn’t work. Try again.</p>}
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <span className="text-sm text-muted">Report header</span>
        <div className="space-y-2">
          {MODES.map((m) => (
            <label key={m.id} className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="radio"
                name="brandMode"
                checked={brandMode === m.id}
                onChange={() => setBrandMode(m.id)}
                className="mt-1"
              />
              <span>
                {m.label}
                <span className="block text-xs text-muted">{m.hint}</span>
              </span>
            </label>
          ))}
        </div>
        <label
          className={`flex items-center gap-2 text-sm ${resolved === 'own' ? '' : 'opacity-50'}`}
          title={resolved === 'own' ? undefined : 'The credit only applies when your brand leads the header'}
        >
          <input
            type="checkbox"
            checked={credit}
            disabled={resolved !== 'own'}
            onChange={(e) => setCredit(e.target.checked)}
          />
          Show “Analysis by Meridian” in the footer
        </label>
        {s && <Preview s={s} orgName={orgName} contactLine={contactLine} mode={brandMode} credit={credit} />}
        <p className="text-xs text-muted">This is how the top and bottom of a business-facing report will look.</p>
      </div>

      <button
        type="button"
        disabled={!dirty || save.isPending}
        onClick={() => save.mutate({ orgName, contactLine, brandMode, showMeridianCredit: credit })}
        className="rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-on-accent disabled:opacity-50"
      >
        {save.isPending ? 'Saving…' : 'Save'}
      </button>
      {save.isError && <p className="text-xs text-danger">Couldn’t save. Try again.</p>}
    </div>
  )
}