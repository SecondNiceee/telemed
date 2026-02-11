import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getDoctorById, getCategoryById, doctors } from "@/lib/data";
import {
  ArrowLeft,
  Star,
  Clock,
  GraduationCap,
  MessageSquare,
  Video,
  Shield,
  Award,
  CheckCircle,
} from "lucide-react";

interface DoctorPageProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return doctors.map((doctor) => ({
    id: doctor.id,
  }));
}

export async function generateMetadata({ params }: DoctorPageProps) {
  const { id } = await params;
  const doctor = getDoctorById(id);

  return {
    title: doctor ? `${doctor.name} - МедОнлайн` : "Врач не найден",
    description: doctor
      ? `Профиль врача ${doctor.name} - ${doctor.specialty}`
      : "Профиль врача",
  };
}

export default async function DoctorPage({ params }: DoctorPageProps) {
  const { id } = await params;
  const doctor = getDoctorById(id);

  if (!doctor) {
    notFound();
  }

  const category = getCategoryById(doctor.categoryId);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link href={`/category/${doctor.categoryId}`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад к списку врачей
            </Link>
          </Button>

          {/* Doctor Header */}
          <Card className="mb-4 overflow-hidden">
            <CardContent className="p-0">
              <div className="flex flex-col md:flex-row md:items-stretch">
                <div className="w-full md:w-80 h-72 md:h-auto flex-shrink-0 relative">
                  <img
                    src={doctor.photo || "/placeholder.svg"}
                    alt={doctor.name}
                    className="w-full h-full object-cover absolute inset-0"
                  />
                </div>

                <div className="flex-1 p-6 text-center md:text-left flex flex-col justify-center">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-2">
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                        {doctor.name}
                      </h1>
                      <p className="text-lg text-primary">{doctor.specialty}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {doctor.degree}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 bg-accent/10 px-3 py-1.5 rounded-lg mx-auto md:mx-0">
                      <Star className="w-5 h-5 text-accent fill-accent" />
                      <span className="text-lg font-semibold text-foreground">
                        {doctor.rating}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-5 h-5" />
                      <span>Стаж {doctor.experience} лет</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MessageSquare className="w-5 h-5" />
                      <span>{doctor.reviewsCount} отзывов</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4 mt-6">
                    <div>
                      <span className="text-2xl font-bold text-foreground">
                        {doctor.price.toLocaleString("ru-RU")} ₽
                      </span>
                      <span className="text-muted-foreground ml-2">
                        за консультацию
                      </span>
                    </div>
                    <Button asChild size="lg">
                      <Link href={`/doctor/${doctor.id}/booking`}>
                        Записаться на прием
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* About */}
          <Card className="mb-4">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                О враче
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {doctor.bio}
              </p>
            </CardContent>
          </Card>

          {/* Education */}
          <Card className="mb-4">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-primary" />
                Образование
              </h2>
              <ul className="space-y-3">
                {doctor.education.map((edu, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{edu}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Services */}
          <Card className="mb-4">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                Услуги
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {doctor.services.map((service, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg"
                  >
                    <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-foreground">{service}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <div className="grid sm:grid-cols-3 gap-3 mb-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Video className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Видеоконсультация</p>
                  <p className="text-sm text-muted-foreground">HD качество</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Конфиденциально</p>
                  <p className="text-sm text-muted-foreground">Защита данных</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Award className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Сертифицирован</p>
                  <p className="text-sm text-muted-foreground">Все лицензии</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* CTA */}
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="p-6 text-center">
              <h3 className="text-xl font-semibold mb-2">
                Готовы записаться на прием?
              </h3>
              <p className="opacity-90 mb-4">
                Выберите удобную дату и время для консультации
              </p>
              <Button variant="secondary" size="lg" asChild>
                <Link href={`/doctor/${doctor.id}/booking`}>
                  Выбрать время
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
