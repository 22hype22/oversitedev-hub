import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tag, Gift } from "lucide-react";
import { DiscountCodeManager } from "./DiscountCodeManager";
import { BotFreePeriodCodeManager } from "./BotFreePeriodCodeManager";

export function CodesManager() {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center">
          <Tag className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Codes</h3>
          <p className="text-sm text-muted-foreground">
            Manage discount codes and free hosting codes from one place.
          </p>
        </div>
      </div>

      <Tabs defaultValue="discount" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="discount" className="gap-2">
            <Tag className="h-4 w-4" />
            Discount
          </TabsTrigger>
          <TabsTrigger value="free" className="gap-2">
            <Gift className="h-4 w-4" />
            Free hosting
          </TabsTrigger>
        </TabsList>

        <TabsContent value="discount" className="mt-4 [&>div]:p-0 [&>div]:border-0 [&>div]:bg-transparent [&>div]:shadow-none">
          <DiscountCodeManager />
        </TabsContent>
        <TabsContent value="free" className="mt-4 [&>div]:p-0 [&>div]:border-0 [&>div]:bg-transparent [&>div]:shadow-none">
          <BotFreePeriodCodeManager />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
