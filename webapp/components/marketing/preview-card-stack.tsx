import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PREVIEW_CARDS } from "@/components/marketing/site-content";

type PreviewCardStackProps = {
  compact?: boolean;
};

export function PreviewCardStack({ compact = false }: PreviewCardStackProps) {
  return (
    <div className="grid gap-4">
      {PREVIEW_CARDS.map((card, index) => (
        <Card
          key={card.title}
          className={[
            "overflow-hidden border-border/60 shadow-sm",
            index === 1 ? "lg:translate-x-8" : "",
            index === 2 ? "lg:-translate-x-6" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className={`bg-gradient-to-br ${card.accentClassName}`}>
            <CardHeader className={compact ? "space-y-3 pb-3" : "space-y-4"}>
              <div className="flex items-center justify-between gap-3">
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {card.eyebrow}
                </Badge>
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  Live workspace
                </div>
              </div>
              <div className="space-y-2">
                <CardTitle className={compact ? "text-xl" : "text-2xl"}>
                  {card.title}
                </CardTitle>
                <CardDescription className="max-w-xl leading-6 text-muted-foreground">
                  {card.description}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 pb-6">
              {card.rows.map((row) => (
                <div
                  key={`${card.title}-${row.label}`}
                  className="flex items-center justify-between rounded-2xl border border-border/50 bg-background/85 px-4 py-3"
                >
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className="text-sm font-semibold text-foreground">{row.value}</span>
                </div>
              ))}
            </CardContent>
          </div>
        </Card>
      ))}
    </div>
  );
}
