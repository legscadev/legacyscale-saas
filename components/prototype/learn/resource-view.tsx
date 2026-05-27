import { Download, FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { formatFileSize, type Lesson } from "@/lib/prototype"

export function ResourceView({ lesson }: { lesson: Lesson }) {
  return (
    <Card className="gap-5 p-6">
      <div>
        <h2 className="text-lg font-semibold">{lesson.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {lesson.description}
        </p>
      </div>

      <div className="flex items-center gap-4 rounded-xl border p-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-error/10 text-error">
          <FileText className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{lesson.resourceName}</p>
          <p className="text-xs text-muted-foreground">
            PDF · {lesson.resourceSize ? formatFileSize(lesson.resourceSize) : ""}
          </p>
        </div>
        <Button>
          <Download />
          Download
        </Button>
      </div>

      <div className="flex aspect-[1.4] items-center justify-center rounded-xl border border-dashed bg-muted/30 text-sm text-muted-foreground">
        Document preview
      </div>
    </Card>
  )
}
