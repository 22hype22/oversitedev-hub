import { cn } from "@/lib/utils";

/**
 * Animated hexagon outline loader inspired by the Oversite logomark.
 * A primary-colored dash traces around the hexagon path to indicate that
 * the bot is being prepared / built but isn't ready yet.
 */
export const HexagonLoader = ({
  className,
  size = 18,
}: {
  className?: string;
  size?: number;
}) => {
  // Pointy-top hexagon path, ~100x100 viewBox
  const d = "M50 6 L91 28 L91 72 L50 94 L9 72 L9 28 Z";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {/* faint base ring */}
      <path
        d={d}
        stroke="hsl(var(--primary) / 0.2)"
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* animated tracing segment */}
      <path
        d={d}
        stroke="hsl(var(--primary))"
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="80 320"
        className="hex-loader-trace"
        style={{ pathLength: 1 }}
      />
    </svg>
  );
};

export default HexagonLoader;
