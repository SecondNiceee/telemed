"use client";

import { useEffect } from "react";
import { useUserStore } from "@/stores/user-store";

/**
 * Монтируется один раз в корне приложения.
 * Фетчит /api/users/me и кладёт пользователя в Zustand-стор.
 */
export function AppInit() {
  const fetchUser = useUserStore((s) => s.fetchUser);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return null;
}
