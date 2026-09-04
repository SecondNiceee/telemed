'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface SupportIntakeFormProps {
  isBusy: boolean
  onSubmit: (input: {
    name: string
    contact: string
    consent: boolean
    text: string
  }) => Promise<boolean>
}

/**
 * Форма первого обращения.
 *
 * Контакт обязателен намеренно: ответ приходит в открытую вкладку, но если
 * посетитель её закроет, без телефона или email вопрос останется без ответа.
 */
export function SupportIntakeForm({ isBusy, onSubmit }: SupportIntakeFormProps) {
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [text, setText] = useState('')
  const [consent, setConsent] = useState(false)

  const canSubmit =
    name.trim().length > 0 && contact.trim().length > 0 && text.trim().length > 0 && consent

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit || isBusy) return
    await onSubmit({ name, contact, consent, text })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="support-name">Как вас зовут</Label>
        <Input
          id="support-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Имя"
          autoComplete="name"
          maxLength={80}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="support-contact">Телефон или email</Label>
        <Input
          id="support-contact"
          value={contact}
          onChange={(event) => setContact(event.target.value)}
          placeholder="+7 900 000 00 00"
          autoComplete="tel"
          maxLength={100}
          required
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Нужен, чтобы ответить, если вы закроете страницу.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="support-question">Вопрос</Label>
        <textarea
          id="support-question"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          maxLength={5000}
          required
          placeholder="Опишите, чем помочь"
          className="flex w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
        />
      </div>

      {/* Предупреждение стоит до кнопки отправки, а не после: после него его
          прочитают уже задав вопрос, и смысла в нём не будет. */}
      <p className="rounded-md bg-secondary px-3 py-2 text-xs leading-relaxed text-secondary-foreground">
        Это не медицинская консультация. Не описывайте симптомы и диагнозы — вопросы о
        здоровье задайте врачу на приёме.
      </p>

      <label className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-primary"
          required
        />
        <span>
          Даю согласие на обработку имени и контакта для ответа на обращение. Ознакомлен с{' '}
          <a
            href="/legal/consent"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            текстом согласия
          </a>
          ,{' '}
          <a
            href="/legal/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            политикой обработки данных
          </a>{' '}
          и{' '}
          <a
            href="/legal/offer"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            публичной офертой
          </a>
          .
        </span>
      </label>

      <Button type="submit" disabled={!canSubmit || isBusy} className="w-full">
        {isBusy ? 'Отправляем…' : 'Отправить вопрос'}
      </Button>
    </form>
  )
}
