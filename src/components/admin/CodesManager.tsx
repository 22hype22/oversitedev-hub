import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tag, Gift } from "lucide-react";
import { DiscountCodeManager } from "./DiscountCodeManager";
import { BotFreePeriodCodeManager } from "./BotFreePeriodCodeManager";

export function CodesManager() {
  return (
    <Tabs defaultValue="discount" className="w-full">
      <TabsList className="grid w-full grid-cols-2 max-w-md">
        <TabsTrigger value="discount" className="gap-2">
          <Tag className="h-4 w-4" />
          Discount codes
        </TabsTrigger>
        <TabsTrigger value="free" className="gap-2">
          <Gift className="h-4 w-4" />
          Free hosting codes
        </TabsTrigger>
      </TabsList>

      <TabsContent value="discount" className="mt-4">
        <DiscountCodeManager />
      </TabsContent>
      <TabsContent value="free" className="mt-4">
        <BotFreePeriodCodeManager />
      </TabsContent>
    </Tabs>
  );
}
