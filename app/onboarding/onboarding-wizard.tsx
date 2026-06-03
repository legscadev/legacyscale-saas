'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  Rocket,
  Target,
  Users,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { BrandMark } from '@/components/layout/brand-mark'
import { AvatarUpload } from '@/components/profile/avatar-upload'
import { updateProfileName } from '@/lib/actions/profile'
import { PasswordStep } from './password-step'

const STEPS = ['Welcome', 'Password', 'Your profile', 'Your goal', 'All set'] as const

const GOALS = [
  { id: 'first-client', label: 'Land my first client', icon: Target },
  { id: 'scale-10k', label: 'Scale to $10k/mo', icon: Rocket },
  { id: 'build-team', label: 'Build a team', icon: Users },
  { id: 'systemize', label: 'Systemize delivery', icon: Briefcase },
] as const

interface OnboardingWizardProps {
  token: string
  firstName: string | null
  authId: string
}

export function OnboardingWizard({
  token,
  firstName,
  authId,
}: OnboardingWizardProps) {
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [name, setName] = useState(firstName ?? '')
  const [goal, setGoal] = useState<string | null>(null)
  const [redirectTo, setRedirectTo] = useState<string | null>(null)
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  const progress = ((step + 1) / STEPS.length) * 100
  const isLast = step === STEPS.length - 1
  // Step 1 is the password step — once it succeeds the account exists and
  // we don't let the user navigate back into the form.
  const isPostAuth = step >= 2

  const go = (next: number) => {
    setDirection(next > step ? 1 : -1)
    setStep(next)
  }

  const handlePasswordSuccess = (target: string) => {
    setRedirectTo(target)
    setDirection(1)
    setStep(2)
  }

  const handleNext = async () => {
    if (step === 2) {
      const trimmed = name.trim()
      if (!trimmed) {
        setNameError('Name is required')
        return
      }
      if (trimmed !== (firstName ?? '')) {
        setSavingName(true)
        setNameError(null)
        const formData = new FormData()
        formData.append('name', trimmed)
        const result = await updateProfileName(formData)
        setSavingName(false)
        if (!result.success) {
          setNameError(result.error)
          return
        }
      }
    }
    go(step + 1)
  }

  const handleFinish = () => {
    // Hard navigation so the new session cookie is picked up by the
    // server-rendered shell.
    window.location.href = redirectTo ?? '/dashboard'
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[22rem_1fr]">
      <BrandPanel currentStep={step} />

      <main className="flex flex-col">
        <div className="border-b px-6 py-4">
          <Progress value={progress} />
        </div>

        <div className="flex flex-1 items-center justify-center overflow-hidden p-6">
          <div className="w-full max-w-md">
            <div
              key={step}
              className={cn(
                'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300',
                direction >= 0
                  ? 'motion-safe:slide-in-from-right-6'
                  : 'motion-safe:slide-in-from-left-6',
              )}
            >
              {step === 0 ? <WelcomeStep onStart={() => go(1)} /> : null}
              {step === 1 ? (
                <PasswordStep token={token} onSuccess={handlePasswordSuccess} />
              ) : null}
              {step === 2 ? (
                <ProfileStep
                  name={name}
                  onName={(value) => {
                    setName(value)
                    if (nameError) setNameError(null)
                  }}
                  authId={authId}
                  error={nameError}
                />
              ) : null}
              {step === 3 ? <GoalStep selected={goal} onSelect={setGoal} /> : null}
              {step === 4 ? (
                <DoneStep name={name} goal={goal} onFinish={handleFinish} />
              ) : null}
            </div>

            {isPostAuth && !isLast ? (
              <div className="mt-8 flex items-center justify-between">
                {step > 2 ? (
                  <Button
                    variant="ghost"
                    onClick={() => go(step - 1)}
                    disabled={savingName}
                  >
                    <ArrowLeft />
                    Back
                  </Button>
                ) : (
                  <span />
                )}
                <Button onClick={handleNext} disabled={savingName}>
                  {savingName ? 'Saving…' : 'Next'}
                  {!savingName && <ArrowRight />}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  )
}

function BrandPanel({ currentStep }: { currentStep: number }) {
  return (
    <aside
      className="hidden flex-col justify-between bg-gradient-to-br
        from-brand-500 to-brand-700 p-10 text-white lg:flex"
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex size-8 items-center justify-center rounded-lg
            bg-white/15 ring-1 ring-inset ring-white/20"
        >
          <span className="text-sm font-bold tracking-tight">LS</span>
        </div>
        <span className="text-sm font-semibold tracking-tight">
          Legacy Scale
        </span>
      </div>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Let&apos;s set you up.
        </h2>
        <p className="mt-2 text-sm text-white/70">
          A few quick steps to personalize your experience.
        </p>

        <ol className="mt-8 space-y-1">
          {STEPS.map((label, i) => (
            <StepRow
              key={label}
              label={label}
              index={i}
              currentStep={currentStep}
            />
          ))}
        </ol>
      </div>

      <p className="text-xs text-white/50">
        Step {currentStep + 1} of {STEPS.length}
      </p>
    </aside>
  )
}

interface StepRowProps {
  label: string
  index: number
  currentStep: number
}

function StepRow({ label, index, currentStep }: StepRowProps) {
  const isActive = index === currentStep
  const isDone = index < currentStep

  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
        isActive ? 'bg-white/15' : 'opacity-60',
      )}
    >
      <span
        className={cn(
          'flex size-6 items-center justify-center rounded-full text-xs',
          'font-semibold ring-1 ring-inset ring-white/30',
          isDone || isActive ? 'bg-white/20' : 'bg-transparent',
        )}
      >
        {isDone ? <Check className="size-3.5" /> : index + 1}
      </span>
      <span className="text-sm font-medium">{label}</span>
    </li>
  )
}

function WelcomeStep({ onStart }: { onStart: () => void }) {
  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <BrandMark />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome to Legacy Scale
        </h1>
        <p className="text-sm text-muted-foreground">
          You&apos;re moments away from the playbooks, community, and systems
          that scale agencies to seven figures. Let&apos;s personalize your
          journey.
        </p>
      </div>
      <Button className="w-full" onClick={onStart}>
        Get started
        <ArrowRight />
      </Button>
    </div>
  )
}

interface ProfileStepProps {
  name: string
  onName: (value: string) => void
  authId: string
  error: string | null
}

function ProfileStep({ name, onName, authId, error }: ProfileStepProps) {
  const fallback = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Your profile</h1>
        <p className="text-sm text-muted-foreground">
          Tell us a bit about yourself so we can tailor your dashboard.
        </p>
      </div>

      <AvatarUpload
        authId={authId}
        initialAvatarUrl={null}
        fallbackText={fallback}
      />

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          placeholder="Jane Doe"
          value={name}
          onChange={(e) => onName(e.target.value)}
          aria-invalid={!!error}
        />
        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

interface GoalStepProps {
  selected: string | null
  onSelect: (id: string) => void
}

function GoalStep({ selected, onSelect }: GoalStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Your goal</h1>
        <p className="text-sm text-muted-foreground">
          What are you focused on right now? We&apos;ll recommend a path.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {GOALS.map((g) => {
          const isSelected = selected === g.id
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => onSelect(g.id)}
              className={cn(
                'flex flex-col items-start gap-3 rounded-xl border p-4',
                'text-left transition-all hover:bg-muted active:scale-[0.97]',
                isSelected
                  ? 'border-primary bg-primary/10 ring-2 ring-primary'
                  : 'border-border',
              )}
            >
              <span
                className={cn(
                  'flex size-9 items-center justify-center rounded-lg',
                  isSelected
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                <g.icon className="size-4" />
              </span>
              <span className="text-sm font-medium">{g.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface DoneStepProps {
  name: string
  goal: string | null
  onFinish: () => void
}

function DoneStep({ name, goal, onFinish }: DoneStepProps) {
  const goalLabel = GOALS.find((g) => g.id === goal)?.label
  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <span
          className="flex size-14 items-center justify-center rounded-full
            bg-success/10 text-success motion-safe:animate-in
            motion-safe:zoom-in-50 motion-safe:duration-500"
        >
          <Check className="size-7" />
        </span>
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          You&apos;re all set
        </h1>
        <p className="text-sm text-muted-foreground">
          {name.trim() ? `Welcome aboard, ${name.trim()}. ` : 'Welcome aboard. '}
          {goalLabel
            ? `We've tailored your dashboard to help you ${goalLabel.toLowerCase()}.`
            : 'Your personalized dashboard is ready.'}
        </p>
      </div>
      <Button className="w-full" size="lg" onClick={onFinish}>
        Go to dashboard
        <ArrowRight />
      </Button>
    </div>
  )
}
