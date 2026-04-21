import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, MessageSquare } from "lucide-react";
import { FormEvent } from "react";

export const Contact = () => {
  const { toast } = useToast();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    toast({
      title: "Message sent",
      description: "Thanks — we'll get back to you within 1 business day.",
    });
    (e.target as HTMLFormElement).reset();
  };

  return (
    <section id="contact" className="py-24 md:py-32 bg-secondary/30 border-t border-border">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-start max-w-6xl mx-auto">
          <div>
            <div className="text-primary text-sm font-medium mb-3">Get in touch</div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Ready to build <span className="text-gradient">something great?</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Tell us about your project. We'll respond with clear next steps, pricing, and a timeline.
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center">
                  <Mail size={16} className="text-primary" />
                </div>
                <span className="text-muted-foreground">contact@oversite.dev</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center">
                  <MessageSquare size={16} className="text-primary" />
                </div>
                <span className="text-muted-foreground">Dedicated team support, start to launch</span>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="p-7 rounded-2xl bg-gradient-card border border-border space-y-4"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" required placeholder="Your name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required placeholder="you@example.com" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project">Project type</Label>
              <Input id="project" placeholder="e.g. Tycoon, Simulator, RPG" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Tell us about your idea</Label>
              <Textarea id="message" rows={5} required placeholder="Concept, scope, timeline..." />
            </div>
            <Button variant="hero" size="lg" type="submit" className="w-full">
              Send message
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
};
