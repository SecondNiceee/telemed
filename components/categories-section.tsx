import Link from "next/link";
import { categories } from "@/lib/data";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

export function CategoriesSection() {
  return (
    <section id="categories" className="py-10 sm:py-14 bg-background relative overflow-visible">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            Выберите специалиста
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Найдите нужного врача по специализации и запишитесь на удобное время
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <Link key={category.id} href={`/category/${category.id}`}>
              <Card className="group h-full hover:shadow-lg transition-all duration-300 hover:border-primary/50 cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                        {category.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        {category.description}
                      </p>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {category.doctorsCount}
                        </span>
                        <span className="ml-1">врачей доступно</span>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
