import { ShrinkIcon } from "lucide-react";
import { ImageOptimizer } from "@/components/image-optimizer";

export default function Home() {
  return (
    <main className="relative isolate mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 lg:py-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 -z-10 mx-auto h-72 max-w-3xl rounded-full bg-foreground/4 blur-3xl"
      />
      <header className="mb-8 flex items-center gap-3.5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-foreground text-background shadow-sm">
          <ShrinkIcon className="size-5" />
        </div>
        <div>
          <h1 className="font-heading text-lg font-semibold tracking-tight">
            Image Optimizer
          </h1>
          <p className="text-sm text-muted-foreground">
            Compress, convert and resize images in batches, saved straight to a
            folder.
          </p>
        </div>
      </header>
      <ImageOptimizer />
    </main>
  );
}
