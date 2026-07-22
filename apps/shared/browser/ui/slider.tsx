import * as SliderPrimitive from '@radix-ui/react-slider';
import type { ComponentProps } from 'react';

// shadcn-style slider on the Radix primitive, styled with the shared
// tokens: line for the track, accent for the filled range and the thumb
// ring. Controlled like the primitive — `value` is an array, one entry
// per thumb.

export function Slider({
  className = '',
  ...props
}: ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      {...props}
      className={`relative flex h-5 w-full touch-none items-center select-none ${className}`}
    >
      <SliderPrimitive.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-line">
        <SliderPrimitive.Range className="absolute h-full bg-accent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className="block size-4 cursor-pointer rounded-full border-2 border-accent bg-page focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        aria-label={props['aria-label']}
      />
    </SliderPrimitive.Root>
  );
}
