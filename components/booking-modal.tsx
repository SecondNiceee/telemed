"use client";

import React from "react"

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BookingModalProps {
  availableDates: string[];
  doctorName: string;
  price: number;
  children: React.ReactNode;
}

const timeSlots = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];

// Simulate some busy time slots
const busySlots: Record<string, string[]> = {};

export function BookingModal({
  availableDates,
  doctorName,
  price,
  children,
}: BookingModalProps) {
  const [open, setOpen] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.setDate(diff));
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isBooked, setIsBooked] = useState(false);

  const availableDateSet = useMemo(
    () => new Set(availableDates),
    [availableDates]
  );

  // Generate busy slots randomly for each available date
  useMemo(() => {
    availableDates.forEach((date) => {
      if (!busySlots[date]) {
        const busy: string[] = [];
        timeSlots.forEach((slot) => {
          if (Math.random() > 0.6) {
            busy.push(slot);
          }
        });
        busySlots[date] = busy;
      }
    });
  }, [availableDates]);

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(currentWeekStart);
      day.setDate(currentWeekStart.getDate() + i);
      days.push(day);
    }
    return days;
  }, [currentWeekStart]);

  const dayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const monthNames = [
    "Января", "Февраля", "Марта", "Апреля", "Мая", "Июня",
    "Июля", "Августа", "Сентября", "Октября", "Ноября", "Декабря",
  ];

  const handlePrevWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(newStart);
    setSelectedDate(null);
    setSelectedTime(null);
  };

  const handleNextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(newStart);
    setSelectedDate(null);
    setSelectedTime(null);
  };

  const handleDateClick = (date: Date) => {
    const dateString = date.toISOString().split("T")[0];
    if (availableDateSet.has(dateString)) {
      setSelectedDate(dateString);
      setSelectedTime(null);
    }
  };

  const handleBooking = () => {
    if (selectedDate && selectedTime) {
      setIsBooked(true);
    }
  };

  const handleReset = () => {
    setIsBooked(false);
    setSelectedDate(null);
    setSelectedTime(null);
    setOpen(false);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getWeekRangeText = () => {
    const endOfWeek = new Date(currentWeekStart);
    endOfWeek.setDate(currentWeekStart.getDate() + 6);
    return `${currentWeekStart.getDate()} ${monthNames[currentWeekStart.getMonth()]} - ${endOfWeek.getDate()} ${monthNames[endOfWeek.getMonth()]}`;
  };

  if (isBooked) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-2">
              Запись подтверждена!
            </h3>
            <p className="text-muted-foreground mb-4">
              Вы записаны к врачу {doctorName} на{" "}
              {new Date(selectedDate!).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              в {selectedTime}
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Ссылка на видеоконсультацию будет отправлена на вашу почту
            </p>
            <Button onClick={handleReset}>Закрыть</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b border-border">
          <DialogTitle className="text-xl">
            Запись к врачу: {doctorName}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Week Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevWeek}
              className="bg-transparent"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <span className="text-sm font-medium text-foreground">
              {getWeekRangeText()}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextWeek}
              className="bg-transparent"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Days Row */}
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day, index) => {
              const dateString = day.toISOString().split("T")[0];
              const isAvailable = availableDateSet.has(dateString);
              const isSelected = selectedDate === dateString;
              const isPast = day < today;

              return (
                <button
                  key={dateString}
                  type="button"
                  onClick={() => handleDateClick(day)}
                  disabled={!isAvailable || isPast}
                  className={cn(
                    "flex flex-col items-center p-2 rounded-lg transition-all",
                    "focus:outline-none focus:ring-2 focus:ring-primary/50",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : isAvailable && !isPast
                        ? "bg-secondary hover:bg-secondary/80 cursor-pointer text-foreground"
                        : "bg-muted/50 text-muted-foreground/50 cursor-not-allowed"
                  )}
                >
                  <span className="text-xs font-medium">{dayNames[index]}</span>
                  <span className="text-lg font-bold">{day.getDate()}</span>
                </button>
              );
            })}
          </div>

          {/* Time Slots */}
          {selectedDate ? (
            <div className="space-y-3">
              <h4 className="font-medium text-foreground text-sm">
                Выберите время на{" "}
                {new Date(selectedDate).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                })}
                :
              </h4>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {timeSlots.map((time) => {
                  const isBusy = busySlots[selectedDate]?.includes(time);
                  const isSelectedTime = selectedTime === time;

                  return (
                    <button
                      key={time}
                      type="button"
                      onClick={() => !isBusy && setSelectedTime(time)}
                      disabled={isBusy}
                      className={cn(
                        "py-2 px-3 rounded-lg text-sm font-medium transition-all",
                        "focus:outline-none focus:ring-2 focus:ring-primary/50",
                        isSelectedTime
                          ? "bg-primary text-primary-foreground"
                          : isBusy
                            ? "bg-destructive/10 text-destructive/50 cursor-not-allowed line-through"
                            : "bg-primary/10 text-foreground hover:bg-primary/20 cursor-pointer"
                      )}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-xs pt-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-primary/10" />
                  <span className="text-muted-foreground">Свободно</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-destructive/10" />
                  <span className="text-muted-foreground">Занято</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-primary" />
                  <span className="text-muted-foreground">Выбрано</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Выберите дату для просмотра доступного времени
            </div>
          )}

          {/* Booking Summary */}
          {selectedDate && selectedTime && (
            <div className="pt-4 border-t border-border space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Итого к оплате:</p>
                  <p className="text-2xl font-bold text-foreground">
                    {price.toLocaleString("ru-RU")} ₽
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Дата и время:</p>
                  <p className="font-medium text-foreground">
                    {new Date(selectedDate).toLocaleDateString("ru-RU", {
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    в {selectedTime}
                  </p>
                </div>
              </div>
              <Button className="w-full" size="lg" onClick={handleBooking}>
                Подтвердить запись
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
