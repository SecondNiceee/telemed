"use client"

import { useEffect, useMemo, useState } from "react"
import { Pencil, Plus, Search, Stethoscope, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CategoryIcon } from "@/lib/utils/categoryIcon"
import type { ApiCategory } from "@/lib/api/types"

interface CategoryDraft {
  name: string
  slug: string
  description: string
  icon: string
}

const emptyDraft: CategoryDraft = { name: "", slug: "", description: "", icon: "" }

function makeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9а-яё-]/gi, "")
}

export function AdminCategories({ initialCategories }: { initialCategories: ApiCategory[] }) {
  const [categories, setCategories] = useState(initialCategories)
  const [query, setQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ApiCategory | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ApiCategory | null>(null)
  const [draft, setDraft] = useState<CategoryDraft>(emptyDraft)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => setCategories(initialCategories), [initialCategories])

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return categories
    return categories.filter((category) =>
      `${category.name} ${category.slug} ${category.description || ""}`
        .toLowerCase()
        .includes(normalized),
    )
  }, [categories, query])

  const openCreate = () => {
    setEditing(null)
    setDraft(emptyDraft)
    setDialogOpen(true)
  }

  const openEdit = (category: ApiCategory) => {
    setEditing(category)
    setDraft({
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      icon: category.icon || "",
    })
    setDialogOpen(true)
  }

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const slug = draft.slug.trim() || makeSlug(draft.name)
    if (draft.name.trim().length < 2 || !slug) {
      toast.error("Укажите название и URL-слаг специальности")
      return
    }

    setSaving(true)
    try {
      const response = await fetch(
        editing ? `/api/admin/categories/${editing.id}` : "/api/admin/categories",
        {
          method: editing ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...draft, slug }),
        },
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data?.message || "Не удалось сохранить специальность")

      setCategories((current) => {
        const next = editing
          ? current.map((category) => (category.id === data.id ? data : category))
          : [...current, data]
        return next.sort((a, b) => a.name.localeCompare(b.name, "ru"))
      })
      toast.success(editing ? "Специальность обновлена" : "Специальность создана")
      setDialogOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить специальность")
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const response = await fetch(`/api/admin/categories/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.message || "Не удалось удалить специальность")
      setCategories((current) => current.filter((category) => category.id !== deleteTarget.id))
      setDeleteTarget(null)
      toast.success("Специальность удалена")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить специальность")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="border-t border-border py-10" aria-labelledby="categories-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="categories-heading" className="text-2xl font-semibold tracking-tight text-foreground">
            Специальности
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Создавайте категории, которые организации смогут назначать врачам. Всего: {categories.length}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus data-icon="inline-start" />
          Добавить специальность
        </Button>
      </div>

      {categories.length > 1 && (
        <div className="relative mt-6 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск специальности"
            aria-label="Поиск специальностей"
            className="pl-9"
          />
        </div>
      )}

      <div className="mt-8">
        {categories.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-14 text-center">
            <Stethoscope className="text-muted-foreground" aria-hidden="true" />
            <p className="max-w-sm text-sm text-muted-foreground">
              Специальностей пока нет. Создайте первую, чтобы организации могли назначать её врачам.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">По вашему запросу ничего не найдено.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {visible.map((category) => (
              <li key={category.id} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <CategoryIcon category={category} className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-card-foreground">{category.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{category.slug}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(category)}>
                    <Pencil />
                    <span className="sr-only">Редактировать {category.name}</span>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(category)} className="text-destructive hover:text-destructive">
                    <Trash2 />
                    <span className="sr-only">Удалить {category.name}</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Редактировать специальность" : "Новая специальность"}</DialogTitle>
            <DialogDescription>
              Организации увидят эту специальность в форме создания и редактирования врача.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-category-name">Название</Label>
              <Input
                id="admin-category-name"
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                minLength={2}
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-category-slug">URL-слаг</Label>
              <Input
                id="admin-category-slug"
                value={draft.slug}
                onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))}
                placeholder={makeSlug(draft.name) || "cardiologist"}
              />
              <p className="text-xs text-muted-foreground">Если оставить пустым, сформируется из названия.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-category-description">Описание</Label>
              <textarea
                id="admin-category-description"
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                rows={3}
                className="min-h-20 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-category-icon">Иконка Lucide</Label>
              <Input
                id="admin-category-icon"
                value={draft.icon}
                onChange={(event) => setDraft((current) => ({ ...current, icon: event.target.value }))}
                placeholder="stethoscope, heart, brain"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Отмена</Button>
              <Button type="submit" disabled={saving}>{saving ? "Сохранение..." : "Сохранить"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !deleting && !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить специальность?</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleteTarget?.name}» будет удалена навсегда. Если к ней привязаны врачи, сервер запретит удаление.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={remove} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Удаление..." : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
