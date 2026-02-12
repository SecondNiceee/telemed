"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface BookingCalendarProps {
  availableDates: string[];
  doctorName: string;
  price: number;
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
];

export function BookingCalendar({
  availableDates,
  doctorName,
  price,
}: BookingCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isBooked, setIsBooked] = useState(false);

  const availableDateSet = useMemo(
    () => new Set(availableDates),
    [availableDates]
  );

  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];

    // Add empty slots for days before the first day of the month
    for (let i = 0; i < (firstDay.getDay() || 7) - 1; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  }, [currentDate]);

  const monthNames = [
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь",
  ];

  const dayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  const handlePrevMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)
    );
    setSelectedDate(null);
    setSelectedTime(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1)
    );
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (isBooked) {
    return (
      <Card className="border-accent">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-accent" />
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
          <p className="text-sm text-muted-foreground">
            Ссылка на видеоконсультацию будет отправлена на вашу почту
          </p>
          <Button
            className="mt-6 bg-transparent"
            variant="outline"
            onClick={() => setIsBooked(false)}
          >
            Записаться ещё раз
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">Выберите дату и время</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Calendar Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h3 className="text-lg font-semibold">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h3>
          <Button variant="ghost" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Day Names */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {dayNames.map((day) => (
            <div
              key={day}
              className="text-sm font-medium text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {daysInMonth.map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} className="p-2" />;
            }

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
                  "p-2 text-sm rounded-lg transition-all",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50",
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold"
                    : isAvailable && !isPast
                      ? "bg-accent/10 text-foreground hover:bg-accent/20 cursor-pointer"
                      : "text-muted-foreground/50 cursor-not-allowed"
                )}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-accent/10" />
            <span className="text-muted-foreground">Доступно</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-primary" />
            <span className="text-muted-foreground">Выбрано</span>
          </div>
        </div>

        {/* Time Slots */}
        {selectedDate && (
          <div className="space-y-3 pt-4 border-t border-border">
            <h4 className="font-medium text-foreground">Доступное время:</h4>
            <div className="grid grid-cols-4 gap-2">
              {timeSlots.map((time) => (
                <Button
                  key={time}
                  variant={selectedTime === time ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedTime(time)}
                  className="text-sm"
                >
                  {time}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Booking Button */}
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
      </CardContent>
    </Card>
  );
}
