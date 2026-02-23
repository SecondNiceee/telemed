"use client";

import { useState, useMemo } from "react";
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
} from "lucide-react";
import { resolveImageUrl } from "@/lib/utils/image";
import { AppointmentsApi } from "@/lib/api/appointments";
import { useUserStore } from "@/stores/user-store";
import { LoginModal } from "@/components/login-modal";
import type { DoctorScheduleDate } from "@/lib/api/types";

interface BookingClientProps {
  doctorId: number;
  doctorName: string;
  doctorPhoto: string | null;
  doctorSpecialty: string;
  doctorPrice: number;
  schedule: DoctorScheduleDate[];
}

export function BookingClient({
  doctorId,
  doctorName,
  doctorPhoto,
  doctorSpecialty,
  doctorPrice,
  schedule: initialSchedule,
}: BookingClientProps) {
  const { user, fetchUser } = useUserStore();

  // Local mutable schedule state (slots get removed on booking)
  const [schedule, setSchedule] = useState<DoctorScheduleDate[]>(initialSchedule);

  // Set of available date strings from real schedule
  const availableDates = useMemo(() => {
    return new Set(schedule.filter((s) => s.slots && s.slots.length > 0).map((s) => s.date));
  }, [schedule]);

  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.setDate(diff));
  });

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isBooked, setIsBooked] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Time slots for the selected date from real schedule
  const availableTimeSlots = useMemo(() => {
    if (!selectedDate) return [];
    const dateEntry = schedule.find((s) => s.date === selectedDate);
    if (!dateEntry || !dateEntry.slots) return [];
    return dateEntry.slots.map((s) => s.time).sort();
  }, [selectedDate, schedule]);

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      days.push(date);
    }
    return days;
  }, [currentWeekStart]);

  const isDateAvailable = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today && availableDates.has(dateStr);
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
      setSelectedDate(date.toISOString().split("T")[0]);
      setSelectedTime(null);
      setBookingError(null);
    }
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setBookingError(null);
  };

  const handleBooking = async () => {
    if (!selectedDate || !selectedTime) return;

    setIsBooking(true);
    setBookingError(null);

    try {
      await AppointmentsApi.book(doctorId, selectedDate, selectedTime);

      // Remove the booked slot from local state
      setSchedule((prev) => {
        const updated = prev.map((s) => {
          if (s.date === selectedDate) {
            return {
              ...s,
              slots: (s.slots || []).filter((slot) => slot.time !== selectedTime),
            };
          }
          return s;
        }).filter((s) => s.slots && s.slots.length > 0);
        return updated;
      });

      setIsBooked(true);
    } catch (err: any) {
      setBookingError(err?.message || "Ошибка при создании записи");
    } finally {
      setIsBooking(false);
    }
  };

  // Success state
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
                  new Date(selectedDate).toLocaleDateString("ru-RU", {
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

          {/* Doctor Info Header */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                  <img
                    src={resolveImageUrl(doctorPhoto)}
                    alt={doctorName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h1 className="text-xl font-bold text-foreground">
                    Запись к врачу
                  </h1>
                  <p className="text-primary font-medium">{doctorName}</p>
                  <p className="text-sm text-muted-foreground">
                    {doctorSpecialty} · {doctorPrice.toLocaleString("ru-RU")} ₽
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* No schedule available */}
          {schedule.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Нет доступных слотов
                </h3>
                <p className="text-muted-foreground text-sm">
                  К сожалению, у врача сейчас нет доступного расписания для записи.
                  Попробуйте позже.
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
                    const dateStr = date.toISOString().split("T")[0];
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
                        {new Date(selectedDate).toLocaleDateString("ru-RU", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}
                      </span>
                    </div>

                    {availableTimeSlots.length > 0 ? (
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                        {availableTimeSlots.map((time) => {
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
                      <div className="text-center py-6 text-muted-foreground">
                        <p>Все слоты на эту дату заняты</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Выберите дату для просмотра доступного времени</p>
                  </div>
                )}

                {/* Booking Error */}
                {bookingError && (
                  <div className="mt-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
                    {bookingError}
                  </div>
                )}

                {/* Booking Button */}
                {selectedDate && selectedTime && (
                  <div className="mt-6 pt-6 border-t border-border">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="text-center sm:text-left">
                        <p className="text-sm text-muted-foreground">
                          Выбранное время:
                        </p>
                        <p className="font-semibold text-foreground">
                          {new Date(selectedDate).toLocaleDateString("ru-RU", {
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
                          disabled={isBooking}
                          className="border-primary text-primary hover:bg-primary/5 transition-all px-8"
                        >
                          {isBooking ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Записываем...
                            </>
                          ) : (
                            <>Подтвердить запись · {doctorPrice.toLocaleString("ru-RU")} ₽</>
                          )}
                        </Button>
                      ) : (
                        <LoginModal onSuccess={() => fetchUser()}>
                          <Button
                            variant="outline"
                            size="lg"
                            className="border-primary text-primary hover:bg-primary/5 transition-all px-8"
                          >
                            <LogIn className="w-4 h-4 mr-2" />
                            Войти для записи
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
