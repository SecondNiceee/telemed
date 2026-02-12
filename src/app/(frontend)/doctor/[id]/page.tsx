import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  fetchDoctorById,
  getDoctorPhotoUrl,
  getDoctorSpecialty,
  getDoctorEducation,
  getDoctorServices,
  getDoctorCategories,
  ApiError,
  getErrorMessage,
} from "@/lib/api";
import {
  ArrowLeft,
  Clock,
  GraduationCap,
  Video,
  Shield,
  Award,
  CheckCircle,
} from "lucide-react";

interface DoctorPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: DoctorPageProps) {
  const { id } = await params;

  try {
    const doctor = await fetchDoctorById(id);
    const specialty = getDoctorSpecialty(doctor);
    return {
      title: `${doctor.name} - smartcardio`,
      description: `Профиль врача ${doctor.name} - ${specialty}`,
    };
  } catch {
    return {
      title: "Врач - smartcardio",
      description: "Профиль врача",
    };
  }
}

export default async function DoctorPage({ params }: DoctorPageProps) {
  const { id } = await params;

  let doctor;
  let error: string | null = null;

  try {
    doctor = await fetchDoctorById(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    error = getErrorMessage(err);
  }

  if (error || !doctor) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center bg-background">
          <div className="text-center px-4">
            <p className="text-destructive text-lg mb-4">{error || "Врач не найден"}</p>
            <Button variant="outline" asChild className="border-primary text-primary hover:bg-primary/5 transition-all">
              <Link href="/#categories">На главную</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const photoUrl = getDoctorPhotoUrl(doctor);
  const specialty = getDoctorSpecialty(doctor);
  const education = getDoctorEducation(doctor);
  const services = getDoctorServices(doctor);
  const categories = getDoctorCategories(doctor);
  const firstCategorySlug = categories[0]?.slug;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link href={firstCategorySlug ? `/category/${firstCategorySlug}` : "/#categories"}>
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
                    src={photoUrl || "/placeholder.svg"}
                    alt={doctor.name || "Врач"}
                    className="w-full h-full object-cover absolute inset-0"
                  />
                </div>

                <div className="flex-1 p-6 text-center md:text-left flex flex-col justify-center">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-2">
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                        {doctor.name}
                      </h1>
                      <p className="text-lg text-primary">{specialty}</p>
                      {doctor.degree && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {doctor.degree}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-4">
                    {doctor.experience != null && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-5 h-5" />
                        <span>Стаж {doctor.experience} лет</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4 mt-6">
                    {doctor.price != null && (
                      <div>
                        <span className="text-2xl font-bold text-foreground">
                          {doctor.price.toLocaleString("ru-RU")} ₽
                        </span>
                        <span className="text-muted-foreground ml-2">
                          за консультацию
                        </span>
                      </div>
                    )}
                    <Button variant="outline" asChild size="lg" className="border-primary text-primary hover:bg-primary/5 transition-all">
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
          {doctor.bio && (
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
          )}

          {/* Education */}
          {education.length > 0 && (
            <Card className="mb-4">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-primary" />
                  Образование
                </h2>
                <ul className="space-y-3">
                  {education.map((edu, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{edu}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Services */}
          {services.length > 0 && (
            <Card className="mb-4">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  Услуги
                </h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {services.map((service, index) => (
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
          )}

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
          <Card className="border-2 border-primary/20 bg-primary/5">
            <CardContent className="p-6 text-center">
              <h3 className="text-xl font-semibold mb-2 text-foreground">
                Готовы записаться на прием?
              </h3>
              <p className="text-muted-foreground mb-4">
                Выберите удобную дату и время для консультации
              </p>
              <Button variant="outline" size="lg" asChild className="border-primary text-primary hover:bg-primary/5 transition-all">
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
