/**
 * Трекинг истории навигации внутри приложения.
 *
 * Браузер не даёт прочитать записи history, поэтому мы ведём собственный стек
 * посещённых URL в sessionStorage и привязываем к каждой записи history её
 * индекс через history.state.__navIdx. Это позволяет кнопке «Назад» понимать,
 * что именно лежит на предыдущих шагах, и «перескакивать» те страницы, которые
 * по логике сайта находятся *вперёд* (например /doctor/{id} при возврате
 * на /category/{slug}).
 */

const STACK_KEY = "smartcardio:nav-stack";
const INDEX_KEY = "smartcardio:nav-index";
const IDX_STATE_KEY = "__navIdx";

type NavState = Record<string, unknown> & { [IDX_STATE_KEY]?: number };

export interface NavHistory {
  /** Стек посещённых URL, индекс в массиве === индекс записи в history. */
  stack: string[];
  /** Индекс текущей записи в стеке. */
  index: number;
}

const isBrowser = () => typeof window !== "undefined";

function readStack(): string[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.sessionStorage.getItem(STACK_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function readIndex(): number {
  if (!isBrowser()) return -1;
  const raw = window.sessionStorage.getItem(INDEX_KEY);
  const parsed = raw === null ? Number.NaN : Number(raw);
  return Number.isInteger(parsed) ? parsed : -1;
}

function persist(stack: string[], index: number) {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(STACK_KEY, JSON.stringify(stack));
    window.sessionStorage.setItem(INDEX_KEY, String(index));
  } catch {
    // sessionStorage может быть недоступен (приватный режим) — тогда просто
    // деградируем до обычного history.back().
  }
}

/**
 * Сохраняем индекс записи в history.state, не ломая внутреннее состояние Next.js
 * (спред сохраняет служебные ключи роутера).
 */
function writeIndexToHistoryState(index: number) {
  if (!isBrowser()) return;
  try {
    const current = (window.history.state ?? {}) as NavState;
    window.history.replaceState({ ...current, [IDX_STATE_KEY]: index }, "");
  } catch {
    // ignore
  }
}

function readIndexFromHistoryState(): number | null {
  if (!isBrowser()) return null;
  const state = window.history.state as NavState | null;
  const idx = state?.[IDX_STATE_KEY];
  return typeof idx === "number" && Number.isInteger(idx) ? idx : null;
}

/**
 * Регистрирует текущий URL в стеке. Вызывается на каждой смене маршрута.
 *
 * - если у записи history уже есть индекс — значит это возврат/переход вперёд
 *   по существующей записи, просто синхронизируем позицию;
 * - если индекса нет — это новая запись: обрезаем «хвост» вперёд и добавляем URL.
 */
export function recordNavigation(url: string): NavHistory {
  if (!isBrowser()) return { stack: [], index: -1 };

  const stack = readStack();
  const knownIndex = readIndexFromHistoryState();

  if (knownIndex !== null && knownIndex >= 0) {
    stack[knownIndex] = url;
    persist(stack, knownIndex);
    return { stack, index: knownIndex };
  }

  const nextIndex = Math.max(readIndex(), -1) + 1;
  const nextStack = stack.slice(0, nextIndex);
  nextStack[nextIndex] = url;

  persist(nextStack, nextIndex);
  writeIndexToHistoryState(nextIndex);

  return { stack: nextStack, index: nextIndex };
}

export function getNavHistory(): NavHistory {
  const stack = readStack();
  const stateIndex = readIndexFromHistoryState();
  const index = stateIndex !== null ? stateIndex : readIndex();
  return { stack, index };
}

/** Убирает query/hash, оставляя только путь. */
export function toPath(url: string): string {
  return url.split("#")[0].split("?")[0];
}

/**
 * Считает, на сколько шагов назад нужно уйти, пропуская записи, для которых
 * shouldSkip вернул true. Возвращает отрицательное число (delta для history.go)
 * либо null, если подходящей записи в истории нет.
 */
export function resolveBackDelta(
  shouldSkip: (entry: { url: string; path: string }) => boolean,
): number | null {
  const { stack, index } = getNavHistory();

  if (index <= 0 || stack.length === 0) return null;

  let target = index - 1;
  while (target >= 0) {
    const url = stack[target];
    if (!url || shouldSkip({ url, path: toPath(url) })) {
      target -= 1;
      continue;
    }
    return target - index;
  }

  return null;
}
