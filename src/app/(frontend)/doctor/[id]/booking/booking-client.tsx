"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Check,
  Clock,
  Calendar,
  Loader2,
  LogIn,
  GraduationCap,
} from "lucide-react";
import { resolveImageUrl } from "@/lib/utils/image";
import { useUserStore } from "@/stores/user-store";
import { useUserAppointmentStore } from "@/stores/user-appointments-store";
import { LoginModal } from "@/components/login-modal";
import type { DoctorScheduleDate } from "@/lib/api/types";

interface BookingClientProps {
  doctorId: number;
  doctorName: string;
  doctorPhoto: string | null;
  doctorSpecialty: string;
  doctorPrice: number;
  doctorExperience: number | null;
  doctorDegree: string | null;
  doctorBio: string | null;
  doctorEducation: string[];
  doctorServices: string[];
  doctorEmail: string;
  schedule: DoctorScheduleDate[];
}

export function BookingClient({
  doctorId,
  doctorName,
  doctorPhoto,
  doctorSpecialty,
  doctorPrice,
  doctorExperience,
  doctorDegree,
  doctorBio,
  doctorEducation,
  doctorServices,
  doctorEmail,
  schedule,
}: BookingClientProps) {
  const { user, fetchUser } = useUserStore();
  const { createAppointment, creating } = useUserAppointmentStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Build a map of date -> available time slots from doctor's schedule
  const scheduleMap = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!schedule) return map;
    for (const dayEntry of schedule) {
      if (dayEntry.date && dayEntry.slots && dayEntry.slots.length > 0) {
        const times = dayEntry.slots
          .map((s) => s.time)
          .filter(Boolean)
          .sort();
        if (times.length > 0) {
          map.set(dayEntry.date, times);
        }
      }
    }
    return map;
  }, [schedule]);

  const availableDates = useMemo(() => Array.from(scheduleMap.keys()).sort(), [scheduleMap]);

  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    // Start from the week of the first available date, or current week
    if (availableDates.length > 0) {
      const first = new Date(availableDates[0] + "T00:00:00");
      const day = first.getDay();
      const diff = first.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(first.getFullYear(), first.getMonth(), diff);
    }
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.getFullYear(), today.getMonth(), diff);
  });

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isBooked, setIsBooked] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      days.push(date);
    }
    return days;
  }, [currentWeekStart]);

  const timeSlots = useMemo(() => {
    if (!selectedDate) return [];
    return scheduleMap.get(selectedDate) || [];
  }, [selectedDate, scheduleMap]);

  const isDateAvailable = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today && scheduleMap.has(dateStr);
  };

  const toDateStr = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const formatDayName = (date: Date) =>
    date.toLocaleDateString("ru-RU", { weekday: "short" });

  const formatDayNumber = (date: Date) => date.getDate();

  const formatMonthYear = () => {
    const firstDay = weekDays[0];
    const lastDay = weekDays[6];
    if (firstDay.getMonth() === lastDay.getMonth()) {
      return firstDay.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
    }
    return `${firstDay.toLocaleDateString("ru-RU", { month: "short" })} - ${lastDay.toLocaleDateString("ru-RU", { month: "short", year: "numeric" })}`;
  };

  const goToPreviousWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(newStart);
    setSelectedDate(null);
    setSelectedTime(null);
  };

  const goToNextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(newStart);
    setSelectedDate(null);
    setSelectedTime(null);
  };

  const handleDateSelect = (date: Date) => {
    if (isDateAvailable(date)) {
      setSelectedDate(toDateStr(date));
      setSelectedTime(null);
      setBookingError(null);
    }
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setBookingError(null);
  };

  const handleBooking = async () => {
    if (!user) return;
    if (!selectedDate || !selectedTime) return;

    setBookingError(null);

    try {
      await createAppointment({
        doctor: doctorId,
        user: user.id,
        doctorName,
        userName: user.name || user.email,
        specialty: doctorSpecialty,
        date: selectedDate,
        time: selectedTime,
        price: doctorPrice,
        // Pass full doctor data so the store has all info immediately
        doctorData: {
          id: doctorId,
          email: doctorEmail,
          name: doctorName,
          price: doctorPrice,
          experience: doctorExperience,
          degree: doctorDegree,
          bio: doctorBio,
        },
      });
      setIsBooked(true);
    } catch (err) {
      setBookingError(
        err instanceof Error ? err.message : "Произошла ошибка при записи"
      );
    }
  };

  if (isBooked) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 bg-background flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Запись подтверждена!
              </h2>
              <p className="text-muted-foreground mb-6">
                Вы записаны к врачу {doctorName} на{" "}
                {selectedDate &&
                  new Date(selectedDate + "T00:00:00").toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                  })}{" "}
                в {selectedTime}
              </p>
              <div className="flex flex-col gap-3">
                <Button variant="outline" asChild className="w-full border-primary text-primary hover:bg-primary/5 transition-all">
                  <Link href="/lk">Мои записи</Link>
                </Button>
                <Button variant="outline" asChild className="w-full bg-transparent">
                  <Link href={`/doctor/${doctorId}`}>Профиль врача</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const hasNoSchedule = availableDates.length === 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Button variant="ghost" size="sm" asChild className="mb-6">
            <Link href={`/doctor/${doctorId}`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад к профилю врача
            </Link>
          </Button>

          {/* Doctor Profile Card */}
          <Card className="mb-6 py-0 px-0 overflow-hidden">
            <CardContent className="py-0 px-0">
              <div className="flex flex-col md:flex-row md:items-stretch">
                <div className="w-full md:w-72 h-64 md:h-auto flex-shrink-0 relative">
                  <img
                    src={resolveImageUrl(doctorPhoto)}
                    alt={doctorName}
                    className="w-full h-full object-cover absolute inset-0"
                  />
                </div>
                <div className="flex-1 px-6 py-6 flex flex-col justify-center">
                  <p className="text-sm text-muted-foreground mb-1">Запись к врачу</p>
                  <h1 className="text-2xl font-bold text-foreground mb-1">{doctorName}</h1>
                  <p className="text-lg text-primary mb-2">{doctorSpecialty}</p>
                  {doctorEducation.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <GraduationCap className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      {doctorEducation.map((edu, i) => (
                        <span key={i} className="px-2 py-0.5 bg-secondary/60 rounded-full text-xs text-muted-foreground">{edu}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-col gap-1 text-sm mb-3">
                    {doctorExperience != null && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Стаж:</span>
                        <span className="font-medium text-foreground">{doctorExperience} лет</span>
                      </div>
                    )}
                    {doctorDegree && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Степень:</span>
                        <span className="font-medium text-foreground">{doctorDegree}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Цена:</span>
                      <span className="font-medium text-foreground">{doctorPrice.toLocaleString("ru-RU")} ₽</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {hasNoSchedule ? (
            <Card>
              <CardContent className="p-12 flex flex-col items-center justify-center text-center">
                <Calendar className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Нет доступных слотов
                </h3>
                <p className="text-muted-foreground text-sm max-w-sm leading-relaxed">
                  У врача пока нет открытых слотов для записи. Попробуйте позже
                  или выберите другого специалиста.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6">
                {/* Week Navigation */}
                <div className="flex items-center justify-between mb-6">
                  <Button variant="ghost" size="icon" onClick={goToPreviousWeek}>
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <h2 className="text-lg font-semibold text-foreground capitalize">
                    {formatMonthYear()}
                  </h2>
                  <Button variant="ghost" size="icon" onClick={goToNextWeek}>
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>

                {/* Days Row */}
                <div className="grid grid-cols-7 gap-2 mb-6">
                  {weekDays.map((date) => {
                    const dateStr = toDateStr(date);
                    const available = isDateAvailable(date);
                    const selected = selectedDate === dateStr;

                    return (
                      <button
                        key={dateStr}
                        onClick={() => handleDateSelect(date)}
                        disabled={!available}
                        className={`
                          flex flex-col items-center p-3 rounded-xl transition-all
                          ${
                            selected
                              ? "bg-primary text-primary-foreground"
                              : available
                                ? "bg-secondary hover:bg-primary/10 text-foreground"
                                : "bg-muted/50 text-muted-foreground cursor-not-allowed"
                          }
                        `}
                      >
                        <span className="text-xs uppercase mb-1">
                          {formatDayName(date)}
                        </span>
                        <span className="text-lg font-semibold">
                          {formatDayNumber(date)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Time Slots */}
                {selectedDate ? (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Calendar className="w-5 h-5 text-primary" />
                      <span className="font-medium text-foreground">
                        {new Date(selectedDate + "T00:00:00").toLocaleDateString("ru-RU", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}
                      </span>
                    </div>

                    {timeSlots.length > 0 ? (
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                        {timeSlots.map((time) => {
                          const isSelected = selectedTime === time;

                          return (
                            <button
                              key={time}
                              onClick={() => handleTimeSelect(time)}
                              className={`
                                p-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1
                                ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-primary/10 text-foreground hover:bg-primary/20"
                                }
                              `}
                            >
                              <Clock className="w-3 h-3" />
                              {time}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-center py-6 text-muted-foreground">
                        На ��ту дату нет свободных слотов
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Выберите дату для просмотра доступного времени</p>
                  </div>
                )}

                {/* Booking Button */}
                {selectedDate && selectedTime && (
                  <div className="mt-6 pt-6 border-t border-border">
                    {bookingError && (
                      <p className="text-sm text-destructive text-center mb-4">
                        {bookingError}
                      </p>
                    )}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="text-center sm:text-left">
                        <p className="text-sm text-muted-foreground">
                          Выбранное время:
                        </p>
                        <p className="font-semibold text-foreground">
                          {new Date(selectedDate + "T00:00:00").toLocaleDateString("ru-RU", {
                            day: "numeric",
                            month: "long",
                          })}{" "}
                          в {selectedTime}
                        </p>
                      </div>

                      {user ? (
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={handleBooking}
                          disabled={creating}
                          className="border-primary text-primary hover:bg-primary/5 transition-all px-8"
                        >
                          {creating ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Запись...
                            </>
                          ) : (
                            <>
                              Подтвердить запись · {doctorPrice.toLocaleString("ru-RU")} ₽
                            </>
                          )}
                        </Button>
                      ) : (
                        <LoginModal>
                          <Button
                            variant="outline"
                            size="lg"
                            className="border-primary text-primary hover:bg-primary/5 transition-all px-8"
                          >
                            <LogIn className="w-4 h-4 mr-2" />
                            Войти и записаться
                          </Button>
                        </LoginModal>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
