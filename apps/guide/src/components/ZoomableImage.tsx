import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ZoomableImageProps {
  src: string;
  alt: string;
  className?: string;
}

/** An image that opens an enlarged overlay view when clicked. */
export function ZoomableImage({
  src,
  alt,
  className = '',
}: ZoomableImageProps) {
  const [enlarged, setEnlarged] = useState(false);

  useEffect(() => {
    if (!enlarged) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEnlarged(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enlarged]);

  return (
    <>
      <img
        src={src}
        alt={alt}
        title="Click to enlarge"
        className={`cursor-zoom-in ${className}`}
        onClick={() => setEnlarged(true)}
      />
      {/* Portaled to body: an ancestor with backdrop-filter (the glass
          panels) becomes the containing block for fixed descendants,
          which would pin the overlay inside the panel instead of the
          viewport. */}
      {enlarged &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-6"
            onClick={() => setEnlarged(false)}
          >
            <img
              src={src}
              alt={alt}
              className="max-h-full max-w-full rounded-xl"
            />
          </div>,
          document.body
        )}
    </>
  );
}
