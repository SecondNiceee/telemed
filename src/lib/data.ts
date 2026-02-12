export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  degree: string;
  bio: string;
  education: string[];
  services: string[];
  categoryId: string;
  experience: number;
  rating: number;
  reviewsCount: number;
  price: number;
  photo: string;
  availableDates: string[];
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
  doctorsCount: number;
}

export const categories: Category[] = [
  {
    id: "therapist",
    name: "Терапевт",
    icon: "stethoscope",
    description: "Общая диагностика и лечение",
    doctorsCount: 24,
  },
  {
    id: "cardiologist",
    name: "Кардиолог",
    icon: "heart",
    description: "Заболевания сердца и сосудов",
    doctorsCount: 18,
  },
  {
    id: "neurologist",
    name: "Невролог",
    icon: "brain",
    description: "Нервная система и головные боли",
    doctorsCount: 15,
  },
  {
    id: "dermatologist",
    name: "Дерматолог",
    icon: "scan",
    description: "Кожные заболевания",
    doctorsCount: 12,
  },
  {
    id: "pediatrician",
    name: "Педиатр",
    icon: "baby",
    description: "Здоровье детей",
    doctorsCount: 20,
  },
  {
    id: "psychologist",
    name: "Психолог",
    icon: "brain",
    description: "Психологическая помощь",
    doctorsCount: 22,
  },
];

// Generate available dates for the next 30 days
function generateAvailableDates(): string[] {
  const dates: string[] = [];
  const today = new Date();
  
  for (let i = 1; i <= 30; i++) {
    // Random availability (about 60% of days available)
    if (Math.random() > 0.4) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
  }
  
  return dates;
}

export const doctors: Doctor[] = [
  {
    id: "1",
    name: "Иванова Мария Петровна",
    specialty: "Терапевт",
    degree: "Кандидат медицинских наук",
    bio: "Специализируюсь на диагностике и лечении заболеваний внутренних органов. Особое внимание уделяю профилактике и раннему выявлению патологий. Владею современными методами диагностики.",
    education: ["Первый МГМУ им. И.М. Сеченова, 2009", "Ординатура по терапии, 2011", "Защита кандидатской диссертации, 2015"],
    services: ["Первичная консультация", "Расшифровка анализов", "Составление плана лечения", "Профилактический осмотр"],
    categoryId: "therapist",
    experience: 15,
    rating: 4.9,
    reviewsCount: 234,
    price: 2500,
    photo: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=400&fit=crop&crop=face",
    availableDates: generateAvailableDates(),
  },
  {
    id: "2",
    name: "Петров Алексей Сергеевич",
    specialty: "Терапевт",
    degree: "Врач высшей категории",
    bio: "Более 12 лет практикую в области терапии. Специализируюсь на лечении респираторных заболеваний и патологий ЖКТ. Индивидуальный подход к каждому пациенту.",
    education: ["РНИМУ им. Н.И. Пирогова, 2012", "Ординатура по терапии, 2014", "Повышение квалификации по гастроэнтерологии, 2020"],
    services: ["Консультация терапевта", "Диагностика заболеваний", "Назначение лечения", "Выписка рецептов"],
    categoryId: "therapist",
    experience: 12,
    rating: 4.8,
    reviewsCount: 189,
    price: 2200,
    photo: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop&crop=face",
    availableDates: generateAvailableDates(),
  },
  {
    id: "3",
    name: "Сидорова Елена Владимировна",
    specialty: "Кардиолог",
    degree: "Доктор медицинских наук",
    bio: "Ведущий специалист в области кардиологии с 20-летним опытом. Занимаюсь диагностикой и лечением ишемической болезни сердца, аритмий, артериальной гипертензии.",
    education: ["Первый МГМУ им. И.М. Сеченова, 2004", "Докторантура по кардиологии, 2012", "Стажировка в Германии, 2016"],
    services: ["ЭКГ расшифровка", "Лечение гипертонии", "Профилактика инфаркта", "Реабилитация после операций"],
    categoryId: "cardiologist",
    experience: 20,
    rating: 4.95,
    reviewsCount: 312,
    price: 3500,
    photo: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400&h=400&fit=crop&crop=face",
    availableDates: generateAvailableDates(),
  },
  {
    id: "4",
    name: "Козлов Дмитрий Андреевич",
    specialty: "Кардиолог",
    degree: "Кандидат медицинских наук",
    bio: "Кардиолог с большим опытом работы в стационаре и амбулаторной практике. Специализируюсь на нарушениях ритма сердца и сердечной недостаточности.",
    education: ["РНИМУ им. Н.И. Пирогова, 2006", "Ординатура по кардиологии, 2008", "Кандидатская диссертация, 2013"],
    services: ["Диагностика аритмий", "Подбор терапии", "Холтер-мониторинг", "Консультация по результатам обследований"],
    categoryId: "cardiologist",
    experience: 18,
    rating: 4.85,
    reviewsCount: 256,
    price: 3200,
    photo: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400&h=400&fit=crop&crop=face",
    availableDates: generateAvailableDates(),
  },
  {
    id: "5",
    name: "Новикова Анна Игоревна",
    specialty: "Невролог",
    degree: "Врач первой категории",
    bio: "Занимаюсь лечением головных болей, мигреней, заболеваний позвоночника. Применяю комплексный подход с использованием медикаментозных и немедикаментозных методов.",
    education: ["Казанский ГМУ, 2010", "Ординатура по неврологии, 2012", "Курсы по мануальной терапии, 2018"],
    services: ["Лечение головной боли", "Терапия остеохондроза", "Лечение невралгии", "Реабилитация после инсульта"],
    categoryId: "neurologist",
    experience: 14,
    rating: 4.7,
    reviewsCount: 178,
    price: 2800,
    photo: "https://images.unsplash.com/photo-1651008376811-b90baee60c1f?w=400&h=400&fit=crop&crop=face",
    availableDates: generateAvailableDates(),
  },
  {
    id: "6",
    name: "Морозов Игорь Валентинович",
    specialty: "Невролог",
    degree: "Доктор медицинских наук, профессор",
    bio: "Профессор, автор более 50 научных публикаций. Специализируюсь на сложных неврологических случаях, эпилепсии, болезни Паркинсона и рассеянном склерозе.",
    education: ["Первый МГМУ им. И.М. Сеченова, 2002", "Докторская диссертация, 2014", "Профессор кафедры неврологии, 2019"],
    services: ["Диагностика эпилепсии", "Лечение болезни Паркинсона", "Терапия рассеянного склероза", "Второе мнение"],
    categoryId: "neurologist",
    experience: 22,
    rating: 4.92,
    reviewsCount: 389,
    price: 3800,
    photo: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&h=400&fit=crop&crop=face",
    availableDates: generateAvailableDates(),
  },
  {
    id: "7",
    name: "Волкова Ольга Николаевна",
    specialty: "Дерматолог",
    degree: "Кандидат медицинских наук",
    bio: "Дерматолог-косметолог с опытом работы в ведущих клиниках. Лечу акне, экзему, псориаз. Провожу консультации по уходу за кожей и anti-age терапии.",
    education: ["РНИМУ им. Н.И. Пирогова, 2013", "Ординатура по дерматовенерологии, 2015", "Курсы косметологии, 2017"],
    services: ["Лечение акне", "Терапия псориаза", "Диагностика родинок", "Подбор уходовых средств"],
    categoryId: "dermatologist",
    experience: 11,
    rating: 4.75,
    reviewsCount: 145,
    price: 2600,
    photo: "https://images.unsplash.com/photo-1527613426441-4da17471b66d?w=400&h=400&fit=crop&crop=face",
    availableDates: generateAvailableDates(),
  },
  {
    id: "8",
    name: "Соколов Артем Викторович",
    specialty: "Педиатр",
    degree: "Врач высшей категории",
    bio: "Детский врач с большим опытом работы. Наблюдаю детей с рождения до 18 лет. Особое внимание уделяю профилактике заболеваний и вакцинации.",
    education: ["Первый МГМУ им. И.М. Сеченова, 2008", "Ординатура по педиатрии, 2010", "Курсы по неонатологии, 2015"],
    services: ["Осмотр ребенка", "Консультация по вакцинации", "Лечение ОРВИ", "Наблюдение за развитием"],
    categoryId: "pediatrician",
    experience: 16,
    rating: 4.88,
    reviewsCount: 267,
    price: 2400,
    photo: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=400&h=400&fit=crop&crop=face",
    availableDates: generateAvailableDates(),
  },
  {
    id: "9",
    name: "Лебедева Татьяна Сергеевна",
    specialty: "Психолог",
    degree: "Кандидат психологических наук",
    bio: "Клинический психолог, работаю с тревожными расстройствами, депрессией, проблемами в отношениях. Использую когнитивно-поведенческую терапию.",
    education: ["МГУ им. М.В. Ломоносова, 2011", "Кандидатская диссертация, 2016", "Сертификация КПТ, 2018"],
    services: ["Индивидуальная терапия", "Работа с тревогой", "Семейное консультирование", "Коучинг"],
    categoryId: "psychologist",
    experience: 13,
    rating: 4.82,
    reviewsCount: 198,
    price: 3000,
    photo: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=face",
    availableDates: generateAvailableDates(),
  },
  {
    id: "10",
    name: "Кузнецов Павел Александрович",
    specialty: "Психолог",
    degree: "Доктор психологических наук",
    bio: "Профессор психологии, автор методик по работе со стрессом. Специализируюсь на кризисных состояниях, профессиональном выгорании и психосоматике.",
    education: ["СПбГУ, 2005", "Докторская диссертация, 2015", "Международная сертификация, 2020"],
    services: ["Кризисная помощь", "Терапия выгорания", "Работа с психосоматикой", "Супервизия"],
    categoryId: "psychologist",
    experience: 19,
    rating: 4.9,
    reviewsCount: 345,
    price: 3500,
    photo: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=400&h=400&fit=crop&crop=face",
    availableDates: generateAvailableDates(),
  },
];

export function getDoctorsByCategory(categoryId: string): Doctor[] {
  return doctors.filter((doctor) => doctor.categoryId === categoryId);
}

export function getDoctorById(id: string): Doctor | undefined {
  return doctors.find((doctor) => doctor.id === id);
}

export function getCategoryById(id: string): Category | undefined {
  return categories.find((category) => category.id === id);
}
