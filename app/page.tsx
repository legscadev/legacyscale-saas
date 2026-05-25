import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <Card className="w-[400px]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Legacy Scale</CardTitle>
            <Badge variant="secondary">MVP</Badge>
          </div>
          <CardDescription>Agency Education Platform</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Phase 0 Setup Complete</p>
          <div className="flex gap-2">
            <Button>Get Started</Button>
            <Button variant="outline">Learn More</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
