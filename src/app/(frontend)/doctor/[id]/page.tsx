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
  type ApiDoctor,
} from "@/lib/api/index";
import {
  ArrowLeft,
  GraduationCap,
  Video,
  Shield,
  Award,
  CheckCircle,
} from "lucide-react";
import { getBasePath } from "@/lib/basePath";

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

  let doctor: ApiDoctor | null = null;
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
          <Card className="mb-2 overflow-hidden">
            <CardContent className="py-0">
              <div className="flex flex-col py-0 md:flex-row md:items-stretch">
                <div className="w-full md:w-80 h-72 md:h-auto flex-shrink-0 relative">
                  <img
                    src={photoUrl || `${getBasePath()}/placeholder.svg`}
                    alt={doctor.name || "Врач"}
                    className="w-full h-full object-cover absolute inset-0"
                  />
                </div>

                <div className="flex-1 px-6 py-1 text-center md:text-left flex flex-col justify-center">
                  <div className="mb-1">
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                      {doctor.name}
                    </h1>
                    <p className="text-lg text-primary">{specialty}</p>
                  </div>

                  <div className="flex flex-col gap-1 text-sm mb-4">
                    {doctor.experience != null && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-base">Стаж:</span>
                        <span className="font-medium text-foreground text-base">{doctor.experience} лет</span>
                      </div>
                    )}
                    {doctor.degree && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-base">Степень:</span>
                        <span className="font-medium text-foreground text-base">{doctor.degree}</span>
                      </div>
                    )}
                    {doctor.price != null && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-base">Цена:</span>
                        <span className="font-medium text-foreground text-base">{doctor.price.toLocaleString("ru-RU")} ₽</span>
                      </div>
                    )}
                  </div>

                  <Button variant="outline" asChild size="lg" className="border-primary text-primary hover:bg-primary/5 transition-all w-fit">
                    <Link href={`/doctor/${doctor.id}/booking`}>
                      Записаться на прием
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* About */}
          {doctor.bio && (
            <Card className="mb-2">
              <CardContent className="px-6 py-0">
                <h2 className="text-lg font-semibold text-foreground mb-0.5">
                  О враче :
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {doctor.bio}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Education */}
          {education.length > 0 && (
            <Card className="mb-2">
              <CardContent className="px-6 py-0 flex flex-row gap-4 items-center">
                <h2 className="text-lg font-semibold text-foreground mb-0.5 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-primary" />
                  Образование :
                </h2>
                <div className="flex flex-wrap gap-2">
                  {education.map((edu, index) => (
                    <div key={index} className="flex items-center gap-1.5 px-3 py-1 bg-secondary/50 rounded-full text-sm">
                      <span className="text-muted-foreground">{edu}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Services */}
          {services.length > 0 && (
            <Card className="mb-2">
              <CardContent className="px-6 flex flex-col py-0">
                <h2 className="text-lg font-semibold text-foreground mb-3">
                  Услуги :
                </h2>
                <div className="grid sm:grid-cols-2 gap-1.5">
                  {services.map((service, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-3 py-2 bg-secondary/50 rounded-lg"
                    >
                      <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-foreground text-sm">{service}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Features */}
          <div className="grid sm:grid-cols-3 gap-1.5 mb-2">
            <Card>
              <CardContent className="px-3 py-0 flex items-center gap-2">
                <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center flex-shrink-0">
                  <Video className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground leading-tight">Видеоконсультация</p>
                  <p className="text-xs text-muted-foreground leading-tight">HD качество</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="px-3 py-0 flex items-center gap-2">
                <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground leading-tight">Конфиденциально</p>
                  <p className="text-xs text-muted-foreground leading-tight">Защита данных</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="px-3 py-0 flex items-center gap-2">
                <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center flex-shrink-0">
                  <Award className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground leading-tight">Сертифицирован</p>
                  <p className="text-xs text-muted-foreground leading-tight">Все лицензии</p>
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
