import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tag, Gift } from "lucide-react";
import { DiscountCodeManager } from "./DiscountCodeManager";
import { BotFreePeriodCodeManager } from "./BotFreePeriodCodeManager";

export function CodesManager() {
  const [tab, setTab] = useState<string>(() => {
    try { return localStorage.getItem("os_admin_codes_tab") || "discount"; } catch { return "discount"; }
  });
  const onTabChange = (v: string) => {
    setTab(v);
    try { localStorage.setItem("os_admin_codes_tab", v); } catch { /* ignore */ }
  };
  return (
    <Tabs value={tab} onValueChange={onTabChange} className="w-full">
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
