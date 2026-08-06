"use client";

import { useEffect } from "react";
import { useUserStore } from "@/stores/user-store";
import { useUserAppointmentStore } from "@/stores/user-appointments-store";

/**
 * Монтируется один раз в корне приложения.
 * Фетчит /api/users/me и кладёт пользователя в Zustand-стор.
 * Также загружает консультации пользователя, если он авторизован.
 */
export function AppInit() {
  const fetchUser = useUserStore((s) => s.fetchUser);
  const user = useUserStore((s) => s.user);
  const fetched = useUserStore((s) => s.fetched);
  const fetchAppointments = useUserAppointmentStore((s) => s.fetchAppointments);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Загружаем консультации после того как пользователь загружен
  useEffect(() => {
    if (fetched && user) {
      fetchAppointments();
    }
  }, [fetched, user, fetchAppointments]);

  return null;
}
