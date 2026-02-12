"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getDoctorById } from "@/lib/data";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Check,
  Clock,
  Calendar,
} from "lucide-react";

const timeSlots = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
];

// Generate busy slots randomly for demo
function generateBusySlots(date: string): string[] {
  const busy: string[] = [];
  const seed = date.split("-").reduce((a, b) => a + parseInt(b), 0);
  timeSlots.forEach((slot, index) => {
    if ((seed + index) % 3 === 0) {
      busy.push(slot);
    }
  });
  return busy;
}

export default function BookingPage() {
  const params = useParams();
  const router = useRouter();
  const doctor = getDoctorById(params.id as string);

  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.setDate(diff));
  });

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isBooked, setIsBooked] = useState(false);

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      days.push(date);
    }
    return days;
  }, [currentWeekStart]);

  const busySlots = useMemo(() => {
    if (!selectedDate) return [];
    return generateBusySlots(selectedDate);
  }, [selectedDate]);

  const isDateAvailable = (date: Date) => {
    if (!doctor) return false;
    const dateStr = date.toISOString().split("T")[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today && doctor.availableDates.includes(dateStr);
  };

  const formatDayName = (date: Date) => {
    return date.toLocaleDateString("ru-RU", { weekday: "short" });
  };

  const formatDayNumber = (date: Date) => {
    return date.getDate();
  };

  const formatMonthYear = () => {
    const firstDay = weekDays[0];
    const lastDay = weekDays[6];
    if (firstDay.getMonth() === lastDay.getMonth()) {
      return firstDay.toLocaleDateString("ru-RU", {
        month: "long",
        year: "numeric",
      });
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
    }
  };

  const handleTimeSelect = (time: string) => {
    if (!busySlots.includes(time)) {
      setSelectedTime(time);
    }
  };

  const handleBooking = () => {
    setIsBooked(true);
  };

  if (!doctor) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Врач не найден</p>
        </main>
        <Footer />
      </div>
    );
  }

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
                Вы записаны к врачу {doctor.name} на{" "}
                {selectedDate &&
                  new Date(selectedDate).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                  })}{" "}
                в {selectedTime}
              </p>
              <div className="space-y-3">
                <Button variant="outline" asChild className="w-full border-primary text-primary hover:bg-primary/5 transition-all">
                  <Link href="/">На главную</Link>
                </Button>
                <Button variant="outline" asChild className="w-full bg-transparent">
                  <Link href={`/doctor/${doctor.id}`}>Профиль врача</Link>
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
            <Link href={`/doctor/${doctor.id}`}>
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
                    src={doctor.photo || "/placeholder.svg"}
                    alt={doctor.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h1 className="text-xl font-bold text-foreground">
                    Запись к врачу
                  </h1>
                  <p className="text-primary font-medium">{doctor.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {doctor.specialty} · {doctor.price.toLocaleString("ru-RU")} ₽
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Calendar */}
          <Card>
            <CardContent className="p-6">
              {/* Week Navigation */}
              <div className="flex items-center justify-between mb-6">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToPreviousWeek}
                >
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

                  <div className="flex items-center gap-4 mb-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-primary/10 border border-primary/30" />
                      <span className="text-muted-foreground">Свободно</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-destructive/10 border border-destructive/30" />
                      <span className="text-muted-foreground">Занято</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {timeSlots.map((time) => {
                      const isBusy = busySlots.includes(time);
                      const isSelected = selectedTime === time;

                      return (
                        <button
                          key={time}
                          onClick={() => handleTimeSelect(time)}
                          disabled={isBusy}
                          className={`
                            p-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1
                            ${
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : isBusy
                                  ? "bg-destructive/10 text-destructive/50 line-through cursor-not-allowed"
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
                    <Button variant="outline" size="lg" onClick={handleBooking} className="border-primary text-primary hover:bg-primary/5 transition-all px-8">
                      Подтвердить запись · {doctor.price.toLocaleString("ru-RU")}{" "}
                      ₽
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
