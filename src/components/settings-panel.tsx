"use client"

import { useState, type ReactNode } from "react"
import { ArchiveIcon, ArrowRightIcon, FolderIcon, FolderOpenIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  clamp,
  FORMATS,
  isOutputFormat,
  LONG_EDGE_PRESETS,
  MAX_LONG_EDGE,
  MIN_LONG_EDGE,
  OUTPUT_FORMATS,
  outputFileName,
  sanitizePrefix,
  strengthBand,
  strengthSummary,
  type OptimizeSettings,
} from "@/lib/optimize"
import { cn } from "@/lib/utils"

type SettingsPanelProps = {
  settings: OptimizeSettings
  onChange: (patch: Partial<OptimizeSettings>) => void
  disabled: boolean
  /** null until the browser check has run. */
  canPickFolder: boolean | null
  folderName: string | null
  onChooseFolder: () => void
  /** A real file name for the output name preview. */
  sampleName: string
  /** The run button and progress, rendered in the footer. */
  children: ReactNode
  className?: string
}

export function SettingsPanel({
  settings,
  onChange,
  disabled,
  canPickFolder,
  folderName,
  onChooseFolder,
  sampleName,
  children,
  className,
}: SettingsPanelProps) {
  return (
    <Card className={cn("gap-0 py-0", className)}>
      <CardHeader className="border-b py-4">
        <CardTitle>Settings</CardTitle>
        <CardDescription>Applied to every image in the list.</CardDescription>
      </CardHeader>

      <CardContent className="grid gap-6 py-5">
        <Section title="Save to">
          {canPickFolder === false ? (
            <Alert>
              <ArchiveIcon />
              <AlertTitle>Downloads as a .zip</AlertTitle>
              <AlertDescription>
                This browser can&apos;t save into a folder. Open the app in Chrome,
                Edge, Arc or Brave to pick one.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Button
                variant="outline"
                className="h-9 w-full justify-start gap-2.5 px-3"
                onClick={onChooseFolder}
                disabled={disabled || canPickFolder === null}
              >
                {folderName ? (
                  <FolderOpenIcon />
                ) : (
                  <FolderIcon className="text-muted-foreground" />
                )}
                <span className={cn("truncate", !folderName && "text-muted-foreground")}>
                  {folderName ?? "Choose a folder…"}
                </span>
                {folderName && (
                  <span className="ml-auto text-xs text-muted-foreground">Change</span>
                )}
              </Button>
              {!folderName && (
                <p className="text-xs text-muted-foreground">
                  If you skip this, you&apos;ll be asked when you optimize.
                </p>
              )}
            </>
          )}
        </Section>

        <Section title="Format" id="format-label">
          <ToggleGroup
            aria-labelledby="format-label"
            variant="outline"
            spacing={0}
            className="w-full"
            value={[settings.format]}
            onValueChange={(value) => {
              // Clicking the active option yields [], so keep the current format.
              if (isOutputFormat(value[0])) onChange({ format: value[0] })
            }}
            disabled={disabled}
          >
            {OUTPUT_FORMATS.map((format) => (
              <ToggleGroupItem
                key={format}
                value={format}
                className="h-9 flex-1 text-muted-foreground aria-pressed:text-foreground"
              >
                {FORMATS[format].label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="text-xs text-muted-foreground">{FORMATS[settings.format].hint}</p>
        </Section>

        <Section title="Filename prefix" htmlFor="prefix">
          <Input
            id="prefix"
            value={settings.prefix}
            placeholder="e.g. web-"
            spellCheck={false}
            autoComplete="off"
            disabled={disabled}
            onChange={(event) => onChange({ prefix: sanitizePrefix(event.target.value) })}
            className="h-9 font-mono"
          />
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowRightIcon className="size-3 shrink-0" />
            <span className="truncate font-mono">
              {outputFileName(sampleName, settings.prefix, settings.format)}
            </span>
          </p>
        </Section>

        <Section
          title="Optimization strength"
          id="strength-label"
          aside={
            <span className="font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums">
              <span className="text-foreground">{strengthBand(settings.strength)}</span>
              {" · "}
              {strengthSummary(settings.format, settings.strength)}
            </span>
          }
        >
          <Slider
            aria-labelledby="strength-label"
            value={[settings.strength]}
            min={0}
            max={100}
            step={1}
            disabled={disabled}
            onValueChange={(value) =>
              onChange({ strength: typeof value === "number" ? value : value[0] })
            }
            className="py-1.5"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Better quality</span>
            <span>Smaller files</span>
          </div>
        </Section>

        <Section
          title="Resize"
          id="resize-label"
          aside={
            <Switch
              aria-labelledby="resize-label"
              checked={settings.resize}
              onCheckedChange={(checked) => onChange({ resize: checked })}
              disabled={disabled}
            />
          }
        >
          {settings.resize ? (
            <LongEdgeControls
              longEdge={settings.longEdge}
              onChange={(longEdge) => onChange({ longEdge })}
              disabled={disabled}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Off. Images keep their original dimensions.
            </p>
          )}
        </Section>
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-3">{children}</CardFooter>
    </Card>
  )
}

function Section({
  title,
  id,
  htmlFor,
  aside,
  children,
}: {
  title: string
  id?: string
  htmlFor?: string
  aside?: ReactNode
  children: ReactNode
}) {
  const headingClass =
    "text-xs font-medium tracking-wider whitespace-nowrap text-muted-foreground uppercase"
  return (
    <section className="grid gap-2.5">
      {/* Wraps the aside onto its own line rather than squeezing it on narrow screens. */}
      <div className="flex min-h-5 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className={headingClass}>
            {title}
          </Label>
        ) : (
          <h3 id={id} className={headingClass}>
            {title}
          </h3>
        )}
        {aside}
      </div>
      {children}
    </section>
  )
}

function LongEdgeControls({
  longEdge,
  onChange,
  disabled,
}: {
  longEdge: number
  onChange: (longEdge: number) => void
  disabled: boolean
}) {
  // Holds what's typed so the field can be briefly empty or out of range mid-edit.
  const [draft, setDraft] = useState(String(longEdge))

  function commit(value: number) {
    const next = clamp(Math.round(value), MIN_LONG_EDGE, MAX_LONG_EDGE)
    setDraft(String(next))
    onChange(next)
  }

  return (
    <div className="grid gap-3 duration-200 animate-in fade-in-0 slide-in-from-top-1">
      <div className="flex items-center gap-3">
        <Label htmlFor="long-edge" className="font-normal text-muted-foreground">
          Long edge
        </Label>
        <div className="relative ml-auto w-28">
          <Input
            id="long-edge"
            type="number"
            inputMode="numeric"
            min={MIN_LONG_EDGE}
            max={MAX_LONG_EDGE}
            step={1}
            value={draft}
            disabled={disabled}
            onChange={(event) => {
              setDraft(event.target.value)
              const value = Number(event.target.value)
              if (Number.isInteger(value) && value >= MIN_LONG_EDGE && value <= MAX_LONG_EDGE) {
                onChange(value)
              }
            }}
            onBlur={() => commit(Number(draft) || longEdge)}
            className="h-8 [appearance:textfield] pr-8 text-right font-mono tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">
            px
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {LONG_EDGE_PRESETS.map((preset) => (
          <Button
            key={preset}
            size="xs"
            variant={preset === longEdge ? "secondary" : "ghost"}
            className={cn(
              "flex-1 font-mono tabular-nums",
              preset !== longEdge && "text-muted-foreground"
            )}
            disabled={disabled}
            onClick={() => commit(preset)}
          >
            {preset}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <OrientationHint orientation="landscape" longEdge={longEdge} />
        <OrientationHint orientation="portrait" longEdge={longEdge} />
      </div>
      <p className="text-xs text-muted-foreground">
        Keeps the aspect ratio. Smaller images are never upscaled.
      </p>
    </div>
  )
}

function OrientationHint({
  orientation,
  longEdge,
}: {
  orientation: "landscape" | "portrait"
  longEdge: number
}) {
  const landscape = orientation === "landscape"
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-muted/50 px-2.5 py-2 ring-1 ring-foreground/5">
      <div className="flex size-7 shrink-0 items-center justify-center">
        <div
          className={cn(
            "rounded-[3px] border-[1.5px] border-foreground/40 bg-foreground/10",
            landscape
              ? "h-4.5 w-6.5 border-b-foreground"
              : "h-6.5 w-4.5 border-r-foreground"
          )}
        />
      </div>
      <div className="min-w-0 leading-tight">
        <p className="text-xs font-medium">{landscape ? "Landscape" : "Portrait"}</p>
        <p className="truncate font-mono text-[11px] text-muted-foreground tabular-nums">
          {longEdge} px {landscape ? "wide" : "tall"}
        </p>
      </div>
    </div>
  )
}
